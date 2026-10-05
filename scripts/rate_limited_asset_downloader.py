#!/usr/bin/env python3
"""
Menovation Multi-Tier Organic Rate-Limited Asset Downloader
Features:
  - Videos & Workouts: Max 10 per hour (2x previous limit, min 1 min spacing)
  - Exercise GIFs: Max 120 per hour (2x previous limit, min 5 sec spacing)
  - Organic human-like pacing: Small realistic bursts (2-4 items spaced 5-15s)
    interleaved with short pauses, avoiding spiky hourly bursts or rigid clockwork intervals.
  - Strict rolling 60-minute window limits.
  - Automatic JWT authentication and token renewal.
  - Persistent queue state in assets/download_state.json.
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

# 2x Hourly Rate Limits
VIDEO_MAX_PER_HOUR = 10   # 10 workouts/videos per rolling 60 min
GIF_MAX_PER_HOUR = 120    # 120 exercise GIFs per rolling 60 min

# Minimum spacing between downloads of the same tier
VIDEO_MIN_SPACING = 60    # 1 minute minimum
GIF_MIN_SPACING = 5       # 5 seconds minimum

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


class OrganicRateLimitedDownloader:
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
                    if "video_history" not in data:
                        data["video_history"] = []
                    if "gif_history" not in data:
                        data["gif_history"] = []
                    return data
            except Exception as e:
                logger.error(f"Error reading state: {e}")

        return {
            "version": 3,
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

        # 1. Workouts (tier: video)
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

        # 2. Exercise GIFs (tier: gif)
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
        logger.info(f"Queue initialized with {len(self.state['queue'])} items.")
        self.save_state()

    def get_tier_count_last_hour(self, tier: str) -> int:
        now = datetime.now(timezone.utc)
        one_hour_ago = (now - timedelta(hours=1)).isoformat()
        history_key = "video_history" if tier == "video" else "gif_history"
        recent = [ts for ts in self.state.get(history_key, []) if ts > one_hour_ago]
        return len(recent)

    def can_download_tier(self, tier: str) -> tuple[bool, float]:
        """
        Returns (is_allowed, seconds_to_wait).
        Strictly enforces rolling 60-min window and minimum interval.
        """
        now = datetime.now(timezone.utc)
        one_hour_ago = (now - timedelta(hours=1)).isoformat()
        
        is_video = (tier == "video")
        history_key = "video_history" if is_video else "gif_history"
        last_time_key = "last_video_time" if is_video else "last_gif_time"
        
        max_per_hour = VIDEO_MAX_PER_HOUR if is_video else GIF_MAX_PER_HOUR
        min_spacing = VIDEO_MIN_SPACING if is_video else GIF_MIN_SPACING

        recent = sorted([ts for ts in self.state.get(history_key, []) if ts > one_hour_ago])

        # 1. Hard cap check in trailing 60 minutes
        if len(recent) >= max_per_hour:
            oldest_dt = datetime.fromisoformat(recent[0])
            # Add small random jitter (3-12s) to prevent clock-synchronized burst peaks
            wake_time = oldest_dt + timedelta(hours=1, seconds=random.uniform(3, 12))
            wait_seconds = max(1.0, (wake_time - now).total_seconds())
            return False, wait_seconds

        # 2. Minimum spacing from previous download of this tier
        last_time_str = self.state.get(last_time_key)
        if last_time_str:
            last_dt = datetime.fromisoformat(last_time_str)
            elapsed = (now - last_dt).total_seconds()
            if elapsed < min_spacing:
                return False, min_spacing - elapsed

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
                self.state["queue"] = [q for q in self.state["queue"] if q["id"] != asset_id]
                self.save_state()

                v_hour = self.get_tier_count_last_hour("video")
                g_hour = self.get_tier_count_last_hour("gif")
                logger.info(f"OK ({size:,} bytes). Trailing Hour -> Videos: {v_hour}/{VIDEO_MAX_PER_HOUR} | GIFs: {g_hour}/{GIF_MAX_PER_HOUR}")
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
        print(" Menovation Organic Rate-Limited Asset Downloader Status")
        print("=" * 65)
        print(f"Total Completed:       {completed}")
        print(f"Total Pending Queue:   {pending} (Videos: {v_pending} | GIFs: {g_pending})")
        print(f"Videos Trailing Hour:  {v_hourly} / {VIDEO_MAX_PER_HOUR} (Max 10/hr, min 1m spacing)")
        print(f"GIFs Trailing Hour:    {g_hourly} / {GIF_MAX_PER_HOUR} (Max 120/hr, min 5s spacing)")
        print(f"Last Video Download:   {self.state.get('last_video_time') or 'None'}")
        print(f"Last GIF Download:     {self.state.get('last_gif_time') or 'None'}")
        print("=" * 65 + "\n")

    def run_loop(self):
        logger.info("Starting Menovation Organic Downloader Daemon...")
        logger.info(f"Target Limits: Videos <= {VIDEO_MAX_PER_HOUR}/hr (min 60s) | GIFs <= {GIF_MAX_PER_HOUR}/hr (min 5s)")

        consecutive_gifs = 0

        while self.state.get("queue"):
            can_video, wait_video = self.can_download_tier("video")
            can_gif, wait_gif = self.can_download_tier("gif")

            video_items = [q for q in self.state["queue"] if q.get("tier") == "video"]
            gif_items = [q for q in self.state["queue"] if q.get("tier") == "gif"]

            item_to_download = None

            # Video priority: if video is eligible, download video
            if video_items and can_video:
                item_to_download = video_items[0]
                consecutive_gifs = 0
            # Otherwise, download GIF if eligible
            elif gif_items and can_gif:
                item_to_download = gif_items[0]
                consecutive_gifs += 1

            if item_to_download:
                self.download_asset(item_to_download)

                tier = item_to_download.get("tier")
                if tier == "video":
                    # After video, short natural pause (60 - 90 seconds)
                    sleep_sec = random.uniform(60, 95)
                    logger.info(f"Pacing: Post-video pause for {sleep_sec:.1f}s...")
                    time.sleep(sleep_sec)
                else:
                    # Organic pacing for GIFs:
                    # Every 2-4 consecutive GIFs, take a slightly longer breath (15-35s)
                    # otherwise a short 5-15s spacing.
                    if consecutive_gifs >= random.randint(2, 4):
                        sleep_sec = random.uniform(18, 38)
                        consecutive_gifs = 0
                        logger.info(f"Pacing: Organic breath pause ({sleep_sec:.1f}s)...")
                    else:
                        sleep_sec = random.uniform(5, 14)
                    time.sleep(sleep_sec)

            else:
                # Neither is ready; calculate shortest wait needed
                wait_candidates = []
                if video_items:
                    wait_candidates.append(wait_video)
                if gif_items:
                    wait_candidates.append(wait_gif)

                wait_sec = min(wait_candidates) if wait_candidates else 15.0
                wait_sec = max(3.0, wait_sec)
                logger.info(f"Rate window cooling. Sleeping {wait_sec:.1f}s (Videos: {wait_video:.0f}s, GIFs: {wait_gif:.0f}s)...")
                time.sleep(wait_sec)

        logger.info("All queued assets completed successfully!")


def main():
    parser = argparse.ArgumentParser(description="Menovation Organic Rate-Limited Downloader")
    parser.add_argument("--status", action="store_true", help="Display queue and rate limit status")
    parser.add_argument("--daemon", action="store_true", help="Run continuously in the background")
    parser.add_argument("--once", action="store_true", help="Download 1 asset immediately if eligible")

    args = parser.parse_args()
    downloader = OrganicRateLimitedDownloader()

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
            print("No asset is currently eligible due to rate limits. Run with --status.")
        return

    downloader.print_status()
    downloader.run_loop()


if __name__ == "__main__":
    main()
