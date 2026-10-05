#!/usr/bin/env python3
"""
Menovation Multi-Tier Rate-Limited Asset Downloader
Strictly enforces:
  - Videos & Workout Details: Max 5 per hour (spaced ~10-12 minutes)
  - Exercise GIFs & Images: Max 60 per hour (~1 per minute)
  - Interleaved scheduling: Downloads GIFs while waiting for next video slot
  - Automatic JWT authentication and token renewal
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

# Credentials
DEFAULT_USERNAME = os.environ.get("MVN_USERNAME", "krystaleearchibald@gmail.com")
DEFAULT_PASSWORD = os.environ.get("MVN_PASSWORD", "qHR86ZdslA60Dy")

# Rate Limits
VIDEO_MAX_PER_HOUR = 5
VIDEO_MIN_INTERVAL = 600   # 10 minutes between videos
GIF_MAX_PER_HOUR = 60
GIF_MIN_INTERVAL = 55      # ~1 minute between GIFs

# Logging
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


class TieredRateLimitedDownloader:
    def __init__(self, username=DEFAULT_USERNAME, password=DEFAULT_PASSWORD):
        self.username = username
        self.password = password
        self.token = None
        
        self.state = self.load_state()
        self.ensure_queue_initialized()

    def load_state(self) -> dict:
        if STATE_FILE.exists():
            try:
                with open(STATE_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    # Migrate old state format if needed
                    if "video_history" not in data:
                        data["video_history"] = data.get("download_history", [])
                    if "gif_history" not in data:
                        data["gif_history"] = []
                    return data
            except Exception as e:
                logger.error(f"Error loading state: {e}")

        return {
            "version": 2,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "video_history": [],
            "gif_history": [],
            "last_video_time": None,
            "last_gif_time": None,
            "completed_assets": {},
            "failed_assets": {},
            "queue": []
        }

    def save_state(self):
        STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
        self.state["video_history"] = [ts for ts in self.state.get("video_history", []) if ts > cutoff]
        self.state["gif_history"] = [ts for ts in self.state.get("gif_history", []) if ts > cutoff]
        
        with open(STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(self.state, f, indent=2)

    def authenticate(self) -> bool:
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
                    self.token = res.get("data", {}).get("token")
                    logger.info("Authentication successful. Bearer token active.")
                    return True
                else:
                    logger.error(f"Authentication failed: {res}")
                    return False
        except Exception as e:
            logger.error(f"Authentication request failed: {e}")
            return False

    def ensure_queue_initialized(self):
        if self.state.get("queue"):
            return

        logger.info("Initializing multi-tier queue...")
        queue = []

        # 1. Member-Gated Workouts (Tier: video/workout)
        try:
            req = urllib.request.Request("https://menovation.com/wp-json/mvn-app/v1/workouts", headers=HEADERS)
            with urllib.request.urlopen(req, timeout=30) as resp:
                all_workouts = json.loads(resp.read().decode())
                for w_id, w_info in all_workouts.items():
                    post_id = w_info.get("workoutPostId", w_id)
                    queue.append({
                        "id": f"workout_{post_id}",
                        "tier": "video",
                        "title": w_info.get("workoutTitle", f"Workout {post_id}"),
                        "url": f"https://menovation.com/wp-json/mvn-app/v1/workouts/{post_id}",
                        "dest_path": str((WORKOUTS_DIR / f"{post_id}.json").relative_to(BASE_DIR)),
                        "requires_auth": True
                    })
        except Exception as e:
            logger.warning(f"Could not load workouts from API: {e}")

        # 2. Exercise Demonstration GIFs (Tier: gif)
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
                                "tier": "gif",
                                "title": f"GIF: {ex.get('exerciseTitle', ex_id)}",
                                "url": gif_url,
                                "dest_path": str((MEDIA_DIR / "exercises" / "gifs" / filename).relative_to(BASE_DIR)),
                                "requires_auth": False
                            })
            except Exception as e:
                logger.error(f"Error reading exercises.json: {e}")

        completed = set(self.state.get("completed_assets", {}).keys())
        self.state["queue"] = [item for item in queue if item["id"] not in completed]
        logger.info(f"Queue populated with {len(self.state['queue'])} assets.")
        self.save_state()

    def get_tier_count_last_hour(self, tier: str) -> int:
        now = datetime.now(timezone.utc)
        one_hour_ago = (now - timedelta(hours=1)).isoformat()
        history_key = "video_history" if tier == "video" else "gif_history"
        recent = [ts for ts in self.state.get(history_key, []) if ts > one_hour_ago]
        return len(recent)

    def can_download_tier(self, tier: str) -> tuple[bool, float]:
        """Returns (is_allowed, wait_seconds_needed)"""
        now = datetime.now(timezone.utc)
        one_hour_ago = (now - timedelta(hours=1)).isoformat()
        history_key = "video_history" if tier == "video" else "gif_history"
        last_time_key = "last_video_time" if tier == "video" else "last_gif_time"
        
        max_per_hour = VIDEO_MAX_PER_HOUR if tier == "video" else GIF_MAX_PER_HOUR
        min_interval = VIDEO_MIN_INTERVAL if tier == "video" else GIF_MIN_INTERVAL

        recent = sorted([ts for ts in self.state.get(history_key, []) if ts > one_hour_ago])

        # Check hourly cap
        if len(recent) >= max_per_hour:
            oldest_dt = datetime.fromisoformat(recent[0])
            wake_time = oldest_dt + timedelta(hours=1, seconds=3)
            wait_hourly = max(0.0, (wake_time - now).total_seconds())
            return False, wait_hourly

        # Check spacing interval from last download of this tier
        last_time_str = self.state.get(last_time_key)
        if last_time_str:
            last_dt = datetime.fromisoformat(last_time_str)
            elapsed = (now - last_dt).total_seconds()
            if elapsed < min_interval:
                return False, min_interval - elapsed

        return True, 0.0

    def download_asset(self, item: dict) -> bool:
        asset_id = item["id"]
        tier = item.get("tier", "gif")
        url = item["url"]
        dest = BASE_DIR / item["dest_path"]
        requires_auth = item.get("requires_auth", False)

        logger.info(f"Downloading [{tier.upper()}]: {item['title']} -> {dest.name}")
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

                self.state["completed_assets"][asset_id] = {
                    "completed_at": now_str,
                    "tier": tier,
                    "size_bytes": size,
                    "sha256": sha256,
                    "path": item["dest_path"],
                    "url": url
                }

                history_key = "video_history" if tier == "video" else "gif_history"
                last_time_key = "last_video_time" if tier == "video" else "last_gif_time"
                
                self.state[history_key].append(now_str)
                self.state[last_time_key] = now_str
                
                # Remove from queue
                self.state["queue"] = [q for q in self.state["queue"] if q["id"] != asset_id]
                self.save_state()

                v_hour = self.get_tier_count_last_hour("video")
                g_hour = self.get_tier_count_last_hour("gif")
                logger.info(f"OK ({size:,} bytes). Hourly Rate -> Videos: {v_hour}/{VIDEO_MAX_PER_HOUR} | GIFs: {g_hour}/{GIF_MAX_PER_HOUR}")
                return True

        except urllib.error.HTTPError as e:
            if e.code == 401 and requires_auth:
                logger.warning("Token expired (401). Refreshing token and retrying...")
                self.token = None
                if self.authenticate():
                    return self.download_asset(item)
            logger.error(f"HTTP Error {e.code} while downloading {url}: {e}")
            self.state["failed_assets"][asset_id] = {"error": str(e), "code": e.code}
            self.state["queue"] = [q for q in self.state["queue"] if q["id"] != asset_id]
            self.save_state()
            return False
        except Exception as e:
            logger.error(f"Error downloading {url}: {e}")
            self.state["failed_assets"][asset_id] = {"error": str(e)}
            self.state["queue"] = [q for q in self.state["queue"] if q["id"] != asset_id]
            self.save_state()
            return False

    def print_status(self):
        completed = len(self.state.get("completed_assets", {}))
        pending = len(self.state.get("queue", []))
        v_pending = sum(1 for item in self.state.get("queue", []) if item.get("tier") == "video")
        g_pending = sum(1 for item in self.state.get("queue", []) if item.get("tier") == "gif")
        
        v_hourly = self.get_tier_count_last_hour("video")
        g_hourly = self.get_tier_count_last_hour("gif")
        
        print("\n" + "=" * 65)
        print(" Menovation Tiered Rate-Limited Asset Downloader Status")
        print("=" * 65)
        print(f"Total Completed:       {completed}")
        print(f"Total Pending Queue:   {pending} (Videos/Workouts: {v_pending} | GIFs: {g_pending})")
        print(f"Videos Trailing Hour:  {v_hourly} / {VIDEO_MAX_PER_HOUR} (Max 5/hr, spaced >=10 min)")
        print(f"GIFs Trailing Hour:    {g_hourly} / {GIF_MAX_PER_HOUR} (Max 60/hr, spaced >=55 sec)")
        print(f"Last Video Download:   {self.state.get('last_video_time') or 'None'}")
        print(f"Last GIF Download:     {self.state.get('last_gif_time') or 'None'}")
        print("=" * 65 + "\n")

    def run_loop(self):
        logger.info("Starting Menovation Tiered Downloader Daemon...")
        logger.info(f"Policy: Videos <= {VIDEO_MAX_PER_HOUR}/hr (every 10m) | GIFs <= {GIF_MAX_PER_HOUR}/hr (every 1m)")

        while self.state.get("queue"):
            can_video, wait_video = self.can_download_tier("video")
            can_gif, wait_gif = self.can_download_tier("gif")

            # Check if there is an eligible video asset ready
            video_items = [q for q in self.state["queue"] if q.get("tier") == "video"]
            gif_items = [q for q in self.state["queue"] if q.get("tier") == "gif"]

            item_to_download = None

            if video_items and can_video:
                item_to_download = video_items[0]
            elif gif_items and can_gif:
                item_to_download = gif_items[0]
            elif not video_items and gif_items and can_gif:
                item_to_download = gif_items[0]
            elif not gif_items and video_items and can_video:
                item_to_download = video_items[0]

            if item_to_download:
                self.download_asset(item_to_download)
                # Brief sleep between any network calls (2-5s)
                time.sleep(random.uniform(2, 5))
            else:
                # Calculate minimum wait time
                wait_candidates = []
                if video_items:
                    wait_candidates.append(wait_video)
                if gif_items:
                    wait_candidates.append(wait_gif)

                wait_sec = min(wait_candidates) if wait_candidates else 30.0
                wait_sec = max(5.0, wait_sec)
                logger.info(f"Rate window active. Sleeping {wait_sec:.1f}s before next check (Videos: {wait_video:.0f}s, GIFs: {wait_gif:.0f}s)...")
                time.sleep(wait_sec)

        logger.info("All queued assets completed!")


def main():
    parser = argparse.ArgumentParser(description="Menovation Tiered Rate-Limited Downloader")
    parser.add_argument("--status", action="store_true", help="Display current queue and rate limit status")
    parser.add_argument("--daemon", action="store_true", help="Run continuously in the background")
    parser.add_argument("--once", action="store_true", help="Download 1 asset immediately according to rate limits")

    args = parser.parse_args()
    downloader = TieredRateLimitedDownloader()

    if args.status:
        downloader.print_status()
        return

    if args.once:
        can_v, _ = downloader.can_download_tier("video")
        can_g, _ = downloader.can_download_tier("gif")
        v_items = [q for q in downloader.state["queue"] if q.get("tier") == "video"]
        g_items = [q for q in downloader.state["queue"] if q.get("tier") == "gif"]

        if v_items and can_v:
            downloader.download_asset(v_items[0])
        elif g_items and can_g:
            downloader.download_asset(g_items[0])
        else:
            print("No asset is currently eligible due to rate limits. Run with --status to check wait times.")
        return

    downloader.print_status()
    downloader.run_loop()


if __name__ == "__main__":
    main()
