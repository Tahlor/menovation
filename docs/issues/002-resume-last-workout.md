# #2 Resume last workout / program

## Acceptance criteria
- [ ] AC1 The current workout and playback position are saved locally while playing (throttled, on pause, on leaving).
- [ ] AC2 Programs home shows a "Continue" tile (first focus target) with program title, workout title and position.
- [ ] AC3 Selecting it opens that workout, seeks to the saved position and starts playback.
- [ ] AC4 If the last workout was finished (ended or marked complete), the tile instead says "Up next" and
      points at the next workout in the same program (or the first if it was the last).
- [ ] AC5 Positions <10s or within 15s of the end count as "not started"/"finished" respectively.
- [ ] AC6 A secondary "Back to <program>" action jumps to the program detail page.
- [ ] AC7 No tile is shown on a fresh install.
- [ ] AC8 Resume state is tagged with `updatedAt` so it can later be synced via the outbox (`sync_outbox`).
