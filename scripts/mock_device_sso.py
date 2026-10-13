#!/usr/bin/env python3
"""
Reference/mock implementation of the /sso/device/* contract (docs/issues/003-qr-device-login.md).

Run:   python scripts/mock_device_sso.py [port]       (default 5051)
Approve a pending code from any browser:  http://localhost:5051/sso/device/approve?code=ABCD-EFGH

This is a TEST double. The real implementation belongs in ~/Projects/webapps/SSO on Archimedes, where
`approve` must require a valid SSO session and `redeem` must mint the real SSO session cookie.
"""
import json, secrets, sys, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

TTL, INTERVAL, REDEEM_TTL = 600, 2, 60
DEVICES = {}   # device_code -> dict(user_code, expires, status, redeem_token)
REDEEMS = {}   # redeem_token -> expires
ALPHABET = "BCDFGHJKLMNPQRSTVWXZ"  # no vowels/ambiguous chars


def user_code():
    c = "".join(secrets.choice(ALPHABET) for _ in range(8))
    return c[:4] + "-" + c[4:]


class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass

    def _json(self, obj, code=200):
        b = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers(); self.wfile.write(b)

    def do_OPTIONS(self): self._json({})

    def _body(self):
        n = int(self.headers.get("Content-Length") or 0)
        try: return json.loads(self.rfile.read(n) or b"{}")
        except Exception: return {}

    def do_POST(self):
        path = urlparse(self.path).path
        host = self.headers.get("Host", "localhost")
        if path == "/sso/device/start":
            dc, uc = secrets.token_urlsafe(32), user_code()
            DEVICES[dc] = dict(user_code=uc, expires=time.time() + TTL, status="pending", redeem_token=None)
            base = f"http://{host}/sso/device/approve"
            return self._json(dict(device_code=dc, user_code=uc, verification_uri=base,
                                   verification_uri_complete=f"{base}?code={uc}", expires_in=TTL, interval=INTERVAL))
        if path == "/sso/device/poll":
            d = DEVICES.get(self._body().get("device_code"))
            if not d or time.time() > d["expires"]:
                return self._json(dict(status="expired"))
            if d["status"] == "approved" and d["redeem_token"]:
                tok, d["redeem_token"] = d["redeem_token"], None   # hand out once
                d["status"] = "consumed"
                return self._json(dict(status="approved", redeem_token=tok))
            return self._json(dict(status=d["status"] if d["status"] != "consumed" else "expired"))
        self._json(dict(error="not found"), 404)

    def do_GET(self):
        u = urlparse(self.path); q = parse_qs(u.query)
        if u.path == "/sso/device/approve":
            code = (q.get("code") or [""])[0].upper()
            for d in DEVICES.values():
                if d["user_code"] == code and d["status"] == "pending" and time.time() < d["expires"]:
                    d["status"] = "approved"
                    d["redeem_token"] = secrets.token_urlsafe(24)
                    REDEEMS[d["redeem_token"]] = time.time() + REDEEM_TTL
                    return self._html("TV approved. You can close this page.")
            return self._html("Unknown or expired code.", 404)
        if u.path == "/sso/device/redeem":
            tok = (q.get("token") or [""])[0]
            if REDEEMS.pop(tok, 0) > time.time():
                self.send_response(302)
                self.send_header("Set-Cookie", "mock_sso=1; Path=/; HttpOnly")
                self.send_header("Location", (q.get("return_url") or ["/"])[0])
                self.end_headers(); return
            return self._html("Invalid or used token.", 400)
        self._json(dict(error="not found"), 404)

    def _html(self, msg, code=200):
        b = f"<h1>{msg}</h1>".encode()
        self.send_response(code); self.send_header("Content-Type", "text/html"); self.send_header("Content-Length", str(len(b)))
        self.end_headers(); self.wfile.write(b)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5051
    print(f"mock device SSO on :{port}")
    ThreadingHTTPServer(("0.0.0.0", port), H).serve_forever()
