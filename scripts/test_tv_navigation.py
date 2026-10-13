"""
Playwright test for issues #1 (D-pad navigation) and #2 (resume), run against a local static server.
Usage: python scripts/test_tv_navigation.py
"""
import http.server, socketserver, threading, os, sys, functools, json
from playwright.sync_api import sync_playwright

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ROOT = os.path.join(REPO, "app")

class Handler(http.server.SimpleHTTPRequestHandler):
    """Serves app/, mapping /assets/* to the repo-level assets/ (app/assets is a symlink)."""
    def translate_path(self, path):
        path = path.split("?", 1)[0].split("#", 1)[0]
        base = REPO if path.startswith("/assets/") else ROOT
        return os.path.join(base, *[x for x in path.split("/") if x and x != ".."])
    def log_message(self, *a, **k): pass

srv = socketserver.ThreadingTCPServer(("0.0.0.0", 0), Handler)
port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f"http://127.0.0.1:{port}/index.html"

fails = []
def check(name, cond):
    print(("PASS " if cond else "FAIL ") + name)
    if not cond: fails.append(name)

def focused(page):
    return page.evaluate("document.activeElement && (document.activeElement.className + '|' + document.activeElement.id)")

import subprocess, time, platform

# The user's own Edge (Desktop shortcut "Taylor Personal - Edge") is started with --remote-debugging-port=32000.
CDP_URL = "http://127.0.0.1:32000"
EDGE_SHORTCUT = r"C:\Users\Taylor\Desktop\Taylor Personal - Edge.lnk"

def open_browser(p):
    """Attach to the user's Edge over CDP (launching it via their shortcut if it isn't open).
    Falls back to a bundled Playwright Chromium when Edge is unavailable."""
    def attach():
        return p.chromium.connect_over_cdp(CDP_URL, timeout=3000)
    try:
        return attach(), True
    except Exception:
        pass
    if platform.system() == "Windows" or os.path.exists("/mnt/c/Windows"):
        subprocess.Popen(["cmd.exe", "/c", "start", "", EDGE_SHORTCUT], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(30):
            time.sleep(1)
            try:
                return attach(), True
            except Exception:
                pass
    # NOTE: from WSL2, Windows' 127.0.0.1:32000 is not reachable; run this script with Windows Python instead.
    return p.chromium.launch(headless=True), False

with sync_playwright() as p:
    b, is_edge = open_browser(p)
    ctx = b.contexts[0] if is_edge else b.new_context(viewport={"width": 1280, "height": 720})
    page = ctx.new_page()
    page.route("**/sw.js", lambda r: r.abort())
    page.goto(BASE + "?tv=1")
    page.wait_for_selector(".program-card")
    page.wait_for_timeout(1200)

    # AC8/AC9: tv mode + initial focus lands in the view
    check("AC9 tv-mode class", page.evaluate("document.documentElement.classList.contains('tv-mode')"))
    check("AC8 initial focus inside programs view", page.evaluate("!!document.activeElement.closest('#viewPrograms')"))

    # AC1/AC3: arrows move focus; Enter opens a program
    page.keyboard.press("ArrowDown"); page.keyboard.press("ArrowDown")
    check("AC1 focus on a program card after arrows", "program-card" in (focused(page) or "") or "filter-pill" in (focused(page) or ""))
    page.focus(".program-card")
    page.keyboard.press("Enter")
    page.wait_for_timeout(500)
    check("AC3 Enter opens program detail", page.evaluate("location.hash.startsWith('#/program/')"))
    check("AC8 focus moved into program detail", page.evaluate("!!document.activeElement.closest('#viewProgramDetail')"))

    # open a workout with Enter on a row
    page.focus(".program-workout-item")
    page.keyboard.press("Enter")
    page.wait_for_timeout(600)
    check("workout player opened", page.evaluate("location.hash.startsWith('#/workout/')"))
    wid = page.evaluate("location.hash.split('/')[2]")

    # AC4: Back steps up
    page.keyboard.press("Escape"); page.wait_for_timeout(300)
    check("AC4 Back: player -> program", page.evaluate("location.hash.startsWith('#/program/')"))
    page.keyboard.press("Escape"); page.wait_for_timeout(300)
    check("AC4 Back: program -> programs", page.evaluate("location.hash == '#/programs'"))
    check("AC4 Back at root returns false", page.evaluate("window.mvnTvBack() === false"))

    # AC5: modal trap + Back closes
    page.click("#settingsBtn"); page.wait_for_timeout(300)
    check("AC5 modal focuses inside", page.evaluate("!!document.activeElement.closest('#settingsModal')"))
    for _ in range(8): page.keyboard.press("ArrowDown")
    check("AC5 focus stays trapped", page.evaluate("!!document.activeElement.closest('#settingsModal')"))
    page.keyboard.press("Escape"); page.wait_for_timeout(200)
    check("AC4 Back closes modal", page.evaluate("getComputedStyle(document.getElementById('settingsModal')).display == 'none'"))

    # Tabs reachable by arrow keys
    page.focus(".nav-tab.active")
    page.keyboard.press("ArrowRight")
    check("AC1 ArrowRight moves between tabs", "nav-tab" in (focused(page) or "") and "active" not in (focused(page) or ""))

    # AC6: video seek via arrows, Enter toggles
    page.evaluate(f"location.hash='#/workout/{wid}'"); page.wait_for_timeout(500)
    page.evaluate("""() => { const v=document.getElementById('workoutVideoPlayer');
        Object.defineProperty(v,'duration',{value:600,configurable:true}); v.focus(); }""")
    page.keyboard.press("ArrowRight")
    page.keyboard.press("ArrowDown")
    check("AC6 ArrowDown leaves video", page.evaluate("document.activeElement.id != 'workoutVideoPlayer'"))

    # AC7: inputs keep native left/right
    page.evaluate("location.hash='#/workouts'"); page.wait_for_timeout(300)
    page.focus("#workoutSearchInput"); page.keyboard.type("abc"); page.keyboard.press("ArrowLeft")
    check("AC7 input keeps focus on ArrowLeft", page.evaluate("document.activeElement.id") == "workoutSearchInput")

    # ---- Resume (issue #2) ----
    page.goto(BASE + "?tv=1"); page.wait_for_selector(".program-card")
    check("Resume AC7 no tile on fresh install", page.locator("#resumeRow").count() == 0)
    wid2 = page.evaluate("""async () => { const w = await (await fetch('assets/data/workouts_index.json')).json();
        return Object.keys(w)[0]; }""")
    page.evaluate("""(id) => localStorage.setItem('mvn_last_session', JSON.stringify(
        {workoutId:id, position:125, duration:1500, finished:false, updatedAt:new Date().toISOString()}))""", wid2)
    page.goto(BASE + "?tv=1"); page.wait_for_selector("#resumeTileMain")
    txt = page.inner_text("#resumeTileMain").lower()
    check("Resume AC2 tile shows Resume at 2:05", "resume" in txt and "2:05" in txt)
    check("Resume AC2 tile is first focus", page.evaluate("document.activeElement.id") == "resumeTileMain")
    page.keyboard.press("Enter"); page.wait_for_timeout(600)
    check("Resume AC3 opens workout", page.evaluate("location.hash") == f"#/workout/{wid2}")

    # finished -> up next
    page.evaluate("""(id) => localStorage.setItem('mvn_last_session', JSON.stringify(
        {workoutId:id, position:1490, duration:1500, finished:true}))""", wid2)
    page.goto(BASE + "?tv=1"); page.wait_for_selector("#resumeTileMain")
    check("Resume AC4 shows Up next", "up next" in page.inner_text("#resumeTileMain").lower())
    page.evaluate("""(id) => localStorage.setItem('mvn_last_session', JSON.stringify(
        {workoutId:id, position:3, duration:1500, finished:false}))""", wid2)
    page.goto(BASE + "?tv=1"); page.wait_for_selector("#resumeTileMain")
    check("Resume AC5 <10s counts as not started", "resume" not in page.inner_text("#resumeTileMain").lower())
    page.close()  # never close the user's Edge
    if not is_edge: b.close()

srv.shutdown()
print("\nFAILED: %s" % fails if fails else "\nALL PASSED")
sys.exit(1 if fails else 0)
