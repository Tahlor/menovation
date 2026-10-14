#!/usr/bin/env python3
"""
Rebuild circuit workouts, structured metadata, and video integration for Menovation.
1. Audits all 507 workouts across 21 programs.
2. Identifies full-length video workouts vs circuit-based workouts with cooldown flows.
3. Generates structured 'circuits' data with exact exercise IDs, coaching tips, sets/reps, and timers.
4. Generates rich, clean 'circuitsCopy' text for backward compatibility and full-text search.
5. Tags videoType ('full' or 'cooldown') and videoLabel.
6. Updates assets/data/workouts_index.json cleanly with UTF-8.
"""

import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
ASSETS_DIR = BASE_DIR / "assets"
WORKOUTS_DIR = ASSETS_DIR / "workouts"
DATA_DIR = ASSETS_DIR / "data"

FULL_VIDEO_PROGRAM_IDS = {782, 841, 862, 874, 892, 898, 904, 910, 5397, 5417, 5561, 5795, 5802, 5806, 5810}
CIRCUIT_PROGRAM_IDS = {916, 2674, 5473, 5895, 6209, 6217}


def clean_text(s: str) -> str:
    if not s:
        return ""
    import re
    # Unescape raw unicode sequences if present
    s = re.sub(r'\\u([0-9a-fA-F]{4})', lambda m: chr(int(m.group(1), 16)), str(s))
    return s.strip()


def main():
    print("Loading exercises and workouts index...")
    with open(DATA_DIR / "exercises.json", "r", encoding="utf-8") as f:
        exercises = json.load(f)
    with open(DATA_DIR / "workouts_index.json", "r", encoding="utf-8") as f:
        workouts_index = json.load(f)

    print(f"Loaded {len(workouts_index)} workouts in index.")

    rebuilt_circuits_count = 0
    full_video_count = 0
    cooldown_video_count = 0
    total_structured_exercises = 0

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

        # Build structured circuits and circuitsCopy text
        if circuits:
            structured_circuits = []
            lines = []

            for i, c in enumerate(circuits):
                title = clean_text(c.get("circuitTitle") or f"Circuit {i+1}")
                is_cd = c.get("isCooldown", False) or "cooldown" in title.lower() or "cool down" in title.lower()
                rounds = c.get("numberOfRounds")
                summary = clean_text(c.get("circuitSummary") or "")

                # Split summary poses for cooldown
                cooldown_poses = []
                coaching_tip = ""
                if is_cd and summary:
                    for flow_line in summary.split("\n"):
                        flow_line = flow_line.strip()
                        if flow_line and not flow_line.lower().startswith("poses in this") and not flow_line.lower().startswith("poses in your"):
                            cooldown_poses.append(flow_line)
                elif not is_cd and summary:
                    coaching_tip = summary

                circuit_obj = {
                    "circuitIndex": i + 1,
                    "title": title,
                    "circuitTypeId": c.get("circuitTypeId"),
                    "isCooldown": is_cd,
                    "rounds": rounds,
                    "coachingTip": coaching_tip,
                    "videoStreamUrl": c.get("circuitVideoStreamUrl"),
                    "items": []
                }
                if cooldown_poses:
                    circuit_obj["cooldownPoses"] = cooldown_poses

                # Format text header for copy
                if is_cd:
                    lines.append(f"Cool Down: {title}")
                else:
                    lines.append(f"Circuit {i+1}: {title}")

                if rounds and rounds > 1:
                    lines.append(f"{rounds} Rounds")

                # Exercise List (standard sets/reps)
                for ex in c.get("exerciseList", []):
                    is_rest = ex.get("isRest") or ex.get("builtInRest", False)
                    if is_rest:
                        dur = ex.get("restDuration", 30)
                        circuit_obj["items"].append({
                            "type": "rest",
                            "duration": dur
                        })
                        lines.append(f"Rest — {dur} seconds")
                    else:
                        eid_raw = ex.get("exercisePostId")
                        eid = str(eid_raw) if eid_raw is not None else None
                        ex_info = exercises.get(eid, {}) if eid else {}
                        ex_name = clean_text(ex.get("exerciseTitleOverride") or ex_info.get("exerciseTitle") or f"Exercise {eid}")

                        rep_qty = ex.get("repTimeQuantity")
                        rep_unit = ex.get("repString") or "Reps"
                        rep_unit = clean_text(rep_unit).capitalize()

                        circuit_obj["items"].append({
                            "type": "exercise",
                            "exercisePostId": int(eid) if eid and eid.isdigit() else None,
                            "title": ex_name,
                            "repQuantity": rep_qty,
                            "repUnit": rep_unit,
                            "duration": None
                        })
                        total_structured_exercises += 1

                        if rep_qty:
                            lines.append(f"{ex_name} — {rep_qty} {rep_unit}")
                        else:
                            lines.append(f"{ex_name}")

                # Circuit Slides (timed intervals)
                for s in c.get("circuitSlides", []):
                    stype = s.get("slideTypeId")
                    dur = s.get("slideDuration", 30)
                    if stype == 200:  # exercise slide
                        ef = s.get("exerciseFields", {})
                        eid_raw = ef.get("exercisePostId")
                        eid = str(eid_raw) if eid_raw is not None else None
                        ex_info = exercises.get(eid, {}) if eid else {}
                        ex_name = clean_text(ex_info.get("exerciseTitle") or f"Exercise {eid}")

                        circuit_obj["items"].append({
                            "type": "exercise",
                            "exercisePostId": int(eid) if eid and eid.isdigit() else None,
                            "title": ex_name,
                            "repQuantity": None,
                            "repUnit": None,
                            "duration": dur
                        })
                        total_structured_exercises += 1
                        lines.append(f"{ex_name} — {dur} seconds")
                    elif stype == 100:  # prepare countdown
                        circuit_obj["items"].append({
                            "type": "prepare",
                            "duration": dur
                        })
                    elif stype in (300, 400):  # rest slide
                        circuit_obj["items"].append({
                            "type": "rest",
                            "duration": dur
                        })
                        lines.append(f"Rest — {dur} seconds")

                # Cooldown flow poses in copy
                if is_cd and cooldown_poses:
                    for pose in cooldown_poses:
                        lines.append(f"{pose} — Guided Flow")

                lines.append("")
                structured_circuits.append(circuit_obj)

            w_entry["circuits"] = structured_circuits
            generated_copy = "\n".join(lines).strip()
            if generated_copy:
                w_entry["circuitsCopy"] = generated_copy
                rebuilt_circuits_count += 1
        else:
            w_entry["circuits"] = []

    print(f"Audit complete: Full-length videos: {full_video_count}, Cooldown flow videos: {cooldown_video_count}")
    print(f"Rebuilt structured circuits for {rebuilt_circuits_count} workouts ({total_structured_exercises} exercise instances)!")

    # Save workouts_index.json
    out_path = DATA_DIR / "workouts_index.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(workouts_index, f, ensure_ascii=False, indent=2)
    print(f"Saved updated workouts_index.json ({out_path.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
