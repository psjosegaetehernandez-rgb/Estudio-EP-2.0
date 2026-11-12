/* Estudio EP — funciones agregadas en la versión 2.2:
   - Mis diseños: guardar el formato de una carta o ficha y reutilizarlo en cualquier juego.
   - Sesiones: planificar un taller de educación popular e imprimir su hoja de ruta.
   - Selección de varias piezas (Ctrl + clic), versiones guardadas y recordatorio antes de imprimir.
   Todo texto del usuario se pone con textContent (nunca innerHTML). */
window.EP = window.EP || {};

(() => {
  const $ = (s) => document.querySelector(s);
  const F = () => EP.F;
  const fmtDate = (t) => { try { return new Date(t).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; } };
  const ago = (t) => {
    const m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return 'recién';
    if (m < 60) return `hace ${m} min`;
    const h = Math.round(m / 60);
    if (h < 24) return `hace ${h} h`;
    const d = Math.round(h / 24);
    return d < 30 ? `hace ${d} día${d > 1 ? 's' : ''}` : fmtDate(t);
  };
  EP.ago = ago;

  /* ================== Mis diseños ================== */
  const TEXT_KEYS = ['title', 'text', 'footer', 'imgRef'];
  EP.designs = {
    cache: null,
    async list() { if (!EP.designs.cache) EP.designs.cache = await EP.db.all('designs').catch(() => []); return EP.designs.cache; },
    async save(item, name) {
      const p = EP.state.project, assets = {};
      ['front', 'back'].forEach(s => { const id = item[s].image; if (id && p.assets[id]) assets[id] = p.assets[id]; });
      const d = { id: EP.uid(), name: (name || item.name || 'Mi diseño').slice(0, 60), kind: item.kind,
        w: item.w, h: item.h, sizeId: item.sizeId, shape: item.shape, radius: item.radius,
        front: EP.clone(item.front), back: EP.clone(item.back), assets };
      await EP.db.save('designs', d);
      EP.designs.cache = null;
      EP.ui.renderLeft();
      EP.ui.toast(`Guardaste el diseño «${d.name}». Lo encuentras en la pestaña ${item.kind === 'token' ? 'Fichas' : 'Cartas'}, en cualquier juego.`, 'ok');
    },
    useAssets(d) { Object.assign(EP.state.project.assets, d.assets || {}); },
    /* Pieza nueva con el diseño (incluye sus textos de ejemplo) */
    newFrom(d) {
      EP.designs.useAssets(d);
      const base = d.kind === 'token' ? EP.newToken() : EP.newCard();
      Object.assign(base, { name: d.name, w: d.w, h: d.h, sizeId: d.sizeId || 'custom', shape: d.shape, radius: d.radius,
        front: EP.defaultFace(EP.clone(d.front)), back: EP.defaultFace(EP.clone(d.back)) });
      EP.actions.add(base);
    },
    /* Aplica el diseño a piezas existentes: cambia medida, colores, letras y dorso, pero conserva sus textos */
    applyTo(d, items) {
      EP.designs.useAssets(d);
      let n = 0;
      items.filter(it => it.kind === d.kind).forEach(it => {
        const keep = {};
        TEXT_KEYS.forEach(k => keep[k] = it.front[k]);
        it.front = EP.defaultFace(Object.assign(EP.clone(d.front), keep));
        if (!d.front.image) it.front.image = keep.image || it.front.image;
        it.back = EP.defaultFace(EP.clone(d.back));
        Object.assign(it, { w: d.w, h: d.h, sizeId: d.sizeId || 'custom', shape: d.shape, radius: d.radius });
        n++;
      });
      EP.commit({ structure: true });
      EP.ui.toast(n ? `Apliqué «${d.name}» a ${n} pieza${n > 1 ? 's' : ''}. Sus textos no cambiaron.` : 'Selecciona piezas del mismo tipo que el diseño.', n ? 'ok' : 'info');
    },
    async remove(d) {
      if (!(await EP.ui.confirm('¿Eliminar este diseño?', `«${d.name}» se borrará de Mis diseños. Las piezas que ya lo usan no cambian.`, 'Eliminar diseño', true))) return;
      await EP.db.del('designs', d.id);
      EP.designs.cache = null;
      EP.ui.renderLeft();
    }
  };

  /* Bloque "Mis diseños" para las pestañas Cartas y Fichas */
  EP.ui.designsBlock = async (panel, kind) => {
    const block = EP.el('div', 'block');
    const h = EP.el('h3'); h.textContent = 'Mis diseños';
    block.appendChild(h);
    panel.appendChild(block);
    const tab = EP.state.tab;
    const list = (await EP.designs.list()).filter(d => d.kind === kind);
    if (EP.state.tab !== tab) return;
    const targets = EP.selectedIds().map(id => EP.state.project.items.find(i => i.id === id)).filter(i => i && i.kind === kind);
    if (!list.length) {
      block.appendChild(F().p(`Diseña una ${kind === 'token' ? 'ficha' : 'carta'} a tu gusto y, abajo en el panel derecho, pulsa «Guardar como mi diseño». Queda disponible en todos tus juegos.`, 'help'));
      return;
    }
    const grid = EP.el('div', 'designs');
    list.forEach(d => {
      const card = EP.el('div', 'design');
      const prev = EP.el('div', 'design-prev');
      const fake = { kind: d.kind, w: d.w, h: d.h, shape: d.shape, radius: d.radius, front: EP.defaultFace(d.front), back: EP.defaultFace(d.back) };
      prev.appendChild(EP.thumb(fake, 'front', { assets: d.assets || {}, print: EP.state.project.print }, 70, 80));
      const nm = EP.el('strong'); nm.textContent = d.name;
      const acts = EP.el('div', 'design-acts');
      const add = F().btn('Nueva', 'fa-plus', () => EP.designs.newFrom(d), 'small');
      add.title = 'Crear una pieza nueva con este diseño';
      acts.appendChild(add);
      if (targets.length) {
        const ap = F().btn(targets.length > 1 ? `Aplicar a ${targets.length}` : 'Aplicar', 'fa-paintbrush', () => EP.designs.applyTo(d, targets), 'small ghost');
        ap.title = 'Usar este diseño en las piezas seleccionadas (sus textos se conservan)';
        acts.appendChild(ap);
      }
      const del = F().btn('', 'fa-trash-can', () => EP.designs.remove(d), 'icon danger');
      del.title = 'Eliminar diseño'; del.setAttribute('aria-label', 'Eliminar diseño ' + d.name);
      acts.appendChild(del);
      card.append(prev, nm, acts);
      grid.appendChild(card);
    });
    block.appendChild(grid);
    if (!targets.length) block.appendChild(F().p('Para cambiar el diseño de cartas que ya existen, selecciónalas (Ctrl + clic para varias) y pulsa «Aplicar».', 'help'));
  };

  /* ================== Varias piezas seleccionadas ================== */
  EP.ui.multiPanel = (ed) => {
    const st = EP.state, p = st.project;
    const items = [...st.multi].map(id => p.items.find(i => i.id === id)).filter(Boolean);
    const box = EP.el('div', 'ed-empty');
    box.appendChild(EP.el('i', 'fa-solid fa-layer-group'));
    const h = EP.el('h2'); h.textContent = `${items.length} piezas seleccionadas`;
    box.append(h, F().p('Ctrl + clic (o Mayús + clic) en la mesa suma o quita piezas. Un clic normal vuelve a una sola.'));
    const first = items[0];
    box.append(
      F().btn('Imprimir solo estas', 'fa-print', () => { p.print.onlySelected = true; st.view = 'print'; EP.commit({ structure: true }); }, 'primary wide'),
      F().btn(`Copiar el estilo de «${first.name}» a las demás`, 'fa-paintbrush', () => {
        const keep = ['title', 'text', 'footer', 'image', 'imgRef', 'icon', 'imgX', 'imgY', 'imgZoom'];
        items.slice(1).filter(o => o.kind === first.kind).forEach(o => { const f = EP.clone(first.front); keep.forEach(k => f[k] = o.front[k]); o.front = f; o.back = EP.clone(first.back); });
        EP.commit({});
        EP.ui.toast('Estilo y dorso copiados. Los textos no cambiaron.', 'ok');
      }, 'ghost wide'),
      F().btn('Copias al imprimir: poner 1 a todas', 'fa-1', () => { items.forEach(i => { if (i.kind !== 'board') i.copies = 1; }); EP.commit({ structure: true }); }, 'ghost wide'),
      F().btn('Eliminar las seleccionadas', 'fa-trash-can', async () => {
        if (!(await EP.ui.confirm(`¿Eliminar ${items.length} piezas?`, 'Puedes recuperarlas con Ctrl + Z.', 'Eliminar', true))) return;
        const ids = new Set(items.map(i => i.id));
        p.items = p.items.filter(i => !ids.has(i.id));
        st.multi.clear(); st.selectedId = null;
        EP.commit({ structure: true });
        EP.ui.toast(`Eliminaste ${ids.size} piezas.`, 'info', { label: 'Deshacer', fn: () => EP.historyGo(-1) });
      }, 'ghost wide danger'),
      F().btn('Quitar selección', 'fa-xmark', () => EP.actions.select(null), 'ghost wide'));
    ed.appendChild(box);
  };

  /* ================== Recordatorio antes de imprimir ================== */
  EP.ui.printTip = (go) => {
    const d = $('#dlg'), body = $('#dlgBody');
    body.replaceChildren();
    const h = EP.el('h2'); h.textContent = 'Antes de imprimir';
    const paper = EP.paperOf(EP.state.project).name.split(' (')[0];
    const ol = EP.el('ol', 'steps');
    [['Papel', paper + ' (igual que en la app).'], ['Márgenes', 'Ninguno.'], ['Escala', '100 % o «Tamaño real». Nunca «Ajustar a la página».'],
      ['Gráficos de fondo', 'Activado (si no, salen sin colores).'], ['Doble cara', 'Girar por el borde largo, si imprimes dorsos.']]
      .forEach(([t, x]) => { const li = EP.el('li'); const b = EP.el('strong'); b.textContent = t + ': '; li.append(b, document.createTextNode(x)); ol.appendChild(li); });
    const never = EP.el('label', 'check');
    const cb = EP.el('input'); cb.type = 'checkbox';
    const s = EP.el('span'); s.textContent = 'No volver a mostrar';
    never.append(cb, s);
    const actions = EP.el('div', 'dlg-actions');
    actions.append(F().btn('Cancelar', null, () => { d.close(); EP._printTipShown = false; }, 'ghost'),
      F().btn('Ya entendí, imprimir', 'fa-print', () => {
        if (cb.checked) { try { localStorage.setItem('ep2_print_tip', 'no'); } catch (e) { /* opcional */ } }
        d.close(); setTimeout(go, 50);
      }, 'primary'));
    body.append(h, F().p('Si las cartas salen más chicas o corridas, casi siempre es por algo de esta lista en la ventana de la impresora:', 'dlg-text'), ol,
      F().p('¿Primera vez con esta impresora? En Vista de impresión → Más opciones activa «Hoja de prueba» y revisa que el cuadrado mida 10 cm.', 'help'), never, actions);
    d.onclose = () => { EP._printTipShown = false; };
    d.showModal();
  };

  /* ================== Versiones (bloque en la pestaña Juegos) ================== */
  EP.ui.versionsBlock = (panel) => {
    const p = EP.state.project, v = p.versions || [];
    const block = EP.el('div', 'block');
    const h = EP.el('h3'); h.textContent = 'Versiones guardadas de este juego';
    block.append(h, F().p('Guarda un punto antes de hacer cambios grandes. Puedes volver a él cuando quieras, sin perder lo de ahora.', 'help'));
    block.appendChild(F().btn('Guardar versión', 'fa-bookmark', async () => {
      const n = await EP.ui.prompt('Nombre de la versión', 'Versión ' + (v.length + 1) + ' · ' + fmtDate(Date.now()), 'Guardar');
      if (n) EP.versions.save(n);
    }, 'wide'));
    v.forEach(x => {
      const row = EP.el('div', 'game');
      const t = EP.el('div', 'game-open');
      const n = EP.el('strong'); n.textContent = x.name;
      const m = EP.el('span'); m.textContent = `${ago(x.date)} · ${x.count} piezas`;
      t.append(n, m);
      const acts = EP.el('div', 'game-acts');
      const back = F().btn('', 'fa-clock-rotate-left', async () => {
        if (await EP.ui.confirm('¿Volver a esta versión?', `El juego quedará como estaba en «${x.name}». Lo de ahora se guarda como otra versión, así que no se pierde.`, 'Volver')) EP.versions.restore(x.id);
      }, 'icon');
      back.title = 'Volver a esta versión'; back.setAttribute('aria-label', 'Volver a ' + x.name);
      const del = F().btn('', 'fa-trash-can', () => EP.versions.remove(x.id), 'icon danger');
      del.title = 'Borrar versión'; del.setAttribute('aria-label', 'Borrar ' + x.name);
      acts.append(back, del);
      row.append(t, acts);
      block.appendChild(row);
    });
    panel.appendChild(block);
  };

  /* ================== Sesiones de educación popular ================== */
  EP.newSession = (name) => ({
    id: EP.uid(), name: name || 'Sesión nueva', date: '', place: '', group: '', facilitator: '', objective: '',
    phases: [
      { title: 'Bienvenida y encuadre', minutes: 10, activity: 'Presentación, acuerdos de convivencia.', materials: '' },
      { title: 'Activación', minutes: 15, activity: 'Dinámica para entrar en el tema.', materials: '' },
      { title: 'Desarrollo', minutes: 40, activity: 'Juego o técnica principal.', materials: '' },
      { title: 'Plenario', minutes: 15, activity: 'Compartir lo que salió en los grupos.', materials: '' },
      { title: 'Cierre y evaluación', minutes: 10, activity: 'Preguntas de cierre y evaluación breve.', materials: '' }
    ],
    games: [], images: [], closing: '', notes: '', created: Date.now()
  });

  EP.sessions = {
    cache: null,
    async list() { if (!EP.sessions.cache) EP.sessions.cache = await EP.db.all('sessions').catch(() => []); return EP.sessions.cache; },
    async create() {
      const n = await EP.ui.prompt('Nombre de la sesión', 'Taller ' + fmtDate(Date.now()), 'Crear sesión');
      if (!n) return;
      const s = EP.newSession(n);
      await EP.db.save('sessions', s);
      EP.sessions.cache = null;
      EP.state.session = s;
      EP.ui.renderLeft(); EP.ui.renderCenter();
    },
    async open(id) {
      const s = (await EP.sessions.list()).find(x => x.id === id);
      if (s) { EP.state.session = s; EP.ui.renderLeft(); EP.ui.renderCenter(); }
    },
    timer: null,
    save() {
      clearTimeout(EP.sessions.timer);
      EP.sessions.dirty = true;
      EP.ui.setStatus('Guardando…');
      EP.sessions.timer = setTimeout(async () => {
        try { await EP.db.save('sessions', EP.state.session); EP.sessions.dirty = false; EP.sessions.cache = null; EP.ui.setStatus('Guardado'); }
        catch (e) { EP.ui.setStatus('No se pudo guardar', true); EP.ui.toast('No se pudo guardar la sesión. Si tiene muchas fotos, quita algunas.', 'error'); }
      }, 500);
    },
    async duplicate(s) {
      const c = EP.clone(s); c.id = EP.uid(); c.name = s.name + ' (copia)'; c.created = Date.now();
      await EP.db.save('sessions', c); EP.sessions.cache = null; EP.ui.renderLeft();
      EP.ui.toast('Sesión duplicada.', 'ok');
    },
    async remove(s) {
      if (!(await EP.ui.confirm('¿Eliminar esta sesión?', `Se borrará «${s.name}». Los juegos que usa no se borran.`, 'Eliminar sesión', true))) return;
      await EP.db.del('sessions', s.id);
      EP.sessions.cache = null;
      if (EP.state.session && EP.state.session.id === s.id) EP.state.session = null;
      EP.ui.renderLeft(); EP.ui.renderCenter();
    },
    totalMinutes: (s) => s.phases.reduce((a, f) => a + (Number(f.minutes) || 0), 0),
    async addImages(files, label) {
      const s = EP.state.session;
      for (const f of [...files].slice(0, 12)) {
        if (!/^image\//.test(f.type)) continue;
        const tmp = { assets: {} };
        // Fotos sacadas en el taller: se nombran con el momento y la hora, no con el nombre raro de la cámara
        const caption = label ? label + ' · ' + new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : f.name.replace(/\.[^.]+$/, '');
        try { const id = await EP.importImage(f, tmp, 1400); s.images.push({ id, data: tmp.assets[id], caption }); }
        catch (e) { EP.ui.toast('No pude leer «' + f.name + '».', 'error'); }
      }
      if (s.images.length > 24) { s.images.length = 24; EP.ui.toast('Una sesión guarda hasta 24 imágenes.', 'info'); }
      EP.sessions.save(); EP.ui.renderCenter();
    },
    print() {
      const s = EP.state.session;
      const paper = EP.PAPERS.carta;
      const root = document.getElementById('print-root');
      root.replaceChildren(...EP.sessionPages(s));
      let tag = document.getElementById('page-size-css');
      if (!tag) { tag = document.createElement('style'); tag.id = 'page-size-css'; document.head.appendChild(tag); }
      tag.textContent = `@page { size: ${paper.w}mm ${paper.h}mm; margin: 0; }`;
      const imgs = [...root.querySelectorAll('img')].map(i => i.complete ? null : new Promise(r => { i.onload = i.onerror = r; })).filter(Boolean);
      Promise.all([...imgs, document.fonts ? document.fonts.ready : null]).then(() => { window.print(); setTimeout(() => root.replaceChildren(), 500); });
    }
  };

  /* Hoja de ruta imprimible (una o más hojas carta) */
  EP.sessionPages = (s) => {
    const W = EP.PAPERS.carta.w, H = EP.PAPERS.carta.h;
    const mk = () => { const pg = EP.el('div', 'page'); pg.style.width = W + 'mm'; pg.style.height = (H - 0.4) + 'mm'; const b = EP.el('div', 'rules-sheet route', 'inset:14mm'); pg.appendChild(b); return [pg, b]; };
    const pages = [];
    let [pg, b] = mk(); pages.push(pg);
    const add = (tag, text, cls, parent = b) => { if (!text && text !== 0) return null; const e = EP.el(tag, cls); e.textContent = text; parent.appendChild(e); return e; };
    add('h1', s.name);
    add('p', [s.date && 'Fecha: ' + s.date, s.place && 'Lugar: ' + s.place, s.group && 'Grupo: ' + s.group, s.facilitator && 'Facilita: ' + s.facilitator,
      'Duración total: ' + EP.sessions.totalMinutes(s) + ' min'].filter(Boolean).join('   '), 'meta');
    if (s.objective) { add('h2', 'Objetivo'); add('p', s.objective, 'rules'); }
    // La tabla se reparte en varias hojas si hay muchos momentos (estimando líneas por fila)
    let acc = 0, table = null, used = 0;
    const rowLines = (f) => Math.max(1, Math.ceil(String(f.activity || '').length / 55), Math.ceil(String(f.materials || '').length / 25)) + 1;
    const newTable = (cont) => {
      add('h2', cont ? 'Momentos de la sesión (continuación)' : 'Momentos de la sesión');
      table = EP.el('table', 'route-table');
      const head = EP.el('tr');
      ['Hora', 'Momento', 'Qué se hace', 'Materiales'].forEach(t => add('th', t, '', head));
      table.appendChild(head);
      b.appendChild(table);
    };
    used = s.objective ? 10 + Math.ceil(s.objective.length / 85) : 6;
    newTable(false);
    s.phases.forEach(f => {
      const need = rowLines(f);
      if (used + need > 44) { [pg, b] = mk(); pages.push(pg); used = 2; newTable(true); }
      const tr = EP.el('tr');
      add('td', `${acc}–${acc + (Number(f.minutes) || 0)} min`, 'nowrap', tr);
      acc += Number(f.minutes) || 0;
      add('td', f.title || '', 'strong', tr);
      add('td', f.activity || '', '', tr);
      add('td', f.materials || '', '', tr);
      table.appendChild(tr);
      used += need;
    });
    const tail = (s.games.length ? s.games.length + 3 : 0) + (s.closing ? Math.ceil(s.closing.length / 85) + 3 : 0) + (s.notes ? Math.ceil(s.notes.length / 85) + 3 : 0);
    if (used + tail > 44) { [pg, b] = mk(); pages.push(pg); }
    if (s.games.length) { add('h2', 'Juegos y materiales para imprimir'); add('p', s.games.map(g => '• ' + g.name + (g.summary ? ' (' + g.summary + ')' : '')).join('\n'), 'rules'); }
    if (s.closing) { add('h2', 'Preguntas de cierre'); add('p', s.closing, 'rules'); }
    if (s.notes) { add('h2', 'Notas'); add('p', s.notes, 'rules'); }
    if (s.images.length) {
      [pg, b] = mk(); pages.push(pg);
      add('h1', s.name + ': imágenes');
      const grid = EP.el('div', 'route-imgs');
      s.images.slice(0, 12).forEach(im => {
        const fig = EP.el('figure');
        const img = EP.el('img'); img.src = im.data; img.alt = im.caption || '';
        fig.appendChild(img);
        add('figcaption', im.caption || '', '', fig);
        grid.appendChild(fig);
      });
      b.appendChild(grid);
    }
    pages.forEach(p => { const c = EP.el('p', 'credit route-credit'); c.textContent = 'Hecho con Estudio EP — desarrollado por Punta Digital y José Luis Gaete'; p.firstChild.appendChild(c); });
    return pages;
  };

  /* Panel izquierdo: lista de sesiones */
  EP.ui.leftSessions = async (panel) => {
    EP.ui.leftTitle(panel, 'Sesiones', 'Planifica tus talleres de educación popular: momentos, tiempos, juegos, materiales e imágenes. Se imprime como hoja de ruta.');
    panel.appendChild(F().btn('Sesión nueva', 'fa-plus', EP.sessions.create, 'primary wide'));
    const list = EP.el('div', 'block');
    const h = EP.el('h3'); h.textContent = 'Mis sesiones';
    list.appendChild(h);
    panel.appendChild(list);
    const all = await EP.sessions.list();
    if (EP.state.tab !== 'sesiones') return;
    if (!all.length) list.appendChild(F().p('Todavía no tienes sesiones. Crea una y agrega los juegos que vas a usar.', 'help'));
    all.forEach(s => {
      const row = EP.el('div', 'game' + (EP.state.session && EP.state.session.id === s.id ? ' current' : ''));
      const t = EP.el('button', 'game-open'); t.type = 'button';
      const n = EP.el('strong'); n.textContent = s.name;
      const m = EP.el('span'); m.textContent = [s.date, EP.sessions.totalMinutes(s) + ' min', s.games.length && s.games.length + ' juego' + (s.games.length > 1 ? 's' : '')].filter(Boolean).join(', ');
      t.append(n, m);
      t.addEventListener('click', () => EP.sessions.open(s.id));
      const acts = EP.el('div', 'game-acts');
      const du = F().btn('', 'fa-copy', () => EP.sessions.duplicate(s), 'icon'); du.title = 'Duplicar'; du.setAttribute('aria-label', 'Duplicar ' + s.name);
      const de = F().btn('', 'fa-trash-can', () => EP.sessions.remove(s), 'icon danger'); de.title = 'Eliminar'; de.setAttribute('aria-label', 'Eliminar ' + s.name);
      acts.append(du, de);
      row.append(t, acts);
      list.appendChild(row);
    });
  };

  /* Centro: editor de la sesión abierta */
  EP.ui.renderSession = async () => {
    const s = EP.state.session;
    $('#mat').hidden = false; $('#preview').hidden = true;
    const bar = $('#centerBar'); bar.replaceChildren(); delete bar.dataset.print;
    const mat = $('#mat');
    const keep = mat.scrollTop;
    mat.replaceChildren();
    if (!s) {
      const box = EP.el('div', 'empty');
      const h = EP.el('h2'); h.textContent = 'Elige o crea una sesión';
      box.append(h, F().p('A la izquierda crea una sesión nueva. Aquí vas a planificar sus momentos y elegir los juegos que usarás.'));
      mat.appendChild(box);
      return;
    }
    const lab = EP.el('span', 'bar-label'); lab.textContent = `${s.name} · ${EP.sessions.totalMinutes(s)} min`;
    bar.append(lab, EP.el('span', 'spacer'),
      F().btn('Modo taller', 'fa-person-chalkboard', () => EP.workshop && EP.workshop.open(), 'small primary'),
      F().btn('Imprimir hoja de ruta', 'fa-print', EP.sessions.print, 'small'),
      F().btn('Volver a mis juegos', 'fa-arrow-left', () => { EP.state.tab = 'juegos'; EP.ui.renderLeft(); EP.ui.renderCenter(); }, 'small ghost'));

    const sheet = EP.el('div', 'session');
    const field = (label, key, type = 'text', ph = '') => {
      const i = type === 'area' ? EP.el('textarea') : EP.el('input');
      if (type === 'area') i.rows = 3; else i.type = type;
      i.value = s[key] || ''; i.placeholder = ph;
      i.addEventListener('input', () => { s[key] = i.value.slice(0, 4000); EP.sessions.save(); if (key === 'name') lab.textContent = `${s.name} · ${EP.sessions.totalMinutes(s)} min`; });
      return F().field(label, i);
    };
    const g1 = EP.el('div', 'session-grid');
    g1.append(field('Nombre de la sesión', 'name'), field('Fecha', 'date', 'date'), field('Lugar', 'place', 'text', 'Junta de vecinos, colegio…'),
      field('Grupo', 'group', 'text', 'Adolescentes 14 a 16 años, 20 personas'), field('Quién facilita', 'facilitator'));
    sheet.append(g1, field('Objetivo de la sesión', 'objective', 'area', '¿Qué queremos que el grupo descubra o logre?'));

    // Momentos
    const ph = EP.el('div', 'block');
    const h = EP.el('h3'); h.textContent = 'Momentos de la sesión';
    ph.appendChild(h);
    let acc = 0;
    s.phases.forEach((f, idx) => {
      const row = EP.el('div', 'phase');
      const time = EP.el('span', 'phase-time'); time.textContent = `${acc}–${acc + (Number(f.minutes) || 0)} min`; acc += Number(f.minutes) || 0;
      const mk = (key, ph2, type = 'text') => {
        const i = type === 'area' ? EP.el('textarea') : EP.el('input');
        if (type === 'area') i.rows = 2; else i.type = type;
        if (type === 'number') { i.min = 0; i.max = 600; }
        i.value = f[key] ?? ''; i.placeholder = ph2; i.setAttribute('aria-label', ph2);
        i.addEventListener('input', () => {
          f[key] = type === 'number' ? Math.max(0, Math.min(600, Number(i.value) || 0)) : i.value.slice(0, 2000);
          EP.sessions.save();
          if (type === 'number') { clearTimeout(EP._phT); EP._phT = setTimeout(() => EP.ui.renderSession(), 700); }
        });
        return i;
      };
      const acts = EP.el('div', 'phase-acts');
      const up = F().btn('', 'fa-arrow-up', () => { if (idx > 0) { s.phases.splice(idx - 1, 0, s.phases.splice(idx, 1)[0]); EP.sessions.save(); EP.ui.renderSession(); } }, 'icon');
      up.setAttribute('aria-label', 'Subir momento'); up.title = 'Subir';
      const dn = F().btn('', 'fa-arrow-down', () => { if (idx < s.phases.length - 1) { s.phases.splice(idx + 1, 0, s.phases.splice(idx, 1)[0]); EP.sessions.save(); EP.ui.renderSession(); } }, 'icon');
      dn.setAttribute('aria-label', 'Bajar momento'); dn.title = 'Bajar';
      const rm = F().btn('', 'fa-trash-can', () => { s.phases.splice(idx, 1); EP.sessions.save(); EP.ui.renderSession(); }, 'icon danger');
      rm.setAttribute('aria-label', 'Quitar momento'); rm.title = 'Quitar';
      acts.append(up, dn, rm);
      const mins = mk('minutes', 'Minutos', 'number'); mins.className = 'phase-min';
      row.append(time, mk('title', 'Nombre del momento'), mins, acts, mk('activity', 'Qué se hace', 'area'), mk('materials', 'Materiales'));
      ph.appendChild(row);
    });
    ph.appendChild(F().btn('Agregar momento', 'fa-plus', () => { s.phases.push({ title: '', minutes: 10, activity: '', materials: '' }); EP.sessions.save(); EP.ui.renderSession(); }, 'ghost'));
    sheet.appendChild(ph);

    // Juegos de la sesión
    const gb = EP.el('div', 'block');
    const gh = EP.el('h3'); gh.textContent = 'Juegos y materiales';
    gb.appendChild(gh);
    const metas = await EP.db.list().catch(() => []);
    if (EP.state.session !== s) return;
    s.games.forEach((g, i) => {
      const row = EP.el('div', 'game');
      const t = EP.el('button', 'game-open'); t.type = 'button';
      const n = EP.el('strong'); n.textContent = g.name;
      const m = EP.el('span'); m.textContent = metas.some(x => x.id === g.id) ? (g.summary || '') + ' · clic para abrirlo e imprimirlo' : 'Este juego ya no existe';
      t.append(n, m);
      t.addEventListener('click', async () => { if (metas.some(x => x.id === g.id)) { await EP.games.open(g.id); EP.state.tab = 'juegos'; EP.state.view = 'print'; EP.ui.renderAll(); } });
      const rm = F().btn('', 'fa-xmark', () => { s.games.splice(i, 1); EP.sessions.save(); EP.ui.renderSession(); }, 'icon');
      rm.title = 'Quitar de la sesión'; rm.setAttribute('aria-label', 'Quitar ' + g.name);
      const acts = EP.el('div', 'game-acts'); acts.appendChild(rm);
      row.append(t, acts);
      gb.appendChild(row);
    });
    const sel = EP.el('select');
    const o0 = EP.el('option'); o0.value = ''; o0.textContent = 'Agregar un juego a la sesión…'; sel.appendChild(o0);
    metas.filter(m => !s.games.some(g => g.id === m.id)).forEach(m => { const o = EP.el('option'); o.value = m.id; o.textContent = m.name; sel.appendChild(o); });
    sel.addEventListener('change', () => {
      const m = metas.find(x => x.id === sel.value);
      if (!m) return;
      s.games.push({ id: m.id, name: m.name, summary: [m.cards && m.cards + ' cartas', m.tokens && m.tokens + ' fichas', m.boards && m.boards + ' tableros'].filter(Boolean).join(', ') });
      EP.sessions.save(); EP.ui.renderSession();
    });
    gb.appendChild(sel);
    sheet.appendChild(gb);

    // Imágenes
    const ib = EP.el('div', 'block');
    const ih = EP.el('h3'); ih.textContent = `Imágenes · ${s.images.length}`;
    ib.append(ih, F().p('Fotos de referencia, láminas o papelógrafos. Se imprimen en una hoja aparte de la hoja de ruta.', 'help'));
    const file = EP.el('input'); file.type = 'file'; file.accept = 'image/*'; file.multiple = true; file.hidden = true;
    file.addEventListener('change', () => { if (file.files.length) EP.sessions.addImages(file.files); file.value = ''; });
    const grid = EP.el('div', 'session-imgs');
    s.images.forEach((im, i) => {
      const fig = EP.el('figure');
      const img = EP.el('img'); img.src = im.data; img.alt = im.caption || '';
      const cap = EP.el('input'); cap.value = im.caption || ''; cap.setAttribute('aria-label', 'Texto de la imagen');
      cap.addEventListener('input', () => { im.caption = cap.value.slice(0, 120); EP.sessions.save(); });
      const rm = F().btn('', 'fa-xmark', () => { s.images.splice(i, 1); EP.sessions.save(); EP.ui.renderSession(); }, 'icon');
      rm.setAttribute('aria-label', 'Quitar imagen'); rm.title = 'Quitar';
      fig.append(img, cap, rm);
      grid.appendChild(fig);
    });
    const cam = EP.el('input'); cam.type = 'file'; cam.accept = 'image/*'; cam.setAttribute('capture', 'environment'); cam.hidden = true;
    cam.addEventListener('change', () => { if (cam.files.length) EP.sessions.addImages(cam.files, 'Foto del taller'); cam.value = ''; });
    ib.append(grid, file, cam, F().row(F().btn('Agregar imágenes', 'fa-image', () => file.click(), 'ghost'), F().btn('Sacar foto', 'fa-camera', () => cam.click(), 'ghost')));
    ib.addEventListener('dragover', (e) => e.preventDefault());
    ib.addEventListener('drop', (e) => { e.preventDefault(); if (e.dataTransfer.files.length) EP.sessions.addImages(e.dataTransfer.files); });
    sheet.appendChild(ib);

    sheet.append(field('Preguntas de cierre', 'closing', 'area', '¿Qué me llevo? ¿Qué cambiaría en mi vida cotidiana?'), field('Notas para mí', 'notes', 'area'));
    mat.appendChild(sheet);
    mat.scrollTop = keep;
  };
})();
