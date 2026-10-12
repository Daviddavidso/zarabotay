/* Поведение страницы: набегание счётчиков, LED-табло, наклон карточек.
   Всё короче 5 секунд или только по наведению; при prefers-reduced-motion
   числа сразу финальные (они и так стоят в HTML), наклона нет. */
(function () {
  var reduce = matchMedia('(prefers-reduced-motion: reduce)');
  var fine = matchMedia('(hover: hover) and (pointer: fine)');

  /* ── счётчики: в HTML уже финальные числа; анимируем только при движении ── */
  var easeOutExpo = function (t) { return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); };
  function fmt(n) { return Math.round(n).toLocaleString('ru-RU'); }
  function roll(el, to, ms, suffix) {
    var t0 = performance.now();
    function step(now) {
      var p = Math.min(1, (now - t0) / ms);
      el.textContent = fmt(to * easeOutExpo(p)) + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  var counters = [].slice.call(document.querySelectorAll('[data-count]'));
  var led = document.getElementById('led');
  if ('IntersectionObserver' in window && !reduce.matches) {
    counters.forEach(function (el) { el.textContent = '0' + (el.dataset.suffix || ''); });
    if (led) led.textContent = '0';
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        if (e.target === led) roll(led, +led.dataset.to, 1600, '');
        else roll(e.target, +e.target.dataset.count, 1200, e.target.dataset.suffix || '');
      });
    }, { threshold: 0.6 });
    counters.concat(led ? [led] : []).forEach(function (el) { io.observe(el); });
  }

  /* ── карточки программы: лёгкий наклон под курсором (±4°) ── */
  document.querySelectorAll('.card').forEach(function (card) {
    card.addEventListener('pointermove', function (e) {
      if (!fine.matches || reduce.matches) return;
      var r = card.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      card.style.setProperty('--ry', (x * 8).toFixed(2) + 'deg');
      card.style.setProperty('--rx', (-y * 8).toFixed(2) + 'deg');
    });
    card.addEventListener('pointerleave', function () {
      card.style.removeProperty('--rx'); card.style.removeProperty('--ry');
    });
  });
})();
