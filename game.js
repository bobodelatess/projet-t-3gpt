const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('startBtn');

const TAU = Math.PI * 2;
const keys = new Set();
let running = false;
let paused = false;
let last = 0;
let message = 'Récolte la rosée et fais éclore les bourgeons.';

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const state = {
  time: 0,
  score: 0,
  dew: 0,
  level: 1,
  won: false,
  player: { x: 640, y: 360, vx: 0, vy: 0, r: 15, pulse: 0, hp: 100 },
  droplets: [],
  buds: [],
  pests: [],
  particles: [],
  stars: Array.from({ length: 180 }, () => ({ x: rand(0, 1280), y: rand(0, 720), z: rand(.2, 1), tw: rand(0, TAU) }))
};

function reset() {
  Object.assign(state, { time: 0, score: 0, dew: 0, level: 1, won: false, droplets: [], buds: [], pests: [], particles: [] });
  Object.assign(state.player, { x: 640, y: 360, vx: 0, vy: 0, pulse: 0, hp: 100 });
  for (let i = 0; i < 34; i++) state.droplets.push(spawnDrop());
  for (let i = 0; i < 7; i++) {
    const angle = i / 7 * TAU;
    state.buds.push({ x: 640 + Math.cos(angle) * rand(190, 305), y: 360 + Math.sin(angle) * rand(120, 250), open: false, bloom: 0, hue: rand(38, 64) });
  }
  for (let i = 0; i < 5; i++) state.pests.push(spawnPest());
  message = 'Réveille 7 fleurs-constellations.';
}

function spawnDrop() { return { x: rand(70, 1210), y: rand(70, 650), r: rand(5, 9), a: rand(0, TAU), taken: false }; }
function spawnPest() { return { x: Math.random() < .5 ? rand(-80, -20) : rand(1300, 1380), y: rand(40, 680), vx: rand(-40, 40), vy: rand(-30, 30), r: rand(12, 18), mood: rand(0, TAU) }; }
function burst(x, y, color, n = 20) {
  for (let i = 0; i < n; i++) state.particles.push({ x, y, vx: Math.cos(i / n * TAU) * rand(45, 240), vy: Math.sin(i / n * TAU) * rand(45, 240), life: rand(.35, 1.1), max: 1.1, color, size: rand(2, 6) });
}

function update(dt) {
  if (!running || paused || state.won) return;
  state.time += dt;
  const p = state.player;
  const ax = (keys.has('arrowright') || keys.has('d') ? 1 : 0) - (keys.has('arrowleft') || keys.has('a') ? 1 : 0);
  const ay = (keys.has('arrowdown') || keys.has('s') ? 1 : 0) - (keys.has('arrowup') || keys.has('w') ? 1 : 0);
  const len = Math.hypot(ax, ay) || 1;
  p.vx += ax / len * 720 * dt;
  p.vy += ay / len * 720 * dt;
  p.vx *= Math.pow(.045, dt); p.vy *= Math.pow(.045, dt);
  p.x = clamp(p.x + p.vx * dt, p.r, 1280 - p.r);
  p.y = clamp(p.y + p.vy * dt, p.r, 720 - p.r);
  p.pulse = Math.max(0, p.pulse - dt * 2.2);

  for (const d of state.droplets) {
    d.a += dt * 2;
    if (!d.taken && dist(p, d) < p.r + d.r + 8) {
      d.taken = true; state.dew++; state.score += 25; burst(d.x, d.y, '#7df9ff', 10);
      setTimeout(() => Object.assign(d, spawnDrop()), 420);
    }
  }

  const openCount = state.buds.filter(b => b.open).length;
  state.level = 1 + openCount;
  for (const b of state.buds) if (b.open) b.bloom = clamp(b.bloom + dt, 0, 1);

  for (const pest of state.pests) {
    pest.mood += dt;
    const slow = 1 / (1 + openCount * .12);
    const angle = Math.atan2(p.y - pest.y, p.x - pest.x) + Math.sin(pest.mood * 2) * .7;
    pest.vx += Math.cos(angle) * (70 + openCount * 13) * dt;
    pest.vy += Math.sin(angle) * (70 + openCount * 13) * dt;
    pest.vx *= Math.pow(.18, dt); pest.vy *= Math.pow(.18, dt);
    pest.x += pest.vx * dt * slow; pest.y += pest.vy * dt * slow;
    if (pest.x < -100 || pest.x > 1380 || pest.y < -100 || pest.y > 820) Object.assign(pest, spawnPest());
    if (dist(p, pest) < p.r + pest.r) { p.hp -= 18 * dt; state.score = Math.max(0, state.score - 2); }
  }
  while (state.pests.length < 5 + Math.floor(openCount / 2)) state.pests.push(spawnPest());
  if (p.hp <= 0) { running = false; overlay.classList.remove('hidden'); overlay.querySelector('h2').textContent = 'Le jardin se rendort'; overlay.querySelector('p:not(.eyebrow)').textContent = `Score final : ${state.score}. Appuie sur R ou recommence.`; startBtn.textContent = 'Rejouer'; }
  if (openCount === 7) { state.won = true; message = 'Victoire : le ciel a fleuri !'; burst(p.x, p.y, '#ffd166', 90); }
  state.particles = state.particles.filter(q => (q.life -= dt) > 0).map(q => (q.x += q.vx * dt, q.y += q.vy * dt, q.vy += 90 * dt, q));
}

function flourish() {
  const p = state.player;
  if (state.dew < 3) { message = 'Il faut 3 gouttes de rosée pour fleurir.'; return; }
  const bud = state.buds.find(b => !b.open && dist(p, b) < 92);
  if (!bud) { message = 'Approche-toi d’un bourgeon doré.'; return; }
  bud.open = true; state.dew -= 3; state.score += 300; p.pulse = 1; message = `Constellation ${state.buds.filter(b => b.open).length}/7 éveillée.`; burst(bud.x, bud.y, '#ffd166', 46);
}

function draw() {
  const t = state.time;
  const g = ctx.createLinearGradient(0, 0, 1280, 720);
  g.addColorStop(0, '#090b22'); g.addColorStop(.5, '#10183a'); g.addColorStop(1, '#240a30');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1280, 720);
  for (const s of state.stars) { ctx.globalAlpha = .25 + Math.sin(t * 2 + s.tw) * .18 + s.z * .45; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc((s.x + t * 10 * s.z) % 1280, s.y, s.z * 2, 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 1;
  ctx.save(); ctx.translate(640, 360); ctx.rotate(Math.sin(t * .13) * .08);
  for (let r = 95; r < 520; r += 55) { ctx.strokeStyle = `hsla(${190 + r / 4}, 80%, 70%, ${.05 + r / 9000})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, r * 1.25, r * .62, 0, 0, TAU); ctx.stroke(); }
  ctx.restore();
  for (const b of state.buds) drawBud(b, t);
  for (const d of state.droplets) if (!d.taken) drawDrop(d, t);
  for (const pest of state.pests) drawPest(pest, t);
  for (const q of state.particles) { ctx.globalAlpha = q.life / q.max; ctx.fillStyle = q.color; ctx.beginPath(); ctx.arc(q.x, q.y, q.size, 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 1; drawPlayer(state.player, t); drawHud();
  if (state.won) { ctx.fillStyle = 'rgba(4,6,18,.42)'; ctx.fillRect(0, 0, 1280, 720); ctx.fillStyle = '#fff'; ctx.font = '900 76px system-ui'; ctx.textAlign = 'center'; ctx.fillText('Le ciel a fleuri', 640, 330); ctx.font = '700 26px system-ui'; ctx.fillText(`Score ${state.score} • Appuie sur R pour une nouvelle orbite`, 640, 382); }
}
function drawBud(b, t) { ctx.save(); ctx.translate(b.x, b.y); const bloom = b.open ? b.bloom : 0; ctx.shadowBlur = 25 + bloom * 35; ctx.shadowColor = b.open ? '#ffd166' : '#5b4b2c'; for (let i = 0; i < 8; i++) { ctx.rotate(TAU / 8); ctx.fillStyle = `hsla(${b.hue + i * 8}, 95%, ${52 + bloom * 16}%, ${.9})`; ctx.beginPath(); ctx.ellipse(0, -14 - bloom * 18, 8 + bloom * 12, 22 + bloom * 24, Math.sin(t + i) * .2, 0, TAU); ctx.fill(); } ctx.fillStyle = b.open ? '#fff7b2' : '#80612b'; ctx.beginPath(); ctx.arc(0, 0, 13 + bloom * 6, 0, TAU); ctx.fill(); ctx.restore(); }
function drawDrop(d, t) { ctx.save(); ctx.translate(d.x, d.y + Math.sin(t * 2 + d.a) * 7); ctx.shadowBlur = 24; ctx.shadowColor = '#7df9ff'; ctx.fillStyle = '#7df9ff'; ctx.beginPath(); ctx.arc(0, 0, d.r, 0, TAU); ctx.fill(); ctx.restore(); }
function drawPest(e, t) { ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(Math.atan2(e.vy, e.vx)); ctx.shadowBlur = 20; ctx.shadowColor = '#ff4d8d'; ctx.fillStyle = '#ff4d8d'; ctx.beginPath(); ctx.moveTo(e.r + 10, 0); ctx.quadraticCurveTo(-e.r, -e.r, -e.r * .7, 0); ctx.quadraticCurveTo(-e.r, e.r, e.r + 10, 0); ctx.fill(); ctx.fillStyle = '#1b0620'; ctx.beginPath(); ctx.arc(e.r * .25, -4, 3, 0, TAU); ctx.arc(e.r * .25, 4, 3, 0, TAU); ctx.fill(); ctx.restore(); }
function drawPlayer(p, t) { ctx.save(); ctx.translate(p.x, p.y); ctx.shadowBlur = 30; ctx.shadowColor = '#baffff'; const grd = ctx.createRadialGradient(-5, -7, 3, 0, 0, 25); grd.addColorStop(0, '#fff'); grd.addColorStop(.5, '#7df9ff'); grd.addColorStop(1, '#6c63ff'); ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(0, 0, p.r + Math.sin(t * 9) * 1.5, 0, TAU); ctx.fill(); ctx.strokeStyle = `rgba(255,209,102,${p.pulse})`; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(0, 0, 45 + (1 - p.pulse) * 80, 0, TAU); ctx.stroke(); ctx.restore(); }
function drawHud() { ctx.fillStyle = 'rgba(4,7,18,.58)'; ctx.roundRect(24, 22, 460, 92, 18); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = '800 24px system-ui'; ctx.textAlign = 'left'; ctx.fillText(`Score ${state.score}`, 46, 57); ctx.font = '700 18px system-ui'; ctx.fillStyle = '#7df9ff'; ctx.fillText(`Rosée ${state.dew}  •  Fleurs ${state.buds.filter(b => b.open).length}/7  •  Vie ${Math.ceil(state.player.hp)}%`, 46, 88); ctx.fillStyle = '#ffd166'; ctx.fillText(message, 720, 52); if (paused) { ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0,0,1280,720); ctx.fillStyle='#fff'; ctx.font='900 70px system-ui'; ctx.textAlign='center'; ctx.fillText('Pause',640,370); } }

function loop(now) { const dt = Math.min(.033, (now - last) / 1000 || 0); last = now; update(dt); draw(); requestAnimationFrame(loop); }
startBtn.onclick = () => { reset(); running = true; paused = false; overlay.classList.add('hidden'); last = performance.now(); };
window.addEventListener('keydown', e => { const k = e.key.toLowerCase(); keys.add(k); if (k === ' ') { e.preventDefault(); flourish(); } if (k === 'p') paused = !paused; if (k === 'r') { reset(); running = true; paused = false; overlay.classList.add('hidden'); } });
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
reset(); draw(); requestAnimationFrame(loop);
