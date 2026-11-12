/* Estudio EP — interfaz: panel izquierdo (crear), centro (mesa / vista de impresión), panel derecho (editar). */
window.EP = window.EP || {};

const $ = (s, r = document) => r.querySelector(s);
const KIND_NAME = { card: 'Carta', token: 'Ficha', board: 'Tablero' };
const KIND_ICON = { card: 'fa-clone', token: 'fa-circle-dot', board: 'fa-chess-board' };

/* ================== Pequeño kit de formularios ==================
   Cada control lleva data-path ("@.title" = cara actual, "item.w", "print.margin", "info.rules")
   y un único listener delegado guarda el valor. Los valores se asignan por propiedad, nunca por HTML. */
const F = {
  section(title, icon, open = true) {
    const d = EP.el('details', 'sec');
    d.open = open;
    const s = EP.el('summary');
    if (icon) s.appendChild(EP.el('i', 'fa-solid ' + icon));
    s.appendChild(document.createTextNode(title));
    d.appendChild(s);
    const body = EP.el('div', 'sec-body');
    d.appendChild(body);
    return { el: d, body };
  },
  field(label, control, hint) {
    const w = EP.el('label', 'field');
    const l = EP.el('span', 'field-label');
    l.textContent = label;
    w.append(l, control);
    if (hint) { const h = EP.el('span', 'field-hint'); h.textContent = hint; w.appendChild(h); }
    return w;
  },
  input(path, type = 'text', attrs = {}) {
    const i = EP.el('input');
    i.type = type;
    i.dataset.path = path;
    Object.entries(attrs).forEach(([k, v]) => i.setAttribute(k, v));
    i.value = F.get(path) ?? '';
    if (type === 'checkbox') i.checked = !!F.get(path);
    return i;
  },
  num(path, min, max, step = 1, unit) {
    const wrap = EP.el('span', 'num');
    const i = F.input(path, 'number', { min, max, step });
    wrap.appendChild(i);
    if (unit) { const u = EP.el('span', 'unit'); u.textContent = unit; wrap.appendChild(u); }
    return wrap;
  },
  range(path, min, max, step = 1, unit = '') {
    const wrap = EP.el('span', 'range');
    const i = F.input(path, 'range', { min, max, step });
    const out = EP.el('output');
    out.textContent = i.value + unit;
    i.addEventListener('input', () => { out.textContent = i.value + unit; });
    wrap.append(i, out);
    return wrap;
  },
  color(path) {
    const i = F.input(path, 'color');
    i.className = 'color';
    return i;
  },
  area(path, rows = 3, ph = '') {
    const t = EP.el('textarea');
    t.rows = rows;
    t.dataset.path = path;
    t.placeholder = ph;
    t.value = F.get(path) ?? '';
    return t;
  },
  select(path, options, rerender = false) {
    const s = EP.el('select');
    s.dataset.path = path;
    if (rerender) s.dataset.rerender = '1';
    Object.entries(options).forEach(([v, t]) => { const o = EP.el('option'); o.value = v; o.textContent = t; s.appendChild(o); });
    s.value = F.get(path);
    return s;
  },
  seg(path, options, rerender = false) {
    const w = EP.el('div', 'seg');
    w.setAttribute('role', 'radiogroup');
    const cur = String(F.get(path));
    Object.entries(options).forEach(([v, t]) => {
      const b = EP.el('button', 'seg-btn' + (String(v) === cur ? ' on' : ''));
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(v) === cur);
      if (t.startsWith('fa-')) { b.appendChild(EP.el('i', 'fa-solid ' + t)); b.title = v; b.setAttribute('aria-label', v); }
      else b.textContent = t;
      b.addEventListener('click', () => {
        F.set(path, isNaN(v) || v === '' ? v : Number(v));
        w.querySelectorAll('.seg-btn').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b); });
        EP.commit({ editor: rerender, structure: false });
      });
      w.appendChild(b);
    });
    return w;
  },
  check(path, label) {
    const w = EP.el('label', 'check');
    const i = F.input(path, 'checkbox');
    const s = EP.el('span'); s.textContent = label;
    w.append(i, s);
    return w;
  },
  btn(label, icon, fn, cls = '') {
    const b = EP.el('button', 'btn ' + cls);
    b.type = 'button';
    if (icon) b.appendChild(EP.el('i', 'fa-solid ' + icon));
    if (label) b.appendChild(document.createTextNode(label));
    b.addEventListener('click', fn);
    return b;
  },
  row(...els) { const r = EP.el('div', 'row'); r.append(...els); return r; },
  p(text, cls = 'help') { const e = EP.el('p', cls); e.textContent = text; return e; },
  root(path) {
    const st = EP.state, it = EP.sel();
    const [head, ...rest] = path.split('.');
    const obj = head === '@' ? it && it[st.side] : head === 'item' ? it : head === 'print' ? st.project.print
      : head === 'info' ? st.project.info : head === 'project' ? st.project : null;
    return { obj, keys: rest };
  },
  get(path) {
    let { obj, keys } = F.root(path);
    for (const k of keys) { if (obj == null) return undefined; obj = obj[k]; }
    return obj;
  },
  set(path, value) {
    let { obj, keys } = F.root(path);
    if (!obj) return;
    for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
    obj[keys[keys.length - 1]] = value;
  }
};
EP.F = F;

/* Listener único para todos los controles con data-path */
const onField = (e) => {
  const t = e.target;
  if (!t.dataset || !t.dataset.path) return;
  let v = t.type === 'checkbox' ? t.checked : t.value;
  if (t.type === 'number' || t.type === 'range') {
    if (t.value === '') return;
    v = Number(t.value);
    if (t.min !== '' && v < Number(t.min)) v = Number(t.min);
    if (t.max !== '' && v > Number(t.max)) v = Number(t.max);
  }
  if (t.tagName === 'SELECT' && t.dataset.num) v = Number(v);
  F.set(t.dataset.path, v);
  const structural = t.dataset.path.startsWith('project.name') || t.dataset.path === 'item.name';
  EP.commit({ editor: e.type === 'change' && !!t.dataset.rerender });
  if (structural) EP.ui.renderTop();
};

/* ================== UI ================== */
EP.ui = {
  init() {
    document.addEventListener('input', onField);
    document.addEventListener('change', (e) => { if (e.target.tagName === 'SELECT' || e.target.type === 'checkbox') onField(e); });

    $('#rail').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tab]');
      if (!b) return;
      const was = EP.state.tab;
      EP.state.tab = b.dataset.tab;
      EP.ui.renderLeft();
      // La pestaña Sesiones usa el centro para su planilla; al entrar o salir se redibuja
      if (was !== EP.state.tab && (was === 'sesiones' || EP.state.tab === 'sesiones')) EP.ui.renderCenter();
    });
    $('#undo').addEventListener('click', () => EP.historyGo(-1));
    $('#redo').addEventListener('click', () => EP.historyGo(1));
    $('#printBtn').addEventListener('click', EP.print);
    $('#aboutBtn').addEventListener('click', EP.ui.showAbout);
    $('#helpBtn').addEventListener('click', EP.ui.showWelcome);
    document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => {
      EP.state.view = b.dataset.view;
      EP.ui.renderTop();
      EP.ui.renderCenter();
    }));
    $('#gameName').addEventListener('input', (e) => {
      EP.state.project.name = e.target.value.slice(0, 120) || 'Juego sin nombre';
      EP.commit({});
      if (EP.state.tab === 'juegos') clearTimeout(EP._lt), EP._lt = setTimeout(EP.ui.renderLeft, 700);
    });

    document.addEventListener('keydown', (e) => {
      const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '');
      const mod = e.ctrlKey || e.metaKey;
      // En Sesiones los atajos del juego no aplican (el juego no está a la vista)
      if (EP.state.tab === 'sesiones') {
        if (mod && e.key.toLowerCase() === 'p') { e.preventDefault(); if (EP.state.session) EP.sessions.print(); }
        return;
      }
      if (mod && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); EP.historyGo(e.shiftKey ? 1 : -1); }
      else if (mod && e.key.toLowerCase() === 'y' && !typing) { e.preventDefault(); EP.historyGo(1); }
      else if (mod && e.key.toLowerCase() === 'p') { e.preventDefault(); EP.print(); }
      else if (mod && e.key.toLowerCase() === 'd' && EP.state.selectedId && !typing) { e.preventDefault(); EP.actions.duplicate(EP.state.selectedId); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && EP.state.selectedId && !typing) { e.preventDefault(); EP.actions.remove(EP.state.selectedId); }
      else if (e.key === 'Escape' && !typing && EP.state.selectedId) EP.actions.select(null);
    });

    // Pegar una imagen (Ctrl+V) la pone en el elemento seleccionado
    document.addEventListener('paste', (e) => {
      const it = EP.sel();
      const file = [...(e.clipboardData?.files || [])].find(f => f.type.startsWith('image/'));
      if (it && file) { e.preventDefault(); EP.actions.setImage(it, EP.state.side, file); }
    });
    window.addEventListener('resize', () => { clearTimeout(EP._rz); EP._rz = setTimeout(EP.ui.renderCenter, 150); });
  },

  renderAll() { delete $('#centerBar').dataset.print; EP.ui.renderTop(); EP.ui.renderLeft(); EP.ui.renderCenter(); EP.ui.renderEditor(); },

  renderTop() {
    const st = EP.state;
    const n = $('#gameName');
    if (document.activeElement !== n) n.value = st.project.name;
    document.querySelectorAll('[data-view]').forEach(b => {
      b.classList.toggle('on', b.dataset.view === st.view);
      b.setAttribute('aria-pressed', b.dataset.view === st.view);
    });
    document.title = `${st.project.name} · Estudio EP`;
  },

  updateUndo() {
    const h = EP.history;
    $('#undo').disabled = h.index <= 0;
    $('#redo').disabled = h.index >= h.stack.length - 1;
  },

  setStatus(text, bad) {
    const s = $('#saveStatus');
    s.textContent = text;
    s.classList.toggle('bad', !!bad);
  },

  toast(msg, type = 'info', action) {
    const box = $('#toasts');
    const t = EP.el('div', 'toast ' + type);
    t.setAttribute('role', 'status');
    const s = EP.el('span'); s.textContent = msg;
    t.appendChild(s);
    if (action) {
      const b = EP.el('button', 'toast-act'); b.type = 'button'; b.textContent = action.label;
      b.addEventListener('click', () => { action.fn(); t.remove(); });
      t.appendChild(b);
    }
    box.appendChild(t);
    setTimeout(() => t.classList.add('out'), action ? 6000 : 3200);
    setTimeout(() => t.remove(), action ? 6400 : 3600);
  },

  confirm(title, text, okLabel, danger) {
    return new Promise((res) => {
      const d = $('#dlg');
      const body = $('#dlgBody');
      body.replaceChildren();
      const h = EP.el('h2'); h.textContent = title;
      body.append(h, F.p(text, 'dlg-text'));
      const actions = EP.el('div', 'dlg-actions');
      actions.append(
        F.btn('Cancelar', null, () => { d.close(); res(false); }, 'ghost'),
        F.btn(okLabel, null, () => { d.close(); res(true); }, danger ? 'danger' : 'primary'));
      body.appendChild(actions);
      d.onclose = () => res(false);
      d.showModal();
    });
  },

  prompt(title, value, okLabel) {
    return new Promise((res) => {
      const d = $('#dlg'), body = $('#dlgBody');
      body.replaceChildren();
      const h = EP.el('h2'); h.textContent = title;
      const i = EP.el('input'); i.value = value || ''; i.className = 'dlg-input';
      const actions = EP.el('div', 'dlg-actions');
      const ok = () => { d.close(); res(i.value.trim() || null); };
      i.addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
      actions.append(F.btn('Cancelar', null, () => { d.close(); res(null); }, 'ghost'), F.btn(okLabel, null, ok, 'primary'));
      body.append(h, i, actions);
      d.onclose = () => res(null);
      d.showModal();
      i.select();
    });
  },

  showAbout() {
    const d = $('#dlg'), body = $('#dlgBody');
    body.replaceChildren();
    const h = EP.el('h2'); h.textContent = 'Estudio EP';
    body.append(h,
      F.p('Taller para crear cartas, fichas, tableros y juegos completos listos para imprimir en hoja carta.', 'dlg-text'),
      F.p('Idea, contenidos y estructura: Ps. José Luis Gaete.', 'dlg-text'),
      F.p('Desarrollo: Punta Digital.', 'dlg-text'),
      F.p(`Versión ${EP.APP_VERSION}. Tus juegos se guardan en este navegador. Descarga un respaldo de vez en cuando desde la pestaña Juegos.`, 'help'));
    const actions = EP.el('div', 'dlg-actions');
    actions.appendChild(F.btn('Cerrar', null, () => d.close(), 'primary'));
    body.appendChild(actions);
    d.showModal();
  },

  showWelcome() {
    const d = $('#dlg'), body = $('#dlgBody');
    body.replaceChildren();
    const h = EP.el('h2'); h.textContent = 'Cómo se usa';
    const ol = EP.el('ol', 'steps');
    [['Crea', 'En la columna izquierda elige qué hacer: cartas, tableros, fichas, o una plantilla del catálogo.'],
      ['Edita', 'Haz clic en una pieza de la mesa. A la derecha cambias textos, colores y subes la imagen del frente y del dorso.'],
      ['Revisa', 'Pasa a «Vista de impresión» para ver las hojas tal como saldrán, con sus dorsos.'],
      ['Imprime', 'Pulsa Imprimir. En el diálogo elige papel Carta, márgenes «Ninguno», escala 100 % y activa «Gráficos de fondo». Para dorsos, imprime a doble cara.']
    ].forEach(([t, x]) => { const li = EP.el('li'); const b = EP.el('strong'); b.textContent = t; li.append(b, document.createTextNode(x)); ol.appendChild(li); });
    body.append(h, ol, F.p('Si algo sale mal, Ctrl + Z deshace el último cambio. Todo se guarda solo.', 'help'));
    const actions = EP.el('div', 'dlg-actions');
    actions.appendChild(F.btn('Empezar', null, () => d.close(), 'primary'));
    body.appendChild(actions);
    d.showModal();
  },

  scrollToSelected() {
    requestAnimationFrame(() => {
      const el = document.querySelector('.piece.selected, .slot.selected');
      if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  },

  /* ================== Centro ================== */
  renderCenter() {
    cancelAnimationFrame(EP._rc);
    // En Sesiones se esconde lo que es solo del juego (editor, vistas, deshacer, imprimir juego)
    const app = document.querySelector('.app');
    if (app) app.classList.toggle('in-sessions', EP.state.tab === 'sesiones');
    EP._rc = requestAnimationFrame(() => (EP.state.tab === 'sesiones' ? EP.ui.renderSession()
      : EP.state.view === 'print' ? EP.ui.renderPreview() : EP.ui.renderMesa()));
  },

  renderMesa() {
    const st = EP.state, p = st.project;
    $('#mat').hidden = false;
    $('#preview').hidden = true;
    const bar = $('#centerBar');
    bar.replaceChildren();
    delete bar.dataset.print;
    const sideSeg = EP.el('div', 'seg small');
    [['front', 'Frente'], ['back', 'Dorso']].forEach(([v, t]) => {
      const b = EP.el('button', 'seg-btn' + (st.side === v ? ' on' : ''));
      b.type = 'button'; b.textContent = t;
      b.addEventListener('click', () => { st.side = v; EP.ui.renderCenter(); EP.ui.renderEditor(); });
      sideSeg.appendChild(b);
    });
    const zoom = EP.el('input'); zoom.type = 'range'; zoom.min = 90; zoom.max = 360; zoom.value = st.thumbH;
    zoom.setAttribute('aria-label', 'Tamaño de las piezas en la mesa');
    zoom.addEventListener('input', () => { st.thumbH = +zoom.value; EP.ui.renderCenter(); });
    const lab = (t) => { const s = EP.el('span', 'bar-label'); s.textContent = t; return s; };
    bar.append(lab('Ver'), sideSeg, EP.el('span', 'spacer'), lab('Tamaño'), zoom);

    const mat = $('#mat');
    const keepScroll = mat.scrollTop;
    mat.replaceChildren();
    if (!p.items.length) { mat.appendChild(EP.ui.emptyMat()); return; }

    [['card', 'Cartas'], ['token', 'Fichas'], ['board', 'Tableros']].forEach(([kind, title]) => {
      const list = p.items.filter(i => i.kind === kind);
      if (!list.length) return;
      const sec = EP.el('section', 'mat-group');
      const h = EP.el('h3');
      const copies = list.reduce((a, i) => a + (i.copies || 1), 0);
      h.textContent = `${title} · ${list.length}` + (copies !== list.length ? ` (${copies} al imprimir)` : '');
      const grid = EP.el('div', 'mat-grid');
      list.forEach(it => grid.appendChild(EP.ui.piece(it, kind === 'board' ? st.thumbH * 1.8 : st.thumbH)));
      sec.append(h, grid);
      mat.appendChild(sec);
    });
    mat.scrollTop = keepScroll;
  },

  piece(it, size) {
    const st = EP.state;
    const side = it.kind === 'board' ? 'front' : st.side;
    const b = EP.el('button', 'piece' + (it.id === st.selectedId || st.multi.has(it.id) ? ' selected' : ''));
    b.type = 'button';
    b.title = 'Clic para editar. Ctrl + clic elige varias. Arrástrala para cambiarla de lugar o suelta una imagen encima.';
    b.draggable = true;
    b.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/x-ep-piece', it.id); e.dataTransfer.effectAllowed = 'move'; b.classList.add('dragging'); });
    b.addEventListener('dragend', () => b.classList.remove('dragging'));
    const holder = EP.el('div', 'piece-face');
    // Cartas y fichas a la misma escala (una carta póker mide "size" px de alto), así se ven sus proporciones reales
    let mw = size * 1.6, mh = size;
    if (it.kind !== 'board') { const k = size / 88; mw = it.w * k; mh = it.h * k; }
    holder.style.height = Math.max(mh, 30) + 'px';
    holder.appendChild(EP.thumb(it, side, st.project, mw, mh));
    const cap = EP.el('span', 'piece-name');
    cap.textContent = it.name || KIND_NAME[it.kind];
    b.append(holder, cap);
    if ((it.copies || 1) > 1) { const c = EP.el('span', 'badge'); c.textContent = '×' + it.copies; b.appendChild(c); }
    b.addEventListener('click', (e) => EP.actions.select(it.id, e.ctrlKey || e.metaKey || e.shiftKey));
    b.addEventListener('dragover', (e) => { e.preventDefault(); b.classList.add('drop'); });
    b.addEventListener('dragleave', () => b.classList.remove('drop'));
    b.addEventListener('drop', (e) => {
      e.preventDefault(); b.classList.remove('drop');
      const moved = e.dataTransfer.getData('text/x-ep-piece');
      if (moved) { if (moved !== it.id) EP.actions.moveTo(moved, it.id); return; }
      const f = e.dataTransfer.files[0];
      if (f) { EP.state.selectedId = it.id; EP.actions.setImage(it, side, f); }
    });
    return b;
  },

  emptyMat() {
    const box = EP.el('div', 'empty');
    const h = EP.el('h2'); h.textContent = 'La mesa está vacía';
    const ol = EP.el('ol', 'steps');
    ['Elige a la izquierda qué crear: una carta, un tablero, fichas, o una plantilla del catálogo.',
      'Haz clic en la pieza para editarla a la derecha: textos, colores, imagen de frente y de dorso.',
      'Revisa la «Vista de impresión» y pulsa Imprimir.'].forEach(t => { const li = EP.el('li'); li.textContent = t; ol.appendChild(li); });
    const r = EP.el('div', 'row center');
    r.append(
      F.btn('Agregar una carta', 'fa-plus', () => EP.actions.add(EP.newCard()), 'primary'),
      F.btn('Ver el catálogo', 'fa-book-open', () => { EP.state.tab = 'catalogo'; EP.ui.renderLeft(); }, 'ghost'));
    box.append(h, ol, r);
    return box;
  },

  renderPreview() {
    const st = EP.state, p = st.project, pr = p.print;
    $('#mat').hidden = true;
    const pv = $('#preview');
    pv.hidden = false;

    // Barra de ajustes de impresión
    const bar = $('#centerBar');
    if (!bar.dataset.print) {
      bar.replaceChildren(...EP.ui.printBar());
      bar.dataset.print = '1';
    }

    const { pages, warnings, paper } = EP.buildPages(p, EP.selectedIds());
    const keep = pv.scrollTop;
    pv.replaceChildren();
    const summary = EP.el('div', 'pv-summary');
    const counts = { front: 0, back: 0, board: 0, rules: 0, test: 0, testback: 0 };
    pages.forEach(d => counts[d.type]++);
    const parts = [];
    if (counts.test) parts.push(`${counts.test + counts.testback} de prueba`);
    if (counts.front) parts.push(`${counts.front} de frentes`);
    if (counts.back) parts.push(`${counts.back} de dorsos`);
    if (counts.board) parts.push(`${counts.board} de tableros`);
    if (counts.rules) parts.push(`${counts.rules} de manual`);
    summary.textContent = pages.length
      ? `${pages.length} hoja${pages.length > 1 ? 's' : ''} ${paper.name.split(' (')[0].toLowerCase()}: ${parts.join(', ')}.`
      : 'No hay hojas: agrega elementos o revisa qué incluir.';
    pv.appendChild(summary);
    warnings.forEach(w => pv.appendChild(F.p(w, 'warn')));

    const wrap = EP.el('div', 'pv-pages');
    const avail = pv.clientWidth - 48;
    const z = Math.min(st.previewZoom, Math.max(0.15, avail / (paper.w * EP.MM)));
    pages.forEach((d, i) => {
      const fig = EP.el('figure', 'pv-page ' + d.type);
      const page = EP.renderPage(d, p);
      page.style.zoom = z;
      const marked = new Set([st.selectedId, ...st.multi].filter(Boolean));
      page.querySelectorAll('[data-id]').forEach(s => { if (marked.has(s.dataset.id)) s.classList.add('selected'); });
      page.addEventListener('click', (e) => {
        const s = e.target.closest('[data-id]');
        if (s) EP.actions.select(s.dataset.id, e.ctrlKey || e.metaKey || e.shiftKey);
      });
      const cap = EP.el('figcaption');
      cap.textContent = `${i + 1}. ${d.label}`;
      fig.append(page, cap);
      wrap.appendChild(fig);
    });
    pv.appendChild(wrap);
    pv.scrollTop = keep;
  },

  printBar() {
    const els = [];
    const grp = (label, ctl, hint) => { const g = EP.el('label', 'pbar-item'); const s = EP.el('span'); s.textContent = label; g.append(s, ctl); if (hint) g.title = hint; return g; };
    const paperSel = F.select('print.paper', Object.fromEntries(Object.entries(EP.PAPERS).map(([k, v]) => [k, v.name])));
    els.push(grp('Papel', paperSel));
    els.push(grp('Dorsos', F.select('print.backs', { long: 'Doble cara (borde largo)', short: 'Doble cara (borde corto)', none: 'No imprimir dorsos' }),
      'Elige lo mismo que en la impresora. «Borde largo» es lo más común.'));
    els.push(grp('Marcas de corte', F.select('print.marks', { margen: 'En el margen', contorno: 'Contorno', ninguna: 'Sin marcas' })));
    els.push(grp('Margen', F.num('print.margin', 3, 30, 1, 'mm'), 'Casi todas las impresoras necesitan al menos 5 mm.'));
    els.push(grp('Separación', F.num('print.gap', 0, 20, 1, 'mm'), 'Espacio entre piezas. Con 0 se corta una sola línea entre dos cartas.'));

    const more = EP.el('details', 'pbar-more');
    const sm = EP.el('summary'); sm.textContent = 'Más opciones';
    const box = EP.el('div', 'pbar-more-body');
    box.append(
      F.check('print.include.card', 'Cartas'), F.check('print.include.token', 'Fichas'), F.check('print.include.board', 'Tableros'),
      F.check('print.rotate', 'Girar piezas si caben más por hoja'),
      F.check('print.onlySelected', 'Imprimir solo lo seleccionado (Ctrl + clic para elegir varias)'),
      F.check('print.rulesSheet', 'Agregar manual del juego (reglas, materiales y cierre)'),
      F.check('print.testSheet', 'Agregar hoja de prueba (revisa tamaño y dorsos)'),
      F.p('Ajuste fino de dorsos: si al imprimir a doble cara el dorso queda corrido, muévelo aquí.', 'help'),
      F.row(F.field('Mover a la derecha', F.num('print.offX', -15, 15, 0.5, 'mm')), F.field('Mover hacia abajo', F.num('print.offY', -15, 15, 0.5, 'mm'))));
    more.append(sm, box);
    els.push(more);

    const z = EP.el('input'); z.type = 'range'; z.min = 0.2; z.max = 1; z.step = 0.05; z.value = EP.state.previewZoom;
    z.setAttribute('aria-label', 'Zoom de la vista previa');
    z.addEventListener('input', () => { EP.state.previewZoom = +z.value; EP.ui.renderCenter(); });
    els.push(EP.el('span', 'spacer'), grp('Zoom', z));
    return els;
  },

  /* ================== Panel izquierdo ================== */
  renderLeft() {
    const st = EP.state;
    document.querySelectorAll('#rail [data-tab]').forEach(b => {
      b.classList.toggle('on', b.dataset.tab === st.tab);
      b.setAttribute('aria-selected', b.dataset.tab === st.tab);
    });
    const panel = $('#left');
    panel.replaceChildren();
    const fn = { cartas: EP.ui.leftCards, tableros: EP.ui.leftBoards, fichas: EP.ui.leftTokens, juegos: EP.ui.leftGames,
      catalogo: EP.ui.leftCatalog, material: EP.ui.leftMaterial, sesiones: EP.ui.leftSessions }[st.tab] || EP.ui.leftCards;
    fn(panel);
  },

  leftTitle(panel, title, text) {
    const h = EP.el('h2', 'panel-title'); h.textContent = title;
    panel.appendChild(h);
    if (text) panel.appendChild(F.p(text));
  },

  leftCards(panel) {
    EP.ui.leftTitle(panel, 'Cartas', 'Elige la medida y el diseño, y agrega la carta a la mesa.');
    const opt = EP.ui._newCard || (EP.ui._newCard = { sizeId: 'poker', layout: 'texto' });

    const sizes = EP.el('div', 'chips');
    EP.CARD_SIZES.forEach(s => {
      const b = EP.el('button', 'chip' + (opt.sizeId === s.id ? ' on' : ''));
      b.type = 'button';
      const shape = EP.el('span', 'chip-shape');
      const k = 30 / Math.max(s.w, s.h);
      shape.style.width = s.w * k + 'px'; shape.style.height = s.h * k + 'px';
      const t = EP.el('span'); t.textContent = s.name;
      b.append(shape, t);
      b.addEventListener('click', () => { opt.sizeId = s.id; EP.ui.renderLeft(); });
      sizes.appendChild(b);
    });
    panel.appendChild(EP.ui.block('Medida', sizes));

    const lay = EP.el('div', 'layouts');
    Object.entries(EP.LAYOUTS).forEach(([k, name]) => {
      const b = EP.el('button', 'layout-tile' + (opt.layout === k ? ' on' : ''));
      b.type = 'button';
      b.appendChild(EP.ui.layoutIcon(k));
      const t = EP.el('span'); t.textContent = name;
      b.appendChild(t);
      b.addEventListener('click', () => { opt.layout = k; EP.ui.renderLeft(); });
      lay.appendChild(b);
    });
    panel.appendChild(EP.ui.block('Diseño', lay));
    panel.appendChild(F.btn('Agregar carta', 'fa-plus', () => {
      const front = { layout: opt.layout };
      if (opt.layout === 'banda') Object.assign(front, { titleColor: '#ffffff', titleSize: 12 });
      if (opt.layout === 'imagen') Object.assign(front, { title: '', text: '' });
      EP.actions.add(EP.newCard({ sizeId: opt.sizeId, front }));
    }, 'primary wide'));

    // Mazo rápido
    const deck = EP.el('div', 'block');
    const h = EP.el('h3'); h.textContent = 'Crear un mazo desde una lista';
    const ta = EP.el('textarea');
    ta.rows = 6;
    ta.placeholder = 'Una carta por línea.\nPara separar título y texto usa una barra:\nAlegría | ¿Cuándo te sentiste así?';
    ta.value = EP.ui._deckDraft || '';
    ta.addEventListener('input', () => { EP.ui._deckDraft = ta.value; });
    const sel = EP.sel();
    const useTpl = EP.el('label', 'check');
    const cb = EP.el('input'); cb.type = 'checkbox'; cb.checked = !!(sel && sel.kind === 'card'); cb.disabled = !(sel && sel.kind === 'card');
    const cbt = EP.el('span');
    cbt.textContent = sel && sel.kind === 'card' ? `Copiar el diseño de «${sel.name}»` : 'Selecciona una carta para copiar su diseño';
    useTpl.append(cb, cbt);
    deck.append(h, ta, useTpl, F.btn('Crear cartas', 'fa-layer-group', () => {
      const s2 = EP.sel();
      const tpl = cb.checked && s2 && s2.kind === 'card' ? s2 : EP.newCard({ sizeId: opt.sizeId, front: { layout: opt.layout } });
      EP.actions.deckFromText(ta.value, tpl);
      EP.ui._deckDraft = '';
    }, 'wide'));
    panel.appendChild(deck);
    EP.ui.designsBlock(panel, 'card');
  },

  leftBoards(panel) {
    EP.ui.leftTitle(panel, 'Tableros', 'El tablero se imprime a tamaño real, repartido en varias hojas carta que después se pegan.');
    const opt = EP.ui._newBoard || (EP.ui._newBoard = { sheets: 2, pattern: 'track', orient: 'portrait' });
    const sheets = EP.el('div', 'chips');
    EP.BOARD_SHEETS.forEach((s, i) => {
      const b = EP.el('button', 'chip' + (opt.sheets === i ? ' on' : ''));
      b.type = 'button';
      const g = EP.el('span', 'sheet-grid');
      g.style.gridTemplateColumns = `repeat(${s.cols}, 1fr)`;
      for (let k = 0; k < s.cols * s.rows; k++) g.appendChild(EP.el('i'));
      const t = EP.el('span'); t.textContent = s.name;
      b.append(g, t);
      b.addEventListener('click', () => { opt.sheets = i; EP.ui.renderLeft(); });
      sheets.appendChild(b);
    });
    panel.appendChild(EP.ui.block('Tamaño', sheets));
    const s = EP.BOARD_SHEETS[opt.sheets];
    const paper = EP.paperOf(EP.state.project), m = EP.state.project.print.margin;
    let pw = paper.w, ph = paper.h;
    if (opt.orient === 'landscape') [pw, ph] = [ph, pw];
    panel.appendChild(F.p(`Medida final: ${((pw - 2 * m) * s.cols / 10).toFixed(1)} × ${((ph - 2 * m) * s.rows / 10).toFixed(1)} cm.`, 'help strong'));

    const or = EP.el('div', 'seg');
    [['portrait', 'Hojas verticales'], ['landscape', 'Hojas horizontales']].forEach(([v, t]) => {
      const b = EP.el('button', 'seg-btn' + (opt.orient === v ? ' on' : '')); b.type = 'button'; b.textContent = t;
      b.addEventListener('click', () => { opt.orient = v; EP.ui.renderLeft(); });
      or.appendChild(b);
    });
    panel.appendChild(EP.ui.block('Orientación', or));

    const pats = EP.el('div', 'layouts');
    Object.entries(EP.PATTERNS).forEach(([k, name]) => {
      const b = EP.el('button', 'layout-tile' + (opt.pattern === k ? ' on' : ''));
      b.type = 'button';
      b.appendChild(EP.ui.patternIcon(k));
      const t = EP.el('span'); t.textContent = name;
      b.appendChild(t);
      b.addEventListener('click', () => { opt.pattern = k; EP.ui.renderLeft(); });
      pats.appendChild(b);
    });
    panel.appendChild(EP.ui.block('Dibujo', pats));
    panel.appendChild(F.btn('Agregar tablero', 'fa-plus', () => {
      EP.actions.add(EP.newBoard({ sheets: { cols: s.cols, rows: s.rows, orient: opt.orient }, pattern: { type: opt.pattern },
        front: opt.pattern === 'none' ? {} : { title: '' } }));
    }, 'primary wide'));
    panel.appendChild(F.p('Consejo: sube una imagen grande (por ejemplo un mapa dibujado) como fondo del tablero y elige «Libre».'));
  },

  leftTokens(panel) {
    EP.ui.leftTitle(panel, 'Fichas', 'Fichas, monedas y marcadores. Se imprimen con su dorso.');
    const opt = EP.ui._newToken || (EP.ui._newToken = { shape: 'circle', size: 30, qty: 6 });
    const shapes = EP.el('div', 'chips');
    Object.entries(EP.TOKEN_SHAPES).forEach(([k, n]) => {
      const b = EP.el('button', 'chip' + (opt.shape === k ? ' on' : ''));
      b.type = 'button';
      const sh = EP.el('span', 'chip-shape tok-' + k);
      const t = EP.el('span'); t.textContent = n;
      b.append(sh, t);
      b.addEventListener('click', () => { opt.shape = k; EP.ui.renderLeft(); });
      shapes.appendChild(b);
    });
    panel.appendChild(EP.ui.block('Forma', shapes));
    const sizes = EP.el('div', 'seg wrap');
    EP.TOKEN_SIZES.forEach(v => {
      const b = EP.el('button', 'seg-btn' + (opt.size === v ? ' on' : '')); b.type = 'button'; b.textContent = v / 10 + ' cm';
      b.addEventListener('click', () => { opt.size = v; EP.ui.renderLeft(); });
      sizes.appendChild(b);
    });
    panel.appendChild(EP.ui.block('Diámetro', sizes));
    const q = EP.el('input'); q.type = 'number'; q.min = 1; q.max = 200; q.value = opt.qty;
    q.addEventListener('input', () => { opt.qty = Math.max(1, Math.min(200, +q.value || 1)); });
    panel.appendChild(EP.ui.block('Cuántas iguales', q));
    panel.appendChild(F.btn('Agregar fichas', 'fa-plus', () => {
      EP.actions.add(EP.newToken({ shape: opt.shape, size: opt.size, copies: opt.qty }));
    }, 'primary wide'));
    panel.appendChild(F.p('Las fichas iguales se guardan como una sola pieza con varias copias: la editas una vez y se imprimen todas.'));
    EP.ui.designsBlock(panel, 'token');
  },

  async leftGames(panel) {
    EP.ui.leftTitle(panel, 'Juegos', 'Cada juego guarda sus cartas, fichas, tableros y reglas.');
    if (EP.ui.driveBlock) { const db = EP.el('div'); EP.ui.driveBlock(db); panel.appendChild(db); }
    const info = EP.el('div', 'block');
    const h = EP.el('h3'); h.textContent = 'Este juego';
    info.append(h,
      F.field('Nombre', F.input('project.name')),
      F.field('Ideas y pendientes', F.area('info.ideas', 3, 'Preguntas que se te ocurren, cartas por hacer, cosas por cambiar…'),
        'Solo para ti: no se imprime. Útil para anotar desde el celular y diseñar después en el PC.'),
      F.row(F.field('Participantes', F.input('info.players', 'text', { placeholder: '10 a 25' })),
        F.field('Duración', F.input('info.time', 'text', { placeholder: '45 min' }))),
      F.field('Edad o público', F.input('info.age', 'text', { placeholder: 'Adolescentes de 14 a 16 años' })),
      F.field('Objetivo', F.area('info.objective', 2, '¿Qué se busca con este juego?')),
      F.field('Cómo se juega', F.area('info.rules', 6, 'Escribe las reglas o las fases del taller.')),
      F.field('Rol de quien facilita', F.area('info.facilitator', 2, 'Qué hace quien facilita en cada momento.')),
      F.field('Preguntas de cierre', F.area('info.closing', 3, '¿Qué aprendimos? ¿Qué nos llevamos?')),
      F.field('Otros materiales', F.input('info.materials', 'text', { placeholder: 'Dado, lápices, post-its' }),
        'Con todo esto se arma el manual del juego. Las cartas, fichas y tableros se cuentan solos. Actívalo en Vista de impresión → Más opciones → «Agregar manual del juego».'));
    panel.appendChild(info);

    const row = F.row(
      F.btn('Juego nuevo', 'fa-plus', async () => {
        const n = await EP.ui.prompt('Nombre del juego nuevo', '', 'Crear juego');
        if (n) EP.games.create(n);
      }, 'primary'),
      F.btn('Importar', 'fa-file-import', () => $('#importFile').click(), 'ghost'));
    panel.appendChild(row);
    panel.appendChild(F.p('«Importar» también lee los JSON que armas con DeepSeek u otra IA: crea solo las cartas, fichas y tableros.', 'help'));
    panel.appendChild(F.btn('Guía para pedirle un juego a una IA', 'fa-wand-magic-sparkles', EP.importer.showGuide, 'ghost wide'));

    const listBox = EP.el('div', 'block');
    const h2 = EP.el('h3'); h2.textContent = 'Mis juegos';
    listBox.appendChild(h2);
    panel.appendChild(listBox);
    const token = (EP.ui._gamesToken = {});
    const metas = await EP.db.list().catch(() => []);
    if (EP.state.tab !== 'juegos' || EP.ui._gamesToken !== token) return; // se volvió a dibujar mientras esperaba
    metas.forEach(m => {
      const card = EP.el('div', 'game' + (m.id === EP.state.project.id ? ' current' : ''));
      const t = EP.el('button', 'game-open');
      t.type = 'button';
      const name = EP.el('strong'); name.textContent = m.name;
      const meta = EP.el('span');
      meta.textContent = ([m.cards && `${m.cards} cartas`, m.tokens && `${m.tokens} fichas`, m.boards && `${m.boards} tableros`].filter(Boolean).join(', ') || 'Vacío')
        + ` · editado ${EP.ago(m.updated)}` + (m.versions ? ` · ${m.versions} versión${m.versions > 1 ? 'es' : ''}` : '');
      t.append(name, meta);
      t.addEventListener('click', () => m.id !== EP.state.project.id && EP.games.open(m.id));
      const acts = EP.el('div', 'game-acts');
      acts.append(
        F.btn('', 'fa-copy', () => EP.games.duplicate(m.id), 'icon'),
        F.btn('', 'fa-download', () => EP.games.exportOne(m.id), 'icon'),
        F.btn('', 'fa-trash-can', async () => {
          if (await EP.ui.confirm('¿Eliminar este juego?', `Se borrará «${m.name}» de este navegador. Esto no se puede deshacer, salvo que tengas un respaldo.`, 'Eliminar juego', true)) EP.games.remove(m.id);
        }, 'icon danger'));
      acts.children[0].title = 'Duplicar'; acts.children[0].setAttribute('aria-label', 'Duplicar ' + m.name);
      acts.children[1].title = 'Descargar archivo'; acts.children[1].setAttribute('aria-label', 'Descargar ' + m.name);
      acts.children[2].title = 'Eliminar'; acts.children[2].setAttribute('aria-label', 'Eliminar ' + m.name);
      card.append(t, acts);
      listBox.appendChild(card);
    });
    EP.ui.versionsBlock(panel);
    panel.appendChild(F.btn('Descargar respaldo de todos', 'fa-box-archive', EP.games.exportAll, 'ghost wide'));
    panel.appendChild(F.p('Los juegos viven en este navegador. Si cambias de computador o borras el historial, usa el respaldo para recuperarlos.'));
  },

  leftCatalog(panel) {
    EP.ui.leftTitle(panel, 'Catálogo', 'Plantillas listas. Se agregan al juego abierto y luego las editas como quieras.');
    const groups = {};
    EP.CATALOG.forEach(t => (groups[t.group] = groups[t.group] || []).push(t));
    Object.entries(groups).forEach(([g, list]) => {
      const h = EP.el('h3', 'cat-group'); h.textContent = g;
      panel.appendChild(h);
      list.forEach(t => {
        const b = EP.el('button', 'cat-item');
        b.type = 'button';
        const ic = EP.el('span', 'cat-icon'); ic.style.background = t.color;
        ic.appendChild(EP.el('i', 'fa-solid ' + t.icon));
        const tx = EP.el('span', 'cat-text');
        const n = EP.el('strong'); n.textContent = t.name;
        const d = EP.el('span'); d.textContent = t.desc;
        tx.append(n, d);
        const add = EP.el('span', 'cat-add'); add.appendChild(EP.el('i', 'fa-solid fa-plus'));
        b.append(ic, tx, add);
        b.addEventListener('click', () => EP.actions.insertTemplate(t));
        panel.appendChild(b);
      });
    });
  },

  leftMaterial(panel) {
    const M = EP.material;
    EP.ui.leftTitle(panel, 'Mi material', 'Tus imágenes y juegos guardados en la carpeta «mi-material». Para agregar más, súbelos a esa carpeta: no hay que tocar código.');
    if (!M.source && !M.loading && !M.error) { EP.loadMaterial(); return; }

    const folder = EP.el('input');
    folder.type = 'file'; folder.hidden = true; folder.multiple = true;
    folder.setAttribute('webkitdirectory', '');
    folder.addEventListener('change', () => folder.files.length && EP.loadLocalFolder(folder.files));
    panel.appendChild(folder);
    panel.appendChild(F.row(
      F.btn('Actualizar', 'fa-rotate', () => { try { sessionStorage.clear(); } catch (e) { /* opcional */ } EP.loadMaterial(true); }, 'ghost'),
      F.btn('Abrir carpeta', 'fa-folder-open', () => folder.click(), 'ghost')));

    if (M.loading) { panel.appendChild(F.p('Buscando tu material…')); return; }
    if (M.error === 'offline') {
      panel.appendChild(F.p('En este computador la app no puede leer la carpeta sola. Pulsa «Abrir carpeta» y elige la carpeta mi-material. Cuando la app está publicada en GitHub, aparece automáticamente.', 'warn-soft'));
    } else if (M.error) {
      panel.appendChild(F.p(M.error, 'warn-soft'));
    }

    // Piezas importadas desde un JSON que todavía esperan su imagen
    const pending = EP.state.project.items.filter(it => ['front', 'back'].some(s => it[s].imgRef && !it[s].image)).length;
    if (pending) {
      const pb = EP.el('div', 'block');
      pb.append(F.p(`${pending} pieza${pending > 1 ? 's' : ''} de este juego esperan su imagen. Sube las imágenes a mi-material/imagenes (o abre la carpeta) y pulsa el botón.`, 'warn-soft'),
        F.btn('Buscar imágenes', 'fa-magnifying-glass', async () => {
          const r = await EP.importer.linkImages(EP.state.project, null, (d, t) => EP.ui.setStatus(`Cargando imágenes ${d} de ${t}…`));
          EP.commit({ structure: true });
          EP.ui.toast(`Encontré ${r.found} imágenes.` + (r.missing.length ? ` Faltan: ${r.missing.slice(0, 6).join(', ')}${r.missing.length > 6 ? '…' : ''}` : ''), r.missing.length ? 'info' : 'ok');
        }, 'primary wide'));
      panel.appendChild(pb);
    }

    const sel = EP.sel();
    const imgBlock = EP.el('div', 'block');
    const h = EP.el('h3'); h.textContent = `Imágenes · ${M.images.length}`;
    imgBlock.appendChild(h);
    if (M.images.length) {
      imgBlock.appendChild(F.p(sel
        ? `Clic en una imagen para ponerla en el ${EP.state.side === 'front' ? 'frente' : 'dorso'} de «${sel.name}».`
        : 'Clic en una imagen para crear una carta con ella. Si antes eliges una pieza, la imagen va en esa pieza.'));
      const grid = EP.el('div', 'mat-imgs');
      M.images.forEach(m => {
        const b = EP.el('button', 'mat-img');
        b.type = 'button';
        b.title = m.name;
        const img = EP.el('img'); img.src = m.url; img.alt = m.name; img.loading = 'lazy';
        const cap = EP.el('span'); cap.textContent = m.name;
        b.append(img, cap);
        b.addEventListener('click', () => EP.useMaterialImage(m, sel ? 'selected' : 'new'));
        grid.appendChild(b);
      });
      imgBlock.appendChild(grid);
      if (sel) imgBlock.appendChild(F.btn('Mejor crear cartas nuevas con la imagen', 'fa-plus', () => { EP.actions.select(null); EP.ui.renderLeft(); }, 'ghost small'));
    } else if (!M.error) {
      imgBlock.appendChild(F.p('Todavía no hay imágenes. Súbelas a mi-material/imagenes.'));
    }
    panel.appendChild(imgBlock);

    const gBlock = EP.el('div', 'block');
    const h2 = EP.el('h3'); h2.textContent = `Juegos · ${M.games.length}`;
    gBlock.appendChild(h2);
    M.games.forEach(m => {
      const row = EP.el('div', 'game');
      const t = EP.el('div', 'game-open');
      const n = EP.el('strong'); n.textContent = m.name;
      t.appendChild(n);
      const acts = EP.el('div', 'game-acts');
      const add = F.btn('', 'fa-plus', () => EP.useMaterialGame(m, 'add'), 'icon');
      add.title = 'Agregar sus piezas al juego abierto'; add.setAttribute('aria-label', add.title);
      const open = F.btn('', 'fa-box-open', () => EP.useMaterialGame(m, 'open'), 'icon');
      open.title = 'Abrir como juego aparte'; open.setAttribute('aria-label', open.title);
      acts.append(add, open);
      row.append(t, acts);
      gBlock.appendChild(row);
    });
    if (!M.games.length && !M.error) gBlock.appendChild(F.p('Para compartir un juego: en la pestaña Juegos pulsa el botón de descarga y sube ese archivo a mi-material/juegos.'));
    panel.appendChild(gBlock);
  },

  block(title, content) {
    const b = EP.el('div', 'block');
    const h = EP.el('h3'); h.textContent = title;
    b.append(h, content);
    return b;
  },

  layoutIcon(k) {
    const s = EP.el('span', 'lay-ico lay-' + k);
    s.append(EP.el('i', 'a'), EP.el('i', 'b'), EP.el('i', 'c'));
    return s;
  },
  patternIcon(k) {
    const s = EP.el('span', 'pat-ico pat-' + k);
    return s;
  },

  /* ================== Panel derecho: editor ================== */
  renderEditor() {
    const st = EP.state, it = EP.sel();
    const ed = $('#editor');
    const keep = ed.scrollTop;
    const openState = {};
    ed.querySelectorAll('details.sec').forEach(d => { openState[d.dataset.key] = d.open; });
    ed.replaceChildren();

    if (st.multi.size > 1) { EP.ui.multiPanel(ed); return; }
    if (!it) {
      const box = EP.el('div', 'ed-empty');
      const ic = EP.el('i', 'fa-solid fa-hand-pointer');
      const h = EP.el('h2'); h.textContent = 'Nada seleccionado';
      box.append(ic, h, F.p('Haz clic en una pieza de la mesa para cambiar sus textos, colores e imágenes.'));
      const p = st.project;
      const c = (k) => p.items.filter(i => i.kind === k).length;
      box.appendChild(F.p(`Este juego tiene ${c('card')} cartas, ${c('token')} fichas y ${c('board')} tableros.`, 'help'));
      const tips = EP.el('ul', 'tips');
      ['Arrastra una imagen sobre cualquier pieza para ponérsela.', 'Ctrl + Z deshace. Supr elimina la pieza seleccionada.', 'Ctrl + D duplica la pieza seleccionada.']
        .forEach(t => { const li = EP.el('li'); li.textContent = t; tips.appendChild(li); });
      box.appendChild(tips);
      ed.appendChild(box);
      return;
    }

    // Cabecera
    const head = EP.el('div', 'ed-head');
    const kind = EP.el('span', 'ed-kind');
    kind.appendChild(EP.el('i', 'fa-solid ' + KIND_ICON[it.kind]));
    kind.appendChild(document.createTextNode(KIND_NAME[it.kind]));
    const name = F.input('item.name');
    name.className = 'ed-name';
    name.setAttribute('aria-label', 'Nombre de la pieza');
    const acts = EP.el('div', 'ed-acts');
    const mk = (icon, label, fn, cls) => { const b = F.btn('', icon, fn, 'icon ' + (cls || '')); b.title = label; b.setAttribute('aria-label', label); return b; };
    acts.append(
      mk('fa-arrow-left', 'Mover antes', () => EP.actions.move(it.id, -1)),
      mk('fa-arrow-right', 'Mover después', () => EP.actions.move(it.id, 1)),
      mk('fa-copy', 'Duplicar (Ctrl + D)', () => EP.actions.duplicate(it.id)),
      mk('fa-trash-can', 'Eliminar (Supr)', () => EP.actions.remove(it.id), 'danger'),
      mk('fa-xmark', 'Cerrar', () => EP.actions.select(null)));
    head.append(kind, acts, name);
    ed.appendChild(head);

    const sec = (key, title, icon, open = true) => {
      const s = F.section(title, icon, openState[key] ?? open);
      s.el.dataset.key = key;
      ed.appendChild(s.el);
      return s.body;
    };

    // Medida
    const m = sec('size', it.kind === 'board' ? 'Tamaño y dibujo' : 'Medida', 'fa-ruler-combined', it.kind === 'board');
    if (it.kind === 'card') {
      const opts = Object.fromEntries(EP.CARD_SIZES.map(s => [s.id, s.name]));
      opts.custom = 'Personalizada';
      const sel = F.select('item.sizeId', opts, true);
      sel.addEventListener('change', () => {
        const s = EP.CARD_SIZES.find(x => x.id === sel.value);
        if (s) { it.w = s.w; it.h = s.h; EP.commit({ editor: true }); }
      });
      m.append(F.field('Tamaño', sel),
        F.row(F.field('Ancho', F.num('item.w', 15, 300, 1, 'mm')), F.field('Alto', F.num('item.h', 15, 300, 1, 'mm'))),
        F.field('Esquinas redondeadas', F.range('item.radius', 0, 10, 0.5, ' mm')),
        F.field('Copias al imprimir', F.num('item.copies', 1, 200, 1)));
      m.querySelectorAll('[data-path="item.w"],[data-path="item.h"]').forEach(i => i.addEventListener('input', () => { it.sizeId = 'custom'; }));
    } else if (it.kind === 'token') {
      const shapeSel = F.select('item.shape', EP.TOKEN_SHAPES, true);
      m.append(F.field('Forma', shapeSel),
        F.field('Diámetro', F.num('item.w', 10, 150, 1, 'mm')),
        F.field('Copias al imprimir', F.num('item.copies', 1, 200, 1)));
      m.querySelector('[data-path="item.w"]').addEventListener('input', (e) => { it.h = +e.target.value || it.w; });
    } else {
      const shSel = EP.el('select');
      EP.BOARD_SHEETS.forEach((s, i) => { const o = EP.el('option'); o.value = i; o.textContent = s.name; shSel.appendChild(o); });
      shSel.value = EP.BOARD_SHEETS.findIndex(s => s.cols === it.sheets.cols && s.rows === it.sheets.rows);
      shSel.addEventListener('change', () => { const s = EP.BOARD_SHEETS[+shSel.value]; it.sheets.cols = s.cols; it.sheets.rows = s.rows; EP.commit({ editor: true }); });
      const sz = EP.itemSize(it, EP.state.project);
      m.append(F.field('Hojas', shSel, `Medida final: ${(sz.w / 10).toFixed(1)} × ${(sz.h / 10).toFixed(1)} cm`),
        F.field('Orientación de las hojas', F.seg('item.sheets.orient', { portrait: 'Vertical', landscape: 'Horizontal' }, true)),
        F.field('Dibujo', F.select('item.pattern.type', EP.PATTERNS, true)));
      if (EP.isTech(it.pattern.type)) {
        // Técnica participativa: solo se editan los nombres de las zonas y los colores
        const ta = EP.el('textarea');
        ta.rows = 5;
        ta.placeholder = EP.TECH_LABELS[it.pattern.type].join('\n');
        ta.value = (it.pattern.labels || []).join('\n');
        ta.addEventListener('input', () => { it.pattern.labels = ta.value.split(/\r?\n/).slice(0, 12).map(t => t.slice(0, 120)); EP.commit({}); });
        m.append(
          F.field('Nombres de las zonas', ta, EP.TECH_FLEX.includes(it.pattern.type)
            ? 'Una línea por zona (hasta 12). Si lo dejas vacío se usan los nombres de ejemplo.'
            : 'Una línea por zona, en orden. Si lo dejas vacío se usan los nombres de ejemplo.'),
          F.row(F.field('Líneas y letras', F.color('item.pattern.color'))),
          F.field('Intensidad del color', F.range('item.pattern.opacity', 0, 100, 5, ' %')),
          F.field('Grosor de línea', F.range('item.pattern.width', 0.2, 3, 0.1, ' mm')));
      } else if (it.pattern.type !== 'none') {
        m.append(
          F.field(it.pattern.type === 'hex' ? 'Hexágonos por fila' : 'Casillas por fila', F.range('item.pattern.n', 3, 20, 1)),
          F.row(F.field('Líneas', F.color('item.pattern.color')), F.field('Casilla', F.color('item.pattern.fill')), F.field('Alterna', F.color('item.pattern.fillAlt'))),
          F.field('Relleno de las casillas', F.range('item.pattern.opacity', 0, 100, 5, ' %'), 'En 0 % las casillas quedan transparentes y se ve la imagen de fondo.'),
          F.field('Grosor de línea', F.range('item.pattern.width', 0.2, 3, 0.1, ' mm')),
          F.check('item.pattern.numbers', 'Mostrar números'));

        // Texto por casilla: una línea por casilla, en orden
        const cap = EP.patternCapacity(it.pattern, sz.w, sz.h);
        const ta = EP.el('textarea');
        ta.rows = 6;
        ta.placeholder = 'Salida\nPregunta\nAvanza 2\n…';
        ta.value = (it.pattern.labels || []).join('\n');
        ta.addEventListener('input', () => {
          it.pattern.labels = ta.value.split(/\r?\n/).slice(0, 400).map(t => t.slice(0, 200));
          while (it.pattern.labels.length && !it.pattern.labels[it.pattern.labels.length - 1]) it.pattern.labels.pop();
          EP.commit({});
        });
        m.append(
          F.field('Texto de cada casilla', ta, `Una línea por casilla, en orden (la 1 es la primera). Caben ${cap} casillas. Deja una línea vacía para saltar una.`),
          F.row(
            F.field('Casillas en total', F.num('item.pattern.count', 0, 400, 1), '0 = todas'),
            F.field('Letra del texto', F.num('item.pattern.labelSize', 0, 60, 1, 'pt'), '0 = automática')));
      }
    }

    // Frente / Dorso
    if (it.kind !== 'board') {
      const tabs = EP.el('div', 'side-tabs');
      [['front', 'Frente'], ['back', 'Dorso']].forEach(([v, t]) => {
        const b = EP.el('button', 'side-tab' + (st.side === v ? ' on' : ''));
        b.type = 'button';
        b.setAttribute('aria-pressed', st.side === v);
        const mini = EP.el('span', 'side-mini');
        mini.appendChild(EP.thumb(it, v, st.project, 40, 40));
        const tx = EP.el('span'); tx.textContent = t;
        b.append(mini, tx);
        b.addEventListener('click', () => { st.side = v; EP.ui.renderEditor(); EP.ui.renderCenter(); });
        tabs.appendChild(b);
      });
      ed.appendChild(tabs);
    }

    const f = it[st.side];

    // Imagen
    const im = sec('img', 'Imagen', 'fa-image');
    const drop = EP.el('label', 'drop');
    const file = EP.el('input'); file.type = 'file'; file.accept = 'image/*'; file.hidden = true;
    file.addEventListener('change', () => { if (file.files[0]) EP.actions.setImage(it, st.side, file.files[0]); });
    const url = EP.assetURL(st.project, f.image);
    if (url) {
      const img = EP.el('img'); img.src = url; img.alt = 'Imagen actual';
      drop.append(img);
    } else {
      drop.appendChild(EP.el('i', 'fa-solid fa-cloud-arrow-up'));
    }
    const dt = EP.el('span');
    dt.textContent = url ? 'Cambiar imagen' : `Subir imagen del ${st.side === 'front' ? 'frente' : 'dorso'}`;
    const dh = EP.el('small'); dh.textContent = 'Haz clic, arrástrala aquí o pégala con Ctrl + V';
    drop.append(dt, dh, file);
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer.files[0]) EP.actions.setImage(it, st.side, e.dataTransfer.files[0]); });
    im.appendChild(drop);
    if (url) {
      im.append(
        F.field('Ajuste', F.seg('@.fit', { cover: 'Llenar la pieza', contain: 'Mostrar completa' })),
        F.field('Acercar', F.range('@.imgZoom', 50, 300, 5, ' %')),
        F.row(F.field('Horizontal', F.range('@.imgX', 0, 100, 1, ' %')), F.field('Vertical', F.range('@.imgY', 0, 100, 1, ' %'))),
        F.field('Transparencia', F.range('@.imgOpacity', 10, 100, 5, ' %')),
        F.btn('Quitar imagen', 'fa-xmark', () => EP.actions.clearImage(it, st.side), 'ghost small'));
    }

    // Diseño y colores
    const d = sec('design', 'Diseño y colores', 'fa-palette');
    const lay = EP.el('div', 'layouts compact');
    Object.entries(EP.LAYOUTS).forEach(([k, n]) => {
      const b = EP.el('button', 'layout-tile' + (f.layout === k ? ' on' : ''));
      b.type = 'button';
      b.title = n;
      b.appendChild(EP.ui.layoutIcon(k));
      const t = EP.el('span'); t.textContent = n;
      b.appendChild(t);
      b.addEventListener('click', () => { f.layout = k; EP.commit({ editor: true }); });
      lay.appendChild(b);
    });
    d.append(lay, F.row(F.field('Fondo', F.color('@.bg')), F.field('Banda / acento', F.color('@.accent')), F.field('Borde', F.color('@.borderColor'))),
      F.field('Grosor del borde', F.range('@.borderW', 0, 5, 0.2, ' mm')),
      F.field('Espacio interior', F.range('@.padding', 0, 20, 0.5, ' mm')));

    // Textos
    if (f.layout !== 'imagen') {
      const t = sec('text', 'Textos', 'fa-font');
      t.append(
        F.field(f.layout === 'banda' ? 'Título (en la banda)' : 'Título', F.area('@.title', 2)),
        F.field('Texto', F.area('@.text', 4)),
        F.field('Pie', F.input('@.footer', 'text', { placeholder: 'Opcional' })));

      const ic = EP.ui.iconPicker(f);
      t.append(F.field('Ícono', ic), F.row(F.field('Color del ícono', F.color('@.iconColor')), F.field('Tamaño', F.num('@.iconSize', 6, 200, 1, 'pt'))));

      const ty = sec('type', 'Letra', 'fa-text-height', false);
      ty.append(
        F.row(F.field('Letra del título', F.select('@.titleFont', EP.FONT_NAMES)), F.field('Tamaño', F.num('@.titleSize', 5, 200, 1, 'pt')), F.field('Color', F.color('@.titleColor'))),
        F.row(F.field('Letra del texto', F.select('@.font', EP.FONT_NAMES)), F.field('Tamaño', F.num('@.textSize', 5, 120, 0.5, 'pt')), F.field('Color', F.color('@.textColor'))),
        F.row(F.field('Alineación', F.seg('@.align', { left: 'fa-align-left', center: 'fa-align-center', right: 'fa-align-right' })),
          F.field('Posición', F.seg('@.valign', { top: 'fa-arrow-up', center: 'fa-grip-lines', bottom: 'fa-arrow-down' }))));
    }

    // Aplicar a todo
    if (it.kind !== 'board') {
      const a = sec('all', 'Aplicar a varias', 'fa-wand-magic-sparkles', false);
      a.append(
        F.btn(`Usar este dorso en todas las ${it.kind === 'card' ? 'cartas' : 'fichas'} de esta medida`, 'fa-clone', () => EP.actions.backToAll(it), 'ghost wide'),
        F.btn('Copiar colores y letras del frente a las demás', 'fa-paintbrush', () => EP.actions.styleToAll(it), 'ghost wide'),
        F.p('Los textos e imágenes de cada pieza no se tocan al copiar el estilo.'),
        F.btn('Guardar como mi diseño', 'fa-bookmark', async () => {
          const n = await EP.ui.prompt('Nombre del diseño', it.name || 'Mi diseño', 'Guardar diseño');
          if (n) EP.designs.save(it, n);
        }, 'wide'),
        F.p(`Tus diseños aparecen en la pestaña ${it.kind === 'card' ? 'Cartas' : 'Fichas'} de todos tus juegos, con su medida, colores, letras y dorso.`, 'help'));
    }

    ed.scrollTop = keep;
  },

  iconPicker(f) {
    const wrap = EP.el('div', 'icons');
    EP.ICONS.forEach(ic => {
      const b = EP.el('button', 'icon-opt' + (f.icon === ic ? ' on' : ''));
      b.type = 'button';
      if (ic) b.appendChild(EP.el('i', 'fa-solid ' + ic)); else b.textContent = 'Sin';
      b.title = ic ? ic.replace('fa-', '') : 'Sin ícono';
      b.setAttribute('aria-label', b.title);
      b.addEventListener('click', () => {
        f.icon = ic;
        wrap.querySelectorAll('.icon-opt').forEach(x => x.classList.toggle('on', x === b));
        EP.commit({});
      });
      wrap.appendChild(b);
    });
    return wrap;
  }
};

document.addEventListener('DOMContentLoaded', () => {
  $('#importFile').addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (f) EP.games.importFile(f);
    e.target.value = '';
  });
});
