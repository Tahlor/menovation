# Issue #3: feat: Replace Start button with Open and Preview (PiP player) buttons

**GitHub URL**: https://github.com/Tahlor/menovation/issues/3  
**Status**: Closed (Resolved)

### Problem
Program detail and workout listing views currently feature a single 'Start' button that immediately navigates the user into the workout player. Users need the ability to quickly preview workout videos in the picture-in-picture player without leaving their current browsing position.

### Scope & Solution
1. Replace 'Start' action pill in program workout items with two distinct controls:
   - 'Open': Navigates to full workout view (`#/workout/:id`)
   - 'Preview': Immediately launches workout video in floating Picture-in-Picture / mini-player with playback.
2. Add corresponding 'Preview' and 'Open' action buttons to the workout cards in the All Workouts directory.
3. Ensure fluid mini-player controls, smooth transitions, and proper video loading.
