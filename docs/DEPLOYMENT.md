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

### Path Mappings
1. **App Shell & Data**: `https://data.taylorarchibald.com/menovation/` -> Proxied directly to `http://127.0.0.1:8085/app/` on Pi3.
2. **Video Streaming**: `https://data.taylorarchibald.com/menovation/videos/` -> Proxied with 2MB slice chunking and cached for 30 days in Archimedes SSD cache.
3. **Exercise GIFs**: `https://data.taylorarchibald.com/menovation/gifs/` -> Proxied and cached for 30 days in Archimedes SSD cache.

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
