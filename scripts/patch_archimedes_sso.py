import sys

with open('/home/ubuntu/Projects/webapps/sso/app.py', 'r') as f:
    content = f.read()

snippet_template = '''
DEVICE_APPROVE_TEMPLATE = BASE_STYLE + """
<div class="box">
    <h2>Connect TV Device</h2>
    {% if error %}
        <div class="error">{{ error }}</div>
    {% elif success %}
        <div class="success">{{ success }}</div>
        <p style="text-align: center; color: #555;">Your TV is now signed in. You can close this tab.</p>
    {% else %}
        <p style="text-align: center; color: #555;">Approve login for <strong>{{ app_name or 'Menovation TV' }}</strong>?</p>
        <div style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 6px; padding: 12px; margin: 16px 0; text-align: center;">
            <div style="font-size: 0.85rem; color: #6c757d; text-transform: uppercase;">Device Code</div>
            <div style="font-size: 1.8rem; font-weight: bold; letter-spacing: 0.1em; color: #333;">{{ user_code }}</div>
            <div style="font-size: 0.85rem; color: #6c757d; margin-top: 4px;">Account: <strong>{{ user.username }}</strong></div>
        </div>
        <form method="POST">
            <input type="hidden" name="code" value="{{ user_code }}">
            <button type="submit" style="background-color: #770053;">Approve Device</button>
        </form>
    {% endif %}
    <div class="footer">
        <a href="/hub/">&larr; Back to Hub</a>
    </div>
</div>
"""
'''

snippet_routes = '''
# --- Device Flow for Fire TV / TV Apps ---
DEVICE_FLOW_LOCK = threading.Lock()
DEVICE_FLOW_SESSIONS = {}
DEVICE_USER_CODES = {}
DEVICE_REDEEM_TOKENS = {}
DEVICE_ALPHABET = "BCDFGHJKLMNPQRSTVWXZ"

def generate_device_user_code():
    c = "".join(secrets.choice(DEVICE_ALPHABET) for _ in range(8))
    return f"{c[:4]}-{c[4:]}"

def cleanup_expired_device_sessions():
    now = time.time()
    with DEVICE_FLOW_LOCK:
        for dc in list(DEVICE_FLOW_SESSIONS.keys()):
            if DEVICE_FLOW_SESSIONS[dc].get("expires_at", 0) < now:
                uc = DEVICE_FLOW_SESSIONS[dc].get("user_code")
                DEVICE_USER_CODES.pop(uc, None)
                DEVICE_FLOW_SESSIONS.pop(dc, None)
        for tok in list(DEVICE_REDEEM_TOKENS.keys()):
            if DEVICE_REDEEM_TOKENS[tok].get("expires_at", 0) < now:
                DEVICE_REDEEM_TOKENS.pop(tok, None)

@app.route('/sso/device/start', methods=['POST', 'OPTIONS'], strict_slashes=False)
def device_start():
    if request.method == 'OPTIONS':
        resp = make_response('', 204)
        resp.headers['Access-Control-Allow-Origin'] = '*'
        resp.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        resp.headers['Access-Control-Allow-Headers'] = 'Content-Type'
        return resp

    cleanup_expired_device_sessions()
    ttl = 600
    interval = 2
    dc = secrets.token_urlsafe(32)
    uc = generate_device_user_code()
    expires_at = time.time() + ttl

    with DEVICE_FLOW_LOCK:
        DEVICE_FLOW_SESSIONS[dc] = {
            "device_code": dc,
            "user_code": uc,
            "expires_at": expires_at,
            "status": "pending",
            "user": None,
            "redeem_token": None,
        }
        DEVICE_USER_CODES[uc] = dc

    base_url = "https://taylorarchibald.com"
    verification_uri = f"{base_url}/sso/device/approve"
    verification_uri_complete = f"{verification_uri}?code={uc}"

    resp = jsonify({
        "device_code": dc,
        "user_code": uc,
        "verification_uri": verification_uri,
        "verification_uri_complete": verification_uri_complete,
        "expires_in": ttl,
        "interval": interval,
    })
    resp.headers['Access-Control-Allow-Origin'] = '*'
    return resp

@app.route('/sso/device/poll', methods=['POST', 'OPTIONS'], strict_slashes=False)
def device_poll():
    if request.method == 'OPTIONS':
        resp = make_response('', 204)
        resp.headers['Access-Control-Allow-Origin'] = '*'
        resp.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        resp.headers['Access-Control-Allow-Headers'] = 'Content-Type'
        return resp

    data = request.get_json(silent=True) or {}
    dc = data.get("device_code")
    if not dc:
        resp = jsonify({"error": "missing device_code"})
        resp.headers['Access-Control-Allow-Origin'] = '*'
        return resp, 400

    now = time.time()
    with DEVICE_FLOW_LOCK:
        sess = DEVICE_FLOW_SESSIONS.get(dc)
        if not sess or sess.get("expires_at", 0) < now:
            resp = jsonify({"status": "expired"})
            resp.headers['Access-Control-Allow-Origin'] = '*'
            return resp

        if sess["status"] == "approved" and sess.get("redeem_token"):
            tok = sess["redeem_token"]
            sess["redeem_token"] = None
            sess["status"] = "consumed"
            resp = jsonify({"status": "approved", "redeem_token": tok})
            resp.headers['Access-Control-Allow-Origin'] = '*'
            return resp

        status = sess.get("status", "pending")
        if status == "consumed":
            status = "expired"
        resp = jsonify({"status": status})
        resp.headers['Access-Control-Allow-Origin'] = '*'
        return resp

@app.route('/sso/device/approve', methods=['GET', 'POST'], strict_slashes=False)
def device_approve():
    user = get_authenticated_sso_user()
    code = (request.args.get('code') or request.form.get('code') or '').strip().upper()

    if not user:
        return redirect(url_for('login', return_url=f"/sso/device/approve?code={code}"))

    cleanup_expired_device_sessions()
    now = time.time()

    if request.method == 'POST':
        with DEVICE_FLOW_LOCK:
            dc = DEVICE_USER_CODES.get(code)
            sess = DEVICE_FLOW_SESSIONS.get(dc) if dc else None
            if not sess or sess.get("expires_at", 0) < now or sess.get("status") != "pending":
                return render_template_string(DEVICE_APPROVE_TEMPLATE, user=user, user_code=code, error="Code is invalid or has expired.")

            redeem_tok = secrets.token_urlsafe(32)
            sess["status"] = "approved"
            sess["user_id"] = user.id
            sess["redeem_token"] = redeem_tok
            DEVICE_REDEEM_TOKENS[redeem_tok] = {
                "user_id": user.id,
                "expires_at": now + 60,
            }

        return render_template_string(DEVICE_APPROVE_TEMPLATE, user=user, user_code=code, success="Device successfully connected!")

    with DEVICE_FLOW_LOCK:
        dc = DEVICE_USER_CODES.get(code)
        sess = DEVICE_FLOW_SESSIONS.get(dc) if dc else None
        if not sess or sess.get("expires_at", 0) < now or sess.get("status") != "pending":
            return render_template_string(DEVICE_APPROVE_TEMPLATE, user=user, user_code=code, error="This device code is invalid or has expired.")

    return render_template_string(DEVICE_APPROVE_TEMPLATE, user=user, user_code=code, app_name="Menovation Fire TV")

@app.route('/sso/device/redeem', methods=['GET'], strict_slashes=False)
def device_redeem():
    tok = request.args.get('token', '').strip()
    return_url = request.args.get('return_url', '/menovation/')

    now = time.time()
    user_id = None
    with DEVICE_FLOW_LOCK:
        entry = DEVICE_REDEEM_TOKENS.pop(tok, None)
        if entry and entry.get("expires_at", 0) >= now:
            user_id = entry.get("user_id")

    if not user_id:
        return "Invalid or expired redemption token.", 400

    target_user = User.query.get(user_id)
    if not target_user or not target_user.is_active or not target_user.is_approved:
        return "User account inactive or unapproved.", 403

    token = mint_sso_jwt(target_user)
    response = make_response(redirect(return_url))
    set_sso_cookie_on_response(response, token)
    response.headers["Cache-Control"] = "no-store, no-cache, max-age=0"
    return response
'''

# Insert imports if missing
if 'import threading' not in content:
    content = 'import threading\nimport time\n' + content

# Insert template
insert_idx_tmpl = content.find('AGENT_ACCESS_TEMPLATE = BASE_STYLE +')
content = content[:insert_idx_tmpl] + snippet_template + '\n' + content[insert_idx_tmpl:]

# Insert routes before DB seeding
insert_idx_routes = content.find('# Ensure DB tables exist and policies are seeded on startup')
content = content[:insert_idx_routes] + snippet_routes + '\n\n' + content[insert_idx_routes:]

with open('/home/ubuntu/Projects/webapps/sso/app.py', 'w') as f:
    f.write(content)
print('Successfully patched app.py on Archimedes')
