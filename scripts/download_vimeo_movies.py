#!/usr/bin/env python3
"""
Menovation Vimeo Movie Downloader (720p Optimized)
Downloads full-length 720p MP4 workout movies from authenticated Vimeo HLS streams.
Target Directory: J:/Media/Videos/TV/Menovation/
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
import urllib.error
from pathlib import Path
from datetime import datetime, timezone, timedelta

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
ASSETS_DIR = BASE_DIR / "assets"
WORKOUTS_DIR = ASSETS_DIR / "workouts"

# Primary Video Storage Directory (J:/Media/Videos/TV/Menovation/)
J_DRIVE_VIDEOS = Path("/mnt/j/Media/Videos/TV/Menovation")
LOCAL_VIDEOS = BASE_DIR / "assets" / "videos"
VIDEOS_DIR = J_DRIVE_VIDEOS if J_DRIVE_VIDEOS.parent.exists() else LOCAL_VIDEOS

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


def get_720p_program_arg(master_url: str) -> list[str]:
    """
    Parses Vimeo HLS master playlist to find program index for 720p (1280x720).
    Returns ffmpeg mapping args (e.g. ['-map', '0:p:4']).
    Falls back to closest resolution if 720p is absent.
    """
    try:
        req = urllib.request.Request(master_url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=15) as resp:
            content = resp.read().decode('utf-8', errors='ignore')

        program_idx = 0
        found_idx = None
        for line in content.split('\n'):
            if line.startswith('#EXT-X-STREAM-INF:'):
                if 'x720' in line or 'RESOLUTION=1280x720' in line:
                    found_idx = program_idx
                    break
                program_idx += 1

        if found_idx is not None:
            return ["-map", f"0:p:{found_idx}?"]
    except Exception as e:
        logger.warning(f"Could not parse 720p stream index ({e}), falling back to default mapping")

    return ["-map", "0:p:0?"]


class VimeoMovieDownloader:
    def __init__(self, username=DEFAULT_USERNAME, password=DEFAULT_PASSWORD, target_resolution="720p"):
        self.username = username
        self.password = password
        self.target_resolution = target_resolution
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
            "download_history": [],
            "last_download_time": None,
            "completed_videos": {},
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
        if self.state.get("queue_initialized", False):
            return

        logger.info("Building prioritized video queue (Strength Training first)...")
        all_workouts = {}

        try:
            req = urllib.request.Request("https://menovation.com/wp-json/mvn-app/v1/workouts", headers=HEADERS)
            with urllib.request.urlopen(req, timeout=30) as resp:
                all_workouts = json.loads(resp.read().decode())
        except Exception as e:
            logger.warning(f"Could not load workouts from API ({e}), scanning local workouts dir...")

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
        failed_ids = set(self.state.get("failed_videos", {}).keys())

        for w_id, w_info in all_workouts.items():
            post_id = int(w_info.get("workoutPostId", w_id))
            if str(post_id) in completed_ids or str(post_id) in failed_ids:
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

        self.state["queue"] = strength_queue + other_queue
        self.state["queue_initialized"] = True
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

        if not self.token:
            if not self.authenticate():
                return None

        url = f"https://menovation.com/wp-json/mvn-app/v1/workouts/{workout_id}"
        req = urllib.request.Request(url, headers={**HEADERS, "Authorization": f"Bearer {self.token}"})

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                w = json.loads(resp.read().decode())
                json_path.write_text(json.dumps(w, indent=2))
                stream_url = w.get("workoutVideoStreamUrl")
                if not stream_url:
                    for c in w.get("workoutCircuits", []):
                        stream_url = c.get("circuitVideoStreamUrl")
                        if stream_url: break
                return stream_url
        except urllib.error.HTTPError as e:
            if e.code in (401, 403):
                logger.warning(f"Auth error ({e}). Re-authenticating token...")
                self.token = None
                if self.authenticate():
                    try:
                        req2 = urllib.request.Request(url, headers={**HEADERS, "Authorization": f"Bearer {self.token}"})
                        with urllib.request.urlopen(req2, timeout=30) as resp2:
                            w = json.loads(resp2.read().decode())
                            json_path.write_text(json.dumps(w, indent=2))
                            stream_url = w.get("workoutVideoStreamUrl")
                            if not stream_url:
                                for c in w.get("workoutCircuits", []):
                                    stream_url = c.get("circuitVideoStreamUrl")
                                    if stream_url: break
                            return stream_url
                    except Exception as retry_err:
                        logger.error(f"Re-auth retry failed for workout {workout_id}: {retry_err}")
            logger.error(f"Failed to fetch workout {workout_id} details from API: {e}")
            return None
        except Exception as e:
            logger.error(f"Failed to fetch workout {workout_id} details from API: {e}")
            return None

    def _handle_download_failure(self, item: dict, error_msg: str):
        wid = item["workout_id"]
        title = item["title"]
        retries = item.get("retry_count", 0) + 1
        item["retry_count"] = retries

        if retries >= 3:
            logger.error(f"Workout #{wid} ({title}) failed {retries} times. Moving to failed_videos.")
            self.state["failed_videos"][str(wid)] = {
                "title": title,
                "error": error_msg,
                "retries": retries,
                "failed_at": datetime.now(timezone.utc).isoformat()
            }
            self.state["queue"] = [q for q in self.state["queue"] if q["id"] != str(wid)]
        else:
            logger.warning(f"Workout #{wid} attempt {retries}/3 failed ({error_msg}). Will retry after backoff.")

        self.save_state()

    def download_video(self, item: dict) -> bool:
        wid = item["workout_id"]
        title = item["title"]
        category = item.get("category", "Workout")
        retries = item.get("retry_count", 0)
        safe_title = sanitize_filename(title)
        out_filename = f"{wid}_{safe_title}.mp4"
        dest_path = VIDEOS_DIR / out_filename
        tmp_path = VIDEOS_DIR / f"{wid}_{safe_title}.tmp.mp4"

        attempt_str = f" [Attempt {retries + 1}/3]" if retries > 0 else ""
        logger.info(f"Preparing [{category.upper()}]: #{wid} - {title} ({self.target_resolution}){attempt_str}...")

        stream_url = self.get_vimeo_stream_url(wid)
        if not stream_url:
            err_msg = f"No Vimeo stream URL found for workout #{wid}"
            logger.error(err_msg)
            self._handle_download_failure(item, err_msg)
            return False

        logger.info(f"Downloading {self.target_resolution} MP4 from Vimeo for: {title}...")

        # Determine stream mapping
        if self.target_resolution == "720p":
            map_args = get_720p_program_arg(stream_url)
        else:
            map_args = ["-map", "0:p:0"]

        cmd = [
            "/usr/bin/ffmpeg",
            "-y",
            "-hide_banner",
            "-loglevel", "warning",
            "-sn",
            "-i", stream_url,
            *map_args,
            "-c", "copy",
            "-bsf:a", "aac_adtstoasc",
            str(tmp_path)
        ]

        t0 = time.time()
        try:
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=900)
            if res.returncode != 0:
                err_msg = f"FFmpeg failed (code {res.returncode}): {res.stderr[:200]}"
                logger.error(err_msg)
                if tmp_path.exists():
                    tmp_path.unlink()
                self._handle_download_failure(item, err_msg)
                return False

            if not tmp_path.exists() or tmp_path.stat().st_size < 100_000:
                err_msg = "Output file missing or smaller than 100KB after download"
                logger.error(err_msg)
                if tmp_path.exists():
                    tmp_path.unlink()
                self._handle_download_failure(item, err_msg)
                return False

            tmp_path.rename(dest_path)
            size_bytes = dest_path.stat().st_size
            elapsed = time.time() - t0
            now_str = datetime.now(timezone.utc).isoformat()

            logger.info(f"SUCCESS: #{wid} {title} -> {out_filename} ({size_bytes / (1024*1024):.1f} MB in {elapsed:.1f}s at {self.target_resolution})")

            # Store clean user-facing path
            if dest_path.is_relative_to(BASE_DIR):
                saved_path = str(dest_path.relative_to(BASE_DIR))
            else:
                saved_path = f"J:/Media/Videos/TV/Menovation/{out_filename}"

            self.state["completed_videos"][str(wid)] = {
                "title": title,
                "category": category,
                "file_path": saved_path,
                "size_bytes": size_bytes,
                "quality": self.target_resolution,
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
            err_msg = f"Download timed out after 900s for #{wid} {title}"
            logger.error(err_msg)
            if tmp_path.exists():
                tmp_path.unlink()
            self._handle_download_failure(item, err_msg)
            return False
        except Exception as e:
            err_msg = f"Unexpected error downloading #{wid}: {e}"
            logger.error(err_msg)
            if tmp_path.exists():
                tmp_path.unlink()
            self._handle_download_failure(item, err_msg)
            return False

    def print_status(self):
        completed = len(self.state.get("completed_videos", {}))
        pending = len(self.state.get("queue", []))
        failed = len(self.state.get("failed_videos", {}))
        strength_pending = sum(1 for q in self.state.get("queue", []) if q.get("category") == "Strength")
        hourly = self.get_downloads_last_hour()

        total_size = sum(
            f.stat().st_size for f in VIDEOS_DIR.glob("*.mp4") if f.exists()
        )

        print("\n" + "=" * 65)
        print(f" Menovation Vimeo {self.target_resolution.upper()} Movie Downloader Status")
        print("=" * 65)
        print(f"Target Directory:         {VIDEOS_DIR}")
        print(f"Resolution Quality:       {self.target_resolution.upper()}")
        print(f"Total Movies Completed:   {completed} ({total_size / (1024*1024*1024):.2f} GB on disk)")
        print(f"Total Pending Queue:      {pending} (Strength: {strength_pending} | Other: {pending - strength_pending})")
        print(f"Failed / Inaccessible:    {failed}")
        print(f"Trailing Hour Downloads:  {hourly} / {MAX_VIDEOS_PER_HOUR} (Max 10/hr)")
        print(f"Last Movie Downloaded:    {self.state.get('last_download_time') or 'None'}")
        if self.state.get("queue"):
            next_w = self.state["queue"][0]
            retries = next_w.get("retry_count", 0)
            retry_note = f" (Attempt {retries + 1}/3)" if retries > 0 else ""
            print(f"Next in Queue:            [{next_w.get('category')}] #{next_w['workout_id']} - {next_w['title']}{retry_note}")
        print("=" * 65 + "\n")

    def run_loop(self):
        logger.info(f"Starting Vimeo Movie Downloader Daemon ({self.target_resolution})...")
        logger.info(f"Target: Max {MAX_VIDEOS_PER_HOUR} videos/hr | Priority: Strength Training | Target Dir: {VIDEOS_DIR}")

        consecutive_errors = 0
        BASE_BACKOFF = 60       # 1 minute base backoff
        MAX_BACKOFF = 1800     # 30 minutes max backoff
        BACKOFF_FACTOR = 2

        while self.state.get("queue"):
            can_dl, wait_sec = self.can_download()

            if can_dl:
                next_item = self.state["queue"][0]
                success = self.download_video(next_item)

                if success:
                    consecutive_errors = 0
                    if not self.state.get("queue"):
                        logger.info("All workout movies downloaded!")
                        break

                    sleep_sec = random.uniform(MIN_SPACING_SECONDS, MAX_SPACING_SECONDS)
                    logger.info(f"Pacing: Sleeping {sleep_sec / 60:.1f} minutes before next movie...")
                    time.sleep(sleep_sec)
                else:
                    consecutive_errors += 1
                    raw_backoff = min(MAX_BACKOFF, BASE_BACKOFF * (BACKOFF_FACTOR ** (consecutive_errors - 1)))
                    # Jitter between 80% and 120% of calculated backoff
                    jittered_backoff = raw_backoff * random.uniform(0.8, 1.2)
                    logger.warning(
                        f"Download failed (consecutive failure #{consecutive_errors}). "
                        f"Exponential backoff: sleeping {jittered_backoff / 60:.1f} min ({jittered_backoff:.0f}s)..."
                    )
                    time.sleep(jittered_backoff)
            else:
                logger.info(f"Rate window active. Sleeping {wait_sec / 60:.1f} minutes ({wait_sec:.0f}s)...")
                time.sleep(max(10.0, wait_sec))

        logger.info("Vimeo Movie Downloader completed all queue items.")


def main():
    parser = argparse.ArgumentParser(description="Menovation Vimeo Movie Downloader")
    parser.add_argument("--status", action="store_true", help="Show current movie queue and status")
    parser.add_argument("--daemon", action="store_true", help="Run continuously in background")
    parser.add_argument("--once", action="store_true", help="Download 1 movie immediately and exit")
    parser.add_argument("--resolution", default="720p", choices=["720p", "1080p"], help="Target video resolution (default: 720p)")

    args = parser.parse_args()
    downloader = VimeoMovieDownloader(target_resolution=args.resolution)

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
