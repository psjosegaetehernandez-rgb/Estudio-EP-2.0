/* Estudio EP — núcleo: estado, guardado automático, deshacer, acciones.
   Desarrollado por Punta Digital y José Luis Gaete */
window.EP = window.EP || {};

EP.state = {
  project: null,
  selectedId: null,
  multi: new Set(),  // varias piezas elegidas con Ctrl + clic
  side: 'front',
  view: 'mesa',      // 'mesa' | 'print'
  tab: 'cartas',
  thumbH: 170,
  previewZoom: 0.45
};

EP.sel = () => EP.state.project.items.find(i => i.id === EP.state.selectedId) || null;
/* Piezas elegidas para "imprimir solo lo seleccionado": varias (Ctrl + clic) o la seleccionada */
EP.selectedIds = () => {
  const ids = EP.state.project.items.map(i => i.id);
  const m = [...EP.state.multi].filter(id => ids.includes(id));
  return m.length ? m : (EP.state.selectedId ? [EP.state.selectedId] : []);
};

/* ---------- Validación (para importar archivos sin riesgo) ---------- */
EP.safeColor = (v, d) => (typeof v === 'string' && /^#[0-9a-f]{3,8}$/i.test(v.trim())) ? v.trim() : d;
EP.safeNum = (v, d, min = -1e4, max = 1e4) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d; };
EP.sanitizeProject = (raw) => {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.items)) throw new Error('El archivo no es un juego de Estudio EP.');
  const p = EP.normalizeProject(raw);
  p.name = String(p.name || 'Juego importado').slice(0, 120);
  const okAsset = (v) => typeof v === 'string' && /^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(v);
  Object.keys(p.assets).forEach(k => { if (!okAsset(p.assets[k])) delete p.assets[k]; });
  const def = EP.defaultFace();
  const fixFace = (f) => {
    ['bg', 'accent', 'iconColor', 'titleColor', 'textColor', 'borderColor'].forEach(k => f[k] = EP.safeColor(f[k], def[k]));
    ['imgX', 'imgY', 'imgZoom', 'imgOpacity', 'iconSize', 'titleSize', 'textSize', 'borderW', 'padding'].forEach(k => f[k] = EP.safeNum(f[k], def[k], 0, 1000));
    if (!EP.FONTS[f.font]) f.font = def.font;
    if (!EP.FONTS[f.titleFont]) f.titleFont = def.titleFont;
    if (!EP.LAYOUTS[f.layout]) f.layout = def.layout;
    if (!/^(fa-[a-z0-9-]+)?$/.test(f.icon || '')) f.icon = '';
    if (!['cover', 'contain'].includes(f.fit)) f.fit = 'cover';
    if (!['left', 'center', 'right'].includes(f.align)) f.align = 'center';
    if (!['top', 'center', 'bottom'].includes(f.valign)) f.valign = 'center';
    ['title', 'text', 'footer'].forEach(k => f[k] = String(f[k] || '').slice(0, 4000));
    if (f.image && !p.assets[f.image]) f.image = null;
    f.imgRef = /^[\w .()\-áéíóúñÁÉÍÓÚÑ]{1,120}\.(png|jpe?g|webp|gif)$/i.test(f.imgRef || '') ? f.imgRef : '';
  };
  p.items = p.items.filter(i => ['card', 'token', 'board'].includes(i.kind)).map(i => {
    i.id = EP.uid();
    i.name = String(i.name || '').slice(0, 120);
    i.w = EP.safeNum(i.w, 63, 5, 600); i.h = EP.safeNum(i.h, 88, 5, 600);
    i.copies = EP.safeNum(i.copies, 1, 1, 200) | 0;
    i.radius = EP.safeNum(i.radius, 0, 0, 50);
    if (!['rect', 'circle', 'hex'].includes(i.shape)) i.shape = 'rect';
    fixFace(i.front); fixFace(i.back);
    if (i.kind === 'board') {
      i.sheets.cols = EP.safeNum(i.sheets.cols, 2, 1, 6) | 0; i.sheets.rows = EP.safeNum(i.sheets.rows, 2, 1, 6) | 0;
      if (!EP.PATTERNS[i.pattern.type]) i.pattern.type = 'none';
      ['color', 'fill', 'fillAlt'].forEach(k => i.pattern[k] = EP.safeColor(i.pattern[k], '#334155'));
      i.pattern.n = EP.safeNum(i.pattern.n, 8, 2, 40) | 0; i.pattern.width = EP.safeNum(i.pattern.width, 0.6, 0, 5);
      i.pattern.opacity = EP.safeNum(i.pattern.opacity, 100, 0, 100);
      i.pattern.count = EP.safeNum(i.pattern.count, 0, 0, 400) | 0;
      i.pattern.labelSize = EP.safeNum(i.pattern.labelSize, 0, 0, 60);
      i.pattern.numbers = i.pattern.numbers !== false;
      i.pattern.labels = (Array.isArray(i.pattern.labels) ? i.pattern.labels : []).slice(0, 400).map(t => String(t ?? '').slice(0, 200));
      i.pattern.colors = (Array.isArray(i.pattern.colors) ? i.pattern.colors : []).slice(0, 400).map(c => EP.safeColor(c, ''));
    }
    return i;
  });
  ['players', 'time', 'age', 'objective', 'rules', 'materials', 'facilitator', 'closing', 'ideas'].forEach(k => p.info[k] = String(p.info[k] || '').slice(0, 8000));
  p.versions = []; // las versiones guardadas no viajan al importar (pueden ser pesadas)
  if (!EP.PAPERS[p.print.paper]) p.print.paper = 'carta';
  p.print.margin = EP.safeNum(p.print.margin, 8, 3, 30); p.print.gap = EP.safeNum(p.print.gap, 0, 0, 20);
  return p;
};

/* ---------- Deshacer / rehacer ---------- */
EP.history = { stack: [], index: -1, timer: null, lock: false };
EP.snapshot = () => {
  const p = EP.state.project;
  return JSON.stringify({ name: p.name, info: p.info, items: p.items, print: p.print });
};
EP.historyReset = () => { EP.history.stack = [EP.snapshot()]; EP.history.index = 0; EP.ui.updateUndo(); };
EP.historyPush = () => {
  const h = EP.history, s = EP.snapshot();
  if (h.stack[h.index] === s) return;
  h.stack = h.stack.slice(0, h.index + 1);
  h.stack.push(s);
  if (h.stack.length > 80) h.stack.shift();
  h.index = h.stack.length - 1;
  EP.ui.updateUndo();
};
EP.historyGo = (d) => {
  const h = EP.history;
  clearTimeout(h.timer);
  EP.historyPush();
  const ni = h.index + d;
  if (ni < 0 || ni >= h.stack.length) return;
  h.index = ni;
  Object.assign(EP.state.project, JSON.parse(h.stack[ni]));
  if (!EP.sel()) EP.state.selectedId = null;
  EP.ui.updateUndo();
  EP.commit({ structure: true, history: false });
};

/* ---------- Guardado automático ---------- */
EP.saveTimer = null;
EP.save = () => {
  clearTimeout(EP.saveTimer);
  EP._dirty = true; // hay cambios sin guardar (Drive espera a que se guarden)
  EP.ui.setStatus('Guardando…');
  EP.saveTimer = setTimeout(async () => {
    try {
      await EP.db.put(EP.state.project);
      EP._dirty = false;
      localStorage.setItem('ep2_last', EP.state.project.id);
      EP.ui.setStatus('Guardado');
    } catch (e) {
      console.error(e);
      EP.ui.setStatus('No se pudo guardar', true);
      EP.ui.toast('No se pudo guardar. Descarga un respaldo desde la pestaña Juegos.', 'error');
    }
  }, 600);
};

/* Punto único de cambios: guarda, registra para deshacer y redibuja */
EP.commit = (opts = {}) => {
  const { structure = false, history = true, editor = structure } = opts;
  if (history) {
    clearTimeout(EP.history.timer);
    EP.history.timer = setTimeout(EP.historyPush, structure ? 0 : 450);
  }
  EP.save();
  EP.ui.renderCenter();
  if (editor) EP.ui.renderEditor();
  if (structure) EP.ui.renderLeft();
  EP.ui.renderTop();
};

/* ---------- Acciones ---------- */
EP.actions = {
  add(items, { select = true } = {}) {
    const arr = Array.isArray(items) ? items : [items];
    EP.state.project.items.push(...arr);
    if (select && arr.length) { EP.state.selectedId = arr[arr.length - 1].id; EP.state.side = 'front'; }
    EP.commit({ structure: true });
    EP.ui.scrollToSelected();
  },
  /* additive = Ctrl/Mayús + clic: va sumando piezas a la selección (para imprimir solo esas) */
  select(id, additive = false) {
    const multi = EP.state.multi;
    if (additive && id) {
      if (EP.state.selectedId && !multi.size) multi.add(EP.state.selectedId);
      if (multi.has(id)) { multi.delete(id); id = [...multi].pop() || null; } else multi.add(id);
      if (multi.size < 2) multi.clear();
    } else multi.clear();
    EP.state.selectedId = id;
    const it = EP.sel();
    if (it && it.kind === 'board') EP.state.side = 'front';
    EP.ui.renderCenter();
    EP.ui.renderEditor();
    // En el celular el editor queda abajo de la mesa: se baja hasta él al tocar una pieza
    if (id && !additive && window.matchMedia && matchMedia('(max-width: 700px)').matches) {
      const ed = document.getElementById('editor');
      if (ed) setTimeout(() => ed.scrollIntoView({ block: 'start' }), 0);
    }
  },
  remove(id) {
    const p = EP.state.project, i = p.items.findIndex(x => x.id === id);
    if (i < 0) return;
    const name = p.items[i].name;
    p.items.splice(i, 1);
    if (EP.state.selectedId === id) EP.state.selectedId = p.items[Math.min(i, p.items.length - 1)]?.id || null;
    EP.commit({ structure: true });
    EP.ui.toast(`Eliminaste «${name}».`, 'info', { label: 'Deshacer', fn: () => EP.historyGo(-1) });
  },
  duplicate(id) {
    const p = EP.state.project, i = p.items.findIndex(x => x.id === id);
    if (i < 0) return;
    const c = EP.clone(p.items[i]);
    c.id = EP.uid();
    c.name = c.name + ' (copia)';
    p.items.splice(i + 1, 0, c);
    EP.state.selectedId = c.id;
    EP.commit({ structure: true });
  },
  move(id, d) {
    const a = EP.state.project.items, i = a.findIndex(x => x.id === id), j = i + d;
    if (i < 0 || j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    EP.commit({ structure: true });
  },
  async setImage(item, side, file) {
    try {
      const max = item.kind === 'board' ? 4200 : 1800;
      const id = await EP.importImage(file, EP.state.project, max);
      item[side].image = id;
      if (item[side].layout === 'texto' && !item[side].title && !item[side].text) item[side].layout = 'imagen';
      // En un tablero con dibujo, las casillas pasan a transparentes para que se vea la imagen
      if (item.kind === 'board' && item.pattern && item.pattern.type !== 'none' && item.pattern.opacity === 100) {
        item.pattern.opacity = 0;
        EP.ui.toast('Dejé las casillas transparentes para que se vea la imagen. Puedes cambiarlo en «Tamaño y dibujo».', 'ok');
      }
      EP.commit({ editor: true });
      EP.ui.toast('Imagen agregada.', 'ok');
    } catch (e) {
      EP.ui.toast(e.message || 'No se pudo cargar la imagen.', 'error');
    }
  },
  /* Arrastrar en la mesa: deja la pieza "id" en el lugar de "targetId" */
  moveTo(id, targetId) {
    const items = EP.state.project.items;
    const from = items.findIndex(i => i.id === id), to = items.findIndex(i => i.id === targetId);
    if (from < 0 || to < 0 || from === to) return;
    const [it] = items.splice(from, 1);
    items.splice(to, 0, it);
    EP.commit({ structure: true });
  },
  clearImage(item, side) {
    item[side].image = null;
    EP.commit({ editor: true });
  },
  /* Copia el dorso del elemento a todos los del mismo tipo y medida */
  backToAll(item) {
    let n = 0;
    EP.state.project.items.forEach(o => {
      if (o !== item && o.kind === item.kind && o.w === item.w && o.h === item.h) { o.back = EP.clone(item.back); n++; }
    });
    EP.commit({});
    EP.ui.toast(n ? `Dorso aplicado a ${n} elemento${n > 1 ? 's' : ''} más.` : 'No hay otros elementos de la misma medida.', n ? 'ok' : 'info');
  },
  /* Copia colores, letras y bordes del frente (no los textos ni la imagen) */
  styleToAll(item) {
    const keep = ['title', 'text', 'footer', 'image', 'icon', 'imgX', 'imgY', 'imgZoom'];
    let n = 0;
    EP.state.project.items.forEach(o => {
      if (o === item || o.kind !== item.kind) return;
      const f = EP.clone(item.front);
      keep.forEach(k => f[k] = o.front[k]);
      o.front = f; n++;
    });
    EP.commit({});
    EP.ui.toast(n ? `Estilo copiado a ${n} elemento${n > 1 ? 's' : ''}.` : 'No hay otros elementos de este tipo.', n ? 'ok' : 'info');
  },
  /* Crea un mazo a partir de un texto: una carta por línea, "Título | texto" */
  deckFromText(text, template) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (!lines.length) { EP.ui.toast('Escribe al menos una línea.', 'info'); return; }
    const cards = lines.map((l, i) => {
      const [t, ...rest] = l.split('|');
      const c = template ? EP.clone(template) : EP.newCard();
      c.id = EP.uid();
      c.copies = 1;
      const hasText = rest.length > 0;
      c.front.title = hasText ? t.trim() : (template ? t.trim() : t.trim());
      c.front.text = hasText ? rest.join('|').trim() : '';
      c.name = (t.trim() || 'Carta ' + (i + 1)).slice(0, 40);
      return c;
    });
    EP.actions.add(cards);
    EP.ui.toast(`Creaste ${cards.length} carta${cards.length > 1 ? 's' : ''}.`, 'ok');
  },
  insertTemplate(tpl) {
    const items = tpl.build();
    const info = EP.state.project.info;
    if (tpl.info && !info.rules && !info.objective) Object.assign(info, tpl.info);
    EP.actions.add(items);
    EP.ui.toast(`Agregaste «${tpl.name}» (${items.length} elemento${items.length > 1 ? 's' : ''}).`, 'ok');
  }
};

/* ---------- Juegos (proyectos) ---------- */
EP.games = {
  async open(id) {
    const p = await EP.db.get(id);
    if (!p) { EP.ui.toast('No encontré ese juego.', 'error'); return; }
    EP._blobCache = {};
    EP.state.project = EP.normalizeProject(p);
    EP.pruneAssets(EP.state.project); // limpia imágenes que ya no se usan
    EP.state.selectedId = null;
    EP.state.side = 'front';
    localStorage.setItem('ep2_last', id);
    EP.historyReset();
    EP.ui.renderAll();
  },
  async create(name) {
    const p = EP.newProject(name || 'Juego nuevo');
    await EP.db.put(p);
    await EP.games.open(p.id);
    EP.ui.toast('Juego creado. Empieza agregando cartas, fichas o un tablero.', 'ok');
  },
  async duplicate(id) {
    const p = await EP.db.get(id);
    const c = EP.clone(p);
    c.id = EP.uid(); c.name = p.name + ' (copia)'; c.created = Date.now();
    await EP.db.put(c);
    EP.ui.renderLeft();
    EP.ui.toast('Juego duplicado.', 'ok');
  },
  async remove(id) {
    await EP.db.remove(id);
    if (EP.state.project.id === id) {
      const list = await EP.db.list();
      if (list.length) await EP.games.open(list[0].id); else await EP.games.create('Mi primer juego');
    } else EP.ui.renderLeft();
  },
  async exportOne(id) {
    const p = id === EP.state.project.id ? EP.state.project : await EP.db.get(id);
    EP.download(`${EP.slug(p.name)}.estudio-ep.json`, JSON.stringify(Object.assign({ format: 'estudio-ep', appVersion: EP.APP_VERSION }, p)));
  },
  async exportAll() {
    const metas = await EP.db.list();
    const all = [];
    for (const m of metas) all.push(await EP.db.get(m.id));
    EP.download(`respaldo-estudio-ep-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify({ format: 'estudio-ep-backup', appVersion: EP.APP_VERSION, projects: all }));
    EP.ui.toast(`Respaldo descargado (${all.length} juego${all.length !== 1 ? 's' : ''}).`, 'ok');
  },
  async importFile(file) {
    try {
      if (file.size > 150 * 1024 * 1024) throw new Error('El archivo es demasiado grande.');
      const data = JSON.parse(await file.text());
      // JSON hecho con otra IA o herramienta: lo lee el lector inteligente
      if (!EP.importer.isNative(data)) return EP.importer.open(data, file.name, 'new');
      const list = data.format === 'estudio-ep-backup' && Array.isArray(data.projects) ? data.projects : [data];
      let last = null;
      for (const raw of list) {
        const p = EP.sanitizeProject(raw);
        p.id = EP.uid();
        await EP.db.put(p);
        last = p;
      }
      if (last) await EP.games.open(last.id);
      EP.ui.toast(`Importaste ${list.length} juego${list.length > 1 ? 's' : ''}.`, 'ok');
    } catch (e) {
      EP.ui.toast(e instanceof SyntaxError ? 'El archivo no es un respaldo válido.' : e.message, 'error');
    }
  }
};

/* ---------- Versiones: puntos guardados para volver atrás ---------- */
EP.versions = {
  MAX: 25,
  save(name) {
    const p = EP.state.project;
    p.versions = p.versions || [];
    p.versions.unshift({ id: EP.uid(), name: (name || 'Versión ' + (p.versions.length + 1)).slice(0, 80), date: Date.now(),
      count: p.items.length, data: JSON.stringify({ name: p.name, info: p.info, items: p.items, print: p.print }) });
    if (p.versions.length > EP.versions.MAX) p.versions.length = EP.versions.MAX;
    EP.commit({ structure: true, history: false });
    EP.ui.toast(`Guardaste «${p.versions[0].name}». Puedes volver a ella cuando quieras.`, 'ok');
  },
  restore(id) {
    const p = EP.state.project, v = (p.versions || []).find(x => x.id === id);
    if (!v) return;
    // Lo último editado entra al historial ya, para que "Deshacer" vuelva justo aquí
    clearTimeout(EP.history.timer);
    EP.historyPush();
    // Antes de volver, se guarda el estado actual para no perder nada
    p.versions.unshift({ id: EP.uid(), name: 'Antes de volver a «' + v.name + '»', date: Date.now(), count: p.items.length,
      data: JSON.stringify({ name: p.name, info: p.info, items: p.items, print: p.print }) });
    if (p.versions.length > EP.versions.MAX) p.versions.length = EP.versions.MAX;
    const d = JSON.parse(v.data);
    const fixed = EP.normalizeProject(Object.assign({}, d, { id: p.id, assets: p.assets }));
    p.info = fixed.info; p.items = fixed.items; p.print = fixed.print;
    EP.state.selectedId = null; EP.state.multi.clear();
    EP.commit({ structure: true });
    EP.ui.toast(`Volviste a «${v.name}».`, 'ok', { label: 'Deshacer', fn: () => EP.historyGo(-1) });
  },
  remove(id) {
    const p = EP.state.project;
    p.versions = (p.versions || []).filter(x => x.id !== id);
    EP.commit({ structure: true, history: false });
  }
};

/* ---------- Imprimir ---------- */
EP.print = () => {
  const p = EP.state.project;
  const { pages } = EP.buildPages(p, EP.selectedIds());
  if (!pages.length) { EP.ui.toast('No hay nada para imprimir. Agrega elementos o revisa qué incluir.', 'info'); return; }
  // Recordatorio de la ventana de la impresora (es lo que más descuadra): se puede ocultar
  let skip = false;
  try { skip = localStorage.getItem('ep2_print_tip') === 'no'; } catch (e) { /* opcional */ }
  if (!skip && !EP._printTipShown) {
    EP._printTipShown = true;
    EP.ui.printTip(() => EP.print());
    return;
  }
  EP.setPageCSS(p);
  const root = document.getElementById('print-root');
  root.replaceChildren(...pages.map(d => EP.renderPage(d, p)));
  // Esperar a que carguen imágenes y letras antes de abrir el diálogo
  const imgs = [...root.querySelectorAll('img')].map(i => i.complete ? null : new Promise(r => { i.onload = i.onerror = r; })).filter(Boolean);
  Promise.all([...imgs, document.fonts ? document.fonts.ready : null]).then(() => {
    window.print();
    setTimeout(() => root.replaceChildren(), 500);
  });
};

/* ---------- Inicio ---------- */
EP.boot = async () => {
  EP.ui.init();
  // ?demo abre un juego de ejemplo con los kits del catálogo (útil para mostrar la app)
  const q = new URLSearchParams(location.search);
  if (q.has('demo')) {
    EP.state.project = EP.newProject('Juego de ejemplo');
    ['vih', 'mitos', 'emociones', 'fichas', 'tab-recorrido'].forEach(id => {
      const t = EP.CATALOG.find(c => c.id === id);
      EP.state.project.items.push(...t.build());
      if (t.info) Object.assign(EP.state.project.info, t.info);
    });
    EP.save = () => {}; // el ejemplo no se guarda
    if (q.get('view') === 'print') EP.state.view = 'print';
    if (q.get('tab')) EP.state.tab = q.get('tab');
    if (q.has('sel')) EP.state.selectedId = EP.state.project.items[+q.get('sel') || 0].id;
    EP.historyReset();
    EP.ui.renderAll();
    if (q.get('scroll') === 'board') setTimeout(() => document.querySelector('.pv-page.board')?.scrollIntoView(), 300);
    return;
  }
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* opcional */ }
  // App instalable en el celular y usable sin señal (solo cuando se abre desde su página web)
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
  if (EP.drive) EP.drive.init();
  try {
    const last = localStorage.getItem('ep2_last');
    const list = await EP.db.list();
    if (last && list.some(m => m.id === last)) await EP.games.open(last);
    else if (list.length) await EP.games.open(list[0].id);
    else {
      const p = EP.newProject('Mi primer juego');
      await EP.db.put(p);
      await EP.games.open(p.id);
      EP.ui.showWelcome();
    }
  } catch (e) {
    console.error(e);
    EP.state.project = EP.newProject('Mi primer juego');
    EP.historyReset();
    EP.ui.renderAll();
    EP.ui.toast('El navegador no permite guardar aquí. Usa Chrome o Edge y descarga respaldos seguido.', 'error');
  }
};

document.addEventListener('DOMContentLoaded', EP.boot);
