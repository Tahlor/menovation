# Menovation Asset Collection Plan & Strategy
**Document Version:** 1.0.0  
**Scope:** Asset Discovery, Ingestion, Caching, and Manifest Generation  
**Authorization:** Authorized for offline application & webapp development  

---

## 1. Scope & Authorization Overview

To enable Menovation to operate seamlessly when an internet connection is unavailable, all critical front-end presentation assets, brand elements, UI typography, client runtime scripts, and baseline reference datasets must be mirrored and stored locally.

As authorized, asset collection covers:
1. **Login & Shell Assets**: Brand wordmarks, icons, site covers, stylesheets, and scripts referenced at `https://menovation.com/login/`.
2. **Design System & Typography**: Brand serif (`Prata`) and sans-serif (`NunitoSans`) web fonts, Dashicons icon fonts, and Menovation CSS custom property themes.
3. **Core Application Data**: Baseline schemas and dictionaries from the WordPress REST API (`/wp-json/mvn-app/v1/`), including exercise catalogues, workout programs, contributor directories, nutrition guides, and quizzes.

---

## 2. Asset Classification & Storage Hierarchy

Assets are structured in the repository under `/assets/` according to their functional type:

```
assets/
├── manifest.json              # Canonical inventory of all downloaded assets with hashes & metadata
├── images/                    # Brand logos, wordmarks, site banners, and UI graphics
│   ├── menovation-wordmark-sand.png
│   ├── menovation-sq-purple-512.png
│   ├── menovation-sq-purple-300.png
│   └── menovation-site-cover.webp
├── fonts/                     # Web fonts required for 100% offline typography
│   ├── prata-latin-400-normal.woff2
│   ├── NunitoSans-Bold.woff2
│   ├── NunitoSans-SemiBold.woff2
│   ├── NunitoSans-Regular.woff2
│   ├── NunitoSans-Light.woff2
│   ├── dashicons.woff2
│   ├── dashicons.woff
│   └── dashicons.ttf
├── css/                       # Localized, unbundled, zero-dependency stylesheets
│   ├── dashicons.min.css
│   └── menovation-login.css
├── js/                        # Core client scripts and utilities
│   ├── underscore.min.js
│   ├── wp-hooks.min.js
│   ├── wp-i18n.min.js
│   ├── flickity.pkgd.min.js
│   ├── autoptimize_single_login.js
│   └── mepr_general.js
└── data/                      # Baseline offline application datasets (JSON)
    ├── health-check.json
    ├── programs.json
    ├── core-basics.json
    ├── exercises.json
    ├── contributors.json
    ├── nutrition-lessons.json
    ├── health-articles.json
    ├── supplements.json
    ├── fitness-quiz.json
    └── stage-quiz.json
```

---

## 3. Tiered Asset Loading & Caching Strategy

| Asset Tier | Description | Storage Mechanism | Size Budget |
| :--- | :--- | :--- | :--- |
| **Tier 1: Core Shell & Brand UI** | Fonts, brand logos, CSS resets, core JS, PWA icons, login UI | Bundled in app package / Pre-cached in Service Worker Cache (`menovation-shell-v1`) | < 5 MB |
| **Tier 2: Baseline Clinical & Fitness Data** | Exercise catalog, program definitions, symptom lists, nutrition articles | IndexedDB / Pre-downloaded JSON files in app bundle | ~15 MB |
| **Tier 3: Rich Media (Videos & Audio)** | High-definition workout videos, guided meditation audio, instructor voice-overs | On-demand Cache API / IndexedDB Blob storage via "Save Offline" toggle | 50–500 MB per program |

---

## 4. Collection Execution & Manifest Verification

Asset collection is automated via [`scripts/download_assets.py`](file:///mnt/c/Users/taylor/github/menovation/scripts/download_assets.py).

### Collection Process:
1. **Network Request**: Authenticated HTTP/2 GET with standard client headers and 30-second timeout.
2. **Integrity Verification**: Generation of SHA-256 cryptographic hashes for every binary and text asset.
3. **Local Writing**: Automated directory creation and atomic file writing.
4. **Manifest Assembly**: Serialization of [`assets/manifest.json`](file:///mnt/c/Users/taylor/github/menovation/assets/manifest.json) recording:
   - File name and relative path
   - Source URL
   - File size in bytes
   - SHA-256 checksum
   - Content-Type header
   - Functional category and description

### Re-running Collection:
To refresh or update offline assets at any time:
```bash
python3 scripts/download_assets.py
```

---

## 5. Security & Licensing Compliance

- All downloaded assets are internal properties of Menovation and authorized strictly for the purpose of creating the offline-capable webapp and native mobile application.
- Sensitive user tokens, passwords, and private member data are **never** committed into static assets; static data endpoints represent public reference taxonomies.
- Cryptographic hashes prevent asset tampering and assist cache-busting during version transitions.
