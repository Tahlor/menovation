# Issue #1: fix: Eliminate raw escaped unicode sequences across all programs, workouts, and UI views

**GitHub URL**: https://github.com/Tahlor/menovation/issues/1  
**Status**: Closed (Resolved)

### Problem
Raw escaped unicode sequences (e.g. \u000A, \u2019, \u201c, \u201d, \u2013, \u2014, \u2026) and unescaped HTML entities appear across program overview copy (e.g., Program 6217 Power Builder), workout descriptions, and UI views.

### Scope & Solution
1. Data Sanitization: Batch-clean all JSON files (`assets/data/programs.json`, `assets/data/workouts_index.json`, `assets/workouts/*.json`, `exercises.json`, `health-articles.json`) converting literal unicode escape sequences to proper UTF-8 characters and real newlines.
2. Frontend Sanitization: Enhance `cleanText()` in `app/js/app.js` and `app/js/tv.js` to decode all unicode escapes and HTML entities, and ensure all rendered data (program titles, tags, descriptions, workouts, circuits) passes through `cleanText()`.
3. Multi-line formatting: Format multi-line program overviews with proper paragraph breaks and CSS styling.
