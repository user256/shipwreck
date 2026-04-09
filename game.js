const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

/** Raster ship skins; loaded on demand when selected. */
let serenityShipImg = null;
let fireflyShipImg = null;
let issStationImg = null;
const scoreEl = document.getElementById("score");
const levelEl = document.getElementById("level");
const hullEl = document.getElementById("hull");
const shieldHudEl = document.getElementById("shieldHud");
const statusEl = document.getElementById("status");
const restartBtn = document.getElementById("restart");
const wrapToggleEl = document.getElementById("wrapToggle");
const shockwaveToggleEl = document.getElementById("shockwaveToggle");
const mineChainToggleEl = document.getElementById("mineChainToggle");
const damageOpacityToggleEl = document.getElementById("damageOpacityToggle");
const levelPauseToggleEl = document.getElementById("levelPauseToggle");
const spaceModeToggleEl = document.getElementById("spaceModeToggle");
const cruisingToggleEl = document.getElementById("cruisingToggle");
const startLevelInputEl = document.getElementById("startLevelInput");
const startAtBtn = document.getElementById("startAtBtn");
const cruiseSpeedInputEl = document.getElementById("cruiseSpeedInput");
const cruiseSpeedValueEl = document.getElementById("cruiseSpeedValue");
const installBtn = document.getElementById("installBtn");
const largeModeBtn = document.getElementById("largeModeBtn");
const worldModeBtn = document.getElementById("worldModeBtn");
const settingsBtn = document.getElementById("settingsBtn");
const settingsPanelEl = document.getElementById("settingsPanel");
const settingsBackdropEl = document.getElementById("settingsBackdrop");
const settingsCloseBtn = document.getElementById("settingsCloseBtn");
const wikiBtn = document.getElementById("wikiBtn");
const wikiPanelEl = document.getElementById("wikiPanel");
const wikiBackdropEl = document.getElementById("wikiBackdrop");
const wikiCloseBtn = document.getElementById("wikiCloseBtn");
const shipSkinSelectEl = document.getElementById("shipSkinSelect");
const gravSingularityWarnEl = document.getElementById("gravSingularityWarn");
const spaceStationToggleEl = document.getElementById("spaceStationToggle");
const stationDockPanelEl = document.getElementById("stationDockPanel");
const stationHullBtn = document.getElementById("stationHullBtn");
const stationShieldBtn = document.getElementById("stationShieldBtn");
const stationBlasterBtn = document.getElementById("stationBlasterBtn");
const stationLeaveBtn = document.getElementById("stationLeaveBtn");
const mobileLeftBtn = document.getElementById("mobileLeftBtn");
const mobileDpadUpBtn = document.getElementById("mobileDpadUpBtn");
const mobileRightBtn = document.getElementById("mobileRightBtn");
const mobileThrottleBtn = document.getElementById("mobileThrottleBtn");
const mobileReverseBtn = document.getElementById("mobileReverseBtn");
const mobileFireBtn = document.getElementById("mobileFireBtn");
const mobilePauseBtn = document.getElementById("mobilePauseBtn");
const mobileCruiseBtn = document.getElementById("mobileCruiseBtn");
const mobileControlsEl = document.getElementById("mobileControls");
const appEl = document.querySelector(".app");

const WORLD = { width: canvas.width, height: canvas.height };

/** Large canvas by default on desktop; off when touch-primary or narrow viewport. */
function defaultLargeModeForDesktop() {
  const touch = navigator.maxTouchPoints > 0;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const narrow = window.innerWidth <= 900;
  return !((coarse || narrow) && touch);
}

const BASE_HULL = 100;
const MAX_HULL = 200;
/** Shield capacity in % (0–200). Power-ups can charge to full; regen/heal only refill up to `SHIELD_REGEN_CAP`. */
const MAX_SHIELD = 200;
/** Score-based shield repair and passive healing stop here; use mystery shield pickups to reach `MAX_SHIELD`. */
const SHIELD_REGEN_CAP = 100;
/** Mystery shield prize: always at least this % after pickup (if you were below), and stacks toward max. */
const SHIELD_POWERUP_MIN_AFTER = 100;
const DEFAULT_CANVAS_WIDTH = 960;
const DEFAULT_CANVAS_HEIGHT = 640;

const TUNING = {
  /** Seconds of normal play before the level index advances (boss / pauses not counted). */
  levelStepSeconds: 80,
  mysteryCapBase: 3,
  /**
   * Extra mystery slots per `mysteryCapScoreStep` score (cap still modest; unlocks faster than every 1000 pts).
   */
  mysteryCapScoreStep: 500,
  mysteryCapPerScoreStep: 2,
  /** From this level, mystery pickup budget resets each level (~drops per level segment). */
  mysteryLevel16Threshold: 16,
  mysteryCapLevel16Plus: 5,
  /**
   * Applied to coin pickups, boss defeat score, and mystery cash prizes — longer levels reward more points
   * without raising how many upgrade pickups can spawn.
   */
  economyScoreMultiplier: 2,
  mineMinSpawnDistance: 180,
  /** Scaled with `levelStepSeconds` so mine density per level stays similar when level length changes. */
  mineSpawnIntervalMax: 5.8,
  mineSpawnIntervalMin: 1.7,
  mineSpawnIntervalPerLevel: 0.32,
  treasureSpawnIntervalMax: 3.0,
  treasureSpawnIntervalMin: 1.4,
  treasureSpawnIntervalPerLevel: 0.1,
  /** Black hole core radius is random up to this × scaled planet body radius (same scale as classic worlds). */
  blackHoleSingularityMaxFracOfPlanetBody: 0.75,
  /** Lower bound for singularity roll, as a fraction of that max (keeps a visible floor). */
  blackHoleSingularityMinFracOfCap: 0.22,
  /** Absolute floor (px) so tiny caps still read in-game. */
  blackHoleSingularityAbsFloor: 4,
  /** Per gravity slot: chance that world is a black hole instead of a planet (ignored if settings.singularity). */
  blackHoleSpawnChance: 0.14,
  /** Boss fight: treasure cadence (seconds between spawns). Tighter than normal play so bosses drop more loot. */
  bossTreasureSpawnMin: 1.1,
  bossTreasureSpawnMax: 1.65,
  /** Boss fight: mystery upgrade attempts — much faster than non-boss so long boss fights stay rewarding. */
  bossMysterySpawnMin: 5.2,
  bossMysterySpawnMax: 8.5,
  /** Non-boss mystery spawn attempts (~classic cadence so upgrades stay visible during long levels). */
  mysterySpawnIntervalMin: 10.5,
  mysterySpawnIntervalMax: 15.5,
  /** Cruising (casual, Space or Planets): mine spawn interval multiplier (50% slower → 1.5× spacing). */
  cruisingMineSpawnIntervalMultiplier: 1.5,
  /** Cruising: forward/reverse thrust acceleration multiplier. */
  cruisingAccelScale: 0.5,
  /** Extra mystery prizes allowed while a boss is active (on top of normal cap). */
  bossMysteryExtraCap: 16,
  /** Virtual level boost when rolling treasure tiers during a boss. */
  bossTreasureLevelBonus: 2,
  /**
   * Level 5: up to three combat relocates — each fires when remaining HP drops *below*
   * maxHp × value (e.g. 0.75 → after ~25% damage, then 50%, then 75%).
   */
  bossRelocateRemainingFracs: [0.75, 0.5, 0.25],
  /** Level 5 relocate: new patrol row Y is chosen between these world-height fractions. */
  bossRelocateYMinFrac: 0.09,
  bossRelocateYMaxFrac: 0.38,
  /** Prefer a vertical shift at least this tall (fraction of world height) when possible. */
  bossRelocateYMinDeltaFrac: 0.055,
  /** Level 5: seconds of loot time after the raider dies, then the level timer hits and you advance. */
  /** Loot window after mirror raider; scaled with `levelStepSeconds`. */
  postBossLevel5CollectSeconds: 14,
  /**
   * Shield repair from scoring: adds only while shield is below `SHIELD_REGEN_CAP` (100%).
   * e.g. 0.012 → +12 per 1000 score toward that cap; mystery pickups raise shield toward 200%.
   */
  shieldRegenPerScorePoint: 0.012,
  /** Level 5 mirror raider: intro/outro vertical jump (fraction of world height). */
  bossAppearJumpHeightFrac: 0.2,
  bossExitJumpHeightFrac: 0.24,
  /** Orbital station (optional): hull / shield / blaster services. */
  stationServiceCost: 1000,
  stationSpawnTimerMin: 38,
  stationSpawnTimerMax: 72,
  stationSpawnRetrySec: 10,
  stationRespawnAfterBossMin: 22,
  stationRespawnAfterBossMax: 48,
  stationBodyRadius: 44,
  stationDockRange: 96,
  stationDrawWidth: 112,
  /** Station despawns after this many seconds or when you undock. */
  stationLifetimeSeconds: 60,
};

/** Levels that trigger a boss encounter (interstitial + clear field + unique threat). */
const BOSS_LEVELS = new Set([5, 10, 15, 20]);

function isBossLevel(level) {
  return BOSS_LEVELS.has(level);
}

/** Mirror raider (levels 5, 10, 15 & 20): intro/outro jump + HP relocates. */
function mirrorRaiderBossUsesJumpEffects() {
  return game.level === 5 || game.level === 10 || game.level === 15 || game.level === 20;
}

/** Level 10 raider: triple forward burst (tier-2-style spread). */
function mirrorRaiderBossUsesTripleForwardBurst() {
  return game.level === 10;
}

/** Level 15 / 20 raider: triple forward plus triple backward (each ship). */
function mirrorRaiderBossUsesTripleForwardAndBackwardBurst() {
  return game.level === 15 || game.level === 20;
}

// Hidden debug/nostalgia cheats (intentionally not shown in UI):
// - howdoyouturnthisthingon => blaster
// - idontexist             => 60s invulnerability
// - putonyourcapes         => max hull + shield
// - sethgreen              => max blaster + hull + shield + immunity
const CHEATS = {
  howdoyouturnthisthingon: () => {
    game.hasBlaster = true;
    game.blasterTier = 1;
    game.blasterCooldown = 0;
    addOverlay("Power Surge: Blaster", "#ffc38d");
    statusEl.textContent = "A strange power surges through the ship.";
  },
  idontexist: () => {
    game.immunityTimer = Math.max(game.immunityTimer, 60);
    game.invuln = Math.max(game.invuln, 1.2);
    addOverlay("Power Surge: Spectral Veil", "#bfc8ff");
    statusEl.textContent = "A strange power surges through the ship.";
  },
  putonyourcapes: () => {
    game.hull = MAX_HULL;
    game.shieldScoreRegenUnlocked = true;
    game.shield = MAX_SHIELD;
    addOverlay("Power Surge: Fortified Hull", "#90d5ff");
    statusEl.textContent = "A strange power surges through the ship.";
  },
  sethgreen: () => {
    game.hasBlaster = true;
    game.blasterTier = 3;
    game.blasterCooldown = 0;
    game.hull = MAX_HULL;
    game.shieldScoreRegenUnlocked = true;
    game.shield = MAX_SHIELD;
    game.immunityTimer = Math.max(game.immunityTimer, 60);
    game.invuln = Math.max(game.invuln, 1.2);
    addOverlay("Power Surge: Full Arsenal", "#ffc38d");
    statusEl.textContent = "A strange power surges through the ship.";
  },
};

/**
 * Ship skins. For raster SVGs, optional `rasterScale` multiplies on-screen size (same base as Classic
 * hit radius) so different viewBox padding / silhouette fill can be matched. Other approaches: tune SVG
 * viewBox, or add per-asset `contentCrop` bounds and scale to a fixed world size.
 */
const SHIP_SKIN_OPTIONS = [
  { id: "default", label: "Classic" },
  { id: "serenity", label: "Serenity", rasterScale: 1 },
  { id: "firefly", label: "Firefly", rasterScale: 0.88 },
];

function getShipSkinDisplayLabel() {
  return SHIP_SKIN_OPTIONS.find((o) => o.id === game.settings.shipSkin)?.label ?? "Ship";
}

/** Boss encounter titles (use current ship skin label). */
function getDarkBossEncounterTitle(level) {
  const ship = getShipSkinDisplayLabel();
  if (level === 5) return `Dark ${ship}`;
  if (level === 10) return `Dark ${ship} — Slight Return`;
  if (level === 15) return `Dark ${ship} — Crossfire`;
  if (level === 20) return `Dark ${ship} — Twin Crossfire`;
  return `BOSS — Level ${level}`;
}

const TREASURE_TABLE = [
  { value: 10, weight: 38, life: 14.5, color: "#a76b2c", radius: 7 },
  { value: 25, weight: 24, life: 12.6, color: "#b7b7b7", radius: 8 },
  { value: 50, weight: 18, life: 10.8, color: "#d6d6d6", radius: 9 },
  { value: 100, weight: 10, life: 9.2, color: "#ece27a", radius: 9 },
  { value: 250, weight: 6, life: 7.6, color: "#e6cd58", radius: 10 },
  { value: 500, weight: 3, life: 6.2, color: "#f0d23f", radius: 11 },
  { value: 1000, weight: 1, life: 5.1, color: "#f4f2df", radius: 12 },
];

const KEY = Object.create(null);
let cheatBuffer = "";

function resumeFromLevelPause() {
  if (game.pendingBossSpawn) {
    spawnBossMirrorRaider();
    game.pendingBossSpawn = false;
  }
  game.awaitingLevelContinue = false;
  game.paused = false;
  game.lastTs = performance.now();
  statusEl.textContent =
    game.bosses.length > 0 ? "Sail — take down the raider!" : "Sail!";
}

function togglePause() {
  if (game.stationDockMode) return;
  if (game.gameOver || !game.started) return;
  if (game.awaitingLevelContinue) {
    resumeFromLevelPause();
    return;
  }
  game.paused = !game.paused;
  statusEl.textContent = game.paused ? "Paused. Press Space to resume." : "Resumed.";
}

window.addEventListener("keydown", (e) => {
  if (e.code === "Escape" && game.stationDockMode) {
    e.preventDefault();
    leaveStationDock();
    return;
  }
  const wikiOpen = wikiPanelEl && !wikiPanelEl.hidden;
  if (wikiOpen) {
    if (e.code === "Escape") {
      e.preventDefault();
      setWikiOpen(false);
      return;
    }
    const wikiPassThrough = new Set([
      "Tab",
      "ArrowDown",
      "ArrowUp",
      "ArrowLeft",
      "ArrowRight",
      "PageDown",
      "PageUp",
      "Home",
      "End",
      "Space",
    ]);
    if (!wikiPassThrough.has(e.code)) {
      e.preventDefault();
    }
    return;
  }
  const settingsOpen = settingsPanelEl && !settingsPanelEl.hidden;
  if (settingsOpen) {
    if (e.code === "Escape") {
      e.preventDefault();
      setSettingsOpen(false);
      return;
    }
  }
  if (e.code === "KeyE" && !e.repeat && game.started && !game.gameOver) {
    if (game.stationDockMode) {
      e.preventDefault();
      leaveStationDock();
      return;
    }
    if (
      game.spaceStation &&
      playerInStationDockRange() &&
      !game.paused &&
      !game.awaitingLevelContinue
    ) {
      e.preventDefault();
      openStationDock();
      return;
    }
  }
  const canTypeCheat = !game.started || game.paused;
  if (canTypeCheat && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) {
    cheatBuffer += e.key.toLowerCase();
    if (cheatBuffer.length > 40) cheatBuffer = cheatBuffer.slice(-40);
    for (const [code, applyCheat] of Object.entries(CHEATS)) {
      if (cheatBuffer.endsWith(code)) {
        applyCheat();
        cheatBuffer = "";
        break;
      }
    }
  }
  if (e.code === "Space") {
    e.preventDefault();
    if (!e.repeat) togglePause();
  }
  if (
    (e.code === "KeyG" || e.code === "Delete") &&
    !e.repeat &&
    game.started &&
    !game.gameOver &&
    !game.paused
  ) {
    tryEmergencyJump();
  }
  KEY[e.code] = true;
});
window.addEventListener("keyup", (e) => {
  KEY[e.code] = false;
});

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function wrapEntity(e) {
  if (e.x < 0) e.x += WORLD.width;
  if (e.x >= WORLD.width) e.x -= WORLD.width;
  if (e.y < 0) e.y += WORLD.height;
  if (e.y >= WORLD.height) e.y -= WORLD.height;
}

function confineEntity(e, bounce = 0.45) {
  if (e.x < e.radius) {
    e.x = e.radius;
    if (e.vx < 0) e.vx = -e.vx * bounce;
  } else if (e.x > WORLD.width - e.radius) {
    e.x = WORLD.width - e.radius;
    if (e.vx > 0) e.vx = -e.vx * bounce;
  }

  if (e.y < e.radius) {
    e.y = e.radius;
    if (e.vy < 0) e.vy = -e.vy * bounce;
  } else if (e.y > WORLD.height - e.radius) {
    e.y = WORLD.height - e.radius;
    if (e.vy > 0) e.vy = -e.vy * bounce;
  }
}

function distSq(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function getTreasureWeightForLevel(treasure, level) {
  const levelBoost = Math.max(0, level - 1);
  const tierMultiplier = treasure.value >= 500 ? 0.16 : treasure.value >= 250 ? 0.11 : treasure.value >= 100 ? 0.07 : 0.02;
  return treasure.weight * (1 + levelBoost * tierMultiplier);
}

function chooseTreasure(level) {
  const totalWeight = TREASURE_TABLE.reduce((sum, t) => sum + getTreasureWeightForLevel(t, level), 0);
  let roll = Math.random() * totalWeight;
  for (const t of TREASURE_TABLE) {
    roll -= getTreasureWeightForLevel(t, level);
    if (roll <= 0) return t;
  }
  return TREASURE_TABLE[0];
}

const game = {
  player: null,
  mines: [],
  treasures: [],
  score: 0,
  /** Last score used for shield regen from points (see `applyShieldRegenFromScoreDelta`). */
  prevScoreForShieldRegen: 0,
  hull: BASE_HULL,
  level: 1,
  gameOver: false,
  invuln: 0,
  mineSpawnTimer: 0,
  treasureSpawnTimer: 0,
  levelTimer: 0,
  lastTs: 0,
  explosions: [],
  mysterySpawnTimer: 0,
  mysteryAwarded: 0,
  speedBoostTimer: 0,
  immunityTimer: 0,
  shield: 0,
  /** Score-based shield regen runs only after first shield mystery (or cheat); then always. */
  shieldScoreRegenUnlocked: false,
  hasBlaster: false,
  blasterTier: 0,
  bullets: [],
  blasterCooldown: 0,
  jumpNextThreshold: 1000,
  /** Show "Jump @ score" in HUD only after the first successful emergency jump. */
  jumpRechargeHudUnlocked: false,
  overlays: [],
  paused: false,
  started: false,
  awaitingLevelContinue: false,
  mobileCruise: false,
  /** Space mode only: one or two gravity worlds (two more likely in large mode). */
  planets: [],
  spaceDecor: { stars: [], asteroids: [] },
  /** Mirror raider(s): one entry per active boss ship. */
  bosses: [],
  bossBullets: [],
  /** After reset with a boss start level, first click opens boss interstitial. */
  bossIntroAfterStart: false,
  /** Cleared field; spawn boss when player dismisses the boss interstitial. */
  pendingBossSpawn: false,
  /** `{ x, y }` or null — planets + stations enabled only. */
  spaceStation: null,
  stationSpawnTimer: 0,
  /** Dock UI open: game paused, E/Esc to leave. */
  stationDockMode: false,
  settings: {
    wrapWorld: false,
    shockwaves: true,
    mineChainBlast: true,
    pauseOnLevelUp: false,
    spaceMode: true,
    /**
   * If true (e.g. ?singularity=true): every gravity world is a black hole (testing).
   * If false: mostly classic planets; black holes appear randomly (see TUNING.blackHoleSpawnChance).
   */
    singularity: false,
    /** Space or Planets: easier mines & gentler thrust (see `isCruisingWorld`). */
    cruisingMode: false,
    /** Random ISS-style station in planets mode (see `spaceStationToggle` / `?station=`). */
    spaceStationsEnabled: false,
    /** When true, ship draw alpha drops as hull takes damage (visual feedback). */
    damageOpacity: true,
    startLevel: 1,
    largeMode: defaultLargeModeForDesktop(),
    cruiseThrottle: 0.82,
    shipSkin: "default",
  },
};

function getStartLevel() {
  return clamp(Math.floor(game.settings.startLevel || 1), 1, 99);
}

/** Cruising (casual): slower mines & softer thrust — works in Space (open sky) or Planets. */
function isCruisingWorld() {
  return game.settings.cruisingMode === true;
}

function mineSpawnIntervalScale() {
  return isCruisingWorld() ? TUNING.cruisingMineSpawnIntervalMultiplier : 1;
}

function cruisingThrustAccelScale() {
  return isCruisingWorld() ? TUNING.cruisingAccelScale : 1;
}

/** Keep simulation bounds equal to the full canvas (no inset playfield). */
function applyPlayfieldLayout() {
  WORLD.width = canvas.width;
  WORLD.height = canvas.height;
}

function resetGame() {
  const startLevel = getStartLevel();
  applyPlayfieldLayout();
  game.player = {
    x: WORLD.width * 0.5,
    y: WORLD.height * 0.5,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    radius: 13,
  };
  game.mines = [];
  game.treasures = [];
  game.score = 0;
  game.prevScoreForShieldRegen = 0;
  game.hull = BASE_HULL;
  game.level = startLevel;
  game.gameOver = false;
  game.invuln = 0;
  game.explosions = [];
  game.mysterySpawnTimer = 9.5;
  game.mysteryAwarded = 0;
  game.speedBoostTimer = 0;
  game.immunityTimer = 0;
  game.shield = 0;
  game.shieldScoreRegenUnlocked = false;
  game.spaceStation = null;
  game.stationDockMode = false;
  if (stationDockPanelEl) stationDockPanelEl.hidden = true;
  game.stationSpawnTimer =
    game.settings.spaceStationsEnabled && game.settings.spaceMode
      ? rand(TUNING.stationSpawnTimerMin, TUNING.stationSpawnTimerMax)
      : 0;
  game.hasBlaster = false;
  game.blasterTier = 0;
  game.bullets = [];
  game.blasterCooldown = 0;
  game.jumpNextThreshold = 1000;
  game.jumpRechargeHudUnlocked = false;
  game.overlays = [];
  game.paused = false;
  game.started = false;
  game.awaitingLevelContinue = false;
  game.mobileCruise = false;
  cheatBuffer = "";
  game.mineSpawnTimer = 1.2 * mineSpawnIntervalScale();
  game.treasureSpawnTimer = 2.4;
  game.levelTimer = 0;
  game.lastTs = performance.now();
  game.bosses = [];
  game.bossBullets = [];
  game.bossIntroAfterStart = isBossLevel(startLevel);
  game.pendingBossSpawn = false;
  statusEl.textContent = game.bossIntroAfterStart
    ? `${getDarkBossEncounterTitle(startLevel)} — click to start, then Space or tap to engage.`
    : `Click anywhere to start. Starting at level ${startLevel}.`;
  if (mobileCruiseBtn) {
    mobileCruiseBtn.classList.remove("active");
    mobileCruiseBtn.textContent = "Cruise: Off";
  }
  if (cruiseSpeedInputEl) {
    cruiseSpeedInputEl.value = String(Math.round(game.settings.cruiseThrottle * 100));
  }
  if (cruiseSpeedValueEl) {
    cruiseSpeedValueEl.textContent = `${Math.round(game.settings.cruiseThrottle * 100)}%`;
  }
  if (game.settings.spaceMode) {
    generateSpaceDecor();
    placePlanets(true);
  } else {
    game.planets = [];
    game.spaceDecor.stars = [];
    game.spaceDecor.asteroids = [];
  }
  updateHud();
  syncSpaceModeChrome();
}

function syncSpaceModeChrome() {
  document.body.classList.toggle("space-mode", game.settings.spaceMode);
  document.body.classList.toggle("cruising-mode", isCruisingWorld());
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute("content", game.settings.spaceMode ? "#050508" : "#0b2d4e");
  }
  if (spaceModeToggleEl) spaceModeToggleEl.checked = game.settings.spaceMode;
  if (cruisingToggleEl) {
    cruisingToggleEl.checked = game.settings.cruisingMode;
  }
  if (spaceStationToggleEl) {
    spaceStationToggleEl.disabled = !game.settings.spaceMode;
    spaceStationToggleEl.checked = game.settings.spaceStationsEnabled;
  }
  if (worldModeBtn) {
    worldModeBtn.textContent = game.settings.spaceMode ? "World: Planets" : "World: Space";
    worldModeBtn.title = game.settings.cruisingMode
      ? "Space or Planets with Cruising on (slower mines, softer thrust). Click to switch Space ↔ Planets."
      : "Toggle Space (open sky) ↔ Planets (stars & gravity). Use Cruising in settings for a gentler pace in either.";
  }
}

function updateHud() {
  scoreEl.textContent = game.score.toString();
  levelEl.textContent = game.level.toString();
  hullEl.textContent = `${Math.ceil(game.hull)}%`;
  if (game.shield > 0) {
    shieldHudEl.hidden = false;
    shieldHudEl.textContent = `(Shield: ${Math.ceil(game.shield)}%)`;
  } else {
    shieldHudEl.hidden = true;
  }
}

function canShoot() {
  return game.hasBlaster && game.blasterCooldown <= 0;
}

const JUMP_MINE_CLEAR = 48;

function isJumpLandingClear(tx, ty, playerRadius) {
  for (const m of game.mines) {
    if (Math.hypot(tx - m.x, ty - m.y) < playerRadius + m.radius + JUMP_MINE_CLEAR) return false;
  }
  return !overlapsSolidSphere(tx, ty, playerRadius);
}

function tryEmergencyJump() {
  if (game.awaitingLevelContinue) return;
  if (game.bosses.length > 0 || game.pendingBossSpawn) {
    statusEl.textContent = "Jump offline — defeat the raider first.";
    return;
  }
  if (game.score < game.jumpNextThreshold) {
    statusEl.textContent = `Jump locked — reach ${game.jumpNextThreshold} score for the next charge.`;
    return;
  }
  const p = game.player;
  const pr = p.radius;
  const margin = pr + 8;
  const halfMap = Math.min(WORLD.width, WORLD.height) * 0.48;
  const nx = Math.cos(p.angle);
  const ny = Math.sin(p.angle);
  for (let d = halfMap; d > 85; d -= 20) {
    const probe = { x: p.x + nx * d, y: p.y + ny * d, radius: 1 };
    if (game.settings.wrapWorld) wrapEntity(probe);
    else {
      probe.x = clamp(probe.x, margin, WORLD.width - margin);
      probe.y = clamp(probe.y, margin, WORLD.height - margin);
    }
    if (isJumpLandingClear(probe.x, probe.y, pr)) {
      p.x = probe.x;
      p.y = probe.y;
      p.vx = 0;
      p.vy = 0;
      game.jumpNextThreshold = game.score + 1000;
      game.jumpRechargeHudUnlocked = true;
      addOverlay("Emergency jump!", "#a9f2ff");
      statusEl.textContent = `Jump used — next charge at ${game.jumpNextThreshold} score.`;
      return;
    }
  }
  statusEl.textContent = "Jump failed — no safe spot ahead. Try another heading.";
}

function fireBlasterVolley() {
  const p = game.player;
  const bulletSpeed = 520;
  const spread = 0.2;
  const tier = Math.max(1, game.blasterTier || 1);
  const spawnBullet = (ang) => {
    game.bullets.push({
      x: p.x + Math.cos(ang) * (p.radius + 8),
      y: p.y + Math.sin(ang) * (p.radius + 8),
      vx: Math.cos(ang) * bulletSpeed,
      vy: Math.sin(ang) * bulletSpeed,
      radius: 4,
      life: 1.1,
    });
  };
  if (tier === 1) {
    spawnBullet(p.angle);
  } else if (tier === 2) {
    spawnBullet(p.angle - spread);
    spawnBullet(p.angle);
    spawnBullet(p.angle + spread);
  } else {
    spawnBullet(p.angle - spread);
    spawnBullet(p.angle);
    spawnBullet(p.angle + spread);
    const back = p.angle + Math.PI;
    spawnBullet(back - spread);
    spawnBullet(back);
    spawnBullet(back + spread);
  }
  game.blasterCooldown = 0.18;
}

function rescaleEntityCollection(items, sx, sy) {
  for (const e of items) {
    e.x *= sx;
    e.y *= sy;
  }
}

function applyCanvasSize() {
  const oldWorldW = WORLD.width;
  const oldWorldH = WORLD.height;
  let newW = DEFAULT_CANVAS_WIDTH;
  let newH = DEFAULT_CANVAS_HEIGHT;
  if (game.settings.largeMode) {
    newW = Math.max(980, Math.floor(window.innerWidth * 0.95));
    newH = Math.max(620, Math.floor(window.innerHeight * 0.78));
  }

  canvas.width = newW;
  canvas.height = newH;
  appEl.style.width = game.settings.largeMode ? "min(100vw, 99vw)" : "min(100vw, 980px)";
  largeModeBtn.textContent = game.settings.largeMode ? "Large Mode: On" : "Large Mode: Off";

  applyPlayfieldLayout();

  if (oldWorldW > 0 && oldWorldH > 0 && (oldWorldW !== WORLD.width || oldWorldH !== WORLD.height)) {
    const sx = WORLD.width / oldWorldW;
    const sy = WORLD.height / oldWorldH;
    if (game.player) {
      game.player.x *= sx;
      game.player.y *= sy;
    }
    rescaleEntityCollection(game.mines, sx, sy);
    rescaleEntityCollection(game.treasures, sx, sy);
    rescaleEntityCollection(game.explosions, sx, sy);
    rescaleEntityCollection(game.bullets, sx, sy);
    rescaleEntityCollection(game.bossBullets, sx, sy);
    for (const boss of game.bosses) {
      boss.x *= sx;
      boss.y *= sy;
      if (typeof boss.baseY === "number") boss.baseY *= sy;
      if (typeof boss.appearJump === "number") boss.appearJump *= sy;
      const rj = boss.relocJump;
      if (rj) {
        rj.fromX *= sx;
        rj.toX *= sx;
        if (typeof rj.fromBaseY === "number") rj.fromBaseY *= sy;
        if (typeof rj.toBaseY === "number") rj.toBaseY *= sy;
      }
    }
    const rs = (sx + sy) * 0.5;
    for (const p of game.planets) {
      p.x *= sx;
      p.y *= sy;
      p.pullRadius *= rs;
      if (typeof p.consumeRadius === "number") p.consumeRadius *= rs;
      if (typeof p.bodyRadius === "number") p.bodyRadius *= rs;
    }
    for (const s of game.spaceDecor.stars) {
      s.x *= sx;
      s.y *= sy;
    }
    for (const a of game.spaceDecor.asteroids) {
      a.x *= sx;
      a.y *= sy;
      a.r *= rs;
    }
  }
}

function setSettingsOpen(isOpen) {
  if (!settingsPanelEl || !settingsBackdropEl) return;
  if (isOpen && wikiPanelEl && wikiBackdropEl) {
    wikiPanelEl.hidden = true;
    wikiBackdropEl.hidden = true;
  }
  settingsPanelEl.hidden = !isOpen;
  settingsBackdropEl.hidden = !isOpen;
  if (!isOpen && settingsBtn) {
    settingsBtn.focus({ preventScroll: true });
  }
}

function setWikiOpen(isOpen) {
  if (!wikiPanelEl || !wikiBackdropEl) return;
  if (isOpen && settingsPanelEl && settingsBackdropEl) {
    settingsPanelEl.hidden = true;
    settingsBackdropEl.hidden = true;
  }
  wikiPanelEl.hidden = !isOpen;
  wikiBackdropEl.hidden = !isOpen;
  if (isOpen) {
    requestAnimationFrame(() => {
      wikiPanelEl.focus({ preventScroll: true });
    });
  } else if (wikiBtn) {
    wikiBtn.focus({ preventScroll: true });
  }
}

function isMobileLikeDevice() {
  const hasCoarse = window.matchMedia("(pointer: coarse)").matches;
  const noHover = window.matchMedia("(hover: none)").matches;
  const narrow = window.innerWidth <= 900;
  const touchCapable = navigator.maxTouchPoints > 0;
  return (hasCoarse || noHover || narrow) && touchCapable;
}

function updateMobileControlsVisibility() {
  if (!mobileControlsEl) return;
  mobileControlsEl.hidden = !isMobileLikeDevice();
}

function generateSpaceDecor() {
  const stars = [];
  for (let i = 0; i < 170; i += 1) {
    stars.push({
      x: rand(0, WORLD.width),
      y: rand(0, WORLD.height),
      s: rand(0.4, 2.2),
      a: rand(0.25, 1),
    });
  }
  const asteroids = [];
  for (let i = 0; i < 22; i += 1) {
    asteroids.push({
      x: rand(0, WORLD.width),
      y: rand(0, WORLD.height),
      r: rand(7, 26),
      rot: rand(0, Math.PI * 2),
      sides: 5 + Math.floor(rand(0, 4)),
    });
  }
  game.spaceDecor.stars = stars;
  game.spaceDecor.asteroids = asteroids;
}

function planetMetricsForWorld() {
  const ref = Math.min(WORLD.width, WORLD.height) / 640;
  return {
    pullRadius: clamp(280 * ref, 120, 420),
    bodyRadius: clamp(34 * ref, 18, 52),
  };
}

/** Outer influence radius = this × a normal planet’s pull (black hole variant only). */
const BLACK_HOLE_PULL_RADIUS_FACTOR = 1.5;

/**
 * Random scale 0.5×–2× on template; pull is 1.5× “normal” pull at that scale.
 * Singularity (consume) radius is random between a floor and at most 75% of planet body at that scale.
 */
function rollBlackHoleDimensions(baseM) {
  const scale = rand(0.5, 2);
  const normalPull = clamp(baseM.pullRadius * scale, 62, 560);
  const pullRadius = clamp(normalPull * BLACK_HOLE_PULL_RADIUS_FACTOR, 95, 820);
  const bodyAtScale = clamp(baseM.bodyRadius * scale, 9, 92);
  const maxSingularity = bodyAtScale * TUNING.blackHoleSingularityMaxFracOfPlanetBody;
  const minFromFrac = maxSingularity * TUNING.blackHoleSingularityMinFracOfCap;
  const minSingularity = Math.min(
    maxSingularity * 0.92,
    Math.max(TUNING.blackHoleSingularityAbsFloor, minFromFrac)
  );
  const lo = Math.min(minSingularity, maxSingularity * 0.98);
  const hi = maxSingularity;
  const consumeRadius = lo >= hi ? hi : rand(lo, hi);
  return { pullRadius, consumeRadius };
}

const PLANET_STYLES = [
  {
    light: "#b8d8f0",
    mid: "#4a78a8",
    dark: "#142838",
    accent: "#e8f8ff",
    ring: "rgba(110, 170, 230, 0.42)",
    bands: 0,
  },
  {
    light: "#c8cad4",
    mid: "#5c6070",
    dark: "#1e2028",
    accent: "#f0f2fa",
    ring: "rgba(150, 155, 175, 0.36)",
    bands: 0,
  },
  {
    light: "#f0b090",
    mid: "#b85830",
    dark: "#381808",
    accent: "#ffe8d8",
    ring: "rgba(230, 120, 70, 0.4)",
    bands: 0,
  },
  {
    light: "#e8d098",
    mid: "#987838",
    dark: "#302010",
    accent: "#fff8e0",
    ring: "rgba(200, 170, 90, 0.34)",
    bands: 0,
  },
  {
    light: "#78c0e8",
    mid: "#2878a8",
    dark: "#082838",
    accent: "#b8ecff",
    ring: "rgba(80, 150, 220, 0.4)",
    bands: 0,
  },
  {
    light: "#d8c8a0",
    mid: "#886848",
    dark: "#281810",
    accent: "#f8ecd0",
    ring: "rgba(200, 150, 110, 0.36)",
    bands: 4,
  },
];

function pickRandomPlanetStyle() {
  return PLANET_STYLES[Math.floor(Math.random() * PLANET_STYLES.length)];
}

function rollPlanetDimensions(baseM) {
  const scale = rand(0.5, 2);
  return {
    pullRadius: clamp(baseM.pullRadius * scale, 62, 560),
    bodyRadius: clamp(baseM.bodyRadius * scale, 9, 92),
  };
}

function gravityWorldSolidForSep(gw) {
  if (gw.kind === "blackHole") return gw.consumeRadius ?? 0;
  return gw.bodyRadius ?? 0;
}

function placePlanets(avoidPlayer) {
  game.planets = [];
  if (!game.settings.spaceMode) {
    hideSingularityGravWarning(true);
    return;
  }
  const baseM = planetMetricsForWorld();
  const dual =
    game.settings.largeMode && Math.random() < (game.settings.wrapWorld ? 0.38 : 0.45);
  const count = dual ? 2 : 1;

  const rollBlackHoleThisSlot = () =>
    game.settings.singularity === true || Math.random() < TUNING.blackHoleSpawnChance;

  const rollSpec = () => {
    if (rollBlackHoleThisSlot()) {
      const dims = rollBlackHoleDimensions(baseM);
      return {
        kind: "blackHole",
        pullRadius: dims.pullRadius,
        consumeRadius: dims.consumeRadius,
      };
    }
    const dims = rollPlanetDimensions(baseM);
    return {
      pullRadius: dims.pullRadius,
      bodyRadius: dims.bodyRadius,
      planetStyle: pickRandomPlanetStyle(),
    };
  };

  const tryPlace = (x, y, spec) => {
    const pull = spec.pullRadius;
    const solid = spec.kind === "blackHole" ? spec.consumeRadius : spec.bodyRadius;
    const margin = Math.max(56, pull * 0.26);
    if (x < margin || x > WORLD.width - margin || y < margin || y > WORLD.height - margin) return false;
    const avoidPlayerR = Math.max(110, pull * 0.38);
    if (
      avoidPlayer &&
      game.player &&
      Math.hypot(x - game.player.x, y - game.player.y) < avoidPlayerR
    ) {
      return false;
    }
    for (const ex of game.planets) {
      const sep = ex.pullRadius + pull + (gravityWorldSolidForSep(ex) + solid) * 1.12;
      if (Math.hypot(x - ex.x, y - ex.y) < sep) return false;
    }
    if (spec.kind === "blackHole") {
      game.planets.push({
        kind: "blackHole",
        x,
        y,
        pullRadius: spec.pullRadius,
        consumeRadius: spec.consumeRadius,
      });
    } else {
      game.planets.push({
        x,
        y,
        pullRadius: spec.pullRadius,
        bodyRadius: spec.bodyRadius,
        planetStyle: spec.planetStyle,
      });
    }
    return true;
  };

  for (let n = 0; n < count; n += 1) {
    let placed = false;
    for (let k = 0; k < 56; k += 1) {
      const spec = rollSpec();
      const margin = Math.max(56, spec.pullRadius * 0.26);
      const x = rand(margin, WORLD.width - margin);
      const y = rand(margin, WORLD.height - margin);
      if (tryPlace(x, y, spec)) {
        placed = true;
        break;
      }
    }
    if (!placed) {
      const spec = rollSpec();
      const fx = n === 0 ? 0.28 : 0.72;
      const fy = n === 0 ? 0.35 : 0.62;
      if (!tryPlace(WORLD.width * fx, WORLD.height * fy, spec)) {
        if (spec.kind === "blackHole") {
          game.planets.push({
            kind: "blackHole",
            x: WORLD.width * fx,
            y: WORLD.height * fy,
            pullRadius: spec.pullRadius,
            consumeRadius: spec.consumeRadius,
          });
        } else {
          game.planets.push({
            x: WORLD.width * fx,
            y: WORLD.height * fy,
            pullRadius: spec.pullRadius,
            bodyRadius: spec.bodyRadius,
            planetStyle: spec.planetStyle,
          });
        }
      }
    }
  }
  flashSingularityGravWarning();
}

const GRAVITY_WELL_STRENGTH = 96;
/** At well center, extra velocity retention per ~60fps step (lower = slower). Edge of pull radius = no extra drag. */
const GRAVITY_WELL_SLOW_DRAG_FLOOR = 0.92;
/**
 * Same idea, but when the entity is inside 2+ wells’ pull radii (overlap “soup”),
 * use a lower floor so movement stays a bit slower there.
 */
const GRAVITY_WELL_OVERLAP_DRAG_FLOOR = 0.885;
/** Black holes apply this multiplier on top of the usual gravity-well slow drag delta. */
const BLACK_HOLE_SLOW_DRAG_MULTIPLIER = 2;
const BLACK_HOLE_MIN_DRAG_STEP = 0.83;

function applyGravityWellVelocity(e, dt, mul) {
  if (!game.settings.spaceMode) return;
  for (const gw of game.planets) {
    const dx = gw.x - e.x;
    const dy = gw.y - e.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 10 || dist > gw.pullRadius) continue;
    const nx = dx / dist;
    const ny = dy / dist;
    const falloff = 1 - dist / gw.pullRadius;
    const accel = GRAVITY_WELL_STRENGTH * mul * falloff * falloff;
    e.vx += nx * accel * dt;
    e.vy += ny * accel * dt;
  }
}

function applyGravityWellSlowDrag(e, dt) {
  if (!game.settings.spaceMode || game.planets.length === 0) return;
  let gw = null;
  let best = Infinity;
  let wellsContaining = 0;
  for (const p of game.planets) {
    const dist = Math.hypot(e.x - p.x, e.y - p.y);
    if (dist < p.pullRadius) {
      wellsContaining += 1;
      if (dist < best) {
        best = dist;
        gw = p;
      }
    }
  }
  if (!gw || best < 1e-6) return;
  const falloff = 1 - best / gw.pullRadius;
  const blend = falloff * falloff;
  const dragFloor =
    wellsContaining >= 2 ? GRAVITY_WELL_OVERLAP_DRAG_FLOOR : GRAVITY_WELL_SLOW_DRAG_FLOOR;
  let dragStepBase = 1 + (dragFloor - 1) * blend;
  if (gw.kind === "blackHole") {
    dragStepBase = 1 + (dragFloor - 1) * blend * BLACK_HOLE_SLOW_DRAG_MULTIPLIER;
    dragStepBase = Math.max(dragStepBase, BLACK_HOLE_MIN_DRAG_STEP);
  }
  e.vx *= Math.pow(dragStepBase, dt * 60);
  e.vy *= Math.pow(dragStepBase, dt * 60);
}

function entityInsideBlackHoleSingularity(x, y, radius) {
  if (!game.settings.spaceMode) return false;
  for (const gw of game.planets) {
    if (gw.kind !== "blackHole") continue;
    if (Math.hypot(x - gw.x, y - gw.y) < gw.consumeRadius + radius) return true;
  }
  return false;
}

/** Mines, loot, shots, explosions, and the raider vanish at the core; player = game over. */
function applyBlackHoleConsumption() {
  if (!game.settings.spaceMode || game.gameOver) return;
  if (!game.planets.some((w) => w.kind === "blackHole")) return;

  const p = game.player;
  if (p && entityInsideBlackHoleSingularity(p.x, p.y, p.radius)) {
    game.hull = 0;
    game.gameOver = true;
    statusEl.textContent = "The black hole claims you — game over.";
    return;
  }

  if (
    game.spaceStation &&
    entityInsideBlackHoleSingularity(game.spaceStation.x, game.spaceStation.y, TUNING.stationBodyRadius)
  ) {
    if (game.stationDockMode) {
      game.stationDockMode = false;
      game.paused = false;
      if (stationDockPanelEl) stationDockPanelEl.hidden = true;
    }
    game.spaceStation = null;
    game.stationSpawnTimer = rand(TUNING.stationSpawnRetrySec * 1.2, TUNING.stationSpawnRetrySec * 2.2);
  }

  game.mines = game.mines.filter((m) => !entityInsideBlackHoleSingularity(m.x, m.y, m.radius));
  game.treasures = game.treasures.filter((t) => !entityInsideBlackHoleSingularity(t.x, t.y, t.radius));
  game.bullets = game.bullets.filter((b) => !entityInsideBlackHoleSingularity(b.x, b.y, b.radius));
  game.bossBullets = game.bossBullets.filter((b) => !entityInsideBlackHoleSingularity(b.x, b.y, b.radius));
  game.explosions = game.explosions.filter(
    (ex) => !entityInsideBlackHoleSingularity(ex.x, ex.y, Math.max(6, ex.radius * 0.25))
  );

  const hadRaider = game.bosses.length > 0;
  game.bosses = game.bosses.filter(
    (boss) => boss.dying || !entityInsideBlackHoleSingularity(boss.x, boss.y, boss.radius)
  );
  if (hadRaider && game.bosses.length === 0) defeatBoss();
}

function driftTreasuresTowardWell(dt) {
  if (!game.settings.spaceMode || game.planets.length === 0) return;
  for (const t of game.treasures) {
    let gw = null;
    let best = Infinity;
    for (const p of game.planets) {
      const dist = Math.hypot(p.x - t.x, p.y - t.y);
      if (dist < p.pullRadius && dist < best) {
        best = dist;
        gw = p;
      }
    }
    if (!gw || best < 6) continue;
    const dx = gw.x - t.x;
    const dy = gw.y - t.y;
    const dist = best;
    const nx = dx / dist;
    const ny = dy / dist;
    const falloff = 1 - dist / gw.pullRadius;
    const spd = 26 * falloff * falloff * dt;
    t.x += nx * spd;
    t.y += ny * spd;
    t.x = clamp(t.x, t.radius + 4, WORLD.width - t.radius - 4);
    t.y = clamp(t.y, t.radius + 4, WORLD.height - t.radius - 4);
    resolveSolidSphere(t, t.radius, false);
  }
}

function overlapsSolidSphere(x, y, entityRadius) {
  if (!game.settings.spaceMode) return false;
  for (const gw of game.planets) {
    const solid =
      gw.kind === "blackHole" ? gw.consumeRadius : gw.bodyRadius ?? gw.consumeRadius ?? 0;
    if (Math.hypot(x - gw.x, y - gw.y) < solid + entityRadius) return true;
  }
  if (game.spaceStation) {
    const s = game.spaceStation;
    if (Math.hypot(x - s.x, y - s.y) < TUNING.stationBodyRadius + entityRadius) return true;
  }
  return false;
}

/** Push entity outside solid planets; optionally reflect velocity off the surface. */
function resolveSolidSphere(e, entityRadius, reflectVel) {
  if (!game.settings.spaceMode) return;
  for (let pass = 0; pass < 3; pass += 1) {
    let moved = false;
    for (const gw of game.planets) {
      if (gw.kind === "blackHole") continue;
      const dx = e.x - gw.x;
      const dy = e.y - gw.y;
      const dist = Math.hypot(dx, dy);
      const br = gw.bodyRadius ?? 0;
      const minD = br + entityRadius + 0.5;
      if (dist >= minD || dist < 1e-5) continue;
      moved = true;
      const nx = dx / dist;
      const ny = dy / dist;
      e.x = gw.x + nx * minD;
      e.y = gw.y + ny * minD;
      if (reflectVel && e.vx !== undefined && e.vy !== undefined) {
        const vn = e.vx * nx + e.vy * ny;
        if (vn < 0) {
          e.vx -= 2 * vn * nx;
          e.vy -= 2 * vn * ny;
        }
      }
    }
    if (game.spaceStation) {
      const st = game.spaceStation;
      const dx = e.x - st.x;
      const dy = e.y - st.y;
      const dist = Math.hypot(dx, dy);
      const br = TUNING.stationBodyRadius;
      const minD = br + entityRadius + 0.5;
      if (dist < minD && dist >= 1e-5) {
        moved = true;
        const nx = dx / dist;
        const ny = dy / dist;
        e.x = st.x + nx * minD;
        e.y = st.y + ny * minD;
        if (reflectVel && e.vx !== undefined && e.vy !== undefined) {
          const vn = e.vx * nx + e.vy * ny;
          if (vn < 0) {
            e.vx -= 2 * vn * nx;
            e.vy -= 2 * vn * ny;
          }
        }
      }
    }
    if (!moved) break;
  }
}

function ensureIssStationImg() {
  if (issStationImg) return;
  issStationImg = new Image();
  issStationImg.src = "./assets/iss-station.svg";
}

function playerInStationDockRange() {
  const s = game.spaceStation;
  const p = game.player;
  if (!s || !p) return false;
  return Math.hypot(p.x - s.x, p.y - s.y) < TUNING.stationDockRange;
}

function trySpawnSpaceStation() {
  if (!game.settings.spaceStationsEnabled || !game.settings.spaceMode) return false;
  if (game.spaceStation || game.bosses.length > 0 || game.pendingBossSpawn) return false;
  const r = TUNING.stationBodyRadius;
  const margin = r + 72;
  ensureIssStationImg();
  outer: for (let k = 0; k < 52; k += 1) {
    const x = rand(margin, WORLD.width - margin);
    const y = rand(margin, WORLD.height - margin);
    if (entityInsideBlackHoleSingularity(x, y, r)) continue;
    if (overlapsSolidSphere(x, y, r)) continue;
    const p = game.player;
    if (p && Math.hypot(x - p.x, y - p.y) < 175) continue;
    for (const m of game.mines) {
      if (Math.hypot(x - m.x, y - m.y) < 100) continue outer;
    }
    game.spaceStation = { x, y, life: TUNING.stationLifetimeSeconds };
    addOverlay("Orbital station — enter ring to dock", "#b8e0ff");
    statusEl.textContent = "Station online — fly into the ring to dock (60s window).";
    return true;
  }
  return false;
}

function expireSpaceStation() {
  if (game.stationDockMode) {
    game.stationDockMode = false;
    game.paused = false;
    if (stationDockPanelEl) stationDockPanelEl.hidden = true;
  }
  game.spaceStation = null;
  game.stationSpawnTimer = rand(TUNING.stationSpawnTimerMin, TUNING.stationSpawnTimerMax);
  game.lastTs = performance.now();
  statusEl.textContent = "Station departed — docking window closed.";
}

function updateSpaceStation(dt) {
  if (!game.settings.spaceStationsEnabled || !game.settings.spaceMode) {
    if (game.stationDockMode) {
      game.stationDockMode = false;
      game.paused = false;
      if (stationDockPanelEl) stationDockPanelEl.hidden = true;
    }
    game.spaceStation = null;
    return;
  }
  if (game.bosses.length > 0 || game.pendingBossSpawn) {
    if (game.spaceStation || game.stationDockMode) {
      if (game.stationDockMode) {
        game.stationDockMode = false;
        game.paused = false;
        if (stationDockPanelEl) stationDockPanelEl.hidden = true;
      }
      game.spaceStation = null;
      game.stationSpawnTimer = rand(
        TUNING.stationRespawnAfterBossMin,
        TUNING.stationRespawnAfterBossMax
      );
    }
    return;
  }
  if (game.spaceStation) {
    game.spaceStation.life -= dt;
    if (game.spaceStation.life <= 0) expireSpaceStation();
  }
  if (!game.spaceStation && !game.stationDockMode) {
    game.stationSpawnTimer -= dt;
    if (game.stationSpawnTimer > 0) return;
    if (trySpawnSpaceStation()) return;
    game.stationSpawnTimer = TUNING.stationSpawnRetrySec;
  }
}

function drawSpaceStation() {
  const s = game.spaceStation;
  if (!s || !game.settings.spaceMode) return;
  const w = TUNING.stationDrawWidth;
  const aspect = issStationImg && issStationImg.naturalHeight ? issStationImg.naturalHeight / issStationImg.naturalWidth : 0.63;
  const h = w * aspect;
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.globalAlpha = 0.92;
  if (issStationImg && issStationImg.complete && issStationImg.naturalWidth > 0) {
    ctx.drawImage(issStationImg, -w * 0.5, -h * 0.5, w, h);
  } else {
    ctx.fillStyle = "rgba(180, 200, 230, 0.35)";
    ctx.beginPath();
    ctx.arc(0, 0, TUNING.stationBodyRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(160, 210, 255, 0.7)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  if (playerInStationDockRange() && !game.stationDockMode && game.started && !game.gameOver) {
    ctx.strokeStyle = "rgba(120, 220, 255, 0.55)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.arc(0, 0, TUNING.stationDockRange, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

function refreshStationDockUi() {
  const c = TUNING.stationServiceCost;
  const sc = game.score;
  if (stationHullBtn) {
    stationHullBtn.disabled = game.hull >= MAX_HULL || sc < c;
    stationHullBtn.textContent =
      game.hull >= MAX_HULL ? "Hull already full" : `Full hull repair (${c} pts)`;
  }
  if (stationShieldBtn) {
    stationShieldBtn.disabled = game.shield >= MAX_SHIELD || sc < c;
    stationShieldBtn.textContent =
      game.shield >= MAX_SHIELD ? "Shield already full" : `Full shield restore (${c} pts)`;
  }
  if (stationBlasterBtn) {
    const maxed = game.hasBlaster && game.blasterTier >= 3;
    stationBlasterBtn.disabled = maxed || sc < c;
    stationBlasterBtn.textContent = maxed
      ? "Blaster fully upgraded"
      : !game.hasBlaster
        ? `Enable blaster (${c} pts)`
        : `Blaster upgrade (tier ${game.blasterTier + 1}, ${c} pts)`;
  }
}

function openStationDock() {
  if (!game.spaceStation || !playerInStationDockRange() || game.stationDockMode) return;
  game.stationDockMode = true;
  game.paused = true;
  if (game.player) {
    game.player.vx = 0;
    game.player.vy = 0;
  }
  if (stationDockPanelEl) stationDockPanelEl.hidden = false;
  refreshStationDockUi();
  statusEl.textContent = "Docked — choose a service or undock (E / Esc).";
}

function leaveStationDock() {
  if (!game.stationDockMode) return;
  game.stationDockMode = false;
  game.paused = false;
  if (stationDockPanelEl) stationDockPanelEl.hidden = true;
  game.spaceStation = null;
  game.stationSpawnTimer = rand(TUNING.stationSpawnTimerMin, TUNING.stationSpawnTimerMax);
  game.lastTs = performance.now();
  statusEl.textContent = "Undocked — station has departed.";
}

function stationPurchaseHull() {
  const c = TUNING.stationServiceCost;
  if (game.hull >= MAX_HULL || game.score < c) return;
  game.score -= c;
  game.hull = MAX_HULL;
  statusEl.textContent = "Station: hull restored.";
  refreshStationDockUi();
  updateHud();
}

function stationPurchaseShield() {
  const c = TUNING.stationServiceCost;
  if (game.shield >= MAX_SHIELD || game.score < c) return;
  game.score -= c;
  game.shieldScoreRegenUnlocked = true;
  game.shield = MAX_SHIELD;
  statusEl.textContent = "Station: shields restored.";
  refreshStationDockUi();
  updateHud();
}

function stationPurchaseBlaster() {
  const c = TUNING.stationServiceCost;
  if (game.score < c) return;
  if (game.hasBlaster && game.blasterTier >= 3) return;
  game.score -= c;
  if (!game.hasBlaster) {
    game.hasBlaster = true;
    game.blasterTier = 1;
    game.blasterCooldown = 0;
    statusEl.textContent = "Station: blaster online.";
  } else if (game.blasterTier === 1) {
    game.blasterTier = 2;
    game.blasterCooldown = 0;
    statusEl.textContent = "Station: blaster spread upgrade.";
  } else {
    game.blasterTier = 3;
    game.blasterCooldown = 0;
    statusEl.textContent = "Station: rear blaster batteries.";
  }
  refreshStationDockUi();
  updateHud();
}

function spawnMine() {
  const edgeInset = game.settings.wrapWorld ? -12 : 14;
  const minSpawnDistance = TUNING.mineMinSpawnDistance;
  const p = game.player;
  for (let tries = 0; tries < 16; tries += 1) {
    const edge = Math.floor(rand(0, 4));
    const mine = {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      radius: 10,
      speed: 56 + game.level * 9 + rand(-6, 9),
    };
    if (edge === 0) {
      mine.x = rand(0, WORLD.width);
      mine.y = edgeInset;
    } else if (edge === 1) {
      mine.x = WORLD.width - edgeInset;
      mine.y = rand(0, WORLD.height);
    } else if (edge === 2) {
      mine.x = rand(0, WORLD.width);
      mine.y = WORLD.height - edgeInset;
    } else {
      mine.x = edgeInset;
      mine.y = rand(0, WORLD.height);
    }

    const okPlayer = Math.hypot(mine.x - p.x, mine.y - p.y) >= minSpawnDistance;
    const okSphere = !overlapsSolidSphere(mine.x, mine.y, mine.radius);
    if ((okPlayer && okSphere) || tries === 15) {
      game.mines.push(mine);
      return;
    }
  }
}

function spawnTreasure() {
  const type = chooseTreasure(game.level);
  let x = rand(35, WORLD.width - 35);
  let y = rand(35, WORLD.height - 35);
  for (let k = 0; k < 18; k += 1) {
    if (!overlapsSolidSphere(x, y, type.radius)) break;
    x = rand(35, WORLD.width - 35);
    y = rand(35, WORLD.height - 35);
  }
  game.treasures.push({
    x,
    y,
    radius: type.radius,
    value: type.value,
    life: type.life,
    maxLife: type.life,
    color: type.color,
    kind: "coin",
  });
}

/** Richer coin table while fighting a boss (more points on the field). */
function spawnBossFightTreasure() {
  const lvl = Math.min(99, game.level + TUNING.bossTreasureLevelBonus);
  const type = chooseTreasure(lvl);
  let x = rand(35, WORLD.width - 35);
  let y = rand(35, WORLD.height - 35);
  for (let k = 0; k < 18; k += 1) {
    if (!overlapsSolidSphere(x, y, type.radius)) break;
    x = rand(35, WORLD.width - 35);
    y = rand(35, WORLD.height - 35);
  }
  game.treasures.push({
    x,
    y,
    radius: type.radius,
    value: type.value,
    life: type.life + 0.6,
    maxLife: type.life + 0.6,
    color: type.color,
    kind: "coin",
  });
}

function spawnMysteryPrize() {
  const r = 12;
  let x = rand(45, WORLD.width - 45);
  let y = rand(45, WORLD.height - 45);
  for (let k = 0; k < 18; k += 1) {
    if (!overlapsSolidSphere(x, y, r)) break;
    x = rand(45, WORLD.width - 45);
    y = rand(45, WORLD.height - 45);
  }
  game.treasures.push({
    x,
    y,
    radius: r,
    value: 0,
    life: 9.5,
    maxLife: 9.5,
    color: "#8b5cff",
    kind: "mystery",
  });
}

function updatePlayer(dt) {
  const p = game.player;
  const speedBoostScale = game.speedBoostTimer > 0 ? 1.35 : 1;
  const cruiseAccel = cruisingThrustAccelScale();
  const turnRate = 3.15;
  const accel = 320 * speedBoostScale * cruiseAccel;
  const reverse = 175 * speedBoostScale * cruiseAccel;
  const drag = 0.987;
  const maxSpeed = 315 * speedBoostScale;

  if (KEY.ArrowLeft || KEY.KeyA) p.angle -= turnRate * dt;
  if (KEY.ArrowRight || KEY.KeyD) p.angle += turnRate * dt;

  const dirX = Math.cos(p.angle);
  const dirY = Math.sin(p.angle);
  const isReversing = KEY.ArrowDown || KEY.KeyS;
  const keyAccelerating = KEY.ArrowUp || KEY.KeyW;
  const isAccelerating = keyAccelerating || game.mobileCruise;
  const thrustScale = keyAccelerating ? 1 : game.mobileCruise ? game.settings.cruiseThrottle : 1;
  if (isAccelerating && !isReversing) {
    p.vx += dirX * accel * thrustScale * dt;
    p.vy += dirY * accel * thrustScale * dt;
  }
  if (isReversing) {
    p.vx -= dirX * reverse * dt;
    p.vy -= dirY * reverse * dt;
  }

  p.vx *= Math.pow(drag, dt * 60);
  p.vy *= Math.pow(drag, dt * 60);
  const speed = Math.hypot(p.vx, p.vy);
  if (speed > maxSpeed) {
    const s = maxSpeed / speed;
    p.vx *= s;
    p.vy *= s;
  }

  applyGravityWellVelocity(p, dt, 1);
  applyGravityWellSlowDrag(p, dt);

  p.x += p.vx * dt;
  p.y += p.vy * dt;
  if (game.settings.wrapWorld) wrapEntity(p);
  else confineEntity(p, 0.4);
  resolveSolidSphere(p, p.radius, true);

  if (canShoot() && (KEY.KeyF || KEY.Enter || KEY.Insert)) {
    fireBlasterVolley();
  }
}

function updateMines(dt) {
  const p = game.player;
  for (const m of game.mines) {
    const dx = p.x - m.x;
    const dy = p.y - m.y;
    const len = Math.hypot(dx, dy) || 1;
    const targetVx = (dx / len) * m.speed;
    const targetVy = (dy / len) * m.speed;
    const homing = clamp(0.95 + game.level * 0.02, 0.9, 1.22);
    m.vx += (targetVx - m.vx) * homing * dt;
    m.vy += (targetVy - m.vy) * homing * dt;
    applyGravityWellVelocity(m, dt, 0.72);
    applyGravityWellSlowDrag(m, dt);
    m.x += m.vx * dt;
    m.y += m.vy * dt;
    if (game.settings.wrapWorld) wrapEntity(m);
    else confineEntity(m, 0.25);
    resolveSolidSphere(m, m.radius, true);
  }

  // Mine collisions (both destroyed)
  const alive = new Array(game.mines.length).fill(true);
  for (let i = 0; i < game.mines.length; i += 1) {
    if (!alive[i]) continue;
    for (let j = i + 1; j < game.mines.length; j += 1) {
      if (!alive[j]) continue;
      const a = game.mines[i];
      const b = game.mines[j];
      const rr = a.radius + b.radius;
      if (distSq(a, b) < rr * rr) {
        game.explosions.push({
          x: (a.x + b.x) * 0.5,
          y: (a.y + b.y) * 0.5,
          life: 0.7,
          maxLife: 0.7,
          radius: 16,
          innerRadius: 38,
          pushRadius: 180,
          damageApplied: false,
          mineChainApplied: false,
        });
        alive[i] = false;
        alive[j] = false;
      }
    }
  }
  game.mines = game.mines.filter((_, idx) => alive[idx]);
}

function updateTreasures(dt) {
  for (const t of game.treasures) t.life -= dt;
  game.treasures = game.treasures.filter((t) => t.life > 0);
}

function updateExplosions(dt) {
  for (const ex of game.explosions) {
    ex.life -= dt;
    ex.radius += 190 * dt;
  }
  game.explosions = game.explosions.filter((ex) => ex.life > 0);
}

function updateBullets(dt) {
  for (const b of game.bullets) {
    applyGravityWellVelocity(b, dt, 0.32);
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (game.settings.wrapWorld) wrapEntity(b);
  }
  if (!game.settings.wrapWorld) {
    game.bullets = game.bullets.filter(
      (b) => b.life > 0 && b.x > -20 && b.x < WORLD.width + 20 && b.y > -20 && b.y < WORLD.height + 20
    );
  } else {
    game.bullets = game.bullets.filter((b) => b.life > 0);
  }
  if (game.settings.spaceMode) {
    game.bullets = game.bullets.filter((b) => !overlapsSolidSphere(b.x, b.y, b.radius));
  }
}

function addOverlay(text, color = "#fff1be") {
  game.overlays.push({
    text,
    color,
    life: 1.7,
    maxLife: 1.7,
  });
}

let gravSingularityWarnDismissTimer = 0;
let gravSingularityWarnFadeTimer = 0;

function hasBlackHoleGravityWorlds() {
  return game.planets.some((p) => p.kind === "blackHole");
}

function hideSingularityGravWarning(immediate) {
  const el = gravSingularityWarnEl;
  if (!el) return;
  if (gravSingularityWarnDismissTimer) {
    clearTimeout(gravSingularityWarnDismissTimer);
    gravSingularityWarnDismissTimer = 0;
  }
  if (gravSingularityWarnFadeTimer) {
    clearTimeout(gravSingularityWarnFadeTimer);
    gravSingularityWarnFadeTimer = 0;
  }
  el.classList.remove("grav-singularity-warn--visible");
  if (immediate) {
    el.hidden = true;
    el.setAttribute("aria-hidden", "true");
  } else {
    gravSingularityWarnFadeTimer = window.setTimeout(() => {
      gravSingularityWarnFadeTimer = 0;
      el.hidden = true;
      el.setAttribute("aria-hidden", "true");
    }, 400);
  }
}

/** HTML overlay when a level includes black holes (incl. ?singularity=true). */
function flashSingularityGravWarning() {
  const el = gravSingularityWarnEl;
  if (!el) return;
  if (!game.settings.spaceMode || !hasBlackHoleGravityWorlds()) {
    hideSingularityGravWarning(true);
    return;
  }
  if (gravSingularityWarnDismissTimer) {
    clearTimeout(gravSingularityWarnDismissTimer);
    gravSingularityWarnDismissTimer = 0;
  }
  if (gravSingularityWarnFadeTimer) {
    clearTimeout(gravSingularityWarnFadeTimer);
    gravSingularityWarnFadeTimer = 0;
  }
  el.hidden = false;
  el.setAttribute("aria-hidden", "false");
  el.classList.remove("grav-singularity-warn--visible");
  requestAnimationFrame(() => {
    el.classList.add("grav-singularity-warn--visible");
  });
  gravSingularityWarnDismissTimer = window.setTimeout(() => {
    gravSingularityWarnDismissTimer = 0;
    hideSingularityGravWarning(false);
  }, 5200);
}

function applyDamage(message) {
  if (game.invuln > 0 || game.immunityTimer > 0 || game.gameOver) return;
  let remainingDamage = 25;
  if (game.shield > 0) {
    const absorbed = Math.min(game.shield, remainingDamage);
    game.shield -= absorbed;
    remainingDamage -= absorbed;
  }
  if (remainingDamage > 0) {
    game.hull = Math.max(0, game.hull - remainingDamage);
    // Blaster drops only when hull is actually damaged.
    game.hasBlaster = false;
    game.blasterTier = 0;
    game.bullets = [];
    game.blasterCooldown = 0;
  }
  game.invuln = 1.25;
  game.player.vx *= 0.45;
  game.player.vy *= 0.45;
  statusEl.textContent = game.hull > 0 ? message : "Your boat sank.";
  if (game.hull <= 0) {
    game.gameOver = true;
    statusEl.textContent = `Game Over - final score ${game.score}. Restart to sail again.`;
  }
}

function applyShockwaveEffects(dt) {
  if (!game.settings.shockwaves) return;
  const p = game.player;
  for (const ex of game.explosions) {
    const dx = p.x - ex.x;
    const dy = p.y - ex.y;
    const dist = Math.hypot(dx, dy) || 0.0001;
    const nx = dx / dist;
    const ny = dy / dist;

    if (!ex.damageApplied && dist <= ex.innerRadius + p.radius) {
      ex.damageApplied = true;
      applyDamage("Blast hit! Hull damaged.");
      continue;
    }

    if (!ex.mineChainApplied && game.settings.mineChainBlast) {
      ex.mineChainApplied = true;
      const triggered = [];
      game.mines = game.mines.filter((m) => {
        const dm = Math.hypot(m.x - ex.x, m.y - ex.y);
        if (dm <= ex.innerRadius + m.radius) {
          triggered.push({ x: m.x, y: m.y });
          return false;
        }
        return true;
      });
      for (const hit of triggered) {
        game.explosions.push({
          x: hit.x,
          y: hit.y,
          life: 0.55,
          maxLife: 0.55,
          radius: 13,
          innerRadius: 28,
          pushRadius: 120,
          damageApplied: false,
          mineChainApplied: true,
        });
      }
    }

    // Outside the blast core, the pressure wave nudges the boat.
    const outerReach = ex.radius + ex.pushRadius;
    if (dist > ex.innerRadius && dist < outerReach) {
      const strength = 1 - (dist - ex.innerRadius) / (outerReach - ex.innerRadius);
      const impulse = 220 * clamp(strength, 0, 1) * dt;
      p.vx += nx * impulse;
      p.vy += ny * impulse;
    }
  }
}

function getMysteryPrizeCap() {
  if (game.level >= TUNING.mysteryLevel16Threshold) return TUNING.mysteryCapLevel16Plus;
  return (
    TUNING.mysteryCapBase +
    Math.floor(game.score / TUNING.mysteryCapScoreStep) * TUNING.mysteryCapPerScoreStep
  );
}

/** Slow shield repair: scales with score gained this frame (treasure, boss bonus, etc.). */
function applyShieldRegenFromScoreDelta(dScore) {
  if (dScore <= 0 || !game.shieldScoreRegenUnlocked || game.shield >= SHIELD_REGEN_CAP) return;
  const add = dScore * TUNING.shieldRegenPerScorePoint;
  if (add <= 0) return;
  game.shield = Math.min(SHIELD_REGEN_CAP, game.shield + add);
}

/** Effective cap for spawning mystery pickups (higher during boss brawls). */
function getMysterySpawnCap() {
  const base = getMysteryPrizeCap();
  return game.bosses.length > 0 ? base + TUNING.bossMysteryExtraCap : base;
}

/** 0–4: speed, hull, immunity, shield, blaster ladder. Boss fights bias shield & blaster. */
function rollMysteryPowerupKind() {
  if (game.bosses.length === 0) return Math.floor(rand(0, 5));
  const r = Math.random();
  if (r < 0.1) return 0;
  if (r < 0.24) return 1;
  if (r < 0.38) return 2;
  if (r < 0.62) return 3;
  return 4;
}

function applyMysteryPowerup() {
  const roll = rollMysteryPowerupKind();
  if (roll === 0) {
    game.speedBoostTimer = Math.min(game.speedBoostTimer + 6.5, 15);
    statusEl.textContent = "Mystery prize: speed boost!";
    addOverlay("POWERUP: Speed Boost", "#a9f2ff");
  } else if (roll === 1) {
    const repairPowers = [25, 50, 100];
    const heal = repairPowers[Math.floor(rand(0, repairPowers.length))];
    if (game.hull >= MAX_HULL) {
      const pts = 333;
      game.score += pts;
      statusEl.textContent = `Mystery prize: hull maxed, +${pts} points.`;
      addOverlay(`POWERUP: Bonus +${pts}`, "#f2e2a0");
    } else {
      game.hull = Math.min(MAX_HULL, game.hull + heal);
      statusEl.textContent = `Mystery prize: hull repair +${heal}%`;
      addOverlay(`POWERUP: Hull +${heal}%`, "#a9ffbc");
    }
  } else if (roll === 2) {
    game.immunityTimer = Math.max(game.immunityTimer, 5.5);
    game.invuln = Math.max(game.invuln, 1.2);
    statusEl.textContent = "Mystery prize: temporary immunity!";
    addOverlay("POWERUP: Temporary Immunity", "#bfc8ff");
  } else if (roll === 3) {
    game.shieldScoreRegenUnlocked = true;
    const boosted = game.shield + 75;
    game.shield = Math.min(MAX_SHIELD, Math.max(SHIELD_POWERUP_MIN_AFTER, boosted));
    statusEl.textContent = "Mystery prize: shield strengthened!";
    addOverlay(`POWERUP: Shield ${Math.round(game.shield)}%`, "#90d5ff");
  } else if (!game.hasBlaster) {
    game.hasBlaster = true;
    game.blasterTier = 1;
    game.blasterCooldown = 0;
    statusEl.textContent = "Mystery prize: blaster online (F / Enter / Insert to fire)!";
    addOverlay("POWERUP: Blaster Online", "#ffc38d");
  } else if (game.blasterTier === 1) {
    game.blasterTier = 2;
    game.blasterCooldown = 0;
    statusEl.textContent = "Mystery prize: blaster triple spread!";
    addOverlay("POWERUP: Blaster Spread", "#ffc38d");
  } else if (game.blasterTier === 2) {
    game.blasterTier = 3;
    game.blasterCooldown = 0;
    statusEl.textContent = "Mystery prize: rear blaster batteries!";
    addOverlay("POWERUP: Blaster Aft", "#ffc38d");
  } else {
    const pts = 200;
    game.score += pts;
    statusEl.textContent = `Mystery prize: blaster maxed — +${pts} points!`;
    addOverlay(`POWERUP: Bonus +${pts}`, "#f2e2a0");
  }
}

function handleBulletMineHits() {
  if (game.bullets.length === 0 || game.mines.length === 0) return;
  const aliveMines = new Array(game.mines.length).fill(true);
  const aliveBullets = new Array(game.bullets.length).fill(true);
  for (let bi = 0; bi < game.bullets.length; bi += 1) {
    if (!aliveBullets[bi]) continue;
    const b = game.bullets[bi];
    for (let mi = 0; mi < game.mines.length; mi += 1) {
      if (!aliveMines[mi]) continue;
      const m = game.mines[mi];
      const rr = b.radius + m.radius;
      if (distSq(b, m) < rr * rr) {
        aliveBullets[bi] = false;
        aliveMines[mi] = false;
        game.explosions.push({
          x: m.x,
          y: m.y,
          life: 0.45,
          maxLife: 0.45,
          radius: 12,
          innerRadius: 28,
          pushRadius: 110,
          damageApplied: false,
          mineChainApplied: !game.settings.mineChainBlast,
        });
        break;
      }
    }
  }
  game.bullets = game.bullets.filter((_, idx) => aliveBullets[idx]);
  game.mines = game.mines.filter((_, idx) => aliveMines[idx]);
}

function clearFieldForBoss() {
  game.mines = [];
  game.treasures = [];
  game.bullets = [];
  game.explosions = [];
}

function createMirrorRaiderBoss(xCenter, vx) {
  const skin = SHIP_SKIN_OPTIONS.some((o) => o.id === game.settings.shipSkin)
    ? game.settings.shipSkin
    : "default";
  const useJump = mirrorRaiderBossUsesJumpEffects();
  const baseY = WORLD.height * 0.14;
  const appearJump = useJump
    ? Math.min(150, WORLD.height * TUNING.bossAppearJumpHeightFrac)
    : 0;
  return {
    x: xCenter,
    y: useJump ? baseY + appearJump : baseY,
    baseY,
    appearJump,
    spawnAnimT: useJump ? 0 : 1,
    dying: false,
    exitAnimT: 0,
    relocStage: 0,
    relocJump: null,
    vx,
    vy: 0,
    angle: vx >= 0 ? 0 : Math.PI,
    radius: 13,
    shipSkin: skin,
    maxHp: 14,
    hp: 14,
    shootCd: useJump ? 999 : 0.35,
  };
}

function spawnBossMirrorRaider() {
  loadRasterShipAssets();
  if (game.level === 20) {
    game.bosses = [
      createMirrorRaiderBoss(WORLD.width * 0.28, 125),
      createMirrorRaiderBoss(WORLD.width * 0.72, -125),
    ];
  } else {
    game.bosses = [createMirrorRaiderBoss(WORLD.width * 0.5, 125)];
  }
  game.treasureSpawnTimer = 1.9;
  game.mysterySpawnTimer = 5.5;
}

function defeatBoss() {
  const rawBonus = 520 + game.level * 40;
  const bonus = Math.round(rawBonus * TUNING.economyScoreMultiplier);
  const levelWhenKilled = game.level;
  game.score += bonus;
  game.bosses = [];
  game.bossBullets = [];
  const collectSec = TUNING.postBossLevel5CollectSeconds;
  if (
    levelWhenKilled === 5 ||
    levelWhenKilled === 10 ||
    levelWhenKilled === 15 ||
    levelWhenKilled === 20
  ) {
    game.levelTimer = Math.max(0, TUNING.levelStepSeconds - collectSec);
    const title = getDarkBossEncounterTitle(levelWhenKilled);
    addOverlay(`Raider destroyed +${bonus} — ~${collectSec}s to loot!`, "#a9ffbc");
    statusEl.textContent = `${title} cleared — ~${collectSec}s to loot. (+${bonus})`;
  } else {
    game.levelTimer = 0;
    addOverlay(`Raider destroyed +${bonus}`, "#a9ffbc");
    statusEl.textContent = `Boss cleared — +${bonus} score. Stay sharp.`;
  }
  const treasureInterval = clamp(
    TUNING.treasureSpawnIntervalMax - game.level * TUNING.treasureSpawnIntervalPerLevel,
    TUNING.treasureSpawnIntervalMin,
    TUNING.treasureSpawnIntervalMax
  );
  game.treasureSpawnTimer = treasureInterval * 0.5;
  game.mysterySpawnTimer = rand(TUNING.mysterySpawnIntervalMin, TUNING.mysterySpawnIntervalMax);
  updateHud();
}

/** Advance one mirror raider; returns false when it should be removed (exit anim done). */
function stepMirrorRaiderBoss(boss, dt) {
  if (boss.dying) {
    boss.exitAnimT += dt;
    const dur = 0.58;
    const u = Math.min(1, boss.exitAnimT / dur);
    const exitLift = WORLD.height * TUNING.bossExitJumpHeightFrac;
    const startY = typeof boss.baseY === "number" ? boss.baseY : boss.y;
    boss.y = startY - u * u * exitLift - Math.sin(u * Math.PI) * (exitLift * 0.12);
    return u < 1;
  }

  if (boss.spawnAnimT < 1) {
    const dur = 0.52;
    boss.spawnAnimT = Math.min(1, boss.spawnAnimT + dt / dur);
    const t = boss.spawnAnimT;
    const k = 1 - (1 - t) ** 2.35;
    const aj = boss.appearJump || 0;
    boss.y = boss.baseY + (1 - k) * aj;
    if (boss.spawnAnimT >= 1) {
      boss.y = boss.baseY;
      boss.shootCd = 0.35;
    }
    return true;
  }

  if (boss.relocJump) {
    const dur = 0.5;
    const rj = boss.relocJump;
    rj.t += dt / dur;
    const u = Math.min(1, rj.t);
    const ease = 1 - (1 - u) ** 2;
    boss.x = rj.fromX + (rj.toX - rj.fromX) * ease;
    const fromBY = rj.fromBaseY;
    const toBY = rj.toBaseY;
    const lineY = fromBY + (toBY - fromBY) * ease;
    const hopH = (boss.appearJump || Math.min(90, WORLD.height * 0.14)) * 0.52;
    boss.y = lineY - Math.sin(u * Math.PI) * hopH;
    if (u >= 1) {
      boss.x = rj.toX;
      boss.baseY = toBY;
      boss.y = toBY;
      boss.relocJump = null;
      boss.shootCd = Math.max(boss.shootCd, 0.45);
      maybeTriggerBossHpRelocate(boss);
    }
    return true;
  }

  boss.x += boss.vx * dt;
  const pad = boss.radius + 4;
  if (boss.x < pad) {
    boss.x = pad;
    boss.vx = Math.abs(boss.vx);
    boss.angle = 0;
  } else if (boss.x > WORLD.width - pad) {
    boss.x = WORLD.width - pad;
    boss.vx = -Math.abs(boss.vx);
    boss.angle = Math.PI;
  }
  boss.shootCd -= dt;
  if (boss.shootCd <= 0) {
    const bs = 440;
    const spread = 0.2;
    const pushBurst = (baseAng) => {
      for (const da of [-spread, 0, spread]) {
        const ang = baseAng + da;
        game.bossBullets.push({
          x: boss.x + Math.cos(ang) * (boss.radius + 8),
          y: boss.y + Math.sin(ang) * (boss.radius + 8),
          vx: Math.cos(ang) * bs,
          vy: Math.sin(ang) * bs,
          radius: 4,
          life: 2.8,
        });
      }
    };
    if (mirrorRaiderBossUsesTripleForwardAndBackwardBurst()) {
      pushBurst(boss.angle);
      pushBurst(boss.angle + Math.PI);
      boss.shootCd = rand(0.48, 0.9);
    } else if (mirrorRaiderBossUsesTripleForwardBurst()) {
      pushBurst(boss.angle);
      boss.shootCd = rand(0.48, 0.9);
    } else {
      const dir = Math.cos(boss.angle) >= 0 ? 1 : -1;
      game.bossBullets.push({
        x: boss.x + dir * (boss.radius + 8),
        y: boss.y,
        vx: dir * bs,
        vy: 0,
        radius: 4,
        life: 2.8,
      });
      boss.shootCd = rand(0.42, 0.78);
    }
  }
  return true;
}

function updateBoss(dt) {
  if (game.bosses.length === 0) return;
  const had = game.bosses.length;
  const next = [];
  for (const boss of game.bosses) {
    if (stepMirrorRaiderBoss(boss, dt)) next.push(boss);
  }
  game.bosses = next;
  if (had > 0 && game.bosses.length === 0) defeatBoss();
}

function updateBossBullets(dt) {
  for (const b of game.bossBullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
  }
  game.bossBullets = game.bossBullets.filter(
    (b) => b.life > 0 && b.x > -24 && b.x < WORLD.width + 24 && b.y > -24 && b.y < WORLD.height + 24
  );
}

function handlePlayerBulletsVsBossBullets() {
  if (game.bullets.length === 0 || game.bossBullets.length === 0) return;
  const bAlive = new Array(game.bullets.length).fill(true);
  const bbAlive = new Array(game.bossBullets.length).fill(true);
  for (let bi = 0; bi < game.bullets.length; bi += 1) {
    if (!bAlive[bi]) continue;
    const b = game.bullets[bi];
    for (let bbi = 0; bbi < game.bossBullets.length; bbi += 1) {
      if (!bbAlive[bbi]) continue;
      const bb = game.bossBullets[bbi];
      const rr = b.radius + bb.radius;
      if (distSq(b, bb) < rr * rr) {
        bAlive[bi] = false;
        bbAlive[bbi] = false;
        game.explosions.push({
          x: (b.x + bb.x) * 0.5,
          y: (b.y + bb.y) * 0.5,
          life: 0.22,
          maxLife: 0.22,
          radius: 5,
          innerRadius: 14,
          pushRadius: 28,
          damageApplied: true,
          mineChainApplied: true,
        });
        break;
      }
    }
  }
  game.bullets = game.bullets.filter((_, idx) => bAlive[idx]);
  game.bossBullets = game.bossBullets.filter((_, idx) => bbAlive[idx]);
}

function handlePlayerBulletsVsBoss() {
  if (game.bosses.length === 0 || game.bullets.length === 0) return;
  const alive = new Array(game.bullets.length).fill(true);
  for (let bi = 0; bi < game.bullets.length; bi += 1) {
    if (!alive[bi]) continue;
    const b = game.bullets[bi];
    for (const boss of game.bosses) {
      if (boss.dying) continue;
      const rr = b.radius + boss.radius;
      if (distSq(b, boss) >= rr * rr) continue;
      alive[bi] = false;
      boss.hp -= 1;
      if (boss.hp <= 0) {
        if (mirrorRaiderBossUsesJumpEffects()) {
          boss.dying = true;
          boss.exitAnimT = 0;
          game.bossBullets = [];
        } else {
          defeatBoss();
        }
      } else {
        maybeTriggerBossHpRelocate(boss);
      }
      break;
    }
  }
  game.bullets = game.bullets.filter((_, idx) => alive[idx]);
}

/** Level 5: up to three combat jumps as HP crosses each remaining-HP threshold. */
function maybeTriggerBossHpRelocate(boss) {
  if (!mirrorRaiderBossUsesJumpEffects() || boss.dying || boss.relocJump) return;
  const fracs = TUNING.bossRelocateRemainingFracs;
  if (boss.relocStage >= fracs.length) return;
  if (boss.hp >= boss.maxHp * fracs[boss.relocStage]) return;
  boss.relocStage += 1; // consumed this gate (1st–3rd relocate)
  const pad = boss.radius + 8;
  let targetX = rand(pad + 50, WORLD.width - pad - 50);
  for (let tries = 0; tries < 12; tries += 1) {
    if (Math.abs(targetX - game.player.x) > Math.min(140, WORLD.width * 0.22)) break;
    targetX = rand(pad + 50, WORLD.width - pad - 50);
  }
  const yPad = boss.radius + 6;
  const yMin = yPad + WORLD.height * TUNING.bossRelocateYMinFrac;
  const yMax = WORLD.height * TUNING.bossRelocateYMaxFrac - yPad;
  const minDelta = WORLD.height * TUNING.bossRelocateYMinDeltaFrac;
  let targetBaseY = rand(yMin, yMax);
  for (let tries = 0; tries < 16; tries += 1) {
    if (Math.abs(targetBaseY - boss.baseY) >= minDelta) break;
    targetBaseY = rand(yMin, yMax);
  }
  boss.relocJump = {
    fromX: boss.x,
    toX: targetX,
    fromBaseY: boss.baseY,
    toBaseY: clamp(targetBaseY, yMin, yMax),
    t: 0,
  };
  game.bossBullets = [];
  boss.shootCd = Math.max(boss.shootCd, 0.85);
}

function handleCollisions() {
  const p = game.player;

  // Player picks treasure.
  game.treasures = game.treasures.filter((t) => {
    const rr = p.radius + t.radius;
    if (distSq(p, t) < rr * rr) {
      if (t.kind === "mystery") {
        game.mysteryAwarded += 1;
        applyMysteryPowerup();
      } else {
        game.score += Math.round(t.value * TUNING.economyScoreMultiplier);
      }
      return false;
    }
    return true;
  });

  // Player hit by mine.
  if (game.invuln <= 0 && game.immunityTimer <= 0) {
    for (let i = 0; i < game.mines.length; i += 1) {
      const m = game.mines[i];
      const rr = p.radius + m.radius;
      if (distSq(p, m) < rr * rr) {
        game.mines.splice(i, 1);
        applyDamage("Hull hit! Keep moving!");
        break;
      }
    }
  }

  // Boss bolts.
  if (game.invuln <= 0 && game.immunityTimer <= 0 && game.bossBullets.length > 0) {
    const keep = [];
    for (const bb of game.bossBullets) {
      const rr = p.radius + bb.radius;
      if (distSq(p, bb) < rr * rr) {
        applyDamage("Raider bolt!");
      } else {
        keep.push(bb);
      }
    }
    game.bossBullets = keep;
  }
}

function updateDifficulty(dt) {
  const inBossFight = game.bosses.length > 0;
  const bossLocksLevelProgress =
    inBossFight || (isBossLevel(game.level) && game.pendingBossSpawn);

  if (!bossLocksLevelProgress) {
    game.levelTimer += dt;
    if (game.levelTimer >= TUNING.levelStepSeconds) {
      game.level += 1;
      game.levelTimer = 0;
      if (game.level >= TUNING.mysteryLevel16Threshold) {
        game.mysteryAwarded = 0;
      }

      if (isBossLevel(game.level)) {
        clearFieldForBoss();
        game.pendingBossSpawn = true;
        game.paused = true;
        game.awaitingLevelContinue = true;
        statusEl.textContent = `${getDarkBossEncounterTitle(game.level)} — Space or tap to engage.`;
        addOverlay(getDarkBossEncounterTitle(game.level), "#ffb08a");
      } else if (game.settings.pauseOnLevelUp) {
        game.paused = true;
        game.awaitingLevelContinue = true;
        const hint = "Press Space or tap to continue.";
        statusEl.textContent = `Level ${game.level}. ${hint}`;
      } else {
        statusEl.textContent = `Level ${game.level} - mines are faster.`;
      }
      if (game.settings.spaceMode) {
        placePlanets(false);
      }
    }
  }

  const mineInterval =
    clamp(
      TUNING.mineSpawnIntervalMax - game.level * TUNING.mineSpawnIntervalPerLevel,
      TUNING.mineSpawnIntervalMin,
      TUNING.mineSpawnIntervalMax
    ) * mineSpawnIntervalScale();
  const treasureInterval = clamp(
    TUNING.treasureSpawnIntervalMax - game.level * TUNING.treasureSpawnIntervalPerLevel,
    TUNING.treasureSpawnIntervalMin,
    TUNING.treasureSpawnIntervalMax
  );
  game.mineSpawnTimer -= dt;
  if (game.mineSpawnTimer <= 0) {
    spawnMine();
    game.mineSpawnTimer = mineInterval;
  }

  if (inBossFight) {
    game.treasureSpawnTimer -= dt;
    if (game.treasureSpawnTimer <= 0) {
      spawnBossFightTreasure();
      game.treasureSpawnTimer = rand(TUNING.bossTreasureSpawnMin, TUNING.bossTreasureSpawnMax);
    }
    game.mysterySpawnTimer -= dt;
    if (game.mysterySpawnTimer <= 0) {
      const cap = getMysterySpawnCap();
      if (game.mysteryAwarded < cap) spawnMysteryPrize();
      game.mysterySpawnTimer = rand(TUNING.bossMysterySpawnMin, TUNING.bossMysterySpawnMax);
    }
  } else {
    game.treasureSpawnTimer -= dt;
    if (game.treasureSpawnTimer <= 0) {
      spawnTreasure();
      game.treasureSpawnTimer = treasureInterval;
    }
    game.mysterySpawnTimer -= dt;
    if (game.mysterySpawnTimer <= 0) {
      const cap = getMysteryPrizeCap();
      if (game.mysteryAwarded < cap) spawnMysteryPrize();
      game.mysterySpawnTimer = rand(TUNING.mysterySpawnIntervalMin, TUNING.mysterySpawnIntervalMax);
    }
  }
}

function drawSpaceField() {
  ctx.fillStyle = "#050508";
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  for (const st of game.spaceDecor.stars) {
    ctx.globalAlpha = st.a;
    ctx.fillStyle = "#e8eef8";
    ctx.beginPath();
    ctx.arc(st.x, st.y, st.s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const ast of game.spaceDecor.asteroids) {
    ctx.save();
    ctx.translate(ast.x, ast.y);
    ctx.rotate(ast.rot);
    ctx.fillStyle = "#2a2a32";
    ctx.strokeStyle = "#15151a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const n = ast.sides;
    for (let i = 0; i < n; i += 1) {
      const ang = (i / n) * Math.PI * 2;
      const rr = ast.r * (0.78 + 0.22 * Math.sin(i * 1.7 + ast.rot));
      const px = Math.cos(ang) * rr;
      const py = Math.sin(ang) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

function drawOneGravityWorld(gw) {
  const br = gw.bodyRadius;
  const st = gw.planetStyle || PLANET_STYLES[0];
  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.strokeStyle = st.ring;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(gw.x, gw.y, gw.pullRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.11;
  ctx.beginPath();
  ctx.arc(gw.x, gw.y, gw.pullRadius * 0.52, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  const lx = gw.x - br * 0.38;
  const ly = gw.y - br * 0.4;
  const g = ctx.createRadialGradient(lx, ly, br * 0.06, gw.x, gw.y, br);
  g.addColorStop(0, st.accent);
  g.addColorStop(0.28, st.light);
  g.addColorStop(0.58, st.mid);
  g.addColorStop(1, st.dark);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(gw.x, gw.y, br, 0, Math.PI * 2);
  ctx.fill();

  const bandCount = st.bands || 0;
  if (bandCount > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(gw.x, gw.y, br, 0, Math.PI * 2);
    ctx.clip();
    for (let i = 0; i < bandCount; i += 1) {
      const yy = gw.y - br * 0.95 + i * br * 0.48;
      ctx.globalAlpha = 0.14 + (i % 2) * 0.1;
      ctx.fillStyle = i % 2 ? st.dark : st.mid;
      ctx.beginPath();
      ctx.ellipse(gw.x, yy, br * 1.25, br * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  ctx.globalAlpha = 0.48;
  ctx.strokeStyle = st.light;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(gw.x - br * 0.22, gw.y - br * 0.32, br * 0.2, 0.5, 2.2);
  ctx.stroke();
  ctx.globalAlpha = 0.32;
  ctx.strokeStyle = st.accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(gw.x, gw.y, br, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** Nearly invisible except a small bright accretion highlight at the singularity. */
function drawBlackHole(bh) {
  const cr = bh.consumeRadius;
  ctx.save();
  const g = ctx.createRadialGradient(bh.x, bh.y, 0, bh.x, bh.y, cr * 1.15);
  g.addColorStop(0, "rgba(255,255,255,0.82)");
  g.addColorStop(0.35, "rgba(230,235,248,0.28)");
  g.addColorStop(0.7, "rgba(180,190,210,0.06)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(bh.x, bh.y, cr, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawGravityWell() {
  if (!game.settings.spaceMode) return;
  for (const gw of game.planets) {
    if (gw.kind === "blackHole") drawBlackHole(gw);
    else drawOneGravityWorld(gw);
  }
}

function drawBackground() {
  if (game.settings.spaceMode) drawSpaceField();
  else drawWater();
}

function drawWater() {
  const g = ctx.createRadialGradient(
    WORLD.width * 0.5,
    WORLD.height * 0.4,
    80,
    WORLD.width * 0.5,
    WORLD.height * 0.5,
    WORLD.width * 0.7
  );
  g.addColorStop(0, "#1b5f97");
  g.addColorStop(0.45, "#114673");
  g.addColorStop(1, "#09263f");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  ctx.globalAlpha = 0.08;
  for (let i = 0; i < 80; i += 1) {
    ctx.fillStyle = i % 2 ? "#9bc3db" : "#173a5b";
    ctx.beginPath();
    ctx.arc((i * 131) % WORLD.width, (i * 89) % WORLD.height, (i % 5) + 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function getRasterImageForSkin(skinId) {
  if (
    skinId === "serenity" &&
    serenityShipImg &&
    serenityShipImg.complete &&
    serenityShipImg.naturalWidth > 0
  ) {
    return serenityShipImg;
  }
  if (
    skinId === "firefly" &&
    fireflyShipImg &&
    fireflyShipImg.complete &&
    fireflyShipImg.naturalWidth > 0
  ) {
    return fireflyShipImg;
  }
  return null;
}

function getReadyRasterShipImage() {
  return getRasterImageForSkin(game.settings.shipSkin);
}

function getRasterNoseTailScaleForSkin(skinId) {
  const opt = SHIP_SKIN_OPTIONS.find((o) => o.id === skinId);
  const s = opt?.rasterScale;
  return typeof s === "number" && s > 0 ? s : 1;
}

function getRasterShipNoseTailScale() {
  return getRasterNoseTailScaleForSkin(game.settings.shipSkin);
}

function drawRasterShipSpriteWithScale(img, entity, hullDamageRatio, noseTailScale) {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const noseTail = entity.radius * 3.35 * noseTailScale;
  const drawH = noseTail;
  const drawW = (noseTail * iw) / ih;
  ctx.rotate(Math.PI / 2);
  ctx.filter = `brightness(${0.52 + hullDamageRatio * 0.48})`;
  ctx.drawImage(img, -drawW * 0.5, -drawH * 0.5, drawW, drawH);
  ctx.filter = "none";
  ctx.rotate(-Math.PI / 2);
}

function drawRasterShipSprite(img, p, hullDamageRatio) {
  drawRasterShipSpriteWithScale(img, p, hullDamageRatio, getRasterShipNoseTailScale());
}

function drawPlayer() {
  const p = game.player;
  const blink = game.invuln > 0 && game.immunityTimer <= 0 && Math.floor(performance.now() / 80) % 2 === 0;
  if (blink) return;
  const hullDamageRatio = clamp(game.hull / BASE_HULL, 0, 1);
  const hullVisualRatio = clamp(game.hull / BASE_HULL, 0, 1.35);

  ctx.save();
  ctx.globalAlpha = game.settings.damageOpacity ? 0.35 + hullDamageRatio * 0.65 : 1;
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);

  const rasterImg = getReadyRasterShipImage();
  if (rasterImg) {
    drawRasterShipSprite(rasterImg, p, hullDamageRatio);
  } else {
    ctx.fillStyle = hullDamageRatio > 0.5 ? "#7a4920" : "#5d3a1a";
    ctx.beginPath();
    ctx.moveTo(12 + hullVisualRatio * 6, 0);
    ctx.lineTo(-10, -10);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-10, 10);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = hullDamageRatio > 0.4 ? "#d2b98e" : "#8a7c66";
    ctx.fillRect(-6, -4, 9, 8);
  }
  if (game.shield > 0) {
    const shieldRatio = clamp(game.shield / MAX_SHIELD, 0, 1);
    ctx.strokeStyle = `rgba(130, 214, 255, ${0.25 + shieldRatio * 0.55})`;
    ctx.lineWidth = 2 + shieldRatio * 3;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius + 10, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (game.immunityTimer > 0 && Math.floor(performance.now() / 120) % 2 === 0) {
    ctx.strokeStyle = "#8fd6ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius + 6, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMines() {
  const bodyFill = game.settings.spaceMode ? "#9fd4f0" : "#141414";
  const spikeStroke = game.settings.spaceMode ? "#c43d52" : "#a50505";
  for (const m of game.mines) {
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.fillStyle = bodyFill;
    ctx.beginPath();
    ctx.arc(0, 0, m.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = spikeStroke;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-3, -m.radius - 4);
    ctx.lineTo(3, -m.radius - 11);
    ctx.moveTo(m.radius + 4, -3);
    ctx.lineTo(m.radius + 11, 3);
    ctx.moveTo(-3, m.radius + 4);
    ctx.lineTo(3, m.radius + 11);
    ctx.moveTo(-m.radius - 4, -3);
    ctx.lineTo(-m.radius - 11, 3);
    ctx.stroke();
    ctx.restore();
  }
}

function drawBossShip(boss) {
  const hullDamageRatio = boss.dying ? 0.35 : clamp(boss.hp / boss.maxHp, 0, 1);
  ctx.save();
  let alpha = 0.4 + hullDamageRatio * 0.6;
  if (boss.dying) {
    const u = Math.min(1, boss.exitAnimT / 0.58);
    alpha *= 1 - u * 0.88;
  } else if (boss.spawnAnimT < 1) {
    alpha *= 0.65 + boss.spawnAnimT * 0.35;
  }
  ctx.globalAlpha = alpha;
  ctx.translate(boss.x, boss.y);
  ctx.rotate(boss.angle);
  const img = getRasterImageForSkin(boss.shipSkin);
  if (img) {
    drawRasterShipSpriteWithScale(img, boss, hullDamageRatio, getRasterNoseTailScaleForSkin(boss.shipSkin));
  } else {
    ctx.fillStyle = hullDamageRatio > 0.45 ? "#6b5038" : "#4d3928";
    ctx.beginPath();
    ctx.moveTo(12 + hullDamageRatio * 6, 0);
    ctx.lineTo(-10, -10);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-10, 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = hullDamageRatio > 0.35 ? "#c4b59a" : "#7d7160";
    ctx.fillRect(-6, -4, 9, 8);
  }
  ctx.restore();
}

function drawBossBullets() {
  for (const b of game.bossBullets) {
    ctx.save();
    ctx.fillStyle = "#ff5c6c";
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawBullets() {
  for (const b of game.bullets) {
    ctx.save();
    ctx.fillStyle = "#ffbf7d";
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawExplosions() {
  for (const ex of game.explosions) {
    const ratio = clamp(ex.life / ex.maxLife, 0, 1);
    ctx.save();
    ctx.globalAlpha = ratio;
    ctx.fillStyle = "#ff7a1c";
    ctx.beginPath();
    ctx.arc(ex.x, ex.y, ex.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = ratio * 0.8;
    ctx.strokeStyle = "#ffd27d";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(ex.x, ex.y, ex.radius, 0, Math.PI * 2);
    ctx.stroke();
    if (game.settings.shockwaves) {
      ctx.globalAlpha = ratio * 0.45;
      ctx.strokeStyle = "#9bd7ff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ex.x, ex.y, ex.radius + ex.pushRadius * (1 - ratio), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawTreasures() {
  for (const t of game.treasures) {
    const ratio = clamp(t.life / t.maxLife, 0, 1);
    ctx.save();
    ctx.globalAlpha = 0.35 + ratio * 0.65;
    if (t.kind === "mystery") {
      ctx.fillStyle = t.color;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#f2d6ff";
      ctx.stroke();
      ctx.fillStyle = "#fff4ab";
      ctx.beginPath();
      ctx.arc(t.x, t.y, 3.2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = t.color;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#111";
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawOverlays() {
  if (game.overlays.length === 0) return;
  ctx.save();
  ctx.textAlign = "center";
  for (let i = 0; i < game.overlays.length; i += 1) {
    const ov = game.overlays[i];
    const ratio = clamp(ov.life / ov.maxLife, 0, 1);
    ctx.globalAlpha = ratio;
    ctx.fillStyle = ov.color;
    ctx.font = "bold 24px Trebuchet MS";
    ctx.fillText(ov.text, WORLD.width * 0.5, 72 + i * 28);
  }
  ctx.restore();
}

function drawEffectText() {
  const effects = [];
  if (game.speedBoostTimer > 0) effects.push(`Speed ${game.speedBoostTimer.toFixed(1)}s`);
  if (game.immunityTimer > 0) effects.push(`Immunity ${game.immunityTimer.toFixed(1)}s`);
  if (game.shield > 0) effects.push(`Shield ${Math.ceil(game.shield)}%`);
  if (game.hasBlaster) {
    const bl =
      game.blasterTier >= 3 ? "Blaster x6" : game.blasterTier === 2 ? "Blaster x3" : "Blaster";
    effects.push(`${bl} ON`);
  }
  if (game.started && !game.gameOver) {
    if (game.score >= game.jumpNextThreshold) effects.push("Jump ready (G / Del)");
    else if (game.jumpRechargeHudUnlocked) effects.push(`Jump @ ${game.jumpNextThreshold}`);
  }
  if (effects.length === 0) return;
  ctx.save();
  ctx.textAlign = "left";
  ctx.font = "bold 18px Trebuchet MS";
  ctx.fillStyle = "#d6f0ff";
  ctx.fillText(effects.join("  |  "), 16, WORLD.height - 18);
  ctx.restore();
}

function frame(ts) {
  const dt = clamp((ts - game.lastTs) / 1000, 0, 0.033);
  game.lastTs = ts;

  if (!game.gameOver && game.started) {
    updateSpaceStation(dt);
  }

  if (!game.gameOver && !game.paused && game.started) {
    updatePlayer(dt);
    updateMines(dt);
    updateTreasures(dt);
    driftTreasuresTowardWell(dt);
    updateExplosions(dt);
    updateBullets(dt);
    applyShockwaveEffects(dt);
    updateDifficulty(dt);
    handlePlayerBulletsVsBossBullets();
    handlePlayerBulletsVsBoss();
    handleBulletMineHits();
    updateBoss(dt);
    updateBossBullets(dt);
    applyBlackHoleConsumption();
    handleCollisions();
    if (
      game.spaceStation &&
      !game.stationDockMode &&
      !game.paused &&
      game.started &&
      !game.gameOver &&
      !game.awaitingLevelContinue &&
      playerInStationDockRange()
    ) {
      openStationDock();
    }
    const dScore = game.score - game.prevScoreForShieldRegen;
    if (dScore > 0) applyShieldRegenFromScoreDelta(dScore);
    game.prevScoreForShieldRegen = game.score;
    game.invuln -= dt;
    game.speedBoostTimer = Math.max(0, game.speedBoostTimer - dt);
    game.immunityTimer = Math.max(0, game.immunityTimer - dt);
    game.blasterCooldown = Math.max(0, game.blasterCooldown - dt);
    for (const ov of game.overlays) ov.life -= dt;
    game.overlays = game.overlays.filter((ov) => ov.life > 0);
    updateHud();
  }

  drawBackground();
  if (game.settings.spaceMode) drawGravityWell();
  drawSpaceStation();
  drawTreasures();
  drawExplosions();
  drawBullets();
  drawMines();
  for (const boss of game.bosses) drawBossShip(boss);
  drawBossBullets();
  drawPlayer();
  drawOverlays();
  drawEffectText();

  if (game.gameOver) {
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    ctx.fillStyle = "#f5e4b8";
    ctx.textAlign = "center";
    ctx.font = "bold 44px Trebuchet MS";
    ctx.fillText("GAME OVER", WORLD.width * 0.5, WORLD.height * 0.46);
    ctx.font = "24px Trebuchet MS";
    ctx.fillText(`Final Score: ${game.score}`, WORLD.width * 0.5, WORLD.height * 0.54);
  }

  if (game.paused && !game.gameOver) {
    ctx.fillStyle = "rgba(0,0,0,0.38)";
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    ctx.fillStyle = "#f5e4b8";
    ctx.textAlign = "center";
    if (game.stationDockMode) {
      ctx.font = "18px Trebuchet MS";
      ctx.fillStyle = "#c8e8ff";
      ctx.fillText("Docked — use panel or E / Esc to undock", WORLD.width * 0.5, WORLD.height * 0.88);
    } else if (game.awaitingLevelContinue) {
      ctx.font = "bold 38px Trebuchet MS";
      const bossIntro = game.pendingBossSpawn && isBossLevel(game.level);
      if (bossIntro) {
        const bt = getDarkBossEncounterTitle(game.level);
        ctx.font = bt.length > 36 ? "bold 28px Trebuchet MS" : "bold 34px Trebuchet MS";
        ctx.fillText(bt, WORLD.width * 0.5, WORLD.height * 0.42);
        ctx.font = "20px Trebuchet MS";
        const sub =
          game.level === 20
            ? "Two raiders — each fires triple fore and aft like Crossfire. Mines keep spawning."
            : game.level === 15
              ? "Triple bolts fore and aft — your twin seals both lanes. Mines keep spawning."
              : game.level === 10
                ? "Triple forward bolts — your twin hunts the horizon. Mines keep spawning."
                : "Your twin hunts the horizon — mines keep spawning.";
        ctx.fillText(sub, WORLD.width * 0.5, WORLD.height * 0.5);
        ctx.fillText("Blast the raider. Space or tap to engage.", WORLD.width * 0.5, WORLD.height * 0.56);
      } else {
        ctx.fillText(`LEVEL ${game.level}`, WORLD.width * 0.5, WORLD.height * 0.46);
        ctx.font = "20px Trebuchet MS";
        ctx.fillText("Mines grow fiercer. Ready?", WORLD.width * 0.5, WORLD.height * 0.53);
        ctx.fillText("Space or tap to continue", WORLD.width * 0.5, WORLD.height * 0.59);
      }
    } else {
      ctx.font = "bold 38px Trebuchet MS";
      ctx.fillText("PAUSED", WORLD.width * 0.5, WORLD.height * 0.5);
      ctx.font = "20px Trebuchet MS";
      ctx.fillText("Press Space to resume", WORLD.width * 0.5, WORLD.height * 0.56);
    }
  }

  if (!game.started && !game.gameOver) {
    ctx.fillStyle = "rgba(0,0,0,0.68)";
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    ctx.fillStyle = "#fff8ec";
    ctx.textAlign = "center";
    ctx.font = "bold 40px Trebuchet MS";
    ctx.fillText("CLICK ANYWHERE TO START", WORLD.width * 0.5, WORLD.height * 0.38);
    ctx.font = "16px Trebuchet MS";
    ctx.fillStyle = "#f0f7ff";
    ctx.fillText("It's all legitimate salvage — if you can dodge the mines.", WORLD.width * 0.5, WORLD.height * 0.46);
    ctx.fillText("Watch out for black holes.", WORLD.width * 0.5, WORLD.height * 0.505);
    ctx.font = "18px Trebuchet MS";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("Turn: A/D or Left/Right | Thrust: W or Up | Reverse: S or Down", WORLD.width * 0.5, WORLD.height * 0.58);
    ctx.fillText("Jump: G / Del  |  Pause: Space", WORLD.width * 0.5, WORLD.height * 0.635);
    ctx.font = "17px Trebuchet MS";
    ctx.fillText(
      "Fire* — requires blaster upgrade (purple orbs). Keys: F / Enter / Ins",
      WORLD.width * 0.5,
      WORLD.height * 0.69
    );
  }

  requestAnimationFrame(frame);
}

restartBtn.addEventListener("click", resetGame);
wrapToggleEl.addEventListener("change", () => {
  game.settings.wrapWorld = wrapToggleEl.checked;
  statusEl.textContent = game.settings.wrapWorld
    ? "Wrap mode enabled: sail through edges."
    : "Wall mode enabled: boundaries are solid.";
});
shockwaveToggleEl.addEventListener("change", () => {
  game.settings.shockwaves = shockwaveToggleEl.checked;
  statusEl.textContent = game.settings.shockwaves
    ? "Shockwaves enabled: blast + ripple physics active."
    : "Shockwaves disabled.";
});
mineChainToggleEl.addEventListener("change", () => {
  game.settings.mineChainBlast = mineChainToggleEl.checked;
  statusEl.textContent = game.settings.mineChainBlast
    ? "Mine chain blasts enabled."
    : "Mine chain blasts disabled.";
});
if (damageOpacityToggleEl) {
  damageOpacityToggleEl.addEventListener("change", () => {
    game.settings.damageOpacity = damageOpacityToggleEl.checked;
    statusEl.textContent = game.settings.damageOpacity
      ? "Damage opacity on: ship fades when hull is low."
      : "Damage opacity off: ship stays full opacity.";
  });
}
if (levelPauseToggleEl) {
  levelPauseToggleEl.addEventListener("change", () => {
    game.settings.pauseOnLevelUp = levelPauseToggleEl.checked;
    statusEl.textContent = game.settings.pauseOnLevelUp
      ? "Pause between levels enabled."
      : "Pause between levels disabled.";
  });
}
if (spaceModeToggleEl) {
  spaceModeToggleEl.addEventListener("change", () => {
    game.settings.spaceMode = spaceModeToggleEl.checked;
    if (game.settings.spaceMode && game.settings.shipSkin === "default") {
      game.settings.shipSkin = "serenity";
      normalizeShipSkin();
      loadRasterShipAssets();
      if (shipSkinSelectEl) shipSkinSelectEl.value = game.settings.shipSkin;
    }
    resetGame();
    const cruiseNote = game.settings.cruisingMode ? " Cruising on (slower mines, softer thrust)." : "";
    statusEl.textContent = game.settings.spaceMode
      ? `Planets: stars, asteroids & gravity worlds.${cruiseNote}`
      : `Space: open sky.${cruiseNote}`;
  });
}
if (cruisingToggleEl) {
  cruisingToggleEl.addEventListener("change", () => {
    game.settings.cruisingMode = cruisingToggleEl.checked;
    syncSpaceModeChrome();
    const where = game.settings.spaceMode ? "Planets" : "Space";
    statusEl.textContent = game.settings.cruisingMode
      ? `Cruising on — ${where}: slower mines, softer thrust.`
      : `Cruising off — ${where} difficulty.`;
  });
}
if (spaceStationToggleEl) {
  spaceStationToggleEl.addEventListener("change", () => {
    if (!game.settings.spaceMode) {
      spaceStationToggleEl.checked = false;
      game.settings.spaceStationsEnabled = false;
      return;
    }
    game.settings.spaceStationsEnabled = spaceStationToggleEl.checked;
    resetGame();
    statusEl.textContent = game.settings.spaceStationsEnabled
      ? "Orbital stations on — fly into ring to dock (60s / undock to dismiss)."
      : "Orbital stations off.";
  });
}
if (stationHullBtn) stationHullBtn.addEventListener("click", () => stationPurchaseHull());
if (stationShieldBtn) stationShieldBtn.addEventListener("click", () => stationPurchaseShield());
if (stationBlasterBtn) stationBlasterBtn.addEventListener("click", () => stationPurchaseBlaster());
if (stationLeaveBtn) stationLeaveBtn.addEventListener("click", () => leaveStationDock());
if (worldModeBtn) {
  worldModeBtn.addEventListener("click", () => {
    game.settings.spaceMode = !game.settings.spaceMode;
    if (game.settings.spaceMode && game.settings.shipSkin === "default") {
      game.settings.shipSkin = "serenity";
      normalizeShipSkin();
      loadRasterShipAssets();
      if (shipSkinSelectEl) shipSkinSelectEl.value = game.settings.shipSkin;
    }
    resetGame();
    const cruiseNote = game.settings.cruisingMode ? " Cruising on." : "";
    statusEl.textContent = game.settings.spaceMode
      ? `Planets: stars, asteroids & gravity worlds.${cruiseNote}`
      : `Space: open sky.${cruiseNote}`;
  });
}
if (shipSkinSelectEl) {
  shipSkinSelectEl.addEventListener("change", () => {
    game.settings.shipSkin = shipSkinSelectEl.value;
    normalizeShipSkin();
    shipSkinSelectEl.value = game.settings.shipSkin;
    loadRasterShipAssets();
    const label = SHIP_SKIN_OPTIONS.find((o) => o.id === game.settings.shipSkin)?.label ?? "Ship";
    statusEl.textContent = `Ship: ${label}.`;
  });
}
startAtBtn.addEventListener("click", () => {
  const rawLevel = Number.parseInt(startLevelInputEl.value, 10);
  game.settings.startLevel = clamp(Number.isNaN(rawLevel) ? 1 : rawLevel, 1, 99);
  startLevelInputEl.value = String(game.settings.startLevel);
  resetGame();
});
largeModeBtn.addEventListener("click", () => {
  game.settings.largeMode = !game.settings.largeMode;
  applyCanvasSize();
  statusEl.textContent = game.settings.largeMode ? "Large mode enabled." : "Large mode disabled.";
});
if (settingsBtn) {
  settingsBtn.addEventListener("click", () => {
    setSettingsOpen(true);
  });
}
if (settingsCloseBtn) {
  settingsCloseBtn.addEventListener("click", () => {
    setSettingsOpen(false);
  });
}
if (settingsBackdropEl) {
  settingsBackdropEl.addEventListener("click", () => {
    setSettingsOpen(false);
  });
}
if (wikiBtn) {
  wikiBtn.addEventListener("click", () => {
    setWikiOpen(true);
  });
}
if (wikiCloseBtn) {
  wikiCloseBtn.addEventListener("click", () => {
    setWikiOpen(false);
  });
}
if (wikiBackdropEl) {
  wikiBackdropEl.addEventListener("click", () => {
    setWikiOpen(false);
  });
}
window.addEventListener("click", (e) => {
  if (e.target.closest(".ui-no-start")) return;
  if (!game.started && !game.gameOver) {
    if (game.bossIntroAfterStart) {
      game.started = true;
      game.paused = true;
      game.awaitingLevelContinue = true;
      clearFieldForBoss();
      game.pendingBossSpawn = true;
      game.bossIntroAfterStart = false;
      game.lastTs = performance.now();
      addOverlay(getDarkBossEncounterTitle(game.level), "#ffb08a");
      statusEl.textContent = `${getDarkBossEncounterTitle(game.level)} — Space or tap to engage.`;
      return;
    }
    game.started = true;
    game.paused = false;
    game.lastTs = performance.now();
    statusEl.textContent = "Sail!";
    return;
  }
  if (game.started && game.awaitingLevelContinue && !game.gameOver) {
    resumeFromLevelPause();
  }
});
window.addEventListener("resize", () => {
  if (game.settings.largeMode) applyCanvasSize();
  updateMobileControlsVisibility();
});

function bindHoldButton(el, keyCode) {
  if (!el) return;
  const press = (e) => {
    e.preventDefault();
    KEY[keyCode] = true;
  };
  const release = (e) => {
    e.preventDefault();
    KEY[keyCode] = false;
  };
  el.addEventListener("pointerdown", press);
  el.addEventListener("pointerup", release);
  el.addEventListener("pointercancel", release);
  el.addEventListener("pointerleave", release);
}

bindHoldButton(mobileLeftBtn, "KeyA");
bindHoldButton(mobileRightBtn, "KeyD");
bindHoldButton(mobileThrottleBtn, "KeyW");
bindHoldButton(mobileReverseBtn, "KeyS");
bindHoldButton(mobileFireBtn, "KeyF");
bindHoldButton(mobileDpadUpBtn, "KeyW");
if (mobilePauseBtn) {
  mobilePauseBtn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    togglePause();
  });
}
if (mobileCruiseBtn) {
  mobileCruiseBtn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    game.mobileCruise = !game.mobileCruise;
    mobileCruiseBtn.classList.toggle("active", game.mobileCruise);
    mobileCruiseBtn.textContent = game.mobileCruise ? "Cruise: On" : "Cruise: Off";
    if (!game.mobileCruise) KEY.KeyW = false;
  });
}

if (cruiseSpeedInputEl) {
  cruiseSpeedInputEl.addEventListener("input", () => {
    const val = clamp(Number.parseInt(cruiseSpeedInputEl.value, 10) || 82, 50, 100);
    game.settings.cruiseThrottle = val / 100;
    if (cruiseSpeedValueEl) cruiseSpeedValueEl.textContent = `${val}%`;
  });
}

let deferredInstallPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  if (installBtn) installBtn.hidden = false;
});
if (installBtn) {
  installBtn.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installBtn.hidden = true;
  });
}
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // Silent failure: game still works without offline cache.
    });
  });
}

updateMobileControlsVisibility();

function applyModeFromQueryString() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "space") game.settings.spaceMode = true;
    if (params.get("mode") === "water" || params.get("mode") === "sea") {
      game.settings.spaceMode = false;
    }
    if (params.get("world") === "cruising") {
      game.settings.cruisingMode = true;
    }
    const cr = params.get("cruising");
    if (cr === "true" || cr === "1" || cr === "yes") {
      game.settings.cruisingMode = true;
    }
    if (cr === "false" || cr === "0" || cr === "no") game.settings.cruisingMode = false;
    const stationParam = params.get("station");
    const issParam = params.get("iss");
    if (
      stationParam === "true" ||
      stationParam === "1" ||
      stationParam === "yes" ||
      issParam === "1" ||
      issParam === "yes"
    ) {
      game.settings.spaceStationsEnabled = true;
      game.settings.spaceMode = true;
    }
    if (stationParam === "false" || stationParam === "0" || stationParam === "no") {
      game.settings.spaceStationsEnabled = false;
    }
    if (params.get("size") === "large") game.settings.largeMode = true;
    if (params.get("size") === "small") game.settings.largeMode = false;
    const sing = params.get("singularity");
    if (sing === "true" || sing === "1" || sing === "yes") {
      game.settings.singularity = true;
      game.settings.spaceMode = true;
    }
    if (sing === "false" || sing === "0" || sing === "no") {
      game.settings.singularity = false;
    }
    const shipParam = params.get("ship");
    if (shipParam === "serenity" || shipParam === "firefly") game.settings.shipSkin = shipParam;
    const levelParam = params.get("level");
    if (levelParam !== null && levelParam !== "") {
      const n = Number.parseInt(levelParam, 10);
      if (!Number.isNaN(n)) game.settings.startLevel = clamp(n, 1, 99);
    }
  } catch (_) {
    /* ignore */
  }
}

function loadRasterShipAssets() {
  if (game.settings.shipSkin === "serenity" && !serenityShipImg) {
    serenityShipImg = new Image();
    serenityShipImg.src = "./assets/serenity.svg";
  }
  if (game.settings.shipSkin === "firefly" && !fireflyShipImg) {
    fireflyShipImg = new Image();
    fireflyShipImg.src = "./assets/firefly.svg";
  }
  if (game.settings.spaceStationsEnabled) ensureIssStationImg();
}

function normalizeShipSkin() {
  if (!SHIP_SKIN_OPTIONS.some((o) => o.id === game.settings.shipSkin)) {
    game.settings.shipSkin = "default";
  }
}

function initShipSkinSelect() {
  if (!shipSkinSelectEl) return;
  shipSkinSelectEl.replaceChildren();
  for (const opt of SHIP_SKIN_OPTIONS) {
    const el = document.createElement("option");
    el.value = opt.id;
    el.textContent = opt.label;
    shipSkinSelectEl.appendChild(el);
  }
  normalizeShipSkin();
  shipSkinSelectEl.value = game.settings.shipSkin;
  if (shipSkinSelectEl.value !== game.settings.shipSkin) {
    game.settings.shipSkin = "default";
    shipSkinSelectEl.value = "default";
  }
}

applyModeFromQueryString();
if (game.settings.spaceMode && game.settings.shipSkin === "default") {
  game.settings.shipSkin = "serenity";
}
normalizeShipSkin();
initShipSkinSelect();
loadRasterShipAssets();
syncSpaceModeChrome();
applyCanvasSize();
resetGame();
wrapToggleEl.checked = game.settings.wrapWorld;
shockwaveToggleEl.checked = game.settings.shockwaves;
mineChainToggleEl.checked = game.settings.mineChainBlast;
if (damageOpacityToggleEl) damageOpacityToggleEl.checked = game.settings.damageOpacity;
if (levelPauseToggleEl) levelPauseToggleEl.checked = game.settings.pauseOnLevelUp;
startLevelInputEl.value = String(game.settings.startLevel);
requestAnimationFrame(frame);
