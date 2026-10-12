/* ═══════════════════════════════════════════════════════════════════════
   Красная 3D-«Z» первого экрана (Three.js).

   Буква — экструзия с бевелом, диагональ нарезана пиксельной лесенкой.
   Материал — мокрый глянец: MeshPhysicalMaterial + clearcoat, капли —
   карта нормалей, отражения — студийный env (софтбоксы, без HDR-файлов).
   Купюры, стикеры, каракули маркером и LED «CASH» рисуются на холсте
   и ложатся текстурой на лицевую и тыльную грань.
   За буквой — та же буква пиксель-артом из кубиков.

   Пауза (html.motion-off) — стоп цикла, кадр ¾. Скрытая вкладка или
   первый экран вне вида — тоже стоп. ?still — отдать кадр ¾ в PNG
   (так собрана картинка-подложка img/z-still.webp).
   ═══════════════════════════════════════════════════════════════════════ */
import * as THREE from './vendor/three.module.min.js';

const root = document.documentElement;
const stage = document.getElementById('z-stage');
const canvas = document.getElementById('z-canvas');
const STILL = new URLSearchParams(location.search).has('still');

const RED = '#E52230', RED_HI = '#F42E3F', RED_LO = '#8A0A14';
const CYCLE = 8;                        // секунд на полный оборот
const Z = { W: 1.1, H: 1.2, T: 0.46, D: 0.64, N: 7, DEPTH: 0.62 };
const BEVEL = { t: 0.05, s: 0.035 };

/* ── форма буквы ───────────────────────────────────────────────────── */
function stairs() {
  // нижне-правая кромка диагонали: от низа верхней перекладины до верха
  // нижней, вниз-влево ступеньками (сначала вниз, потом влево)
  const { W, H, T, D, N } = Z, out = [];
  const x = k => W - k * (2 * W - D) / N;
  const y = k => (H - T) - (k + 1) * (2 * (H - T)) / (N + 1);
  for (let k = 0; k <= N; k++) {
    out.push([x(k), y(k)]);
    if (k < N) out.push([x(k + 1), y(k)]);
  }
  return out;
}
function zShape() {
  const { W, H, T } = Z, R = stairs();
  const pts = [[-W, H], [W, H], ...R, [W, -H + T], [W, -H], [-W, -H],
    ...R.map(([a, b]) => [-a, -b]), [-W, H - T]];
  const s = new THREE.Shape();
  pts.forEach(([a, b], i) => (i ? s.lineTo(a, b) : s.moveTo(a, b)));
  s.closePath();
  return s;
}

function zGeometry() {
  const g = new THREE.ExtrudeGeometry(zShape(), {
    depth: Z.DEPTH, steps: 1, curveSegments: 1,
    bevelEnabled: true, bevelThickness: BEVEL.t, bevelSize: BEVEL.s, bevelSegments: 4
  });
  g.translate(0, 0, -Z.DEPTH / 2);
  const pos = g.attributes.position, uv = g.attributes.uv;
  const capEnd = g.groups[0].count;
  const zMin = -Z.DEPTH / 2 - BEVEL.t, zMax = Z.DEPTH / 2 + BEVEL.t;
  const W = Z.W + BEVEL.s, H = Z.H + BEVEL.s;
  let backEnd = 0;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
    if (i < capEnd) {
      const back = pz < 0;
      if (back) backEnd = i + 1;
      const u = (px + W) / (2 * W);
      // тыльная грань: зеркалим u, чтобы надписи читались и с обратной стороны
      uv.setXY(i, back ? 1 - u : u, (py + H) / (2 * H));
    } else {
      uv.setY(i, (pz - zMin) / (zMax - zMin));
      uv.setX(i, uv.getX(i) * 0.5);
    }
  }
  // крышки идут подряд: сначала тыльная, потом лицевая
  g.clearGroups();
  g.addGroup(0, backEnd, 2);
  g.addGroup(backEnd, capEnd - backEnd, 0);
  g.addGroup(capEnd, pos.count - capEnd, 1);
  g.computeVertexNormals();
  return g;
}

/* ── текстуры на холсте ────────────────────────────────────────────── */
const TW = 1876, TH = 2048;             // пропорция буквы 2,2 : 2,4
const EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

function px(x, y, mirror) {             // координаты буквы → пиксели холста
  const W = Z.W + BEVEL.s, H = Z.H + BEVEL.s;
  const u = (x + W) / (2 * W);
  return [(mirror ? 1 - u : u) * TW, (1 - (y + H) / (2 * H)) * TH];
}

function outlined(draw, w, h, r) {      // белая обводка стикера, как вырезка
  const c = document.createElement('canvas');
  c.width = w + r * 4; c.height = h + r * 4;
  const x = c.getContext('2d');
  x.translate(r * 2, r * 2); draw(x); x.setTransform(1, 0, 0, 1, 0, 0);
  const sil = document.createElement('canvas');
  sil.width = c.width; sil.height = c.height;
  const s = sil.getContext('2d');
  s.drawImage(c, 0, 0);
  s.globalCompositeOperation = 'source-in';
  s.fillStyle = '#fff'; s.fillRect(0, 0, sil.width, sil.height);
  const out = document.createElement('canvas');
  out.width = c.width; out.height = c.height;
  const o = out.getContext('2d');
  o.shadowColor = 'rgba(0,0,0,.45)'; o.shadowBlur = r * 1.5; o.shadowOffsetY = r * 0.6;
  for (let a = 0; a < 24; a++) {
    const t = a / 24 * Math.PI * 2;
    o.drawImage(sil, Math.cos(t) * r, Math.sin(t) * r);
    if (a === 0) { o.shadowColor = 'transparent'; }
  }
  o.drawImage(c, 0, 0);
  return out;
}

function emojiSticker(ch, size) {
  return outlined(x => {
    x.font = size + 'px ' + EMOJI; x.textBaseline = 'top';
    x.fillText(ch, 0, size * 0.04);
  }, size * 1.2, size * 1.2, Math.round(size * 0.06));
}

function lemonCat(size) {              // лимонный кот: лимон-шлем + кошачья морда
  return outlined(x => {
    x.font = size + 'px ' + EMOJI; x.textBaseline = 'top';
    x.fillText('🍋', size * 0.05, -size * 0.02);
    x.font = size * 0.78 + 'px ' + EMOJI;
    x.fillText('😼', size * 0.2, size * 0.38);
  }, size * 1.25, size * 1.25, Math.round(size * 0.06));
}

function banknote(w, h, seed) {        // стилизованная 5000 ₽ с отогнутым уголком
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  const ear = h * 0.32;
  x.beginPath();
  x.moveTo(0, 0); x.lineTo(w - ear, 0); x.lineTo(w, ear); x.lineTo(w, h); x.lineTo(0, h); x.closePath();
  x.save(); x.clip();
  const g = x.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#F2C79A'); g.addColorStop(0.45, '#E49A63'); g.addColorStop(1, '#C9653F');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  // гильош
  x.strokeStyle = 'rgba(140,50,30,.35)'; x.lineWidth = 2;
  for (let k = 0; k < 9; k++) {
    x.beginPath();
    for (let i = 0; i <= w; i += 6) {
      const yy = h * 0.18 + k * h * 0.08 + Math.sin(i / 23 + k + seed) * h * 0.035;
      i ? x.lineTo(i, yy) : x.moveTo(i, yy);
    }
    x.stroke();
  }
  // светлое поле с медальоном
  x.fillStyle = 'rgba(250,236,210,.85)';
  x.fillRect(w * 0.05, h * 0.12, w * 0.24, h * 0.76);
  x.strokeStyle = 'rgba(160,70,40,.55)'; x.lineWidth = 3;
  x.beginPath(); x.arc(w * 0.17, h * 0.5, h * 0.22, 0, Math.PI * 2); x.stroke();
  x.beginPath(); x.arc(w * 0.17, h * 0.5, h * 0.15, 0, Math.PI * 2); x.stroke();
  // номинал
  x.fillStyle = '#8F2E1F';
  x.font = '800 ' + h * 0.3 + 'px Inter, sans-serif'; x.textBaseline = 'alphabetic';
  x.fillText('5000', w * 0.62, h * 0.36);
  x.save(); x.translate(w * 0.36, h * 0.92); x.rotate(-Math.PI / 2);
  x.font = '800 ' + h * 0.2 + 'px Inter, sans-serif'; x.fillText('5000', 0, 0); x.restore();
  x.font = '700 ' + h * 0.085 + 'px Inter, sans-serif';
  x.fillText('ПЯТЬ ТЫСЯЧ РУБЛЕЙ', w * 0.42, h * 0.84);
  x.fillStyle = 'rgba(143,46,31,.8)';
  x.font = '600 ' + h * 0.07 + 'px Inter, sans-serif';
  x.fillText('АА 5000000', w * 0.62, h * 0.52);
  x.restore();
  // загнутый уголок
  x.fillStyle = '#F7DDBF';
  x.beginPath(); x.moveTo(w - ear, 0); x.lineTo(w - ear, ear); x.lineTo(w, ear); x.closePath(); x.fill();
  x.strokeStyle = 'rgba(80,30,10,.35)'; x.lineWidth = 2; x.stroke();
  return c;
}

function barcode(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);
  x.fillStyle = '#111';
  let i = w * 0.06, n = 0;
  while (i < w * 0.94) {
    const bw = [3, 5, 2, 8, 3, 4][(n * 7 + 3) % 6];
    if (n % 2 === 0) x.fillRect(i, h * 0.1, bw, h * 0.66);
    i += bw + 2; n++;
  }
  x.font = '600 ' + h * 0.16 + 'px Inter, sans-serif';
  x.fillText('4 607001 771234', w * 0.08, h * 0.95);
  return c;
}

function marker(x, text, size, opts = {}) {
  x.save();
  x.font = '700 ' + size + 'px Caveat, cursive';
  x.fillStyle = '#fff'; x.strokeStyle = '#fff';
  x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = 6;
  x.textBaseline = 'middle'; x.textAlign = opts.align || 'left';
  x.fillText(text, 0, 0);
  x.restore();
}

function stroke(x, pts, w) {
  x.save();
  x.strokeStyle = '#fff'; x.lineWidth = w; x.lineCap = 'round'; x.lineJoin = 'round';
  x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = 5;
  x.beginPath();
  pts.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b)));
  x.stroke(); x.restore();
}

/* Раскладка декора — в координатах буквы (x ∈ ±1,1, y ∈ ±1,2).
   Для тыльной грани позиции зеркалятся, а повороты меняют знак —
   так надписи читаются, а декор ложится на перекладины и диагональ. */
function paintCap(mirror, assets) {
  const c = document.createElement('canvas');
  c.width = TW; c.height = TH;
  const x = c.getContext('2d');
  const at = (X, Y, rot, fn) => {
    const [a, b] = px(X, Y, mirror);
    x.save(); x.translate(a, b); x.rotate(mirror ? -rot : rot); fn(); x.restore();
  };
  const img = (im, X, Y, rot, scale = 1) => at(X, Y, rot, () =>
    x.drawImage(im, -im.width * scale / 2, -im.height * scale / 2, im.width * scale, im.height * scale));
  const diag = Math.atan2(2 * (Z.H - Z.T), 2 * Z.W - Z.D);   // наклон диагонали

  // основа
  x.fillStyle = RED; x.fillRect(0, 0, TW, TH);
  const sh = x.createLinearGradient(0, 0, 0, TH);
  sh.addColorStop(0, 'rgba(255,255,255,.06)'); sh.addColorStop(0.5, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.12)');
  x.fillStyle = sh; x.fillRect(0, 0, TW, TH);

  // чёрные лаковые вставки: полосы вдоль перекладин и лесенка диагонали
  x.fillStyle = '#070707';
  { const [, y1] = px(0, Z.H - Z.T + 0.11, mirror), [, y2] = px(0, Z.H - Z.T, mirror); x.fillRect(0, y1, TW, y2 - y1); }
  { const [, y1] = px(0, -Z.H + Z.T, mirror), [, y2] = px(0, -Z.H + Z.T - 0.09, mirror); x.fillRect(0, y1, TW, y2 - y1); }
  { const [, y1] = px(0, Z.H - 0.02, mirror), [, y2] = px(0, Z.H - 0.07, mirror); x.fillRect(0, y1, TW, y2 - y1); }
  const R = stairs().map(([a, b]) => px(a - 0.07, b + 0.07, mirror));
  x.save(); x.strokeStyle = '#070707'; x.lineWidth = 34; x.lineJoin = 'miter';
  x.beginPath(); R.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.stroke(); x.restore();
  // блики на лаке
  x.save(); x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 4;
  { const [, yy] = px(0, Z.H - Z.T + 0.085, mirror); x.beginPath(); x.moveTo(TW * 0.12, yy); x.lineTo(TW * 0.42, yy); x.stroke(); }
  x.restore();

  // купюры внахлёст
  img(assets.note1, -0.62, 0.98, -0.06, 0.95);
  img(assets.note2, 0.55, -0.98, -0.12, 1.05);
  img(assets.note3, -0.3, -0.25, -diag * 0.9, 0.9);
  img(assets.note4, 0.05, -1.02, 0.1, 0.8);

  // штрихкод-наклейка
  img(assets.code, -0.9, 0.86, -0.08, 0.7);

  // LED-табло CASH
  at(0.72, 0.9, -0.03, () => {
    const w = 330, h = 120;
    x.fillStyle = '#0A0A0A'; x.strokeStyle = '#2a2a2a'; x.lineWidth = 6;
    x.beginPath(); x.roundRect(-w / 2, -h / 2, w, h, 14); x.fill(); x.stroke();
    x.font = '700 82px Orbitron, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.shadowColor = '#FF1A1A'; x.shadowBlur = 18; x.fillStyle = '#FF1A1A';
    x.fillText('CASH', 0, 6); x.fillText('CASH', 0, 6);
  });

  // эмодзи-стикеры
  img(assets.bag, 0.02, 0.97, 0.05, 0.9);
  img(assets.grin, -0.9, -0.95, -0.12, 0.85);
  img(assets.money, 0.42, 0.2, 0.2, 0.75);
  img(assets.frog, -0.62, -0.97, 0.08, 0.9);
  img(assets.cat, 0.93, -0.9, -0.1, 0.8);

  // каракули маркером
  at(-0.05, -0.02, -diag, () => {
    marker(x, 'АБУЗИЩЕ', 170, { align: 'center' });
    stroke(x, [[-420, 92], [380, 92], [350, 70], [380, 92], [352, 114]], 9);
  });
  at(0.52, 0.56, -0.12, () => {
    marker(x, '100%', 120);
    stroke(x, [[-30, 70], [-150, 150], [-128, 112], [-150, 150], [-110, 146]], 8);
  });
  at(0.8, 1.13, 0, () => {
    const pts = []; for (let i = 0; i <= 8; i++) pts.push([i * 30, i % 2 ? -26 : 26]);
    stroke(x, pts, 8);
  });
  at(-0.18, -1.12, -0.03, () => marker(x, '@zarabotay_info', 96, { align: 'center' }));
  at(-0.78, 0.18, -0.25, () => marker(x, '→', 140));

  return c;
}

function paintEmissive(mirror) {        // светится только табло CASH
  const c = document.createElement('canvas');
  c.width = TW / 2; c.height = TH / 2;
  const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
  const [a, b] = px(0.72, 0.9, mirror);
  x.translate(a / 2, b / 2); x.rotate(mirror ? 0.03 : -0.03);
  x.font = '700 41px Orbitron, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.shadowColor = '#FF1A1A'; x.shadowBlur = 10; x.fillStyle = '#FF1A1A';
  x.fillText('CASH', 0, 3);
  return c;
}

function paintSide() {                  // борта: тёмно-красный глянец + чёрная лаковая полоса
  const c = document.createElement('canvas');
  c.width = 64; c.height = 512;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, RED); g.addColorStop(0.3, '#B5141F'); g.addColorStop(0.7, '#B5141F'); g.addColorStop(1, RED);
  x.fillStyle = g; x.fillRect(0, 0, 64, 512);
  x.fillStyle = '#060606'; x.fillRect(0, 512 * 0.34, 64, 512 * 0.32);
  x.fillStyle = 'rgba(255,255,255,.3)'; x.fillRect(0, 512 * 0.36, 64, 3);
  return c;
}

function dropsNormal(n, seed) {         // капли воды — карта нормалей
  const S = 1024, d = new Uint8ClampedArray(S * S * 4);
  for (let i = 0; i < S * S; i++) { d[i * 4] = 128; d[i * 4 + 1] = 128; d[i * 4 + 2] = 255; d[i * 4 + 3] = 255; }
  let r0 = seed;
  const rnd = () => ((r0 = (r0 * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < n; k++) {
    const cx = rnd() * S, cy = rnd() * S;
    const big = rnd();
    const r = big > 0.9 ? 9 + rnd() * 9 : 3 + rnd() * 5;
    const sy = 1 + (big > 0.9 ? rnd() * 0.5 : 0);         // крупные чуть вытянуты вниз
    for (let y = -r * sy; y <= r * sy; y++) for (let xx = -r; xx <= r; xx++) {
      const nx = xx / r, ny = y / (r * sy), q = nx * nx + ny * ny;
      if (q > 1) continue;
      const nz = Math.sqrt(1 - q);
      const X = ((Math.round(cx + xx) % S) + S) % S, Y = ((Math.round(cy + y) % S) + S) % S;
      const o = (Y * S + X) * 4;
      d[o] = (nx * 0.5 + 0.5) * 255; d[o + 1] = (-ny * 0.5 + 0.5) * 255; d[o + 2] = (nz * 0.5 + 0.5) * 255;
    }
  }
  const c = document.createElement('canvas');
  c.width = c.height = S;
  c.getContext('2d').putImageData(new ImageData(d, S, S), 0, 0);
  return c;
}

/* ── студийное окружение (софтбоксы) ───────────────────────────────── */
function studio(renderer) {
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(12, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0x030303, side: THREE.BackSide })));
  const box = (w, h, pos, k, color = 0xffffff) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    m.material.color.multiplyScalar(k);
    m.position.set(...pos); m.lookAt(0, 0, 0); env.add(m);
  };
  // мелкие софтбоксы: на плоской грани почти везде отражается чёрное,
  // а блики проходят полосами при вращении — красный остаётся красным
  box(6, 0.5, [0, 5, 1], 9);             // верхняя полоса
  box(0.35, 3.5, [3, 0.5, 4.5], 7);      // вертикальный стрип справа спереди
  box(0.3, 3, [-3.5, 1, 4], 3);          // и слева спереди
  box(1, 2, [-5, 2, 0], 3);              // боковой
  box(2, 0.8, [-1, -5, 2], 1.2, 0xffd9c4); // тёплый снизу
  box(2, 2, [0, 0, -5.5], 1.2, 0xff6a6a);  // красный контровой
  // россыпь точечных ламп: на них блестят капли и фаски
  let r0 = 11;
  const rnd = () => ((r0 = (r0 * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 26; i++) {
    const th = rnd() * Math.PI * 2, ph = Math.acos(rnd() * 1.6 - 0.6);
    box(0.22, 0.22, [5.4 * Math.sin(ph) * Math.cos(th), 5.4 * Math.cos(ph), 5.4 * Math.sin(ph) * Math.sin(th) + 1.5], 16);
  }
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(env, 0.035).texture;
  pm.dispose();
  return tex;
}

/* ── пиксельная «Z» из кубиков ─────────────────────────────────────── */
const PIX = [
  '.XXXXXXX.',
  'XXXXXXXXX',
  'XX....XXX',
  '.....XXX.',
  '....XXX..',
  '..XXXX...',
  '.XXX.....',
  'XXXXXXXXX',
  'XXXXXXXXX'
];
function pixelZ(envMap) {
  const cells = [];
  PIX.forEach((row, j) => [...row].forEach((ch, i) => ch === 'X' && cells.push([i, j])));
  const s = 0.155;
  const geo = new THREE.BoxGeometry(s * 0.98, s * 0.98, s * 1.1);
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#CE1F2B'), roughness: 0.32, metalness: 0.05,
    clearcoat: 0.6, clearcoatRoughness: 0.2, envMap, envMapIntensity: 0.8
  });
  const mesh = new THREE.InstancedMesh(geo, mat, cells.length);
  const m = new THREE.Matrix4();
  cells.forEach(([i, j], n) => {
    m.makeTranslation((i - 4) * s, (4 - j) * s, 0);
    mesh.setMatrixAt(n, m);
  });
  return mesh;
}

/* ── сборка сцены ──────────────────────────────────────────────────── */
async function boot() {
  await Promise.all([
    document.fonts.load('700 80px Caveat', 'АБУЗИЩЕ@'),
    document.fonts.load('700 80px Orbitron', 'CASH'),
    document.fonts.load('800 80px Inter', '5000 ПЯТЬ')
  ]).catch(() => {});

  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: true, premultipliedAlpha: true,
    preserveDrawingBuffer: STILL, powerPreference: 'high-performance'
  });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  const env = studio(renderer);

  const assets = {
    note1: banknote(560, 260, 1), note2: banknote(620, 290, 2),
    note3: banknote(540, 250, 3), note4: banknote(480, 220, 4),
    code: barcode(260, 120),
    bag: emojiSticker('💰', 150), grin: emojiSticker('😁', 140),
    money: emojiSticker('🤑', 150), frog: emojiSticker('🐸', 150), cat: lemonCat(150)
  };
  const ctex = (c, srgb = true) => {
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return t;
  };
  const drops = ctex(dropsNormal(760, 7), false);
  drops.wrapS = drops.wrapT = THREE.RepeatWrapping; drops.repeat.set(1.6, 1.6);
  const dropsSide = drops.clone(); dropsSide.repeat.set(3, 0.6); dropsSide.needsUpdate = true;

  const capMat = (mirror) => new THREE.MeshPhysicalMaterial({
    map: ctex(paintCap(mirror, assets)),
    emissiveMap: ctex(paintEmissive(mirror)), emissive: 0xffffff, emissiveIntensity: 1.6,
    roughness: 0.15, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05,
    normalMap: drops, normalScale: new THREE.Vector2(0.35, 0.35),
    clearcoatNormalMap: drops, clearcoatNormalScale: new THREE.Vector2(1, 1),
    envMap: env, envMapIntensity: 1
  });
  const sideTex = ctex(paintSide());
  sideTex.wrapS = THREE.RepeatWrapping;
  const sideMat = new THREE.MeshPhysicalMaterial({
    map: sideTex, roughness: 0.15, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05,
    clearcoatNormalMap: dropsSide, clearcoatNormalScale: new THREE.Vector2(0.9, 0.9),
    envMap: env, envMapIntensity: 1
  });
  const letter = new THREE.Mesh(zGeometry(), [capMat(false), sideMat, capMat(true)]);


  const key = new THREE.DirectionalLight(0xffffff, 1.25); key.position.set(3, 4, 6);
  const rim = new THREE.DirectionalLight(0xff8a8a, 1.2); rim.position.set(-4, 2, -4);
  scene.add(key, rim, new THREE.AmbientLight(0xffffff, 0.3));

  const tilt = new THREE.Group();        // наклонённая ось вращения
  tilt.rotation.set(0.16, 0, -0.1);
  const spin = new THREE.Group();
  spin.add(letter); tilt.add(spin);
  const rig = new THREE.Group();         // пролёт к камере
  rig.add(tilt); scene.add(rig);

  const pix = pixelZ(env);
  const pixRig = new THREE.Group();
  pixRig.add(pix); pixRig.position.set(1.5, 1.05, -1.5); scene.add(pixRig);

  /* размеры: буква ≈ 80 % высоты сцены; на узком экране — 70 % ширины */
  let w = 0, h = 0;
  function resize() {
    // кадр-подложка всегда 3:2 (1800×1200), как <img class="stage__still">
    const r = STILL ? { width: 900, height: 600 } : canvas.getBoundingClientRect();
    if (!r.width || !r.height || (r.width === w && r.height === h)) return;
    w = r.width; h = r.height;
    renderer.setPixelRatio(STILL ? 2 : Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const k = 0.8;                                            // доля высоты под букву
    const fitH = (2 * Z.H) / (k * 2 * t);
    const fitW = (2 * Z.W) / (0.62 * 2 * t * camera.aspect);  // на узком — ~70 % ширины с учётом ракурса
    camera.position.set(0, 0, Math.max(fitH, fitW));
    camera.updateProjectionMatrix();
    // на узком экране пиксельная буква ближе к главной, иначе уходит за край
    const narrow = camera.aspect < 1.2;
    pixRig.position.set(narrow ? 0.95 : 1.5, narrow ? 1.3 : 1.05, narrow ? -1.7 : -1.5);
    pixRig.scale.setScalar(narrow ? 0.75 : 1);
  }

  const DEG = Math.PI / 180;
  function pose(p) {                    // p ∈ [0,1) — фаза цикла
    spin.rotation.y = p * Math.PI * 2 - 2.69;                // в середине цикла — лицом, ¾ на p≈0,33
    spin.rotation.x = Math.sin(p * Math.PI * 4) * 8 * DEG;   // «кивок»
    const fly = Math.exp(-Math.pow((p - 0.5) / 0.085, 2));    // пролёт в середине цикла
    rig.scale.setScalar(1 + 0.8 * fly);
    rig.position.set(-0.1 * fly, 0.12 * fly, 0.9 * fly);
    pixRig.rotation.set(0.1 * Math.sin(p * Math.PI * 2), -0.15 + 0.2 * Math.sin(p * Math.PI * 2 + 1), -0.06);
  }
  const STILL_P = 0.333;                // кадр ¾: лицевая грань под углом ~35°

  resize();
  addEventListener('resize', resize);
  new ResizeObserver(resize).observe(canvas);

  // фаза стартует с ¾-ракурса, чтобы первый кадр совпадал с картинкой-подложкой
  let phase = STILL_P, last = 0, running = false, visible = true, raf = 0;
  const frames = [];

  function frame(now) {
    raf = 0;
    if (!running) return;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    phase = (phase + dt / CYCLE) % 1;
    pose(phase);
    renderer.render(scene, camera);
    if (dt) { frames.push(dt); if (frames.length === 90) checkPerf(); }
    raf = requestAnimationFrame(frame);
  }
  function checkPerf() {                // слабое устройство — оставляем картинку
    const avg = frames.reduce((a, b) => a + b, 0) / frames.length;
    if (avg > 0.045) { stop(); root.classList.add('no-webgl'); }
  }
  function drawStill() { pose(STILL_P); renderer.render(scene, camera); }
  function start() {
    if (running || root.classList.contains('no-webgl')) return;
    running = true; last = 0; raf = requestAnimationFrame(frame);
  }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
  function sync() {
    const off = root.classList.contains('motion-off');
    if (off || !visible || document.hidden) { stop(); if (off) { phase = STILL_P; drawStill(); } }
    else start();
  }

  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); stop(); root.classList.add('no-webgl'); });
  document.addEventListener('visibilitychange', sync);
  document.addEventListener('motionchange', sync);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); }).observe(stage);

  drawStill();
  root.classList.add('gl-ready');
  if (STILL) {
    window.__zStill = canvas.toDataURL('image/png');
    return;
  }
  sync();
}

function webgl() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); }
  catch (e) { return false; }
}

if (stage && canvas && webgl()) {
  boot().catch(err => { console.error(err); root.classList.add('no-webgl'); });
} else {
  root.classList.add('no-webgl');
}
