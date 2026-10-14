# Menovation Production Architecture & Deployment Guide

**Target Public Endpoint:** `https://data.taylorarchibald.com/menovation/`  
**Internal Upstream Host:** Raspberry Pi 3 (`pi3` / `192.168.187.103`)  
**Reverse Proxy Cloud Server:** Archimedes (`144.24.9.80`)

---

## 1. System Architecture

The Menovation production environment is structured to deliver fast offline-capable progressive web apps and multi-gigabyte video streaming with zero cloud egress cost:

```mermaid
flowchart LR
    User["Client Browser / Fire TV"] -->|HTTPS + SSO Cookie| NGINX["Archimedes NGINX (144.24.9.80)"]
    NGINX -->|SSO Subrequest /_menovation_auth| SSO["Universal SSO (Port 5050)"]
    NGINX -->|Persistent SSH Reverse Tunnel (:8085)| Caddy["Caddy Server on Pi3 (:8085)"]
    
    subgraph Pi3["Raspberry Pi 3 (Local Media Storage)"]
        Caddy --> AppDir["/home/pi/WD4TB/menovation/app/ (HTML/JS/CSS/Data)"]
        Caddy --> VideoDir["/home/pi/WD4TB/menovation/videos/ (720p Movies)"]
        Caddy --> GifDir["/home/pi/WD4TB/menovation/gifs/ (Exercise GIFs)"]
    end
    
    subgraph Caching["Archimedes Slice Caching"]
        NGINX -.->|3GB Local Video Cache (2MB Slices)| DiskCache["/var/cache/nginx/menovation"]
    end
```

### Component Roles & Responsibilities

| Component | Host | Role & Responsibilities |
| :--- | :--- | :--- |
| **Pi3 (Raspberry Pi 3)** | Local LAN (`192.168.187.103`) | **Bulk Media & File Storage Host**<br>&bull; Hosts physical Western Digital 4TB drive (`/home/pi/WD4TB/menovation/`).<br>&bull; Stores all 507 high-resolution 720p workout videos and 1,134 exercise demonstration GIFs.<br>&bull; Serves app shell, media, and catalogs via Caddy on port 8085.<br>&bull; Maintains persistent SSH reverse tunnel to Archimedes (`127.0.0.1:8085`), eliminating cloud storage fees. |
| **Archimedes** | Cloud Server (`144.24.9.80`) | **Public Gateway, SSO Auth & User State Server**<br>&bull; Handles HTTPS endpoint (`https://data.taylorarchibald.com/menovation/`).<br>&bull; Universal SSO (port 5050) with session cookies & TV QR pairing.<br>&bull; NGINX reverse proxy with `auth_request` gating all endpoints.<br>&bull; 3GB SSD Video Slice Cache (2MB chunks, 30-day retention) so video hits Pi3 over the tunnel only once.<br>&bull; **User Data State Host**: Serves `/sso/menovation/user-data` and persists completed workouts, diary logs, and video resume positions per SSO user account in `~/menovation_userdata/<username>.json`. |

### Path Mappings
1. **App Shell & Data**: `https://data.taylorarchibald.com/menovation/` -> Proxied directly to `http://127.0.0.1:8085/app/` on Pi3.
2. **Video Streaming**: `https://data.taylorarchibald.com/menovation/videos/` -> Proxied with 2MB slice chunking and cached for 30 days in Archimedes SSD cache.
3. **Exercise GIFs**: `https://data.taylorarchibald.com/menovation/gifs/` -> Proxied and cached for 30 days in Archimedes SSD cache.
4. **User Progress & State Sync**: `https://data.taylorarchibald.com/sso/menovation/user-data` -> Handled by SSO Flask app on Archimedes, associating workout completions, diary entries, and resume positions directly with the authenticated SSO user.

---

### User State Sync & Multi-Device Persistence

User progress, diary entries, and playback positions are not trapped in a single device's browser:
- **On App Launch**: The client calls `/sso/menovation/user-data`. When connected to Archimedes, it automatically hydrates the user's completed workout checkmarks, diary history, and the home screen "Continue" / "Up Next" tile from their SSO profile.
- **On Actions**: Marking a workout complete, submitting a diary entry, or pausing a video writes to local storage for instant zero-latency UI response, and asynchronously syncs up to Archimedes.
- **Account Switching**: If another user signs in on the same Fire TV or browser, the app recognizes the username change and isolates their local data.
- **Offline Fallback**: If internet connectivity is interrupted, the app operates 100% offline using the cached IndexedDB/localStorage data.

---

## 2. Deploying Changes to Production

A dedicated deployment script [`scripts/deploy_to_pi3.sh`](file:///mnt/c/Users/taylor/github/menovation/scripts/deploy_to_pi3.sh) handles syncing and verifying all application files and data catalogs.

### One-Command Deployment
Run the following from the repository root:

```bash
bash scripts/deploy_to_pi3.sh
```

### What the Script Does:
1. **Connectivity Check**: Verifies SSH connectivity to `pi3`.
2. **App Shell Sync**: Rsyncs [`app/index.html`](file:///mnt/c/Users/taylor/github/menovation/app/index.html), [`app/sw.js`](file:///mnt/c/Users/taylor/github/menovation/app/sw.js), and `app/manifest.webmanifest`.
3. **Scripts & Styles Sync**: Rsyncs [`app/css/`](file:///mnt/c/Users/taylor/github/menovation/app/css/) and [`app/js/`](file:///mnt/c/Users/taylor/github/menovation/app/js/).
4. **Data Catalogs Sync**: Rsyncs [`assets/data/*.json`](file:///mnt/c/Users/taylor/github/menovation/assets/data/) and [`assets/manifest.json`](file:///mnt/c/Users/taylor/github/menovation/assets/manifest.json).
5. **Live Verification**: Queries the live server on port 8085 to confirm Service Worker version, Program 6217 title, and zero remaining unicode artifacts.

---

## 3. Service Worker & Cache Invalidation

Progressive Web Apps cache assets aggressively to enable offline capability. To ensure users immediately see new updates when deployed:

1. **`skipWaiting()` & `clients.claim()`**:
   - In [`app/sw.js`](file:///mnt/c/Users/taylor/github/menovation/app/sw.js), `install` immediately invokes `self.skipWaiting()`.
   - The `activate` event immediately calls `self.clients.claim()` to seize control of all open tabs.
   - When the service worker controller changes, [`app/index.html`](file:///mnt/c/Users/taylor/github/menovation/app/index.html) automatically reloads the page.
2. **Network-First for JSON Catalogs & Scripts**:
   - Dynamic JSON catalogs in `/assets/data/` (programs, workouts, exercises), scripts (`.js`), and styles (`.css`) use a **Network-First** strategy.
   - When online, the browser always requests the fresh version from the server first and updates local cache. If offline, it falls back to the IndexedDB/CacheStorage snapshot.
3. **Cache-Busting Query Strings**:
   - Script and style links in [`app/index.html`](file:///mnt/c/Users/taylor/github/menovation/app/index.html) include `?v=11`. Bumping this query string bypasses any lingering HTTP-level browser cache.

---

## 4. Program 6217 & Multi-Tier Difficulty Tracks

### Understanding Workout Counts
- **Program 6217 (Power Builder)** and **Program 5895 (Glute Builder)** have **72 total workouts in the database**.
- These 72 workouts represent **three distinct 24-workout schedules**:
  1. **Beginner Track (24 Workouts)**: Progression for newer lifters.
  2. **Intermediate Track (24 Workouts)**: Progression with moderate volume.
  3. **Advanced Track (24 Workouts)**: Progression with heavier sets.
- In the UI, the program page features **Difficulty Track Filter Pills**: `Beginner (24)`, `Intermediate (24)`, `Advanced (24)`, and `All (72)`.
- By default, it opens to the **Beginner Track (24 Workouts)**, clearly displaying workouts 1 through 24.

---

## 5. Circuit Workouts vs. Video Classes

- **Follow-Along Classes (265 Workouts)**: Programs like StrongHER, Barre, and Yoga provide full 20–45 minute continuous coaching videos (`videoType: "full"`).
- **Self-Guided Circuit Workouts (242 Workouts)**: Programs like Power Builder, Glute Builder, and MAM30 are self-paced weightlifting/interval circuits:
  - The workouts consist of structured circuits (Warmup, Strength Lower, Strength Upper, Core, etc.) with sets, reps, and demonstration GIFs.
  - The coach recorded a 2–4 minute **Guided Cooldown Video Flow** for members to perform after lifting.
  - In the UI, these are prominently labeled with `Guided Cooldown Flow` badges, a format explanation banner, and `▶ Preview` opens the cooldown flow in the floating Picture-in-Picture mini-player.
