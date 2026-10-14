#!/usr/bin/env python3
"""
High-performance script to clean escaped unicode and HTML entities across all JSON assets.
Replaces literal \\uXXXX sequences, \\r carriage returns, and HTML entities.
"""

import json
import re
import html
import time
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
ASSETS_DIR = BASE_DIR / "assets"
UNICODE_PATTERN = re.compile(r'\\u([0-9a-fA-F]{4})')

def unescape_u(m):
    return chr(int(m.group(1), 16))

def clean_file(path: Path) -> bool:
    try:
        text = path.read_text(encoding='utf-8')
    except Exception as e:
        print(f"Error reading {path}: {e}")
        return False

    if '\\u' not in text and '&' not in text and '\r' not in text:
        return False

    # 1. Unescape \uXXXX
    cleaned = UNICODE_PATTERN.sub(unescape_u, text)
    
    # 2. Unescape common HTML entities
    cleaned = html.unescape(cleaned)
    
    # 3. Normalize \r\n and \r
    cleaned = cleaned.replace('\r\n', '\n').replace('\r', '\n')

    # Validate JSON syntax
    try:
        data = json.loads(cleaned)
    except Exception as e:
        # If unescaping created invalid JSON characters (e.g. unescaped control characters in string),
        # parse the original data and serialize with ensure_ascii=False
        try:
            orig = json.loads(text)
            def recursive_clean(obj):
                if isinstance(obj, str):
                    s = UNICODE_PATTERN.sub(unescape_u, obj)
                    s = html.unescape(s)
                    return s.replace('\r\n', '\n').replace('\r', '\n')
                elif isinstance(obj, list):
                    return [recursive_clean(x) for x in obj]
                elif isinstance(obj, dict):
                    return {k: recursive_clean(v) for k, v in obj.items()}
                return obj
            data = recursive_clean(orig)
        except Exception as e2:
            print(f"Skipping {path.name} due to parse error: {e2}")
            return False

    try:
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        return True
    except Exception as e:
        print(f"Error writing {path}: {e}")
        return False

def main():
    start = time.time()
    data_files = list((ASSETS_DIR / "data").glob("*.json"))
    workout_files = list((ASSETS_DIR / "workouts").glob("*.json"))
    
    all_files = data_files + workout_files
    print(f"Processing {len(all_files)} JSON files ({len(data_files)} data, {len(workout_files)} workouts)...")
    
    cleaned = 0
    for i, p in enumerate(all_files):
        if clean_file(p):
            cleaned += 1
        if (i + 1) % 100 == 0 or i == len(all_files) - 1:
            print(f"  Processed {i+1}/{len(all_files)} files ({cleaned} updated so far)...")
            
    print(f"Done! Cleaned {cleaned} files in {time.time() - start:.2f}s")

if __name__ == '__main__':
    main()
