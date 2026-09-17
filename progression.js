/* EchoOrbit shared data model
   Real K-5 phonics scope and sequence, expressed as unlockable units.
   Loaded by both the landing page and the gameplay screen so a unit
   selected on one shows up correctly on the other. */

const progression = [
  { id:'k1', grade:'K', title:'Rhyme time', colorKey:'teal', unlocked:true,
    phonemes:[
      {ipa:'\u00e6', sp:'a', ex:'cat'},
      {ipa:'\u026a', sp:'i', ex:'pig'},
      {ipa:'\u028c', sp:'u', ex:'sun'}
    ]},
  { id:'k2', grade:'K', title:'First consonants', colorKey:'coral', unlocked:false,
    phonemes:[
      {ipa:'m', sp:'m', ex:'map'},
      {ipa:'s', sp:'s', ex:'sun'},
      {ipa:'t', sp:'t', ex:'top'}
    ]},
  { id:'g1a', grade:'1', title:'Short vowels', colorKey:'teal', unlocked:false,
    phonemes:[
      {ipa:'\u00e6', sp:'a', ex:'cat'},
      {ipa:'\u025b', sp:'e', ex:'bed'},
      {ipa:'\u0252', sp:'o', ex:'hop'}
    ]},
  { id:'g1b', grade:'1', title:'Digraphs', colorKey:'amber', unlocked:false,
    phonemes:[
      {ipa:'\u0283', sp:'sh', ex:'ship'},
      {ipa:'t\u0283', sp:'ch', ex:'chip'},
      {ipa:'\u03b8', sp:'th', ex:'thumb'}
    ]},
  { id:'g2a', grade:'2', title:'Long vowels', colorKey:'teal', unlocked:false,
    phonemes:[
      {ipa:'i\u02d0', sp:'ee', ex:'tree'},
      {ipa:'e\u026a', sp:'ai', ex:'rain'},
      {ipa:'o\u028a', sp:'oa', ex:'boat'}
    ]},
  { id:'g2b', grade:'2', title:'R-controlled', colorKey:'coral', unlocked:false,
    phonemes:[
      {ipa:'\u0251r', sp:'ar', ex:'star'},
      {ipa:'\u025cr', sp:'er', ex:'bird'},
      {ipa:'\u0254r', sp:'or', ex:'corn'}
    ]},
  { id:'g3a', grade:'3', title:'Diphthongs', colorKey:'amber', unlocked:false,
    phonemes:[
      {ipa:'a\u026a', sp:'igh', ex:'light'},
      {ipa:'a\u028a', sp:'ow', ex:'cloud'},
      {ipa:'\u0254\u026a', sp:'oi', ex:'coin'}
    ]},
  { id:'g4a', grade:'4', title:'Schwa and syllables', colorKey:'teal', unlocked:false,
    phonemes:[
      {ipa:'\u0259', sp:'a', ex:'about'},
      {ipa:'\u0259r', sp:'er', ex:'teacher'}
    ]},
  { id:'g5a', grade:'5', title:'Full IPA lab', colorKey:'coral', unlocked:false,
    phonemes:[
      {ipa:'\u0292', sp:'s', ex:'vision'},
      {ipa:'\u014b', sp:'ng', ex:'sing'},
      {ipa:'\u00f0', sp:'th', ex:'this'}
    ]}
];

const palette = {
  teal:  { fill:'#5DCAA5', dark:'#0F6E56', light:'#9FE1CB' },
  coral: { fill:'#F0997B', dark:'#993C1D', light:'#FAECE7' },
  amber: { fill:'#EF9F27', dark:'#854F0B', light:'#FAC775' }
};

function getUnitById(id){
  return progression.find(u => u.id === id) || null;
}

function getUnlockedUnits(){
  return progression.filter(u => u.unlocked);
}

// Called by both screens on load with the `unlocked` URL param so
// progress carries over between navigations without needing storage.
function applyUnlockedParam(paramString){
  if (!paramString) return;
  const ids = paramString.split(',');
  ids.forEach(id => {
    const unit = getUnitById(id);
    if (unit) unit.unlocked = true;
  });
}

// Unlocks the unit that comes right after the given one in the
// pedagogical sequence, if there is one. Returns it, or null.
function unlockNext(currentId){
  const i = progression.findIndex(u => u.id === currentId);
  if (i === -1 || i === progression.length - 1) return null;
  progression[i + 1].unlocked = true;
  return progression[i + 1];
}

function unlockedIdList(){
  return getUnlockedUnits().map(u => u.id).join(',');
}

// Falls back to the first unlocked unit if the id is missing, unknown,
// or locked -- keeps both screens safe against a bad or missing param.
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
  ['\u0252', '\u028c'],        // ɒ / ʌ   hop / sun
  ['\u0283', 't\u0283'],       // ʃ / tʃ  ship / chip
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