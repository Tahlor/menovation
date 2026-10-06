#!/usr/bin/env python3
"""
Menovation Vimeo 1080p Movie Downloader
Downloads actual full-length 1080p MP4 workout movies from authenticated Vimeo HLS streams.
Prioritizes:
  1. Strength Training programs (StrongHER, Embody Strength, PowHERful, Glute Builder, Power Builder)
  2. Followed by remaining workout classes.
Rate limits:
  - Strictly max 10 videos per rolling 60 minutes
  - Organic human-like spacing (~5-8 minutes between videos)
"""

import os
import sys
import time
import json
import random
import logging
import argparse
import subprocess
import urllib.request
import urllib.parse
from pathlib import Path
from datetime import datetime, timezone, timedelta

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
ASSETS_DIR = BASE_DIR / "assets"
WORKOUTS_DIR = ASSETS_DIR / "workouts"
VIDEOS_DIR = ASSETS_DIR / "videos"
STATE_FILE = ASSETS_DIR / "vimeo_download_state.json"
LOG_FILE = ASSETS_DIR / "vimeo_downloader.log"

# Credentials
DEFAULT_USERNAME = os.environ.get("MVN_USERNAME", "krystaleearchibald@gmail.com")
DEFAULT_PASSWORD = os.environ.get("MVN_PASSWORD", "qHR86ZdslA60Dy")

# Rate Limits
MAX_VIDEOS_PER_HOUR = 10
MIN_SPACING_SECONDS = 300   # 5 minutes minimum
MAX_SPACING_SECONDS = 480   # 8 minutes maximum

# Strength Program IDs
STRENGTH_PROGRAM_IDS = {782, 841, 5561, 5895, 6217}
STRENGTH_KEYWORDS = ["strength", "strong", "lift", "power", "glute", "muscle", "barbell", "dumbbell"]

# Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("VimeoMovieDownloader")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "*/*"
}


def sanitize_filename(name: str) -> str:
    valid_chars = "-_.() abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    clean = "".join(c for c in name if c in valid_chars).strip()
    return clean.replace(" ", "_")[:60]


class VimeoMovieDownloader:
    def __init__(self, username=DEFAULT_USERNAME, password=DEFAULT_PASSWORD):
        self.username = username
        self.password = password
        self.token = None
        
        VIDEOS_DIR.mkdir(parents=True, exist_ok=True)
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
            "download_history": [],  # Timestamps of downloads in ISO format
            "last_download_time": None,
            "completed_videos": {},  # workout_id -> info
            "failed_videos": {},
            "queue": []
        }

    def save_state(self):
        STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
        self.state["download_history"] = [
            ts for ts in self.state.get("download_history", []) if ts > cutoff
        ]
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

        logger.info("Building prioritized video queue (Strength Training first)...")
        all_workouts = {}

        # 1. Fetch full catalog list
        try:
            req = urllib.request.Request("https://menovation.com/wp-json/mvn-app/v1/workouts", headers=HEADERS)
            with urllib.request.urlopen(req, timeout=30) as resp:
                all_workouts = json.loads(resp.read().decode())
        except Exception as e:
            logger.warning(f"Could not load workouts from API ({e}), scanning local workouts dir...")

        # If API failed, load from local workouts dir
        if not all_workouts:
            for p in WORKOUTS_DIR.glob("*.json"):
                try:
                    with open(p) as f:
                        w = json.load(f)
                        wid = str(w.get("workoutPostId", p.stem))
                        all_workouts[wid] = w
                except Exception:
                    pass

        strength_queue = []
        other_queue = []

        completed_ids = set(self.state.get("completed_videos", {}).keys())

        for w_id, w_info in all_workouts.items():
            post_id = int(w_info.get("workoutPostId", w_id))
            if str(post_id) in completed_ids:
                continue

            title = w_info.get("workoutTitle", f"Workout_{post_id}")
            pid = w_info.get("programPostId", 0)

            is_strength = (
                pid in STRENGTH_PROGRAM_IDS or
                any(k in title.lower() for k in STRENGTH_KEYWORDS)
            )

            item = {
                "id": str(post_id),
                "workout_id": post_id,
                "title": title,
                "program_id": pid,
                "category": "Strength" if is_strength else "General",
                "duration_min": w_info.get("workoutDuration", 0)
            }

            if is_strength:
                strength_queue.append(item)
            else:
                other_queue.append(item)

        # Strength workouts first, then others
        self.state["queue"] = strength_queue + other_queue
        logger.info(f"Video queue initialized: {len(strength_queue)} Strength workouts, {len(other_queue)} other workouts (Total: {len(self.state['queue'])})")
        self.save_state()

    def get_downloads_last_hour(self) -> int:
        now = datetime.now(timezone.utc)
        one_hour_ago = (now - timedelta(hours=1)).isoformat()
        recent = [ts for ts in self.state.get("download_history", []) if ts > one_hour_ago]
        return len(recent)

    def can_download(self) -> tuple[bool, float]:
        now = datetime.now(timezone.utc)
        one_hour_ago = (now - timedelta(hours=1)).isoformat()
        recent = sorted([ts for ts in self.state.get("download_history", []) if ts > one_hour_ago])

        # 1. Hourly Cap
        if len(recent) >= MAX_VIDEOS_PER_HOUR:
            oldest_dt = datetime.fromisoformat(recent[0])
            wake_time = oldest_dt + timedelta(hours=1, seconds=random.uniform(5, 15))
            wait_seconds = max(1.0, (wake_time - now).total_seconds())
            return False, wait_seconds

        # 2. Spacing Interval from last video
        last_time_str = self.state.get("last_download_time")
        if last_time_str:
            last_dt = datetime.fromisoformat(last_time_str)
            elapsed = (now - last_dt).total_seconds()
            if elapsed < MIN_SPACING_SECONDS:
                return False, MIN_SPACING_SECONDS - elapsed

        return True, 0.0

    def get_vimeo_stream_url(self, workout_id: int) -> str | None:
        """Finds or fetches the Vimeo .m3u8 stream URL for this workout"""
        # 1. Check local JSON
        json_path = WORKOUTS_DIR / f"{workout_id}.json"
        if json_path.exists():
            try:
                with open(json_path) as f:
                    w = json.load(f)
                    url = w.get("workoutVideoStreamUrl")
                    if not url:
                        for c in w.get("workoutCircuits", []):
                            url = c.get("circuitVideoStreamUrl")
                            if url: break
                    if url:
                        return url
            except Exception as e:
                logger.warning(f"Error reading local {json_path}: {e}")

        # 2. Fetch live with JWT token
        if not self.token:
            if not self.authenticate():
                return None

        url = f"https://menovation.com/wp-json/mvn-app/v1/workouts/{workout_id}"
        req = urllib.request.Request(url, headers={**HEADERS, "Authorization": f"Bearer {self.token}"})

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                w = json.loads(resp.read().decode())
                # Save locally for future reference
                json_path.write_text(json.dumps(w, indent=2))
                stream_url = w.get("workoutVideoStreamUrl")
                if not stream_url:
                    for c in w.get("workoutCircuits", []):
                        stream_url = c.get("circuitVideoStreamUrl")
                        if stream_url: break
                return stream_url
        except Exception as e:
            logger.error(f"Failed to fetch workout {workout_id} details from API: {e}")
            return None

    def download_video(self, item: dict) -> bool:
        wid = item["workout_id"]
        title = item["title"]
        category = item.get("category", "Workout")
        safe_title = sanitize_filename(title)
        out_filename = f"{wid}_{safe_title}.mp4"
        dest_path = VIDEOS_DIR / out_filename
        tmp_path = VIDEOS_DIR / f"{wid}_{safe_title}.tmp.mp4"

        logger.info(f"Preparing [{category.upper()}]: #{wid} - {title}...")

        stream_url = self.get_vimeo_stream_url(wid)
        if not stream_url:
            logger.error(f"No Vimeo stream URL found for workout #{wid}. Skipping.")
            self.state["failed_videos"][str(wid)] = {"title": title, "error": "No stream URL"}
            self.state["queue"] = [q for q in self.state["queue"] if q["id"] != str(wid)]
            self.save_state()
            return False

        logger.info(f"Downloading 1080p MP4 from Vimeo stream for: {title}...")

        # FFmpeg command: select 1080p (Program 0), copy streams without re-encoding
        cmd = [
            "/usr/bin/ffmpeg",
            "-y",
            "-hide_banner",
            "-loglevel", "warning",
            "-i", stream_url,
            "-map", "0:p:0",
            "-c", "copy",
            "-bsf:a", "aac_adtstoasc",
            str(tmp_path)
        ]

        t0 = time.time()
        try:
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=900)
            if res.returncode != 0:
                logger.error(f"FFmpeg failed (code {res.returncode}): {res.stderr[:300]}")
                if tmp_path.exists():
                    tmp_path.unlink()
                self.state["failed_videos"][str(wid)] = {"title": title, "error": res.stderr}
                self.state["queue"] = [q for q in self.state["queue"] if q["id"] != str(wid)]
                self.save_state()
                return False

            if not tmp_path.exists() or tmp_path.stat().st_size < 100_000:
                logger.error("Output file missing or empty after download.")
                if tmp_path.exists():
                    tmp_path.unlink()
                return False

            # Rename to final filename
            tmp_path.rename(dest_path)
            size_bytes = dest_path.stat().st_size
            elapsed = time.time() - t0
            now_str = datetime.now(timezone.utc).isoformat()

            logger.info(f"SUCCESS: #{wid} {title} -> {out_filename} ({size_bytes / (1024*1024):.1f} MB in {elapsed:.1f}s)")

            # Record completion
            self.state["completed_videos"][str(wid)] = {
                "title": title,
                "category": category,
                "file_path": str(dest_path.relative_to(BASE_DIR)),
                "size_bytes": size_bytes,
                "downloaded_at": now_str,
                "vimeo_stream_url": stream_url
            }
            self.state["download_history"].append(now_str)
            self.state["last_download_time"] = now_str
            self.state["queue"] = [q for q in self.state["queue"] if q["id"] != str(wid)]
            self.save_state()

            logger.info(f"Rolling Hourly Rate: {self.get_downloads_last_hour()}/{MAX_VIDEOS_PER_HOUR} videos")
            return True

        except subprocess.TimeoutExpired:
            logger.error(f"Download timed out for #{wid} {title}")
            if tmp_path.exists():
                tmp_path.unlink()
            return False
        except Exception as e:
            logger.error(f"Unexpected error downloading #{wid}: {e}")
            if tmp_path.exists():
                tmp_path.unlink()
            return False

    def print_status(self):
        completed = len(self.state.get("completed_videos", {}))
        pending = len(self.state.get("queue", []))
        failed = len(self.state.get("failed_videos", {}))
        strength_pending = sum(1 for q in self.state.get("queue", []) if q.get("category") == "Strength")
        hourly = self.get_downloads_last_hour()

        # Calculate total video size on disk
        total_size = sum(
            f.stat().st_size for f in VIDEOS_DIR.glob("*.mp4") if f.exists()
        )

        print("\n" + "=" * 65)
        print(" Menovation Vimeo 1080p Movie Downloader Status")
        print("=" * 65)
        print(f"Total Movies Completed:   {completed} ({total_size / (1024*1024*1024):.2f} GB on disk)")
        print(f"Total Pending Queue:      {pending} (Strength: {strength_pending} | Other: {pending - strength_pending})")
        print(f"Failed / Inaccessible:    {failed}")
        print(f"Trailing Hour Downloads:  {hourly} / {MAX_VIDEOS_PER_HOUR} (Max 10/hr)")
        print(f"Last Movie Downloaded:    {self.state.get('last_download_time') or 'None'}")
        if self.state.get("queue"):
            next_w = self.state["queue"][0]
            print(f"Next in Queue:            [{next_w.get('category')}] #{next_w['workout_id']} - {next_w['title']}")
        print("=" * 65 + "\n")

    def run_loop(self):
        logger.info("Starting Vimeo Movie Downloader Daemon...")
        logger.info(f"Target: Max {MAX_VIDEOS_PER_HOUR} videos/hr (1080p Full HD) | Priority: Strength Training")

        while self.state.get("queue"):
            can_dl, wait_sec = self.can_download()

            if can_dl:
                next_item = self.state["queue"][0]
                self.download_video(next_item)

                if not self.state.get("queue"):
                    logger.info("All workout movies downloaded!")
                    break

                # Paced post-download pause (5 - 8 minutes)
                sleep_sec = random.uniform(MIN_SPACING_SECONDS, MAX_SPACING_SECONDS)
                logger.info(f"Pacing: Sleeping {sleep_sec / 60:.1f} minutes before next movie...")
                time.sleep(sleep_sec)
            else:
                logger.info(f"Rate window active. Sleeping {wait_sec / 60:.1f} minutes ({wait_sec:.0f}s)...")
                time.sleep(max(10.0, wait_sec))

        logger.info("Vimeo Movie Downloader completed all queue items.")


def main():
    parser = argparse.ArgumentParser(description="Menovation Vimeo 1080p Movie Downloader")
    parser.add_argument("--status", action="store_true", help="Show current movie queue and status")
    parser.add_argument("--daemon", action="store_true", help="Run continuously in background")
    parser.add_argument("--once", action="store_true", help="Download 1 movie immediately and exit")

    args = parser.parse_args()
    downloader = VimeoMovieDownloader()

    if args.status:
        downloader.print_status()
        return

    if args.once:
        can_dl, wait_sec = downloader.can_download()
        if can_dl and downloader.state.get("queue"):
            downloader.download_video(downloader.state["queue"][0])
        else:
            print(f"Cannot download now: Rate limit active. Must wait {wait_sec:.0f} seconds.")
        return

    downloader.print_status()
    downloader.run_loop()


if __name__ == "__main__":
    main()
