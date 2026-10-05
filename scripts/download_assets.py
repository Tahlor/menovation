#!/usr/bin/env python3
"""
Menovation Asset Collector
Downloads and catalogs core assets required for offline operation of Menovation.
Authorized for offline app and webapp development.
"""

import os
import sys
import json
import hashlib
import urllib.request
import urllib.error
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
ASSETS_DIR = BASE_DIR / "assets"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "*/*",
}

# Assets to collect from menovation.com and app theme
ASSET_DEFINITIONS = [
    # --- Images & Branding ---
    {
        "category": "images",
        "filename": "menovation-wordmark-sand.png",
        "url": "https://menovation.com/wp-content/uploads/2025/08/Menovation_wordmark_lightSand_1000X300.png",
        "description": "Primary Menovation header wordmark (Light Sand)"
    },
    {
        "category": "images",
        "filename": "menovation-sq-purple-512.png",
        "url": "https://menovation.com/wp-content/uploads/2025/02/menovation-sq-purple-512.png",
        "description": "Menovation square purple icon (512x512)"
    },
    {
        "category": "images",
        "filename": "menovation-sq-purple-300.png",
        "url": "https://menovation.com/wp-content/uploads/2025/02/menovation-sq-purple-512-300x300.png",
        "description": "Menovation square purple icon (300x300 thumbnail)"
    },
    {
        "category": "images",
        "filename": "menovation-site-cover.webp",
        "url": "https://menovation.com/wp-content/uploads/2025/04/menovation-site-cover.webp",
        "description": "Hero site cover background image"
    },

    # --- Brand Fonts ---
    {
        "category": "fonts",
        "filename": "prata-latin-400-normal.woff2",
        "url": "https://menovation.com/wp-content/themes/menovation-app-theme/fonts/prata-latin-400-normal.woff2",
        "description": "Prata font (Serif brand headline font)"
    },
    {
        "category": "fonts",
        "filename": "NunitoSans-Bold.woff2",
        "url": "https://menovation.com/wp-content/themes/menovation-app-theme/fonts/NunitoSans-Bold.woff2",
        "description": "NunitoSans Bold font"
    },
    {
        "category": "fonts",
        "filename": "NunitoSans-SemiBold.woff2",
        "url": "https://menovation.com/wp-content/themes/menovation-app-theme/fonts/NunitoSans-SemiBold.woff2",
        "description": "NunitoSans SemiBold font"
    },
    {
        "category": "fonts",
        "filename": "NunitoSans-Regular.woff2",
        "url": "https://menovation.com/wp-content/themes/menovation-app-theme/fonts/NunitoSans-Regular.woff2",
        "description": "NunitoSans Regular body font"
    },
    {
        "category": "fonts",
        "filename": "NunitoSans-Light.woff2",
        "url": "https://menovation.com/wp-content/themes/menovation-app-theme/fonts/NunitoSans-Light.woff2",
        "description": "NunitoSans Light font"
    },

    # --- UI Icon Fonts ---
    {
        "category": "fonts",
        "filename": "dashicons.woff2",
        "url": "https://menovation.com/wp-includes/fonts/dashicons.woff2",
        "description": "WordPress Dashicons font (Woff2)"
    },
    {
        "category": "fonts",
        "filename": "dashicons.woff",
        "url": "https://menovation.com/wp-includes/fonts/dashicons.woff",
        "description": "WordPress Dashicons font (Woff fallback)"
    },
    {
        "category": "fonts",
        "filename": "dashicons.ttf",
        "url": "https://menovation.com/wp-includes/fonts/dashicons.ttf",
        "description": "WordPress Dashicons font (TTF fallback)"
    },

    # --- Stylesheets ---
    {
        "category": "css",
        "filename": "dashicons.min.css",
        "url": "https://menovation.com/wp-includes/css/dashicons.min.css",
        "description": "Dashicons UI stylesheet"
    },

    # --- Core JavaScript Libraries ---
    {
        "category": "js",
        "filename": "underscore.min.js",
        "url": "https://menovation.com/wp-includes/js/underscore.min.js",
        "description": "Underscore.js utility library"
    },
    {
        "category": "js",
        "filename": "wp-hooks.min.js",
        "url": "https://menovation.com/wp-includes/js/dist/hooks.min.js",
        "description": "WordPress hooks/event system"
    },
    {
        "category": "js",
        "filename": "wp-i18n.min.js",
        "url": "https://menovation.com/wp-includes/js/dist/i18n.min.js",
        "description": "WordPress internationalization library"
    },
    {
        "category": "js",
        "filename": "flickity.pkgd.min.js",
        "url": "https://menovation.com/wp-content/themes/menovation-app-theme/js/packages/flickity.pkgd.min.js",
        "description": "Flickity touch carousel package"
    },
    {
        "category": "js",
        "filename": "autoptimize_single_login.js",
        "url": "https://menovation.com/wp-content/cache/autoptimize/js/autoptimize_single_2c872dbe60f4ba70fb85356113d8b35e.js",
        "description": "Login page client bundle"
    },
    {
        "category": "js",
        "filename": "mepr_general.js",
        "url": "https://menovation.com/wp-content/cache/autoptimize/js/autoptimize_single_04b4ba3e07a5c5147c1a2877714ebba8.js",
        "description": "MemberPress general client script"
    },

    # --- Baseline Application Data (JSON) ---
    {
        "category": "data",
        "filename": "health-check.json",
        "url": "https://menovation.com/wp-json/mvn-app/v1/health-check",
        "description": "App build version and health status"
    },
    {
        "category": "data",
        "filename": "programs.json",
        "url": "https://menovation.com/wp-json/mvn-app/v1/programs",
        "description": "Workout programs catalogue"
    },
    {
        "category": "data",
        "filename": "core-basics.json",
        "url": "https://menovation.com/wp-json/mvn-app/v1/core-basics",
        "description": "Core Basics foundational routine data"
    },
    {
        "category": "data",
        "filename": "exercises.json",
        "url": "https://menovation.com/wp-json/mvn-app/v1/exercises",
        "description": "Complete exercise library dictionary"
    },
    {
        "category": "data",
        "filename": "contributors.json",
        "url": "https://menovation.com/wp-json/mvn-app/v1/contributors",
        "description": "Educators and fitness instructors roster"
    },
    {
        "category": "data",
        "filename": "nutrition-lessons.json",
        "url": "https://menovation.com/wp-json/mvn-app/v1/nutrition-lessons",
        "description": "Perimenopause nutrition lessons catalog"
    },
    {
        "category": "data",
        "filename": "health-articles.json",
        "url": "https://menovation.com/wp-json/mvn-app/v1/health-articles",
        "description": "Women's wellness and menopause health articles"
    },
    {
        "category": "data",
        "filename": "supplements.json",
        "url": "https://menovation.com/wp-json/mvn-app/v1/supplements",
        "description": "Menopause supplement guide"
    },
    {
        "category": "data",
        "filename": "fitness-quiz.json",
        "url": "https://menovation.com/wp-json/mvn-app/v1/fitness-quiz",
        "description": "Fitness assessment questionnaire structure"
    },
    {
        "category": "data",
        "filename": "stage-quiz.json",
        "url": "https://menovation.com/wp-json/mvn-app/v1/stage-quiz",
        "description": "Menopause stage assessment quiz structure"
    },
]

def download_file(url: str, dest_path: Path) -> dict:
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers=HEADERS)
    
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            content = response.read()
            dest_path.write_bytes(content)
            
            sha256 = hashlib.sha256(content).hexdigest()
            size = len(content)
            content_type = response.headers.get("Content-Type", "application/octet-stream")
            
            return {
                "status": "success",
                "size_bytes": size,
                "sha256": sha256,
                "content_type": content_type
            }
    except urllib.error.HTTPError as e:
        return {
            "status": "error",
            "error_code": e.code,
            "error_message": str(e)
        }
    except Exception as e:
        return {
            "status": "error",
            "error_code": 0,
            "error_message": str(e)
        }

def main():
    print("=" * 60)
    print(" Menovation Offline Asset Collector")
    print("=" * 60)
    print(f"Target directory: {ASSETS_DIR}")
    print(f"Total assets queued: {len(ASSET_DEFINITIONS)}\n")

    manifest = {
        "project": "Menovation Offline App & Webapp",
        "collected_at": "",
        "base_url": "https://menovation.com",
        "categories": ["images", "fonts", "css", "js", "data"],
        "assets": {}
    }

    import datetime
    manifest["collected_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()

    success_count = 0
    fail_count = 0
    total_bytes = 0

    for item in ASSET_DEFINITIONS:
        category = item["category"]
        filename = item["filename"]
        url = item["url"]
        desc = item["description"]
        
        target_path = ASSETS_DIR / category / filename
        rel_path = str(target_path.relative_to(BASE_DIR))
        
        print(f"[{category.upper():<6}] Downloading {filename} ... ", end="", flush=True)
        res = download_file(url, target_path)
        
        if res["status"] == "success":
            print(f"OK ({res['size_bytes']:,} bytes)")
            success_count += 1
            total_bytes += res["size_bytes"]
            manifest["assets"][filename] = {
                "category": category,
                "relative_path": rel_path,
                "source_url": url,
                "description": desc,
                "size_bytes": res["size_bytes"],
                "sha256": res["sha256"],
                "content_type": res["content_type"]
            }
        else:
            print(f"FAILED ({res.get('error_code')}: {res.get('error_message')})")
            fail_count += 1
            manifest["assets"][filename] = {
                "category": category,
                "relative_path": rel_path,
                "source_url": url,
                "description": desc,
                "status": "failed",
                "error": res.get("error_message")
            }

    # Save manifest
    manifest_path = ASSETS_DIR / "manifest.json"
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, indent=2))
    
    print("\n" + "=" * 60)
    print(f"Collection Complete: {success_count} succeeded, {fail_count} failed")
    print(f"Total downloaded payload: {total_bytes / (1024 * 1024):.2f} MB")
    print(f"Asset manifest generated at: {manifest_path.relative_to(BASE_DIR)}")
    print("=" * 60)

if __name__ == "__main__":
    main()
