import os
import urllib.request
import json
from pathlib import Path

token = os.environ.get('GITHUB_TOKEN')
headers = {
    'Authorization': f'Bearer {token}',
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Menovation-Bot',
    'Content-Type': 'application/json'
}

issues = [
    {
        'title': 'fix: Eliminate raw escaped unicode sequences across all programs, workouts, and UI views',
        'body': """### Problem
Raw escaped unicode sequences (e.g. \\u000A, \\u2019, \\u201c, \\u201d, \\u2013, \\u2014, \\u2026) and unescaped HTML entities appear across program overview copy (e.g., Program 6217 Power Builder), workout descriptions, and UI views.

### Scope & Solution
1. Data Sanitization: Batch-clean all JSON files (`assets/data/programs.json`, `assets/data/workouts_index.json`, `assets/workouts/*.json`, `exercises.json`, `health-articles.json`) converting literal unicode escape sequences to proper UTF-8 characters and real newlines.
2. Frontend Sanitization: Enhance `cleanText()` in `app/js/app.js` and `app/js/tv.js` to decode all unicode escapes and HTML entities, and ensure all rendered data (program titles, tags, descriptions, workouts, circuits) passes through `cleanText()`.
3. Multi-line formatting: Format multi-line program overviews with proper paragraph breaks and CSS styling.""",
        'file': 'docs/issues/005-fix-unicode-artifacts.md'
    },
    {
        'title': 'audit: Audit all workout videos and rebuild structured circuits for circuit-based programs',
        'body': """### Problem
On Program 6217 (Power Builder) and other circuit-based programs (e.g., 5895 Glute Builder, 916 MAM30, 2674 MAM Elite, 5473 MAM Bridge, 6209 MAM Travel), workouts do not have a continuous follow-along video coach. Instead, they are structured interval/rep circuit workouts with a short 2-4 minute cooldown video. The asset downloader previously assigned the cooldown video as the entire workout video, and left `circuitsCopy` blank, causing video-workout mismatch.

### Scope & Solution
1. Comprehensive audit of all 21 programs (507 workouts) categorizing follow-along video classes vs circuit-based workouts.
2. Rebuild `circuitsCopy` across all workouts with `workoutCircuits` data in `assets/workouts/`, synthesizing exercises, sets, reps, timed intervals, and linking with `exercises.json` animated GIFs.
3. Update workout player UI to clearly badge video role (Full-Length Workout Video vs Guided Cooldown Video) and display full interactive circuit breakdowns.""",
        'file': 'docs/issues/006-audit-and-rebuild-circuit-workouts.md'
    },
    {
        'title': 'feat: Replace Start button with Open and Preview (PiP player) buttons',
        'body': """### Problem
Program detail and workout listing views currently feature a single 'Start' button that immediately navigates the user into the workout player. Users need the ability to quickly preview workout videos in the picture-in-picture player without leaving their current browsing position.

### Scope & Solution
1. Replace 'Start' action pill in program workout items with two distinct controls:
   - 'Open': Navigates to full workout view (`#/workout/:id`)
   - 'Preview': Immediately launches workout video in floating Picture-in-Picture / mini-player with playback.
2. Add corresponding 'Preview' and 'Open' action buttons to the workout cards in the All Workouts directory.
3. Ensure fluid mini-player controls, smooth transitions, and proper video loading.""",
        'file': 'docs/issues/007-open-and-preview-workout-buttons.md'
    }
]

created_issues = []
for iss in issues:
    data = json.dumps({'title': iss['title'], 'body': iss['body']}).encode('utf-8')
    req = urllib.request.Request('https://api.github.com/repos/Tahlor/menovation/issues', data=data, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            res = json.loads(resp.read().decode())
            num = res.get('number')
            url = res.get('html_url')
            print(f"Opened GitHub Issue #{num}: {iss['title']}")
            created_issues.append((num, iss['title'], url, iss['file'], iss['body']))
    except Exception as e:
        print(f"Failed to create GitHub issue for '{iss['title']}': {e}")

for num, title, url, fpath, body in created_issues:
    content = f"""# Issue #{num}: {title}

**GitHub URL**: {url}  
**Status**: Open (In Progress)

{body}
"""
    Path(fpath).write_text(content, encoding='utf-8')
    print(f"Wrote {fpath}")
