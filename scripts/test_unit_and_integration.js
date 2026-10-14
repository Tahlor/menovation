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
assert(!appJs.includes("Replay ▶' : 'Start ▶'"), 'Old "Start ▶" action pill completely replaced');

assert(indexHtml.includes('id="playerWorkoutFormatNotice"'), 'index.html has playerWorkoutFormatNotice container');

assert(appCss.includes('.workout-action-group'), 'app.css styles .workout-action-group');
assert(appCss.includes('.workout-preview-btn'), 'app.css styles .workout-preview-btn');
assert(appCss.includes('.workout-open-btn'), 'app.css styles .workout-open-btn');
assert(appCss.includes('.workout-card-actions'), 'app.css styles .workout-card-actions');
assert(appCss.includes('.circuit-format-banner'), 'app.css styles .circuit-format-banner');
assert(appCss.includes('.program-hero-paragraph'), 'app.css styles .program-hero-paragraph');

console.log('\n====================================================');
console.log(`TOTAL: ${passed} PASSED, ${failed} FAILED`);
console.log('====================================================');

if (failed > 0) {
  process.exit(1);
}
