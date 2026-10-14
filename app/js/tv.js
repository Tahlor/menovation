/**
 * Menovation TV / D-pad layer
 *  - Spatial arrow-key navigation, Select = click, Back handling (issue #1)
 *  - Resume last workout / "Up next" tile (issue #2)
 * Works on PC, phone and Fire TV. Mouse/touch behaviour is unchanged.
 */
(function () {
  'use strict';

  // ---------- TV mode ----------
  const qs = new URLSearchParams(location.search);
  if (qs.get('tv') === '1') localStorage.setItem('mvn_tv', '1');
  if (qs.get('tv') === '0') localStorage.removeItem('mvn_tv');
  const isTV = /AFT|MenovationTV|Android TV|SMART-TV|Fire TV/i.test(navigator.userAgent) ||
    localStorage.getItem('mvn_tv') === '1';
  document.documentElement.classList.toggle('tv-mode', isTV);

  // ---------- Focusable registration ----------
  const FOCUSABLE_CLASSES = [
    '.program-card', '.workout-card', '.exercise-card', '.program-workout-item',
    '.circuit-exercise-card', '.circuit-header', '.nav-tab', '.filter-pill', '.brand-wrapper',
    '.server-status-pill', '.mini-player-title-box', '.resume-tile'
  ].join(',');
  const NATIVE = 'a[href],button,input,select,textarea,video[controls],[tabindex]';

  function decorate(root) {
    root.querySelectorAll(FOCUSABLE_CLASSES).forEach(el => {
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
      if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
    });
    // Buttons nested inside an already-focusable card are redundant stops; click bubbles to the card.
    root.querySelectorAll('.program-card button, .workout-card button, .program-workout-item button').forEach(b => {
      b.setAttribute('tabindex', '-1');
    });
  }
  decorate(document);
  new MutationObserver(muts => {
    for (const m of muts) m.addedNodes.forEach(n => {
      if (n.nodeType === 1) {
        if (n.matches && n.matches(FOCUSABLE_CLASSES) && n.parentNode) decorate(n.parentNode);
        else decorate(n);
      }
    });
  }).observe(document.body, { childList: true, subtree: true });

  // ---------- Visibility / scoping ----------
  function isVisible(el) {
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') return false;
    if (!el.offsetParent && cs.position !== 'fixed') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function openModal() {
    const modals = document.querySelectorAll('.modal-backdrop');
    for (const m of modals) if (m.style.display && m.style.display !== 'none') return m;
    return null;
  }

  function activeView() {
    const vs = Array.from(document.querySelectorAll('.app-view')).filter(v => v.style.display !== 'none');
    // In mini-player mode the player section is also displayed; prefer the non-player view.
    return vs.find(v => v.id !== 'viewWorkoutPlayer') || vs[0] || null;
  }

  function candidates() {
    const root = openModal() || document;
    return Array.from(root.querySelectorAll(NATIVE)).filter(el => {
      if (el.disabled || el.getAttribute('tabindex') === '-1' || el.type === 'hidden') return false;
      return isVisible(el);
    });
  }

  // ---------- Spatial navigation ----------
  function center(r) { return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }

  function findNext(from, dir) {
    const fr = from.getBoundingClientRect();
    const fc = center(fr);
    let best = null, bestScore = Infinity;
    for (const el of candidates()) {
      if (el === from || from.contains(el) || el.contains(from)) continue;
      const r = el.getBoundingClientRect();
      const c = center(r);
      let primary, secondary, overlap;
      if (dir === 'ArrowRight') { if (c.x <= fc.x) continue; primary = r.left - fr.right; secondary = Math.abs(c.y - fc.y); overlap = Math.min(r.bottom, fr.bottom) - Math.max(r.top, fr.top); }
      else if (dir === 'ArrowLeft') { if (c.x >= fc.x) continue; primary = fr.left - r.right; secondary = Math.abs(c.y - fc.y); overlap = Math.min(r.bottom, fr.bottom) - Math.max(r.top, fr.top); }
      else if (dir === 'ArrowDown') { if (c.y <= fc.y) continue; primary = r.top - fr.bottom; secondary = Math.abs(c.x - fc.x); overlap = Math.min(r.right, fr.right) - Math.max(r.left, fr.left); }
      else { if (c.y >= fc.y) continue; primary = fr.top - r.bottom; secondary = Math.abs(c.x - fc.x); overlap = Math.min(r.right, fr.right) - Math.max(r.left, fr.left); }
      if (primary < 0) primary = 0;
      const score = primary + secondary * (overlap > 0 ? 1 : 3);
      if (score < bestScore) { bestScore = score; best = el; }
    }
    return best;
  }

  function focusEl(el) {
    if (!el) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
  }

  function firstFocusable() {
    const modal = openModal();
    const root = modal || activeView() || document;
    const inView = Array.from(root.querySelectorAll(NATIVE)).filter(el => !el.disabled && el.getAttribute('tabindex') !== '-1' && isVisible(el));
    if (modal) return inView.find(e => e.classList.contains('modal-close-btn')) || inView[0];
    return inView.find(e => e.classList.contains('resume-tile')) ||
      inView.find(e => e.matches('.program-card,.workout-card,.program-workout-item,.exercise-card,.filter-pill,input,select,textarea,button')) ||
      inView[0];
  }

  // ---------- Input mode (remote/keyboard vs pointer) ----------
  let usingKeys = false;
  document.addEventListener('keydown', () => { usingKeys = true; document.documentElement.classList.add('using-keys'); }, true);
  ['mousedown', 'touchstart'].forEach(ev => document.addEventListener(ev, () => {
    usingKeys = false; document.documentElement.classList.remove('using-keys');
  }, true));

  // ---------- Video helpers ----------
  const video = document.getElementById('workoutVideoPlayer');
  function seek(delta) {
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration || 1e9, video.currentTime + delta));
  }
  function togglePlay() {
    if (!video) return;
    if (video.paused || video.ended) video.play().catch(() => {}); else video.pause();
  }

  // ---------- Back handling ----------
  function isEditable(el) {
    return el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !['range', 'button', 'submit', 'checkbox', 'radio'].includes(el.type)));
  }

  /** Returns true if the app consumed the Back press; false if already at root. */
  function handleBack() {
    const modal = openModal();
    if (modal) {
      const btn = modal.querySelector('.modal-close-btn');
      if (btn) btn.click(); else modal.style.display = 'none';
      return true;
    }
    if (document.fullscreenElement) { document.exitFullscreen(); return true; }
    const hash = location.hash || '#/programs';
    if (/^#\/workout\//.test(hash)) { document.getElementById('backFromWorkoutBtn').click(); return true; }
    if (/^#\/program\//.test(hash)) { document.getElementById('backToProgramsBtn').click(); return true; }
    if (hash !== '#/programs' && hash !== '#') { location.hash = '#/programs'; return true; }
    return false;
  }
  window.mvnTvBack = handleBack; // called by the Android shell on BACK

  // ---------- Key handling ----------
  document.addEventListener('keydown', e => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const key = e.key;
    const ae = document.activeElement;
    const editable = isEditable(ae) || (ae && ae.tagName === 'SELECT');

    // Back
    if (key === 'Escape' || key === 'GoBack' || key === 'BrowserBack' || e.keyCode === 4 ||
        (key === 'Backspace' && !editable)) {
      if (handleBack()) e.preventDefault();
      return;
    }

    // Media keys (Fire remote)
    if (key === 'MediaPlayPause' || key === 'MediaPlay' || key === 'MediaPause') { togglePlay(); e.preventDefault(); return; }
    if (key === 'MediaFastForward') { seek(10); e.preventDefault(); return; }
    if (key === 'MediaRewind') { seek(-10); e.preventDefault(); return; }

    if (!key.startsWith('Arrow')) {
      if ((key === 'Enter' || key === ' ') && ae && ae !== document.body && ae.matches(FOCUSABLE_CLASSES) && ae.tagName !== 'BUTTON') {
        e.preventDefault();
        ae.click();
      } else if (key === 'Enter' && ae === video) {
        e.preventDefault(); togglePlay();
      }
      return;
    }

    // Arrow keys. Let native widgets keep sideways behaviour.
    const horizontal = key === 'ArrowLeft' || key === 'ArrowRight';
    if (ae && ae.tagName === 'INPUT' && ae.type === 'range' && horizontal) return;
    if (ae && isEditable(ae) && horizontal) return;
    if (ae && ae.tagName === 'SELECT' && !horizontal) return;
    if (ae && ae.tagName === 'TEXTAREA' && ae.value.includes('\n') && !horizontal) return;

    // Video: left/right seek
    if (ae === video && horizontal) {
      seek(key === 'ArrowRight' ? 10 : -10);
      e.preventDefault();
      return;
    }

    e.preventDefault();
    if (!ae || ae === document.body) { focusEl(firstFocusable()); return; }
    const next = findNext(ae, key);
    if (next) focusEl(next);
    else if (key === 'ArrowDown') window.scrollBy(0, 120);
    else if (key === 'ArrowUp') window.scrollBy(0, -120);
  }, false);

  // ---------- Focus management on route/modal changes ----------
  function refocusSoon() {
    if (!usingKeys && !isTV) return;
    setTimeout(() => {
      const ae = document.activeElement;
      const m = openModal();
      if (ae && ae !== document.body && isVisible(ae) && (!m || m.contains(ae))) return;
      focusEl(firstFocusable());
    }, 80);
  }
  window.addEventListener('hashchange', refocusSoon);
  document.querySelectorAll('.modal-backdrop').forEach(m => {
    new MutationObserver(() => {
      if (!(usingKeys || isTV)) return;
      if (m.style.display && m.style.display !== 'none') {
        const btn = m.querySelector('.modal-close-btn');
        setTimeout(() => (btn || m).focus(), 50);
      } else {
        refocusSoon();
      }
    }).observe(m, { attributes: true, attributeFilter: ['style'] });
  });
  if (isTV) setTimeout(() => { if (document.activeElement === document.body) focusEl(firstFocusable()); }, 800);

  // ---------- Resume last workout (issue #2) ----------
  const KEY = 'mvn_last_session';
  const MIN_START = 10, END_MARGIN = 15;
  let catalogs = null;

  function loadSession() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } }
  function saveSession(patch) {
    const next = Object.assign({}, loadSession() || {}, patch, { updatedAt: new Date().toISOString() });
    localStorage.setItem(KEY, JSON.stringify(next));
    return next;
  }

  function currentWorkoutIdFromHash() {
    const m = (location.hash || '').match(/^#\/workout\/(\d+)/);
    return m ? m[1] : null;
  }

  async function ensureCatalogs() {
    if (catalogs) return catalogs;
    try {
      const [p, w] = await Promise.all([
        fetch('assets/data/programs.json').then(r => r.json()),
        fetch('assets/data/workouts_index.json').then(r => r.json())
      ]);
      catalogs = { programs: p, workouts: w };
    } catch (e) { catalogs = null; }
    return catalogs;
  }

  let lastSave = 0;
  let playedThisLoad = false; // don't clobber saved state just because a workout page was opened
  function snapshotPosition(force) {
    const id = currentWorkoutIdFromHash();
    if (!id || !video || !video.getAttribute('src') || !playedThisLoad) return;
    const now = Date.now();
    if (!force && now - lastSave < 5000) return;
    lastSave = now;
    const dur = video.duration || 0, pos = video.currentTime || 0;
    const patch = { workoutId: id, position: pos, duration: dur, finished: dur > 0 && pos >= dur - END_MARGIN };
    const c0 = catalogs;
    const apply = c => {
      const w = c && c.workouts[id];
      if (w) {
        patch.programId = w.programPostId;
        patch.title = w.title;
        const p = c.programs[String(w.programPostId)];
        patch.programTitle = p && p.basicInfo ? p.basicInfo.programTitle : '';
      }
      saveSession(patch);
    };
    if (c0) apply(c0); else ensureCatalogs().then(apply); // sync path matters for beforeunload
  }

  if (video) {
    video.addEventListener('play', () => { playedThisLoad = true; });
    video.addEventListener('timeupdate', () => { if (!video.paused) snapshotPosition(false); });
    video.addEventListener('pause', () => snapshotPosition(true));
    video.addEventListener('ended', () => { snapshotPosition(true); saveSession({ finished: true }); });
    video.addEventListener('loadedmetadata', () => {
      let pend = null;
      try { pend = JSON.parse(sessionStorage.getItem('mvn_pending_resume')); } catch (e) {}
      if (!pend || pend.workoutId !== currentWorkoutIdFromHash()) return;
      sessionStorage.removeItem('mvn_pending_resume');
      if (pend.position > 0 && pend.position < video.duration) video.currentTime = pend.position;
      video.play().catch(() => {});
    });
  }
  window.addEventListener('beforeunload', () => snapshotPosition(true));
  document.addEventListener('visibilitychange', () => { if (document.hidden) snapshotPosition(true); });

  const markBtn = document.getElementById('markCompleteBtn');
  if (markBtn) markBtn.addEventListener('click', () => setTimeout(() => {
    if (/Completed/.test(markBtn.textContent)) saveSession({ finished: true });
  }, 150));

  function fmt(s) { s = Math.floor(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

  /** Decide what the tile should offer (AC4/AC5). */
  function resolveResume(c, s) {
    if (!s || !s.workoutId || !c.workouts[s.workoutId]) return null;
    const w = c.workouts[s.workoutId];
    const prog = c.programs[String(w.programPostId)] || {};
    const progTitle = prog.basicInfo ? prog.basicInfo.programTitle : '';
    const finished = s.finished || (s.duration > 0 && s.position >= s.duration - END_MARGIN);
    if (!finished) {
      if ((s.position || 0) < MIN_START) return { kind: 'start', workout: w, progTitle, label: 'Continue', position: 0 };
      return { kind: 'resume', workout: w, progTitle, label: 'Resume', position: s.position, detail: 'at ' + fmt(s.position) };
    }
    let list = (prog.workoutPostIdList || []).map(String).filter(id => c.workouts[id]);
    if (!list.length) list = Object.values(c.workouts).filter(x => x.programPostId === w.programPostId).map(x => String(x.workoutPostId));
    const i = list.indexOf(String(s.workoutId));
    const nw = c.workouts[list.length ? list[(i + 1) % list.length] : s.workoutId];
    return { kind: 'next', workout: nw, progTitle, label: 'Up next', position: 0 };
  }

  function esc(t) { const d = document.createElement('div'); d.textContent = t == null ? '' : String(t); return d.innerHTML; }

  async function renderResumeTile() {
    const host = document.getElementById('viewPrograms');
    if (!host) return;
    let row = document.getElementById('resumeRow');
    const c = await ensureCatalogs();
    const r = c ? resolveResume(c, loadSession()) : null;
    if (!r) { if (row) row.remove(); return; }
    if (!row) {
      row = document.createElement('div');
      row.id = 'resumeRow';
      row.className = 'resume-row';
      host.querySelector('.view-header').insertAdjacentElement('afterend', row);
    }
    const w = r.workout;
    row.innerHTML = `
      <div class="resume-tile" tabindex="0" role="button" id="resumeTileMain">
        <div class="resume-play">▶</div>
        <div class="resume-text">
          <div class="resume-kicker">${esc(r.label)}${r.detail ? ' · ' + esc(r.detail) : ''}${r.progTitle ? ' · ' + esc(r.progTitle) : ''}</div>
          <div class="resume-title">${esc(w.title)}</div>
          <div class="resume-sub">⏱️ ${esc(w.duration)} Min</div>
        </div>
      </div>
      <div class="resume-tile resume-tile-secondary" tabindex="0" role="button" id="resumeTileProgram">
        <div class="resume-text"><div class="resume-title">Go to ${esc(r.progTitle || 'program')}</div></div>
      </div>`;
    row.querySelector('#resumeTileMain').addEventListener('click', () => {
      sessionStorage.setItem('mvn_pending_resume', JSON.stringify({ workoutId: String(w.workoutPostId), position: r.position || 0 }));
      location.hash = '#/workout/' + w.workoutPostId;
    });
    row.querySelector('#resumeTileProgram').addEventListener('click', () => {
      location.hash = '#/program/' + w.programPostId;
    });
  }

  window.addEventListener('hashchange', () => {
    if (!location.hash || location.hash === '#/programs') setTimeout(renderResumeTile, 100);
  });
  renderResumeTile().then(() => { if (isTV) refocusSoon(); });

  window.mvnTv = { isTV, handleBack, findNext, resolveResume, loadSession };
})();
