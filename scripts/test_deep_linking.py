"""
Playwright Verification of Deep Linking, Browser Back Navigation, and Exercise Fallbacks
"""
import sys
import time
from playwright.sync_api import sync_playwright

BOOTSTRAP_URL = "https://taylorarchibald.com/sso/agent-login/WIQZozzUdiXNFbLUbd55l-Y3ALxUtUMlr49b2CU1Sbg"
BASE_URL = "https://data.taylorarchibald.com/menovation/"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1280, "height": 900})
    page = context.new_page()

    page.on("console", lambda m: print(f"[CONSOLE] {m.text}"))
    page.on("requestfailed", lambda req: print(f"[FAIL] {req.method} {req.url}"))

    # 1. SSO Bootstrap
    print("Logging into SSO...")
    for attempt in range(3):
        try:
            page.goto(BOOTSTRAP_URL, timeout=15000)
            break
        except Exception as e:
            if attempt == 2: raise
            time.sleep(1)
    page.wait_for_timeout(1000)

    # Settle app & ServiceWorker
    page.goto(BASE_URL, wait_until="networkidle")
    page.wait_for_timeout(1500)

    # 2. Test Deep Link directly to Workout 789
    print("\n--- Test 1: Direct Deep Link to Workout 789 ---")
    page.goto(f"{BASE_URL}#/workout/789", wait_until="networkidle")
    page.wait_for_selector("#viewWorkoutPlayer", state="visible", timeout=15000)
    
    title = page.locator(".workout-player-title").inner_text()
    doc_title = page.title()
    url = page.url
    print(f"URL: {url}")
    print(f"Document Title: {doc_title}")
    print(f"Workout Title: {title}")
    assert "789" in url, f"URL should contain 789, got {url}"
    assert "Strong Every Day" in title, f"Title should be Strong Every Day, got {title}"
    assert "Strong Every Day | Menovation" in doc_title, f"Document title should match, got {doc_title}"

    # Verify circuits rendered with in-frame playable GIFs
    circuit_count = page.locator(".circuit-block").count()
    gif_cards = page.locator(".circuit-exercise-card").count()
    print(f"Workout 789 rendered {circuit_count} circuit blocks and {gif_cards} exercise cards with GIFs.")
    assert circuit_count >= 3, f"Expected at least 3 circuits, got {circuit_count}"
    assert gif_cards >= 8, f"Expected at least 8 exercise cards, got {gif_cards}"

    page.screenshot(path="/tmp/09_workout_789_deep_link.png", full_page=True)
    print("Screenshot saved: /tmp/09_workout_789_deep_link.png")

    # 3. Test Deep Link to Yoga Workout 2231 (Energizing Morning Practice)
    print("\n--- Test 2: Direct Deep Link to Yoga Workout 2231 ---")
    page.goto(f"{BASE_URL}#/workout/2231", wait_until="networkidle")
    page.wait_for_selector(".workout-player-title", timeout=10000)
    
    yoga_title = page.locator(".workout-player-title").inner_text()
    doc_title = page.title()
    print(f"Yoga Workout Title: {yoga_title}")
    print(f"Document Title: {doc_title}")
    assert "Energizing Morning Practice" in yoga_title

    # Verify flow cards rendered
    flow_cards = page.locator(".circuit-flow-card").count()
    blocks = page.locator(".circuit-block").count()
    print(f"Yoga workout rendered {blocks} sections and {flow_cards} guided flow cards.")
    assert flow_cards >= 4, f"Expected at least 4 guided flow cards, got {flow_cards}"

    page.screenshot(path="/tmp/10_yoga_flow_cards.png", full_page=True)
    print("Screenshot saved: /tmp/10_yoga_flow_cards.png")

    # 4. Test Deep Link to Program 782
    print("\n--- Test 3: Direct Deep Link to Program 782 ---")
    page.goto(f"{BASE_URL}#/program/782", wait_until="networkidle")
    page.wait_for_selector("#programHeroCard h1", timeout=10000)

    prog_title = page.locator("#programHeroCard h1").inner_text()
    prog_doc_title = page.title()
    print(f"Program Title: {prog_title}")
    print(f"Document Title: {prog_doc_title}")
    assert "StrongHER" in prog_title

    # 5. Test Navigation and Browser Back / Forward
    print("\n--- Test 4: Browser Back & UI Navigation ---")
    # Click on first workout item in the program
    page.locator(".program-workout-item").first.click()
    page.wait_for_timeout(1000)
    print(f"Navigated to workout: {page.url}")
    assert "#/workout/" in page.url

    # Test browser back button
    print("Clicking browser back button...")
    page.go_back()
    page.wait_for_timeout(1000)
    print(f"URL after go_back: {page.url}")
    assert "#/program/782" in page.url
    prog_visible = page.locator("#viewProgramDetail").is_visible()
    print(f"Program detail view visible: {prog_visible}")
    assert prog_visible, "Program detail view should be visible after browser back"

    # Test browser forward button
    print("Clicking browser forward button...")
    page.go_forward()
    page.wait_for_timeout(1000)
    print(f"URL after go_forward: {page.url}")
    assert "#/workout/" in page.url
    player_visible = page.locator("#viewWorkoutPlayer").is_visible()
    print(f"Workout player view visible: {player_visible}")
    assert player_visible, "Workout player view should be visible after browser forward"

    # Test UI Back button
    print("Clicking in-page Back from Workout button...")
    page.locator("#backFromWorkoutBtn").click()
    page.wait_for_timeout(1000)
    print(f"URL after UI back: {page.url}")
    assert "#/program/782" in page.url

    # Test In-page Back to Programs button
    print("Clicking in-page Back to Programs button...")
    page.locator("#backToProgramsBtn").click()
    page.wait_for_timeout(1000)
    print(f"URL after back to programs: {page.url}")
    assert "#/programs" in page.url
    programs_visible = page.locator("#viewPrograms").is_visible()
    print(f"Programs catalog visible: {programs_visible}")
    assert programs_visible, "Programs catalog should be visible"

    page.screenshot(path="/tmp/11_programs_after_back.png", full_page=True)
    print("Screenshot saved: /tmp/11_programs_after_back.png")

    print("\n✓ ALL TESTS PASSED!")
    browser.close()
