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
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
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
  const miniPipBtn = document.getElementById('miniPipBtn');

  // Mini-Player State
  let isMiniPlayerActive = false;
  let isScrubbingMini = false;

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
    const cur = videoPlayer.currentTime || 0;
    const dur = videoPlayer.duration || 0;
    if (miniPlayerScrubber && dur > 0) {
      miniPlayerScrubber.value = (cur / dur) * 100;
    }
    if (miniTimeDisplay) {
      miniTimeDisplay.textContent = `${formatTime(cur)} / ${formatTime(dur)}`;
    }
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

      card.innerHTML = `
        <div class="program-card-thumb-wrapper">
          <img src="${imgSrc}" alt="${info.programTitle}" class="program-card-img" loading="lazy">
          <span class="program-card-badge">${workoutCount} Workouts</span>
        </div>
        <div class="program-card-body">
          <h3 class="program-card-title">${info.programTitle || 'Program ' + pid}</h3>
          <p class="program-card-tagline">${copy.programTaglineCopy || copy.programOverviewCopy || 'Designed for midlife strength and vitality.'}</p>
          <div class="program-meta-row">
            <span>⏱️ ${info.workoutDurationLowerBound || 20}–${info.workoutDurationUpperBound || 35} Min</span>
            <span class="badge badge-purple">${copy.marketingSummaryLineCopy ? copy.marketingSummaryLineCopy.split('•')[1] || 'All Levels' : 'All Levels'}</span>
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

    document.title = `${info.programTitle || 'Program ' + pid} | Menovation`;

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

    workoutCountBadge.textContent = `${programWorkouts.length} Workouts`;

    const bannerImg = currentProgram.assets && currentProgram.assets.featureCardImageUrl ? currentProgram.assets.featureCardImageUrl : 'assets/images/menovation-site-cover.webp';
    const equipmentItems = (info.equipmentList || []).map(eq => `<span class="equipment-chip">⚡ ${eq.itemTitle}</span>`).join('');

    heroCard.innerHTML = `
      <img src="${bannerImg}" alt="${info.programTitle}" class="program-hero-banner" loading="lazy">
      <div class="program-hero-content">
        <h1>${info.programTitle}</h1>
        <div class="program-hero-meta">
          <span class="badge badge-purple">${copy.programTaglineCopy || 'Full Program Schedule'}</span>
          <span class="badge badge-sand">⏱️ ${info.workoutDurationLowerBound || 20}&ndash;${info.workoutDurationUpperBound || 35} Min / Session</span>
        </div>
        <p class="program-hero-desc">${copy.programOverviewCopy || ''}</p>
        ${equipmentItems ? `
          <div>
            <strong>Required Equipment:</strong>
            <div class="equipment-chips">${equipmentItems}</div>
          </div>
        ` : ''}
      </div>
    `;

    // Render Workout Playlist
    workoutsListContainer.innerHTML = '';
    programWorkouts.forEach((w, index) => {
      const isDone = completedSet.has(String(w.workoutPostId));
      const row = document.createElement('div');
      row.className = 'program-workout-item';
      row.innerHTML = `
        <div class="workout-item-left">
          <div class="workout-order-circle ${isDone ? 'completed' : ''}">
            ${isDone ? '✓' : index + 1}
          </div>
          <div class="workout-item-text">
            <div class="workout-item-title">${w.title}</div>
            <div class="workout-item-subtitle">⏱️ ${w.duration} Min &bull; ${w.videoCategory || 'Workout'}</div>
          </div>
        </div>
        <div class="workout-action-pill ${isDone ? 'completed' : ''}">
          ${isDone ? 'Replay ▶' : 'Start ▶'}
        </div>
      `;

      row.addEventListener('click', () => navigateTo('#/workout/' + w.workoutPostId));
      workoutsListContainer.appendChild(row);
    });

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

    titleEl.textContent = currentWorkout.title;
    durationChip.textContent = `⏱️ ${currentWorkout.duration} Minutes`;
    diffChip.textContent = currentWorkout.videoCategory || 'All Levels';
    focusChip.textContent = currentWorkout.focus ? `Focus: Type ${currentWorkout.focus}` : 'Full Body';

    // Set program title
    const prog = programsData && programsData[String(currentWorkout.programPostId)];
    programBadge.textContent = prog ? (prog.basicInfo && prog.basicInfo.programTitle ? prog.basicInfo.programTitle : 'Program') : 'Menovation';

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
        chip.textContent = `⚡ ${eq.itemTitle}`;
        equipChips.appendChild(chip);
      });
    } else {
      equipChips.innerHTML = '<span class="equipment-chip">No special equipment required</span>';
    }

    // Parse and render circuits
    circuitsContainer.innerHTML = '';
    const rawCircuits = currentWorkout.circuitsCopy || '';
    if (rawCircuits) {
      renderCircuitBreakdown(rawCircuits, circuitsContainer);
    } else {
      circuitsContainer.innerHTML = '<p style="color:var(--mvn-gray-600); font-style:italic;">Follow along directly with the full-length video coach.</p>';
    }

    // Completion state
    const isCompleted = await window.mvnDB.get('completed_workouts', String(workoutId));
    updateCompletionButtonUI(Boolean(isCompleted));

    // Video Stream URL
    const videoUrl = getVideoUrl(currentWorkout.videoFilename);
    updateServerBadgeDisplay();

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

  // Picture in picture button for main workout player
  if (document.pictureInPictureEnabled && pipBtn) {
    pipBtn.style.display = 'inline-block';
    pipBtn.addEventListener('click', async () => {
      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else if (videoPlayer) {
          await videoPlayer.requestPictureInPicture();
        }
      } catch (err) {
        console.warn('PiP error:', err);
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

  if (document.pictureInPictureEnabled && miniPipBtn) {
    miniPipBtn.style.display = 'inline-flex';
    miniPipBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else if (videoPlayer) {
          await videoPlayer.requestPictureInPicture();
        }
      } catch (err) {
        console.warn('Mini PiP error:', err);
      }
    });
  }

  if (videoPlayer) {
    videoPlayer.addEventListener('play', updateMiniPlayerPlayPauseUI);
    videoPlayer.addEventListener('pause', updateMiniPlayerPlayPauseUI);
    videoPlayer.addEventListener('ended', updateMiniPlayerPlayPauseUI);

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

  // --- CIRCUIT BREAKDOWN RENDERER ---
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

    // Render top 120 matching for high DOM performance
    const renderLimit = 120;
    items.slice(0, renderLimit).forEach(w => {
      const card = document.createElement('div');
      card.className = 'workout-card';
      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span class="badge badge-purple">${w.videoCategory || 'Workout'}</span>
          <span style="font-size:0.8rem; font-weight:700; color:var(--mvn-gray-600);">⏱️ ${w.duration} Min</span>
        </div>
        <h4 class="workout-card-title">${w.title}</h4>
        <div class="workout-card-meta">
          <span class="meta-chip">720p HD</span>
          <span class="meta-chip">${w.equipment.length ? w.equipment[0].itemTitle : 'Bodyweight'}</span>
        </div>
        <div class="workout-card-footer">
          <button class="workout-card-play-btn">Play Workout ▶</button>
        </div>
      `;
      card.dataset.workoutId = String(w.workoutPostId);
      grid.appendChild(card);
    });
  }

  const workoutsGrid = document.getElementById('workoutsCardsGrid');
  if (workoutsGrid) {
    workoutsGrid.addEventListener('click', (e) => {
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

  // --- 7. EXERCISE LIBRARY VIEW ---
  function renderExerciseLibrary(equipFilter) {
    const grid = document.getElementById('exerciseCardsGrid');
    const summary = document.getElementById('exerciseResultsSummary');
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

    summary.textContent = `Showing ${exercises.length} of ${Object.keys(exercisesData).length} movements`;
    grid.innerHTML = '';

    // Render first 80 for smooth scrolling
    exercises.slice(0, 80).forEach(ex => {
      const card = document.createElement('div');
      card.className = 'exercise-card';
      const gifUrl = getGifUrl(ex.gifUrl);

      card.innerHTML = `
        <div class="exercise-thumb-wrapper">
          <img src="${gifUrl}" alt="${ex.exerciseTitle}" class="exercise-thumb-img" loading="lazy" onerror="this.src='assets/images/menovation-sq-purple-300.png'">
        </div>
        <div class="exercise-card-body">
          <div class="exercise-card-title">${ex.exerciseTitle}</div>
          <div style="font-size:0.75rem; color:var(--mvn-gray-600);">
            ${ex.usesWeights ? '🏋️ Weights ' : ''}${ex.usesBands ? '⚡ Bands ' : ''}${!ex.usesWeights && !ex.usesBands ? '🧘 Bodyweight' : ''}
          </div>
        </div>
      `;

      card.addEventListener('click', () => openExerciseModal(ex));
      grid.appendChild(card);
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
