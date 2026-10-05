# Menovation Collected Asset Inventory
**Last Updated:** 2026-10-04  
**Total Assets Collected:** 30  
**Payload Size:** ~2.0 MB  
**Status:** 100% Downloaded & Verified Locally  

All assets listed below have been downloaded, verified, and placed into the [`assets/`](file:///mnt/c/Users/taylor/github/menovation/assets/) directory to power the offline webapp and native app.

---

## 1. Brand Identity & Images (`assets/images/`)

| File Name | Size | MIME Type | Purpose / Description |
| :--- | :--- | :--- | :--- |
| [`menovation-wordmark-sand.png`](file:///mnt/c/Users/taylor/github/menovation/assets/images/menovation-wordmark-sand.png) | 10,027 B | `image/png` | Official Menovation brand wordmark in light sand (`#d9cac7`), used in header navigation and splash screens. |
| [`menovation-sq-purple-512.png`](file:///mnt/c/Users/taylor/github/menovation/assets/images/menovation-sq-purple-512.png) | 14,402 B | `image/png` | High-resolution square icon (512x512) for PWA launcher, native home screen icons, and splash displays. |
| [`menovation-sq-purple-300.png`](file:///mnt/c/Users/taylor/github/menovation/assets/images/menovation-sq-purple-300.png) | 6,581 B | `image/png` | Medium square brand icon (300x300) for standard resolution displays and UI avatars. |
| [`menovation-site-cover.webp`](file:///mnt/c/Users/taylor/github/menovation/assets/images/menovation-site-cover.webp) | 35,156 B | `image/webp` | Hero background cover art used on the landing and authentication screens. |

---

## 2. Typography & Brand Fonts (`assets/fonts/`)

| File Name | Size | Format | Typographic Role |
| :--- | :--- | :--- | :--- |
| [`prata-latin-400-normal.woff2`](file:///mnt/c/Users/taylor/github/menovation/assets/fonts/prata-latin-400-normal.woff2) | 19,224 B | `font/woff2` | **Prata (Serif)**: Primary brand display serif for H1/H2 headlines and editorial titles. |
| [`NunitoSans-Bold.woff2`](file:///mnt/c/Users/taylor/github/menovation/assets/fonts/NunitoSans-Bold.woff2) | 34,300 B | `font/woff2` | **Nunito Sans Bold (700)**: Button labels, emphasis, and card headings. |
| [`NunitoSans-SemiBold.woff2`](file:///mnt/c/Users/taylor/github/menovation/assets/fonts/NunitoSans-SemiBold.woff2) | 33,876 B | `font/woff2` | **Nunito Sans SemiBold (600)**: Subheadings and navigation elements. |
| [`NunitoSans-Regular.woff2`](file:///mnt/c/Users/taylor/github/menovation/assets/fonts/NunitoSans-Regular.woff2) | 33,816 B | `font/woff2` | **Nunito Sans Regular (400)**: Core readable body text and articles. |
| [`NunitoSans-Light.woff2`](file:///mnt/c/Users/taylor/github/menovation/assets/fonts/NunitoSans-Light.woff2) | 33,620 B | `font/woff2` | **Nunito Sans Light (300)**: Captions and secondary metadata. |
| [`dashicons.woff2`](file:///mnt/c/Users/taylor/github/menovation/assets/fonts/dashicons.woff2) | 26,132 B | `font/woff2` | **Dashicons (WOFF2)**: Vector UI icons (password reveal, search, calendar, checkboxes). |
| [`dashicons.woff`](file:///mnt/c/Users/taylor/github/menovation/assets/fonts/dashicons.woff) | 26,124 B | `font/woff` | Dashicons WOFF fallback for legacy environments. |
| [`dashicons.ttf`](file:///mnt/c/Users/taylor/github/menovation/assets/fonts/dashicons.ttf) | 56,392 B | `font/ttf` | Dashicons TTF fallback for native rendering engines. |

---

## 3. Stylesheets & UI System (`assets/css/`)

| File Name | Size | Purpose |
| :--- | :--- | :--- |
| [`dashicons.min.css`](file:///mnt/c/Users/taylor/github/menovation/assets/css/dashicons.min.css) | 59,004 B | Standalone icon font stylesheet configured to load local Dashicons. |
| [`menovation-login.css`](file:///mnt/c/Users/taylor/github/menovation/assets/css/menovation-login.css) | 41,793 B | Menovation theme styling, MemberPress form layout rules, buttons, inputs, and typography reset. Zero remote dependencies. |

---

## 4. Client Runtime Scripts (`assets/js/`)

| File Name | Size | Role in Offline Runtime |
| :--- | :--- | :--- |
| [`underscore.min.js`](file:///mnt/c/Users/taylor/github/menovation/assets/js/underscore.min.js) | 19,012 B | Functional utility library for data manipulation and debouncing. |
| [`wp-hooks.min.js`](file:///mnt/c/Users/taylor/github/menovation/assets/js/wp-hooks.min.js) | 5,050 B | Lightweight pub/sub event hook system for decoupled UI state. |
| [`wp-i18n.min.js`](file:///mnt/c/Users/taylor/github/menovation/assets/js/wp-i18n.min.js) | 5,732 B | String localization and translation support. |
| [`flickity.pkgd.min.js`](file:///mnt/c/Users/taylor/github/menovation/assets/js/flickity.pkgd.min.js) | 57,709 B | Touch-enabled responsive carousel for workout cards and instructors. |
| [`autoptimize_single_login.js`](file:///mnt/c/Users/taylor/github/menovation/assets/js/autoptimize_single_login.js) | 87,532 B | Original client login behavior bundle. |
| [`mepr_general.js`](file:///mnt/c/Users/taylor/github/menovation/assets/js/mepr_general.js) | 1,079 B | MemberPress client validation helpers. |

---

## 5. Offline Application Baseline Data (`assets/data/`)

| File Name | Size | Scope & Content |
| :--- | :--- | :--- |
| [`exercises.json`](file:///mnt/c/Users/taylor/github/menovation/assets/data/exercises.json) | 1,174,631 B | Complete exercise library containing hundreds of exercises, target muscles, difficulty tiers, and instructions. |
| [`programs.json`](file:///mnt/c/Users/taylor/github/menovation/assets/data/programs.json) | 97,278 B | Structured programs (StrongHER, Pilates, Pelvic Floor, Mobility, Barre) with schedules and requirements. |
| [`core-basics.json`](file:///mnt/c/Users/taylor/github/menovation/assets/data/core-basics.json) | 9,293 B | Foundational core routine available to all users even in guest/offline mode. |
| [`health-articles.json`](file:///mnt/c/Users/taylor/github/menovation/assets/data/health-articles.json) | 135,492 B | 97 comprehensive health articles covering hormonal changes, sleep, nutrition, and exercise science. |
| [`contributors.json`](file:///mnt/c/Users/taylor/github/menovation/assets/data/contributors.json) | 29,509 B | Roster of Menovation educators, physical therapists, and fitness coaches. |
| [`nutrition-lessons.json`](file:///mnt/c/Users/taylor/github/menovation/assets/data/nutrition-lessons.json) | 13,531 B | 29 nutrition lessons designed for perimenopause and metabolic health. |
| [`stage-quiz.json`](file:///mnt/c/Users/taylor/github/menovation/assets/data/stage-quiz.json) | 14,252 B | Menopause stage self-assessment diagnostic questions and scoring rubrics. |
| [`fitness-quiz.json`](file:///mnt/c/Users/taylor/github/menovation/assets/data/fitness-quiz.json) | 2,956 B | Fitness level assessment questionnaires. |
| [`supplements.json`](file:///mnt/c/Users/taylor/github/menovation/assets/data/supplements.json) | 3,141 B | Evidence-based supplement recommendations. |
| [`health-check.json`](file:///mnt/c/Users/taylor/github/menovation/assets/data/health-check.json) | 54 B | Baseline build version and health verification response. |
