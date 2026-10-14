#!/usr/bin/env python3
"""
Rebuild circuit workouts and video metadata for Menovation.
1. Audits all 507 workouts across 21 programs.
2. Identifies full-length video workouts vs circuit-based workouts with cooldown flows.
3. Synthesizes rich, structured circuitsCopy for all workouts with workoutCircuits.
4. Tags videoType ('full' or 'cooldown') and videoLabel.
5. Updates assets/data/workouts_index.json cleanly with UTF-8.
"""

import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
ASSETS_DIR = BASE_DIR / "assets"
WORKOUTS_DIR = ASSETS_DIR / "workouts"
DATA_DIR = ASSETS_DIR / "data"

FULL_VIDEO_PROGRAM_IDS = {782, 841, 862, 874, 892, 898, 904, 910, 5397, 5417, 5561, 5795, 5802, 5806, 5810}
CIRCUIT_PROGRAM_IDS = {916, 2674, 5473, 5895, 6209, 6217}

def main():
    print("Loading exercises and workouts index...")
    with open(DATA_DIR / "exercises.json", "r", encoding="utf-8") as f:
        exercises = json.load(f)
    with open(DATA_DIR / "workouts_index.json", "r", encoding="utf-8") as f:
        workouts_index = json.load(f)
    with open(DATA_DIR / "programs.json", "r", encoding="utf-8") as f:
        programs = json.load(f)

    print(f"Loaded {len(workouts_index)} workouts in index.")

    rebuilt_circuits_count = 0
    full_video_count = 0
    cooldown_video_count = 0

    for wid_str, w_entry in workouts_index.items():
        wid = int(wid_str)
        pid = w_entry.get("programPostId", 0)

        raw_path = WORKOUTS_DIR / f"{wid}.json"
        raw_workout = None
        if raw_path.exists():
            try:
                with open(raw_path, "r", encoding="utf-8") as f:
                    raw_workout = json.load(f)
            except Exception as e:
                print(f"Error loading {raw_path}: {e}")

        top_stream = raw_workout.get("workoutVideoStreamUrl") if raw_workout else None
        circuits = raw_workout.get("workoutCircuits", []) if raw_workout else []

        # Determine video type
        if top_stream or pid in FULL_VIDEO_PROGRAM_IDS:
            w_entry["videoType"] = "full"
            w_entry["videoLabel"] = "Full-Length Video Class"
            full_video_count += 1
        elif circuits:
            w_entry["videoType"] = "cooldown"
            w_entry["videoLabel"] = "Guided Cooldown Flow"
            cooldown_video_count += 1
        else:
            w_entry["videoType"] = "full"
            w_entry["videoLabel"] = "Workout Video"
            full_video_count += 1

        # Check if we should rebuild circuitsCopy
        existing_copy = w_entry.get("circuitsCopy", "").strip()
        if (not existing_copy or pid in CIRCUIT_PROGRAM_IDS) and circuits:
            lines = []
            for i, c in enumerate(circuits):
                title = c.get("circuitTitle") or f"Circuit {i+1}"
                is_cd = c.get("isCooldown", False) or "cooldown" in title.lower()
                
                # Format header
                if is_cd:
                    lines.append(f"Cool Down: {title}")
                else:
                    lines.append(f"Circuit {i+1}: {title}")

                # Rounds
                rounds = c.get("numberOfRounds")
                if rounds and rounds > 1:
                    lines.append(f"{rounds} Rounds")

                # Exercise List (standard sets/reps)
                for ex in c.get("exerciseList", []):
                    if ex.get("isRest"):
                        dur = ex.get("restDuration", 30)
                        lines.append(f"Rest — {dur} seconds")
                    else:
                        ex_id = str(ex.get("exercisePostId"))
                        ex_name = ex.get("exerciseTitleOverride")
                        if not ex_name and ex_id in exercises:
                            ex_name = exercises[ex_id].get("exerciseTitle")
                        if not ex_name:
                            ex_name = f"Exercise {ex_id}"

                        rep_qty = ex.get("repTimeQuantity")
                        rep_unit = ex.get("repString") or "Reps"
                        rep_unit = rep_unit.capitalize()
                        if rep_qty:
                            lines.append(f"{ex_name} — {rep_qty} {rep_unit}")
                        else:
                            lines.append(f"{ex_name}")

                # Circuit Slides (timed intervals)
                for s in c.get("circuitSlides", []):
                    stype = s.get("slideTypeId")
                    if stype == 200:  # exercise slide
                        dur = s.get("slideDuration", 30)
                        ef = s.get("exerciseFields", {})
                        ex_id = str(ef.get("exercisePostId"))
                        ex_name = None
                        if ex_id in exercises:
                            ex_name = exercises[ex_id].get("exerciseTitle")
                        if not ex_name:
                            ex_name = f"Exercise {ex_id}"
                        lines.append(f"{ex_name} — {dur} seconds")
                    elif stype == 300:  # rest slide
                        dur = s.get("slideDuration", 15)
                        lines.append(f"Rest — {dur} seconds")

                # Cooldown flow poses
                if is_cd and c.get("circuitSummary"):
                    for flow_line in c["circuitSummary"].split("\n"):
                        flow_line = flow_line.strip()
                        if flow_line and not flow_line.lower().startswith("poses in this"):
                            lines.append(f"{flow_line} — Guided Flow")

                lines.append("")

            generated_copy = "\n".join(lines).strip()
            if generated_copy:
                w_entry["circuitsCopy"] = generated_copy
                rebuilt_circuits_count += 1

    print(f"Audit complete: Full-length videos: {full_video_count}, Cooldown flow videos: {cooldown_video_count}")
    print(f"Rebuilt rich circuitsCopy for {rebuilt_circuits_count} workouts!")

    # Save workouts_index.json
    out_path = DATA_DIR / "workouts_index.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(workouts_index, f, ensure_ascii=False, indent=2)
    print(f"Saved updated workouts_index.json ({out_path.stat().st_size} bytes)")

if __name__ == "__main__":
    main()
