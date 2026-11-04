/**
 * Menovation program search, favorites and recently viewed.
 * Keeps these enhancements separate from the production app controller.
 */
(() => {
  'use strict';
  const FAVORITES = 'mvn_program_favorites_v1:';
  const RECENTS = 'mvn_program_recent_v1:';
  const normalize = value => String(value || '').normalize('NFKD').toLowerCase().replace(/\s+/g, ' ').trim();
  const profile = () => (localStorage.getItem('mvn_synced_user') || 'guest').toLowerCase();
  function getList(prefix) {
    try {
      const data = JSON.parse(localStorage.getItem(prefix + profile()) || '[]');
      return Array.isArray(data) ? [...new Set(data.map(String).filter(v => /^\d+$/.test(v)))] : [];
    } catch (_) { return []; }
  }
  function putList(prefix, list) {
    try { localStorage.setItem(prefix + profile(), JSON.stringify(list)); } catch (_) {}
  }

  function init() {
    const view = document.getElementById('viewPrograms');
    const grid = document.getElementById('programsGrid');
    const categories = document.getElementById('programCategoryPills');
    const hero = document.getElementById('programHeroCard');
    if (!view || !grid || !categories) return;
    const tools = document.createElement('section');
    tools.className = 'program-discovery';
    tools.setAttribute('aria-label', 'Find workout programs');
    tools.innerHTML = [
      '<label class="program-search-label" for="programSearchInput">Find a program</label>',
      '<div class="program-search-field"><span class="program-search-icon" aria-hidden="true">&#8981;</span>',
      '<input type="search" id="programSearchInput" placeholder="Search programs, goals, or equipment" autocomplete="off"></div>',
      '<div class="program-discovery-tabs" role="group" aria-label="Program lists">',
      '<button type="button" class="program-discovery-tab is-active" data-program-mode="all" aria-pressed="true">All Programs <span class="program-discovery-count" data-count="all"></span></button>',
      '<button type="button" class="program-discovery-tab" data-program-mode="favorites" aria-pressed="false">&#9733; Favorites <span class="program-discovery-count" data-count="favorites"></span></button>',
      '<button type="button" class="program-discovery-tab" data-program-mode="recent" aria-pressed="false">&#8634; Recent <span class="program-discovery-count" data-count="recent"></span></button>',
      '</div>',
      '<div class="program-quick-access" id="programQuickAccess"></div>',
      '<p class="program-results-message" id="programResultsMessage" role="status" aria-live="polite" hidden></p>'
    ].join('');
    categories.before(tools);
    const input = tools.querySelector('#programSearchInput');
    const quick = tools.querySelector('#programQuickAccess');
    const message = tools.querySelector('#programResultsMessage');
    const catalog = new Map();
    const titleMap = new Map();
    let mode = 'all';
    let updateScheduled = false;

    function activeProgramId() {
      const match = window.location.hash.match(/^#\/program\/(\d+)(?:\/|$)/);
      return match && catalog.has(match[1]) ? match[1] : null;
    }
    function markRecent(id) {
      if (!catalog.has(id)) return;
      putList(RECENTS, [id, ...getList(RECENTS).filter(v => v !== id)].slice(0, 12));
      refresh();
    }
    function toggleFavorite(id) {
      if (!catalog.has(id)) return;
      const current = getList(FAVORITES);
      putList(FAVORITES, current.includes(id) ? current.filter(v => v !== id) : [...current, id]);
      refresh();
    }
    function makeStar(id, className) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = className;
      button.dataset.favoriteId = id;
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        toggleFavorite(event.currentTarget.dataset.favoriteId);
      });
      return button;
    }
    function styleStar(button, id) {
      const saved = getList(FAVORITES).includes(id);
      button.textContent = saved ? '\u2605' : '\u2606';
      button.setAttribute('aria-pressed', String(saved));
      button.setAttribute('aria-label', (saved ? 'Remove ' : 'Add ') + catalog.get(id).title + (saved ? ' from favorites' : ' to favorites'));
      button.title = saved ? 'Remove favorite' : 'Add favorite';
      button.classList.toggle('is-favorite', saved);
    }
    function decorateGrid() {
      grid.querySelectorAll('.program-card').forEach(card => {
        const title = normalize(card.querySelector('.program-card-title')?.textContent);
        const id = card.dataset.programId || titleMap.get(title);
        if (!id || !catalog.has(id)) return;
        card.dataset.programId = id;
        const wrapper = card.querySelector('.program-card-thumb-wrapper');
        if (!wrapper) return;
        let star = wrapper.querySelector('.program-favorite-btn');
        if (!star) {
          star = makeStar(id, 'program-favorite-btn');
          wrapper.append(star);
        }
        styleStar(star, id);
        const img = card.querySelector('.program-card-img');
        if (img && !catalog.get(id).image) catalog.get(id).image = img.getAttribute('src');
      });
    }
    function decorateDetail() {
      const id = activeProgramId();
      const content = hero?.querySelector('.program-hero-content');
      if (!id || !content) return;
      let star = content.querySelector('.program-hero-favorite-btn');
      if (!star) {
        star = makeStar(id, 'program-hero-favorite-btn');
        content.prepend(star);
      }
      star.dataset.favoriteId = id;
      styleStar(star, id);
    }
    function makeTile(id) {
      const entry = catalog.get(id);
      if (!entry) return null;
      const link = document.createElement('a');
      link.className = 'program-quick-tile';
      link.href = '#/program/' + id;
      const thumb = document.createElement('div');
      thumb.className = 'program-quick-thumb';
      if (entry.image) {
        const img = document.createElement('img');
        img.src = entry.image;
        img.alt = '';
        img.loading = 'lazy';
        thumb.append(img);
      }
      const text = document.createElement('span');
      text.className = 'program-quick-title';
      text.textContent = entry.title;
      const star = makeStar(id, 'program-quick-favorite');
      styleStar(star, id);
      link.append(thumb, text, star);
      link.addEventListener('click', () => markRecent(id));
      return link;
    }
    function makeShelf(title, ids, selectedMode) {
      if (!ids.length) return null;
      const section = document.createElement('section');
      section.className = 'program-quick-section';
      const top = document.createElement('div');
      top.className = 'program-quick-heading';
      const heading = document.createElement('h3');
      heading.textContent = title;
      const all = document.createElement('button');
      all.type = 'button';
      all.textContent = 'See all';
      all.addEventListener('click', () => chooseMode(selectedMode));
      top.append(heading, all);
      const row = document.createElement('div');
      row.className = 'program-quick-scroll';
      ids.slice(0, 5).forEach(id => { const tile = makeTile(id); if (tile) row.append(tile); });
      section.append(top, row);
      return section;
    }
    function chooseMode(next) {
      if (next !== 'all') {
        const allCategory = categories.querySelector('[data-category="all"]');
        if (allCategory && !allCategory.classList.contains('active')) allCategory.click();
      }
      mode = next;
      refresh();
    }
    function refresh() {
      decorateGrid();
      decorateDetail();
      const favorites = getList(FAVORITES).filter(id => catalog.has(id));
      const recent = getList(RECENTS).filter(id => catalog.has(id));
      const counts = { all: catalog.size, favorites: favorites.length, recent: recent.length };
      tools.querySelectorAll('[data-count]').forEach(el => { el.textContent = String(counts[el.dataset.count] || 0); });
      tools.querySelectorAll('[data-program-mode]').forEach(button => {
        const active = button.dataset.programMode === mode;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
      });
      categories.hidden = mode !== 'all';
      const query = normalize(input.value);
      const allowed = mode === 'favorites' ? new Set(favorites) : mode === 'recent' ? new Set(recent) : null;
      let shown = 0;
      grid.querySelectorAll('.program-card').forEach(card => {
        const id = card.dataset.programId;
        const entry = id && catalog.get(id);
        const matches = !query || normalize((entry?.title || '') + ' ' + (entry?.tagline || '')).includes(query);
        const visible = (!allowed || allowed.has(id)) && matches;
        card.hidden = !visible;
        if (visible) shown++;
        card.style.order = mode === 'recent' ? String(Math.max(0, recent.indexOf(id))) :
          mode === 'favorites' ? String(Math.max(0, favorites.indexOf(id))) : '';
      });
      message.hidden = shown > 0 || !catalog.size;
      if (!message.hidden) {
        message.textContent = query ? 'No matching programs. Try another search.' :
          mode === 'favorites' ? 'No favorites yet. Tap the star on a program to save it here.' :
          mode === 'recent' ? 'No recent programs yet. Open a program to find it here.' : 'No programs found in this category.';
      }
      quick.replaceChildren();
      if (mode === 'all' && !query) {
        const favSection = makeShelf('Favorites', favorites, 'favorites');
        const recentSection = makeShelf('Recently Viewed', recent, 'recent');
        if (favSection) quick.append(favSection);
        if (recentSection) quick.append(recentSection);
      }
    }
    function scheduleRefresh() {
      if (updateScheduled) return;
      updateScheduled = true;
      requestAnimationFrame(() => { updateScheduled = false; refresh(); });
    }
    tools.querySelectorAll('[data-program-mode]').forEach(button => {
      button.addEventListener('click', () => chooseMode(button.dataset.programMode));
    });
    input.addEventListener('input', refresh);
    categories.addEventListener('click', event => {
      if (event.target.closest('.filter-pill')) { mode = 'all'; scheduleRefresh(); }
    }, true);
    grid.addEventListener('click', event => {
      const card = event.target.closest('.program-card');
      if (card?.dataset.programId && !event.target.closest('.program-favorite-btn')) markRecent(card.dataset.programId);
    }, true);
    window.addEventListener('hashchange', () => {
      const id = activeProgramId();
      if (id) markRecent(id);
      scheduleRefresh();
    });
    new MutationObserver(scheduleRefresh).observe(grid, { childList: true });
    if (hero) new MutationObserver(scheduleRefresh).observe(hero, { childList: true });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleRefresh(); });

    fetch('assets/data/programs.json').then(response => {
      if (!response.ok) throw new Error('Program catalog HTTP ' + response.status);
      return response.json();
    }).then(data => {
      Object.entries(data).forEach(([id, p]) => {
        if (!/^\d+$/.test(id) || !p) return;
        const title = p.basicInfo?.programTitle || ('Program ' + id);
        const tagline = p.copy?.programTaglineCopy || p.copy?.programOverviewCopy || '';
        catalog.set(id, { title, tagline, image: null });
        titleMap.set(normalize(title), id);
      });
      const id = activeProgramId();
      if (id) markRecent(id);
      refresh();
    }).catch(error => console.warn('[Menovation] Program discovery unavailable:', error));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
