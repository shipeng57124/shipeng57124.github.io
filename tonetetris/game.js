// ----------------------- 基本配置 -----------------------
const TONES = [
  { tone: 1, key: '1', colIndex: 0, color: '#ff4d4f', symbol: '¯', zh: '一声',  en: '1st' },
  { tone: 2, key: '2', colIndex: 1, color: '#40a9ff', symbol: 'ˊ', zh: '二声',  en: '2nd' },
  { tone: 3, key: '3', colIndex: 2, color: '#fadb14', symbol: 'ˇ', zh: '三声',  en: '3rd' },
  { tone: 4, key: '4', colIndex: 3, color: '#73d13d', symbol: 'ˋ', zh: '四声',  en: '4th' },
  { tone: 5, key: '5', colIndex: 4, color: '#9254de', symbol: '',   zh: '轻声',  en: 'neutral' },
];

const COL_TONE_BY_INDEX = [1, 2, 3, 4, 5];
const MAX_ROWS = 12;
const CHAR_TIMEOUT_MS = 0;         // 关闭基于时间的字超时，改为随掉落判定
const FALL_SPEED = 45;             // 掉落速度（像素/秒，更慢适配移动端）
const FALLING_COLOR = '#111';      // 空中方块颜色（不暴露声调）
const FALLING_TEXT_COLOR = '#f5f5f5';

const TEXTS = {
  zh: {
    title: '声调方块',
    welcome: '点击下面的按钮进入游戏，然后先选择等级，再选择词库开始练习。',
    enter: '进入游戏',
    levelLabel: '选择等级：',
    deckLabel: '选择词库：',
    start: '开始游戏',
    showSetup: '显示设置',
    hideSetup: '隐藏设置',
    score: '分数：',
    combo: '连击：',
    time: '用时：',
    ready: '选择一个等级和词库，然后点击“开始游戏”。\n键盘 1–5 输入声调。\n按错会在对应声调列生成彩色方块。\n如果放着不管，未输入的字会让底部整体升高几层作为惩罚。',
    gameOver: '游戏结束！',
    gameClear: '字词用完，游戏结束！',
    current: '当前：',
    langBtn: 'English',
    recordsTitle: '当前词库成绩',
    modalTitle: '本局成绩',
    nameLabel: '请输入名字：',
    save: '保存成绩',
    close: '关闭'
  },
  en: {
    title: 'Tone Blocks',
    welcome: 'Click below to enter the game, then choose level and deck.',
    enter: 'Enter Game',
    levelLabel: 'Level:',
    deckLabel: 'Deck:',
    start: 'Start',
    showSetup: 'Show setup',
    hideSetup: 'Hide setup',
    score: 'Score:',
    combo: 'Combo:',
    time: 'Time:',
    ready: 'Choose a level and a deck, then click "Start".\nUse keys 1–5 to input tones.\nWrong input creates a coloured block in that tone column.\nIf you ignore a drop, the playfield will rise a few rows as a penalty instead of piling random blocks.',
    gameOver: 'Game Over!',
    gameClear: 'All words used. Game finished.',
    current: 'Current:',
    langBtn: '中文',
    recordsTitle: 'Leaderboard for this deck',
    modalTitle: 'Result',
    nameLabel: 'Your name:',
    save: 'Save',
    close: 'Close'
  }
};

const STORAGE_KEY = 'tone_tetris_records_v2';

// ----------------------- DOM -----------------------
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const welcomePanel   = document.getElementById('welcome-panel');
const welcomeText    = document.getElementById('welcome-text');
const setupToggle    = document.getElementById('setup-toggle');

const levelSelect    = document.getElementById('level-select');
const deckSelect     = document.getElementById('deck-select');
const startBtn       = document.getElementById('start-btn');
const scoreSpan      = document.getElementById('score');
const comboSpan      = document.getElementById('combo');
const timeSpan       = document.getElementById('time');
const statusLabel    = document.getElementById('status-label');
const currentTextLabel = document.getElementById('current-text-label');
const infoDiv        = document.getElementById('info');
const titleEl        = document.getElementById('title');
const levelLabelEl   = document.getElementById('level-label');
const deckLabelEl    = document.getElementById('deck-label');
const scoreLabelEl   = document.getElementById('score-label');
const comboLabelEl   = document.getElementById('combo-label');
const timerLabelEl   = document.querySelector('#timer');
const langBtn        = document.getElementById('lang-btn');
const toneButtonsDiv = document.getElementById('tone-buttons');

const recordsTitleEl = document.getElementById('records-title');
const recordsListEl  = document.getElementById('records-list');

const resultModal      = document.getElementById('result-modal');
const modalTitleEl     = document.getElementById('modal-title');
const modalSummaryEl   = document.getElementById('modal-summary');
const nameLabelEl      = document.getElementById('name-label');
const playerNameInput  = document.getElementById('player-name');
const saveResultBtn    = document.getElementById('save-result-btn');
const closeResultBtn   = document.getElementById('close-result-btn');

let currentLang = 'zh';

// ----------------------- 游戏状态 -----------------------
const gameState = {
  categories: new Map(),   // HSK1 -> [deckId...]
  decksById: new Map(),    // deckId -> {id, category, displayName, entries}

  currentCategory: null,
  currentDeckId: null,

  phraseQueue: [],
  currentPhrase: null,
  currentCharIndex: 0,

  awaitingInput: false,
  gameOver: false,
  score: 0,
  combo: 0,

  board: [[], [], [], [], []],     // 固定方块
  fallingBlocks: [],               // 正在掉落的方块
  currentPhraseId: null,

  audioObj: null,

  startTime: null,
  timerHandle: null,
  lastElapsedSec: 0,

  charTimeoutHandle: null,
  lastNoInputColumnIdx: null,

  lastFrameTime: null
};

// ----------------------- UI 多语言 -----------------------
function buildToneButtons() {
  toneButtonsDiv.innerHTML = '';
  TONES.forEach(t => {
    const btn = document.createElement('button');
    btn.className = 'tone-btn';
    btn.style.background = t.color;
    btn.dataset.tone = String(t.tone);
    const symbol = t.tone === 5 ? '&nbsp;' : (t.symbol || t.tone);
    btn.innerHTML = `
      <div class="tone-symbol">${symbol}</div>
      <div class="tone-name">${currentLang === 'zh' ? t.zh : t.en}</div>
    `;
    btn.addEventListener('click', () => handleToneInput(t.tone));
    toneButtonsDiv.appendChild(btn);
  });
}

function updateSetupToggleLabel() {
  const t = TEXTS[currentLang];
  const hidden = welcomePanel.style.display === 'none';
  setupToggle.textContent = hidden ? t.showSetup : t.hideSetup;
}

function updateLanguageUI() {
  const t = TEXTS[currentLang];
  titleEl.textContent = t.title;
  welcomeText.textContent = t.welcome;
  levelLabelEl.textContent = t.levelLabel;
  deckLabelEl.textContent  = t.deckLabel;
  startBtn.textContent = t.start;
  document.getElementById('score-label').firstChild.textContent = t.score;
  document.getElementById('combo-label').firstChild.textContent = t.combo;
  timerLabelEl.firstChild.textContent = t.time;
  langBtn.textContent = t.langBtn;
  recordsTitleEl.textContent = t.recordsTitle;
  modalTitleEl.textContent = t.modalTitle;
  nameLabelEl.textContent = t.nameLabel;
  saveResultBtn.textContent = t.save;
  closeResultBtn.textContent = t.close;

  infoDiv.textContent = t.ready;
  buildToneButtons();
  renderRecords();
  updateSetupToggleLabel();
}

langBtn.addEventListener('click', () => {
  currentLang = currentLang === 'zh' ? 'en' : 'zh';
  updateLanguageUI();
});

setupToggle.addEventListener('click', () => {
  const hidden = welcomePanel.style.display === 'none';
  welcomePanel.style.display = hidden ? 'block' : 'none';
  updateSetupToggleLabel();
});

// ----------------------- JSON + 音频路径 -----------------------
async function loadJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to load ' + url + ': ' + res.status);
  return res.json();
}

function extractToneSequenceFromId(id) {
  const parts = id.split('_');
  const tones = [];
  for (const p of parts) {
    const m = p.match(/([1-5])$/);
    if (m) tones.push(parseInt(m[1], 10));
    else tones.push(5);
  }
  return tones;
}

function buildCharsForEntry(entry) {
  const text = entry.text;
  const tones = extractToneSequenceFromId(entry.id);
  const len = Math.min(text.length, tones.length);
  const chars = [];
  for (let i = 0; i < len; i++) {
    chars.push({ char: text[i], tone: tones[i] });
  }
  return chars;
}

function deriveAudioUrl(datasetPath, originalAudioPath) {
  const folder = datasetPath.replace(/\.json$/i, '');
  const base = originalAudioPath.split(/[\\/]/).pop();
  return folder + '/' + base;
}

async function loadAllDatasets() {
  const manifest = await loadJSON('manifest.json');
  const paths = manifest.datasets || [];

  const categories = new Map();
  const decksById = new Map();
  const errors = [];

  for (const path of paths) {
    try {
      const fileName = path.split('/').pop(); // hsk110.json
      const m = fileName.match(/^([a-zA-Z]+)(\d+)/);
      if (!m) continue;
      const prefix = m[1];
      const num = m[2];
      const levelDigit = num[0];
      const categoryKey = (prefix + levelDigit).toUpperCase(); // HSK1
      const deckId = fileName.replace(/\.json$/i, '');

      const data = await loadJSON(path);
      data.forEach(entry => {
        entry.audioUrl = deriveAudioUrl(path, entry.audio || '');
      });

      decksById.set(deckId, {
        id: deckId,
        category: categoryKey,
        displayName: deckId.toUpperCase(),
        entries: data
      });

      if (!categories.has(categoryKey)) categories.set(categoryKey, []);
      categories.get(categoryKey).push(deckId);
    } catch (e) {
      console.warn('Load dataset failed:', path, e);
      errors.push(path);
    }
  }

  for (const [cat, ids] of categories.entries()) {
    ids.sort();
  }

  gameState.categories = categories;
  gameState.decksById  = decksById;

  // 填充 levelSelect
  levelSelect.innerHTML = '';
  const categoryKeys = Array.from(categories.keys()).sort();
  for (const cat of categoryKeys) {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    levelSelect.appendChild(opt);
  }
  if (categoryKeys.length > 0) {
    gameState.currentCategory = categoryKeys[0];
    populateDeckSelectForCategory(gameState.currentCategory);
  }

  const t = TEXTS[currentLang];
  let msg = `已加载等级：${categoryKeys.join(', ') || '（无）'}`;
  if (errors.length > 0) {
    msg += `\n以下文件加载失败（忽略）：\n` + errors.join('\n');
  }
  infoDiv.textContent = msg + '\n\n' + t.ready;
}

function populateDeckSelectForCategory(categoryKey) {
  const deckIds = gameState.categories.get(categoryKey) || [];
  deckSelect.innerHTML = '';
  deckIds.forEach(id => {
    const deck = gameState.decksById.get(id);
    if (!deck) return;
    const opt = document.createElement('option');
    opt.value = deck.id;
    opt.textContent = deck.displayName;
    deckSelect.appendChild(opt);
  });
  gameState.currentDeckId = deckIds.length ? deckIds[0] : null;
}

// ----------------------- 计时 & 字超时 -----------------------
function startTimer() {
  gameState.startTime = performance.now();
  gameState.lastElapsedSec = 0;
  if (gameState.timerHandle) clearInterval(gameState.timerHandle);
  gameState.timerHandle = setInterval(() => {
    if (!gameState.startTime) return;
    const elapsed = (performance.now() - gameState.startTime) / 1000;
    gameState.lastElapsedSec = elapsed;
    timeSpan.textContent = elapsed.toFixed(1);
  }, 100);
}
function stopTimer() {
  if (gameState.timerHandle) {
    clearInterval(gameState.timerHandle);
    gameState.timerHandle = null;
  }
  if (gameState.startTime) {
    const elapsed = (performance.now() - gameState.startTime) / 1000;
    gameState.lastElapsedSec = elapsed;
    timeSpan.textContent = elapsed.toFixed(1);
  }
}
function scheduleCharTimeout() {
  clearTimeout(gameState.charTimeoutHandle);
  if (CHAR_TIMEOUT_MS <= 0) return;
  gameState.charTimeoutHandle = setTimeout(() => {
    handleNoInputTimeout();
  }, CHAR_TIMEOUT_MS);
}

// ----------------------- 简单音效（无需外部文件） -----------------------
const SFX_FILES = {
  hit: 'sfx/hit.mp3',
  miss: 'sfx/miss.mp3',
  wrong: 'sfx/wrong.mp3'
};

let sfxContext = null;
const sfxCache = {};

function playBeep(freq = 880, duration = 0.08) {
  try {
    if (!sfxContext) sfxContext = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = sfxContext;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.value = 0.15;
    osc.connect(gain).connect(ctx.destination);
    const now = ctx.currentTime;
    osc.start(now);
    osc.stop(now + duration);
  } catch (e) {
    console.warn('sfx failed', e);
  }
}

function preloadSfx() {
  Object.entries(SFX_FILES).forEach(([key, path]) => {
    const audio = new Audio(path);
    audio.preload = 'auto';
    sfxCache[key] = audio;
  });
}

function playSfx(name, fallbackFreq = 660) {
  const base = sfxCache[name];
  if (!base) {
    playBeep(fallbackFreq);
    return;
  }
  try {
    const clone = base.cloneNode();
    clone.currentTime = 0;
    clone.play().catch(() => playBeep(fallbackFreq));
  } catch (e) {
    console.warn('playSfx failed', e);
    playBeep(fallbackFreq);
  }
}
function clearCharTimeout() {
  if (gameState.charTimeoutHandle) {
    clearTimeout(gameState.charTimeoutHandle);
    gameState.charTimeoutHandle = null;
  }
}

// ----------------------- 游戏逻辑 -----------------------
function resetBoard() {
  gameState.board = [[], [], [], [], []];
  gameState.fallingBlocks = [];
  gameState.lastNoInputColumnIdx = null;
}

function resetGameStateForCurrentDeck() {
  const deck = gameState.decksById.get(gameState.currentDeckId);
  if (!deck) return;
  const entries = deck.entries || [];
  const shuffled = entries.slice().sort(() => Math.random() - 0.5);

  gameState.phraseQueue = shuffled;
  gameState.currentPhrase = null;
  gameState.currentCharIndex = 0;
  gameState.currentPhraseId = null;
  gameState.score = 0;
  gameState.combo = 0;
  gameState.gameOver = false;
  gameState.awaitingInput = false;
  gameState.startTime = null;
  gameState.lastElapsedSec = 0;
  timeSpan.textContent = '0.0';
  resetBoard();
  clearCharTimeout();
  updateScoreUI();
  statusLabel.textContent = '';
  currentTextLabel.textContent = '';
}

function updateScoreUI() {
  scoreSpan.textContent = gameState.score;
  comboSpan.textContent = gameState.combo;
}

function playCurrentAudio(entry) {
  if (gameState.audioObj) gameState.audioObj.pause();
  if (!entry) return false;
  const src = entry.audioUrl || entry.audio;
  if (!src) return false;
  const audio = new Audio(src);
  audio.preload = 'auto';
  audio.crossOrigin = 'anonymous';
  audio.currentTime = 0;
  gameState.audioObj = audio;
  let timersStarted = false;
  const startTimers = () => {
    if (timersStarted) return;
    timersStarted = true;
    scheduleCharTimeout();
  };
  audio.addEventListener('play', startTimers, { once: true });
  audio.addEventListener('error', startTimers, { once: true });
  audio.play().catch(err => {
    console.warn('audio play failed', err);
    startTimers();
  });
  // 如果浏览器阻止播放，也尽快启动倒计时
  setTimeout(() => startTimers(), 300);
  return true;
}

function spawnPhraseBlocks(phrase) {
  const chars = phrase.chars;
  const groupRows = Math.ceil(chars.length / 5);
  const columnBaseHeights = gameState.board.map(col => col.length);
  const startY = -groupRows * (canvas.height / MAX_ROWS) - 20;

  for (let i = 0; i < chars.length; i++) {
    const colIdx = i % 5;
    const rowFromTop = Math.floor(i / 5);
    const rowFromBottom = groupRows - 1 - rowFromTop;
    const targetRowIndex = columnBaseHeights[colIdx] + rowFromBottom;

    if (targetRowIndex >= MAX_ROWS) {
      finishGame('over');
      return;
    }

    gameState.fallingBlocks.push({
      char: chars[i].char,
      trueTone: chars[i].tone,
      colIdx,
      targetRowIndex,
      y: startY + rowFromTop * (canvas.height / MAX_ROWS),
      phraseId: phrase.id,
      charIndex: i
    });
  }
}

function nextPhrase() {
  clearCharTimeout();
  if (gameState.gameOver) return;
  if (gameState.fallingBlocks.length > 0) {
    setTimeout(nextPhrase, 120);
    return;
  }
  if (gameState.phraseQueue.length === 0) {
    finishGame('clear');
    return;
  }
  const entry = gameState.phraseQueue.shift();
  const chars = buildCharsForEntry(entry);
  if (chars.length === 0) {
    return nextPhrase();
  }

  const phraseId = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  gameState.currentPhrase = { entry, chars, answered: new Array(chars.length).fill(false), id: phraseId };
  gameState.currentPhraseId = phraseId;
  gameState.currentCharIndex = 0;
  gameState.awaitingInput = true;

  const t = TEXTS[currentLang];
  const nextChar = chars[0]?.char || '';
  currentTextLabel.textContent = `${t.current} ${entry.text}  |  ⌨️ ${nextChar}`;
  spawnPhraseBlocks(gameState.currentPhrase);
  const started = playCurrentAudio(entry);
  if (!started) {
    scheduleCharTimeout();
  }
}

function markCharAnswered(charIndex, success) {
  const phrase = gameState.currentPhrase;
  if (!phrase) return;
  if (phrase.answered[charIndex]) return;
  phrase.answered[charIndex] = true;
  const remainingIdx = phrase.answered.findIndex(v => !v);
  const t = TEXTS[currentLang];
  if (remainingIdx >= 0) {
    const nextChar = phrase.chars[remainingIdx]?.char || '';
    currentTextLabel.textContent = `${t.current} ${phrase.entry.text}  |  ⌨️ ${nextChar}`;
  }
  if (!success) {
    gameState.combo = 0;
    updateScoreUI();
  }
  tryFinishPhrase();
}

function tryFinishPhrase() {
  const phrase = gameState.currentPhrase;
  if (!phrase) return;
  const inputsDone = phrase.answered.every(Boolean);
  const groupStillFalling = gameState.fallingBlocks.some(fb => fb.phraseId === phrase.id);
  if (inputsDone && !groupStillFalling) {
    gameState.awaitingInput = false;
    gameState.currentPhrase = null;
    currentTextLabel.textContent = '';
    setTimeout(() => {
      if (!gameState.gameOver) nextPhrase();
    }, 120);
  } else if (inputsDone) {
    gameState.awaitingInput = false;
  }
}

function handleToneInput(toneInput) {
  if (gameState.gameOver || !gameState.awaitingInput) return;
  const phrase = gameState.currentPhrase;
  if (!phrase) return;
  const pendingIndex = phrase.answered.findIndex(v => !v);
  if (pendingIndex === -1) return;
  const currentChar = phrase.chars[pendingIndex];
  const correctTone = currentChar.tone;

  clearCharTimeout();

  if (toneInput === correctTone) {
    gameState.score += 10;
    gameState.combo += 1;
    updateScoreUI();
    const idx = gameState.fallingBlocks.findIndex(
      fb => fb.phraseId === phrase.id && fb.charIndex === pendingIndex
    );
    if (idx >= 0) {
      gameState.fallingBlocks.splice(idx, 1);
    }
    playSfx('hit', 1200);
    markCharAnswered(pendingIndex, true);
  } else {
    updateScoreUI();
    playSfx('wrong', 320);
    markCharAnswered(pendingIndex, false);
    settleWrongToneBlock(phrase.id, pendingIndex, toneInput, currentChar);
  }
}

function handleNoInputTimeout() {
  // 超时逻辑改为随掉落判定，不再触发
}

function spawnBlockFromError(toneInput, charObj) {
  const info = TONES.find(t => t.tone === toneInput);
  if (!info) return;
  spawnBlockAtColumn(charObj, info.colIndex);
}

function settleWrongToneBlock(phraseId, charIndex, toneInput, charObj) {
  const info = TONES.find(t => t.tone === toneInput);
  if (!info) return;

  const idx = gameState.fallingBlocks.findIndex(
    fb => fb.phraseId === phraseId && fb.charIndex === charIndex
  );
  if (idx >= 0) gameState.fallingBlocks.splice(idx, 1);

  const baseHeight = gameState.board[info.colIndex].length;
  const fallingInCol = gameState.fallingBlocks.filter(fb => fb.colIdx === info.colIndex).length;
  const targetRowIndex = baseHeight + fallingInCol;

  const landingBlock = {
    char: charObj.char,
    // 颜色保持原声调，但位置使用误输入的列
    trueTone: charObj.tone,
    colIdx: info.colIndex,
    targetRowIndex,
    y: (MAX_ROWS - 1 - targetRowIndex) * (canvas.height / MAX_ROWS),
    phraseId,
    charIndex
  };

  finalizeLanding(landingBlock);
}

// 生成正在下落的方块，不立即写入 board
function spawnBlockAtColumn(charObj, colIdx) {
  const fixed = gameState.board[colIdx].length;
  const fallingCount = gameState.fallingBlocks.filter(fb => fb.colIdx === colIdx).length;
  const targetRowIndex = fixed + fallingCount; // 从底数起的 index

  if (targetRowIndex >= MAX_ROWS) {
    // 掉下去就一定 Game Over，但还是给个动画
    gameState.fallingBlocks.push({
      char: charObj.char,
      trueTone: charObj.tone,
      colIdx,
      targetRowIndex,
      y: -50 // 起始位置
    });
    return;
  }

  gameState.fallingBlocks.push({
    char: charObj.char,
    trueTone: charObj.tone,
    colIdx,
    targetRowIndex,
    y: -50 // 起始位置（像素）
  });
}

function finalizeLanding(block) {
  const colIdx = block.colIdx;
  const column = gameState.board[colIdx];
  const isPhraseBlock = gameState.currentPhrase && block.phraseId === gameState.currentPhrase.id;
  const alreadyAnswered = isPhraseBlock && gameState.currentPhrase.answered[block.charIndex];

  if (isPhraseBlock && !alreadyAnswered) {
    playSfx('miss', 440);
    markCharAnswered(block.charIndex, false);
    applyPenaltyRows(1);
    tryFinishPhrase();
    return;
  }

  column.push({ char: block.char, trueTone: block.trueTone });

  if (column.length > MAX_ROWS) {
    finishGame('over');
    return;
  }
  checkColumnForClear(colIdx);
  tryFinishPhrase();
}

function applyPenaltyRows(rows) {
  for (let c = 0; c < 5; c++) {
    const column = gameState.board[c];
    const headroom = Math.max(0, MAX_ROWS - column.length);
    const rowsToAdd = Math.min(rows, headroom);

    for (let i = 0; i < rowsToAdd; i++) {
      // 抬高一层，使用中性色块，不再显示箭头
      column.push({ char: '', trueTone: 0 });
    }
  }
}

function checkColumnForClear(colIdx) {
  const column = gameState.board[colIdx];
  if (column.length < 5) return;

  let runTone = null;
  let runStart = 0;
  let runLen = 0;
  const groups = [];

  for (let i = 0; i < column.length; i++) {
    const b = column[i];
    if (runTone === null || b.trueTone !== runTone) {
      if (runLen >= 5) groups.push({ start: runStart, len: runLen, tone: runTone });
      runTone = b.trueTone;
      runStart = i;
      runLen = 1;
    } else {
      runLen++;
    }
  }
  if (runLen >= 5) groups.push({ start: runStart, len: runLen, tone: runTone });
  if (groups.length === 0) return;

  const g = groups[0];
  const baseScore = g.len * 10;
  gameState.score += baseScore;
  gameState.combo += 1;
  updateScoreUI();

  const newColumn = [];
  for (let i = 0; i < column.length; i++) {
    if (i < g.start || i >= g.start + g.len) newColumn.push(column[i]);
  }
  gameState.board[colIdx] = newColumn;
}

function finishGame(reason) {
  if (gameState.gameOver) return;
  gameState.gameOver = true;
  gameState.awaitingInput = false;
  clearCharTimeout();
  stopTimer();

  const t = TEXTS[currentLang];
  statusLabel.textContent = (reason === 'over') ? t.gameOver : t.gameClear;

  const elapsed = gameState.lastElapsedSec.toFixed(1);
  const deckName = (gameState.currentDeckId || '').toUpperCase();
  modalSummaryEl.textContent = `${deckName}\n${t.score} ${gameState.score}\n${t.time} ${elapsed}s`;
  playerNameInput.value = '';
  resultModal.style.display = 'block';
}

// ----------------------- 绘制 + 动画 -----------------------
function drawBoard() {
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const colWidth = w / 5;
  const rowHeight = h / MAX_ROWS;

  // 背景网格
  ctx.save();
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  for (let c = 0; c < 5; c++) {
    const x = c * colWidth;
    ctx.strokeRect(x, 0, colWidth, h);
  }
  ctx.restore();

  // 固定方块
  for (let c = 0; c < 5; c++) {
    const column = gameState.board[c];
    for (let i = 0; i < column.length; i++) {
      const block = column[i];
      const toneInfo = TONES.find(t => t.tone === block.trueTone);
      const color = toneInfo ? toneInfo.color : '#3a3e49';

      const x = c * colWidth;
      const y = (MAX_ROWS - 1 - i) * rowHeight;
      const bw = colWidth;
      const bh = rowHeight;

      ctx.fillStyle = color;
      ctx.fillRect(x, y, bw, bh);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, bw, bh);

      if (block.char) {
        ctx.fillStyle = '#000';
        ctx.font = `${Math.floor(bh * 0.5)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(block.char, x + bw / 2, y + bh / 2);
      }
    }
  }

  // 下落中的方块（空中不显示声调颜色）
  gameState.fallingBlocks.forEach(fb => {
    const x = fb.colIdx * colWidth;
    const bw = colWidth;
    const bh = rowHeight;

    ctx.fillStyle = FALLING_COLOR;
    ctx.fillRect(x, fb.y, bw, bh);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, fb.y, bw, bh);

    ctx.fillStyle = FALLING_TEXT_COLOR;
    ctx.font = `${Math.floor(bh * 0.5)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(fb.char, x + bw / 2, fb.y + bh / 2);
  });
}

// 帧循环：更新下落位置 + 重画
function animate(timestamp) {
  if (gameState.lastFrameTime == null) {
    gameState.lastFrameTime = timestamp;
  }
  const dt = (timestamp - gameState.lastFrameTime) / 1000;
  gameState.lastFrameTime = timestamp;

  const rowHeight = canvas.height / MAX_ROWS;

  // 更新下落中的方块
  const remaining = [];
  gameState.fallingBlocks.forEach(fb => {
    const targetY = (MAX_ROWS - 1 - fb.targetRowIndex) * rowHeight;
    fb.y += FALL_SPEED * dt;
    if (fb.y >= targetY) {
      fb.y = targetY;
      finalizeLanding(fb);
    } else {
      remaining.push(fb);
    }
  });
  gameState.fallingBlocks = remaining;

  drawBoard();
  requestAnimationFrame(animate);
}

// ----------------------- 成绩存储 -----------------------
function loadRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
function saveRecords(all) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {}
}
function addRecord(deckId, name, score, timeSec) {
  const all = loadRecords();
  if (!all[deckId]) all[deckId] = [];
  all[deckId].push({ name, score, time: timeSec, date: new Date().toISOString() });
  all[deckId].sort((a,b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.time - b.time;
  });
  all[deckId] = all[deckId].slice(0, 10);
  saveRecords(all);
}
function renderRecords() {
  const all = loadRecords();
  const deckId = gameState.currentDeckId;
  const list = (deckId && all[deckId]) ? all[deckId] : [];
  recordsListEl.innerHTML = '';
  list.forEach((r, idx) => {
    const li = document.createElement('li');
    li.textContent = `${idx + 1}. ${r.name || 'Player'} - ${r.score} pts, ${r.time.toFixed(1)}s`;
    recordsListEl.appendChild(li);
  });
}

// 结算弹窗
saveResultBtn.addEventListener('click', () => {
  const name = playerNameInput.value.trim() || 'Player';
  const deckId = gameState.currentDeckId;
  addRecord(deckId, name, gameState.score, gameState.lastElapsedSec || 0);
  resultModal.style.display = 'none';
  renderRecords();
});
closeResultBtn.addEventListener('click', () => {
  resultModal.style.display = 'none';
});

// ----------------------- 事件 & 初始化 -----------------------
startBtn.addEventListener('click', () => {
  const category = levelSelect.value;
  const deckId = deckSelect.value;
  if (!category || !deckId) return;

  gameState.currentCategory = category;
  gameState.currentDeckId   = deckId;

  resetGameStateForCurrentDeck();
  welcomePanel.style.display = 'none';
  startTimer();
  renderRecords();
  updateSetupToggleLabel();
  nextPhrase();
});

levelSelect.addEventListener('change', e => {
  const cat = e.target.value;
  gameState.currentCategory = cat;
  populateDeckSelectForCategory(cat);
  renderRecords();
});

deckSelect.addEventListener('change', e => {
  gameState.currentDeckId = e.target.value;
  renderRecords();
});

window.addEventListener('keydown', e => {
  const tone = parseInt(e.key, 10);
  if (tone >= 1 && tone <= 5) handleToneInput(tone);
});

// 初始化
(async function init() {
  try {
    await loadAllDatasets();
    preloadSfx();
    updateLanguageUI();
    drawBoard();
    requestAnimationFrame(animate);   // 启动动画循环
  } catch (err) {
    console.error(err);
    infoDiv.textContent = '加载数据失败：' + err.message;
  }
})();