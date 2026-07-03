const STORAGE_KEY = "cleopatra-royale-mobile";
const COLS = 5;
const ROWS = 3;
const START_BALANCE = 2500;
const BETS = [10, 25, 50, 100, 250, 500];
const LINE_FACTOR = 0.13;

const symbols = [
  { id: "cleo", glyph: "Q", name: "Queen", weight: 2, pays: { 3: 7, 4: 22, 5: 140 } },
  { id: "eye", glyph: "EYE", name: "Horus", weight: 3, pays: { 3: 4.5, 4: 16, 5: 80 }, wild: true },
  { id: "pyramid", glyph: "PYR", name: "Pyramid", weight: 5, pays: { 3: 3, 4: 9, 5: 38 } },
  { id: "scarab", glyph: "GEM", name: "Scarab", weight: 6, pays: { 3: 2.5, 4: 7.5, 5: 30 } },
  { id: "sun", glyph: "SUN", name: "Sun", weight: 8, pays: { 3: 2, 4: 6, 5: 24 } },
  { id: "ruby", glyph: "R", name: "Ruby", weight: 9, pays: { 3: 1.7, 4: 5, 5: 19 } },
  { id: "cobra", glyph: "C", name: "Cobra", weight: 11, pays: { 3: 1.45, 4: 4, 5: 14 } },
  { id: "lotus", glyph: "L", name: "Lotus", weight: 13, pays: { 3: 1.25, 4: 3.2, 5: 11 } },
  { id: "vase", glyph: "V", name: "Vase", weight: 15, pays: { 3: 1.05, 4: 2.5, 5: 8 } },
  { id: "ankh", glyph: "ANKH", name: "Ankh", weight: 4, scatter: true },
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

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const els = {
  balance: $("#lobbyBalance"),
  gamesBalance: $("#gamesBalance"),
  profileBalance: $("#profileBalance"),
  bestWin: $("#bestWin"),
  profileFreeSpins: $("#profileFreeSpins"),
  profileSpins: $("#profileSpins"),
  lobbyJackpot: $("#lobbyJackpot"),
  freeSpinTile: $("#freeSpinTile"),
  rewardFreeSpins: $("#rewardFreeSpins"),
  playerScore: $("#playerScore"),
  reelGrid: $("#reelGrid"),
  jackpotValue: $("#jackpotValue"),
  lastWin: $("#lastWin"),
  multiplier: $("#multiplier"),
  sessionSpins: $("#sessionSpins"),
  mirageMeter: $("#mirageMeter"),
  statusMessage: $("#statusMessage"),
  decreaseBet: $("#decreaseBet"),
  increaseBet: $("#increaseBet"),
  betValue: $("#betValue"),
  spinButton: $("#spinButton"),
  maxBetButton: $("#maxBetButton"),
  autoButton: $("#autoButton"),
  soundButton: $("#soundButton"),
  resetButton: $("#resetButton"),
  claimRewardButton: $("#claimRewardButton"),
  canvas: $("#fxCanvas"),
  winOverlay: $("#winOverlay"),
  winTier: $("#winTier"),
  winAmount: $("#winAmount"),
  winSubtitle: $("#winSubtitle"),
  bonusModal: $("#bonusModal"),
  bonusChoices: $("#bonusChoices"),
  bonusText: $("#bonusText"),
  collectBonusButton: $("#collectBonusButton"),
};

const weightedBag = symbols.flatMap((symbol) => Array.from({ length: symbol.weight }, () => symbol));
const symbolById = Object.fromEntries(symbols.map((symbol) => [symbol.id, symbol]));

let state = loadState();
let matrix = createMatrix();
let spinning = false;
let autoRemaining = 0;
let soundOn = true;
let audioContext;
let particles = [];
let particleFrame = 0;
let winTimer = 0;
let winCounterFrame = 0;
let bonusOpen = false;
let pendingBonus = null;
let spinHoldTimer = 0;

function loadState() {
  const fallback = {
    balance: START_BALANCE,
    bet: 25,
    lastWin: 0,
    bestWin: 0,
    spins: 0,
    jackpot: 12840,
    freeSpins: 0,
    mirage: 0,
    nextMultiplier: 1,
    rewardClaimed: false,
  };

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved !== "object") {
      return fallback;
    }
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

function renderGrid() {
  els.reelGrid.innerHTML = "";
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const cell = document.createElement("div");
      cell.className = "symbol-cell";
      els.reelGrid.appendChild(cell);
      renderCell(row * COLS + col, matrix[row][col]);
    }
  }
}

function renderCell(index, symbol, mode = {}) {
  const cell = els.reelGrid.children[index];
  if (!cell) return;
  cell.className = "symbol-cell";
  cell.dataset.symbol = symbol.id;
  if (mode.spinning) cell.classList.add("is-spinning");
  if (mode.hot) cell.classList.add("is-hot");
  cell.innerHTML = `
    <span class="symbol-inner">
      <span class="symbol-glyph" aria-hidden="true">${symbol.glyph}</span>
      <span class="symbol-name">${symbol.name}</span>
    </span>
  `;
  cell.setAttribute("aria-label", symbol.name);
}

function updateUi() {
  const balance = formatNumber(state.balance);
  els.balance.textContent = balance;
  els.gamesBalance.textContent = balance;
  els.profileBalance.textContent = balance;
  els.lobbyJackpot.textContent = formatNumber(state.jackpot);
  els.jackpotValue.textContent = formatNumber(state.jackpot);
  els.lastWin.textContent = formatNumber(state.lastWin);
  els.bestWin.textContent = formatNumber(state.bestWin);
  els.sessionSpins.textContent = formatNumber(state.spins);
  els.profileSpins.textContent = formatNumber(state.spins);
  els.betValue.textContent = formatNumber(state.bet);
  els.multiplier.textContent = `x${state.nextMultiplier}`;
  els.freeSpinTile.textContent = formatNumber(state.freeSpins);
  els.rewardFreeSpins.textContent = formatNumber(state.freeSpins);
  els.profileFreeSpins.textContent = formatNumber(state.freeSpins);
  els.playerScore.textContent = formatNumber(state.bestWin * 12 + state.spins * 25);
  els.mirageMeter.style.width = `${Math.min(100, state.mirage)}%`;
  els.autoButton.textContent = autoRemaining ? `Stop ${autoRemaining}` : "Auto 10";
  els.soundButton.textContent = soundOn ? "Sound" : "Muted";
  els.claimRewardButton.textContent = state.rewardClaimed ? "Claimed" : "Claim";
  els.claimRewardButton.disabled = state.rewardClaimed;
  const locked = spinning || bonusOpen;
  [els.decreaseBet, els.increaseBet, els.maxBetButton, els.spinButton].forEach((button) => {
    button.disabled = locked;
  });
  els.autoButton.disabled = bonusOpen;
  saveState();
}

function canSpin() {
  return state.freeSpins > 0 || state.balance >= state.bet;
}

function goToScreen(name) {
  $$(".screen").forEach((screen) => {
    screen.classList.toggle("is-active", screen.dataset.screen === name);
    if (screen.dataset.screen === name) screen.scrollTop = 0;
  });
  $$(".nav-item").forEach((item) => item.classList.toggle("is-active", item.dataset.nav === name));
}

function setStatus(message) {
  els.statusMessage.textContent = message;
}

function clearHighlights() {
  $$(".symbol-cell").forEach((cell) => {
    cell.classList.remove("is-winner", "is-hot");
  });
}

function highlightPositions(positions) {
  clearHighlights();
  positions.forEach((position) => {
    els.reelGrid.children[position]?.classList.add("is-winner");
  });
}

function getLineSymbols(line) {
  return line.map((row, col) => matrix[row][col]);
}

function getLinePositions(line, count = COLS) {
  return line.slice(0, count).map((row, col) => row * COLS + col);
}

function evaluateSpin(multiplier) {
  const wins = [];
  const positions = new Set();
  let total = 0;
  let jackpotHit = false;

  payLines.forEach((line, lineIndex) => {
    const lineSymbols = getLineSymbols(line);
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

    if (target && count >= 3) {
      const pay = Math.max(1, Math.round(state.bet * target.pays[count] * LINE_FACTOR * multiplier));
      total += pay;
      getLinePositions(line, count).forEach((position) => positions.add(position));
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
    freeSpinsAwarded = Math.min(12, scatterPositions.length + 2);
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

function maybeOpenBonus(totalWin) {
  const opens = countSymbol("cleo") >= 3 || countSymbol("pyramid") >= 5 || totalWin >= state.bet * 28;
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
    { label: "3 Spins", freeSpins: 3 },
    { label: "Magic", meter: 100 },
  ]);

  els.bonusChoices.innerHTML = "";
  awards.forEach((award, index) => {
    const button = document.createElement("button");
    button.className = "bonus-choice";
    button.type = "button";
    button.textContent = ["Relic", "Gem", "Sun", "Eye", "Gold", "Ankh"][index];
    button.addEventListener("click", () => revealBonus(button, award));
    els.bonusChoices.appendChild(button);
  });
  els.bonusText.textContent = "Choose three relics and reveal the treasure.";
  els.collectBonusButton.classList.add("is-hidden");
  els.bonusModal.classList.remove("is-hidden");
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
  els.bonusText.textContent = `Revealed: ${formatNumber(pendingBonus.credits)} credits`;
  if (pendingBonus.freeSpins) els.bonusText.textContent += ` · ${pendingBonus.freeSpins} free spins`;
  if (pendingBonus.meter) els.bonusText.textContent += " · magic charged";
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
  state.mirage = Math.max(state.mirage, pendingBonus.meter);
  if (state.mirage >= 100) {
    state.mirage = 0;
    state.nextMultiplier = Math.max(state.nextMultiplier, 2);
  }
  pendingBonus = null;
  bonusOpen = false;
  els.bonusModal.classList.add("is-hidden");
  burst(100, "mega");
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

async function requestSpin(fromAuto = false) {
  if (spinning || bonusOpen) return;
  goToScreen("games");
  if (fromAuto) {
    autoRemaining = Math.max(0, autoRemaining - 1);
  } else {
    autoRemaining = 0;
  }
  if (!canSpin()) {
    autoRemaining = 0;
    setStatus("Not enough demo credits for this bet.");
    updateUi();
    return;
  }
  await spin();
  scheduleAuto();
}

async function spin() {
  spinning = true;
  clearHighlights();
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
  setStatus(usedFreeSpin ? "A free spin enters the queen's chamber." : "The reels awaken under golden fire.");
  updateUi();
  playSequence("spin");

  matrix = createMatrix();
  await animateReels(matrix);

  const result = evaluateSpin(spinMultiplier);
  state.lastWin = result.total;
  state.bestWin = Math.max(state.bestWin, result.total);
  state.balance += result.total;
  state.freeSpins += result.freeSpinsAwarded;

  if (result.total > 0) {
    state.mirage = Math.max(0, state.mirage - 20);
    highlightPositions(result.positions);
    showWinOverlay(result.total);
    playSequence(result.total >= state.bet * 15 ? "big" : "win");
    burst(Math.min(220, 45 + Math.round((result.total / state.bet) * 9)), result.total >= state.bet * 15 ? "mega" : "win");
    showResultMessage(result);
  } else {
    state.mirage = Math.min(100, state.mirage + 18);
    setStatus("Ancient magic is charging the next big moment.");
  }

  if (state.mirage >= 100) {
    state.mirage = 0;
    state.nextMultiplier = Math.max(state.nextMultiplier, 2);
    setStatus("Ancient Magic is full. Next spin is multiplied.");
    playSequence("bonus");
    burst(65, "magic");
  }

  const openedBonus = maybeOpenBonus(result.total);
  spinning = false;
  updateUi();

  if (!openedBonus && state.balance < state.bet && state.freeSpins === 0) {
    setStatus("Demo credits are low. Reset or claim a reward to continue.");
  }
}

function showResultMessage(result) {
  const parts = [];
  if (result.jackpotWin) parts.push(`Grand jackpot ${formatNumber(result.jackpotWin)}`);
  if (result.freeSpinsAwarded) parts.push(`${result.freeSpinsAwarded} free spins`);
  const lineWin = result.wins.find((win) => !win.scatter);
  if (lineWin) parts.push(`${lineWin.count} ${lineWin.target.name}`);
  parts.push(`Win ${formatNumber(result.total)}`);
  setStatus(parts.join(" · "));
}

function scheduleAuto() {
  updateUi();
  if (autoRemaining > 0 && !spinning && !bonusOpen) {
    window.setTimeout(() => requestSpin(true), 650);
  }
}

function animateReels(targetMatrix) {
  return new Promise((resolve) => {
    const timers = [];
    for (let col = 0; col < COLS; col += 1) {
      for (let row = 0; row < ROWS; row += 1) {
        const index = row * COLS + col;
        const interval = window.setInterval(() => {
          renderCell(index, randomSymbol(), { spinning: true });
        }, 62);
        timers.push(interval);
      }

      window.setTimeout(() => {
        for (let row = 0; row < ROWS; row += 1) {
          const index = row * COLS + col;
          const timerIndex = col * ROWS + row;
          window.clearInterval(timers[timerIndex]);
          renderCell(index, targetMatrix[row][col], { hot: col === COLS - 1 });
        }
        if (col === COLS - 1) window.setTimeout(resolve, 160);
      }, 440 + col * 190);
    }
  });
}

function changeBet(direction) {
  const currentIndex = BETS.indexOf(state.bet);
  const nextIndex = Math.min(BETS.length - 1, Math.max(0, currentIndex + direction));
  state.bet = BETS[nextIndex];
  setStatus(`Total bet ${formatNumber(state.bet)}.`);
  updateUi();
}

function setMaxBet() {
  const affordable = BETS.filter((bet) => bet <= Math.max(state.balance, state.bet));
  state.bet = affordable.at(-1) || BETS[0];
  setStatus(`Max bet ${formatNumber(state.bet)}.`);
  updateUi();
}

function claimReward() {
  if (state.rewardClaimed) return;
  state.rewardClaimed = true;
  state.balance += 500;
  state.freeSpins += 3;
  burst(120, "mega");
  playSequence("bonus");
  updateUi();
}

function resetGame() {
  state = {
    balance: START_BALANCE,
    bet: 25,
    lastWin: 0,
    bestWin: 0,
    spins: 0,
    jackpot: 12840,
    freeSpins: 0,
    mirage: 0,
    nextMultiplier: 1,
    rewardClaimed: false,
  };
  autoRemaining = 0;
  matrix = createMatrix();
  renderGrid();
  setStatus("A fresh royal session begins.");
  updateUi();
}

function winTierFor(totalWin) {
  const ratio = totalWin / Math.max(1, state.bet);
  if (ratio >= 40) return { label: "MEGA WIN", subtitle: "The treasure room erupts", duration: 3600 };
  if (ratio >= 18) return { label: "BIG WIN", subtitle: "Cleopatra blesses the reels", duration: 3000 };
  if (ratio >= 6) return { label: "NICE WIN", subtitle: "Golden magic unlocked", duration: 2300 };
  return { label: "WIN", subtitle: "Temple treasure unlocked", duration: 1700 };
}

function showWinOverlay(totalWin) {
  const tier = winTierFor(totalWin);
  hideWinOverlay(false);
  document.body.classList.add("app-win-pulse");
  els.winTier.textContent = tier.label;
  els.winSubtitle.textContent = tier.subtitle;
  els.winOverlay.classList.remove("is-hidden", "is-leaving");

  const start = performance.now();
  const countDuration = Math.min(1500, Math.max(620, tier.duration * 0.45));
  function tick(now) {
    const progress = Math.min(1, (now - start) / countDuration);
    const eased = 1 - Math.pow(1 - progress, 3);
    els.winAmount.textContent = formatNumber(totalWin * eased);
    if (progress < 1) {
      winCounterFrame = requestAnimationFrame(tick);
    } else {
      els.winAmount.textContent = formatNumber(totalWin);
    }
  }
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
  document.body.classList.remove("app-win-pulse");
}

function ensureAudio() {
  if (!audioContext) {
    const AudioEngine = window.AudioContext || window.webkitAudioContext;
    if (!AudioEngine) {
      soundOn = false;
      return;
    }
    audioContext = new AudioEngine();
  }
  if (audioContext.state === "suspended") audioContext.resume();
}

function playTone(frequency, duration = 0.12, type = "sine", gain = 0.035) {
  if (!soundOn) return;
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

function playSequence(kind) {
  if (!soundOn) return;
  const sequences = {
    spin: [220, 265, 318],
    win: [392, 523, 659, 784],
    big: [330, 392, 523, 659, 784, 1046, 1318],
    bonus: [330, 494, 660, 988],
  };
  (sequences[kind] || sequences.win).forEach((note, index) => {
    window.setTimeout(() => playTone(note, kind === "big" ? 0.16 : 0.11, kind === "spin" ? "triangle" : "sine", kind === "big" ? 0.052 : 0.035), index * 76);
  });
}

function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  els.canvas.width = Math.floor(window.innerWidth * ratio);
  els.canvas.height = Math.floor(window.innerHeight * ratio);
  els.canvas.style.width = `${window.innerWidth}px`;
  els.canvas.style.height = `${window.innerHeight}px`;
  const context = els.canvas.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function burst(amount, mode = "win") {
  const colors = ["#ffd15a", "#fff4a7", "#24e0cd", "#ff3f75", "#39e082", "#7e31ff"];
  const centerX = window.innerWidth / 2;
  const centerY = mode === "mega" ? window.innerHeight * 0.34 : window.innerHeight * 0.44;
  for (let index = 0; index < amount; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = mode === "mega" ? 4 + Math.random() * 9 : 2.5 + Math.random() * 6;
    const isCoin = Math.random() > 0.34;
    particles.push({
      x: centerX + (Math.random() - 0.5) * 220,
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

function bindEvents() {
  $$("[data-nav]").forEach((button) => {
    button.addEventListener("click", () => goToScreen(button.dataset.nav));
  });
  $$("[data-open-game]").forEach((button) => {
    button.addEventListener("click", () => goToScreen("games"));
  });
  els.decreaseBet.addEventListener("click", () => changeBet(-1));
  els.increaseBet.addEventListener("click", () => changeBet(1));
  els.maxBetButton.addEventListener("click", setMaxBet);
  els.spinButton.addEventListener("click", () => requestSpin(false));
  els.spinButton.addEventListener("pointerdown", () => {
    spinHoldTimer = window.setTimeout(() => {
      autoRemaining = 10;
      requestSpin(true);
    }, 520);
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach((eventName) => {
    els.spinButton.addEventListener(eventName, () => window.clearTimeout(spinHoldTimer));
  });
  els.autoButton.addEventListener("click", () => {
    if (autoRemaining > 0) {
      autoRemaining = 0;
      setStatus("Auto spin stopped.");
      updateUi();
      return;
    }
    autoRemaining = 10;
    requestSpin(true);
  });
  els.soundButton.addEventListener("click", () => {
    soundOn = !soundOn;
    if (soundOn) playSequence("bonus");
    updateUi();
  });
  els.claimRewardButton.addEventListener("click", claimReward);
  els.resetButton.addEventListener("click", resetGame);
  els.collectBonusButton.addEventListener("click", collectBonus);
  window.addEventListener("resize", resizeCanvas);
  document.addEventListener("keydown", (event) => {
    if (event.code === "Space" && !event.repeat) {
      event.preventDefault();
      requestSpin(false);
    }
  });
}

function init() {
  resizeCanvas();
  renderGrid();
  bindEvents();
  updateUi();
}

init();
