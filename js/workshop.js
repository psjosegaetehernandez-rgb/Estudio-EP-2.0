/* Estudio EP — Modo taller: la sesión en pantalla completa, pensada para el celular durante el taller.
   Muestra el momento actual en grande, cuánto tiempo le queda, qué viene después, y deja sacar fotos
   que quedan guardadas en la sesión. La pantalla no se apaga mientras está abierto (si el navegador lo permite).
   Si se cierra o se recarga, vuelve al mismo momento con el reloj corriendo. */
window.EP = window.EP || {};

(() => {
  const F = () => EP.F;
  const LS = 'ep2_runner';
  const loadRun = () => { try { return JSON.parse(localStorage.getItem(LS)) || null; } catch (e) { return null; } };
  const saveRun = (r) => { try { localStorage.setItem(LS, JSON.stringify(r)); } catch (e) { /* opcional */ } };
  const mmss = (ms) => { const neg = ms < 0; const t = Math.round(Math.abs(ms) / 1000); return (neg ? '+' : '') + String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); };

  let root = null, tick = null, lock = null, run = null, buzzed = false;

  // Tiempo transcurrido en el momento actual. En pausa queda congelado en pausedAt.
  const elapsed = () => !run ? 0 : run.paused ? (run.pausedAt || 0) : Date.now() - run.start;
  const phaseMs = (s) => (Number((s.phases[run.idx] || {}).minutes) || 0) * 60000;

  const keepAwake = async () => { try { if ('wakeLock' in navigator) lock = await navigator.wakeLock.request('screen'); } catch (e) { lock = null; } };

  EP.workshop = {
    isOpen: () => !!root,
    state: () => run,
    open() {
      const s = EP.state.session;
      if (!s || root) return;
      if (!s.phases.length) { EP.ui.toast('Agrega al menos un momento a la sesión.', 'info'); return; }
      const prev = loadRun();
      run = prev && prev.sid === s.id && prev.idx < s.phases.length ? prev : { sid: s.id, idx: 0, start: Date.now(), paused: true, pausedAt: 0 };
      buzzed = false;
      saveRun(run);
      root = EP.el('div', 'runner');
      root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Modo taller: ' + s.name);
      document.body.appendChild(root);
      document.body.classList.add('runner-open');
      keepAwake();
      document.addEventListener('visibilitychange', onVis);
      document.addEventListener('keydown', onKey);
      EP.workshop.paint();
      tick = setInterval(EP.workshop.paintClock, 500);
    },
    close() {
      clearInterval(tick); tick = null;
      try { if (lock) lock.release(); } catch (e) { /* ya liberado */ } lock = null;
      document.removeEventListener('visibilitychange', onVis);
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('runner-open');
      if (root) root.remove(); root = null;
      EP.ui.renderCenter();
    },
    go(d) {
      const s = EP.state.session;
      if (!run || !root || !s) return;
      const ni = run.idx + d;
      if (ni < 0) return;
      if (ni >= s.phases.length) { EP.workshop.finish(); return; }
      run.idx = ni; run.start = Date.now(); run.pausedAt = 0; run.paused = false; buzzed = false;
      saveRun(run); EP.workshop.paint();
    },
    toggle() {
      if (!run || !root) return;
      if (run.paused) { run.start = Date.now() - (run.pausedAt || 0); run.paused = false; }
      else { run.pausedAt = elapsed(); run.paused = true; }
      saveRun(run); EP.workshop.paint();
    },
    finish() {
      try { localStorage.removeItem(LS); } catch (e) { /* opcional */ }
      run = null;
      EP.workshop.close();
      EP.ui.toast('Terminó la sesión. ¡Buen taller!', 'ok');
    },
    paintClock() {
      if (!root || !run) return;
      const s = EP.state.session;
      const left = phaseMs(s) - elapsed();
      const clock = root.querySelector('.run-clock');
      if (clock) {
        clock.textContent = mmss(left);
        clock.classList.toggle('over', left < 0);
        clock.classList.toggle('soon', left >= 0 && left < 60000);
      }
      const bar = root.querySelector('.run-bar i');
      if (bar) bar.style.width = Math.min(100, Math.max(0, elapsed() / (phaseMs(s) || 1) * 100)) + '%';
      if (left < 0 && !buzzed && !run.paused) { buzzed = true; try { navigator.vibrate && navigator.vibrate([300, 150, 300]); } catch (e) { /* opcional */ } }
    },
    paint() {
      if (!root) return;
      const s = EP.state.session, f = s.phases[run.idx] || {};
      root.replaceChildren();
      const head = EP.el('div', 'run-head');
      const t = EP.el('div', 'run-title');
      const n = EP.el('strong'); n.textContent = s.name;
      const c = EP.el('span'); c.textContent = `Momento ${run.idx + 1} de ${s.phases.length} · ${EP.sessions.totalMinutes(s)} min en total`;
      t.append(n, c);
      const x = F().btn('', 'fa-xmark', EP.workshop.close, 'icon run-x'); x.setAttribute('aria-label', 'Salir del modo taller'); x.title = 'Salir';
      head.append(t, x);

      const main = EP.el('div', 'run-main');
      const ttl = EP.el('h2', 'run-phase'); ttl.textContent = f.title || 'Momento ' + (run.idx + 1);
      const clock = EP.el('div', 'run-clock'); clock.setAttribute('aria-live', 'off');
      const bar = EP.el('div', 'run-bar'); bar.appendChild(EP.el('i'));
      const mins = EP.el('p', 'run-mins'); mins.textContent = (Number(f.minutes) || 0) + ' min para este momento' + (run.paused ? ' · en pausa' : '');
      main.append(ttl, clock, bar, mins);
      if (f.activity) { const a = EP.el('p', 'run-act'); a.textContent = f.activity; main.appendChild(a); }
      if (f.materials) { const m = EP.el('p', 'run-mat'); m.textContent = 'Materiales: ' + f.materials; main.appendChild(m); }
      const next = s.phases[run.idx + 1];
      const nx = EP.el('p', 'run-next'); nx.textContent = next ? 'Después: ' + (next.title || 'Momento ' + (run.idx + 2)) + ' (' + (Number(next.minutes) || 0) + ' min)' : 'Este es el último momento.';
      main.appendChild(nx);

      const ctrls = EP.el('div', 'run-ctrls');
      const back = F().btn('Anterior', 'fa-backward-step', () => EP.workshop.go(-1), 'run-btn'); back.disabled = run.idx === 0;
      const play = F().btn(run.paused ? (elapsed() > 0 ? 'Seguir' : 'Empezar') : 'Pausa', run.paused ? 'fa-play' : 'fa-pause', EP.workshop.toggle, 'run-btn primary');
      const fw = F().btn(next ? 'Siguiente' : 'Terminar', next ? 'fa-forward-step' : 'fa-flag-checkered', () => EP.workshop.go(1), 'run-btn');
      ctrls.append(back, play, fw);

      const foot = EP.el('div', 'run-foot');
      const cam = EP.el('input'); cam.type = 'file'; cam.accept = 'image/*'; cam.setAttribute('capture', 'environment'); cam.hidden = true;
      cam.addEventListener('change', async () => {
        if (!cam.files.length) return;
        await EP.sessions.addImages(cam.files, (f.title || 'Momento ' + (run.idx + 1)));
        cam.value = '';
        EP.workshop.paint();
      });
      const photo = F().btn('Sacar foto', 'fa-camera', () => cam.click(), 'run-btn ghost');
      const count = EP.el('span', 'run-count'); count.textContent = s.images.length ? s.images.length + ' foto' + (s.images.length > 1 ? 's' : '') + ' en la sesión' : '';
      foot.append(photo, cam, count);
      if (s.closing && !next) { const cl = EP.el('p', 'run-close'); cl.textContent = 'Preguntas de cierre: ' + s.closing; main.appendChild(cl); }

      root.append(head, main, ctrls, foot);
      EP.workshop.paintClock();
      play.focus();
    }
  };
  const onVis = () => { if (document.visibilityState === 'visible' && root) { keepAwake(); EP.workshop.paintClock(); } };
  const onKey = (e) => {
    if (!root) return;
    if (e.key === 'Escape') { e.preventDefault(); EP.workshop.close(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); EP.workshop.go(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); EP.workshop.go(-1); }
    else if (e.key === ' ' && document.activeElement && document.activeElement.tagName !== 'BUTTON') { e.preventDefault(); EP.workshop.toggle(); }
  };
})();
