/**
 * Menovation Offline Application Logic
 * Integrates offline authentication, local workout browsing, symptom tracking,
 * and outbox mutation sync.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // UI Elements
  const statusBadge = document.getElementById('networkStatusBadge');
  const statusText = document.getElementById('statusText');
  const offlineBanner = document.getElementById('offlineBanner');
  const authSection = document.getElementById('authSection');
  const dashboardSection = document.getElementById('dashboardSection');
  const loginForm = document.getElementById('loginForm');
  const offlinePinGroup = document.getElementById('offlinePinGroup');
  const userGreeting = document.getElementById('userGreeting');
  const logoutBtn = document.getElementById('logoutBtn');
  const offlineGuestBtn = document.getElementById('offlineGuestBtn');

  // Tabs
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  // Dynamic Content Containers
  const programsList = document.getElementById('programsList');
  const symptomForm = document.getElementById('symptomForm');
  const symptomHistory = document.getElementById('symptomHistory');
  const educationList = document.getElementById('educationList');
  const syncTableBody = document.getElementById('syncTableBody');
  const syncNowBtn = document.getElementById('syncNowBtn');
  const syncCountBadge = document.getElementById('syncCountBadge');

  let currentUser = null;
  let cachedData = {
    programs: null,
    exercises: null,
    articles: null
  };

  // --- 1. Network Liveness Handling ---
  function updateNetworkStatus() {
    const isOnline = navigator.onLine;
    if (isOnline) {
      statusBadge.className = 'network-status-badge online';
      statusText.textContent = 'Online';
      offlineBanner.classList.add('hidden');
      offlinePinGroup.style.display = 'none';
      document.getElementById('onlineFields').style.display = 'block';
    } else {
      statusBadge.className = 'network-status-badge offline';
      statusText.textContent = 'Offline Mode';
      offlineBanner.classList.remove('hidden');
      offlinePinGroup.style.display = 'block';
      document.getElementById('onlineFields').style.display = 'none';
    }
  }

  window.addEventListener('online', () => {
    updateNetworkStatus();
    attemptSync();
  });
  window.addEventListener('offline', updateNetworkStatus);
  updateNetworkStatus();

  // --- 2. Session & Authentication Management ---
  async function checkSession() {
    const session = await window.mvnDB.get('user_profile', 'current_session');
    if (session && session.isLoggedIn) {
      currentUser = session;
      showDashboard();
    } else {
      showAuth();
    }
  }

  function showDashboard() {
    authSection.style.display = 'none';
    dashboardSection.style.display = 'block';
    userGreeting.textContent = currentUser ? `Welcome, ${currentUser.name}` : 'Welcome, Member';
    loadWorkoutsTab();
    loadSymptomHistory();
    loadEducationTab();
    refreshSyncQueue();
  }

  function showAuth() {
    authSection.style.display = 'block';
    dashboardSection.style.display = 'none';
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (navigator.onLine) {
      // Online login flow
      const email = document.getElementById('user_login').value.trim();
      currentUser = {
        id: 'current_session',
        email: email || 'member@menovation.com',
        name: email ? email.split('@')[0] : 'Menovation Member',
        token: 'mock_jwt_token_' + Date.now(),
        pinHash: '1234', // Default offline PIN: 1234
        isLoggedIn: true,
        lastOnlineLogin: new Date().toISOString()
      };
      await window.mvnDB.put('user_profile', currentUser);
      showDashboard();
    } else {
      // Offline PIN unlock flow
      const pin = document.getElementById('offline_pin').value.trim();
      const stored = await window.mvnDB.get('user_profile', 'current_session');
      
      if (!stored || stored.pinHash === pin || pin === '1234') {
        currentUser = stored || {
          id: 'current_session',
          email: 'offline_member@menovation.com',
          name: 'Offline Member',
          isLoggedIn: true,
          offlineOnly: true
        };
        showDashboard();
      } else {
        alert('Incorrect Offline PIN. Use default "1234" or login while online first.');
      }
    }
  });

  offlineGuestBtn.addEventListener('click', async () => {
    currentUser = {
      id: 'current_session',
      name: 'Offline Guest',
      isLoggedIn: true,
      offlineOnly: true
    };
    await window.mvnDB.put('user_profile', currentUser);
    showDashboard();
  });

  logoutBtn.addEventListener('click', async () => {
    await window.mvnDB.delete('user_profile', 'current_session');
    currentUser = null;
    showAuth();
  });

  // --- 3. Tab Switching ---
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.style.display = 'none');

      btn.classList.add('active');
      const targetPane = document.getElementById(btn.dataset.target);
      if (targetPane) targetPane.style.display = 'block';
    });
  });

  // --- 4. Workouts & Programs Tab ---
  async function loadWorkoutsTab() {
    if (!cachedData.programs) {
      try {
        const resp = await fetch('assets/data/programs.json');
        cachedData.programs = await resp.json();
      } catch (err) {
        console.warn('Could not load programs from assets/data/, using fallback', err);
      }
    }

    if (programsList) {
      programsList.innerHTML = '';
      if (cachedData.programs) {
        const programIds = Object.keys(cachedData.programs).slice(0, 6);
        programIds.forEach(id => {
          const p = cachedData.programs[id];
          const info = p.basicInfo || {};
          const card = document.createElement('div');
          card.className = 'card';
          card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.75rem;">
              <span class="badge badge-purple">Offline Available</span>
              <span class="badge badge-sand">Program</span>
            </div>
            <h3 class="card-title">${info.programTitle || 'Menovation Routine'}</h3>
            <p style="color:var(--mvn-gray-600); font-size:0.9rem; margin-bottom:1.25rem;">
              Customized perimenopause strength, pelvic floor balance, and joint mobility.
            </p>
            <button class="btn btn-secondary" onclick="alert('Starting routine: ${info.programTitle} (100% offline!)')">
              Start Workout Now
            </button>
          `;
          programsList.appendChild(card);
        });
      }
    }
  }

  // --- 5. Symptom Tracker & Mutation Queue ---
  // Range sliders live value update
  document.querySelectorAll('input[type="range"]').forEach(slider => {
    const valDisplay = document.getElementById(slider.id + 'Val');
    slider.addEventListener('input', () => {
      if (valDisplay) valDisplay.textContent = slider.value;
    });
  });

  symptomForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const hotFlashes = parseInt(document.getElementById('hotFlashes').value);
    const sleepQuality = parseInt(document.getElementById('sleepQuality').value);
    const moodScore = parseInt(document.getElementById('moodScore').value);
    const brainFog = parseInt(document.getElementById('brainFog').value);
    const notes = document.getElementById('symptomNotes').value.trim();

    const record = {
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      hotFlashes,
      sleepQuality,
      moodScore,
      brainFog,
      notes
    };

    // 1. Save locally to IndexedDB
    await window.mvnDB.put('symptom_logs', record);

    // 2. Queue mutation into outbox for syncing to WP REST API
    await window.mvnDB.queueMutation('/wp-json/mvn-app/v1/symptoms', 'PUT', {
      logDate: record.date,
      hotFlashes,
      sleepQuality,
      moodScore,
      brainFog,
      notes
    });

    alert('Symptom entry saved locally to device!');
    document.getElementById('symptomNotes').value = '';
    loadSymptomHistory();
    refreshSyncQueue();

    if (navigator.onLine) {
      attemptSync();
    }
  });

  async function loadSymptomHistory() {
    const logs = await window.mvnDB.getAll('symptom_logs');
    if (!symptomHistory) return;

    if (logs.length === 0) {
      symptomHistory.innerHTML = '<p style="color:var(--mvn-gray-600); font-style:italic;">No symptom entries recorded yet.</p>';
      return;
    }

    symptomHistory.innerHTML = logs.slice(-5).reverse().map(l => `
      <div style="background:var(--mvn-light-cream); border:1px solid var(--mvn-sand); border-radius:8px; padding:0.85rem; margin-bottom:0.75rem;">
        <div style="display:flex; justify-content:space-between; margin-bottom:0.4rem; font-weight:700; color:var(--mvn-purple); font-size:0.9rem;">
          <span>${l.date}</span>
          <span style="font-size:0.75rem; color:var(--mvn-gray-600);">${new Date(l.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
        </div>
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap; font-size:0.85rem; margin-bottom:0.3rem;">
          <span class="badge badge-sand">Hot Flashes: ${l.hotFlashes}/5</span>
          <span class="badge badge-sand">Sleep: ${l.sleepQuality}/5</span>
          <span class="badge badge-sand">Mood: ${l.moodScore}/5</span>
          <span class="badge badge-sand">Fog: ${l.brainFog}/5</span>
        </div>
        ${l.notes ? `<p style="font-size:0.85rem; color:var(--mvn-dark);">${l.notes}</p>` : ''}
      </div>
    `).join('');
  }

  // --- 6. Education Articles Tab ---
  async function loadEducationTab() {
    if (!cachedData.articles) {
      try {
        const resp = await fetch('assets/data/health-articles.json');
        cachedData.articles = await resp.json();
      } catch (err) {
        console.warn('Could not load articles from assets/data/', err);
      }
    }

    if (educationList) {
      educationList.innerHTML = '';
      if (Array.isArray(cachedData.articles)) {
        cachedData.articles.slice(0, 6).forEach(art => {
          const card = document.createElement('div');
          card.className = 'card';
          card.innerHTML = `
            <span class="badge badge-purple" style="margin-bottom:0.5rem;">Article</span>
            <h3 class="card-title" style="font-size:1.15rem;">${art.title || art.post_title || 'Menopause Wellness Guide'}</h3>
            <p style="color:var(--mvn-gray-600); font-size:0.85rem; margin-bottom:1rem;">
              Evidence-based insight from Menovation clinicians and fitness specialists.
            </p>
            <button class="btn btn-secondary" onclick="alert('Viewing offline article: ${art.title || 'Guide'}')">Read Offline</button>
          `;
          educationList.appendChild(card);
        });
      }
    }
  }

  // --- 7. Sync Outbox Queue ---
  async function refreshSyncQueue() {
    const pending = await window.mvnDB.getPendingMutations();
    if (syncCountBadge) {
      syncCountBadge.textContent = pending.length;
      syncCountBadge.style.display = pending.length > 0 ? 'inline-block' : 'none';
    }

    if (!syncTableBody) return;

    if (pending.length === 0) {
      syncTableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center; color:var(--mvn-gray-600); padding:1.5rem;">
            All data synchronized with Menovation Cloud. No pending mutations.
          </td>
        </tr>
      `;
      return;
    }

    syncTableBody.innerHTML = pending.map(item => `
      <tr>
        <td>#${item.id}</td>
        <td><code>${item.endpoint}</code></td>
        <td><span class="badge badge-purple">${item.method}</span></td>
        <td>${new Date(item.createdAt).toLocaleTimeString()}</td>
        <td><span class="badge" style="background:#fff3cd; color:#856404;">Pending</span></td>
      </tr>
    `).join('');
  }

  async function attemptSync() {
    if (!navigator.onLine) {
      alert('Cannot sync: Device is currently offline.');
      return;
    }

    const pending = await window.mvnDB.getPendingMutations();
    if (pending.length === 0) {
      alert('Sync complete: No pending items to upload.');
      return;
    }

    // Process queued mutations
    for (const item of pending) {
      try {
        // In prototype, mark completed
        item.status = 'synced';
        item.syncedAt = new Date().toISOString();
        await window.mvnDB.put('sync_outbox', item);
      } catch (err) {
        console.error('Failed syncing mutation', item.id, err);
      }
    }

    alert(`Successfully synchronized ${pending.length} pending mutation(s)!`);
    refreshSyncQueue();
  }

  if (syncNowBtn) {
    syncNowBtn.addEventListener('click', attemptSync);
  }

  // Initial session check
  await checkSession();
});
