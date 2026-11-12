/* Estudio EP — armado de hojas para imprimir.
   - Cartas y fichas se acomodan en grilla; cada hoja de frentes va seguida de su hoja de dorsos,
     espejada para que calce al imprimir a doble cara.
   - Los tableros se dibujan a tamaño real y se dividen en varias hojas (por ejemplo 2 × 2 = 4 hojas). */
window.EP = window.EP || {};

EP.paperOf = (project) => EP.PAPERS[project.print.paper] || EP.PAPERS.carta;

EP.buildPages = (project, selected) => {
  const pr = project.print, paper = EP.paperOf(project);
  const W = paper.w, H = paper.h, m = pr.margin, g = pr.gap;
  const UW = W - 2 * m, UH = H - 2 * m;
  const pages = [], warnings = [];
  let items = project.items;
  const ids = Array.isArray(selected) ? selected : (selected ? [selected] : []);
  if (pr.onlySelected) {
    if (ids.length) items = items.filter(i => ids.includes(i.id));
    else warnings.push('Marcaste «Imprimir solo lo seleccionado», pero no hay nada seleccionado: se muestra todo.');
  }

  // ---- Cartas y fichas ----
  const groups = new Map();
  items.filter(i => i.kind !== 'board' && pr.include[i.kind]).forEach(it => {
    const key = `${it.w}x${it.h}`;
    if (!groups.has(key)) groups.set(key, { w: it.w, h: it.h, list: [] });
    for (let c = 0; c < Math.max(1, it.copies | 0); c++) groups.get(key).list.push(it);
  });

  for (const grp of groups.values()) {
    const fit = (w, h) => ({ cols: Math.floor((UW + g) / (w + g)), rows: Math.floor((UH + g) / (h + g)) });
    const up = fit(grp.w, grp.h), rot = fit(grp.h, grp.w);
    let rotated = pr.rotate && rot.cols * rot.rows > up.cols * up.rows;
    const L = rotated ? rot : up;
    if (L.cols * L.rows === 0) {
      warnings.push(`Hay elementos de ${grp.w} × ${grp.h} mm que no caben en la hoja. Achícalos o reduce el margen.`);
      continue;
    }
    const sw = rotated ? grp.h : grp.w, sh = rotated ? grp.w : grp.h;
    const per = L.cols * L.rows;
    const gridW = L.cols * sw + (L.cols - 1) * g, gridH = L.rows * sh + (L.rows - 1) * g;
    const x0 = m + (UW - gridW) / 2, y0 = m + (UH - gridH) / 2;
    const total = Math.ceil(grp.list.length / per);

    for (let p = 0; p < total; p++) {
      const chunk = grp.list.slice(p * per, (p + 1) * per);
      const slots = chunk.map((it, i) => ({
        item: it, x: x0 + (i % L.cols) * (sw + g), y: y0 + Math.floor(i / L.cols) * (sh + g),
        sw, sh, rot: rotated ? 90 : 0
      }));
      const label = `${grp.w} × ${grp.h} mm · hoja ${p + 1} de ${total}`;
      pages.push({ type: 'front', side: 'front', slots, label: 'Frentes · ' + label });
      if (pr.backs !== 'none') {
        const backSlots = slots.map(s => pr.backs === 'long'
          ? Object.assign({}, s, { x: W - s.x - s.sw + pr.offX, y: s.y + pr.offY, rot: -s.rot })
          : Object.assign({}, s, { x: s.x + pr.offX, y: H - s.y - s.sh + pr.offY, rot: 180 - s.rot }));
        pages.push({ type: 'back', side: 'back', slots: backSlots, label: 'Dorsos · ' + label });
      }
    }
  }

  // ---- Tableros ----
  if (pr.include.board) {
    items.filter(i => i.kind === 'board').forEach(b => {
      const { cols, rows, orient } = b.sheets;
      const n = cols * rows;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        pages.push({ type: 'board', item: b, col: c, row: r, landscape: orient === 'landscape',
          label: `Tablero «${b.name}» · hoja ${r * cols + c + 1} de ${n} (fila ${r + 1}, columna ${c + 1})` });
      }
    });
  }

  if (pr.rulesSheet) {
    const blocks = EP.manualBlocks(project);
    if (blocks.length) {
      // Reparte el manual en varias hojas si es largo (estimación por líneas de texto)
      const cap = 34, chunks = [[]];
      let used = 6;
      blocks.forEach(b => {
        const lines = b.lines;
        if (used + lines > cap && chunks[chunks.length - 1].length) { chunks.push([]); used = 0; }
        chunks[chunks.length - 1].push(b); used += lines;
      });
      chunks.forEach((c, i) => pages.push({ type: 'rules', blocks: c, first: i === 0,
        label: `Manual del juego · hoja ${i + 1} de ${chunks.length}` }));
    }
  }
  if (pr.testSheet) pages.unshift({ type: 'test', label: 'Hoja de prueba (frente)' }, { type: 'testback', label: 'Hoja de prueba (dorso)' });
  return { pages, warnings, paper };
};

/* ---- Dibujo de una hoja ---- */
EP.renderPage = (desc, project) => {
  const pr = project.print, paper = EP.paperOf(project);
  const W = paper.w, H = paper.h, m = pr.margin;
  const page = EP.el('div', 'page');
  page.style.width = W + 'mm';
  // 0,4 mm menos de alto: evita que algunas impresoras pasen un pelo a la hoja siguiente y descuadren todo.
  // Todo se mide desde arriba, así que no cambia ninguna posición.
  page.style.height = (H - 0.4) + 'mm';

  if (desc.type === 'front' || desc.type === 'back') {
    desc.slots.forEach(s => {
      const slot = EP.el('div', 'slot', `left:${s.x}mm;top:${s.y}mm;width:${s.sw}mm;height:${s.sh}mm`);
      slot.dataset.id = s.item.id;
      const face = EP.renderFace(s.item, desc.side, project);
      face.style.position = 'absolute';
      face.style.left = (s.sw - s.item.w) / 2 + 'mm';
      face.style.top = (s.sh - s.item.h) / 2 + 'mm';
      if (s.rot) face.style.transform = `rotate(${s.rot}deg)`;
      slot.appendChild(face);
      page.appendChild(slot);
    });
    if (pr.marks !== 'ninguna') page.appendChild(EP.cutMarks(desc.slots, W, H, pr.marks));
  } else if (desc.type === 'board') {
    const b = desc.item, size = EP.itemSize(b, project);
    const tw = size.tileW, th = size.tileH;
    // En horizontal la porción se dibuja girada dentro de la hoja vertical
    const win = EP.el('div', 'tile');
    if (desc.landscape) {
      win.style.cssText = `left:${m}mm;top:${m}mm;width:${th}mm;height:${tw}mm`;
      const inner = EP.el('div', '', `position:absolute;width:${tw}mm;height:${th}mm;left:${th}mm;top:0;transform-origin:0 0;transform:rotate(90deg);overflow:hidden`);
      inner.appendChild(EP.boardSlice(b, project, desc.col, desc.row, tw, th));
      win.appendChild(inner);
    } else {
      win.style.cssText = `left:${m}mm;top:${m}mm;width:${tw}mm;height:${th}mm`;
      win.appendChild(EP.boardSlice(b, project, desc.col, desc.row, tw, th));
    }
    win.dataset.id = b.id;
    page.appendChild(win);
    page.appendChild(EP.cornerMarks(m, W, H));
    const lab = EP.el('div', 'page-note');
    lab.textContent = desc.label + ' · une los bordes recortando el margen blanco';
    page.appendChild(lab);
    page.appendChild(EP.miniMap(b.sheets, desc.col, desc.row));
  } else if (desc.type === 'rules') {
    page.appendChild(EP.rulesSheet(project, m, desc));
  } else if (desc.type === 'test' || desc.type === 'testback') {
    page.appendChild(EP.testSheet(project, desc.type === 'testback'));
  }
  return page;
};

/* Hoja de prueba: un cuadrado de 10 cm (para ver si la impresora cambia el tamaño)
   y cruces que, a doble cara, deben coincidir con las del dorso mirando la hoja a contraluz. */
EP.testSheet = (project, back) => {
  const pr = project.print, { w: W, h: H } = EP.paperOf(project);
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'marks test');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const add = (tag, a, text) => { const e = document.createElementNS(NS, tag); for (const k in a) e.setAttribute(k, a[k]); if (text) e.textContent = text; svg.appendChild(e); return e; };
  const pts = [[40, 40], [W - 40, 40], [W / 2, H / 2], [40, H - 40], [W - 40, H - 40]];
  const mirror = ([x, y]) => pr.backs === 'short' ? [x + pr.offX, H - y + pr.offY] : [W - x + pr.offX, y + pr.offY];
  (back ? pts.map(mirror) : pts).forEach(([x, y]) => {
    add('line', { x1: x - 8, y1: y, x2: x + 8, y2: y, stroke: back ? '#c2362f' : '#1f4fb8', 'stroke-width': 0.4 });
    add('line', { x1: x, y1: y - 8, x2: x, y2: y + 8, stroke: back ? '#c2362f' : '#1f4fb8', 'stroke-width': 0.4 });
    add('circle', { cx: x, cy: y, r: 3, fill: 'none', stroke: back ? '#c2362f' : '#1f4fb8', 'stroke-width': 0.3 });
  });
  const t = (x, y, s, text, w = 400) => add('text', { x, y, 'font-size': s, 'font-family': 'Inter, sans-serif', 'font-weight': w, fill: '#1c2321', 'text-anchor': 'middle' }, text);
  if (!back) {
    const x0 = (W - 100) / 2, y0 = 70;
    add('rect', { x: x0, y: y0, width: 100, height: 100, fill: 'none', stroke: '#1c2321', 'stroke-width': 0.4 });
    for (let i = 0; i <= 100; i += 10) add('line', { x1: x0 + i, y1: y0 + 100, x2: x0 + i, y2: y0 + 100 + (i % 50 ? 3 : 5), stroke: '#1c2321', 'stroke-width': 0.3 });
    t(W / 2, y0 + 48, 6, 'Este cuadrado debe medir 10 × 10 cm', 700);
    t(W / 2, y0 + 56, 4, 'Mídelo con una regla. Si mide menos, en la ventana de imprimir pon');
    t(W / 2, y0 + 62, 4, 'Escala 100 % (o «Tamaño real») y papel ' + EP.paperOf(project).name.split(' (')[0] + '.');
    t(W / 2, H - 70, 4.2, 'Imprime esta hoja a doble cara y mírala a contraluz: las cruces azules y rojas deben quedar una encima de otra.');
    t(W / 2, H - 64, 4.2, 'Si están corridas, mide cuánto y corrígelo en Vista de impresión → Más opciones → Ajuste fino de dorsos.');
  } else {
    t(W / 2, H / 2 + 20, 4.2, 'Dorso de la hoja de prueba: estas cruces rojas deben calzar con las azules del frente.');
  }
  return svg;
};

/* Contenido del manual: datos del juego, materiales (contados solos), reglas y guía del facilitador */
EP.manualBlocks = (project) => {
  const i = project.info, out = [];
  const lines = (txt, perLine = 75) => String(txt).split('\n').reduce((s, l) => s + Math.max(1, Math.ceil(l.length / perLine)), 0);
  const block = (title, text, cls) => { if (text && String(text).trim()) out.push({ title, text: String(text).trim(), cls, lines: lines(text) + 2 }); };
  block('Objetivo', i.objective);
  // Materiales: se cuentan de lo que hay en el juego
  const decks = new Map();
  project.items.forEach(it => {
    const key = it.kind === 'card' ? (it.back.title || 'Cartas') : it.kind === 'token' ? 'Fichas: ' + (it.name || 'ficha') : null;
    if (it.kind === 'board') { decks.set('Tablero «' + it.name + '»', (decks.get('Tablero «' + it.name + '»') || 0) + it.sheets.cols * it.sheets.rows); return; }
    decks.set(key, (decks.get(key) || 0) + Math.max(1, it.copies | 0));
  });
  const mat = [...decks].map(([k, n]) => k.startsWith('Tablero') ? `${k}: ${n} hoja${n > 1 ? 's' : ''} carta` : k.startsWith('Fichas') ? `${k} (${n})` : `${k}: ${n} carta${n > 1 ? 's' : ''}`);
  if (i.materials) mat.push(i.materials);
  block('Materiales', mat.join('\n'));
  block('Cómo se juega', i.rules, 'rules');
  block('Rol de quien facilita', i.facilitator);
  block('Preguntas de cierre', i.closing);
  return out;
};

EP.rulesSheet = (project, m, desc = {}) => {
  const i = project.info;
  const box = EP.el('div', 'rules-sheet', `inset:${m + 6}mm`);
  const add = (tag, text, cls) => { if (!text) return; const e = EP.el(tag, cls); e.textContent = text; box.appendChild(e); };
  if (desc.first !== false) {
    add('h1', project.name);
    const meta = [i.players && `Participantes: ${i.players}`, i.time && `Duración: ${i.time}`, i.age && `Edad o público: ${i.age}`].filter(Boolean).join('   ');
    add('p', meta, 'meta');
  }
  (desc.blocks || EP.manualBlocks(project)).forEach(b => { add('h2', b.title); add('p', b.text, 'rules'); });
  add('p', 'Hecho con Estudio EP — desarrollado por Punta Digital y José Luis Gaete', 'credit');
  return box;
};

EP.boardSlice = (b, project, col, row, tw, th) => {
  const face = EP.renderFace(b, 'front', project);
  face.style.position = 'absolute';
  face.style.left = -col * tw + 'mm';
  face.style.top = -row * th + 'mm';
  return face;
};

/* Marcas de corte: líneas cortas en el margen, alineadas con los bordes de cada pieza */
EP.cutMarks = (slots, W, H, mode) => {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'marks');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const line = (x1, y1, x2, y2) => {
    const l = document.createElementNS(NS, 'line');
    l.setAttribute('x1', x1); l.setAttribute('y1', y1); l.setAttribute('x2', x2); l.setAttribute('y2', y2);
    svg.appendChild(l);
  };
  if (!slots.length) return svg;
  if (mode === 'contorno') {
    slots.forEach(s => {
      const it = s.item;
      let e;
      if (it.shape === 'circle') {
        e = document.createElementNS(NS, 'circle');
        e.setAttribute('cx', s.x + s.sw / 2); e.setAttribute('cy', s.y + s.sh / 2); e.setAttribute('r', Math.min(s.sw, s.sh) / 2);
      } else {
        e = document.createElementNS(NS, 'rect');
        e.setAttribute('x', s.x); e.setAttribute('y', s.y); e.setAttribute('width', s.sw); e.setAttribute('height', s.sh);
      }
      e.setAttribute('class', 'outline');
      svg.appendChild(e);
    });
    return svg;
  }
  const xs = new Set(), ys = new Set();
  let top = Infinity, bottom = -Infinity, left = Infinity, right = -Infinity;
  slots.forEach(s => {
    xs.add(+s.x.toFixed(2)); xs.add(+(s.x + s.sw).toFixed(2));
    ys.add(+s.y.toFixed(2)); ys.add(+(s.y + s.sh).toFixed(2));
    top = Math.min(top, s.y); bottom = Math.max(bottom, s.y + s.sh);
    left = Math.min(left, s.x); right = Math.max(right, s.x + s.sw);
  });
  const L = 5, gap = 1.5;
  xs.forEach(x => { line(x, Math.max(0, top - gap - L), x, top - gap); line(x, bottom + gap, x, Math.min(H, bottom + gap + L)); });
  ys.forEach(y => { line(Math.max(0, left - gap - L), y, left - gap, y); line(right + gap, y, Math.min(W, right + gap + L), y); });
  return svg;
};

EP.cornerMarks = (m, W, H) => {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'marks');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const L = Math.min(5, m - 1);
  [[m, m], [W - m, m], [m, H - m], [W - m, H - m]].forEach(([x, y]) => {
    const dx = x < W / 2 ? -1 : 1, dy = y < H / 2 ? -1 : 1;
    [[x, y + dy, x, y + dy * (L + 1)], [x + dx, y, x + dx * (L + 1), y]].forEach(([a, b, c, d]) => {
      const l = document.createElementNS(NS, 'line');
      l.setAttribute('x1', a); l.setAttribute('y1', b); l.setAttribute('x2', c); l.setAttribute('y2', d);
      svg.appendChild(l);
    });
  });
  return svg;
};

/* Pequeño mapa en la esquina que indica qué parte del tablero es esta hoja */
EP.miniMap = (sheets, col, row) => {
  const box = EP.el('div', 'minimap');
  box.style.gridTemplateColumns = `repeat(${sheets.cols}, 1fr)`;
  for (let r = 0; r < sheets.rows; r++) for (let c = 0; c < sheets.cols; c++) {
    box.appendChild(EP.el('span', r === row && c === col ? 'on' : ''));
  }
  return box;
};

EP.rulesSheet = (project, m) => {
  const i = project.info;
  const box = EP.el('div', 'rules-sheet', `inset:${m + 6}mm`);
  const add = (tag, text, cls) => { if (!text) return; const e = EP.el(tag, cls); e.textContent = text; box.appendChild(e); };
  add('h1', project.name);
  const meta = [i.players && `Participantes: ${i.players}`, i.time && `Duración: ${i.time}`, i.age && `Edad: ${i.age}`].filter(Boolean).join('   ');
  add('p', meta, 'meta');
  if (i.objective) { add('h2', 'Objetivo'); add('p', i.objective); }
  if (i.rules) { add('h2', 'Cómo se juega'); add('p', i.rules, 'rules'); }
  add('p', 'Hecho con Estudio EP — desarrollado por Punta Digital y José Luis Gaete', 'credit');
  return box;
};

EP.setPageCSS = (project) => {
  const p = EP.paperOf(project);
  let tag = document.getElementById('page-size-css');
  if (!tag) { tag = document.createElement('style'); tag.id = 'page-size-css'; document.head.appendChild(tag); }
  tag.textContent = `@page { size: ${p.w}mm ${p.h}mm; margin: 0; }`;
};
