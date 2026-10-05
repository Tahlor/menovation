# Menovation Offline App & Webapp

[![Offline Ready](https://img.shields.io/badge/Offline-First-770053?style=for-the-badge&logo=pwa)](https://menovation.com)
[![Status](https://img.shields.io/badge/Status-Architecture%20%26%20Asset%20Collection%20Complete-green?style=for-the-badge)]()

**Menovation** ([menovation.com](https://menovation.com)) is a premier strength and wellness platform supporting women through perimenopause and beyond. 

This repository houses the architecture, asset collection pipeline, and offline-first client implementation that enables the Menovation application and webapp to work without an internet connection.

---

## 🎯 The Core Problem & Mission

### The Problem
The current Menovation platform relies on WordPress, MemberPress, and remote cloud APIs (`https://menovation.com/login/`, `/wp-json/mvn-app/v1/`). When internet connectivity is lost—in basement gyms, during travel, in cellular dead zones, or during server outages—members cannot log in, access workouts, or track daily perimenopause symptoms.

### The Solution
We are building a **standalone offline webapp (PWA)** and **cross-platform native app** designed from the ground up to operate 100% offline:
- **Instant Offline Access**: Opens immediately without a network connection.
- **Offline Authentication**: Cached JWT tokens with local PIN / biometric unlock fallback.
- **Local-First Data Storage**: Full exercise catalog, workout programs, and symptom tracking stored locally in IndexedDB / SQLite.
- **Reliable Bidirectional Sync**: An outbox mutation queue that automatically syncs symptom entries and workout progress back to `/wp-json/mvn-app/v1/` as soon as connection is restored.
- **Zero-Dependency Asset Bundle**: All brand fonts (Prata, Nunito Sans), vector icons (Dashicons), stylesheets, and images bundled locally.

---

## 📁 Repository Structure

```
.
├── assets/                          # Downloaded & verified offline assets
│   ├── manifest.json                # Complete cryptographic asset manifest
│   ├── images/                      # Wordmarks, square icons, cover art
│   ├── fonts/                       # Prata, NunitoSans, Dashicons fonts
│   ├── css/                         # Menovation login & theme stylesheets
│   ├── js/                          # Core JavaScript utility libraries
│   └── data/                        # Baseline datasets (exercises, programs, etc.)
├── docs/                            # In-depth architectural documentation
│   ├── OFFLINE_ARCHITECTURE.md      # Comprehensive offline-first system design
│   ├── ASSET_COLLECTION_PLAN.md     # Strategy, authorization & caching tiers
│   ├── OFFLINE_AUTH_AND_SYNC_SPEC.md# Offline login & mutation sync protocol
│   └── ASSET_INVENTORY.md           # Catalog of all collected assets
├── scripts/                         # Automation & ingestion scripts
│   └── download_assets.py           # Automated asset collector & integrity verifier
├── app/                             # Offline Webapp (PWA) client implementation
│   ├── index.html                   # Offline application UI shell
│   ├── sw.js                        # Service worker with offline caching strategies
│   ├── manifest.webmanifest         # PWA installation manifest
│   ├── css/app.css                  # Offline app stylesheet & brand tokens
│   └── js/app.js                    # Client-side routing, auth & IndexedDB logic
└── README.md                        # Project documentation & quick start guide
```

---

## 🚀 Quick Start

### 1. Re-run Asset Collection
Assets have been collected and verified under `assets/`. To re-fetch or verify integrity:
```bash
python3 scripts/download_assets.py
```

### 2. Launch the Offline Webapp Prototype Locally
You can run any local static file server to test the offline webapp and Service Worker:
```bash
# Python 3 built-in server
python3 -m http.server 8080 --directory app
```
Then visit `http://localhost:8080` in your browser. 
- Try disconnecting your Wi-Fi or enabling "Offline" in Chrome DevTools Network tab.
- The app will continue running, allow you to log in with offline PIN, view workouts, and log symptoms!

---

## 📚 Key Architectural Documents

| Document | Focus Area |
| :--- | :--- |
| [**Offline Architecture Specification**](file:///mnt/c/Users/taylor/github/menovation/docs/OFFLINE_ARCHITECTURE.md) | High-level system overview, comparison with current cloud architecture, PWA vs. Native app tradeoffs, and three-tier media storage model. |
| [**Asset Collection Plan & Strategy**](file:///mnt/c/Users/taylor/github/menovation/docs/ASSET_COLLECTION_PLAN.md) | Scope of authorized downloads, categorization, checksum verification, and caching policies. |
| [**Offline Auth & Sync Protocol**](file:///mnt/c/Users/taylor/github/menovation/docs/OFFLINE_AUTH_AND_SYNC_SPEC.md) | Handling login when internet is down, JWT caching, local PIN hashing, outbox sync queue, and conflict resolution. |
| [**Collected Asset Inventory**](file:///mnt/c/Users/taylor/github/menovation/docs/ASSET_INVENTORY.md) | Table of all 30 downloaded assets with sizes, SHA-256 prefixes, and functional roles. |

---

## 🎨 Menovation Design Tokens

The offline app adheres strictly to Menovation's brand design system:
- **Typography**: 
  - Headlines: `'Prata', serif`
  - Body & UI: `'NunitoSans', -apple-system, sans-serif`
- **Color Palette**:
  - Primary Purple: `#770053` (`--mvn-purple`)
  - Background Cream: `#fffef2` (`--mvn-cream`)
  - Light Sand: `#d9cac7` (`--mvn-light-sand`)
  - Warm Sand: `#c8b7b3` (`--mvn-sand`)
  - Dark Slate: `#231e23` (`--mvn-dark`)
  - Accent Neon: `#c9f277` (`--mvn-neon`)
