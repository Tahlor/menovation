# #1 Full D-pad / remote navigation (Web, Phone, PC, Fire TV)

Every screen must be fully operable with only Up/Down/Left/Right, Select (Enter) and Back,
which is all a Fire TV remote provides. Mouse and touch must keep working unchanged.

## Acceptance criteria
- [ ] AC1 Arrow keys move focus spatially (nearest element in that direction) across tabs, filter pills,
      program/workout/exercise cards, workout rows, circuit cards and header buttons.
- [ ] AC2 The focused element has a clearly visible focus ring (also on a 10-ft TV UI) and is scrolled into view.
- [ ] AC3 Select/Enter activates any focused card, row, pill, tab or button (same as click).
- [ ] AC4 Back (Escape / Backspace / GoBack / Android BACK) closes, in priority order: open modal,
      fullscreen, then steps up one level (player -> program/workouts, program -> programs,
      other tab -> Programs). On Programs root it does nothing (native shell exits the app).
- [ ] AC5 Open modals trap focus (arrows cannot reach the page behind) and focus the close button on open.
- [ ] AC6 Video: with the video focused, Left/Right seek -/+10s, Select toggles play/pause, Up/Down leave the video.
- [ ] AC7 Text inputs/selects/sliders keep native arrow behaviour; Up/Down leaves a text input; sliders use Left/Right.
- [ ] AC8 After a route change, focus lands on the first sensible element of the new view
      (only when the user last used the keyboard/remote, so touch UX is unaffected).
- [ ] AC9 TV mode (Fire TV user agent, `?tv=1`, or `localStorage.mvn_tv=1`) adds overscan-safe padding and larger type.
- [ ] AC10 Automated Playwright test `scripts/test_tv_navigation.py` covers AC1-AC6.
