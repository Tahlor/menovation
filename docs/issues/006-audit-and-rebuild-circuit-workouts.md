# Issue #2: audit: Audit all workout videos and rebuild structured circuits for circuit-based programs

**GitHub URL**: https://github.com/Tahlor/menovation/issues/2  
**Status**: Closed (Resolved)

### Problem
On Program 6217 (Power Builder) and other circuit-based programs (e.g., 5895 Glute Builder, 916 MAM30, 2674 MAM Elite, 5473 MAM Bridge, 6209 MAM Travel), workouts do not have a continuous follow-along video coach. Instead, they are structured interval/rep circuit workouts with a short 2-4 minute cooldown video. The asset downloader previously assigned the cooldown video as the entire workout video, and left `circuitsCopy` blank, causing video-workout mismatch.

### Scope & Solution
1. Comprehensive audit of all 21 programs (507 workouts) categorizing follow-along video classes vs circuit-based workouts.
2. Rebuild `circuitsCopy` across all workouts with `workoutCircuits` data in `assets/workouts/`, synthesizing exercises, sets, reps, timed intervals, and linking with `exercises.json` animated GIFs.
3. Update workout player UI to clearly badge video role (Full-Length Workout Video vs Guided Cooldown Video) and display full interactive circuit breakdowns.
