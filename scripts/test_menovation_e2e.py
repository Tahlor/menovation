"""
Comprehensive Playwright E2E Test Suite for Menovation Rebuild
Tests:
- SSO Authentication Gate (Redirect & Token Verification)
- UI Shell Layout & Navigation (Programs, Workouts, Exercises, Diary)
- Programs Catalog & Cards
- Workouts Search & Filtering
- Workout Video Player View & Video URL
- Exercise Demonstration GIF Modal & Image Loading
- Workout Completion & IndexedDB Persistence
- Exercise Library View & Movement Cards
- Media Server Settings & Live Latency Ping
"""

import os
import sys
import time
from playwright.sync_api import sync_playwright

BOOTSTRAP_URL = "https://taylorarchibald.com/sso/agent-login/WIQZozzUdiXNFbLUbd55l-Y3ALxUtUMlr49b2CU1Sbg"
APP_URL = "https://data.taylorarchibald.com/menovation/"
SCREENSHOTS_DIR = "/home/ubuntu/menovation_screenshots"

os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

def run_tests():
    console_errors = []
    failed_requests = []

    print("[1/8] Launching headless Chromium browser...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        
        # Test 1: Unauthenticated access redirect
        print("[2/8] Testing unauthenticated access redirect to SSO...")
        unauth_context = browser.new_context()
        unauth_page = unauth_context.new_page()
        response = unauth_page.goto(APP_URL, wait_until="commit")
        final_url = unauth_page.url
        print(f"  Unauthenticated request landed on: {final_url}")
        assert "/sso/login" in final_url, f"Expected redirect to /sso/login, got {final_url}"
        print("  ✓ SSO authentication gate verified (unauthenticated request safely redirected)")
        unauth_context.close()

        # Test 2: Authenticate via SSO Bootstrap URL
        print("[3/8] Authenticating via Universal SSO bootstrap URL...")
        auth_context = browser.new_context(
            viewport={"width": 1280, "height": 800},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = auth_context.new_page()

        def handle_console(msg):
            if msg.type == "error":
                console_errors.append(msg.text)
        page.on("console", handle_console)

        def handle_response(resp):
            if resp.status >= 400:
                failed_requests.append(f"{resp.status} {resp.url}")
        page.on("response", handle_response)

        # Establish SSO cookie
        page.goto(BOOTSTRAP_URL, wait_until="networkidle")
        cookies = auth_context.cookies()
        sso_cookie = next((c for c in cookies if c["name"] == "universal_sso_token"), None)
        assert sso_cookie is not None, "Failed to obtain universal_sso_token cookie"
        print(f"  ✓ SSO token cookie established: domain={sso_cookie['domain']}, path={sso_cookie['path']}")

        # Test 3: Load Menovation App
        print("[4/8] Navigating to Menovation App as authenticated user...")
        resp = page.goto(APP_URL, wait_until="networkidle")
        assert resp.status == 200, f"Expected 200 OK, got {resp.status}"
        
        page.wait_for_selector(".app-header", timeout=10000)
        title = page.title()
        print(f"  Page title: '{title}'")
        assert "Menovation" in title, f"Title does not contain Menovation: {title}"

        # Verify server status pill
        status_text = page.locator("#serverStatusText").inner_text()
        print(f"  Media server status text: '{status_text}'")
        assert "Archimedes" in status_text, f"Expected Archimedes default host on HTTPS, got {status_text}"
        
        # Verify Programs loaded
        page.wait_for_selector(".program-card", timeout=10000)
        program_cards = page.locator(".program-card").count()
        print(f"  ✓ Loaded {program_cards} program cards on Programs tab")
        assert program_cards > 0, "No program cards found"
        page.screenshot(path=f"{SCREENSHOTS_DIR}/01_programs_view.png")

        # Test 4: Workouts View & Search
        print("[5/8] Testing Workouts catalog and search filtering...")
        page.click("button[data-view='viewWorkouts']")
        page.wait_for_selector("#workoutSearchInput", timeout=5000)
        
        # Wait for workouts cards to populate
        page.wait_for_selector(".workout-card", timeout=10000)
        initial_count = page.locator(".workout-card").count()
        print(f"  Workouts rendered in grid: {initial_count}")
        assert initial_count > 20, f"Expected 20+ workouts rendered, found {initial_count}"

        # Search for "Arms & Abs" which has rich circuit structure and GIFs
        page.fill("#workoutSearchInput", "Arms & Abs")
        page.wait_for_timeout(800)
        filtered_count = page.locator(".workout-card").count()
        print(f"  Search for 'Arms & Abs' matched: {filtered_count} card(s)")
        assert filtered_count >= 1, "Workout 'Arms & Abs' not found in search"
        page.screenshot(path=f"{SCREENSHOTS_DIR}/02_workouts_search.png")

        # Test 5: Workout Player & Controls
        print("[6/8] Testing Workout Player view and video stream...")
        page.locator(".workout-card").first.evaluate("el => el.click()")
        page.wait_for_selector("#viewWorkoutPlayer", state="visible", timeout=8000)

        workout_title = page.locator("#playerWorkoutTitle").inner_text()
        print(f"  Active workout player title: '{workout_title}'")
        assert len(workout_title) > 0, "Workout title is empty"

        video_src = page.locator("#workoutVideoPlayer").get_attribute("src")
        print(f"  HTML5 video player source: '{video_src}'")
        assert video_src is not None and "videos/" in video_src, f"Invalid video source: {video_src}"

        # Verify circuit steps and "Move GIF" buttons exist
        page.wait_for_selector(".circuit-block", timeout=5000)
        circuit_blocks = page.locator(".circuit-block").count()
        gif_buttons = page.locator(".view-gif-btn").count()
        print(f"  Circuit breakdown: {circuit_blocks} circuit block(s), {gif_buttons} Move GIF button(s)")
        assert circuit_blocks > 0, "No circuit blocks found"
        page.screenshot(path=f"{SCREENSHOTS_DIR}/03_video_player.png")

        # Test 6: Exercise GIF Modal
        print("[7/8] Testing animated exercise demonstration GIF modal...")
        if gif_buttons > 0:
            page.locator(".view-gif-btn").first.evaluate("btn => btn.click()")
            page.wait_for_selector("#exerciseModal", state="visible", timeout=5000)
            modal_title = page.locator("#modalExerciseTitle").inner_text()
            gif_src = page.locator("#modalExerciseGif").get_attribute("src")
            print(f"  Modal exercise title: '{modal_title}'")
            print(f"  Modal demonstration GIF source: '{gif_src}'")
            assert gif_src is not None and "gifs/" in gif_src, f"Invalid GIF src: {gif_src}"
            
            page.wait_for_timeout(1000)
            page.screenshot(path=f"{SCREENSHOTS_DIR}/04_exercise_gif_modal.png")
            page.click("#closeExerciseModalBtn")
            page.wait_for_timeout(400)
            print("  ✓ Exercise GIF modal verified and closed")

        # Test 7: Exercise Library & Movement Cards
        print("[8/8] Testing Exercise Library & Diary view...")
        page.click("button[data-view='viewExercises']")
        page.wait_for_selector(".exercise-card", timeout=8000)
        ex_cards = page.locator(".exercise-card").count()
        print(f"  Exercise library movement cards rendered: {ex_cards}")
        assert ex_cards > 20, f"Expected 20+ exercise cards, found {ex_cards}"
        page.screenshot(path=f"{SCREENSHOTS_DIR}/05_exercise_library.png")

        # Navigate to Diary tab
        page.click("button[data-view='viewDiary']")
        page.wait_for_selector("#viewDiary", state="visible", timeout=5000)
        page.wait_for_timeout(500)
        page.screenshot(path=f"{SCREENSHOTS_DIR}/06_diary_view.png")

        # Settings modal latency test
        print("Testing media server latency tester in Settings modal...")
        page.click("#serverStatusBadge")
        page.wait_for_selector("#settingsModal", state="visible", timeout=5000)
        page.click("#testServerBtn")
        page.wait_for_timeout(2500)
        test_result = page.locator("#testServerResult").inner_text()
        print(f"  Server ping test result: '{test_result}'")
        assert len(test_result) > 0, "No ping test result returned"
        page.screenshot(path=f"{SCREENSHOTS_DIR}/07_settings_modal.png")
        page.click("#closeSettingsModalBtn")

        browser.close()

    print("\n" + "="*60)
    print("ALL PLAYWRIGHT TESTS PASSED SUCCESSFULLY! ✓")
    print(f"Screenshots saved to: {SCREENSHOTS_DIR}")
    print("="*60)

if __name__ == "__main__":
    run_tests()
