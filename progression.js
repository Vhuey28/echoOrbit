/* EchoOrbit shared data model.

   A real K-5 phonics scope and sequence, expressed as unlockable units.
   Loaded by every screen so a unit selected on one shows up correctly on
   the others.

   Each phoneme carries four things beyond its symbol:
     words  -- example words, first one is the word the game speaks
     mouth  -- how the sound is physically made, drawn as a mouth diagram
     tip    -- a kid-sized instruction for making it
     voiced -- whether the vocal cords buzz (the "hand on your throat" cue)
   The mouth/tip/voiced fields are what turn this from a symbol-matching
   game into actual pronunciation practice. */

const progression = [
  { id:'k1', grade:'K', title:'Short vowel sounds', colorKey:'teal', unlocked:true,
    phonemes:[
      { ipa:'\u00e6', sp:'a', words:['cat','hat','apple'], voiced:true,
        mouth:{ open:0.95, round:0.1, tongue:{ x:0.15, y:0.85 } },
        tip:'Drop your jaw and open wide, like at the dentist.' },
      { ipa:'\u026a', sp:'i', words:['pig','sit','fish'], voiced:true,
        mouth:{ open:0.35, round:0.05, tongue:{ x:0.2, y:0.25 } },
        tip:'A tiny, quick smile sound. Lips barely open.' },
      { ipa:'\u028c', sp:'u', words:['sun','cup','bug'], voiced:true,
        mouth:{ open:0.55, round:0.1, tongue:{ x:0.5, y:0.55 } },
        tip:'Relaxed and short, like an "uh" when you shrug.' }
    ]},

  { id:'k2', grade:'K', title:'First consonants', colorKey:'coral', unlocked:false,
    phonemes:[
      { ipa:'m', sp:'m', words:['map','mom','mouse'], voiced:true, air:'nose',
        mouth:{ open:0, round:0.15, tongue:{ x:0.5, y:0.6 } },
        tip:'Press your lips together and hum through your nose.' },
      { ipa:'s', sp:'s', words:['sun','sit','bus'], voiced:false, air:'teeth',
        mouth:{ open:0.12, round:0.05, teeth:true, tongue:{ x:0.15, y:0.2 } },
        tip:'Teeth almost touching, blow a snake hiss: sss.' },
      { ipa:'t', sp:'t', words:['top','tap','hat'], voiced:false, air:'teeth',
        mouth:{ open:0.2, round:0.05, teeth:true, tongue:{ x:0.12, y:0.12 } },
        tip:'Tap the ridge behind your top teeth and let go fast.' }
    ]},

  { id:'g1a', grade:'1', title:'More short vowels', colorKey:'teal', unlocked:false,
    phonemes:[
      { ipa:'\u025b', sp:'e', words:['bed','red','egg'], voiced:true,
        mouth:{ open:0.6, round:0.1, tongue:{ x:0.2, y:0.55 } },
        tip:'Half open, like the start of a yawn.' },
      { ipa:'\u0251', sp:'o', words:['hop','dog','fox'], voiced:true,
        mouth:{ open:0.8, round:0.35, tongue:{ x:0.85, y:0.8 } },
        tip:'Open round mouth, tongue pulled back.' },
      { ipa:'\u028a', sp:'oo', words:['book','look','put'], voiced:true,
        mouth:{ open:0.3, round:0.7, tongue:{ x:0.85, y:0.25 } },
        tip:'Push your lips into a little circle.' }
    ]},

  { id:'g1b', grade:'1', title:'Digraphs', colorKey:'amber', unlocked:false,
    phonemes:[
      { ipa:'\u0283', sp:'sh', words:['ship','shop','fish'], voiced:false,
        mouth:{ open:0.15, round:0.65, tongue:{ x:0.3, y:0.2 } },
        tip:'Round your lips and hush someone: shhh.' },
      { ipa:'t\u0283', sp:'ch', words:['chip','chat','lunch'], voiced:false,
        mouth:{ open:0.2, round:0.6, tongue:{ x:0.25, y:0.15 } },
        tip:'Start with a t, then let it puff out into sh: ch-ch.' },
      { ipa:'\u03b8', sp:'th', words:['thumb','thin','math'], voiced:false, air:'teeth',
        mouth:{ open:0.18, round:0.05, teeth:true, tongueOut:true, tongue:{ x:0.05, y:0.45 } },
        tip:'Put your tongue tip gently between your teeth and blow.' }
    ]},

  { id:'g2a', grade:'2', title:'Long vowels', colorKey:'teal', unlocked:false,
    phonemes:[
      { ipa:'i\u02d0', sp:'ee', words:['tree','see','eat'], voiced:true,
        mouth:{ open:0.28, round:0.05, tongue:{ x:0.12, y:0.15 } },
        tip:'Stretch it long with a big smile: eeee.' },
      { ipa:'e\u026a', sp:'ai', words:['rain','cake','day'], voiced:true,
        mouth:{ open:0.5, round:0.15, tongue:{ x:0.25, y:0.4 } },
        tip:'Start open, then slide up into a smile: ay.' },
      { ipa:'o\u028a', sp:'oa', words:['boat','home','go'], voiced:true,
        mouth:{ open:0.55, round:0.5, tongue:{ x:0.7, y:0.45 } },
        tip:'Start round, then close your lips at the end: oh-oo.' }
    ]},

  { id:'g2b', grade:'2', title:'R-controlled', colorKey:'coral', unlocked:false,
    phonemes:[
      { ipa:'\u0251r', sp:'ar', words:['star','car','farm'], voiced:true,
        mouth:{ open:0.75, round:0.3, tongue:{ x:0.8, y:0.75 } },
        tip:'Open wide like "ah", then curl your tongue back for the r.' },
      { ipa:'\u025cr', sp:'er', words:['bird','her','girl'], voiced:true,
        mouth:{ open:0.4, round:0.3, tongue:{ x:0.6, y:0.5 } },
        tip:'A grumpy pirate growl with the tongue floating in the middle.' },
      { ipa:'\u0254r', sp:'or', words:['corn','fork','horse'], voiced:true,
        mouth:{ open:0.65, round:0.6, tongue:{ x:0.85, y:0.65 } },
        tip:'Round your lips, then curl back for the r.' }
    ]},

  { id:'g3a', grade:'3', title:'Diphthongs', colorKey:'amber', unlocked:false,
    phonemes:[
      { ipa:'a\u026a', sp:'igh', words:['light','my','sky'], voiced:true,
        mouth:{ open:0.85, round:0.15, tongue:{ x:0.3, y:0.8 } },
        tip:'Open wide, then slide up to a smile: ah-ee.' },
      { ipa:'a\u028a', sp:'ow', words:['cloud','cow','house'], voiced:true,
        mouth:{ open:0.85, round:0.4, tongue:{ x:0.5, y:0.75 } },
        tip:'Open wide, then push your lips into a circle: ah-oo.' },
      { ipa:'\u0254\u026a', sp:'oi', words:['coin','boy','oil'], voiced:true,
        mouth:{ open:0.6, round:0.55, tongue:{ x:0.8, y:0.6 } },
        tip:'Start round, then slide forward to a smile: aw-ee.' }
    ]},

  { id:'g4a', grade:'4', title:'Schwa and syllables', colorKey:'teal', unlocked:false,
    phonemes:[
      { ipa:'\u0259', sp:'a', words:['about','pizza','sofa'], voiced:true,
        mouth:{ open:0.3, round:0.15, tongue:{ x:0.5, y:0.5 } },
        tip:'The lazy sound: relax your whole mouth and barely say "uh".' },
      { ipa:'\u0259r', sp:'er', words:['teacher','sister','water'], voiced:true,
        mouth:{ open:0.35, round:0.25, tongue:{ x:0.6, y:0.5 } },
        tip:'A soft, sleepy "er" at the end of a long word.' }
    ]},

  { id:'g5a', grade:'5', title:'Full IPA lab', colorKey:'coral', unlocked:false,
    phonemes:[
      { ipa:'\u0292', sp:'s', words:['vision','treasure','measure'], voiced:true,
        mouth:{ open:0.15, round:0.6, tongue:{ x:0.3, y:0.2 } },
        tip:'Same lips as "sh", but let your voice buzz through it.' },
      { ipa:'\u014b', sp:'ng', words:['sing','ring','king'], voiced:true, air:'nose',
        mouth:{ open:0.3, round:0.1, tongue:{ x:0.9, y:0.25 } },
        tip:'Push the back of your tongue up and hum through your nose.' },
      { ipa:'\u00f0', sp:'th', words:['this','that','mother'], voiced:true, air:'teeth',
        mouth:{ open:0.18, round:0.05, teeth:true, tongueOut:true, tongue:{ x:0.05, y:0.45 } },
        tip:'Tongue between your teeth, but this time make it buzz.' }
    ]}
];

/* `ink` is the only colour that is dark enough to read as text sitting
   on top of the light bubble fill. `dark`/`light` are for shading. */
const palette = {
  teal:  { fill:'#5DCAA5', dark:'#0F6E56', light:'#9FE1CB', ink:'#073026' },
  coral: { fill:'#F0997B', dark:'#993C1D', light:'#FAECE7', ink:'#4A1C0C' },
  amber: { fill:'#EF9F27', dark:'#854F0B', light:'#FAC775', ink:'#4A2B04' }
};

function getUnitById(id){
  return progression.find(u => u.id === id) || null;
}

function getUnlockedUnits(){
  return progression.filter(u => u.unlocked);
}

// The word the game speaks for a phoneme is always the first in its list.
function primaryWord(p){
  return (p.words && p.words[0]) || '';
}

function findPhoneme(ipa){
  for (const u of progression){
    const found = u.phonemes.find(p => p.ipa === ipa);
    if (found) return found;
  }
  return null;
}

/* ---------- persisted progress ----------
   Progress used to live only in the `unlocked` URL param, so a refresh
   or a shared link sent the kid back to square one. It is now written to
   localStorage on every change, with the URL param kept as a fallback
   for browsers where storage is blocked (private mode, some school
   filters). Every access is wrapped because storage can throw. */
const PROGRESS_KEY = 'echoorbit.progress.v1';
const completedUnits = [];   // ids finished in order
const bestScores = {};       // unit id -> best score

function readProgress(){
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function saveProgress(){
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify({
      unlocked: unlockedIdList().split(','),
      completed: completedUnits,
      bestScores: bestScores
    }));
  } catch (e) { /* storage unavailable -- keep playing, just no memory */ }
}

function restoreProgress(){
  const saved = readProgress();
  if (!saved) return false;
  (saved.unlocked || []).forEach(id => {
    const unit = getUnitById(id);
    if (unit) unit.unlocked = true;
  });
  (saved.completed || []).forEach(id => {
    if (!completedUnits.includes(id)) completedUnits.push(id);
  });
  Object.assign(bestScores, saved.bestScores || {});
  return true;
}

// Called by every screen on load with the `unlocked` URL param so
// progress also carries across navigations.
function applyUnlockedParam(paramString){
  if (!paramString) return;
  paramString.split(',').forEach(id => {
    const unit = getUnitById(id);
    if (unit) unit.unlocked = true;
  });
  saveProgress();
}

function markComplete(unitId, score){
  if (!completedUnits.includes(unitId)) completedUnits.push(unitId);
  if (typeof score === 'number' && (bestScores[unitId] || 0) < score){
    bestScores[unitId] = score;
  }
  saveProgress();
}

function isCompleted(unitId){
  return completedUnits.includes(unitId);
}

function getBestScore(unitId){
  return bestScores[unitId] || 0;
}

// Unlocks the unit that comes right after the given one in the
// pedagogical sequence, if there is one. Returns it, or null.
function unlockNext(currentId){
  const i = progression.findIndex(u => u.id === currentId);
  if (i === -1 || i === progression.length - 1) return null;
  progression[i + 1].unlocked = true;
  saveProgress();
  return progression[i + 1];
}

// The furthest unit the player has reached, in sequence order. Used as
// the default when landing on the home screen so "Play" resumes where
// they left off instead of restarting at kindergarten.
function furthestUnlockedUnit(){
  let best = progression[0];
  progression.forEach(u => { if (u.unlocked) best = u; });
  return best;
}

function unlockedIdList(){
  return getUnlockedUnits().map(u => u.id).join(',');
}

// Falls back to the first unlocked unit if the id is missing, unknown,
// or locked -- keeps every screen safe against a bad or missing param.
function resolveUnit(id){
  const unit = getUnitById(id);
  if (unit && unit.unlocked) return unit;
  return getUnlockedUnits()[0] || progression[0];
}

/* ---------- pedagogical confusion pairs ----------
   Real phonics discrimination pairs -- sounds kids commonly mix up
   because they're acoustically or visually similar (minimal pairs,
   voiced/voiceless cognates, short/long vowel counterparts, etc).
   Used to bias distractor selection in gameplay toward sounds that
   are actually worth discriminating, instead of arbitrary ones. */
const confusionPairs = [
  ['\u00e6', '\u025b'],        // æ / ɛ   cat / bed
  ['\u026a', '\u025b'],        // ɪ / ɛ   pig / bed
  ['\u026a', 'i\u02d0'],       // ɪ / iː  pig / tree (short vs long i)
  ['\u0251', '\u028c'],        // ɑ / ʌ   hop / sun
  ['\u028a', 'o\u028a'],       // ʊ / oʊ  book / boat
  ['\u0283', 't\u0283'],       // ʃ / tʃ  ship / chip
  ['t', 't\u0283'],            // t / tʃ  top / chip
  ['\u03b8', '\u00f0'],        // θ / ð   thumb / this (voiceless/voiced pair)
  ['s', '\u0283'],             // s / ʃ   sun / ship
  ['e\u026a', '\u025b'],       // eɪ / ɛ  rain / bed
  ['\u0251r', '\u025cr'],      // ɑr / ɜr star / bird
  ['\u0251r', '\u0254r'],      // ɑr / ɔr star / corn
  ['\u025cr', '\u0254r'],      // ɜr / ɔr bird / corn
  ['a\u026a', 'e\u026a'],      // aɪ / eɪ light / rain
  ['a\u028a', '\u0254\u026a'], // aʊ / ɔɪ cloud / coin
  ['a\u026a', 'a\u028a'],      // aɪ / aʊ light / cloud
  ['\u0259', '\u028c'],        // ə / ʌ   about / sun (schwa vs short u)
  ['\u0259', '\u0259r'],       // ə / ər  about / teacher
  ['\u0259r', '\u025cr'],      // ər / ɜr teacher / bird
  ['\u0292', '\u0283']         // ʒ / ʃ   vision / ship (voiced/voiceless pair)
];

const confusionMap = {};
confusionPairs.forEach(([a, b]) => {
  (confusionMap[a] = confusionMap[a] || []).push(b);
  (confusionMap[b] = confusionMap[b] || []).push(a);
});

function getConfusablePhonemes(ipa){
  return confusionMap[ipa] || [];
}

// Finds which unit a phoneme belongs to. Restricting to unlocked units
// (the default) keeps distractors from ever showing a symbol the
// player hasn't actually been taught yet.
function findPhonemeSource(ipa, unlockedOnly){
  for (const u of progression){
    if (unlockedOnly && !u.unlocked) continue;
    const found = u.phonemes.find(p => p.ipa === ipa);
    if (found) return { phoneme: found, unit: u };
  }
  return null;
}
