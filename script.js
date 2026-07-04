/* ============================================================
   CLEOPATRA'S GOLD — slot engine (landscape mobile)
   ============================================================ */

const STORAGE_KEY = "cleopatras-gold-v2";
const COLS = 5;
const ROWS = 3;
const START_BALANCE = 2500;
const BETS = [10, 25, 50, 100, 250, 500];
const LINE_FACTOR = 0.13;

const symbols = [
  { id: "cleo", name: "Cleopatra", weight: 2, pays: { 3: 10, 4: 30, 5: 150 } },
  { id: "eye", name: "Eye of Horus", weight: 3, pays: { 3: 6, 4: 20, 5: 100 }, wild: true },
  { id: "scarab", name: "Scarab", weight: 5, pays: { 3: 4, 4: 12, 5: 50 } },
  { id: "cobra", name: "Cobra", weight: 6, pays: { 3: 3, 4: 9, 5: 35 } },
  { id: "ankh", name: "Ankh", weight: 4, scatter: true },
  { id: "ace", name: "Ace", weight: 8, pays: { 3: 2, 4: 6, 5: 20 } },
  { id: "king", name: "King", weight: 9, pays: { 3: 1.8, 4: 5, 5: 16 } },
  { id: "queen", name: "Queen", weight: 10, pays: { 3: 1.5, 4: 4, 5: 13 } },
  { id: "jack", name: "Jack", weight: 11, pays: { 3: 1.2, 4: 3.2, 5: 10 } },
  { id: "ten", name: "Ten", weight: 12, pays: { 3: 1, 4: 2.5, 5: 8 } },
];

const payLines = [
  [1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
  [0, 0, 1, 2, 2],
  [2, 2, 1, 0, 0],
  [1, 0, 0, 0, 1],
  [1, 2, 2, 2, 1],
  [0, 1, 1, 1, 0],
  [2, 1, 1, 1, 2],
  [0, 1, 0, 1, 0],
  [2, 1, 2, 1, 2],
  [1, 0, 1, 2, 1],
  [1, 2, 1, 0, 1],
];

const LINE_COLORS = [
  "#ffd35e", "#2ce0cf", "#ff3f6e", "#39e082", "#b98cff",
  "#ff9b3d", "#6ecbff", "#ff6ad5", "#c8f05a", "#ffd35e",
  "#2ce0cf", "#ff3f6e", "#39e082", "#b98cff", "#ff9b3d",
];

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const els = {
  splash: $("#splash"),
  enterButton: $("#enterButton"),
  balanceValue: $("#balanceValue"),
  addCoinsButton: $("#addCoinsButton"),
  paytableButton: $("#paytableButton"),
  soundButton: $("#soundButton"),
  fullscreenButton: $("#fullscreenButton"),
  stripLabel: $("#stripLabel"),
  jackpotValue: $("#jackpotValue"),
  reels: $("#reels"),
  linesOverlay: $("#linesOverlay"),
  freeSpinBadge: $("#freeSpinBadge"),
  freeSpinCount: $("#freeSpinCount"),
  statusMessage: $("#statusMessage"),
  decreaseBet: $("#decreaseBet"),
  increaseBet: $("#increaseBet"),
  betValue: $("#betValue"),
  winValue: $("#winValue"),
  winBox: $(".win-box"),
  magicMeter: $("#magicMeter"),
  multiplierTag: $("#multiplierTag"),
  turboButton: $("#turboButton"),
  autoButton: $("#autoButton"),
  spinButton: $("#spinButton"),
  canvas: $("#fxCanvas"),
  winOverlay: $("#winOverlay"),
  winTier: $("#winTier"),
  winAmount: $("#winAmount"),
  bonusModal: $("#bonusModal"),
  bonusChoices: $("#bonusChoices"),
  bonusText: $("#bonusText"),
  collectBonusButton: $("#collectBonusButton"),
  paytableModal: $("#paytableModal"),
  paytableRows: $("#paytableRows"),
  closePaytableButton: $("#closePaytableButton"),
};

const weightedBag = symbols.flatMap((symbol) => Array.from({ length: symbol.weight }, () => symbol));
const symbolById = Object.fromEntries(symbols.map((symbol) => [symbol.id, symbol]));

let state = loadState();
let matrix = createMatrix();
let spinning = false;
let autoRemaining = 0;
let bonusOpen = false;
let pendingBonus = null;
let audioContext = null;
let spinNoiseNodes = null;
let particles = [];
let particleFrame = 0;
let winTimer = 0;
let winCounterFrame = 0;
let jackpotTicker = 0;
let uidCounter = 0;

/* ------------------------------------------------------------
   State
   ------------------------------------------------------------ */
function loadState() {
  const fallback = {
    balance: START_BALANCE,
    bet: 25,
    lastWin: 0,
    bestWin: 0,
    spins: 0,
    jackpot: 12840,
    freeSpins: 0,
    magic: 0,
    nextMultiplier: 1,
    turbo: false,
    sound: true,
  };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved !== "object") return fallback;
    return { ...fallback, ...saved };
  } catch {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatNumber(value) {
  return Math.round(value).toLocaleString("en-US");
}

function randomSymbol() {
  return weightedBag[Math.floor(Math.random() * weightedBag.length)];
}

function createMatrix() {
  return Array.from({ length: ROWS }, () => Array.from({ length: COLS }, randomSymbol));
}

/* ------------------------------------------------------------
   Symbol artwork (SVG)
   ------------------------------------------------------------ */
function symbolArt(id) {
  const uid = `u${(uidCounter += 1)}`;
  const defs = `
    <defs>
      <linearGradient id="g-${uid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff3b8"/><stop offset=".45" stop-color="#f2b23a"/><stop offset="1" stop-color="#8f4d0d"/>
      </linearGradient>
      <linearGradient id="t-${uid}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#7dfff0"/><stop offset=".5" stop-color="#19c9bc"/><stop offset="1" stop-color="#0d5f96"/>
      </linearGradient>
      <linearGradient id="r-${uid}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ff9bb1"/><stop offset=".45" stop-color="#ff3f75"/><stop offset="1" stop-color="#7d0c33"/>
      </linearGradient>
      <linearGradient id="e-${uid}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#9fffd1"/><stop offset=".45" stop-color="#39e082"/><stop offset="1" stop-color="#086744"/>
      </linearGradient>
      <linearGradient id="v-${uid}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#d9b9ff"/><stop offset=".45" stop-color="#8d4bff"/><stop offset="1" stop-color="#2b0b66"/>
      </linearGradient>
      <linearGradient id="o-${uid}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffd9a0"/><stop offset=".45" stop-color="#ff9b3d"/><stop offset="1" stop-color="#8a3d05"/>
      </linearGradient>
    </defs>
  `;

  const letter = (glyph, gradient, tag = "") => `
    <text x="60" y="78" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="900"
      font-size="${glyph.length > 1 ? 58 : 74}" fill="url(#${gradient}-${uid})" stroke="url(#g-${uid})" stroke-width="3"
      paint-order="stroke">${glyph}</text>
    <path d="M38 90 H82" stroke="url(#g-${uid})" stroke-width="4" stroke-linecap="round" opacity=".85"/>
    ${tag}
  `;

  const wildTag = `
    <rect x="24" y="92" width="72" height="20" rx="10" fill="url(#g-${uid})" stroke="#5a2c05" stroke-width="2"/>
    <text x="60" y="107" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="14" fill="#4a2404" letter-spacing="2">WILD</text>
  `;
  const scatterTag = `
    <rect x="16" y="92" width="88" height="20" rx="10" fill="url(#t-${uid})" stroke="#0d5f96" stroke-width="2"/>
    <text x="60" y="107" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="12" fill="#04303f" letter-spacing="2">SCATTER</text>
  `;

  const art = {
    cleo: `
      <path d="M36 30 L84 30 L94 62 L78 100 L42 100 L26 62 Z" fill="url(#g-${uid})" stroke="#5a2c05" stroke-width="3"/>
      <path d="M46 33 L46 96 M60 30 L60 101 M74 33 L74 96" stroke="#123a8a" stroke-width="6" opacity=".85"/>
      <ellipse cx="60" cy="60" rx="21" ry="23" fill="#c98551"/>
      <path d="M42 56 C49 48 71 48 78 56 C74 76 46 76 42 56Z" fill="#f2b06f"/>
      <path d="M45 58 C52 63 68 63 75 58" stroke="#3a140c" stroke-width="3" fill="none"/>
      <path d="M48 45 C52 42 56 42 59 44 M61 44 C64 42 68 42 72 45" stroke="#241008" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M45 29 C50 16 70 16 75 29" fill="url(#g-${uid})" stroke="#5a2c05" stroke-width="2"/>
      <circle cx="60" cy="27" r="7" fill="url(#t-${uid})" stroke="#fff4a7" stroke-width="3"/>
    `,
    eye: `
      <path d="M18 56 C40 30 80 30 102 56 C79 80 41 80 18 56Z" fill="url(#g-${uid})" stroke="#5a2c05" stroke-width="3"/>
      <path d="M27 56 C44 42 76 42 93 56 C75 69 45 69 27 56Z" fill="url(#t-${uid})"/>
      <circle cx="60" cy="56" r="14" fill="#07131b" stroke="#fff4a7" stroke-width="4"/>
      <circle cx="60" cy="56" r="6" fill="#24e0cd"/>
      <circle cx="56" cy="52" r="2.4" fill="#d8fffa"/>
      <path d="M34 71 C44 86 58 86 64 70 M74 68 C80 76 88 77 96 70 M24 57 C21 68 27 76 37 78" fill="none" stroke="url(#g-${uid})" stroke-width="6" stroke-linecap="round"/>
      ${wildTag}
    `,
    scarab: `
      <ellipse cx="60" cy="58" rx="25" ry="32" fill="url(#e-${uid})" stroke="url(#g-${uid})" stroke-width="4"/>
      <path d="M60 26 V90 M38 50 H82 M42 70 H78" stroke="#063c2c" stroke-width="4" stroke-linecap="round"/>
      <path d="M35 44 C22 38 19 28 28 21 M85 44 C98 38 101 28 92 21 M36 70 C23 76 20 88 31 93 M84 70 C97 76 100 88 89 93" fill="none" stroke="url(#g-${uid})" stroke-width="6" stroke-linecap="round"/>
      <circle cx="60" cy="24" r="9" fill="url(#t-${uid})" stroke="url(#g-${uid})" stroke-width="3"/>
    `,
    cobra: `
      <path d="M60 14 C34 20 22 44 28 66 C33 84 46 94 60 94 C74 94 87 84 92 66 C98 44 86 20 60 14Z" fill="url(#g-${uid})" stroke="#4a1b08" stroke-width="3"/>
      <path d="M60 24 C44 29 36 46 40 62 C44 76 52 83 60 83 C68 83 76 76 80 62 C84 46 76 29 60 24Z" fill="url(#t-${uid})" opacity=".9"/>
      <ellipse cx="60" cy="52" rx="13" ry="15" fill="url(#g-${uid})" stroke="#4a1b08" stroke-width="2.4"/>
      <circle cx="55" cy="48" r="3" fill="#160a04"/>
      <circle cx="65" cy="48" r="3" fill="#160a04"/>
      <path d="M60 60 V66 M56 70 L60 66 L64 70" stroke="#a41f3f" stroke-width="2.6" fill="none" stroke-linecap="round"/>
      <path d="M60 94 C60 102 74 106 82 100" fill="none" stroke="url(#g-${uid})" stroke-width="8" stroke-linecap="round"/>
    `,
    ankh: `
      <ellipse cx="60" cy="32" rx="15" ry="20" fill="none" stroke="url(#g-${uid})" stroke-width="9"/>
      <path d="M60 52 V88 M38 61 H82" stroke="url(#g-${uid})" stroke-width="10" stroke-linecap="round"/>
      <path d="M60 53 V88 M38 61 H82" stroke="url(#t-${uid})" stroke-width="3.6" stroke-linecap="round" opacity=".7"/>
      <circle cx="60" cy="61" r="7" fill="url(#r-${uid})" stroke="#fff4a7" stroke-width="2.6"/>
      ${scatterTag}
    `,
    ace: letter("A", "r"),
    king: letter("K", "v"),
    queen: letter("Q", "e"),
    jack: letter("J", "t"),
    ten: letter("10", "o"),
  };

  return `<svg class="symbol-art" viewBox="0 0 120 120" aria-hidden="true">${defs}${art[id] || ""}</svg>`;
}

/* ------------------------------------------------------------
   Reel rendering + spin animation
   ------------------------------------------------------------ */
function cellHtml(symbol, height) {
  return `<div class="cell" data-symbol="${symbol.id}" style="height:${height}px">${symbolArt(symbol.id)}</div>`;
}

function reelEls() {
  return [...els.reels.children];
}

function cellHeightFor(reel) {
  return reel.clientHeight / ROWS;
}

function renderGridIdle() {
  els.reels.innerHTML = "";
  for (let col = 0; col < COLS; col += 1) {
    const reel = document.createElement("div");
    reel.className = "reel";
    const strip = document.createElement("div");
    strip.className = "reel-strip";
    reel.appendChild(strip);
    els.reels.appendChild(reel);
  }
  fillIdleStrips();
}

function fillIdleStrips() {
  reelEls().forEach((reel, col) => {
    const strip = reel.firstElementChild;
    const h = cellHeightFor(reel);
    strip.style.transition = "none";
    strip.style.transform = "translate3d(0,0,0)";
    strip.innerHTML = Array.from({ length: ROWS }, (_, row) => cellHtml(matrix[row][col], h)).join("");
  });
}

function spinReel(reel, finalSymbols, currentSymbols, duration, blanks) {
  return new Promise((resolve) => {
    const strip = reel.firstElementChild;
    const h = cellHeightFor(reel);
    const sequence = [randomSymbol(), ...finalSymbols];
    for (let i = 0; i < blanks; i += 1) sequence.push(randomSymbol());
    sequence.push(...currentSymbols);

    strip.style.transition = "none";
    strip.innerHTML = sequence.map((symbol) => cellHtml(symbol, h)).join("");
    strip.style.transform = `translate3d(0, ${-(1 + ROWS + blanks) * h}px, 0)`;
    strip.classList.add("is-blurred");
    void strip.offsetHeight;

    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      strip.classList.remove("is-blurred");
      strip.style.transition = "none";
      strip.innerHTML = finalSymbols.map((symbol) => cellHtml(symbol, h)).join("");
      strip.style.transform = "translate3d(0,0,0)";
      playTone(430 + Math.random() * 80, 0.07, "square", 0.026);
      resolve();
    };

    strip.addEventListener("transitionend", settle, { once: true });
    window.setTimeout(settle, duration + 300);

    strip.style.transition = `transform ${duration}ms cubic-bezier(0.16, 0.6, 0.28, 1.05)`;
    strip.style.transform = `translate3d(0, ${-h}px, 0)`;
    window.setTimeout(() => strip.classList.remove("is-blurred"), Math.max(0, duration - 170));
  });
}

async function animateReels(targetMatrix, previousMatrix) {
  const turbo = state.turbo;
  const promises = reelEls().map((reel, col) => {
    const finalSymbols = Array.from({ length: ROWS }, (_, row) => targetMatrix[row][col]);
    const currentSymbols = Array.from({ length: ROWS }, (_, row) => previousMatrix[row][col]);
    const duration = turbo ? 380 + col * 70 : 820 + col * 190;
    const blanks = turbo ? 7 + col * 2 : 13 + col * 4;
    return spinReel(reel, finalSymbols, currentSymbols, duration, blanks);
  });
  await Promise.all(promises);
}

/* ------------------------------------------------------------
   Win lines + highlights
   ------------------------------------------------------------ */
function clearWinVisuals() {
  els.reels.classList.remove("has-win");
  $$(".cell.is-winner").forEach((cell) => cell.classList.remove("is-winner"));
  els.linesOverlay.innerHTML = "";
}

function cellAt(position) {
  const col = position % COLS;
  const row = Math.floor(position / COLS);
  const reel = els.reels.children[col];
  return reel ? reel.firstElementChild.children[row] : null;
}

function highlightPositions(positions) {
  if (!positions.length) return;
  els.reels.classList.add("has-win");
  positions.forEach((position) => cellAt(position)?.classList.add("is-winner"));
}

function drawWinLines(wins) {
  const svgNS = "http://www.w3.org/2000/svg";
  els.linesOverlay.innerHTML = "";
  wins.filter((win) => !win.scatter).forEach((win) => {
    const line = payLines[win.lineIndex];
    const points = [`0,${line[0] * 100 + 50}`];
    for (let col = 0; col < win.count; col += 1) {
      points.push(`${col * 100 + 50},${line[col] * 100 + 50}`);
    }
    const polyline = document.createElementNS(svgNS, "polyline");
    polyline.setAttribute("points", points.join(" "));
    polyline.setAttribute("stroke", LINE_COLORS[win.lineIndex % LINE_COLORS.length]);
    polyline.style.color = LINE_COLORS[win.lineIndex % LINE_COLORS.length];
    els.linesOverlay.appendChild(polyline);
  });
}

/* ------------------------------------------------------------
   Evaluation
   ------------------------------------------------------------ */
function evaluateSpin(multiplier) {
  const wins = [];
  const positions = new Set();
  let total = 0;
  let jackpotHit = false;

  payLines.forEach((line, lineIndex) => {
    const lineSymbols = line.map((row, col) => matrix[row][col]);
    let target = null;
    let count = 0;

    for (const symbol of lineSymbols) {
      if (symbol.scatter) break;
      if (!target && !symbol.wild) target = symbol;
      if (!target || symbol.wild || symbol.id === target.id) {
        count += 1;
      } else {
        break;
      }
    }

    if (!target && count === COLS) target = symbolById.eye;

    if (target && count >= 3 && target.pays) {
      const pay = Math.max(1, Math.round(state.bet * target.pays[count] * LINE_FACTOR * multiplier));
      total += pay;
      line.slice(0, count).forEach((row, col) => positions.add(row * COLS + col));
      wins.push({ lineIndex, target, count, pay });
      if (target.id === "cleo" && count === 5) jackpotHit = true;
    }
  });

  const scatterPositions = [];
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      if (matrix[row][col].scatter) scatterPositions.push(row * COLS + col);
    }
  }

  let freeSpinsAwarded = 0;
  if (scatterPositions.length >= 3) {
    const scatterPay = Math.round(state.bet * [0, 0, 0, 3, 8, 16, 26][Math.min(6, scatterPositions.length)] * multiplier);
    total += scatterPay;
    freeSpinsAwarded = [0, 0, 0, 5, 8, 12, 12][Math.min(6, scatterPositions.length)];
    scatterPositions.forEach((position) => positions.add(position));
    wins.push({ scatter: true, count: scatterPositions.length, pay: scatterPay });
  }

  let jackpotWin = 0;
  if (jackpotHit) {
    jackpotWin = Math.round(state.jackpot);
    total += jackpotWin;
    state.jackpot = 12000 + Math.floor(Math.random() * 4200);
  }

  return { total, wins, positions: [...positions], freeSpinsAwarded, jackpotWin };
}

function countSymbol(id) {
  return matrix.flat().filter((symbol) => symbol.id === id).length;
}

/* ------------------------------------------------------------
   UI sync
   ------------------------------------------------------------ */
function setStatus(message) {
  els.statusMessage.textContent = message;
}

function updateUi() {
  els.balanceValue.textContent = formatNumber(state.balance);
  els.jackpotValue.textContent = formatNumber(state.jackpot);
  els.betValue.textContent = formatNumber(state.bet);
  els.winValue.textContent = formatNumber(state.lastWin);
  els.magicMeter.style.width = `${Math.min(100, state.magic)}%`;
  els.multiplierTag.classList.toggle("is-hidden", state.nextMultiplier <= 1);
  els.multiplierTag.textContent = `x${state.nextMultiplier}`;
  els.turboButton.classList.toggle("is-on", state.turbo);
  els.autoButton.classList.toggle("is-on", autoRemaining > 0);
  els.autoButton.textContent = autoRemaining > 0 ? `STOP ${autoRemaining}` : "AUTO";
  els.soundButton.classList.toggle("is-off", !state.sound);

  const hasFree = state.freeSpins > 0;
  els.freeSpinBadge.classList.toggle("is-hidden", !hasFree);
  els.freeSpinCount.textContent = state.freeSpins;
  els.stripLabel.textContent = hasFree ? "FREE SPINS ACTIVE" : "GRAND JACKPOT";

  const locked = spinning || bonusOpen;
  [els.decreaseBet, els.increaseBet, els.spinButton].forEach((button) => {
    button.disabled = locked;
  });
  els.spinButton.classList.toggle("is-spinning", spinning);
  saveState();
}

function canSpin() {
  return state.freeSpins > 0 || state.balance >= state.bet;
}

/* ------------------------------------------------------------
   Spin flow
   ------------------------------------------------------------ */
async function requestSpin(fromAuto = false) {
  if (spinning || bonusOpen) return;
  if (fromAuto) {
    autoRemaining = Math.max(0, autoRemaining - 1);
  } else {
    autoRemaining = 0;
  }
  if (!canSpin()) {
    autoRemaining = 0;
    setStatus("NOT ENOUGH CREDITS — TAP + TO REFILL");
    updateUi();
    return;
  }
  await spin();
  scheduleAuto();
}

async function spin() {
  spinning = true;
  clearWinVisuals();
  hideWinOverlay();
  state.lastWin = 0;

  const usedFreeSpin = state.freeSpins > 0;
  const spinMultiplier = state.nextMultiplier;
  state.nextMultiplier = 1;

  if (usedFreeSpin) {
    state.freeSpins -= 1;
  } else {
    state.balance -= state.bet;
    state.jackpot += Math.max(4, Math.round(state.bet * 0.25));
  }

  state.spins += 1;
  setStatus(usedFreeSpin ? `FREE SPIN — ${state.freeSpins} LEFT` : "GOOD LUCK!");
  updateUi();
  playSequence("spin");
  startSpinNoise();

  const previousMatrix = matrix;
  matrix = createMatrix();
  try {
    await animateReels(matrix, previousMatrix);
  } finally {
    stopSpinNoise();
  }

  const result = evaluateSpin(spinMultiplier);
  state.lastWin = result.total;
  state.bestWin = Math.max(state.bestWin, result.total);
  state.balance += result.total;
  state.freeSpins += result.freeSpinsAwarded;

  if (result.total > 0) {
    state.magic = Math.max(0, state.magic - 20);
    highlightPositions(result.positions);
    drawWinLines(result.wins);
    countUpWinBox(result.total);
    const ratio = result.total / Math.max(1, state.bet);
    if (ratio >= 8 || result.jackpotWin) {
      showWinOverlay(result.total, result.jackpotWin);
      playSequence("big");
      burst(Math.min(240, 70 + Math.round(ratio * 6)), "mega");
    } else {
      playSequence("win");
      burst(Math.min(120, 40 + Math.round(ratio * 10)), "win");
    }
    showResultMessage(result);
  } else {
    state.magic = Math.min(100, state.magic + 18);
    setStatus("SO CLOSE — SPIN AGAIN");
  }

  if (result.freeSpinsAwarded > 0) {
    setStatus(`${result.freeSpinsAwarded} FREE SPINS AWARDED!`);
    playSequence("bonus");
  }

  if (state.magic >= 100) {
    state.magic = 0;
    state.nextMultiplier = 2;
    setStatus("ANCIENT MAGIC FULL — NEXT SPIN X2");
    playSequence("bonus");
    burst(60, "magic");
  }

  const openedBonus = maybeOpenBonus(result.total);
  spinning = false;
  updateUi();

  if (!openedBonus && !canSpin()) {
    autoRemaining = 0;
    setStatus("OUT OF CREDITS — TAP + TO REFILL");
    updateUi();
  }
}

function showResultMessage(result) {
  if (result.jackpotWin) {
    setStatus(`GRAND JACKPOT ${formatNumber(result.jackpotWin)}!`);
    return;
  }
  const lineWin = result.wins.find((win) => !win.scatter);
  if (lineWin) {
    setStatus(`${lineWin.count}× ${lineWin.target.name.toUpperCase()} — WIN ${formatNumber(result.total)}`);
  } else {
    setStatus(`WIN ${formatNumber(result.total)}`);
  }
}

function scheduleAuto() {
  updateUi();
  if (autoRemaining > 0 && !spinning && !bonusOpen) {
    const delay = state.lastWin > 0 ? (state.turbo ? 900 : 1500) : (state.turbo ? 300 : 650);
    window.setTimeout(() => requestSpin(true), delay);
  }
}

function countUpWinBox(total) {
  els.winBox.classList.add("is-counting");
  const start = performance.now();
  const duration = state.turbo ? 500 : 900;
  const tick = (now) => {
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    els.winValue.textContent = formatNumber(total * eased);
    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      els.winValue.textContent = formatNumber(total);
      els.winBox.classList.remove("is-counting");
    }
  };
  requestAnimationFrame(tick);
}

/* ------------------------------------------------------------
   Bet / turbo / auto / rewards
   ------------------------------------------------------------ */
function changeBet(direction) {
  const currentIndex = BETS.indexOf(state.bet);
  const nextIndex = Math.min(BETS.length - 1, Math.max(0, currentIndex + direction));
  state.bet = BETS[nextIndex];
  setStatus(`TOTAL BET ${formatNumber(state.bet)}`);
  playTone(direction > 0 ? 620 : 480, 0.06, "sine", 0.03);
  updateUi();
}

function toggleTurbo() {
  state.turbo = !state.turbo;
  setStatus(state.turbo ? "TURBO ON" : "TURBO OFF");
  playTone(state.turbo ? 740 : 380, 0.08, "sine", 0.035);
  updateUi();
}

function toggleAuto() {
  if (autoRemaining > 0) {
    autoRemaining = 0;
    setStatus("AUTO SPIN STOPPED");
    updateUi();
    return;
  }
  autoRemaining = 10;
  requestSpin(true);
}

function addCoins() {
  state.balance += 2500;
  setStatus("+2,500 DEMO COINS");
  playSequence("bonus");
  burst(90, "mega");
  updateUi();
}

/* ------------------------------------------------------------
   Bonus game (Queen's Vault)
   ------------------------------------------------------------ */
function maybeOpenBonus(totalWin) {
  const opens = countSymbol("cleo") >= 3 || totalWin >= state.bet * 28;
  if (!opens) return false;
  openBonus();
  return true;
}

function openBonus() {
  bonusOpen = true;
  pendingBonus = { picks: 0, credits: 0, freeSpins: 0, meter: 0 };
  const awards = shuffle([
    { label: `+${formatNumber(state.bet * 5)}`, credits: state.bet * 5 },
    { label: `+${formatNumber(state.bet * 8)}`, credits: state.bet * 8 },
    { label: `+${formatNumber(state.bet * 12)}`, credits: state.bet * 12 },
    { label: `+${formatNumber(state.bet * 20)}`, credits: state.bet * 20 },
    { label: "3 SPINS", freeSpins: 3 },
    { label: "MAGIC", meter: 100 },
  ]);

  els.bonusChoices.innerHTML = "";
  const faces = ["☥", "♛", "✦", "◆", "▲", "●"];
  awards.forEach((award, index) => {
    const button = document.createElement("button");
    button.className = "bonus-choice";
    button.type = "button";
    button.textContent = faces[index];
    button.addEventListener("click", () => revealBonus(button, award));
    els.bonusChoices.appendChild(button);
  });
  els.bonusText.textContent = "Pick 3 relics to reveal your treasure";
  els.collectBonusButton.classList.add("is-hidden");
  els.bonusModal.classList.remove("is-hidden");
  playSequence("bonus");
  updateUi();
}

function revealBonus(button, award) {
  if (!pendingBonus || pendingBonus.picks >= 3 || button.classList.contains("is-open")) return;
  button.classList.add("is-open");
  button.textContent = award.label;
  pendingBonus.picks += 1;
  pendingBonus.credits += award.credits || 0;
  pendingBonus.freeSpins += award.freeSpins || 0;
  pendingBonus.meter = Math.max(pendingBonus.meter, award.meter || 0);
  playSequence("bonus");
  let text = `Revealed: ${formatNumber(pendingBonus.credits)} credits`;
  if (pendingBonus.freeSpins) text += ` · ${pendingBonus.freeSpins} free spins`;
  if (pendingBonus.meter) text += " · magic charged";
  els.bonusText.textContent = text;
  if (pendingBonus.picks === 3) {
    $$(".bonus-choice").forEach((choice) => {
      if (!choice.classList.contains("is-open")) choice.disabled = true;
    });
    els.collectBonusButton.classList.remove("is-hidden");
  }
}

function collectBonus() {
  if (!pendingBonus) return;
  state.balance += pendingBonus.credits;
  state.lastWin += pendingBonus.credits;
  state.bestWin = Math.max(state.bestWin, state.lastWin);
  state.freeSpins += pendingBonus.freeSpins;
  state.magic = Math.max(state.magic, pendingBonus.meter);
  if (state.magic >= 100) {
    state.magic = 0;
    state.nextMultiplier = Math.max(state.nextMultiplier, 2);
  }
  pendingBonus = null;
  bonusOpen = false;
  els.bonusModal.classList.add("is-hidden");
  burst(120, "mega");
  updateUi();
  scheduleAuto();
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

/* ------------------------------------------------------------
   Paytable
   ------------------------------------------------------------ */
function openPaytable() {
  els.paytableRows.innerHTML = "";
  symbols.forEach((symbol) => {
    const row = document.createElement("div");
    row.className = "paytable-row";
    let payText;
    let subText;
    if (symbol.scatter) {
      payText = "3+ → FREE SPINS";
      subText = "Pays anywhere on the reels";
    } else {
      const pays = [3, 4, 5].map((n) => formatNumber(Math.max(1, Math.round(state.bet * symbol.pays[n] * LINE_FACTOR))));
      payText = `${pays[0]} / ${pays[1]} / ${pays[2]}`;
      subText = symbol.wild ? "WILD — substitutes all symbols" : "Pays for 3 / 4 / 5 on a line";
    }
    row.innerHTML = `${symbolArt(symbol.id)}<div><strong>${symbol.name}</strong><small>${subText}</small></div><em>${payText}</em>`;
    els.paytableRows.appendChild(row);
  });
  els.paytableModal.classList.remove("is-hidden");
}

/* ------------------------------------------------------------
   Win overlay
   ------------------------------------------------------------ */
function winTierFor(totalWin, jackpotWin) {
  if (jackpotWin) return { label: "JACKPOT", duration: 4200 };
  const ratio = totalWin / Math.max(1, state.bet);
  if (ratio >= 40) return { label: "MEGA WIN", duration: 3600 };
  if (ratio >= 18) return { label: "BIG WIN", duration: 3000 };
  return { label: "NICE WIN", duration: 2300 };
}

function showWinOverlay(totalWin, jackpotWin = 0) {
  const tier = winTierFor(totalWin, jackpotWin);
  hideWinOverlay(false);
  els.winTier.textContent = tier.label;
  els.winOverlay.classList.remove("is-hidden", "is-leaving");

  const start = performance.now();
  const countDuration = Math.min(1500, Math.max(620, tier.duration * 0.45));
  const tick = (now) => {
    const progress = Math.min(1, (now - start) / countDuration);
    const eased = 1 - Math.pow(1 - progress, 3);
    els.winAmount.textContent = formatNumber(totalWin * eased);
    if (progress < 1) {
      winCounterFrame = requestAnimationFrame(tick);
    } else {
      els.winAmount.textContent = formatNumber(totalWin);
    }
  };
  winCounterFrame = requestAnimationFrame(tick);

  winTimer = window.setTimeout(() => {
    els.winOverlay.classList.add("is-leaving");
    window.setTimeout(() => hideWinOverlay(), 430);
  }, tier.duration);
}

function hideWinOverlay(clearTimer = true) {
  if (clearTimer) window.clearTimeout(winTimer);
  cancelAnimationFrame(winCounterFrame);
  els.winOverlay.classList.add("is-hidden");
  els.winOverlay.classList.remove("is-leaving");
}

/* ------------------------------------------------------------
   Audio
   ------------------------------------------------------------ */
function ensureAudio() {
  if (!audioContext) {
    const AudioEngine = window.AudioContext || window.webkitAudioContext;
    if (!AudioEngine) {
      state.sound = false;
      return;
    }
    audioContext = new AudioEngine();
  }
  if (audioContext.state === "suspended") audioContext.resume();
}

function playTone(frequency, duration = 0.12, type = "sine", gain = 0.035) {
  if (!state.sound) return;
  ensureAudio();
  if (!audioContext) return;
  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const volume = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  volume.gain.setValueAtTime(0.0001, now);
  volume.gain.exponentialRampToValueAtTime(gain, now + 0.02);
  volume.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(volume);
  volume.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.03);
}

function startSpinNoise() {
  if (!state.sound || spinNoiseNodes) return;
  ensureAudio();
  if (!audioContext) return;

  const sampleRate = audioContext.sampleRate;
  const buffer = audioContext.createBuffer(1, sampleRate * 2, sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < data.length; index += 1) {
    data[index] = (Math.random() * 2 - 1) * 0.72;
  }

  const noise = audioContext.createBufferSource();
  const filter = audioContext.createBiquadFilter();
  const gain = audioContext.createGain();
  const motor = audioContext.createOscillator();
  const motorGain = audioContext.createGain();
  const now = audioContext.currentTime;

  noise.buffer = buffer;
  noise.loop = true;
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(820, now);
  filter.frequency.linearRampToValueAtTime(1320, now + 0.3);
  filter.Q.setValueAtTime(0.9, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.032, now + 0.08);

  motor.type = "sawtooth";
  motor.frequency.setValueAtTime(34, now);
  motor.frequency.linearRampToValueAtTime(52, now + 0.24);
  motorGain.gain.setValueAtTime(0.0001, now);
  motorGain.gain.exponentialRampToValueAtTime(0.012, now + 0.08);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(audioContext.destination);
  motor.connect(motorGain);
  motorGain.connect(audioContext.destination);
  noise.start(now);
  motor.start(now);
  spinNoiseNodes = { noise, gain, motor, motorGain };
}

function stopSpinNoise() {
  if (!spinNoiseNodes || !audioContext) return;
  const { noise, gain, motor, motorGain } = spinNoiseNodes;
  const now = audioContext.currentTime;
  gain.gain.cancelScheduledValues(now);
  motorGain.gain.cancelScheduledValues(now);
  gain.gain.setTargetAtTime(0.0001, now, 0.045);
  motorGain.gain.setTargetAtTime(0.0001, now, 0.04);
  window.setTimeout(() => {
    try {
      noise.stop();
      motor.stop();
    } catch {
      // nodes may already be stopped
    }
  }, 180);
  spinNoiseNodes = null;
}

function playSequence(kind) {
  if (!state.sound) return;
  const sequences = {
    spin: [220, 265, 318],
    win: [392, 523, 659, 784],
    big: [330, 392, 523, 659, 784, 1046, 1318],
    bonus: [330, 494, 660, 988],
  };
  (sequences[kind] || sequences.win).forEach((note, index) => {
    window.setTimeout(
      () => playTone(note, kind === "big" ? 0.16 : 0.11, kind === "spin" ? "triangle" : "sine", kind === "big" ? 0.052 : 0.035),
      index * 76
    );
  });
}

/* ------------------------------------------------------------
   Particles (coins + sparks)
   ------------------------------------------------------------ */
function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  els.canvas.width = Math.floor(window.innerWidth * ratio);
  els.canvas.height = Math.floor(window.innerHeight * ratio);
  els.canvas.style.width = `${window.innerWidth}px`;
  els.canvas.style.height = `${window.innerHeight}px`;
  els.canvas.getContext("2d").setTransform(ratio, 0, 0, ratio, 0, 0);
}

function burst(amount, mode = "win") {
  const colors = ["#ffd15a", "#fff4a7", "#24e0cd", "#ff3f75", "#39e082", "#b98cff"];
  const centerX = window.innerWidth / 2;
  const centerY = mode === "mega" ? window.innerHeight * 0.36 : window.innerHeight * 0.46;
  for (let index = 0; index < amount; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = mode === "mega" ? 4 + Math.random() * 9 : 2.5 + Math.random() * 6;
    const isCoin = Math.random() > 0.34;
    particles.push({
      x: centerX + (Math.random() - 0.5) * 260,
      y: centerY + (Math.random() - 0.5) * 90,
      vx: Math.cos(angle) * speed * 0.78,
      vy: Math.sin(angle) * speed - Math.random() * 5,
      gravity: 0.17 + Math.random() * 0.1,
      size: isCoin ? 7 + Math.random() * 12 : 4 + Math.random() * 8,
      life: (mode === "mega" ? 96 : 74) + Math.random() * 56,
      color: colors[Math.floor(Math.random() * colors.length)],
      spin: Math.random() * Math.PI,
      type: isCoin ? "coin" : "spark",
    });
  }
  if (!particleFrame) animateParticles();
}

function animateParticles() {
  const context = els.canvas.getContext("2d");
  context.clearRect(0, 0, window.innerWidth, window.innerHeight);
  particles = particles.filter((particle) => particle.life > 0);

  particles.forEach((particle) => {
    particle.life -= 1;
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.vy += particle.gravity;
    particle.spin += 0.18;
    context.save();
    context.translate(particle.x, particle.y);
    context.rotate(particle.spin);
    context.globalAlpha = Math.max(0, Math.min(1, particle.life / 80));
    if (particle.type === "coin") {
      const squash = 0.42 + Math.abs(Math.sin(particle.spin)) * 0.58;
      context.scale(squash, 1);
      context.beginPath();
      context.arc(0, 0, particle.size / 2, 0, Math.PI * 2);
      context.fillStyle = "#ffd15a";
      context.fill();
      context.lineWidth = 2;
      context.strokeStyle = "rgba(255, 246, 208, 0.82)";
      context.stroke();
      context.beginPath();
      context.arc(0, 0, particle.size / 4, 0, Math.PI * 2);
      context.strokeStyle = "rgba(105, 46, 10, 0.74)";
      context.stroke();
    } else {
      context.fillStyle = particle.color;
      context.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size * 0.64);
    }
    context.restore();
  });

  if (particles.length) {
    particleFrame = requestAnimationFrame(animateParticles);
  } else {
    particleFrame = 0;
    context.clearRect(0, 0, window.innerWidth, window.innerHeight);
  }
}

/* ------------------------------------------------------------
   Jackpot ticker (slow live growth)
   ------------------------------------------------------------ */
function startJackpotTicker() {
  window.clearInterval(jackpotTicker);
  jackpotTicker = window.setInterval(() => {
    if (spinning || bonusOpen) return;
    state.jackpot += 1 + Math.floor(Math.random() * 4);
    els.jackpotValue.textContent = formatNumber(state.jackpot);
    saveState();
  }, 1600);
}

/* ------------------------------------------------------------
   Fullscreen / orientation
   ------------------------------------------------------------ */
async function goImmersive() {
  const root = document.documentElement;
  try {
    if (!document.fullscreenElement && root.requestFullscreen) {
      await root.requestFullscreen({ navigationUI: "hide" });
    }
  } catch {
    // fullscreen may be rejected outside a user gesture
  }
  try {
    if (screen.orientation && screen.orientation.lock) {
      await screen.orientation.lock("landscape");
    }
  } catch {
    // orientation lock unsupported in plain browser tabs
  }
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    goImmersive();
  }
}

/* ------------------------------------------------------------
   Events + init
   ------------------------------------------------------------ */
function enterGame() {
  ensureAudio();
  goImmersive();
  playSequence("bonus");
  els.splash.classList.add("is-leaving");
  window.setTimeout(() => els.splash.classList.add("is-hidden"), 600);
}

function bindEvents() {
  els.enterButton.addEventListener("click", enterGame);
  els.decreaseBet.addEventListener("click", () => changeBet(-1));
  els.increaseBet.addEventListener("click", () => changeBet(1));
  els.spinButton.addEventListener("click", () => requestSpin(false));
  els.turboButton.addEventListener("click", toggleTurbo);
  els.autoButton.addEventListener("click", toggleAuto);
  els.addCoinsButton.addEventListener("click", addCoins);
  els.paytableButton.addEventListener("click", openPaytable);
  els.closePaytableButton.addEventListener("click", () => els.paytableModal.classList.add("is-hidden"));
  els.collectBonusButton.addEventListener("click", collectBonus);
  els.fullscreenButton.addEventListener("click", toggleFullscreen);
  els.soundButton.addEventListener("click", () => {
    state.sound = !state.sound;
    if (!state.sound) stopSpinNoise();
    if (state.sound) playSequence("bonus");
    updateUi();
  });

  window.addEventListener("resize", () => {
    resizeCanvas();
    if (!spinning) fillIdleStrips();
  });

  document.addEventListener("keydown", (event) => {
    if (event.code === "Space" && !event.repeat) {
      event.preventDefault();
      requestSpin(false);
    }
  });
}

function init() {
  resizeCanvas();
  renderGridIdle();
  bindEvents();
  updateUi();
  startJackpotTicker();
  setStatus("PLACE YOUR BETS");
  if (window.location.hash.includes("nosplash")) els.splash.classList.add("is-hidden");
  if (window.location.hash.includes("testspin")) window.setTimeout(() => requestSpin(false), 200);
}

init();
