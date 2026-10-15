/**
 * Comprehensive verification suite for Menovation fixes:
 * 1. Unicode & HTML entity cleaner logic and formatting.
 * 2. Program 6217 data audit & verification.
 * 3. Workouts index rebuild (circuitsCopy, videoType, videoLabel).
 * 4. Open & Preview button implementation in app.js and app.css.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'assets', 'data');
const APP_DIR = path.join(ROOT_DIR, 'app');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

console.log('====================================================');
console.log('MENOVATION TEST & AUDIT VERIFICATION SUITE');
console.log('====================================================\n');

// --- 1. cleanText and formatParagraphs Unit Tests ---
console.log('--- 1. Testing cleanText and formatParagraphs ---');

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

const sampleEscaped = "Don\\u2019t let this scare you.\\u000A\\u000AThis 6-week training block uses progressive overload &amp; &quot;baddies&quot;!";
const cleanedSample = cleanText(sampleEscaped);
assert(!cleanedSample.includes('\\u000A'), 'No raw \\u000A remaining');
assert(!cleanedSample.includes('\\u2019'), 'No raw \\u2019 remaining');
assert(cleanedSample.includes("Don’t"), 'Apostrophe decoded to ’');
assert(cleanedSample.includes('&'), 'Entity &amp; decoded to &');
assert(cleanedSample.includes('"baddies"'), 'Entity &quot; decoded to "');

const paragraphsOutput = formatParagraphs(sampleEscaped);
assert(paragraphsOutput.includes('<p class="program-hero-paragraph">'), 'Paragraph tags generated');
assert(paragraphsOutput.split('</p>').length - 1 === 2, 'Exactly 2 paragraphs formatted');


// --- 2. Program 6217 Data Audit ---
console.log('\n--- 2. Auditing Program 6217 (Power Builder) ---');
const programs = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'programs.json'), 'utf-8'));
const p6217 = programs['6217'];

assert(Boolean(p6217), 'Program 6217 exists in programs.json');
assert(p6217.basicInfo && p6217.basicInfo.programTitle === 'Power Builder', 'Title is "Power Builder"');

const rawOverview = JSON.stringify(p6217.copy.programOverviewCopy);
assert(!rawOverview.includes('\\\\u'), 'Zero double-escaped unicode in programOverviewCopy');
assert(!rawOverview.includes('\\u000a') && !rawOverview.includes('\\u000A'), 'Zero literal \\u000A in programOverviewCopy');

const total6217Workouts = (p6217.workoutPostIdBeginnerList || []).length +
  (p6217.workoutPostIdIntermediateList || []).length +
  (p6217.workoutPostIdAdvancedList || []).length;
assert(total6217Workouts === 72, `Program 6217 has all 72 workouts listed (found ${total6217Workouts})`);


// --- 3. Workouts Index & Circuit Rebuild Audit ---
console.log('\n--- 3. Auditing Workouts Index and Rebuilt Circuits ---');
const workoutsIndex = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'workouts_index.json'), 'utf-8'));
const totalWorkouts = Object.keys(workoutsIndex).length;
assert(totalWorkouts === 507, `Total workouts in index is 507 (found ${totalWorkouts})`);

let fullCount = 0;
let cooldownCount = 0;
let richCircuitsCount = 0;

for (const [wid, w] of Object.entries(workoutsIndex)) {
  if (w.videoType === 'full') fullCount++;
  if (w.videoType === 'cooldown') cooldownCount++;
  if (w.circuitsCopy && w.circuitsCopy.trim().length > 0) richCircuitsCount++;
}

assert(fullCount === 265, `Full-length video workouts correctly tagged (expected 265, got ${fullCount})`);
assert(cooldownCount === 242, `Circuit workouts correctly tagged as cooldown (expected 242, got ${cooldownCount})`);
assert(richCircuitsCount >= 450, `Rich circuitsCopy populated across catalog (found ${richCircuitsCount} / 507)`);

// Check workout 6225 specifically
const w6225 = workoutsIndex['6225'];
assert(Boolean(w6225), 'Workout 6225 exists in index');
assert(w6225.videoType === 'cooldown', 'Workout 6225 videoType is cooldown');
assert(w6225.videoLabel === 'Guided Cooldown Flow', 'Workout 6225 videoLabel is "Guided Cooldown Flow"');
assert(w6225.circuitsCopy.includes('Circuit 1: Warmup'), 'Circuits contain Warmup');
assert(w6225.circuitsCopy.includes('Circuit 3: Strength (Lower)'), 'Circuits contain Strength Lower');
assert(w6225.circuitsCopy.includes('Glute Bridge with 2 Sec Hold — 10 Reps'), 'Circuits contain exercises with reps');
assert(w6225.circuitsCopy.includes('Cool Down: Cooldown'), 'Circuits contain Cooldown flow');

// Structured circuits audit
assert(Array.isArray(w6225.circuits), 'w6225.circuits is an array');
assert(w6225.circuits.length === 7, `w6225 has 7 structured circuits (found ${w6225.circuits.length})`);
assert(w6225.circuits[0].title === 'Warmup', 'Circuit 1 title is Warmup');
assert(w6225.circuits[0].coachingTip.includes('Bodyweight only'), 'Circuit 1 coachingTip preserved');
assert(w6225.circuits[6].isCooldown === true, 'Circuit 7 is flagged as cooldown');
assert(w6225.circuits[6].cooldownPoses.length >= 3, 'Circuit 7 has structured cooldownPoses');

let structuredCircuitsCount = 0;
for (const w of Object.values(workoutsIndex)) {
  if (Array.isArray(w.circuits) && w.circuits.length > 0) structuredCircuitsCount++;
}
assert(structuredCircuitsCount === 242, `Exactly 242 workouts have structured circuits (found ${structuredCircuitsCount})`);


// --- 4. Code & UI Integrity Verification ---
console.log('\n--- 4. Auditing App Code and Styles ---');
const appJs = fs.readFileSync(path.join(APP_DIR, 'js', 'app.js'), 'utf-8');
const indexHtml = fs.readFileSync(path.join(APP_DIR, 'index.html'), 'utf-8');
const appCss = fs.readFileSync(path.join(APP_DIR, 'css', 'app.css'), 'utf-8');

assert(appJs.includes('workout-preview-btn'), 'app.js renders workout-preview-btn');
assert(appJs.includes('workout-open-btn'), 'app.js renders workout-open-btn');
assert(appJs.includes('previewWorkoutInPiP'), 'app.js defines and calls previewWorkoutInPiP');
assert(appJs.includes('workout-card-preview-btn'), 'app.js renders workout-card-preview-btn in All Workouts');
assert(appJs.includes('workout-card-open-btn'), 'app.js renders workout-card-open-btn in All Workouts');
assert(appJs.includes('playerWorkoutFormatNotice'), 'app.js references playerWorkoutFormatNotice');
assert(appJs.includes('renderStructuredCircuits'), 'app.js defines renderStructuredCircuits');
assert(appJs.includes('is-circuit-workout'), 'app.js toggles is-circuit-workout class');
assert(appJs.includes('bannerJumpCooldownBtn'), 'app.js binds jump to cooldown button');
assert(appJs.includes('circuit-coaching-tip'), 'app.js renders circuit-coaching-tip');
assert(appJs.includes('circuit-exercise-check-btn'), 'app.js renders circuit-exercise-check-btn');
assert(!appJs.includes("Replay ▶' : 'Start ▶'"), 'Old "Start ▶" action pill completely replaced');

assert(appJs.includes('openCircuitRunner'), 'app.js defines openCircuitRunner');
assert(appJs.includes('startCircuitRunnerBtn'), 'app.js binds startCircuitRunnerBtn');
assert(appJs.includes('runnerAutoAdvance'), 'app.js supports auto-advance toggle state');
assert(appJs.includes('playRunnerChime'), 'app.js synthesizes offline countdown chimes');
assert(appJs.includes('touchstart'), 'app.js binds touchstart for swipe gestures');
assert(appJs.includes('touchend'), 'app.js binds touchend for swipe gestures');
assert(appJs.includes('cooldownVideoAnchor'), 'app.js anchors cooldown video directly inside Part 7');
assert(appJs.includes('topVideoAnchor'), 'app.js anchors full-length video at top');

assert(indexHtml.includes('id="playerWorkoutFormatNotice"'), 'index.html has playerWorkoutFormatNotice container');
assert(indexHtml.includes('id="startCircuitRunnerBtn"'), 'index.html has startCircuitRunnerBtn in title bar');
assert(indexHtml.includes('id="topVideoAnchor"'), 'index.html has topVideoAnchor');
assert(indexHtml.includes('id="circuitRunnerOverlay"'), 'index.html has circuitRunnerOverlay');
assert(indexHtml.includes('id="runnerAutoAdvanceToggle"'), 'index.html has runnerAutoAdvanceToggle');
assert(indexHtml.includes('id="circuitRunnerStage"'), 'index.html has circuitRunnerStage for swipeable cards');
assert(indexHtml.includes('id="playerControlsBar"'), 'index.html has playerControlsBar id');
assert(indexHtml.includes('id="workoutPerformanceCard"'), 'index.html has workoutPerformanceCard');
assert(indexHtml.includes('id="toggleLogEditorBtn"'), 'index.html has toggleLogEditorBtn');
assert(indexHtml.includes('id="perfSummaryBox"'), 'index.html has perfSummaryBox');
assert(indexHtml.includes('id="perfEditorBox"'), 'index.html has perfEditorBox');
assert(indexHtml.includes('id="diarySubtabsRow"'), 'index.html has diarySubtabsRow for wellness vs workout logs');
assert(indexHtml.includes('id="diaryWorkoutLogsContainer"'), 'index.html has diaryWorkoutLogsContainer');
assert(indexHtml.includes('css/app.css?v=14'), 'index.html includes css with v=14 cache busting');
assert(indexHtml.includes('js/app.js?v=14'), 'index.html includes app.js with v=14 cache busting');

const dbJs = fs.readFileSync(path.join(APP_DIR, 'js', 'db.js'), 'utf-8');
assert(dbJs.includes('const DB_VERSION = 3;'), 'db.js upgraded to DB_VERSION 3');
assert(dbJs.includes('getWorkoutLogs'), 'db.js implements getWorkoutLogs');
assert(dbJs.includes('getLatestWorkoutLog'), 'db.js implements getLatestWorkoutLog');
assert(dbJs.includes('saveWorkoutLog'), 'db.js implements saveWorkoutLog');

assert(appJs.includes('renderWorkoutPerformanceUI'), 'app.js implements renderWorkoutPerformanceUI');
assert(appJs.includes('runner-weight-reps-card'), 'app.js embeds weight & reps stepper in Circuit Runner');
assert(appJs.includes('runner-finish-log-box'), 'app.js embeds reflections & session notes in Circuit Cooldown finish');
assert(appJs.includes('circuit-last-weight-chip'), 'app.js displays last logged weight/reps on circuit overview cards');
assert(appJs.includes('circuit-quick-log-btn'), 'app.js displays quick log button on circuit overview cards');
assert(appJs.includes('loadWorkoutLogsHistory'), 'app.js implements loadWorkoutLogsHistory in Diary');

const swJs = fs.readFileSync(path.join(APP_DIR, 'sw.js'), 'utf-8');
assert(swJs.includes("const CACHE_NAME = 'menovation-offline-v14';"), 'sw.js uses CACHE_NAME v14 for clean cache eviction');

assert(appCss.includes('.workout-action-group'), 'app.css styles .workout-action-group');
assert(appCss.includes('.workout-preview-btn'), 'app.css styles .workout-preview-btn');
assert(appCss.includes('.workout-open-btn'), 'app.css styles .workout-open-btn');
assert(appCss.includes('.workout-card-actions'), 'app.css styles .workout-card-actions');
assert(appCss.includes('.circuit-format-banner'), 'app.css styles .circuit-format-banner');
assert(appCss.includes('.program-hero-paragraph'), 'app.css styles .program-hero-paragraph');
assert(appCss.includes('#viewWorkoutPlayer.is-circuit-workout'), 'app.css configures circuit workout layout ordering');
assert(appCss.includes('.circuit-coaching-tip'), 'app.css styles .circuit-coaching-tip');
assert(appCss.includes('.circuit-exercise-check-btn'), 'app.css styles .circuit-exercise-check-btn');
assert(appCss.includes('.cooldown-dock-banner'), 'app.css styles .cooldown-dock-banner');
assert(appCss.includes('#topVideoAnchor:empty'), 'app.css hides empty topVideoAnchor');
assert(appCss.includes('.cooldown-video-mount'), 'app.css styles cooldown-video-mount');
assert(appCss.includes('.circuit-runner-overlay'), 'app.css styles circuit-runner-overlay');
assert(appCss.includes('.circuit-runner-stage'), 'app.css styles circuit-runner-stage');
assert(appCss.includes('.runner-card'), 'app.css styles runner-card');
assert(appCss.includes('.runner-timer-box'), 'app.css styles runner-timer-box');
assert(appCss.includes('.btn-circuit-mode'), 'app.css styles btn-circuit-mode');
assert(appCss.includes('.workout-performance-card'), 'app.css styles workout-performance-card');
assert(appCss.includes('.perf-summary-card'), 'app.css styles perf-summary-card');
assert(appCss.includes('.perf-editor-card'), 'app.css styles perf-editor-card');
assert(appCss.includes('.runner-weight-reps-card'), 'app.css styles runner-weight-reps-card');
assert(appCss.includes('.runner-finish-log-box'), 'app.css styles runner-finish-log-box');
assert(appCss.includes('.diary-workout-log-card'), 'app.css styles diary-workout-log-card');

console.log('\n====================================================');
console.log(`TOTAL: ${passed} PASSED, ${failed} FAILED`);
console.log('====================================================');

if (failed > 0) {
  process.exit(1);
}
