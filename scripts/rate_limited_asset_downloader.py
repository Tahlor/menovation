#!/usr/bin/env python3
"""
Menovation Rate-Limited Asset Downloader
Strictly enforces:
  - No more than 5 assets per hour (rolling 60-minute window)
  - 5-10 minutes spacing between downloads
  - Automatic JWT token authentication and renewal
  - Persistent queue state in assets/download_state.json
"""

import os
import sys
import time
import json
import random
import hashlib
import logging
import argparse
import urllib.request
import urllib.parse
import urllib.error
from pathlib import Path
from datetime import datetime, timezone, timedelta

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
ASSETS_DIR = BASE_DIR / "assets"
WORKOUTS_DIR = ASSETS_DIR / "workouts"
MEDIA_DIR = ASSETS_DIR / "media"
STATE_FILE = ASSETS_DIR / "download_state.json"
MANIFEST_FILE = ASSETS_DIR / "manifest.json"
LOG_FILE = ASSETS_DIR / "rate_limited_downloader.log"

# Default Credentials
DEFAULT_USERNAME = os.environ.get("MVN_USERNAME", "krystaleearchibald@gmail.com")
DEFAULT_PASSWORD = os.environ.get("MVN_PASSWORD", "qHR86ZdslA60Dy")

# Rate limit defaults
DEFAULT_MAX_PER_HOUR = 5
DEFAULT_MIN_INTERVAL = 360  # 6 minutes
DEFAULT_MAX_INTERVAL = 600  # 10 minutes

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("RateLimitedDownloader")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "*/*"
}


class RateLimitedDownloader:
    def __init__(self, username=DEFAULT_USERNAME, password=DEFAULT_PASSWORD,
                 max_per_hour=DEFAULT_MAX_PER_HOUR, min_interval=DEFAULT_MIN_INTERVAL,
                 max_interval=DEFAULT_MAX_INTERVAL):
        self.username = username
        self.password = password
        self.max_per_hour = max_per_hour
        self.min_interval = min_interval
        self.max_interval = max_interval
        
        self.token = None
        self.token_expiry = None
        
        self.state = self.load_state()
        self.ensure_queue_initialized()

    def load_state(self) -> dict:
        if STATE_FILE.exists():
            try:
                with open(STATE_FILE, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Error loading state file: {e}")
        
        return {
            "version": 1,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_download_time": None,
            "download_history": [],  # Timestamps of downloads in ISO format
            "completed_assets": {},  # asset_id -> metadata
            "failed_assets": {},     # asset_id -> error details
            "queue": []             # ordered list of asset objects
        }

    def save_state(self):
        STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
        # Prune download history to last 24 hours
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
        self.state["download_history"] = [
            ts for ts in self.state.get("download_history", []) if ts > cutoff
        ]
        with open(STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(self.state, f, indent=2)

    def authenticate(self) -> bool:
        """Obtain or refresh JWT bearer token"""
        logger.info(f"Authenticating with Menovation API as {self.username}...")
        url = "https://menovation.com/wp-json/jwt-auth/v1/token"
        data = urllib.parse.urlencode({
            "username": self.username,
            "password": self.password
        }).encode("utf-8")

        req = urllib.request.Request(
            url,
            data=data,
            headers={**HEADERS, "Content-Type": "application/x-www-form-urlencoded"}
        )

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                res = json.loads(resp.read().decode())
                if res.get("statusCode") == 200 or "data" in res:
                    data_obj = res.get("data", {})
                    self.token = data_obj.get("token")
                    logger.info(f"Authentication successful for {data_obj.get('displayName', self.username)}.")
                    return True
                else:
                    logger.error(f"Authentication failed: {res}")
                    return False
        except Exception as e:
            logger.error(f"Authentication request failed: {e}")
            return False

    def ensure_queue_initialized(self):
        """Populate the queue from exercises and workouts if queue is empty"""
        if self.state.get("queue"):
            return

        logger.info("Initializing download queue from local catalog...")
        queue = []

        # 1. Member-Gated Workouts (512 workouts)
        workouts_json = ASSETS_DIR / "data" / "programs.json"
        all_workouts = {}
        try:
            req = urllib.request.Request("https://menovation.com/wp-json/mvn-app/v1/workouts", headers=HEADERS)
            with urllib.request.urlopen(req, timeout=30) as resp:
                all_workouts = json.loads(resp.read().decode())
        except Exception as e:
            logger.warning(f"Could not fetch workout list from API ({e}), falling back to local files.")

        if all_workouts:
            for w_id, w_info in all_workouts.items():
                post_id = w_info.get("workoutPostId", w_id)
                queue.append({
                    "id": f"workout_{post_id}",
                    "type": "workout_detail",
                    "title": w_info.get("workoutTitle", f"Workout {post_id}"),
                    "url": f"https://menovation.com/wp-json/mvn-app/v1/workouts/{post_id}",
                    "dest_path": str((WORKOUTS_DIR / f"{post_id}.json").relative_to(BASE_DIR)),
                    "requires_auth": True
                })

        # 2. Exercise Demonstration GIFs
        exercises_json = ASSETS_DIR / "data" / "exercises.json"
        if exercises_json.exists():
            try:
                with open(exercises_json, "r", encoding="utf-8") as f:
                    exercises = json.load(f)
                    for ex_id, ex in exercises.items():
                        gif_url = ex.get("gifUrl")
                        if gif_url:
                            filename = gif_url.split("/")[-1].split("?")[0]
                            queue.append({
                                "id": f"exercise_gif_{ex_id}",
                                "type": "exercise_gif",
                                "title": f"GIF: {ex.get('exerciseTitle', ex_id)}",
                                "url": gif_url,
                                "dest_path": str((MEDIA_DIR / "exercises" / "gifs" / filename).relative_to(BASE_DIR)),
                                "requires_auth": False
                            })
            except Exception as e:
                logger.error(f"Error reading exercises.json: {e}")

        # Filter out already completed
        completed = set(self.state.get("completed_assets", {}).keys())
        self.state["queue"] = [item for item in queue if item["id"] not in completed]
        logger.info(f"Queue populated with {len(self.state['queue'])} assets.")
        self.save_state()

    def get_downloads_in_last_hour(self) -> int:
        now = datetime.now(timezone.utc)
        one_hour_ago = (now - timedelta(hours=1)).isoformat()
        recent = [ts for ts in self.state.get("download_history", []) if ts > one_hour_ago]
        return len(recent)

    def get_wait_time_for_rate_limit(self) -> float:
        """Returns seconds to wait until we are under max_per_hour"""
        now = datetime.now(timezone.utc)
        one_hour_ago = (now - timedelta(hours=1)).isoformat()
        recent = sorted([ts for ts in self.state.get("download_history", []) if ts > one_hour_ago])
        
        if len(recent) < self.max_per_hour:
            return 0.0

        # Must wait until the oldest download in the window is > 1 hour old
        oldest_dt = datetime.fromisoformat(recent[0])
        wake_time = oldest_dt + timedelta(hours=1, seconds=5)
        wait_seconds = (wake_time - now).total_seconds()
        return max(0.0, wait_seconds)

    def download_next_asset(self) -> bool:
        if not self.state.get("queue"):
            logger.info("All queued assets have been downloaded!")
            return False

        item = self.state["queue"][0]
        asset_id = item["id"]
        url = item["url"]
        dest = BASE_DIR / item["dest_path"]
        requires_auth = item.get("requires_auth", False)

        logger.info(f"Downloading [{item['type']}]: {item['title']} -> {dest.name}")
        dest.parent.mkdir(parents=True, exist_ok=True)

        req_headers = dict(HEADERS)
        if requires_auth:
            if not self.token:
                if not self.authenticate():
                    logger.error("Authentication required but failed. Aborting asset.")
                    return False
            req_headers["Authorization"] = f"Bearer {self.token}"

        req = urllib.request.Request(url, headers=req_headers)

        try:
            with urllib.request.urlopen(req, timeout=45) as resp:
                content = resp.read()
                dest.write_bytes(content)
                size = len(content)
                sha256 = hashlib.sha256(content).hexdigest()
                now_str = datetime.now(timezone.utc).isoformat()

                # Record completion
                self.state["completed_assets"][asset_id] = {
                    "completed_at": now_str,
                    "size_bytes": size,
                    "sha256": sha256,
                    "path": item["dest_path"],
                    "url": url
                }
                self.state["download_history"].append(now_str)
                self.state["last_download_time"] = now_str
                self.state["queue"].pop(0)
                self.save_state()

                logger.info(f"Successfully downloaded {dest.name} ({size:,} bytes).")
                logger.info(f"Assets in trailing hour: {self.get_downloads_in_last_hour()}/{self.max_per_hour}")
                return True

        except urllib.error.HTTPError as e:
            if e.code == 401 and requires_auth:
                logger.warning("Token expired (401). Refreshing token and retrying...")
                self.token = None
                if self.authenticate():
                    return self.download_next_asset()
            logger.error(f"HTTP Error {e.code} while downloading {url}: {e}")
            self.state["failed_assets"][asset_id] = {"error": str(e), "code": e.code}
            self.state["queue"].pop(0)
            self.save_state()
            return False
        except Exception as e:
            logger.error(f"Error downloading {url}: {e}")
            self.state["failed_assets"][asset_id] = {"error": str(e)}
            self.state["queue"].pop(0)
            self.save_state()
            return False

    def print_status(self):
        completed_count = len(self.state.get("completed_assets", {}))
        pending_count = len(self.state.get("queue", []))
        failed_count = len(self.state.get("failed_assets", {}))
        hourly_count = self.get_downloads_in_last_hour()
        
        print("\n" + "=" * 60)
        print(" Menovation Rate-Limited Asset Downloader Status")
        print("=" * 60)
        print(f"Total Completed:       {completed_count}")
        print(f"Total Pending Queue:   {pending_count}")
        print(f"Total Failed:          {failed_count}")
        print(f"Downloads Last Hour:   {hourly_count} / {self.max_per_hour} (Max)")
        print(f"Last Download:         {self.state.get('last_download_time') or 'None'}")
        
        if pending_count > 0:
            next_item = self.state["queue"][0]
            print(f"Next in Queue:         [{next_item['type']}] {next_item['title']}")
        print("=" * 60 + "\n")

    def run_loop(self):
        logger.info("Starting Rate-Limited Downloader Loop...")
        logger.info(f"Settings: max {self.max_per_hour}/hour, interval {self.min_interval//60}-{self.max_interval//60} mins.")

        while self.state.get("queue"):
            # Check rolling hourly limit
            wait_for_rate_limit = self.get_wait_time_for_rate_limit()
            if wait_for_rate_limit > 0:
                logger.info(f"Rate limit reached ({self.max_per_hour}/hr). Sleeping {wait_for_rate_limit/60:.1f} mins until window clears...")
                time.sleep(wait_for_rate_limit)

            # Download asset
            success = self.download_next_asset()

            if not self.state.get("queue"):
                logger.info("All downloads completed!")
                break

            # Sleep spaced interval (5-10 minutes)
            sleep_time = random.uniform(self.min_interval, self.max_interval)
            logger.info(f"Sleeping {sleep_time/60:.1f} minutes before next download...")
            time.sleep(sleep_time)


def main():
    parser = argparse.ArgumentParser(description="Menovation Rate-Limited Asset Downloader")
    parser.add_argument("--once", action="store_true", help="Download a single asset and exit")
    parser.add_argument("--status", action="store_true", help="Show current queue and rate limit status")
    parser.add_argument("--daemon", action="store_true", help="Run continuously in the background")
    parser.add_argument("--max-per-hour", type=int, default=DEFAULT_MAX_PER_HOUR, help="Max assets per hour (default: 5)")
    parser.add_argument("--min-interval", type=int, default=DEFAULT_MIN_INTERVAL, help="Min seconds between downloads (default: 360 = 6 mins)")
    parser.add_argument("--max-interval", type=int, default=DEFAULT_MAX_INTERVAL, help="Max seconds between downloads (default: 600 = 10 mins)")

    args = parser.parse_args()

    downloader = RateLimitedDownloader(
        max_per_hour=args.max_per_hour,
        min_interval=args.min_interval,
        max_interval=args.max_interval
    )

    if args.status:
        downloader.print_status()
        return

    if args.once:
        # Check rate limit before running
        wait = downloader.get_wait_time_for_rate_limit()
        if wait > 0:
            print(f"Rate limit reached ({downloader.max_per_hour}/hr). Must wait {wait/60:.1f} minutes.")
            sys.exit(1)
        downloader.download_next_asset()
        return

    if args.daemon:
        downloader.run_loop()
    else:
        # Default behavior: Show status and run loop
        downloader.print_status()
        downloader.run_loop()


if __name__ == "__main__":
    main()
