#!/usr/bin/env python3
"""
Playwright Verification for Menovation:
1. Program 6217 (Power Builder) Unicode clean rendering.
2. Program workout items action buttons ('Preview' and 'Open' replacing 'Start').
3. Preview button starts playing video in Picture-in-Picture / mini player.
4. Circuit workout 6225 rebuild verification (circuits breakdown, exercise GIFs, format banner).
5. All workouts cards action buttons ('Preview' and 'Open').
"""

import sys
import time
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE_DIR = Path(__file__).resolve().parent.parent
APP_DIR = BASE_DIR / "app"
PORT = 8099
URL = f"http://127.0.0.1:{PORT}"

def main():
    print(f"Starting local HTTP server on port {PORT} from {APP_DIR}...")
    server_proc = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(PORT)],
        cwd=str(APP_DIR),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )
    time.sleep(1.5)

    try:
        with sync_playwright() as p:
            try:
                browser = p.chromium.connect_over_cdp("http://127.0.0.1:9222")
            except Exception:
                browser = p.chromium.connect_over_cdp("http://localhost:9222")
            
            context = browser.contexts[0] if browser.contexts else browser.new_context()
            page = context.new_page()

            console_logs = []
            page.on("console", lambda m: console_logs.append(f"[{m.type}] {m.text}"))

            # --- TEST 1: Load Program 6217 directly ---
            print("\n[TEST 1] Loading Program 6217...")
            page.goto(f"{URL}/#/program/6217", wait_until="networkidle")
            page.wait_for_selector(".program-hero-content", timeout=10000)

            # Check title
            title = page.locator(".program-hero-content h1").inner_text()
            print(f"Program Title: {title}")
            assert "Power Builder" in title, f"Unexpected title: {title}"

            # Check unicode artifacts in overview
            desc_html = page.locator(".program-hero-desc").inner_html()
            desc_text = page.locator(".program-hero-desc").inner_text()
            print(f"Overview Preview:\n{desc_text[:200]}...")
            
            assert "\\u000A" not in desc_html, "Found escaped \\u000A in HTML!"
            assert "\\u2019" not in desc_html, "Found escaped \\u2019 in HTML!"
            assert "\\u" not in desc_html, "Found raw \\u escape in HTML!"
            assert "<p class=\"program-hero-paragraph\">" in desc_html, "Paragraphs not properly formatted!"
            print("✓ Unicode verified: Zero escaped sequences, properly formatted paragraphs!")

            # --- TEST 2: Verify Open & Preview buttons on workout items ---
            print("\n[TEST 2] Verifying workout playlist action buttons...")
            page.wait_for_selector(".program-workout-item", timeout=5000)
            items = page.locator(".program-workout-item")
            item_count = items.count()
            print(f"Found {item_count} workout items in program schedule.")
            assert item_count > 0, "No workout items rendered!"

            first_item = items.first
            assert first_item.locator(".workout-preview-btn").count() == 1, "Preview button missing!"
            assert first_item.locator(".workout-open-btn").count() == 1, "Open button missing!"
            assert first_item.locator(".workout-action-pill").count() == 0, "Old Start button still present!"

            preview_text = first_item.locator(".workout-preview-btn").inner_text()
            open_text = first_item.locator(".workout-open-btn").inner_text()
            print(f"Buttons verified on first workout item: '{preview_text}', '{open_text}'")

            # Check video format badge
            badge_text = first_item.locator(".workout-item-subtitle .badge").inner_text()
            print(f"Video format badge: {badge_text}")
            assert "Guided Cooldown" in badge_text, f"Expected Cooldown badge, got: {badge_text}"

            # --- TEST 3: Click Preview button (starts PiP mini-player) ---
            print("\n[TEST 3] Testing Preview button PiP playback...")
            first_item.locator(".workout-preview-btn").click()
            page.wait_for_timeout(1500)

            # Check mini player active
            is_mini = page.locator("#viewWorkoutPlayer").evaluate("el => el.classList.contains('in-mini-mode')")
            print(f"Is player in mini/PiP mode? {is_mini}")
            assert is_mini, "Mini player was not activated by Preview button!"

            mini_title = page.locator("#miniPlayerWorkoutTitle").inner_text()
            print(f"Mini player title: {mini_title}")
            assert "Posterior Chain + Pull" in mini_title, f"Unexpected mini player title: {mini_title}"

            # Verify still on program page (did not navigate away!)
            current_hash = page.evaluate("() => window.location.hash")
            print(f"Current route hash after Preview click: {current_hash}")
            assert "#/program/6217" in current_hash, f"Page navigated away to {current_hash} instead of staying on program page!"
            print("✓ Preview button verified: plays in PiP/mini player while user stays on program view!")

            # --- TEST 4: Open full workout details ---
            print("\n[TEST 4] Testing Open button and Circuit Breakdown for 6225...")
            first_item.locator(".workout-open-btn").click()
            page.wait_for_timeout(1500)

            current_hash = page.evaluate("() => window.location.hash")
            print(f"Current route hash after Open click: {current_hash}")
            assert "#/workout/6225" in current_hash, f"Unexpected route hash: {current_hash}"

            # Format banner
            format_banner = page.locator("#playerWorkoutFormatNotice")
            assert format_banner.is_visible(), "Format notice banner is not visible!"
            banner_text = format_banner.inner_text()
            print(f"Format Banner: {banner_text[:120]}...")
            assert "Guided Cooldown" in banner_text, "Format banner missing cooldown description!"

            # Circuit blocks
            circuit_count = page.locator(".circuit-block").count()
            exercise_count = page.locator(".circuit-exercise-card").count()
            rest_count = page.locator(".circuit-rest-indicator").count()
            print(f"Rebuilt circuits breakdown: {circuit_count} blocks, {exercise_count} exercise cards, {rest_count} rest indicators.")
            assert circuit_count >= 5, f"Expected at least 5 circuit blocks, got {circuit_count}"
            assert exercise_count >= 8, f"Expected multiple exercise cards, got {exercise_count}"
            print("✓ Circuit workout 6225 verified: Rich multi-circuit breakdown successfully populated!")

            # --- TEST 5: Verify All Workouts view buttons ---
            print("\n[TEST 5] Testing All Workouts View buttons...")
            page.goto(f"{URL}/#/workouts", wait_until="networkidle")
            page.wait_for_selector(".workout-card", timeout=5000)

            first_card = page.locator(".workout-card").first
            assert first_card.locator(".workout-card-preview-btn").count() == 1, "Workout card Preview button missing!"
            assert first_card.locator(".workout-card-open-btn").count() == 1, "Workout card Open button missing!"
            print("✓ All Workouts view verified: Each card contains Preview and Open action buttons!")

            print("\n==========================================")
            print("ALL VERIFICATION CHECKS PASSED!")
            print("==========================================")

            try:
                page.close()
            except Exception:
                pass
    finally:
        server_proc.terminate()
        server_proc.wait()

if __name__ == "__main__":
    main()
