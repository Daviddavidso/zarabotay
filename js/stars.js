/* Звёздное небо под всей страницей: один фиксированный холст.
   ~1 звезда на 500 px², 90 % кремовые #FDF9CB, редкие голубые #71C3F9.
   Дрейф 2–4 px/с, мерцание прозрачности 0,6–1. На паузе (кнопка или «уменьшить
   движение» — класс html.motion-off) — неподвижный кадр. */
(function () {
  const cvs = document.getElementById('stars');
  if (!cvs) return;
  const ctx = cvs.getContext('2d');
  let W = 0, H = 0, dpr = 1, stars = [], last = 0, timer = 0;

  function build() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cvs.width = Math.round(W * dpr); cvs.height = Math.round(H * dpr);
    const n = Math.round((W * H) / 500);
    stars = [];
    for (let i = 0; i < n; i++) {
      const big = Math.random();
      stars.push({
        x: Math.random() * W, y: Math.random() * H,
        r: big > 0.985 ? 1.5 : big > 0.9 ? 1 : 0.5,          // 1–3 px в диаметре
        a: 0.25 + Math.random() * 0.75,                         // базовая яркость
        tw: Math.random() * Math.PI * 2, ts: 0.6 + Math.random() * 1.8,
        vx: -(2 + Math.random() * 2) * 0.4, vy: (2 + Math.random() * 2) * 0.3,
        c: Math.random() < 0.97 ? '253,249,203' : '113,195,249'
      });
    }
    draw(0, true);
  }

  function draw(t, still) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    for (const s of stars) {
      const tw = still ? 0.85 : 0.8 + 0.2 * Math.sin(s.tw + t * s.ts);   // 0,6…1
      ctx.fillStyle = 'rgba(' + s.c + ',' + (s.a * tw).toFixed(3) + ')';
      ctx.fillRect(s.x - s.r, s.y - s.r, s.r * 2, s.r * 2);
    }
  }

  function paused() { return document.documentElement.classList.contains('motion-off'); }

  function tick(now) {
    const t = now / 1000, dt = Math.min(0.5, last ? t - last : 0);
    last = t;
    for (const s of stars) {
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.x < -2) s.x += W + 4; if (s.y > H + 2) s.y -= H + 4;
    }
    draw(t, false);
    schedule();
  }
  function schedule() {
    if (paused()) { last = 0; draw(0, true); return; }
    // в скрытой вкладке rAF спит — таймер держит время честным
    if (document.hidden) timer = setTimeout(() => tick(performance.now()), 250);
    else requestAnimationFrame(tick);
  }

  addEventListener('resize', () => { clearTimeout(timer); build(); });
  document.addEventListener('visibilitychange', () => { clearTimeout(timer); last = 0; schedule(); });
  document.addEventListener('motionchange', () => { clearTimeout(timer); last = 0; schedule(); });
  build(); schedule();
})();
