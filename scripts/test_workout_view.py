"""
Playwright Verification of Workout View: Video Player, Circuit Structure, and In-Frame GIFs
"""
from playwright.sync_api import sync_playwright

BOOTSTRAP_URL = "https://taylorarchibald.com/sso/agent-login/WIQZozzUdiXNFbLUbd55l-Y3ALxUtUMlr49b2CU1Sbg"
APP_URL = "https://data.taylorarchibald.com/menovation/"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1280, "height": 900})
    page = context.new_page()

    page.on("console", lambda m: print(f"[BROWSER {m.type.upper()}] {m.text}"))
    page.on("requestfailed", lambda req: print(f"[FAIL] {req.method} {req.url} - {req.failure}"))

    # Login via SSO bootstrap
    page.goto(BOOTSTRAP_URL)
    page.goto(APP_URL, wait_until="networkidle")

    # Click first program
    page.wait_for_selector(".program-card")
    page.locator(".program-card").first.click()
    page.wait_for_timeout(1000)

    # Click first workout (Workout 789)
    page.wait_for_selector(".program-workout-item")
    page.locator(".program-workout-item").first.click()
    page.wait_for_timeout(3500)

    # Check theWhy text
    the_why = page.locator("#playerTheWhyText").inner_html()
    print("The Why HTML preview:\n", the_why[:350])

    # Check circuit blocks and in-frame GIF images
    circuit_count = page.locator(".circuit-block").count()
    gif_card_count = page.locator(".circuit-exercise-card").count()
    rest_count = page.locator(".circuit-rest-indicator").count()
    print(f"Circuits breakdown rendered: {circuit_count} blocks, {gif_card_count} exercise cards, {rest_count} rest indicators")

    # Check in-frame GIF images loading status
    first_gif = page.locator(".circuit-exercise-gif").first
    if first_gif.count() > 0:
        gif_state = first_gif.evaluate("""img => ({
            src: img.src,
            complete: img.complete,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight
        })""")
        print("First in-frame GIF state:", gif_state)

    # Check video player status
    vid_state = page.locator("#workoutVideoPlayer").evaluate("""v => ({
        src: v.src,
        currentSrc: v.currentSrc,
        duration: v.duration,
        readyState: v.readyState,
        networkState: v.networkState,
        error: v.error ? v.error.message : null
    })""")
    print("Video state in browser:", vid_state)

    # Take screenshot of Workout 789
    page.screenshot(path="/tmp/workout_789_rebuilt.png", full_page=True)
    print("✓ Full-page screenshot saved to /tmp/workout_789_rebuilt.png")

    browser.close()
