# #3 QR-code device login for Fire TV

Typing credentials with a remote is painful. The TV shows a QR code + short code; the user approves on a phone
that is already signed in to Universal SSO (OAuth-device-flow style).

## API contract (SSO service, `/sso/device/*`)
- `POST /sso/device/start` -> `{device_code, user_code, verification_uri, verification_uri_complete, expires_in, interval}`
- `GET|POST /sso/device/approve?code=<user_code>` (requires normal SSO session; shows "Approve this TV?" page)
- `POST /sso/device/poll {device_code}` -> `{status:"pending"|"approved"|"expired"|"denied", redeem_token?}`
- `GET /sso/device/redeem?token=<redeem_token>&return_url=/menovation/` -> sets the SSO session cookie, 302s to return_url. Single use, <=60s TTL.

## Acceptance criteria
- [ ] AC1 When the Android shell is redirected to `/sso/login`, it shows the local pairing screen instead.
- [ ] AC2 Pairing screen shows a QR (offline-generated, no network lib) of `verification_uri_complete`, the
      readable user code, and live status.
- [ ] AC3 Polls at `interval`; on `approved` the WebView navigates to `redeem` and lands logged in on /menovation/.
- [ ] AC4 Expired/denied codes auto-restart with a fresh code; network errors retry with backoff and show a message.
- [ ] AC5 Pairing page is operable by remote (Select = "New code", "Use password instead").
- [ ] AC6 Reference/mocked server `scripts/mock_device_sso.py` lets the flow be tested end-to-end without Archimedes.
- [ ] AC7 (Archimedes, tracked separately) real endpoints implemented in `~/Projects/webapps/SSO`.
