const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const levelEl = document.getElementById("level");
const hullEl = document.getElementById("hull");
const shieldHudEl = document.getElementById("shieldHud");
const statusEl = document.getElementById("status");
const restartBtn = document.getElementById("restart");
const wrapToggleEl = document.getElementById("wrapToggle");
const shockwaveToggleEl = document.getElementById("shockwaveToggle");
const mineChainToggleEl = document.getElementById("mineChainToggle");
const startLevelInputEl = document.getElementById("startLevelInput");
const startAtBtn = document.getElementById("startAtBtn");
const largeModeBtn = document.getElementById("largeModeBtn");
const settingsBtn = document.getElementById("settingsBtn");
const settingsPanelEl = document.getElementById("settingsPanel");
const settingsBackdropEl = document.getElementById("settingsBackdrop");
const settingsCloseBtn = document.getElementById("settingsCloseBtn");
const appEl = document.querySelector(".app");

const WORLD = { width: canvas.width, height: canvas.height };
const BASE_HULL = 100;
const MAX_HULL = 200;
const MAX_SHIELD = 150;
const DEFAULT_CANVAS_WIDTH = 960;
const DEFAULT_CANVAS_HEIGHT = 640;

const TUNING = {
  levelStepSeconds: 40,
  mysteryCapBase: 3,
  mysteryCapPerThousand: 3,
  mineMinSpawnDistance: 180,
  mineSpawnIntervalMax: 2.9,
  mineSpawnIntervalMin: 0.85,
  mineSpawnIntervalPerLevel: 0.16,
  treasureSpawnIntervalMax: 1.5,
  treasureSpawnIntervalMin: 0.7,
  treasureSpawnIntervalPerLevel: 0.05,
};

// Hidden debug/nostalgia cheats (intentionally not shown in UI):
// - howdoyouturnthisthingon => blaster
// - idontexist             => 60s invulnerability
// - putonyourcapes         => max hull + shield
const CHEATS = {
  howdoyouturnthisthingon: () => {
    game.hasBlaster = true;
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
    game.shield = MAX_SHIELD;
    addOverlay("Power Surge: Fortified Hull", "#90d5ff");
    statusEl.textContent = "A strange power surges through the ship.";
  },
};

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
window.addEventListener("keydown", (e) => {
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
    if (!e.repeat && !game.gameOver && game.started) {
      game.paused = !game.paused;
      statusEl.textContent = game.paused ? "Paused. Press Space to resume." : "Resumed.";
    }
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
  hasBlaster: false,
  bullets: [],
  blasterCooldown: 0,
  overlays: [],
  paused: false,
  started: false,
  settings: {
    wrapWorld: false,
    shockwaves: true,
    mineChainBlast: false,
    startLevel: 1,
    largeMode: false,
  },
};

function getStartLevel() {
  return clamp(Math.floor(game.settings.startLevel || 1), 1, 99);
}

function resetGame() {
  const startLevel = getStartLevel();
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
  game.hasBlaster = false;
  game.bullets = [];
  game.blasterCooldown = 0;
  game.overlays = [];
  game.paused = false;
  game.started = false;
  cheatBuffer = "";
  game.mineSpawnTimer = 0.6;
  game.treasureSpawnTimer = 1.2;
  game.levelTimer = 0;
  game.lastTs = performance.now();
  statusEl.textContent = `Click anywhere to start. Starting at level ${startLevel}.`;
  updateHud();
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

function rescaleEntityCollection(items, sx, sy) {
  for (const e of items) {
    e.x *= sx;
    e.y *= sy;
  }
}

function applyCanvasSize() {
  const oldW = WORLD.width;
  const oldH = WORLD.height;
  let newW = DEFAULT_CANVAS_WIDTH;
  let newH = DEFAULT_CANVAS_HEIGHT;
  if (game.settings.largeMode) {
    newW = Math.max(980, Math.floor(window.innerWidth * 0.95));
    newH = Math.max(620, Math.floor(window.innerHeight * 0.78));
  }

  canvas.width = newW;
  canvas.height = newH;
  WORLD.width = newW;
  WORLD.height = newH;
  appEl.style.width = game.settings.largeMode ? "min(100vw, 99vw)" : "min(100vw, 980px)";
  largeModeBtn.textContent = game.settings.largeMode ? "Large Mode: On" : "Large Mode: Off";

  if (oldW > 0 && oldH > 0 && (oldW !== newW || oldH !== newH)) {
    const sx = newW / oldW;
    const sy = newH / oldH;
    if (game.player) {
      game.player.x *= sx;
      game.player.y *= sy;
    }
    rescaleEntityCollection(game.mines, sx, sy);
    rescaleEntityCollection(game.treasures, sx, sy);
    rescaleEntityCollection(game.explosions, sx, sy);
    rescaleEntityCollection(game.bullets, sx, sy);
  }
}

function setSettingsOpen(isOpen) {
  if (!settingsPanelEl || !settingsBackdropEl) return;
  settingsPanelEl.hidden = !isOpen;
  settingsBackdropEl.hidden = !isOpen;
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

    if (Math.hypot(mine.x - p.x, mine.y - p.y) >= minSpawnDistance || tries === 15) {
      game.mines.push(mine);
      return;
    }
  }
}

function spawnTreasure() {
  const type = chooseTreasure(game.level);
  game.treasures.push({
    x: rand(35, WORLD.width - 35),
    y: rand(35, WORLD.height - 35),
    radius: type.radius,
    value: type.value,
    life: type.life,
    maxLife: type.life,
    color: type.color,
    kind: "coin",
  });
}

function spawnMysteryPrize() {
  game.treasures.push({
    x: rand(45, WORLD.width - 45),
    y: rand(45, WORLD.height - 45),
    radius: 12,
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
  const turnRate = 3.15;
  const accel = 320 * speedBoostScale;
  const reverse = 175 * speedBoostScale;
  const drag = 0.987;
  const maxSpeed = 315 * speedBoostScale;

  if (KEY.ArrowLeft || KEY.KeyA) p.angle -= turnRate * dt;
  if (KEY.ArrowRight || KEY.KeyD) p.angle += turnRate * dt;

  const dirX = Math.cos(p.angle);
  const dirY = Math.sin(p.angle);
  if (KEY.ArrowUp || KEY.KeyW) {
    p.vx += dirX * accel * dt;
    p.vy += dirY * accel * dt;
  }
  if (KEY.ArrowDown || KEY.KeyS) {
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

  p.x += p.vx * dt;
  p.y += p.vy * dt;
  if (game.settings.wrapWorld) wrapEntity(p);
  else confineEntity(p, 0.4);

  if (canShoot() && (KEY.KeyF || KEY.Enter)) {
    const bulletSpeed = 520;
    game.bullets.push({
      x: p.x + Math.cos(p.angle) * (p.radius + 8),
      y: p.y + Math.sin(p.angle) * (p.radius + 8),
      vx: Math.cos(p.angle) * bulletSpeed,
      vy: Math.sin(p.angle) * bulletSpeed,
      radius: 4,
      life: 1.1,
    });
    game.blasterCooldown = 0.18;
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
    m.x += m.vx * dt;
    m.y += m.vy * dt;
    if (game.settings.wrapWorld) wrapEntity(m);
    else confineEntity(m, 0.25);
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
}

function addOverlay(text, color = "#fff1be") {
  game.overlays.push({
    text,
    color,
    life: 1.7,
    maxLife: 1.7,
  });
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
  return TUNING.mysteryCapBase + Math.floor(game.score / 1000) * TUNING.mysteryCapPerThousand;
}

function applyMysteryPowerup() {
  const roll = Math.floor(rand(0, 5));
  if (roll === 0) {
    game.speedBoostTimer = Math.min(game.speedBoostTimer + 6.5, 15);
    statusEl.textContent = "Mystery prize: speed boost!";
    addOverlay("POWERUP: Speed Boost", "#a9f2ff");
  } else if (roll === 1) {
    const repairPowers = [25, 50, 100];
    const heal = repairPowers[Math.floor(rand(0, repairPowers.length))];
    if (game.hull >= MAX_HULL) {
      game.score += 333;
      statusEl.textContent = "Mystery prize: hull maxed, +333 points.";
      addOverlay("POWERUP: Bonus +333", "#f2e2a0");
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
    game.shield = Math.min(MAX_SHIELD, game.shield + 75);
    statusEl.textContent = "Mystery prize: shield strengthened!";
    addOverlay(`POWERUP: Shield ${Math.round(game.shield)}%`, "#90d5ff");
  } else {
    game.hasBlaster = true;
    game.blasterCooldown = 0;
    statusEl.textContent = "Mystery prize: blaster online (F/Enter to fire)!";
    addOverlay("POWERUP: Blaster Online", "#ffc38d");
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
        game.score += t.value;
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
}

function updateDifficulty(dt) {
  game.levelTimer += dt;
  if (game.levelTimer >= TUNING.levelStepSeconds) {
    game.level += 1;
    game.levelTimer = 0;
    statusEl.textContent = `Level ${game.level} - mines are faster.`;
  }

  const mineInterval = clamp(
    TUNING.mineSpawnIntervalMax - game.level * TUNING.mineSpawnIntervalPerLevel,
    TUNING.mineSpawnIntervalMin,
    TUNING.mineSpawnIntervalMax
  );
  const treasureInterval = clamp(
    TUNING.treasureSpawnIntervalMax - game.level * TUNING.treasureSpawnIntervalPerLevel,
    TUNING.treasureSpawnIntervalMin,
    TUNING.treasureSpawnIntervalMax
  );
  game.mineSpawnTimer -= dt;
  game.treasureSpawnTimer -= dt;
  if (game.mineSpawnTimer <= 0) {
    spawnMine();
    game.mineSpawnTimer = mineInterval;
  }
  if (game.treasureSpawnTimer <= 0) {
    spawnTreasure();
    game.treasureSpawnTimer = treasureInterval;
  }

  game.mysterySpawnTimer -= dt;
  if (game.mysterySpawnTimer <= 0) {
    const cap = getMysteryPrizeCap();
    if (game.mysteryAwarded < cap) spawnMysteryPrize();
    game.mysterySpawnTimer = rand(10.5, 15.5);
  }
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

function drawPlayer() {
  const p = game.player;
  const blink = game.invuln > 0 && game.immunityTimer <= 0 && Math.floor(performance.now() / 80) % 2 === 0;
  if (blink) return;
  const hullDamageRatio = clamp(game.hull / BASE_HULL, 0, 1);
  const hullVisualRatio = clamp(game.hull / BASE_HULL, 0, 1.35);

  ctx.save();
  ctx.globalAlpha = 0.35 + hullDamageRatio * 0.65;
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
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
  for (const m of game.mines) {
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.fillStyle = "#141414";
    ctx.beginPath();
    ctx.arc(0, 0, m.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#a50505";
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
  if (game.hasBlaster) effects.push("Blaster ON");
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

  if (!game.gameOver && !game.paused && game.started) {
    updatePlayer(dt);
    updateMines(dt);
    updateTreasures(dt);
    updateExplosions(dt);
    updateBullets(dt);
    applyShockwaveEffects(dt);
    updateDifficulty(dt);
    handleBulletMineHits();
    handleCollisions();
    game.invuln -= dt;
    game.speedBoostTimer = Math.max(0, game.speedBoostTimer - dt);
    game.immunityTimer = Math.max(0, game.immunityTimer - dt);
    game.blasterCooldown = Math.max(0, game.blasterCooldown - dt);
    for (const ov of game.overlays) ov.life -= dt;
    game.overlays = game.overlays.filter((ov) => ov.life > 0);
    updateHud();
  }

  drawWater();
  drawTreasures();
  drawExplosions();
  drawBullets();
  drawMines();
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
    ctx.font = "bold 38px Trebuchet MS";
    ctx.fillText("PAUSED", WORLD.width * 0.5, WORLD.height * 0.5);
    ctx.font = "20px Trebuchet MS";
    ctx.fillText("Press Space to resume", WORLD.width * 0.5, WORLD.height * 0.56);
  }

  if (!game.started && !game.gameOver) {
    ctx.fillStyle = "rgba(0,0,0,0.42)";
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    ctx.fillStyle = "#f5e4b8";
    ctx.textAlign = "center";
    ctx.font = "bold 40px Trebuchet MS";
    ctx.fillText("CLICK ANYWHERE TO START", WORLD.width * 0.5, WORLD.height * 0.45);
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
window.addEventListener("click", (e) => {
  if (e.target.closest(".ui-no-start")) return;
  if (!game.started && !game.gameOver) {
    game.started = true;
    game.paused = false;
    game.lastTs = performance.now();
    statusEl.textContent = "Sail!";
  }
});
window.addEventListener("resize", () => {
  if (game.settings.largeMode) applyCanvasSize();
});

applyCanvasSize();
resetGame();
wrapToggleEl.checked = game.settings.wrapWorld;
shockwaveToggleEl.checked = game.settings.shockwaves;
mineChainToggleEl.checked = game.settings.mineChainBlast;
startLevelInputEl.value = String(game.settings.startLevel);
requestAnimationFrame(frame);
