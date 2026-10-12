/* Поведение страницы: пауза анимации, ленивая загрузка 3D-буквы,
   параллакс вырезок, счётчики, LED-табло, наклон карточек.
   Пауза (WCAG 2.2.2) — html.motion-off: стартовое значение ставит
   скрипт в <head> (сохранённый выбор или prefers-reduced-motion). */
(function () {
  var root = document.documentElement;
  var KEY = 'zarabotay:motion';
  var btn = document.getElementById('motion');
  var reduce = matchMedia('(prefers-reduced-motion: reduce)');
  var fine = matchMedia('(hover: hover) and (pointer: fine)');
  var wide = matchMedia('(min-width: 761px)');
  var letterSrc = new URL('letter.js', document.currentScript.src).href;
  var letterLoaded = false;

  function off() { return root.classList.contains('motion-off'); }
  function saved() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }

  function loadLetter() {
    if (letterLoaded || off()) return;
    letterLoaded = true;
    import(letterSrc).catch(function () { root.classList.add('no-webgl'); });
  }

  function setMotion(isOff, remember) {
    root.classList.toggle('motion-off', isOff);
    btn.setAttribute('aria-pressed', String(isOff));
    if (remember) { try { localStorage.setItem(KEY, isOff ? 'off' : 'on'); } catch (e) { /* приватный режим */ } }
    document.dispatchEvent(new Event('motionchange'));
  }

  btn.setAttribute('aria-pressed', String(off()));
  btn.addEventListener('click', function () { setMotion(!off(), true); });
  reduce.addEventListener('change', function (e) { if (!saved()) setMotion(e.matches, false); });

  /* ── вырезки балансов: параллакс и «вспышки» сумм ── */
  var chips = document.getElementById('chips');
  var flash = chips ? chips.querySelectorAll('.chip--flash') : [];
  var flashTimer = 0, flashI = 0, pmRaf = 0, mx = 0, my = 0;

  function onPointer(e) {
    mx = (e.clientX / innerWidth) * 2 - 1;
    my = (e.clientY / innerHeight) * 2 - 1;
    if (!pmRaf) pmRaf = requestAnimationFrame(function () {
      pmRaf = 0;
      chips.style.setProperty('--mx', mx.toFixed(3));
      chips.style.setProperty('--my', my.toFixed(3));
    });
  }
  function syncChips() {
    var live = !off() && wide.matches;
    if (live && fine.matches) addEventListener('pointermove', onPointer, { passive: true });
    else {
      removeEventListener('pointermove', onPointer);
      if (chips) { chips.style.setProperty('--mx', 0); chips.style.setProperty('--my', 0); }
    }
    clearInterval(flashTimer);
    flash.forEach(function (el, i) { el.classList.toggle('is-on', i === 0); });
    flashI = 0;
    if (live && flash.length > 1) {
      flashTimer = setInterval(function () {
        flashI = (flashI + 1) % flash.length;
        flash.forEach(function (el, i) { el.classList.toggle('is-on', i === flashI); });
      }, 2400);
    }
  }

  /* ── счётчики: в HTML уже финальные числа; анимируем только при движении ── */
  var easeOutExpo = function (t) { return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); };
  function fmt(n) { return Math.round(n).toLocaleString('ru-RU'); }
  function roll(el, to, ms, suffix) {
    var t0 = performance.now();
    function step(now) {
      if (off()) { el.textContent = fmt(to) + suffix; return; }
      var p = Math.min(1, (now - t0) / ms);
      el.textContent = fmt(to * easeOutExpo(p)) + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  var counters = [].slice.call(document.querySelectorAll('[data-count]'));
  var led = document.getElementById('led');
  if ('IntersectionObserver' in window && !off()) {
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
    document.addEventListener('motionchange', function () {
      if (!off()) return;
      // пауза посреди набегания — сразу финальные значения
      counters.forEach(function (el) { el.textContent = fmt(+el.dataset.count) + (el.dataset.suffix || ''); });
      if (led) led.textContent = fmt(+led.dataset.to);
    });
  }

  /* ── карточки программы: лёгкий наклон под курсором (±4°) ── */
  document.querySelectorAll('.card').forEach(function (card) {
    card.addEventListener('pointermove', function (e) {
      if (off() || !fine.matches || reduce.matches) return;
      var r = card.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      card.style.setProperty('--ry', (x * 8).toFixed(2) + 'deg');
      card.style.setProperty('--rx', (-y * 8).toFixed(2) + 'deg');
    });
    card.addEventListener('pointerleave', function () {
      card.style.removeProperty('--rx'); card.style.removeProperty('--ry');
    });
  });

  document.addEventListener('motionchange', function () { syncChips(); loadLetter(); });
  wide.addEventListener('change', syncChips);
  fine.addEventListener('change', syncChips);
  syncChips();
  loadLetter();
})();
