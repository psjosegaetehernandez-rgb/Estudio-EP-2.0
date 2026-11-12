/* Estudio EP — Lector de JSON de cualquier IA.
   Toma un JSON hecho con DeepSeek, ChatGPT, un script, etc. (no necesita el formato de Estudio EP),
   adivina qué es cada cosa (mazos de cartas, fichas, tableros, casillas de un recorrido, datos del juego)
   y crea las piezas. Antes de crear muestra un resumen para confirmar.
   Las imágenes que nombra el JSON (por ejemplo "S01.jpg") se buscan en Mi material.
   Nunca se usa innerHTML: todo texto del archivo entra como texto. */
window.EP = window.EP || {};

(() => {
  const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  const pretty = (k) => {
    const s = String(k).replace(/[_-]+/g, ' ').trim();
    return (s.charAt(0).toUpperCase() + s.slice(1)).replace(/cion\b/g, 'ción').replace(/sion\b/g, 'sión');
  };
  const IMG_FILE = /^[\w .()\-áéíóúñÁÉÍÓÚÑ]{1,120}\.(png|jpe?g|webp|gif)$/i;

  /* Cómo se llaman los campos en los JSON que hacen las IA */
  const F_TITLE = ['titulo', 'title', 'nombre', 'name', 'concepto', 'palabra', 'personaje', 'carta'];
  const F_IMAGE = ['imagen', 'image', 'img', 'prompt_ia', 'ilustracion', 'foto', 'archivo', 'picture'];
  const F_COPIES = ['cantidad', 'copias', 'copies', 'cantidad_copias', 'numero_copias', 'repeticiones'];
  const F_SIZE = ['tamano', 'tamaño', 'size', 'medida', 'diametro'];
  const F_SKIP = ['id', 'codigo', 'code', 'version', 'posicion', 'position', 'orden', 'order', 'formato', 'format', 'prompt'];
  const F_TEXT = ['situacion', 'texto', 'text', 'descripcion', 'description', 'contenido', 'efecto', 'instruccion', 'instrucciones',
    'don', 'poder', 'habilidad', 'funcion', 'accion', 'reto', 'mision', 'definicion', 'mito', 'realidad', 'dato',
    'pregunta', 'reflexion', 'consigna', 'respuesta'];
  const F_INFO = { name: ['titulo', 'title', 'nombre', 'name'], objective: ['descripcion', 'description', 'objetivo', 'proposito'],
    players: ['jugadores', 'players', 'participantes'], time: ['duracion', 'tiempo', 'time', 'duration'],
    age: ['edad', 'publico', 'age', 'publico_objetivo'], rules: ['reglas', 'rules', 'instrucciones', 'como_jugar', 'reglamento'] };

  const pick = (o, keys) => { for (const k of Object.keys(o)) if (keys.includes(norm(k))) return k; return null; };

  const COLORS = { amarillo: '#d4a106', verde: '#15803d', azul: '#1d4ed8', rojo: '#b91c1c', morado: '#6d28d9', violeta: '#6d28d9',
    naranja: '#c2410c', rosado: '#be185d', rosa: '#be185d', negro: '#111827', gris: '#4b5563', celeste: '#0284c7', cafe: '#78350f', blanco: '#64748b' };
  const PALETTE = ['#1e3a5f', '#7c2d12', '#14532d', '#4c1d95', '#831843', '#134e4a', '#713f12', '#3f3f46'];
  const CELL_COLORS = ['#fde68a', '#bbf7d0', '#bfdbfe', '#fecaca', '#ddd6fe', '#fed7aa', '#a5f3fc', '#f5d0fe', '#e2e8f0'];
  const textOn = (hex) => {
    const h = hex.replace('#', ''), r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#1c1917' : '#ffffff';
  };

  /* ---------- 1. Analizar: encontrar los grupos de piezas ---------- */
  EP.importer = {};

  EP.importer.isNative = (d) => d && (Array.isArray(d.items) || (d.format === 'estudio-ep-backup' && Array.isArray(d.projects)));

  EP.importer.analyze = (data, fileName = '') => {
    const plan = { name: '', info: {}, groups: [], notes: [] };
    if (Array.isArray(data)) data = { cartas: data };
    if (!isObj(data)) throw new Error('El archivo no tiene una estructura que pueda leer.');

    const readInfo = (o) => {
      for (const [field, keys] of Object.entries(F_INFO)) {
        const k = pick(o, keys);
        if (k && (typeof o[k] === 'string' || typeof o[k] === 'number')) {
          if (field === 'name') plan.name = plan.name || String(o[k]);
          else plan.info[field] = plan.info[field] || String(o[k]);
        }
      }
      const a = pick(o, ['autor', 'author']);
      if (a && typeof o[a] === 'string') plan.notes.push('Autor: ' + o[a]);
    };

    const addGroup = (key, parent, arr) => {
      const items = arr.filter(v => isObj(v) || typeof v === 'string').slice(0, 500);
      if (!items.length) return;
      plan.groups.push({ key, parent, items, kind: guessKind(key, parent, items), include: true });
    };

    const walk = (o, parent, depth) => {
      for (const [k, v] of Object.entries(o)) {
        const nk = norm(k);
        if (['info', 'meta', 'metadata', 'juego', 'datos', 'game'].includes(nk) && isObj(v)) { readInfo(v); if (depth < 2) walk(v, k, depth + 1); continue; }
        if (Array.isArray(v)) { addGroup(k, parent, v); continue; }
        if (isObj(v) && depth < 3) {
          // Objeto cuyos valores son objetos (p. ej. tokens: { agua: {...}, corazon: {...} }) → un grupo con todos
          const objVals = Object.entries(v).filter(([, x]) => isObj(x));
          if (objVals.length && objVals.every(([, x]) => !Object.values(x).some(Array.isArray))) {
            addGroup(k, parent, objVals.map(([name, x]) => Object.assign({ nombre: pretty(name) }, x)));
          }
          walk(Object.fromEntries(Object.entries(v).filter(([, x]) => Array.isArray(x) || (isObj(x) && Object.values(x).some(y => Array.isArray(y) || isObj(y))))), k, depth + 1);
        }
      }
      if (depth === 0) readInfo(o);
    };
    walk(data, '', 0);

    if (!plan.name) plan.name = fileName.replace(/\.json$/i, '').replace(/[_-]+/g, ' ').trim() || 'Juego importado';
    if (!plan.groups.length) throw new Error('No encontré listas de cartas, fichas ni tableros en el archivo.');
    plan.groups.forEach(g => { g.label = groupLabel(g); });
    return plan;
  };

  const guessKind = (key, parent, items) => {
    const k = norm(key), p = norm(parent || '');
    const objs = items.filter(isObj);
    const has = (names) => objs.some(o => pick(o, names));
    const longText = objs.some(o => Object.entries(o).some(([kk, v]) => typeof v === 'string' && v.length > 40 && !F_IMAGE.includes(norm(kk))));
    if (/^(tablero|casillas|recorrido|camino|board|cells|ruta)$/.test(k) && !has(['formato', 'format'])) return 'cells';
    if (/^(tableros|boards|mapas|escenarios)$/.test(k) || has(['formato', 'format'])) return 'board';
    if (/(token|marcador|moneda|contador|peon)/.test(k)) return 'token'; // su función va a las reglas
    if (/(token|ficha|pieza|marcador|moneda|contador|peon)/.test(k + ' ' + p) && !longText) return 'token';
    return 'card';
  };

  const groupLabel = (g) => {
    const k = pretty(g.key);
    if (g.kind === 'cells') return 'Recorrido de ' + g.items.length + ' casillas';
    if (g.parent && /mazo|deck|cartas/.test(norm(g.parent))) return 'Mazo ' + k.toLowerCase();
    return k;
  };

  /* ---------- 2. Convertir cada grupo en piezas ---------- */
  const fieldsOf = (o) => {
    const t = pick(o, F_TITLE), im = pick(o, F_IMAGE), cp = pick(o, F_COPIES), sz = pick(o, F_SIZE);
    const used = new Set([t, im, cp, sz].filter(Boolean));
    const text = [], foot = [];
    const entries = Object.entries(o).filter(([k, v]) => !used.has(k) && !F_SKIP.includes(norm(k)) && (typeof v === 'string' || typeof v === 'number') && String(v).trim());
    entries.sort((a, b) => {
      const ia = F_TEXT.indexOf(norm(a[0])), ib = F_TEXT.indexOf(norm(b[0]));
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    entries.forEach(([k, v]) => {
      v = String(v).trim();
      if (F_TEXT.includes(norm(k)) || v.length > 28) text.push([k, v]); else foot.push(v);
    });
    const MAIN = ['situacion', 'texto', 'text', 'descripcion', 'description', 'contenido', 'efecto'];
    const body = text.map(([k, v], i) => ((i === 0 && (MAIN.includes(norm(k)) || text.length === 1)) || /^[¿¡"«]/.test(v)) ? v : `${pretty(k)}: ${v}`).join('\n\n');
    const img = im && typeof o[im] === 'string' && IMG_FILE.test(o[im].split(/[\\/]/).pop()) ? o[im].split(/[\\/]/).pop() : '';
    const copies = cp ? Math.max(1, Math.min(200, parseInt(o[cp], 10) || 1)) : 1;
    const size = sz ? parseFloat(String(o[sz]).replace(',', '.')) : 0;
    return { title: t ? String(o[t]).trim() : '', body, footer: foot.join(' · '), img, copies, size };
  };

  const build = {
    card(g, color) {
      const objs = g.items.map(x => isObj(x) ? fieldsOf(x) : { title: '', body: String(x), footer: '', img: '', copies: 1 });
      const avg = objs.reduce((s, o) => s + o.body.length + o.title.length, 0) / objs.length;
      const anyImg = objs.some(o => o.img);
      const sizeId = (anyImg && avg > 110) || avg > 260 ? 'tarot' : 'poker';
      const textSize = avg > 220 ? 8 : avg > 140 ? 9 : 10;
      const fg = textOn(color);
      return objs.map((o, i) => {
        const c = EP.newCard({
          name: (o.title || g.label + ' ' + (i + 1)).slice(0, 60), sizeId, copies: o.copies,
          front: { layout: 'banda', title: o.title, text: o.body, footer: o.footer, accent: color, titleColor: fg,
            titleFont: 'Merriweather', titleSize: 12, textSize, valign: 'center', imgRef: o.img },
          back: { bg: color, icon: '', title: g.label, titleColor: fg, titleFont: 'Bebas', titleSize: 22, borderW: 2, borderColor: fg === '#ffffff' ? '#ffffff' : '#1c1917' }
        });
        return c;
      });
    },
    token(g, color) {
      return g.items.map((x, i) => {
        const o = isObj(x) ? fieldsOf(x) : { title: String(x), body: '', footer: '', img: '', copies: 1, size: 0 };
        const d = o.size >= 10 && o.size <= 120 ? o.size : 30;
        return EP.newToken({
          name: (o.title || g.label + ' ' + (i + 1)).slice(0, 60), size: d, copies: o.copies,
          front: { bg: color, icon: '', title: o.title, titleColor: textOn(color), titleSize: Math.max(6, Math.round(d / 4)), titleFont: 'Inter',
            borderColor: '#1c1917', imgRef: o.img },
          back: { bg: '#1c1917' }
        });
      });
    },
    board(g) {
      return g.items.filter(isObj).map((x, i) => {
        const o = fieldsOf(x);
        const fk = pick(x, ['formato', 'format']);
        let orient = 'portrait';
        if (fk) {
          const [a, b] = String(x[fk]).split(/[:x×/]/).map(Number);
          if (a && b && a > b) orient = 'landscape';
        }
        return EP.newBoard({
          name: (o.title || 'Tablero ' + (i + 1)).slice(0, 60),
          sheets: { cols: 2, rows: 2, orient },
          front: { title: o.title, text: o.body, imgRef: o.img, valign: 'top' }
        });
      });
    },
    cells(g, color, plan) {
      const objs = g.items.map((x, i) => isObj(x) ? x : { texto: String(x), posicion: i + 1 });
      const posK = objs.length && pick(objs[0], ['posicion', 'position', 'numero', 'casilla', 'orden']);
      if (posK) objs.sort((a, b) => (Number(a[posK]) || 0) - (Number(b[posK]) || 0));
      const typeK = objs.length && pick(objs[0], ['tipo', 'type', 'categoria', 'clase']);
      const types = [];
      const labels = objs.map(o => {
        const t = pick(o, ['nombre', 'titulo', 'texto', 'text', 'accion', 'descripcion']);
        if (t) return String(o[t]).slice(0, 200);
        return typeK ? pretty(o[typeK]) : '';
      });
      const colors = objs.map(o => {
        if (!typeK) return '';
        const t = norm(o[typeK]);
        if (!types.includes(t)) types.push(t);
        return CELL_COLORS[types.indexOf(t) % CELL_COLORS.length];
      });
      const count = objs.length;
      // Elige recorrido por el borde si son pocas casillas, o serpiente si son muchas, con casillas lo más grandes posible
      const b = EP.newBoard({ name: 'Tablero: ' + plan.name.slice(0, 50), sheets: { cols: 2, rows: 2, orient: 'portrait' },
        pattern: { type: count <= 60 ? 'track' : 'snake', count, labels, colors, numbers: true, width: 0.6, color: '#1c1917', fill: '#ffffff', fillAlt: '#f8fafc' },
        front: { title: plan.name, titleSize: 40, valign: 'center', accent: color, text: types.length ? 'Casillas: ' + types.map(pretty).join(', ') : '' } });
      const { w, h } = EP.itemSize(b, EP.state.project);
      for (let n = 3; n <= 20; n++) {
        b.pattern.n = n;
        if (EP.patternCapacity(b.pattern, w, h) >= count) break;
      }
      if (EP.patternCapacity(b.pattern, w, h) < count) { b.pattern.type = 'snake'; for (let n = 3; n <= 20; n++) { b.pattern.n = n; if (EP.patternCapacity(b.pattern, w, h) >= count) break; } }
      return [b];
    }
  };

  /* ---------- 3. Imágenes: buscar en Mi material los archivos que nombra el JSON ---------- */
  EP.importer.linkImages = async (project, items, onProgress) => {
    const M = EP.material;
    if (!M.images.length && !M.local && !M.loading) { try { await EP.loadMaterial(); } catch (e) { /* sin material */ } }
    const byName = new Map(M.images.map(m => [norm(m.name), m]));
    const missing = new Set();
    let found = 0, done = 0;
    const todo = [];
    (items || project.items).forEach(it => ['front', 'back'].forEach(side => {
      const f = it[side];
      if (f && f.imgRef && !f.image) todo.push([it, f]);
    }));
    for (const [it, f] of todo) {
      const m = byName.get(norm(EP.prettyName(f.imgRef)));
      if (!m) { missing.add(f.imgRef); continue; }
      try {
        const file = await EP.materialFile(m);
        f.image = await EP.importImage(file, project, it.kind === 'board' ? 4200 : 1800);
        if (it.kind === 'card' && f.layout === 'banda') {
          // Con imagen arriba el título queda sobre blanco: se oscurece y el color del mazo pasa al borde
          f.layout = 'imagen_texto';
          f.titleColor = '#1c1917';
          f.borderW = 1.5; f.borderColor = f.accent;
        }
        else if (it.kind !== 'card' || (!f.title && !f.text)) f.layout = 'imagen';
        found++;
      } catch (e) { missing.add(f.imgRef); }
      if (onProgress) onProgress(++done, todo.length);
    }
    return { found, missing: [...missing] };
  };

  /* ---------- 4. Crear ---------- */
  EP.importer.create = async (plan, mode) => {
    const groups = plan.groups.filter(g => g.include);
    if (mode === 'new') {
      const p = EP.newProject(plan.name.slice(0, 120));
      Object.assign(p.info, plan.info);
      await EP.db.put(p);
      await EP.games.open(p.id);
    }
    const project = EP.state.project;
    let ci = 0;
    const items = [];
    groups.forEach(g => {
      const key = norm(g.key);
      const color = COLORS[key] || PALETTE[ci++ % PALETTE.length];
      items.push(...build[g.kind](g, color, plan));
    });
    // Las funciones de las fichas (p. ej. "Se gasta para usar Poder Personal") van a las reglas
    const tokenNotes = groups.filter(g => g.kind === 'token').flatMap(g => g.items.filter(isObj).map(o => {
      const f = fieldsOf(o);
      return f.body ? `${f.title}${f.copies > 1 ? ` (${f.copies})` : ''}: ${f.body}` : '';
    })).filter(Boolean);
    const info = project.info;
    if (mode !== 'new' && !info.objective && plan.info.objective) Object.assign(info, plan.info);
    if (tokenNotes.length && !/Fichas:/.test(info.rules)) info.rules = (info.rules ? info.rules + '\n\n' : '') + 'Fichas:\n' + tokenNotes.join('\n');

    project.items.push(...items);
    EP.state.selectedId = null;
    EP.commit({ structure: true });

    const withRef = items.filter(i => i.front.imgRef || i.back.imgRef).length;
    let res = { found: 0, missing: [] };
    if (withRef) {
      EP.ui.setStatus('Buscando imágenes…');
      res = await EP.importer.linkImages(project, items, (d, t) => EP.ui.setStatus(`Cargando imágenes ${d} de ${t}…`));
      EP.commit({ structure: true });
    }
    const msg = `Creé ${items.length} piezas de «${plan.name}».` +
      (withRef ? ` Encontré ${res.found} imágenes` + (res.missing.length ? `; faltan ${res.missing.length} (súbelas a Mi material y pulsa «Buscar imágenes»).` : '.') : '');
    EP.ui.toast(msg, res.missing.length ? 'info' : 'ok');
    return { items, ...res };
  };

  /* ---------- 5. Ventana de confirmación ---------- */
  const KIND_NAMES = { card: 'Cartas', token: 'Fichas', board: 'Tableros', cells: 'Casillas de un tablero' };

  EP.importer.open = (data, fileName, defaultMode = 'new') => {
    let plan;
    try { plan = EP.importer.analyze(data, fileName); } catch (e) { EP.ui.toast(e.message, 'error'); return; }
    const F = EP.F, d = document.getElementById('dlg'), body = document.getElementById('dlgBody');
    body.replaceChildren();
    const h = EP.el('h2'); h.textContent = 'Leer «' + plan.name + '»';
    const intro = F.p('Encontré esto en el archivo. Revisa qué crear y de qué tipo es cada grupo.', 'dlg-text');
    const list = EP.el('div', 'imp-list');
    plan.groups.forEach(g => {
      const row = EP.el('div', 'imp-row');
      const ck = EP.el('input'); ck.type = 'checkbox'; ck.checked = true; ck.id = 'imp-' + Math.random().toString(36).slice(2);
      ck.addEventListener('change', () => { g.include = ck.checked; });
      const lab = EP.el('label'); lab.htmlFor = ck.id;
      const nm = EP.el('strong'); nm.textContent = g.label;
      const ct = EP.el('span', 'imp-count'); ct.textContent = g.kind === 'cells' ? '1 tablero' : `${g.items.length} ${g.items.length === 1 ? 'pieza' : 'piezas'}`;
      lab.append(nm, ct);
      const sel = EP.el('select');
      Object.entries(KIND_NAMES).forEach(([v, t]) => { const o = EP.el('option'); o.value = v; o.textContent = t; sel.appendChild(o); });
      sel.value = g.kind;
      sel.setAttribute('aria-label', 'Tipo de ' + g.label);
      sel.addEventListener('change', () => { g.kind = sel.value; g.label = groupLabel(g); nm.textContent = g.label; });
      const sample = EP.el('div', 'imp-sample');
      const first = g.items[0];
      const fo = isObj(first) ? fieldsOf(first) : { title: String(first), body: '' };
      sample.textContent = [fo.title, fo.body].filter(Boolean).join(' — ').slice(0, 110) + ((fo.title + fo.body).length > 110 ? '…' : '');
      row.append(ck, lab, sel, sample);
      list.appendChild(row);
    });
    const imgCount = plan.groups.reduce((s, g) => s + g.items.filter(x => isObj(x) && fieldsOf(x).img).length, 0);
    const extra = [];
    if (Object.keys(plan.info).length) extra.push('Datos del juego (descripción, jugadores, duración) van a la ficha del juego.');
    if (imgCount) extra.push(`El archivo nombra ${imgCount} imágenes. Las busco en Mi material (carpeta mi-material/imagenes o la carpeta que abriste).`);
    const actions = EP.el('div', 'dlg-actions');
    const go = (mode) => async () => { d.close(); await EP.importer.create(plan, mode); };
    actions.append(
      F.btn('Cancelar', null, () => d.close(), 'ghost'),
      F.btn('Agregar al juego abierto', null, go('add'), defaultMode === 'add' ? 'primary' : 'ghost'),
      F.btn('Crear juego nuevo', null, go('new'), defaultMode === 'new' ? 'primary' : 'ghost'));
    body.append(h, intro, list, ...extra.map(t => F.p(t, 'help')), actions);
    d.onclose = null;
    d.showModal();
  };

  /* ---------- 6. Guía para pedirle el JSON a una IA ---------- */
  EP.importer.AI_GUIDE = `Necesito que me entregues SOLO un archivo JSON (sin explicaciones) para un juego de mesa educativo que voy a imprimir con Estudio EP.
Usa esta estructura y nombres de campos en español:

{
  "info": {
    "titulo": "Nombre del juego",
    "descripcion": "Para qué sirve el juego",
    "jugadores": "4-8",
    "duracion": "60 min",
    "edad": "14 a 16 años",
    "reglas": "Cómo se juega, paso a paso"
  },
  "mazos": {
    "amarillo": [ { "titulo": "...", "situacion": "...", "pregunta": "¿...?", "zona": "...", "imagen": "A01.jpg" } ],
    "verde":    [ { "titulo": "...", "texto": "...", "imagen": "V01.jpg" } ]
  },
  "fichas": [ { "nombre": "...", "cantidad": 10, "funcion": "Para qué sirve", "imagen": "FichaX.jpg" } ],
  "tablero": [ { "posicion": 1, "tipo": "inicio" }, { "posicion": 2, "tipo": "pregunta", "nombre": "Saca carta amarilla" } ],
  "tableros": [ { "nombre": "Mapa del barrio", "formato": "3:2", "imagen": "Mapa.jpg" } ]
}

Reglas:
- Cada mazo es una lista de cartas. El nombre del mazo puede ser un color (amarillo, verde, azul, rojo, morado, naranja) y la carta toma ese color.
- "titulo" va arriba de la carta. "situacion", "texto", "efecto" o "pregunta" van en el cuerpo. Campos cortos como "zona" o "tipo" van al pie.
- "tablero" es el recorrido: una casilla por elemento, en orden. "tipo" pinta la casilla de un color; "nombre" es el texto que va dentro.
- "tableros" son tableros con imagen propia.
- "imagen" es solo el nombre del archivo; yo subo las imágenes aparte.
- "cantidad" dice cuántas copias imprimir.
- Textos breves: máximo 250 caracteres por carta.`;

  EP.importer.showGuide = () => {
    const F = EP.F, d = document.getElementById('dlg'), body = document.getElementById('dlgBody');
    body.replaceChildren();
    const h = EP.el('h2'); h.textContent = 'Guía para pedirle un juego a una IA';
    const ta = EP.el('textarea', 'guide-text'); ta.readOnly = true; ta.rows = 14; ta.value = EP.importer.AI_GUIDE;
    const actions = EP.el('div', 'dlg-actions');
    actions.append(
      F.btn('Cerrar', null, () => d.close(), 'ghost'),
      F.btn('Copiar guía', 'fa-copy', async () => {
        try { await navigator.clipboard.writeText(ta.value); EP.ui.toast('Guía copiada. Pégala en DeepSeek y agrega tu tema al final.', 'ok'); }
        catch (e) { ta.select(); EP.ui.toast('Selecciona el texto y cópialo con Ctrl + C.', 'info'); }
      }, 'primary'));
    body.append(h,
      F.p('Copia este texto, pégalo en DeepSeek o ChatGPT y escribe al final tu tema, por ejemplo: «Tema: violencia en el pololeo, 14 a 16 años, 40 cartas». Guarda la respuesta como archivo .json y ábrela con «Importar».', 'dlg-text'),
      ta, actions);
    d.onclose = null;
    d.showModal();
  };
})();
