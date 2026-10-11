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
  const DEFAULT_PI3_URL = 'http://192.168.187.103:8085';
  const DEFAULT_ARCHIMEDES_URL = 'https://data.taylorarchibald.com/menovation';
  
  const isHttpsOrRemote = window.location.protocol === 'https:' || window.location.hostname.includes('taylorarchibald.com');
  const defaultChoice = isHttpsOrRemote ? 'archimedes' : 'pi3';

  let mediaConfig = {
    choice: localStorage.getItem('mvn_media_choice') || defaultChoice,
    customUrl: localStorage.getItem('mvn_media_custom') || ''
  };

  function getMediaBaseUrl() {
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
  const videoCurrentSourceBadge = document.getElementById('videoCurrentSourceBadge');
  const changeSourceQuickBtn = document.getElementById('changeSourceQuickBtn');
  const skipBackBtn = document.getElementById('skipBackBtn');
  const skipForwardBtn = document.getElementById('skipForwardBtn');
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const speedPills = document.querySelectorAll('.speed-pill');
  const markCompleteBtn = document.getElementById('markCompleteBtn');

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

  // --- 1. VIEW SWITCHING ---
  function showView(viewId) {
    Object.keys(views).forEach(key => {
      if (views[key]) {
        views[key].style.display = (key === viewId) ? 'block' : 'none';
      }
    });

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

  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetView = tab.dataset.view;
      if (targetView) showView(targetView);
    });
  });

  brandLogoHome.addEventListener('click', () => showView('viewPrograms'));
  document.getElementById('backToProgramsBtn').addEventListener('click', () => showView('viewPrograms'));
  document.getElementById('backFromWorkoutBtn').addEventListener('click', () => {
    if (currentProgram) showView('viewProgramDetail');
    else showView('viewWorkouts');
  });

  // --- 2. DATA FETCHING ---
  async function loadInitialData() {
    try {
      const [programsResp, workoutsResp, exercisesResp] = await Promise.all([
        fetch('assets/data/programs.json').then(r => r.json()),
        fetch('assets/data/workouts_index.json').then(r => r.json()),
        fetch('assets/data/exercises.json').then(r => r.json()).catch(() => ({}))
      ]);

      programsData = programsResp;
      workoutsIndex = workoutsResp;
      exercisesData = exercisesResp;

      renderProgramsList('all');
      renderAllWorkoutsList();
      renderExerciseLibrary('all');
      loadDiaryHistory();
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

      card.addEventListener('click', () => openProgramDetail(pid));
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
  async function openProgramDetail(pid) {
    currentProgram = programsData[pid];
    if (!currentProgram) return;

    const info = currentProgram.basicInfo || {};
    const copy = currentProgram.copy || {};
    const heroCard = document.getElementById('programHeroCard');
    const workoutsListContainer = document.getElementById('programWorkoutsList');
    const workoutCountBadge = document.getElementById('programWorkoutCount');

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
          <div>
            <div class="workout-item-title">${w.title}</div>
            <div class="workout-item-subtitle">⏱️ ${w.duration} Minutes &bull; ${w.videoCategory || 'Workout'}</div>
          </div>
        </div>
        <button class="btn btn-secondary btn-sm">
          ${isDone ? 'Replay Workout' : 'Start Workout ▶'}
        </button>
      `;

      row.addEventListener('click', () => openWorkoutPlayer(w.workoutPostId));
      workoutsListContainer.appendChild(row);
    });

    showView('viewProgramDetail');
  }

  // --- 5. WORKOUT PLAYER VIEW ---
  async function openWorkoutPlayer(workoutId) {
    currentWorkout = workoutsIndex[String(workoutId)];
    if (!currentWorkout) {
      alert(`Workout #${workoutId} details not found.`);
      return;
    }

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
      theWhyText.textContent = currentWorkout.theWhy;
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

    videoPlayer.pause();
    videoPlayer.src = videoUrl;
    videoPlayer.load();

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

  // Circuit Breakdown Renderer
  function renderCircuitBreakdown(text, container) {
    // Decode HTML entities
    const decoded = text.replace(/\\u000A/g, '\n').replace(/&amp;/g, '&');
    const lines = decoded.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    let currentBlock = null;

    lines.forEach(line => {
      if (line.toLowerCase().startsWith('circuit') || line.toLowerCase().startsWith('round') || line.toLowerCase().startsWith('warm') || line.toLowerCase().startsWith('cool')) {
        currentBlock = document.createElement('div');
        currentBlock.className = 'circuit-block';
        currentBlock.innerHTML = `<div class="circuit-header-title">${line.replace(/<[^>]+>/g, '')}</div>`;
        container.appendChild(currentBlock);
      } else {
        if (!currentBlock) {
          currentBlock = document.createElement('div');
          currentBlock.className = 'circuit-block';
          currentBlock.innerHTML = `<div class="circuit-header-title">Exercises</div>`;
          container.appendChild(currentBlock);
        }

        const cleanLine = line.replace(/<[^>]+>/g, '').trim();
        const parts = cleanLine.split(/—|-/);
        const exName = parts[0].trim();
        const exDetail = parts[1] ? parts[1].trim() : '';

        // Search exercise in library for GIF
        const matchedEx = findExerciseByName(exName);

        const item = document.createElement('div');
        item.className = 'circuit-exercise-item';
        item.innerHTML = `
          <div>
            <strong>${exName}</strong>
            ${exDetail ? `<span style="color:var(--mvn-gray-600); margin-left:0.5rem; font-size:0.85rem;">(${exDetail})</span>` : ''}
          </div>
          ${matchedEx ? `<button class="view-gif-btn" data-exid="${matchedEx.exerciseId}">Move GIF 🎬</button>` : ''}
        `;

        if (matchedEx) {
          item.querySelector('.view-gif-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            openExerciseModal(matchedEx);
          });
        }

        currentBlock.appendChild(item);
      }
    });
  }

  function findExerciseByName(name) {
    if (!exercisesData || !name) return null;
    const clean = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const exercisesList = Object.values(exercisesData);

    for (const ex of exercisesList) {
      const exClean = (ex.exerciseTitle || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (exClean === clean || exClean.includes(clean) || clean.includes(exClean)) {
        return ex;
      }
    }
    return null;
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
          <button class="btn btn-secondary btn-sm" style="width: 100%;">Play Workout ▶</button>
        </div>
      `;

      card.addEventListener('click', () => openWorkoutPlayer(w.workoutPostId));
      grid.appendChild(card);
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
    // Select current radio
    const radios = document.querySelectorAll('input[name="mediaServerChoice"]');
    radios.forEach(r => {
      if (r.value === mediaConfig.choice) r.checked = true;
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
      container.innerHTML = '<p style="color:var(--mvn-gray-600); font-style:italic;">No diary entries logged yet.</p>';
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
