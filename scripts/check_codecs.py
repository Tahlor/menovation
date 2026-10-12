from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    page = b.new_page()
    mp4 = page.evaluate("() => document.createElement('video').canPlayType('video/mp4; codecs=\"avc1.42E01E, mp4a.40.2\"')")
    webm = page.evaluate("() => document.createElement('video').canPlayType('video/webm; codecs=\"vp8, vorbis\"')")
    print(f"canPlayType MP4: '{mp4}'")
    print(f"canPlayType WebM: '{webm}'")
    b.close()
