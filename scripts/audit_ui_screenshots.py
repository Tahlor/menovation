"""
Playwright Audit: Capture verified screenshots of all main pages to verify aesthetic and layout improvements.
"""
import os
import sys
import time
from playwright.sync_api import sync_playwright

BOOTSTRAP_URL = "https://taylorarchibald.com/sso/agent-login/WIQZozzUdiXNFbLUbd55l-Y3ALxUtUMlr49b2CU1Sbg"
BASE_URL = "https://data.taylorarchibald.com/menovation/"

DESKTOP_PAGES = [
    ("program_841", f"{BASE_URL}#/program/841"),
    ("program_782", f"{BASE_URL}#/program/782"),
    ("home_programs", f"{BASE_URL}#/programs"),
    ("workout_789", f"{BASE_URL}#/workout/789"),
    ("workouts_catalog", f"{BASE_URL}#/workouts"),
    ("exercise_library", f"{BASE_URL}#/exercises"),
    ("wellness_diary", f"{BASE_URL}#/diary"),
]

MOBILE_PAGES = [
    ("program_841", f"{BASE_URL}#/program/841"),
    ("workout_789", f"{BASE_URL}#/workout/789"),
    ("home_programs", f"{BASE_URL}#/programs"),
    ("workouts_catalog", f"{BASE_URL}#/workouts"),
    ("wellness_diary", f"{BASE_URL}#/diary"),
]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    
    # 1. Authenticate with desktop viewport
    context = browser.new_context(viewport={"width": 1280, "height": 900})
    page = context.new_page()

    print("Authenticating SSO...")
    for attempt in range(3):
        try:
            page.goto(BOOTSTRAP_URL, timeout=15000)
            break
        except Exception as e:
            print(f"SSO retry {attempt}: {e}")
            time.sleep(1)
    
    # Pre-settle on app
    page.goto(BASE_URL, wait_until="networkidle")
    page.wait_for_timeout(1500)

    # 2. Desktop Audit
    for name, url in DESKTOP_PAGES:
        print(f"Auditing desktop: {name} -> {url}")
        page.goto(url, wait_until="networkidle")
        page.wait_for_timeout(1500)
        out_path = f"/tmp/verified_desktop_{name}.png"
        page.screenshot(path=out_path, full_page=True)
        print(f"  -> Saved {out_path}")

    # 3. Mobile Audit on same authenticated session
    print("Switching to Mobile Viewport (390x844)...")
    page.set_viewport_size({"width": 390, "height": 844})
    page.wait_for_timeout(500)

    for name, url in MOBILE_PAGES:
        print(f"Auditing mobile: {name} -> {url}")
        page.goto(url, wait_until="networkidle")
        page.wait_for_timeout(1500)
        out_path = f"/tmp/verified_mobile_{name}.png"
        page.screenshot(path=out_path, full_page=True)
        print(f"  -> Saved {out_path}")

    browser.close()
    print("All verified audit screenshots captured successfully!")
