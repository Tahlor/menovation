/**
 * Menovation Offline-First Workout Suite
 * Full offline player, programs catalog, exercise GIF library, and media server manager.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Global Data Cache
  let programsData = null;
  let workoutsIndex = null;
  let exercisesData = null;
  let currentWorkout = null;
  let currentProgram = null;

  // Media Server Configuration
  // Unicode unescaper and HTML entity cleaner
  function cleanText(str) {
    if (!str) return '';
    return String(str)
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/\\r\\n/g, '\n')
      .replace(/\\r/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/&rsquo;/g, '’')
      .replace(/&lsquo;/g, '‘')
      .replace(/&rdquo;/g, '”')
      .replace(/&ldquo;/g, '“')
      .replace(/&hellip;/g, '…')
      .replace(/&ndash;/g, '–')
      .replace(/&mdash;/g, '—')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }

  function formatParagraphs(text, className = 'program-hero-paragraph') {
    const cleaned = cleanText(text);
    if (!cleaned) return '';
    const paragraphs = cleaned.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
    if (paragraphs.length === 0) return '';
    return paragraphs.map(p => `<p class="${className}">${p.replace(/\n/g, '<br>')}</p>`).join('');
  }

  // Media Server Configuration
  const DEFAULT_PI3_URL = 'http://192.168.187.103:8085';
  const DEFAULT_ARCHIMEDES_URL = 'https://data.taylorarchibald.com/menovation';
  
  const isHttpsOrRemote = window.location.protocol === 'https:' || window.location.hostname.includes('taylorarchibald.com');
  const defaultChoice = isHttpsOrRemote ? 'archimedes' : 'pi3';

  let mediaConfig = {
    choice: localStorage.getItem('mvn_media_choice') || defaultChoice,
    customUrl: localStorage.getItem('mvn_media_custom') || ''
  };

  // If on HTTPS/Remote, never allow insecure HTTP 'pi3' which browsers block as Mixed Content
  if (isHttpsOrRemote && (mediaConfig.choice === 'pi3' || !mediaConfig.choice)) {
    mediaConfig.choice = 'archimedes';
    localStorage.setItem('mvn_media_choice', 'archimedes');
  }

  function getMediaBaseUrl() {
    if (isHttpsOrRemote) {
      if (mediaConfig.choice === 'custom' && mediaConfig.customUrl && mediaConfig.customUrl.startsWith('https://')) {
        return mediaConfig.customUrl.replace(/\/+$/, '');
      }
      // Stay on same-origin /menovation on Archimedes
      return window.location.origin + '/menovation';
    }
    if (mediaConfig.choice === 'archimedes') {
      return DEFAULT_ARCHIMEDES_URL;
    }
    if (mediaConfig.choice === 'custom' && mediaConfig.customUrl) {
      return mediaConfig.customUrl.replace(/\/+$/, '');
    }
    if (mediaConfig.choice === 'same_origin') {
      return window.location.origin;
    }
    // Default: Pi3 Local LAN
    return DEFAULT_PI3_URL;
  }

  function getVideoUrl(filename) {
    if (!filename) return '';
    const base = getMediaBaseUrl();
    return `${base}/videos/${encodeURIComponent(filename)}`;
  }

  function getGifUrl(gifFilename) {
    if (!gifFilename) return '';
    const base = getMediaBaseUrl();
    const cleanName = gifFilename.replace(/^.*[\\\/]/, '');
    return `${base}/gifs/${encodeURIComponent(cleanName)}`;
  }

  // UI Elements
  const serverStatusBadge = document.getElementById('serverStatusBadge');
  const serverStatusText = document.getElementById('serverStatusText');
  const settingsBtn = document.getElementById('settingsBtn');
  const brandLogoHome = document.getElementById('brandLogoHome');

  // Navigation Tabs & Views
  const navTabs = document.querySelectorAll('.nav-tab');
  const views = {
    viewPrograms: document.getElementById('viewPrograms'),
    viewProgramDetail: document.getElementById('viewProgramDetail'),
    viewWorkoutPlayer: document.getElementById('viewWorkoutPlayer'),
    viewWorkouts: document.getElementById('viewWorkouts'),
    viewExercises: document.getElementById('viewExercises'),
    viewDiary: document.getElementById('viewDiary')
  };

  // Video Player Elements
  const videoPlayer = document.getElementById('workoutVideoPlayer');
  const videoWrapper = document.getElementById('workoutVideoWrapper');
  const workoutVideoWrapper = videoWrapper;
  const playerControlsBar = document.getElementById('playerControlsBar') || document.querySelector('.player-controls-bar');
  const videoSourceInfo = document.getElementById('videoSourceInfo');
  const videoCurrentSourceBadge = document.getElementById('videoCurrentSourceBadge');
  const changeSourceQuickBtn = document.getElementById('changeSourceQuickBtn');
  const skipBackBtn = document.getElementById('skipBackBtn');
  const skipForwardBtn = document.getElementById('skipForwardBtn');
  const pipBtn = document.getElementById('pipBtn');
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const speedPills = document.querySelectorAll('.speed-pill');
  const markCompleteBtn = document.getElementById('markCompleteBtn');

  // Mini-Player Elements
  const miniPlayerHeader = document.getElementById('miniPlayerHeader');
  const miniPlayerTitleBox = document.getElementById('miniPlayerTitleBox');
  const miniPlayerWorkoutTitle = document.getElementById('miniPlayerWorkoutTitle');
  const miniPlayerNativePipBtn = document.getElementById('miniPlayerNativePipBtn');
  const miniPlayerExpandBtn = document.getElementById('miniPlayerExpandBtn');
  const miniPlayerCloseBtn = document.getElementById('miniPlayerCloseBtn');
  const miniPlayerControlsBar = document.getElementById('miniPlayerControlsBar');
  const miniPlayerScrubber = document.getElementById('miniPlayerScrubber');
  const miniPlayPauseBtn = document.getElementById('miniPlayPauseBtn');
  const miniPlayIcon = document.getElementById('miniPlayIcon');
  const miniPauseIcon = document.getElementById('miniPauseIcon');
  const miniSkipBackBtn = document.getElementById('miniSkipBackBtn');
  const miniSkipForwardBtn = document.getElementById('miniSkipForwardBtn');
  const miniTimeDisplay = document.getElementById('miniTimeDisplay');
  const miniVolumeBtn = document.getElementById('miniVolumeBtn');
  const miniVolumeSlider = document.getElementById('miniVolumeSlider');
  const miniVolumeHighIcon = document.getElementById('miniVolumeHighIcon');
  const miniVolumeLowIcon = document.getElementById('miniVolumeLowIcon');
  const miniVolumeMutedIcon = document.getElementById('miniVolumeMutedIcon');

  // Mini-Player State
  let isMiniPlayerActive = false;
  let isScrubbingMini = false;
  let lastUnmutedVolume = 1.0;

  // Draggable State
  let isDraggingMini = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let initialPlayerLeft = 0;
  let initialPlayerTop = 0;
  let hasDragged = false;
  let savedMiniLeft = null;
  let savedMiniTop = null;

  function clampMiniPlayerPosition() {
    if (!workoutVideoWrapper || savedMiniLeft === null || savedMiniTop === null) return;
    const rect = workoutVideoWrapper.getBoundingClientRect();
    const width = rect.width || 380;
    const height = rect.height || 260;
    const minX = 8;
    const maxX = Math.max(minX, window.innerWidth - width - 8);
    const minY = 8;
    const maxY = Math.max(minY, window.innerHeight - height - 8);

    savedMiniLeft = Math.min(Math.max(savedMiniLeft, minX), maxX);
    savedMiniTop = Math.min(Math.max(savedMiniTop, minY), maxY);

    workoutVideoWrapper.style.left = `${savedMiniLeft}px`;
    workoutVideoWrapper.style.top = `${savedMiniTop}px`;
    workoutVideoWrapper.style.right = 'auto';
    workoutVideoWrapper.style.bottom = 'auto';
  }

  function restoreMiniPlayerPosition() {
    if (!workoutVideoWrapper) return;
    if (savedMiniLeft !== null && savedMiniTop !== null) {
      clampMiniPlayerPosition();
    } else {
      workoutVideoWrapper.style.left = '';
      workoutVideoWrapper.style.top = '';
      workoutVideoWrapper.style.right = '';
      workoutVideoWrapper.style.bottom = '';
    }
  }

  function resetMiniPlayerPosition() {
    if (!workoutVideoWrapper) return;
    workoutVideoWrapper.style.left = '';
    workoutVideoWrapper.style.top = '';
    workoutVideoWrapper.style.right = '';
    workoutVideoWrapper.style.bottom = '';
  }

  function updateMiniPlayerVolumeUI() {
    if (!videoPlayer) return;
    const isMuted = videoPlayer.muted || videoPlayer.volume === 0;
    const vol = isMuted ? 0 : videoPlayer.volume;

    if (miniVolumeSlider) {
      miniVolumeSlider.value = vol;
    }

    if (miniVolumeHighIcon && miniVolumeLowIcon && miniVolumeMutedIcon) {
      if (isMuted || vol === 0) {
        miniVolumeMutedIcon.style.display = 'block';
        miniVolumeHighIcon.style.display = 'none';
        miniVolumeLowIcon.style.display = 'none';
      } else if (vol < 0.5) {
        miniVolumeLowIcon.style.display = 'block';
        miniVolumeHighIcon.style.display = 'none';
        miniVolumeMutedIcon.style.display = 'none';
      } else {
        miniVolumeHighIcon.style.display = 'block';
        miniVolumeLowIcon.style.display = 'none';
        miniVolumeMutedIcon.style.display = 'none';
      }
    }
  }

  function getNavVideoBehavior() {
    return localStorage.getItem('mvn_nav_video_behavior') || 'popout';
  }

  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  function updateMiniPlayerPlayPauseUI() {
    if (!videoPlayer) return;
    const isPaused = videoPlayer.paused || videoPlayer.ended;
    if (miniPlayIcon) miniPlayIcon.style.display = isPaused ? 'block' : 'none';
    if (miniPauseIcon) miniPauseIcon.style.display = isPaused ? 'none' : 'block';
  }

  function enterMiniPlayer() {
    if (!videoPlayer || !currentWorkout) return;
    isMiniPlayerActive = true;
    if (views.viewWorkoutPlayer) {
      views.viewWorkoutPlayer.classList.add('in-mini-mode');
      views.viewWorkoutPlayer.style.display = 'block';
    }

    videoPlayer.controls = false;
    if (miniPlayerHeader) miniPlayerHeader.style.display = 'flex';
    if (miniPlayerControlsBar) miniPlayerControlsBar.style.display = 'flex';
    if (videoSourceInfo) videoSourceInfo.style.display = 'none';

    if (miniPlayerWorkoutTitle) {
      miniPlayerWorkoutTitle.textContent = currentWorkout.title || 'Workout';
    }

    updateMiniPlayerPlayPauseUI();
    updateMiniPlayerVolumeUI();
    const cur = videoPlayer.currentTime || 0;
    const dur = videoPlayer.duration || 0;
    if (miniPlayerScrubber && dur > 0) {
      miniPlayerScrubber.value = (cur / dur) * 100;
    }
    if (miniTimeDisplay) {
      miniTimeDisplay.textContent = `${formatTime(cur)} / ${formatTime(dur)}`;
    }
    restoreMiniPlayerPosition();
  }

  function exitMiniPlayer(shouldPause = false) {
    if (shouldPause && videoPlayer) {
      videoPlayer.pause();
    }
    isMiniPlayerActive = false;
    if (views.viewWorkoutPlayer) {
      views.viewWorkoutPlayer.classList.remove('in-mini-mode');
    }
    if (videoPlayer) {
      videoPlayer.controls = true;
    }
    if (miniPlayerHeader) miniPlayerHeader.style.display = 'none';
    if (miniPlayerControlsBar) miniPlayerControlsBar.style.display = 'none';
    if (videoSourceInfo) videoSourceInfo.style.display = 'flex';
    resetMiniPlayerPosition();
  }

  function dismissMiniPlayer() {
    exitMiniPlayer(true);
    if (views.viewWorkoutPlayer) {
      views.viewWorkoutPlayer.style.display = 'none';
    }
  }

  function returnToWorkoutView() {
    if (currentWorkout) {
      navigateTo('#/workout/' + currentWorkout.workoutPostId);
    }
  }

  async function previewWorkoutInPiP(workoutId) {
    if (!workoutsIndex) return;
    const w = workoutsIndex[String(workoutId)];
    if (!w) {
      console.warn(`Workout #${workoutId} not found in index.`);
      return;
    }

    currentWorkout = w;

    const videoUrl = getVideoUrl(w.videoFilename);
    if (!videoUrl) {
      alert('No preview video available for this workout.');
      return;
    }

    if (videoPlayer.getAttribute('src') !== videoUrl) {
      videoPlayer.src = videoUrl;
    }

    // Launch into floating mini/PiP player
    enterMiniPlayer();

    if (miniPlayerWorkoutTitle) {
      const typeSuffix = w.videoType === 'cooldown' ? ' (Cooldown Flow)' : '';
      miniPlayerWorkoutTitle.textContent = `${cleanText(w.title)}${typeSuffix}`;
    }

    try {
      await videoPlayer.play();
    } catch (err) {
      console.warn('Auto-play blocked by browser policy:', err);
    }
  }

  // Modals
  const exerciseModal = document.getElementById('exerciseModal');
  const closeExerciseModalBtn = document.getElementById('closeExerciseModalBtn');
  const modalExerciseGif = document.getElementById('modalExerciseGif');
  const modalExerciseTitle = document.getElementById('modalExerciseTitle');
  const modalExerciseTags = document.getElementById('modalExerciseTags');
  const modalExerciseCues = document.getElementById('modalExerciseCues');
  const gifLoadingSpinner = document.getElementById('gifLoadingSpinner');

  const settingsModal = document.getElementById('settingsModal');
  const closeSettingsModalBtn = document.getElementById('closeSettingsModalBtn');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const testServerBtn = document.getElementById('testServerBtn');
  const testServerResult = document.getElementById('testServerResult');
  const customServerInput = document.getElementById('customServerInput');

  // Update Status Header Pill
  function updateServerBadgeDisplay() {
    const choice = mediaConfig.choice;
    if (choice === 'pi3') {
      serverStatusText.textContent = 'Pi3 LAN';
    } else if (choice === 'archimedes') {
      serverStatusText.textContent = 'Archimedes';
    } else if (choice === 'same_origin') {
      serverStatusText.textContent = 'Auto / Local';
    } else {
      serverStatusText.textContent = 'Custom Host';
    }
    if (videoCurrentSourceBadge) {
      videoCurrentSourceBadge.textContent = `Streaming from ${serverStatusText.textContent} (${getMediaBaseUrl()})`;
    }
  }
  updateServerBadgeDisplay();

  // --- 1. VIEW SWITCHING & ROUTING ---
  function showView(viewId) {
    const isVideoPlaying = videoPlayer && !videoPlayer.paused && !videoPlayer.ended && videoPlayer.currentTime > 0;
    const navBehavior = getNavVideoBehavior();

    if (viewId === 'viewWorkoutPlayer') {
      // Returning to full player
      exitMiniPlayer(false);
      Object.keys(views).forEach(key => {
        if (views[key]) {
          views[key].style.display = (key === viewId) ? 'block' : 'none';
        }
      });
    } else {
      // Navigating away from workout player
      if (navBehavior === 'pause') {
        if (videoPlayer) videoPlayer.pause();
        dismissMiniPlayer();
        Object.keys(views).forEach(key => {
          if (views[key]) {
            views[key].style.display = (key === viewId) ? 'block' : 'none';
          }
        });
      } else {
        if (isVideoPlaying || isMiniPlayerActive) {
          enterMiniPlayer();
          Object.keys(views).forEach(key => {
            if (key === 'viewWorkoutPlayer') {
              views[key].style.display = 'block';
            } else {
              views[key].style.display = (key === viewId) ? 'block' : 'none';
            }
          });
        } else {
          exitMiniPlayer(false);
          Object.keys(views).forEach(key => {
            if (views[key]) {
              views[key].style.display = (key === viewId) ? 'block' : 'none';
            }
          });
        }
      }
    }

    navTabs.forEach(tab => {
      if (tab.dataset.view === viewId) {
        tab.classList.add('active');
      } else if (viewId === 'viewProgramDetail' || viewId === 'viewWorkoutPlayer') {
        // Keep Programs tab highlighted if inside program detail/player
        if (tab.dataset.view === 'viewPrograms') tab.classList.add('active');
        else tab.classList.remove('active');
      } else {
        tab.classList.remove('active');
      }
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function navigateTo(hash) {
    if (window.location.hash === hash) {
      handleHashRouting();
    } else {
      window.location.hash = hash;
    }
  }

  async function handleHashRouting() {
    if (!programsData || !workoutsIndex) return;
    const hash = window.location.hash || '#/programs';

    // Close any open modals when navigating routes
    if (exerciseModal) exerciseModal.style.display = 'none';
    if (settingsModal) settingsModal.style.display = 'none';

    const workoutMatch = hash.match(/^#\/workout\/(\d+)$/);
    if (workoutMatch) {
      await renderWorkoutPlayerView(workoutMatch[1]);
      return;
    }

    const programMatch = hash.match(/^#\/program\/(\d+)$/);
    if (programMatch) {
      await renderProgramDetailView(programMatch[1]);
      return;
    }

    if (hash === '#/workouts') {
      showView('viewWorkouts');
      document.title = 'All Workouts | Menovation';
      return;
    }

    if (hash === '#/exercises') {
      showView('viewExercises');
      document.title = 'Exercise Library | Menovation';
      return;
    }

    if (hash === '#/diary') {
      showView('viewDiary');
      document.title = 'Wellness Diary | Menovation';
      return;
    }

    // Default: Programs view
    showView('viewPrograms');
    document.title = 'Menovation - Strength & Vitality';
  }

  window.addEventListener('hashchange', () => {
    if (programsData && workoutsIndex) {
      handleHashRouting();
    }
  });

  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetView = tab.dataset.view;
      if (targetView === 'viewPrograms') navigateTo('#/programs');
      else if (targetView === 'viewWorkouts') navigateTo('#/workouts');
      else if (targetView === 'viewExercises') navigateTo('#/exercises');
      else if (targetView === 'viewDiary') navigateTo('#/diary');
    });
  });

  brandLogoHome.addEventListener('click', () => navigateTo('#/programs'));
  document.getElementById('backToProgramsBtn').addEventListener('click', () => {
    navigateTo('#/programs');
  });
  document.getElementById('backFromWorkoutBtn').addEventListener('click', () => {
    if (currentWorkout && currentWorkout.programPostId) {
      navigateTo('#/program/' + currentWorkout.programPostId);
    } else {
      navigateTo('#/workouts');
    }
  });

  // Resilient JSON fetch with exponential backoff
  async function fetchWithRetry(url, maxRetries = 4, baseDelayMs = 400) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return await resp.json();
      } catch (err) {
        if (attempt === maxRetries - 1) throw err;
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise(res => setTimeout(res, delay));
      }
    }
  }

  // --- USER DATA SERVER SYNC (Archimedes / SSO) ---
  const USER_DATA_ENDPOINT = '/sso/menovation/user-data';
  let syncUpTimeout = null;

  async function syncUserDataFromServer() {
    try {
      const resp = await fetch(USER_DATA_ENDPOINT, { credentials: 'include' });
      if (!resp.ok) return;
      const data = await resp.json();
      if (!data) return;

      const serverUser = data.username || null;
      const lastUser = localStorage.getItem('mvn_synced_user');

      // If user switched on same device, clear previous user's local caches
      if (serverUser && lastUser && lastUser !== serverUser) {
        console.log(`[UserSync] Switching user from ${lastUser} to ${serverUser}, refreshing local data`);
        await window.mvnDB.clear('completed_workouts');
        await window.mvnDB.clear('symptom_logs');
        localStorage.removeItem('mvn_last_session');
      }
      if (serverUser) {
        localStorage.setItem('mvn_synced_user', serverUser);
      }

      // 1. Completed Workouts
      let hasNewCompleted = false;
      if (Array.isArray(data.completedWorkouts)) {
        const local = await window.mvnDB.getAll('completed_workouts');
        const localMap = new Map(local.map(w => [String(w.workoutId), w]));
        for (const item of data.completedWorkouts) {
          if (!localMap.has(String(item.workoutId))) {
            await window.mvnDB.put('completed_workouts', item);
            hasNewCompleted = true;
          }
        }
      }

      // 2. Diary Logs
      let hasNewDiary = false;
      if (Array.isArray(data.diary)) {
        const localLogs = await window.mvnDB.getAll('symptom_logs');
        const localTimestamps = new Set(localLogs.map(l => l.createdAt || l.date));
        for (const log of data.diary) {
          const key = log.createdAt || log.date;
          if (!localTimestamps.has(key)) {
            await window.mvnDB.put('symptom_logs', log);
            hasNewDiary = true;
          }
        }
      }

      // 3. Resume State
      if (data.resume && data.resume.updatedAt) {
        try {
          const localResume = JSON.parse(localStorage.getItem('mvn_last_session'));
          if (!localResume || !localResume.updatedAt || new Date(data.resume.updatedAt) > new Date(localResume.updatedAt)) {
            localStorage.setItem('mvn_last_session', JSON.stringify(data.resume));
            if (window.mvnRenderResumeTile) window.mvnRenderResumeTile();
          }
        } catch (_) {}
      }

      // Refresh views if new data was synced from server
      if (hasNewCompleted) renderAllWorkoutsList();
      if (hasNewDiary) loadDiaryHistory();

      // Ensure server has any items that were only recorded locally (e.g. while offline)
      pushUserDataToServer();
    } catch (_) {
      // Offline or server not ready - graceful fallback
    }
  }

  async function pushUserDataToServer() {
    try {
      const [completed, diary] = await Promise.all([
        window.mvnDB.getAll('completed_workouts'),
        window.mvnDB.getAll('symptom_logs')
      ]);
      let resume = null;
      try { resume = JSON.parse(localStorage.getItem('mvn_last_session')); } catch (_) {}

      await fetch(USER_DATA_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          updatedAt: new Date().toISOString(),
          completedWorkouts: completed,
          diary: diary,
          resume: resume
        })
      });
    } catch (_) {
      // Offline fallback
    }
  }

  window.mvnPushUserData = pushUserDataToServer;
  window.mvnSyncUpDebounced = function() {
    if (syncUpTimeout) clearTimeout(syncUpTimeout);
    syncUpTimeout = setTimeout(pushUserDataToServer, 2000);
  };

  // --- 2. DATA FETCHING ---
  async function loadInitialData() {
    try {
      const [programsResp, workoutsResp, exercisesResp] = await Promise.all([
        fetchWithRetry('assets/data/programs.json'),
        fetchWithRetry('assets/data/workouts_index.json'),
        fetchWithRetry('assets/data/exercises.json').catch(() => ({}))
      ]);

      programsData = programsResp;
      workoutsIndex = workoutsResp;
      exercisesData = exercisesResp;

      renderProgramsList('all');
      renderAllWorkoutsList();
      renderExerciseLibrary('all');
      loadDiaryHistory();

      // Dispatch route from initial URL hash
      await handleHashRouting();

      // Seamlessly sync user state (completed workouts, diary, resume) from Archimedes SSO
      await syncUserDataFromServer();
    } catch (err) {
      console.error('Failed to load local app data catalogs:', err);
    }
  }

  // --- 3. PROGRAMS VIEW LOGIC ---
  const PROGRAM_CATEGORIES = {
    strength: [782, 841, 5561, 5895, 6217],
    pilates: [898, 904, 910],
    mam: [874, 916, 2674, 5473, 6209],
    yoga: [862, 892, 5795, 5802, 5810],
    pelvic: [5397, 5806],
    meditation: [5417]
  };

  function getProgramCategory(pid) {
    const id = parseInt(pid);
    for (const [cat, ids] of Object.entries(PROGRAM_CATEGORIES)) {
      if (ids.includes(id)) return cat;
    }
    return 'general';
  }

  function renderProgramsList(selectedCat) {
    const grid = document.getElementById('programsGrid');
    if (!grid || !programsData) return;
    grid.innerHTML = '';

    const programIds = Object.keys(programsData);
    
    programIds.forEach(pid => {
      const p = programsData[pid];
      const info = p.basicInfo || {};
      const copy = p.copy || {};
      const cat = getProgramCategory(pid);

      if (selectedCat !== 'all' && cat !== selectedCat) {
        return;
      }

      // Count workouts in index
      const wlist = p.workoutPostIdList || [];
      let workoutCount = wlist.length;
      if (workoutCount === 0 && workoutsIndex) {
        workoutCount = Object.values(workoutsIndex).filter(w => w.programPostId === parseInt(pid)).length;
      }

      const card = document.createElement('div');
      card.className = 'program-card';
      const imgSrc = p.assets && p.assets.programCardImageUrl ? p.assets.programCardImageUrl : 'assets/images/menovation-site-cover.webp';

      const cleanTitle = cleanText(info.programTitle) || ('Program ' + pid);
      const cleanTagline = cleanText(copy.programTaglineCopy || copy.programOverviewCopy || 'Designed for midlife strength and vitality.');

      card.innerHTML = `
        <div class="program-card-thumb-wrapper">
          <img src="${imgSrc}" alt="${cleanTitle}" class="program-card-img" loading="lazy">
          <span class="program-card-badge">${workoutCount} Workouts</span>
        </div>
        <div class="program-card-body">
          <h3 class="program-card-title">${cleanTitle}</h3>
          <p class="program-card-tagline">${cleanTagline}</p>
          <div class="program-meta-row">
            <span>⏱️ ${info.workoutDurationLowerBound || 20}–${info.workoutDurationUpperBound || 35} Min</span>
            <span class="badge badge-purple">${copy.marketingSummaryLineCopy ? cleanText(copy.marketingSummaryLineCopy.split('•')[1] || 'All Levels') : 'All Levels'}</span>
          </div>
          <button class="btn btn-primary" style="width: 100%; margin-top: auto;">
            Explore Program &rarr;
          </button>
        </div>
      `;

      card.addEventListener('click', () => navigateTo('#/program/' + pid));
      grid.appendChild(card);
    });
  }

  // Program Category Filter Pills
  document.querySelectorAll('#programCategoryPills .filter-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#programCategoryPills .filter-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderProgramsList(btn.dataset.category);
    });
  });

  // --- 4. PROGRAM DETAIL VIEW ---
  function openProgramDetail(pid) {
    navigateTo('#/program/' + pid);
  }

  async function renderProgramDetailView(pid) {
    currentProgram = programsData[pid];
    if (!currentProgram) return;

    const info = currentProgram.basicInfo || {};
    const copy = currentProgram.copy || {};
    const heroCard = document.getElementById('programHeroCard');
    const workoutsListContainer = document.getElementById('programWorkoutsList');
    const workoutCountBadge = document.getElementById('programWorkoutCount');

    const cleanTitle = cleanText(info.programTitle) || ('Program ' + pid);
    const cleanTagline = cleanText(copy.programTaglineCopy) || 'Full Program Schedule';
    const overviewHtml = formatParagraphs(copy.programOverviewCopy || 'Designed for midlife strength and vitality.');

    document.title = `${cleanTitle} | Menovation`;

    // Get completed workouts set
    const completedSet = new Set((await window.mvnDB.getAll('completed_workouts')).map(c => String(c.workoutId)));

    // Find all workouts for this program
    let programWorkouts = [];
    const wlist = currentProgram.workoutPostIdList || [];
    if (wlist.length > 0) {
      programWorkouts = wlist.map(wid => workoutsIndex[String(wid)]).filter(Boolean);
    }
    if (programWorkouts.length === 0 && workoutsIndex) {
      programWorkouts = Object.values(workoutsIndex).filter(w => w.programPostId === parseInt(pid));
    }

    // Difficulty tracks for tiered programs (e.g. Power Builder 6217 and Glute Builder 5895)
    const beginnerList = (currentProgram.workoutPostIdBeginnerList || []).map(wid => workoutsIndex[String(wid)]).filter(Boolean);
    const intermediateList = (currentProgram.workoutPostIdIntermediateList || []).map(wid => workoutsIndex[String(wid)]).filter(Boolean);
    const advancedList = (currentProgram.workoutPostIdAdvancedList || []).map(wid => workoutsIndex[String(wid)]).filter(Boolean);
    const hasDifficultyTracks = (beginnerList.length > 0 || intermediateList.length > 0 || advancedList.length > 0);

    const trackPillsRow = document.getElementById('programTrackPillsRow');
    let activeTrack = 'beginner';

    function getActiveTrackWorkouts(track) {
      if (!hasDifficultyTracks) return programWorkouts;
      if (track === 'beginner') return beginnerList;
      if (track === 'intermediate') return intermediateList;
      if (track === 'advanced') return advancedList;
      return programWorkouts; // all
    }

    function renderWorkoutPlaylist(workoutsToRender, trackLabel) {
      workoutCountBadge.textContent = `${workoutsToRender.length} Workouts${trackLabel ? ` (${trackLabel})` : ''}`;
      workoutsListContainer.innerHTML = '';

      workoutsToRender.forEach((w, index) => {
        const isDone = completedSet.has(String(w.workoutPostId));
        const row = document.createElement('div');
        row.className = 'program-workout-item';
        const cleanWTitle = cleanText(w.title);
        const isCooldown = w.videoType === 'cooldown';
        const videoBadgeText = isCooldown ? 'Guided Cooldown Flow' : 'Full Video Class';

        row.innerHTML = `
          <div class="workout-item-left">
            <div class="workout-order-circle ${isDone ? 'completed' : ''}">
              ${isDone ? '✓' : index + 1}
            </div>
            <div class="workout-item-text">
              <div class="workout-item-title">${cleanWTitle}</div>
              <div class="workout-item-subtitle">
                <span>⏱️ ${w.duration} Min &bull; ${cleanText(w.videoCategory) || 'Workout'}</span>
                <span class="badge ${isCooldown ? 'badge-sand' : 'badge-purple'} badge-xs">${videoBadgeText}</span>
              </div>
            </div>
          </div>
          <div class="workout-action-group">
            <button class="workout-action-btn workout-preview-btn" data-workout-id="${w.workoutPostId}" title="Preview ${isCooldown ? 'cooldown flow' : 'video'} in Picture-in-Picture mini player">
              ▶ Preview
            </button>
            <button class="workout-action-btn workout-open-btn ${isDone ? 'completed' : ''}" data-workout-id="${w.workoutPostId}" title="Open full workout details & circuits">
              ${isDone ? 'Replay' : 'Open'} &rarr;
            </button>
          </div>
        `;

        const previewBtn = row.querySelector('.workout-preview-btn');
        if (previewBtn) {
          previewBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            previewWorkoutInPiP(w.workoutPostId);
          });
        }

        const openBtn = row.querySelector('.workout-open-btn');
        if (openBtn) {
          openBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            navigateTo('#/workout/' + w.workoutPostId);
          });
        }

        row.addEventListener('click', () => navigateTo('#/workout/' + w.workoutPostId));
        workoutsListContainer.appendChild(row);
      });
    }

    const bannerImg = currentProgram.assets && currentProgram.assets.featureCardImageUrl ? currentProgram.assets.featureCardImageUrl : 'assets/images/menovation-site-cover.webp';
    const equipmentItems = (info.equipmentList || []).map(eq => `<span class="equipment-chip">⚡ ${cleanText(eq.itemTitle)}</span>`).join('');

    heroCard.innerHTML = `
      <img src="${bannerImg}" alt="${cleanTitle}" class="program-hero-banner" loading="lazy">
      <div class="program-hero-content">
        <h1>${cleanTitle}</h1>
        <div class="program-hero-meta">
          <span class="badge badge-purple">${cleanTagline}</span>
          <span class="badge badge-sand">⏱️ ${info.workoutDurationLowerBound || 20}&ndash;${info.workoutDurationUpperBound || 35} Min / Session</span>
        </div>
        <div class="program-hero-desc">${overviewHtml}</div>
        ${equipmentItems ? `
          <div>
            <strong>Required Equipment:</strong>
            <div class="equipment-chips">${equipmentItems}</div>
          </div>
        ` : ''}
      </div>
    `;

    // Render Track Filter Pills and Workout Playlist
    if (hasDifficultyTracks && trackPillsRow) {
      trackPillsRow.style.display = 'flex';
      trackPillsRow.innerHTML = `
        <button class="filter-pill ${activeTrack === 'beginner' ? 'active' : ''}" data-track="beginner">Beginner (${beginnerList.length})</button>
        <button class="filter-pill ${activeTrack === 'intermediate' ? 'active' : ''}" data-track="intermediate">Intermediate (${intermediateList.length})</button>
        <button class="filter-pill ${activeTrack === 'advanced' ? 'active' : ''}" data-track="advanced">Advanced (${advancedList.length})</button>
        <button class="filter-pill ${activeTrack === 'all' ? 'active' : ''}" data-track="all">All (${programWorkouts.length})</button>
      `;

      trackPillsRow.querySelectorAll('.filter-pill').forEach(btn => {
        btn.addEventListener('click', () => {
          trackPillsRow.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          activeTrack = btn.dataset.track;
          const trackLabel = activeTrack === 'all' ? 'All Tiers' : activeTrack.charAt(0).toUpperCase() + activeTrack.slice(1) + ' Track';
          renderWorkoutPlaylist(getActiveTrackWorkouts(activeTrack), trackLabel);
        });
      });

      renderWorkoutPlaylist(beginnerList, 'Beginner Track');
    } else {
      if (trackPillsRow) trackPillsRow.style.display = 'none';
      renderWorkoutPlaylist(programWorkouts, null);
    }

    showView('viewProgramDetail');
  }

  // --- 5. WORKOUT PLAYER VIEW ---
  function openWorkoutPlayer(workoutId) {
    navigateTo('#/workout/' + workoutId);
  }

  async function renderWorkoutPlayerView(workoutId) {
    console.log('[DEBUG] renderWorkoutPlayerView called with workoutId:', workoutId);

    // If already watching this workout in mini-player mode, seamlessly expand back to full mode
    const isSameWorkout = currentWorkout && String(currentWorkout.workoutPostId) === String(workoutId);
    if (isSameWorkout && isMiniPlayerActive) {
      exitMiniPlayer(false); // don't pause!
      showView('viewWorkoutPlayer');
      return;
    }

    currentWorkout = workoutsIndex ? workoutsIndex[String(workoutId)] : null;
    console.log('[DEBUG] currentWorkout found:', currentWorkout ? currentWorkout.title : 'NOT FOUND');
    if (!currentWorkout) {
      console.warn(`Workout #${workoutId} details not found in index.`);
      showView('viewWorkouts');
      return;
    }

    document.title = `${currentWorkout.title} | Menovation`;

    showView('viewWorkoutPlayer');

    const titleEl = document.getElementById('playerWorkoutTitle');
    const programBadge = document.getElementById('playerProgramBadge');
    const durationChip = document.getElementById('playerDurationChip');
    const diffChip = document.getElementById('playerDifficultyChip');
    const focusChip = document.getElementById('playerFocusChip');
    const theWhyCard = document.getElementById('playerTheWhyCard');
    const theWhyText = document.getElementById('playerTheWhyText');
    const equipChips = document.getElementById('playerEquipmentChips');
    const circuitsContainer = document.getElementById('playerCircuitsContainer');

    const cleanTitle = cleanText(currentWorkout.title);
    titleEl.textContent = cleanTitle;
    durationChip.textContent = `⏱️ ${currentWorkout.duration} Minutes`;
    diffChip.textContent = cleanText(currentWorkout.videoCategory) || 'All Levels';
    focusChip.textContent = currentWorkout.focus ? `Focus: Type ${currentWorkout.focus}` : 'Full Body';

    // Set program title
    const prog = programsData && programsData[String(currentWorkout.programPostId)];
    programBadge.textContent = prog ? (prog.basicInfo && prog.basicInfo.programTitle ? cleanText(prog.basicInfo.programTitle) : 'Program') : 'Menovation';

    // Workout Format & Cooldown Video Notice
    const isCooldown = currentWorkout.videoType === 'cooldown';
    const playerView = document.getElementById('viewWorkoutPlayer');
    if (playerView) {
      if (isCooldown) {
        playerView.classList.add('is-circuit-workout');
      } else {
        playerView.classList.remove('is-circuit-workout');
      }
    }

    const formatNotice = document.getElementById('playerWorkoutFormatNotice');
    if (formatNotice) {
      if (isCooldown) {
        formatNotice.style.display = 'block';
        formatNotice.innerHTML = `
          <div class="circuit-format-banner">
            <div class="banner-icon">⚡</div>
            <div class="banner-content">
              <strong>Structured Circuit Workout &bull; Guided Cooldown Video Flow</strong>
              <p>Perform the targeted exercises, sets, reps, and timed intervals listed below. Your guided cooldown flow video is embedded at Part 7 to conclude your session.</p>
              <div class="circuit-format-banner-actions">
                <button class="btn btn-sm btn-primary" id="bannerStartRunnerBtn">
                  ⚡ Start Interactive Circuit Mode &rarr;
                </button>
                <button class="btn btn-sm btn-purple" id="bannerJumpCooldownBtn">
                  🧘 Jump to Cooldown Video &darr;
                </button>
                <button class="btn btn-sm btn-secondary" id="bannerPreviewPipBtn">
                  ▶ Preview in Floating Mini-Player
                </button>
              </div>
            </div>
          </div>
        `;
        const startRunnerBannerBtn = formatNotice.querySelector('#bannerStartRunnerBtn');
        if (startRunnerBannerBtn) {
          startRunnerBannerBtn.addEventListener('click', () => {
            openCircuitRunner(currentWorkout);
          });
        }
        const jumpBtn = formatNotice.querySelector('#bannerJumpCooldownBtn');
        if (jumpBtn) {
          jumpBtn.addEventListener('click', () => {
            const target = document.getElementById('cooldownSection') || document.getElementById('cooldownVideoAnchor') || videoWrapper;
            if (target) {
              target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          });
        }
        const previewPipBtn = formatNotice.querySelector('#bannerPreviewPipBtn');
        if (previewPipBtn) {
          previewPipBtn.addEventListener('click', () => {
            previewWorkoutInPiP(currentWorkout.workoutPostId);
          });
        }
      } else {
        formatNotice.style.display = 'none';
        formatNotice.innerHTML = '';
      }
    }

    // The Why
    if (currentWorkout.theWhy) {
      theWhyCard.style.display = 'block';
      const cleanedWhy = cleanText(currentWorkout.theWhy);
      const paragraphs = cleanedWhy.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
      theWhyText.innerHTML = paragraphs.map(p => `<p class="the-why-paragraph">${p.replace(/\n/g, ' ')}</p>`).join('');
    } else {
      theWhyCard.style.display = 'none';
    }

    // Equipment
    equipChips.innerHTML = '';
    const eqList = currentWorkout.equipment || [];
    if (eqList.length > 0) {
      eqList.forEach(eq => {
        const chip = document.createElement('span');
        chip.className = 'equipment-chip';
        chip.textContent = `⚡ ${cleanText(eq.itemTitle)}`;
        equipChips.appendChild(chip);
      });
    } else {
      equipChips.innerHTML = '<span class="equipment-chip">No special equipment required</span>';
    }

    // Anchor Video Player depending on workout type
    const topAnchor = document.getElementById('topVideoAnchor');
    const startRunnerHeaderBtn = document.getElementById('startCircuitRunnerBtn');

    // Safely park video player and controls back to topAnchor if currently docked in circuits
    if (topAnchor && videoWrapper && videoWrapper.parentElement !== topAnchor) {
      topAnchor.appendChild(videoWrapper);
      if (playerControlsBar) topAnchor.appendChild(playerControlsBar);
    }

    // Parse and render circuits
    circuitsContainer.innerHTML = '';
    if (currentWorkout.circuits && currentWorkout.circuits.length > 0) {
      renderStructuredCircuits(currentWorkout.circuits, circuitsContainer);
    } else if (currentWorkout.circuitsCopy) {
      renderCircuitBreakdown(currentWorkout.circuitsCopy, circuitsContainer);
    } else {
      circuitsContainer.innerHTML = '<p style="color:var(--mvn-gray-600); font-style:italic;">Follow along directly with the full-length video coach.</p>';
    }

    const cooldownAnchor = document.getElementById('cooldownVideoAnchor');

    if (isCooldown) {
      if (startRunnerHeaderBtn) {
        startRunnerHeaderBtn.style.display = 'inline-flex';
        startRunnerHeaderBtn.onclick = () => openCircuitRunner(currentWorkout);
      }
      if (cooldownAnchor && videoWrapper) {
        cooldownAnchor.appendChild(videoWrapper);
        if (playerControlsBar) cooldownAnchor.appendChild(playerControlsBar);
        videoWrapper.style.display = 'block';
        if (playerControlsBar) playerControlsBar.style.display = 'flex';
      }
    } else {
      if (startRunnerHeaderBtn) startRunnerHeaderBtn.style.display = 'none';
      if (topAnchor && videoWrapper) {
        topAnchor.appendChild(videoWrapper);
        if (playerControlsBar) topAnchor.appendChild(playerControlsBar);
        videoWrapper.style.display = 'block';
        if (playerControlsBar) playerControlsBar.style.display = 'flex';
      }
    }

    // Completion state
    const isCompleted = await window.mvnDB.get('completed_workouts', String(workoutId));
    updateCompletionButtonUI(Boolean(isCompleted));

    // Video Stream URL
    const videoUrl = getVideoUrl(currentWorkout.videoFilename);
    updateServerBadgeDisplay();

    if (videoCurrentSourceBadge) {
      const serverChoiceText = serverStatusText ? serverStatusText.textContent : 'Pi3';
      const roleLabel = isCooldown ? 'Guided Cooldown Flow' : 'Full-Length Video Class';
      videoCurrentSourceBadge.textContent = `${roleLabel} • Streaming from ${serverChoiceText} (${getMediaBaseUrl()})`;
    }

    if (videoPlayer.getAttribute('src') !== videoUrl) {
      videoPlayer.pause();
      videoPlayer.src = videoUrl;
    }

    showView('viewWorkoutPlayer');
  }

  function updateCompletionButtonUI(completed) {
    if (completed) {
      markCompleteBtn.textContent = '✓ Completed!';
      markCompleteBtn.className = 'btn btn-success active-complete';
    } else {
      markCompleteBtn.textContent = 'Mark Complete';
      markCompleteBtn.className = 'btn btn-success';
    }
  }

  markCompleteBtn.addEventListener('click', async () => {
    if (!currentWorkout) return;
    const wid = String(currentWorkout.workoutPostId);
    const existing = await window.mvnDB.get('completed_workouts', wid);

    if (existing) {
      await window.mvnDB.delete('completed_workouts', wid);
      updateCompletionButtonUI(false);
    } else {
      await window.mvnDB.put('completed_workouts', {
        workoutId: wid,
        title: currentWorkout.title,
        programId: currentWorkout.programPostId,
        completedAt: new Date().toISOString()
      });
      updateCompletionButtonUI(true);
    }
    pushUserDataToServer();
  });

  // Player controls
  skipBackBtn.addEventListener('click', () => {
    videoPlayer.currentTime = Math.max(0, videoPlayer.currentTime - 10);
  });
  skipForwardBtn.addEventListener('click', () => {
    videoPlayer.currentTime = Math.min(videoPlayer.duration || 9999, videoPlayer.currentTime + 10);
  });
  fullscreenBtn.addEventListener('click', () => {
    if (videoPlayer.requestFullscreen) videoPlayer.requestFullscreen();
    else if (videoPlayer.webkitRequestFullscreen) videoPlayer.webkitRequestFullscreen();
  });

  speedPills.forEach(pill => {
    pill.addEventListener('click', () => {
      speedPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const speed = parseFloat(pill.dataset.speed);
      videoPlayer.playbackRate = speed;
    });
  });

  // Helper to safely trigger native Picture-in-Picture
  async function toggleNativePictureInPicture() {
    if (!document.pictureInPictureEnabled || !videoPlayer) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        if (videoPlayer.readyState < 1) {
          await new Promise((resolve) => {
            videoPlayer.addEventListener('loadedmetadata', resolve, { once: true });
          });
        }
        await videoPlayer.requestPictureInPicture();
      }
    } catch (err) {
      console.warn('Native PiP toggle error:', err);
    }
  }

  // Picture in picture button for main workout player
  if (document.pictureInPictureEnabled && pipBtn) {
    pipBtn.style.display = 'inline-block';
    pipBtn.addEventListener('click', toggleNativePictureInPicture);
  }

  // Native Picture in Picture button on floating mini-player header
  if (miniPlayerNativePipBtn) {
    if (document.pictureInPictureEnabled) {
      miniPlayerNativePipBtn.style.display = 'inline-flex';
      miniPlayerNativePipBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleNativePictureInPicture();
      });
    } else {
      miniPlayerNativePipBtn.style.display = 'none';
    }
  }

  // Listen to native picture-in-picture lifecycle events
  if (videoPlayer) {
    videoPlayer.addEventListener('enterpictureinpicture', () => {
      if (pipBtn) {
        pipBtn.classList.add('active');
        pipBtn.textContent = 'Exit PiP ⧉';
      }
      if (miniPlayerNativePipBtn) {
        miniPlayerNativePipBtn.classList.add('active');
      }
    });
    videoPlayer.addEventListener('leavepictureinpicture', () => {
      if (pipBtn) {
        pipBtn.classList.remove('active');
        pipBtn.textContent = 'PiP ⧉';
      }
      if (miniPlayerNativePipBtn) {
        miniPlayerNativePipBtn.classList.remove('active');
      }
    });
  }

  // Mini-Player Control Event Listeners
  if (miniPlayerExpandBtn) {
    miniPlayerExpandBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      returnToWorkoutView();
    });
  }
  if (miniPlayerTitleBox) {
    miniPlayerTitleBox.addEventListener('click', (e) => {
      if (hasDragged) return;
      e.stopPropagation();
      returnToWorkoutView();
    });
  }
  if (miniPlayerCloseBtn) {
    miniPlayerCloseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dismissMiniPlayer();
    });
  }

  function togglePlayPause() {
    if (!videoPlayer) return;
    if (videoPlayer.paused || videoPlayer.ended) {
      if (videoPlayer.ended) videoPlayer.currentTime = 0;
      videoPlayer.play();
    } else {
      videoPlayer.pause();
    }
  }

  if (miniPlayPauseBtn) {
    miniPlayPauseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePlayPause();
    });
  }

  if (miniSkipBackBtn) {
    miniSkipBackBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (videoPlayer) videoPlayer.currentTime = Math.max(0, videoPlayer.currentTime - 10);
    });
  }

  if (miniSkipForwardBtn) {
    miniSkipForwardBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (videoPlayer) videoPlayer.currentTime = Math.min(videoPlayer.duration || 9999, videoPlayer.currentTime + 10);
    });
  }

  if (miniVolumeBtn) {
    miniVolumeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!videoPlayer) return;
      if (videoPlayer.muted || videoPlayer.volume === 0) {
        videoPlayer.muted = false;
        videoPlayer.volume = lastUnmutedVolume > 0.05 ? lastUnmutedVolume : 1.0;
      } else {
        lastUnmutedVolume = videoPlayer.volume > 0.05 ? videoPlayer.volume : 1.0;
        videoPlayer.muted = true;
      }
      updateMiniPlayerVolumeUI();
    });
  }

  if (miniVolumeSlider) {
    miniVolumeSlider.addEventListener('input', (e) => {
      e.stopPropagation();
      if (!videoPlayer) return;
      const newVol = parseFloat(miniVolumeSlider.value);
      videoPlayer.volume = newVol;
      if (newVol > 0) {
        videoPlayer.muted = false;
        lastUnmutedVolume = newVol;
      } else {
        videoPlayer.muted = true;
      }
      updateMiniPlayerVolumeUI();
    });
  }

  function initMiniPlayerDraggable() {
    if (!miniPlayerHeader || !workoutVideoWrapper) return;

    miniPlayerHeader.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      if (!isMiniPlayerActive) return;

      isDraggingMini = true;
      hasDragged = false;
      dragStartX = e.clientX;
      dragStartY = e.clientY;

      const rect = workoutVideoWrapper.getBoundingClientRect();
      initialPlayerLeft = rect.left;
      initialPlayerTop = rect.top;

      miniPlayerHeader.classList.add('is-dragging');
      try {
        miniPlayerHeader.setPointerCapture(e.pointerId);
      } catch (_) {}
    });

    miniPlayerHeader.addEventListener('pointermove', (e) => {
      if (!isDraggingMini) return;

      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;

      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        hasDragged = true;
      }

      const rect = workoutVideoWrapper.getBoundingClientRect();
      const width = rect.width || 380;
      const height = rect.height || 260;

      const minX = 8;
      const maxX = Math.max(minX, window.innerWidth - width - 8);
      const minY = 8;
      const maxY = Math.max(minY, window.innerHeight - height - 8);

      let newLeft = Math.min(Math.max(initialPlayerLeft + dx, minX), maxX);
      let newTop = Math.min(Math.max(initialPlayerTop + dy, minY), maxY);

      savedMiniLeft = newLeft;
      savedMiniTop = newTop;

      workoutVideoWrapper.style.left = `${newLeft}px`;
      workoutVideoWrapper.style.top = `${newTop}px`;
      workoutVideoWrapper.style.right = 'auto';
      workoutVideoWrapper.style.bottom = 'auto';
      workoutVideoWrapper.style.transform = 'none';
    });

    const endDrag = (e) => {
      if (!isDraggingMini) return;
      isDraggingMini = false;
      miniPlayerHeader.classList.remove('is-dragging');
      try {
        if (e && e.pointerId) miniPlayerHeader.releasePointerCapture(e.pointerId);
      } catch (_) {}
    };

    miniPlayerHeader.addEventListener('pointerup', endDrag);
    miniPlayerHeader.addEventListener('pointercancel', endDrag);

    window.addEventListener('resize', () => {
      if (!isMiniPlayerActive || savedMiniLeft === null || savedMiniTop === null) return;
      clampMiniPlayerPosition();
    });
  }

  initMiniPlayerDraggable();

  if (videoPlayer) {
    videoPlayer.addEventListener('play', updateMiniPlayerPlayPauseUI);
    videoPlayer.addEventListener('pause', updateMiniPlayerPlayPauseUI);
    videoPlayer.addEventListener('ended', updateMiniPlayerPlayPauseUI);
    videoPlayer.addEventListener('volumechange', updateMiniPlayerVolumeUI);

    videoPlayer.addEventListener('click', () => {
      if (isMiniPlayerActive) {
        togglePlayPause();
      }
    });

    videoPlayer.addEventListener('timeupdate', () => {
      if (isMiniPlayerActive && !isScrubbingMini) {
        const cur = videoPlayer.currentTime || 0;
        const dur = videoPlayer.duration || 0;
        if (dur > 0 && miniPlayerScrubber) {
          miniPlayerScrubber.value = (cur / dur) * 100;
        }
        if (miniTimeDisplay) {
          miniTimeDisplay.textContent = `${formatTime(cur)} / ${formatTime(dur)}`;
        }
      }
    });
  }

  if (miniPlayerScrubber) {
    miniPlayerScrubber.addEventListener('input', () => {
      isScrubbingMini = true;
      const dur = videoPlayer ? (videoPlayer.duration || 0) : 0;
      const targetTime = (miniPlayerScrubber.value / 100) * dur;
      if (miniTimeDisplay) {
        miniTimeDisplay.textContent = `${formatTime(targetTime)} / ${formatTime(dur)}`;
      }
    });
    miniPlayerScrubber.addEventListener('change', () => {
      if (videoPlayer) {
        const dur = videoPlayer.duration || 0;
        videoPlayer.currentTime = (miniPlayerScrubber.value / 100) * dur;
      }
      isScrubbingMini = false;
    });
  }

  // --- EXERCISE NORMALIZER & SYNONYM ENGINE ---
  const EXERCISE_ALIASES = {
    'superman': 'super woman',
    'supermans': 'super woman',
    'superwoman': 'super woman',
    'super mom': 'exercise ball super mom',
    'stiff leg deadlifts': 'romanian deadlift',
    'stiff leg deadlift': 'romanian deadlift',
    'slow sit up': 'stability ball sit ups',
    'slow sit ups': 'stability ball sit ups',
    'kneeling tricep kickback': 'quadruped kickback with band',
    'kneeling tricep kickbacks': 'quadruped kickback with band',
    'explosive push up': 'elevated plyometric push up',
    'explosive push ups': 'elevated plyometric push up',
    'tripod row': 'bench supported kneeling row with eccentric return',
    'upright row': 'dumbbell deadlift high pull',
    'bridge pullover': 'elevated bridge',
    'concentration curl': 'seated hammer curls',
    'concentration curls': 'seated hammer curls',
    'pogo hops': 'lateral hop with step and weight',
    'pogo hop': 'lateral hop with step and weight',
    'power pogo hops': 'lateral hop with step and weight',
    'single leg deadlift curtsey style': 'single leg deadlift',
    'single leg deadlift curtsy style': 'single leg deadlift',
    'x-band walk': 'band and dumbbell row',
    'offset squats': 'offset squat',
    'supported squat': 'supported 1-leg squat',
    'supported bridge': 'supported 1-leg bridge',
    'upward explosion': 'high knees'
  };

  function normalizeExerciseName(name) {
    let s = (name || '').toLowerCase().trim();
    s = s.replace(/\b(db|d\.b\.)\b/g, 'dumbbell');
    s = s.replace(/\b(kb|k\.b\.)\b/g, 'kettlebell');
    s = s.replace(/\bsingle\s+leg\b/g, '1-leg');
    s = s.replace(/\bsingle\s+arm\b/g, '1-arm');
    s = s.replace(/\bone\s+leg\b/g, '1-leg');
    s = s.replace(/\bone\s+arm\b/g, '1-arm');
    s = s.replace(/\bpushups\b/g, 'push ups');
    s = s.replace(/\bpushup\b/g, 'push up');
    if (EXERCISE_ALIASES[s]) s = EXERCISE_ALIASES[s];
    return s;
  }

  function findExerciseByName(name) {
    if (!exercisesData || !name) return null;
    const norm = normalizeExerciseName(name);
    const clean = norm.replace(/[^a-z0-9]/g, '');
    if (!clean) return null;
    const exercisesList = Object.values(exercisesData);

    // 1. Exact cleaned match
    for (const ex of exercisesList) {
      const exClean = (ex.exerciseTitle || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (exClean === clean) return ex;
    }

    // 2. Singular / plural match
    const singularClean = clean.replace(/s$/, '');
    for (const ex of exercisesList) {
      const exClean = (ex.exerciseTitle || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (exClean === singularClean || exClean.replace(/s$/, '') === clean) return ex;
    }

    // 3. Substring inclusion match
    for (const ex of exercisesList) {
      const exClean = (ex.exerciseTitle || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (exClean.includes(clean) || clean.includes(exClean)) return ex;
    }

    // 4. Token overlap match (score >= 2)
    const words = norm.replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);
    let bestEx = null;
    let bestScore = 0;
    for (const ex of exercisesList) {
      const exTitle = (ex.exerciseTitle || '').toLowerCase();
      let score = 0;
      for (const w of words) {
        if (exTitle.includes(w)) score++;
      }
      if (score > bestScore && score >= 2) {
        bestScore = score;
        bestEx = ex;
      }
    }
    return bestEx;
  }

  // =========================================================================
  // INTERACTIVE CIRCUIT MODE RUNNER (TIMER, SWIPE & AUTO-ADVANCE)
  // =========================================================================

  const runnerOverlay = document.getElementById('circuitRunnerOverlay');
  const runnerExitBtn = document.getElementById('circuitRunnerExitBtn');
  const runnerWorkoutName = document.getElementById('runnerWorkoutName');
  const runnerPartName = document.getElementById('runnerPartName');
  const runnerStepCounter = document.getElementById('runnerStepCounter');
  const runnerProgressBar = document.getElementById('runnerProgressBar');
  const runnerAutoAdvanceToggle = document.getElementById('runnerAutoAdvanceToggle');
  const runnerAutoAdvanceState = document.getElementById('runnerAutoAdvanceState');
  const runnerSoundToggleBtn = document.getElementById('runnerSoundToggleBtn');
  const runnerStage = document.getElementById('circuitRunnerStage');
  const runnerPrevBtn = document.getElementById('runnerPrevBtn');
  const runnerNextBtn = document.getElementById('runnerNextBtn');
  const runnerFooterCenter = document.getElementById('runnerFooterCenter');

  let runnerSteps = [];
  let runnerCurrentIndex = 0;
  let runnerTimerId = null;
  let runnerSecondsLeft = 0;
  let runnerIsPaused = false;
  let runnerAutoAdvance = localStorage.getItem('mvn_circuit_autoadvance') !== 'false';
  let runnerSoundEnabled = localStorage.getItem('mvn_circuit_sound') !== 'false';

  // Web Audio Synthesizer for offline countdown chimes
  const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
  let runnerAudioCtx = null;

  function playRunnerChime(freq = 440, duration = 0.12, type = 'sine') {
    if (!runnerSoundEnabled) return;
    try {
      if (!runnerAudioCtx) runnerAudioCtx = new AudioCtxClass();
      if (runnerAudioCtx.state === 'suspended') runnerAudioCtx.resume();
      const osc = runnerAudioCtx.createOscillator();
      const gain = runnerAudioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, runnerAudioCtx.currentTime);
      gain.gain.setValueAtTime(0.25, runnerAudioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, runnerAudioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(runnerAudioCtx.destination);
      osc.start();
      osc.stop(runnerAudioCtx.currentTime + duration);
    } catch (e) {}
  }

  function updateAutoAdvanceUI() {
    if (!runnerAutoAdvanceToggle || !runnerAutoAdvanceState) return;
    if (runnerAutoAdvance) {
      runnerAutoAdvanceToggle.classList.add('active');
      runnerAutoAdvanceState.textContent = 'ON';
    } else {
      runnerAutoAdvanceToggle.classList.remove('active');
      runnerAutoAdvanceState.textContent = 'OFF';
    }
  }

  function updateSoundUI() {
    if (!runnerSoundToggleBtn) return;
    if (runnerSoundEnabled) {
      runnerSoundToggleBtn.classList.add('active');
      runnerSoundToggleBtn.textContent = '🔔';
    } else {
      runnerSoundToggleBtn.classList.remove('active');
      runnerSoundToggleBtn.textContent = '🔕';
    }
  }

  if (runnerAutoAdvanceToggle) {
    updateAutoAdvanceUI();
    runnerAutoAdvanceToggle.addEventListener('click', () => {
      runnerAutoAdvance = !runnerAutoAdvance;
      localStorage.setItem('mvn_circuit_autoadvance', String(runnerAutoAdvance));
      updateAutoAdvanceUI();
      const step = runnerSteps[runnerCurrentIndex];
      if (step && (step.type === 'rest' || step.type === 'prepare' || (step.type === 'exercise' && step.duration))) {
        if (!runnerTimerId && runnerSecondsLeft > 0) {
          startStepTimer();
        }
      }
    });
  }

  if (runnerSoundToggleBtn) {
    updateSoundUI();
    runnerSoundToggleBtn.addEventListener('click', () => {
      runnerSoundEnabled = !runnerSoundEnabled;
      localStorage.setItem('mvn_circuit_sound', String(runnerSoundEnabled));
      updateSoundUI();
      if (runnerSoundEnabled) playRunnerChime(660, 0.1);
    });
  }

  function buildRunnerSteps(workout) {
    const steps = [];
    const circuits = workout.circuits || [];

    circuits.forEach((c) => {
      const isCooldown = c.isCooldown;
      if (isCooldown) {
        steps.push({
          type: 'cooldown',
          circuitIndex: c.circuitIndex || 7,
          circuitTitle: c.title || 'Guided Cooldown Flow',
          cooldownPoses: c.cooldownPoses || [],
          coachingTip: c.coachingTip || '',
          duration: null
        });
        return;
      }

      const rounds = c.rounds || 1;
      for (let r = 1; r <= rounds; r++) {
        (c.items || []).forEach((item) => {
          steps.push({
            type: item.type, // 'prepare', 'exercise', 'rest'
            circuitIndex: c.circuitIndex,
            circuitTitle: c.title,
            round: r,
            totalRounds: rounds,
            coachingTip: c.coachingTip || '',
            title: item.title,
            exercisePostId: item.exercisePostId,
            repQuantity: item.repQuantity,
            repUnit: item.repUnit,
            duration: item.duration || (item.type === 'prepare' ? 5 : null)
          });
        });
      }
    });

    return steps;
  }

  function openCircuitRunner(workout) {
    if (!workout) return;
    runnerSteps = buildRunnerSteps(workout);
    if (runnerSteps.length === 0) {
      alert('No structured circuit steps found for this workout.');
      return;
    }

    runnerCurrentIndex = 0;
    if (runnerOverlay) {
      runnerOverlay.style.display = 'flex';
    }
    document.body.style.overflow = 'hidden';

    renderRunnerStep(0);
  }

  function exitCircuitRunner() {
    if (runnerTimerId) {
      clearInterval(runnerTimerId);
      runnerTimerId = null;
    }
    if (runnerOverlay) {
      runnerOverlay.style.display = 'none';
    }
    document.body.style.overflow = '';

    // Restore video player back to overview anchor
    const cooldownAnchor = document.getElementById('cooldownVideoAnchor');
    const topAnchor = document.getElementById('topVideoAnchor');
    const isCooldown = currentWorkout && currentWorkout.videoType === 'cooldown';

    if (isCooldown && cooldownAnchor && videoWrapper && playerControlsBar) {
      cooldownAnchor.appendChild(videoWrapper);
      cooldownAnchor.appendChild(playerControlsBar);
      videoWrapper.style.display = 'block';
      playerControlsBar.style.display = 'flex';
    } else if (topAnchor && videoWrapper && playerControlsBar) {
      topAnchor.appendChild(videoWrapper);
      topAnchor.appendChild(playerControlsBar);
      videoWrapper.style.display = 'block';
      playerControlsBar.style.display = 'flex';
    }
  }

  if (runnerExitBtn) {
    runnerExitBtn.addEventListener('click', exitCircuitRunner);
  }

  function updateCountdownDisplay() {
    const numEl = document.getElementById('runnerCountdownNum');
    if (numEl) {
      const step = runnerSteps[runnerCurrentIndex];
      numEl.textContent = step && step.type === 'prepare' ? `${runnerSecondsLeft}` : `${runnerSecondsLeft}s`;
    }
  }

  function toggleTimerPause(btn) {
    runnerIsPaused = !runnerIsPaused;
    if (btn) {
      btn.textContent = runnerIsPaused ? 'Resume ▶' : 'Pause ⏸';
    }
  }

  function startStepTimer() {
    if (runnerTimerId) clearInterval(runnerTimerId);
    runnerIsPaused = false;
    updateCountdownDisplay();

    runnerTimerId = setInterval(() => {
      if (runnerIsPaused) return;

      runnerSecondsLeft--;
      updateCountdownDisplay();

      // Countdown audio cues at 3, 2, 1, and 0
      if (runnerSecondsLeft <= 3 && runnerSecondsLeft > 0) {
        playRunnerChime(440, 0.08);
      } else if (runnerSecondsLeft === 0) {
        playRunnerChime(880, 0.28);
      }

      if (runnerSecondsLeft <= 0) {
        clearInterval(runnerTimerId);
        runnerTimerId = null;

        if (runnerAutoAdvance) {
          goToNextRunnerStep();
        }
      }
    }, 1000);
  }

  function goToNextRunnerStep() {
    if (runnerCurrentIndex < runnerSteps.length - 1) {
      renderRunnerStep(runnerCurrentIndex + 1);
    } else {
      exitCircuitRunner();
    }
  }

  function goToPrevRunnerStep() {
    if (runnerCurrentIndex > 0) {
      renderRunnerStep(runnerCurrentIndex - 1);
    }
  }

  if (runnerNextBtn) runnerNextBtn.onclick = goToNextRunnerStep;
  if (runnerPrevBtn) runnerPrevBtn.onclick = goToPrevRunnerStep;

  function renderPrepareStep(step) {
    const nextStep = runnerSteps[runnerCurrentIndex + 1];
    let matchedNextEx = null;
    if (nextStep && nextStep.exercisePostId) {
      matchedNextEx = exercisesData && exercisesData[String(nextStep.exercisePostId)];
    }
    if (!matchedNextEx && nextStep && nextStep.title) {
      matchedNextEx = findExerciseByName(nextStep.title);
    }
    const nextGifUrl = matchedNextEx ? getGifUrl(matchedNextEx.gifUrl) : '';

    runnerSecondsLeft = step.duration || 5;

    const card = document.createElement('div');
    card.className = 'runner-card runner-prepare-card';
    card.innerHTML = `
      <div style="font-size:0.95rem; font-weight:800; color:var(--mvn-purple); text-transform:uppercase; letter-spacing:0.06em;">
        ⚡ Get Ready
      </div>
      <div class="runner-prepare-countdown" id="runnerCountdownNum">${runnerSecondsLeft}</div>
      <div style="font-size:1.15rem; font-weight:700; color:var(--mvn-dark);">
        Next Up: ${cleanText(nextStep ? nextStep.title : 'First Exercise')}
      </div>
      ${nextGifUrl ? `
        <div class="runner-up-next-box" style="margin-top:0.5rem;">
          <img src="${nextGifUrl}" alt="Preview" class="runner-up-next-thumb">
          <div class="runner-up-next-info">
            <h5>Form Preview</h5>
            <div>${cleanText(nextStep.title)} &bull; ${nextStep.repQuantity ? `${nextStep.repQuantity} ${nextStep.repUnit || 'Reps'}` : `${nextStep.duration || 30}s`}</div>
          </div>
        </div>
      ` : ''}
    `;
    runnerStage.appendChild(card);

    runnerFooterCenter.innerHTML = `
      <button class="btn btn-primary" id="skipPrepareBtn">Skip &amp; Start Move &rarr;</button>
    `;
    const skipBtn = runnerFooterCenter.querySelector('#skipPrepareBtn');
    if (skipBtn) skipBtn.onclick = () => goToNextRunnerStep();

    startStepTimer();
  }

  function renderRestStep(step) {
    const nextStep = runnerSteps[runnerCurrentIndex + 1];
    let matchedNextEx = null;
    if (nextStep && nextStep.exercisePostId) {
      matchedNextEx = exercisesData && exercisesData[String(nextStep.exercisePostId)];
    }
    if (!matchedNextEx && nextStep && nextStep.title) {
      matchedNextEx = findExerciseByName(nextStep.title);
    }
    const nextGifUrl = matchedNextEx ? getGifUrl(matchedNextEx.gifUrl) : '';

    runnerSecondsLeft = step.duration || 30;

    const card = document.createElement('div');
    card.className = 'runner-card runner-rest-card';
    card.innerHTML = `
      <div class="runner-rest-icon">☕</div>
      <h3 class="runner-rest-title">Rest &amp; Recovery</h3>
      <div class="runner-rest-countdown" id="runnerCountdownNum">${runnerSecondsLeft}s</div>
      <p style="color:var(--mvn-gray-600); font-size:0.95rem; margin:0;">Catch your breath, shake out muscles, and prepare for the next set.</p>
      ${nextStep ? `
        <div class="runner-up-next-box">
          ${nextGifUrl ? `<img src="${nextGifUrl}" alt="Upcoming" class="runner-up-next-thumb">` : '<div style="font-size:1.8rem;">💪</div>'}
          <div class="runner-up-next-info">
            <h5>Up Next</h5>
            <div>${cleanText(nextStep.title || 'Next Exercise')} &bull; ${nextStep.repQuantity ? `${nextStep.repQuantity} ${nextStep.repUnit || 'Reps'}` : `${nextStep.duration || 30}s`}</div>
          </div>
        </div>
      ` : ''}
    `;
    runnerStage.appendChild(card);

    runnerFooterCenter.innerHTML = `
      <button class="btn btn-primary btn-lg" id="skipRestBtn">Skip Rest &amp; Start Move &rarr;</button>
    `;
    const skipBtn = runnerFooterCenter.querySelector('#skipRestBtn');
    if (skipBtn) skipBtn.onclick = () => goToNextRunnerStep();

    startStepTimer();
  }

  function renderExerciseStep(step) {
    let matchedEx = null;
    if (step.exercisePostId && exercisesData) {
      matchedEx = exercisesData[String(step.exercisePostId)];
    }
    if (!matchedEx) {
      matchedEx = findExerciseByName(step.title);
    }

    const gifUrl = matchedEx ? getGifUrl(matchedEx.gifUrl) : '';
    const isTimed = Boolean(step.duration);
    runnerSecondsLeft = step.duration || 0;

    const card = document.createElement('div');
    card.className = 'runner-card';

    card.innerHTML = `
      <div class="runner-exercise-layout">
        <div class="runner-gif-frame" title="Click for form details">
          ${gifUrl ? `
            <img src="${gifUrl}" alt="${step.title}" class="runner-gif-img" onerror="this.src='assets/images/menovation-sq-purple-300.png';">
          ` : '<div style="font-size:3.5rem;">💪</div>'}
        </div>
        <div class="runner-details-column">
          <div class="runner-circuit-tag">Part ${step.circuitIndex}: ${cleanText(step.circuitTitle)}${step.totalRounds > 1 ? ` • Round ${step.round} of ${step.totalRounds}` : ''}</div>
          <h2 class="runner-exercise-title">${cleanText(step.title || (matchedEx ? matchedEx.exerciseTitle : 'Exercise'))}</h2>
          
          <div class="runner-prescription-row">
            ${step.repQuantity ? `
              <div class="runner-rep-badge">${step.repQuantity} ${step.repUnit || 'REPS'}</div>
            ` : ''}
            ${isTimed ? `
              <div class="runner-timer-box">
                <div class="runner-timer-number" id="runnerCountdownNum">${runnerSecondsLeft}s</div>
                <div class="runner-timer-actions">
                  <button class="runner-timer-btn" id="runnerTimerAddBtn">+10s</button>
                  <button class="runner-timer-btn" id="runnerTimerSubtractBtn">-10s</button>
                </div>
              </div>
            ` : ''}
          </div>

          <div class="circuit-exercise-meta">
            ${matchedEx && matchedEx.usesWeights ? '<span class="badge badge-purple">Weights</span>' : ''}
            ${matchedEx && matchedEx.usesBands ? '<span class="badge badge-sand">Bands</span>' : ''}
            ${matchedEx && !matchedEx.usesWeights && !matchedEx.usesBands ? '<span class="badge badge-sand">Bodyweight</span>' : ''}
          </div>

          ${step.coachingTip ? `
            <div class="circuit-coaching-tip" style="margin-top:0.5rem;">
              <span class="tip-icon">💬</span>
              <div class="tip-body">
                <strong>Coach's Guidance:</strong>
                <p>${cleanText(step.coachingTip)}</p>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
    runnerStage.appendChild(card);

    if (isTimed) {
      runnerFooterCenter.innerHTML = `
        <button class="btn btn-secondary" id="runnerTimerPauseBtn">Pause ⏸</button>
      `;
      const pauseBtn = runnerFooterCenter.querySelector('#runnerTimerPauseBtn');
      if (pauseBtn) {
        pauseBtn.onclick = () => toggleTimerPause(pauseBtn);
      }

      const addBtn = card.querySelector('#runnerTimerAddBtn');
      if (addBtn) {
        addBtn.onclick = () => {
          runnerSecondsLeft += 10;
          updateCountdownDisplay();
        };
      }
      const subBtn = card.querySelector('#runnerTimerSubtractBtn');
      if (subBtn) {
        subBtn.onclick = () => {
          runnerSecondsLeft = Math.max(1, runnerSecondsLeft - 10);
          updateCountdownDisplay();
        };
      }

      startStepTimer();
    } else {
      // Reps: Big complete button in center
      runnerFooterCenter.innerHTML = `
        <button class="btn btn-primary btn-lg" id="runnerDoneRepBtn">✓ Completed ${step.repQuantity} ${step.repUnit || 'Reps'} &rarr;</button>
      `;
      const doneBtn = runnerFooterCenter.querySelector('#runnerDoneRepBtn');
      if (doneBtn) doneBtn.onclick = () => goToNextRunnerStep();
    }
  }

  function renderCooldownStep(step) {
    const card = document.createElement('div');
    card.className = 'runner-card runner-cooldown-card';
    card.innerHTML = `
      <div class="runner-cooldown-celebrate">
        <h3>🎉 Circuits Completed! Amazing Work!</h3>
        <p style="margin:0; color:var(--mvn-dark); font-size:0.95rem;">Follow along below with the coach's guided cooldown flow to stretch, recover, and conclude your workout.</p>
      </div>

      ${step.cooldownPoses && step.cooldownPoses.length > 0 ? `
        <div class="cooldown-poses-card">
          <div class="cooldown-poses-title">🧘 Guided Flow Sequence:</div>
          <div class="cooldown-poses-list">
            ${step.cooldownPoses.map(p => `<span class="cooldown-pose-chip">${cleanText(p)}</span>`).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Mount point for video player inside cooldown runner card -->
      <div id="runnerVideoAnchor"></div>
    `;
    runnerStage.appendChild(card);

    const runnerAnchor = card.querySelector('#runnerVideoAnchor');
    if (runnerAnchor && videoWrapper && playerControlsBar) {
      runnerAnchor.appendChild(videoWrapper);
      runnerAnchor.appendChild(playerControlsBar);
      videoWrapper.style.display = 'block';
      playerControlsBar.style.display = 'flex';
      videoPlayer.play().catch(() => {});
    }

    runnerFooterCenter.innerHTML = `
      <button class="btn btn-success btn-lg" id="runnerFinishBtn">✓ Finish &amp; Mark Complete</button>
    `;
    const finishBtn = runnerFooterCenter.querySelector('#runnerFinishBtn');
    if (finishBtn) {
      finishBtn.onclick = async () => {
        if (currentWorkout) {
          const wid = String(currentWorkout.workoutPostId);
          await window.mvnDB.put('completed_workouts', {
            workoutId: wid,
            title: currentWorkout.title,
            programId: currentWorkout.programPostId,
            completedAt: new Date().toISOString()
          });
          updateCompletionButtonUI(true);
        }
        exitCircuitRunner();
      };
    }
  }

  function renderRunnerStep(index) {
    if (runnerTimerId) {
      clearInterval(runnerTimerId);
      runnerTimerId = null;
    }
    runnerIsPaused = false;
    runnerCurrentIndex = Math.max(0, Math.min(index, runnerSteps.length - 1));
    const step = runnerSteps[runnerCurrentIndex];
    if (!step) return;

    // 1. Update Header UI
    runnerWorkoutName.textContent = cleanText(currentWorkout.title);
    runnerPartName.textContent = `Part ${step.circuitIndex}: ${cleanText(step.circuitTitle)}${step.totalRounds > 1 ? ` (Round ${step.round}/${step.totalRounds})` : ''}`;
    runnerStepCounter.textContent = `Step ${runnerCurrentIndex + 1} of ${runnerSteps.length}`;
    runnerProgressBar.style.width = `${Math.round(((runnerCurrentIndex + 1) / runnerSteps.length) * 100)}%`;

    runnerPrevBtn.disabled = runnerCurrentIndex === 0;
    runnerNextBtn.textContent = runnerCurrentIndex === runnerSteps.length - 1 ? 'Finish ✓' : 'Next Step →';

    // 2. Render Stage Content by Step Type
    runnerStage.innerHTML = '';
    runnerFooterCenter.innerHTML = '';

    if (step.type === 'prepare') {
      renderPrepareStep(step);
    } else if (step.type === 'rest') {
      renderRestStep(step);
    } else if (step.type === 'exercise') {
      renderExerciseStep(step);
    } else if (step.type === 'cooldown') {
      renderCooldownStep(step);
    }
  }

  // Touch Swipe Gesture Listener on Stage
  if (runnerStage) {
    let tStartX = 0;
    let tStartY = 0;
    runnerStage.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        tStartX = e.touches[0].clientX;
        tStartY = e.touches[0].clientY;
      }
    }, { passive: true });

    runnerStage.addEventListener('touchend', (e) => {
      if (e.changedTouches.length === 1) {
        const dx = e.changedTouches[0].clientX - tStartX;
        const dy = e.changedTouches[0].clientY - tStartY;
        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4) {
          if (dx < 0) {
            goToNextRunnerStep(); // Swipe Left -> Next
          } else {
            goToPrevRunnerStep(); // Swipe Right -> Prev
          }
        }
      }
    }, { passive: true });
  }

  // Keyboard navigation for TV remote / Desktop
  window.addEventListener('keydown', (e) => {
    if (runnerOverlay && runnerOverlay.style.display !== 'none') {
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        goToNextRunnerStep();
      } else if (e.key === 'ArrowLeft') {
        goToPrevRunnerStep();
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        const pauseBtn = document.getElementById('runnerTimerPauseBtn');
        if (pauseBtn) toggleTimerPause(pauseBtn);
      } else if (e.key === 'Escape') {
        exitCircuitRunner();
      }
    }
  });

  // --- STRUCTURED CIRCUITS RENDERER (DIRECT IDS & METADATA) ---
  function renderStructuredCircuits(circuits, container) {
    container.innerHTML = '';

    circuits.forEach((c) => {
      const block = document.createElement('div');
      block.className = `circuit-block ${c.isCooldown ? 'circuit-cooldown-block' : ''}`;
      if (c.isCooldown) {
        block.id = 'cooldownSection';
      }

      const headerEl = document.createElement('div');
      headerEl.className = 'circuit-header';
      headerEl.innerHTML = `
        <div class="circuit-header-left">
          <span class="circuit-badge ${c.isCooldown ? 'badge-sand' : ''}">Part ${c.circuitIndex || ''}</span>
          <h3 class="circuit-header-title">${cleanText(c.title)}</h3>
        </div>
        ${c.rounds && c.rounds > 1 ? `<div class="circuit-rounds-badge">${c.rounds} Rounds</div>` : ''}
      `;
      block.appendChild(headerEl);

      // Coaching tip
      if (c.coachingTip) {
        const tipDiv = document.createElement('div');
        tipDiv.className = 'circuit-coaching-tip';
        tipDiv.innerHTML = `
          <span class="tip-icon">💬</span>
          <div class="tip-body">
            <strong>Coach's Guidance:</strong>
            <p>${cleanText(c.coachingTip)}</p>
          </div>
        `;
        block.appendChild(tipDiv);
      }

      // Cooldown poses & dock callout
      if (c.isCooldown) {
        if (c.cooldownPoses && c.cooldownPoses.length > 0) {
          const posesDiv = document.createElement('div');
          posesDiv.className = 'cooldown-poses-card';
          posesDiv.innerHTML = `
            <div class="cooldown-poses-title">🧘 Poses in this Guided Flow:</div>
            <div class="cooldown-poses-list">
              ${c.cooldownPoses.map(p => `<span class="cooldown-pose-chip">${cleanText(p)}</span>`).join('')}
            </div>
          `;
          block.appendChild(posesDiv);
        }

        const dockNotice = document.createElement('div');
        dockNotice.className = 'cooldown-dock-banner';
        dockNotice.innerHTML = `
          <h4>🧘 Guided Cooldown Video Below</h4>
          <p>Follow along with the coach in the video below to stretch and conclude your session.</p>
        `;
        block.appendChild(dockNotice);

        const cooldownMount = document.createElement('div');
        cooldownMount.id = 'cooldownVideoAnchor';
        cooldownMount.className = 'cooldown-video-mount';
        block.appendChild(cooldownMount);
      }

      // Exercise List
      const exList = document.createElement('div');
      exList.className = 'circuit-exercises-list';

      (c.items || []).forEach(item => {
        if (item.type === 'prepare') {
          const prepDiv = document.createElement('div');
          prepDiv.className = 'circuit-prepare-indicator';
          prepDiv.innerHTML = `
            <span>⚡ Get Ready</span>
            <span class="prepare-time">⏱️ ${item.duration}s</span>
          `;
          exList.appendChild(prepDiv);
        } else if (item.type === 'rest') {
          const restDiv = document.createElement('div');
          restDiv.className = 'circuit-rest-indicator';
          restDiv.innerHTML = `
            <div class="rest-left">
              <span>☕</span>
              <span>Rest &amp; Recovery</span>
            </div>
            <span class="rest-time">⏱️ ${item.duration}s</span>
          `;
          exList.appendChild(restDiv);
        } else if (item.type === 'exercise') {
          let matchedEx = null;
          if (item.exercisePostId && exercisesData) {
            matchedEx = exercisesData[String(item.exercisePostId)];
          }
          if (!matchedEx) {
            matchedEx = findExerciseByName(item.title);
          }

          const card = document.createElement('div');
          card.className = 'circuit-exercise-card';

          const exDetail = item.repQuantity ? `${item.repQuantity} ${item.repUnit || 'Reps'}` : (item.duration ? `${item.duration} seconds` : '');

          if (matchedEx) {
            const gifUrl = getGifUrl(matchedEx.gifUrl);
            card.innerHTML = `
              <div class="circuit-exercise-thumb-frame" title="Click for fullscreen demonstration">
                ${gifUrl ? `
                  <img src="${gifUrl}" alt="${matchedEx.exerciseTitle}" class="circuit-exercise-gif" loading="lazy" onerror="if(!this.dataset.retried){this.dataset.retried='1'; setTimeout(()=>{this.src='${gifUrl}';},1200);}else{this.onerror=null; this.src='assets/images/menovation-sq-purple-300.png';}">
                  <button class="expand-gif-overlay-btn" title="View Fullscreen Demo" data-exid="${matchedEx.exerciseId}">⛶</button>
                ` : `
                  <div class="circuit-exercise-placeholder-icon">💪</div>
                `}
              </div>
              <div class="circuit-exercise-info">
                <div class="circuit-exercise-title-row">
                  <h4 class="circuit-exercise-name">${cleanText(item.title || matchedEx.exerciseTitle)}</h4>
                  ${exDetail ? `<span class="circuit-exercise-chip">⏱️ ${exDetail}</span>` : ''}
                </div>
                <div class="circuit-exercise-meta">
                  ${matchedEx.usesWeights ? '<span class="badge badge-purple badge-xs">Weights</span>' : ''}
                  ${matchedEx.usesBands ? '<span class="badge badge-sand badge-xs">Bands</span>' : ''}
                  ${!matchedEx.usesWeights && !matchedEx.usesBands ? '<span class="badge badge-sand badge-xs">Bodyweight</span>' : ''}
                </div>
                <button class="circuit-exercise-view-modal-btn" data-exid="${matchedEx.exerciseId}">
                  Form Cues &amp; Tips &rarr;
                </button>
              </div>
              <button class="circuit-exercise-check-btn" title="Mark set complete" aria-label="Mark set complete">
                ✓
              </button>
            `;

            const expandBtn = card.querySelector('.expand-gif-overlay-btn');
            if (expandBtn) {
              expandBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openExerciseModal(matchedEx);
              });
            }
            const modalBtn = card.querySelector('.circuit-exercise-view-modal-btn');
            if (modalBtn) {
              modalBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openExerciseModal(matchedEx);
              });
            }
            const thumbFrame = card.querySelector('.circuit-exercise-thumb-frame');
            if (thumbFrame) {
              thumbFrame.addEventListener('click', () => openExerciseModal(matchedEx));
            }
          } else {
            card.innerHTML = `
              <div class="circuit-exercise-thumb-frame">
                <div class="circuit-exercise-placeholder-icon">⚡</div>
              </div>
              <div class="circuit-exercise-info">
                <div class="circuit-exercise-title-row">
                  <h4 class="circuit-exercise-name">${cleanText(item.title)}</h4>
                  ${exDetail ? `<span class="circuit-exercise-chip">⏱️ ${exDetail}</span>` : ''}
                </div>
              </div>
              <button class="circuit-exercise-check-btn" title="Mark set complete" aria-label="Mark set complete">
                ✓
              </button>
            `;
          }

          const checkBtn = card.querySelector('.circuit-exercise-check-btn');
          if (checkBtn) {
            checkBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              card.classList.toggle('completed');
            });
          }

          exList.appendChild(card);
        }
      });

      if (exList.children.length > 0) {
        block.appendChild(exList);
      }
      container.appendChild(block);
    });
  }

  // --- CIRCUIT BREAKDOWN RENDERER (FALLBACK FOR LEGACY TEXT) ---
  function renderCircuitBreakdown(text, container) {
    container.innerHTML = '';
    const cleaned = cleanText(text);
    const lines = cleaned.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    let currentBlock = null;
    let currentExercisesList = null;
    let blockCount = 0;

    lines.forEach(line => {
      // Strip outer HTML tags to analyze text
      const plain = line.replace(/<[^>]+>/g, '').trim();
      if (!plain) return;

      // 1. Check for Circuit / Section header
      // e.g. "Circuit 1", "Round 1", "Warm Up", "Cool Down", "Block A", "Finisher", "Tabata 1", "Core Finisher", "Main Flow", "Poses in this flow", "Closing", "Pranayama"
      const isCircuitHeader = /^(circuit\s*\d*|round\s*\d+|warm\s*up|cool\s*down|finisher|core\s*finisher|superset|tri-set|block\s*[a-z0-9]|emom|amrap|tabata\s*\d*|poses\s*in|main\s*flow|closing|pranayama|flow\s*\d*)/i.test(plain);

      // 2. Check for Rounds/Sets prescription line
      const isRoundsPrescription = /^(\d+\s*(rounds?|sets?)|repeat\s*\d+\s*times?)/i.test(plain);

      if (isCircuitHeader) {
        blockCount++;
        currentBlock = document.createElement('div');
        currentBlock.className = 'circuit-block';

        const headerEl = document.createElement('div');
        headerEl.className = 'circuit-header';
        headerEl.innerHTML = `
          <div class="circuit-header-left">
            <span class="circuit-badge">Part ${blockCount}</span>
            <h3 class="circuit-header-title">${plain}</h3>
          </div>
          <div class="circuit-rounds-badge" style="display:none;"></div>
        `;
        currentBlock.appendChild(headerEl);

        currentExercisesList = document.createElement('div');
        currentExercisesList.className = 'circuit-exercises-list';
        currentBlock.appendChild(currentExercisesList);

        container.appendChild(currentBlock);
        return;
      }

      if (isRoundsPrescription && currentBlock) {
        const roundsBadge = currentBlock.querySelector('.circuit-rounds-badge');
        if (roundsBadge) {
          roundsBadge.textContent = plain;
          roundsBadge.style.display = 'inline-block';
        }
        return;
      }

      // If exercise arrives before any header, create a default container
      if (!currentBlock) {
        blockCount++;
        currentBlock = document.createElement('div');
        currentBlock.className = 'circuit-block';
        currentBlock.innerHTML = `
          <div class="circuit-header">
            <div class="circuit-header-left">
              <span class="circuit-badge">Part 1</span>
              <h3 class="circuit-header-title">Movements</h3>
            </div>
          </div>
          <div class="circuit-exercises-list"></div>
        `;
        container.appendChild(currentBlock);
        currentExercisesList = currentBlock.querySelector('.circuit-exercises-list');
      }

      // 3. Check for Rest interval
      const isRest = /^rest\b/i.test(plain);
      if (isRest) {
        const restDiv = document.createElement('div');
        restDiv.className = 'circuit-rest-indicator';
        const secMatch = plain.match(/\d+\s*(seconds?|s\b|secs?)/i);
        const restTime = secMatch ? secMatch[0] : '20s';
        restDiv.innerHTML = `
          <div class="rest-left">
            <span>☕</span>
            <span>Rest &amp; Recovery</span>
          </div>
          <span class="rest-time">⏱️ ${restTime}</span>
        `;
        currentExercisesList.appendChild(restDiv);
        return;
      }

      // 4. Exercise line: strip leading list markers/bullets
      const cleanLine = plain.replace(/^[\s\-\—\–\•\*\d+\.\)]+/, '').trim();
      if (!cleanLine) return;

      // Split exercise name and prescription on em-dash, en-dash, colon, or spaced hyphen
      const parts = cleanLine.split(/\s+[—–-]\s+|[—–]|:\s+/);
      const exName = parts[0].trim();
      const exDetail = parts.length > 1 ? parts.slice(1).join(' - ').trim() : '';

      const matchedEx = findExerciseByName(exName);

      if (matchedEx) {
        // Exercise has library GIF demonstration and form cues
        const gifUrl = getGifUrl(matchedEx.gifUrl);
        const card = document.createElement('div');
        card.className = 'circuit-exercise-card';

        card.innerHTML = `
          <div class="circuit-exercise-thumb-frame" title="Click for fullscreen demonstration">
            ${gifUrl ? `
              <img src="${gifUrl}" alt="${matchedEx.exerciseTitle}" class="circuit-exercise-gif" loading="lazy" onerror="if(!this.dataset.retried){this.dataset.retried='1'; setTimeout(()=>{this.src='${gifUrl}';},1200);}else{this.onerror=null; this.src='assets/images/menovation-sq-purple-300.png';}">
              <button class="expand-gif-overlay-btn" title="View Fullscreen Demo" data-exid="${matchedEx.exerciseId}">⛶</button>
            ` : `
              <div class="circuit-exercise-placeholder-icon">💪</div>
            `}
          </div>
          <div class="circuit-exercise-info">
            <div class="circuit-exercise-title-row">
              <h4 class="circuit-exercise-name">${exName}</h4>
              ${exDetail ? `<span class="circuit-exercise-chip">⏱️ ${exDetail}</span>` : ''}
            </div>
            <div class="circuit-exercise-meta">
              ${matchedEx.usesWeights ? '<span class="badge badge-purple badge-xs">Weights</span>' : ''}
              ${matchedEx.usesBands ? '<span class="badge badge-sand badge-xs">Bands</span>' : ''}
              ${!matchedEx.usesWeights && !matchedEx.usesBands ? '<span class="badge badge-sand badge-xs">Bodyweight</span>' : ''}
            </div>
            <button class="circuit-exercise-view-modal-btn" data-exid="${matchedEx.exerciseId}">
              Form Cues &amp; Tips &rarr;
            </button>
          </div>
        `;

        const expandBtn = card.querySelector('.expand-gif-overlay-btn');
        if (expandBtn) {
          expandBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openExerciseModal(matchedEx);
          });
        }
        const modalBtn = card.querySelector('.circuit-exercise-view-modal-btn');
        if (modalBtn) {
          modalBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openExerciseModal(matchedEx);
          });
        }
        const thumbFrame = card.querySelector('.circuit-exercise-thumb-frame');
        if (thumbFrame) {
          thumbFrame.addEventListener('click', () => openExerciseModal(matchedEx));
        }

        currentExercisesList.appendChild(card);
      } else {
        // Unmatched: Check if Yoga / Flow / Breathwork / Mobility or general guided movement
        const isBreathwork = /\b(breathing|breath|pranayama|inhale|exhale)\b/i.test(exName);
        const isYoga = /\b(pose|flow|dog|salutation|savasana|warrior|twist|chaturanga|cobra|fold|forward|child|crescent|lunge\s*flow|sun\s*salutation|pigeon|camel|rag\s*doll|half\s*splits|stretch)\b/i.test(exName);

        const card = document.createElement('div');
        card.className = 'circuit-flow-card';

        let icon = '⚡';
        let badgeText = 'Guided Movement';
        let badgeClass = 'badge-purple';
        let descText = 'Follow along with coach in full video';

        if (isBreathwork) {
          icon = '🫁';
          badgeText = 'Breathwork';
          badgeClass = 'badge-sand';
          descText = 'Guided breathwork practice • Follow coach in video';
        } else if (isYoga) {
          icon = '🧘';
          badgeText = 'Guided Flow';
          badgeClass = 'badge-purple';
          descText = 'Continuous yoga flow • Follow coach in video';
        }

        card.innerHTML = `
          <div class="circuit-flow-icon-frame">${icon}</div>
          <div class="circuit-flow-info">
            <div class="circuit-flow-title-row">
              <h4 class="circuit-flow-name">${exName}</h4>
              <div style="display:flex; align-items:center; gap:0.4rem;">
                ${exDetail ? `<span class="circuit-exercise-chip">⏱️ ${exDetail}</span>` : ''}
                <span class="badge ${badgeClass} badge-xs">${badgeText}</span>
              </div>
            </div>
            <div class="circuit-flow-desc">${descText}</div>
          </div>
        `;

        currentExercisesList.appendChild(card);
      }
    });
  }

  // --- 6. ALL WORKOUTS VIEW ---
  function renderAllWorkoutsList() {
    const grid = document.getElementById('workoutsCardsGrid');
    const summary = document.getElementById('workoutsResultsSummary');
    if (!grid || !workoutsIndex) return;

    const searchTerm = (document.getElementById('workoutSearchInput').value || '').toLowerCase().trim();
    const durationFilter = document.getElementById('workoutDurationFilter').value;
    const categoryFilter = document.getElementById('workoutCategoryFilter').value;
    const sortBy = document.getElementById('workoutSortSelect').value;

    let items = Object.values(workoutsIndex);

    // Filter
    items = items.filter(w => {
      if (searchTerm && !w.title.toLowerCase().includes(searchTerm) && !w.theWhy.toLowerCase().includes(searchTerm)) {
        return false;
      }
      if (categoryFilter !== 'all' && w.videoCategory !== categoryFilter) {
        return false;
      }
      if (durationFilter === 'short' && w.duration >= 15) return false;
      if (durationFilter === 'medium' && (w.duration < 15 || w.duration > 25)) return false;
      if (durationFilter === 'long' && (w.duration < 25 || w.duration > 35)) return false;
      if (durationFilter === 'xlarge' && w.duration <= 35) return false;
      return true;
    });

    // Sort
    if (sortBy === 'durationAsc') items.sort((a, b) => a.duration - b.duration);
    else if (sortBy === 'durationDesc') items.sort((a, b) => b.duration - a.duration);
    else items.sort((a, b) => a.title.localeCompare(b.title));

    summary.textContent = `Showing ${items.length} of ${Object.keys(workoutsIndex).length} workouts`;
    grid.innerHTML = '';

    // Render all matching workouts
    items.forEach(w => {
      const card = document.createElement('div');
      card.className = 'workout-card';
      const cleanWTitle = cleanText(w.title);
      const isCooldown = w.videoType === 'cooldown';
      const videoBadgeText = isCooldown ? 'Guided Cooldown' : 'Full Video Class';

      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span class="badge ${isCooldown ? 'badge-sand' : 'badge-purple'}">${videoBadgeText}</span>
          <span style="font-size:0.8rem; font-weight:700; color:var(--mvn-gray-600);">⏱️ ${w.duration} Min</span>
        </div>
        <h4 class="workout-card-title">${cleanWTitle}</h4>
        <div class="workout-card-meta">
          <span class="meta-chip">720p HD</span>
          <span class="meta-chip">${w.equipment.length ? cleanText(w.equipment[0].itemTitle) : 'Bodyweight'}</span>
          <span class="meta-chip">${cleanText(w.videoCategory) || 'General'}</span>
        </div>
        <div class="workout-card-footer">
          <div class="workout-card-actions">
            <button class="workout-card-btn workout-card-preview-btn" data-workout-id="${w.workoutPostId}" title="Preview in Picture-in-Picture player">▶ Preview</button>
            <button class="workout-card-btn workout-card-open-btn" data-workout-id="${w.workoutPostId}" title="Open full workout">Open &rarr;</button>
          </div>
        </div>
      `;
      card.dataset.workoutId = String(w.workoutPostId);
      grid.appendChild(card);
    });
  }

  const workoutsGrid = document.getElementById('workoutsCardsGrid');
  if (workoutsGrid) {
    workoutsGrid.addEventListener('click', (e) => {
      const previewBtn = e.target.closest('.workout-card-preview-btn');
      if (previewBtn && previewBtn.dataset.workoutId) {
        e.stopPropagation();
        previewWorkoutInPiP(previewBtn.dataset.workoutId);
        return;
      }
      const openBtn = e.target.closest('.workout-card-open-btn');
      if (openBtn && openBtn.dataset.workoutId) {
        e.stopPropagation();
        openWorkoutPlayer(openBtn.dataset.workoutId);
        return;
      }
      const card = e.target.closest('.workout-card');
      if (card && card.dataset.workoutId) {
        openWorkoutPlayer(card.dataset.workoutId);
      }
    });
  }

  ['workoutSearchInput', 'workoutDurationFilter', 'workoutCategoryFilter', 'workoutSortSelect'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', renderAllWorkoutsList);
      el.addEventListener('change', renderAllWorkoutsList);
    }
  });

  // --- 7. EXERCISE LIBRARY VIEW (PROGRESSIVE BATCH LOADING) ---
  let activeFilteredExercises = [];
  let renderedExerciseCount = 0;
  const EXERCISE_BATCH_SIZE = 60;
  let exerciseIntersectionObserver = null;

  function renderNextExerciseBatch() {
    const grid = document.getElementById('exerciseCardsGrid');
    const summary = document.getElementById('exerciseResultsSummary');
    const loadMoreContainer = document.getElementById('exerciseLoadMoreContainer');
    const loadMoreBtn = document.getElementById('exerciseLoadMoreBtn');
    if (!grid || !activeFilteredExercises) return;

    const nextBatch = activeFilteredExercises.slice(renderedExerciseCount, renderedExerciseCount + EXERCISE_BATCH_SIZE);
    if (nextBatch.length === 0) {
      if (loadMoreContainer) loadMoreContainer.style.display = 'none';
      return;
    }

    const fragment = document.createDocumentFragment();
    nextBatch.forEach(ex => {
      const card = document.createElement('div');
      card.className = 'exercise-card';
      const gifUrl = getGifUrl(ex.gifUrl);

      card.innerHTML = `
        <div class="exercise-thumb-wrapper">
          <img src="${gifUrl}" alt="${cleanText(ex.exerciseTitle)}" class="exercise-thumb-img" loading="lazy" onerror="this.src='assets/images/menovation-sq-purple-300.png'">
        </div>
        <div class="exercise-card-body">
          <div class="exercise-card-title">${cleanText(ex.exerciseTitle)}</div>
          <div style="font-size:0.75rem; color:var(--mvn-gray-600);">
            ${ex.usesWeights ? '🏋️ Weights ' : ''}${ex.usesBands ? '⚡ Bands ' : ''}${!ex.usesWeights && !ex.usesBands ? '🧘 Bodyweight' : ''}
          </div>
        </div>
      `;

      card.addEventListener('click', () => openExerciseModal(ex));
      fragment.appendChild(card);
    });

    grid.appendChild(fragment);
    renderedExerciseCount += nextBatch.length;

    const totalMatching = activeFilteredExercises.length;
    const totalCatalog = exercisesData ? Object.keys(exercisesData).length : 0;

    if (renderedExerciseCount >= totalMatching) {
      summary.textContent = `Showing all ${totalMatching} movements${totalMatching < totalCatalog ? ` (filtered from ${totalCatalog})` : ''}`;
      if (loadMoreContainer) loadMoreContainer.style.display = 'none';
    } else {
      summary.textContent = `Showing ${renderedExerciseCount} of ${totalMatching} movements (${totalCatalog} total)`;
      if (loadMoreContainer) {
        loadMoreContainer.style.display = 'flex';
        if (loadMoreBtn) {
          loadMoreBtn.textContent = `Load More Movements (${totalMatching - renderedExerciseCount} remaining) ↓`;
        }
      }
    }
  }

  function renderExerciseLibrary(equipFilter) {
    const grid = document.getElementById('exerciseCardsGrid');
    const summary = document.getElementById('exerciseResultsSummary');
    const loadMoreContainer = document.getElementById('exerciseLoadMoreContainer');
    if (!grid || !exercisesData) return;

    const searchTerm = (document.getElementById('exerciseSearchInput').value || '').toLowerCase().trim();
    let exercises = Object.values(exercisesData);

    exercises = exercises.filter(ex => {
      if (searchTerm && !ex.exerciseTitle.toLowerCase().includes(searchTerm)) {
        return false;
      }
      if (equipFilter === 'weights' && !ex.usesWeights) return false;
      if (equipFilter === 'bands' && !ex.usesBands) return false;
      if (equipFilter === 'bodyweight' && (ex.usesWeights || ex.usesBands)) return false;
      return true;
    });

    // Alphabetize movements by title for intuitive browsing
    exercises.sort((a, b) => (a.exerciseTitle || '').localeCompare(b.exerciseTitle || ''));

    activeFilteredExercises = exercises;
    renderedExerciseCount = 0;
    grid.innerHTML = '';

    if (exercises.length === 0) {
      summary.textContent = 'No matching movements found';
      if (loadMoreContainer) loadMoreContainer.style.display = 'none';
      return;
    }

    renderNextExerciseBatch();

    // Auto-load next batch on scroll when loadMoreContainer enters viewport
    if (loadMoreContainer && 'IntersectionObserver' in window) {
      if (exerciseIntersectionObserver) {
        exerciseIntersectionObserver.disconnect();
      }
      exerciseIntersectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && renderedExerciseCount < activeFilteredExercises.length) {
            renderNextExerciseBatch();
          }
        });
      }, { rootMargin: '300px' });
      exerciseIntersectionObserver.observe(loadMoreContainer);
    }
  }

  const exerciseLoadMoreBtn = document.getElementById('exerciseLoadMoreBtn');
  if (exerciseLoadMoreBtn) {
    exerciseLoadMoreBtn.addEventListener('click', () => {
      renderNextExerciseBatch();
    });
  }

  document.getElementById('exerciseSearchInput').addEventListener('input', () => {
    const activePill = document.querySelector('#exerciseFilterPills .filter-pill.active');
    renderExerciseLibrary(activePill ? activePill.dataset.equipment : 'all');
  });

  document.querySelectorAll('#exerciseFilterPills .filter-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#exerciseFilterPills .filter-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderExerciseLibrary(btn.dataset.equipment);
    });
  });

  // --- 8. EXERCISE GIF MODAL ---
  function openExerciseModal(ex) {
    modalExerciseTitle.textContent = ex.exerciseTitle;
    const gifUrl = getGifUrl(ex.gifUrl);

    modalExerciseTags.innerHTML = `
      ${ex.usesWeights ? '<span class="badge badge-purple">Uses Weights</span>' : ''}
      ${ex.usesBands ? '<span class="badge badge-sand">Uses Bands</span>' : ''}
      ${!ex.usesWeights && !ex.usesBands ? '<span class="badge badge-sand">Bodyweight</span>' : ''}
    `;

    modalExerciseCues.textContent = `ID #${ex.exerciseId} • Follow the coach's movement cadence and alignment shown above.`;
    
    gifLoadingSpinner.style.display = 'block';
    modalExerciseGif.onload = () => { gifLoadingSpinner.style.display = 'none'; };
    modalExerciseGif.onerror = () => { gifLoadingSpinner.textContent = 'GIF preview offline'; };
    modalExerciseGif.src = gifUrl;

    exerciseModal.style.display = 'flex';
  }

  closeExerciseModalBtn.addEventListener('click', () => {
    exerciseModal.style.display = 'none';
    modalExerciseGif.src = '';
  });
  exerciseModal.addEventListener('click', (e) => {
    if (e.target === exerciseModal) {
      exerciseModal.style.display = 'none';
      modalExerciseGif.src = '';
    }
  });

  // --- 9. SETTINGS MODAL & MEDIA SERVER SWITCHING ---
  function openSettingsModal() {
    // Select current media server radio
    const radios = document.querySelectorAll('input[name="mediaServerChoice"]');
    radios.forEach(r => {
      if (r.value === mediaConfig.choice) r.checked = true;
    });

    // Select navigation video behavior radio
    const behavior = getNavVideoBehavior();
    const behaviorRadios = document.querySelectorAll('input[name="navVideoBehavior"]');
    behaviorRadios.forEach(r => {
      if (r.value === behavior) r.checked = true;
    });

    customServerInput.value = mediaConfig.customUrl || '';
    testServerResult.textContent = '';
    settingsModal.style.display = 'flex';
  }

  settingsBtn.addEventListener('click', openSettingsModal);
  serverStatusBadge.addEventListener('click', openSettingsModal);
  changeSourceQuickBtn.addEventListener('click', openSettingsModal);
  closeSettingsModalBtn.addEventListener('click', () => settingsModal.style.display = 'none');
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) settingsModal.style.display = 'none';
  });

  saveSettingsBtn.addEventListener('click', () => {
    const selected = document.querySelector('input[name="mediaServerChoice"]:checked').value;
    mediaConfig.choice = selected;
    mediaConfig.customUrl = customServerInput.value.trim();

    const selectedBehavior = document.querySelector('input[name="navVideoBehavior"]:checked')?.value || 'popout';
    localStorage.setItem('mvn_nav_video_behavior', selectedBehavior);

    localStorage.setItem('mvn_media_choice', mediaConfig.choice);
    localStorage.setItem('mvn_media_custom', mediaConfig.customUrl);

    updateServerBadgeDisplay();
    settingsModal.style.display = 'none';

    // If currently watching video, reload video with new source
    if (currentWorkout) {
      const currentPos = videoPlayer.currentTime;
      videoPlayer.src = getVideoUrl(currentWorkout.videoFilename);
      videoPlayer.currentTime = currentPos;
    }
  });

  testServerBtn.addEventListener('click', async () => {
    testServerResult.textContent = 'Testing connection...';
    testServerResult.className = 'test-result-message';

    const selected = document.querySelector('input[name="mediaServerChoice"]:checked').value;
    let testUrl = '';
    if (selected === 'pi3') testUrl = DEFAULT_PI3_URL;
    else if (selected === 'archimedes') testUrl = DEFAULT_ARCHIMEDES_URL;
    else if (selected === 'same_origin') testUrl = window.location.origin;
    else testUrl = customServerInput.value.trim();

    const t0 = performance.now();
    try {
      const resp = await fetch(`${testUrl}/videos/`, { method: 'GET', mode: 'cors' });
      const elapsed = Math.round(performance.now() - t0);
      if (resp.ok || resp.status === 200 || resp.status === 206 || resp.status === 403) {
        testServerResult.textContent = `✓ Connected successfully! Latency: ${elapsed}ms`;
        testServerResult.className = 'test-result-message success';
      } else {
        testServerResult.textContent = `HTTP status ${resp.status} received from ${testUrl}`;
        testServerResult.className = 'test-result-message error';
      }
    } catch (err) {
      testServerResult.textContent = `Could not reach ${testUrl}: ${err.message}`;
      testServerResult.className = 'test-result-message error';
    }
  });

  // --- 10. WELLNESS DIARY LOGIC ---
  const symptomSliders = ['hotFlashes', 'sleepQuality', 'moodScore', 'brainFog'];
  symptomSliders.forEach(id => {
    const slider = document.getElementById(id);
    const valDisplay = document.getElementById(id + 'Val');
    slider.addEventListener('input', () => {
      valDisplay.textContent = slider.value;
    });
  });

  document.getElementById('symptomForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const entry = {
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      hotFlashes: parseInt(document.getElementById('hotFlashes').value),
      sleepQuality: parseInt(document.getElementById('sleepQuality').value),
      moodScore: parseInt(document.getElementById('moodScore').value),
      brainFog: parseInt(document.getElementById('brainFog').value),
      notes: document.getElementById('symptomNotes').value.trim()
    };

    await window.mvnDB.put('symptom_logs', entry);
    alert('Entry saved to your offline diary!');
    document.getElementById('symptomNotes').value = '';
    loadDiaryHistory();
    pushUserDataToServer();
  });

  async function loadDiaryHistory() {
    const container = document.getElementById('diaryHistoryContainer');
    if (!container) return;
    const logs = await window.mvnDB.getAll('symptom_logs');

    if (logs.length === 0) {
      container.innerHTML = `
        <div class="diary-empty-state">
          <span class="empty-icon">📓</span>
          <h4>No Diary Entries Yet</h4>
          <p>Track your daily symptoms, sleep quality, and mood using the form on the left. Entries are kept securely on your device.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = logs.slice(-8).reverse().map(l => `
      <div style="background:var(--mvn-light-cream); border:1px solid var(--mvn-light-sand); border-radius:8px; padding:0.9rem; margin-bottom:0.75rem;">
        <div style="display:flex; justify-content:space-between; margin-bottom:0.4rem; font-weight:700; color:var(--mvn-purple); font-size:0.92rem;">
          <span>${l.date}</span>
          <span style="font-size:0.78rem; color:var(--mvn-gray-600);">${new Date(l.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
        </div>
        <div style="display:flex; gap:0.4rem; flex-wrap:wrap; margin-bottom:0.4rem;">
          <span class="badge badge-sand">Hot Flashes: ${l.hotFlashes}/5</span>
          <span class="badge badge-sand">Sleep: ${l.sleepQuality}/5</span>
          <span class="badge badge-sand">Mood: ${l.moodScore}/5</span>
          <span class="badge badge-sand">Fog: ${l.brainFog}/5</span>
        </div>
        ${l.notes ? `<p style="font-size:0.85rem; color:var(--mvn-dark);">${l.notes}</p>` : ''}
      </div>
    `).join('');
  }

  // Initialize
  await loadInitialData();
});
