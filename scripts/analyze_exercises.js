const fs = require('fs');
const exData = JSON.parse(fs.readFileSync('assets/data/exercises.json', 'utf8'));
const workouts = JSON.parse(fs.readFileSync('assets/data/workouts_index.json', 'utf8'));

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

const exList = Object.values(exData);

function findExerciseByNameCurrent(name) {
  if (!name) return null;
  const clean = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!clean) return null;

  for (const ex of exList) {
    const exClean = (ex.exerciseTitle || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (exClean === clean) return ex;
  }
  for (const ex of exList) {
    const exClean = (ex.exerciseTitle || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (exClean.includes(clean) || clean.includes(exClean)) return ex;
  }
  const words = name.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);
  let bestEx = null;
  let bestScore = 0;
  for (const ex of exList) {
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

const unmatched = new Map();
let totalExercisesParsed = 0;
let totalMatched = 0;

for (const w of Object.values(workouts)) {
  const text = w.circuitsCopy || '';
  if (!text) continue;
  const cleaned = cleanText(text);
  const lines = cleaned.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  lines.forEach(line => {
    const plain = line.replace(/<[^>]+>/g, '').trim();
    if (!plain) return;
    if (/^(circuit|round|warm\s*up|cool\s*down|finisher|superset|tri-set|block|emom|amrap)/i.test(plain)) return;
    if (/^(\d+\s*(rounds?|sets?)|repeat\s*\d+\s*times?)/i.test(plain)) return;
    if (/^rest\b/i.test(plain)) return;

    totalExercisesParsed++;
    const parts = plain.split(/—|-|–/);
    const exName = parts[0].trim();
    const match = findExerciseByNameCurrent(exName);
    if (match) {
      totalMatched++;
    } else {
      unmatched.set(exName, (unmatched.get(exName) || 0) + 1);
    }
  });
}

console.log(`Total parsed exercises: ${totalExercisesParsed}, Matched: ${totalMatched} (${(totalMatched/totalExercisesParsed*100).toFixed(1)}%)`);
console.log(`Unmatched unique names: ${unmatched.size}`);
const sortedUnmatched = Array.from(unmatched.entries()).sort((a,b) => b[1] - a[1]);
console.log("Top 30 unmatched names:");
console.log(sortedUnmatched.slice(0, 30));
