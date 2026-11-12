/* Estudio EP — dibujo de caras (frente/dorso).
   Una sola función dibuja para la mesa, la vista previa y la impresión,
   así lo que se ve es exactamente lo que se imprime.
   Nunca se usa innerHTML con textos del usuario (evita inyección de código). */
window.EP = window.EP || {};

EP.el = (tag, cls, style) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (style) e.style.cssText = style;
  return e;
};

EP.HEX_CLIP = 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)';

EP.renderFace = (item, side, project) => {
  const f = item[side] || EP.defaultFace();
  const { w, h } = EP.itemSize(item, project);
  const face = EP.el('div', `face kind-${item.kind} layout-${f.layout} va-${f.valign}`);
  const s = face.style;
  s.width = w + 'mm';
  s.height = h + 'mm';
  s.background = f.bg;
  s.textAlign = f.align;
  s.setProperty('--accent', f.accent);
  s.setProperty('--pad', f.padding + 'mm');

  if (item.shape === 'circle') s.borderRadius = '50%';
  else if (item.shape === 'hex') s.clipPath = EP.HEX_CLIP;
  else s.borderRadius = (item.radius || 0) + 'mm';

  if (f.borderW > 0) {
    if (item.shape === 'hex') s.boxShadow = `inset 0 0 0 ${f.borderW}mm ${f.borderColor}`;
    else s.border = `${f.borderW}mm solid ${f.borderColor}`;
  }

  // Imagen
  const url = EP.assetURL(project, f.image);
  if (url) {
    const box = EP.el('div', 'f-img');
    const img = EP.el('img');
    img.src = url;
    img.alt = '';
    img.draggable = false;
    img.style.objectFit = f.fit;
    img.style.objectPosition = `${f.imgX}% ${f.imgY}%`;
    img.style.transformOrigin = `${f.imgX}% ${f.imgY}%`;
    if (f.imgZoom !== 100) img.style.transform = `scale(${f.imgZoom / 100})`;
    img.style.opacity = f.imgOpacity / 100;
    box.appendChild(img);
    face.appendChild(box);
  }

  // Dibujo del tablero
  if (item.kind === 'board' && item.pattern && item.pattern.type !== 'none') {
    face.appendChild(EP.renderPattern(item.pattern, w, h, f));
  }

  if (f.layout === 'imagen') return face;

  // Contenido
  const body = EP.el('div', 'f-body');
  if (f.layout === 'banda' && f.title) {
    const band = EP.el('div', 'f-band');
    band.textContent = f.title;
    band.style.cssText = `font-family:${EP.FONTS[f.titleFont]};font-size:${f.titleSize}pt;color:${f.titleColor};background:${f.accent}`;
    face.appendChild(band);
  }
  if (f.icon) {
    const i = EP.el('i', 'f-icon fa-solid ' + f.icon);
    i.style.color = f.iconColor;
    i.style.fontSize = f.iconSize + 'pt';
    body.appendChild(i);
  }
  if (f.title && f.layout !== 'banda') {
    const t = EP.el('div', 'f-title');
    t.textContent = f.title;
    t.style.cssText = `font-family:${EP.FONTS[f.titleFont]};font-size:${f.titleSize}pt;color:${f.titleColor}`;
    body.appendChild(t);
  }
  if (f.text) {
    const t = EP.el('div', 'f-text');
    t.textContent = f.text;
    t.style.cssText = `font-family:${EP.FONTS[f.font]};font-size:${f.textSize}pt;color:${f.textColor}`;
    body.appendChild(t);
  }
  face.appendChild(body);
  if (f.footer) {
    const ft = EP.el('div', 'f-footer');
    ft.textContent = f.footer;
    ft.style.cssText = `font-family:${EP.FONTS[f.font]};color:${f.layout === 'banda' ? f.titleColor : f.textColor}`;
    if (f.layout === 'banda') ft.style.background = f.accent;
    face.appendChild(ft);
  }
  return face;
};

/* Dibujos de tablero en SVG, con medidas en milímetros */
EP.renderPattern = (p, W, H, f) => {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'f-pattern');
  svg.setAttribute('preserveAspectRatio', 'none');
  const add = (tag, attrs, text) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    svg.appendChild(e);
    return e;
  };
  const strokeMM = { stroke: p.color, 'stroke-width': p.width }; // grosor en mm reales
  const n = Math.max(2, Math.min(40, p.n | 0));
  const op = (p.opacity ?? 100) / 100;
  const labels = p.labels || [], colors = p.colors || [];
  const halo = { stroke: '#ffffff', 'stroke-width': 0, 'paint-order': 'stroke', 'stroke-linejoin': 'round' };
  const txt = (x, y, size, label, weight) => add('text', Object.assign({ x, y, 'font-size': size, fill: p.color,
    'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': 'Inter, sans-serif', 'font-weight': weight },
    op < 0.6 ? Object.assign({}, halo, { 'stroke-width': size * 0.18 }) : {}), label);

  /* Parte un texto en líneas cortas para que quepa en la casilla (máx. 4 líneas) */
  const wrap = (text, maxChars) => {
    const out = [];
    let line = '';
    String(text).split(/\s+/).forEach(w => {
      if (!line) line = w;
      else if ((line + ' ' + w).length <= maxChars) line += ' ' + w;
      else { out.push(line); line = w; }
    });
    if (line) out.push(line);
    if (out.length > 4) { out.length = 4; out[3] = out[3].replace(/.{0,1}$/, '…'); }
    return out;
  };

  /* Dibuja una casilla: forma, relleno, número y texto propio.
     idx = número de la casilla (empieza en 1). s = ancho útil de la casilla. */
  const cell = (shape, attrs, idx, cx, cy, s, baseFill, numLabel) => {
    if (p.count > 0 && idx > p.count) return;
    const own = colors[idx - 1];
    add(shape, Object.assign({ fill: own || baseFill, 'fill-opacity': own ? Math.max(op, 0.75) : op }, attrs, strokeMM));
    const label = labels[idx - 1];
    const showNum = p.numbers && numLabel !== '';
    if (label) {
      const ls = p.labelSize ? p.labelSize * 0.3528 : s * 0.13; // pt → mm
      const lines = wrap(label, Math.max(4, Math.floor((s * 0.9) / (ls * 0.55))));
      const top = showNum ? cy - s * 0.12 : cy;
      if (showNum) txt(cx, cy - s * 0.3, s * 0.18, numLabel, 700);
      const lh = ls * 1.1, start = top - (lines.length - 1) * lh / 2 + (showNum ? s * 0.1 : 0);
      lines.forEach((l, i) => txt(cx, start + i * lh, ls, l, 600));
    } else if (showNum) {
      txt(cx, cy, String(numLabel).length > 3 ? s * 0.17 : s * 0.3, numLabel, 600);
    }
  };

  if (EP.isTech(p.type)) { EP.renderTechnique(add, p, W, H, f); return svg; }

  if (p.type === 'grid' || p.type === 'snake') {
    const s = W / n, rows = Math.max(1, Math.floor(H / s)), oy = (H - rows * s) / 2;
    let k = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < n; c++) {
        const x = c * s, y = oy + r * s;
        let idx;
        if (p.type === 'snake') {
          const rowFromBottom = rows - 1 - r;
          idx = rowFromBottom * n + (rowFromBottom % 2 === 0 ? c : n - 1 - c) + 1;
        } else idx = ++k;
        cell('rect', { x, y, width: s, height: s }, idx, x + s / 2, y + s / 2, s, (r + c) % 2 ? p.fillAlt : p.fill, idx);
      }
    }
  } else if (p.type === 'track') {
    const s = W / n, rows = Math.max(3, Math.floor(H / s)), oy = (H - rows * s) / 2;
    const cells = [];
    for (let c = 0; c < n; c++) cells.push([c, 0]);
    for (let r = 1; r < rows; r++) cells.push([n - 1, r]);
    for (let c = n - 2; c >= 0; c--) cells.push([c, rows - 1]);
    for (let r = rows - 2; r >= 1; r--) cells.push([0, r]);
    cells.forEach(([c, r], i) => {
      const x = c * s, y = oy + r * s;
      const first = i === 0 && !labels[0];
      cell('rect', { x, y, width: s, height: s }, i + 1, x + s / 2, y + s / 2, s,
        i === 0 ? f.accent : (i % 2 ? p.fillAlt : p.fill), first ? 'Salida' : (labels[0] ? i + 1 : i));
    });
  } else if (p.type === 'hex') {
    const r = W / (n * Math.sqrt(3) + Math.sqrt(3) / 2);
    const hw = Math.sqrt(3) * r, rows = Math.max(1, Math.floor((H - 0.5 * r) / (1.5 * r)));
    const oy = (H - (rows * 1.5 * r + 0.5 * r)) / 2 + r;
    let k = 0;
    for (let row = 0; row < rows; row++) {
      for (let c = 0; c < n; c++) {
        const cx = hw / 2 + c * hw + (row % 2 ? hw / 2 : 0), cy = oy + row * 1.5 * r;
        const pts = [];
        for (let a = 0; a < 6; a++) {
          const ang = Math.PI / 180 * (60 * a - 30);
          pts.push((cx + r * Math.cos(ang)).toFixed(2) + ',' + (cy + r * Math.sin(ang)).toFixed(2));
        }
        ++k;
        cell('polygon', { points: pts.join(' ') }, k, cx, cy, r * 1.5, (row + c) % 3 ? p.fill : p.fillAlt, k);
      }
    }
  }
  return svg;
};

/* Técnicas participativas en tamaño papelógrafo. Medidas en mm.
   Se dejan zonas amplias y renglones suaves para escribir o pegar post-its encima. */
EP.renderTechnique = (add, p, W, H, f) => {
  // FODA y árbol tienen zonas fijas; la línea de tiempo y el mapa aceptan las que escribas (hasta 12)
  const own = (p.labels || []).filter(t => t && t.trim());
  const L = EP.TECH_FLEX.includes(p.type) && own.length ? own.slice(0, 12)
    : EP.TECH_LABELS[p.type].map((d, i) => (p.labels && p.labels[i]) || d);
  const ink = p.color, op = (p.opacity ?? 100) / 100;
  const top = H * 0.1; // espacio para el título del tablero
  const font = (size, weight = 700) => ({ 'font-size': size, 'font-family': 'Inter, sans-serif', 'font-weight': weight, fill: ink, 'text-anchor': 'middle', 'dominant-baseline': 'central' });
  const lines = (x, y, w, h, gap = 14) => { for (let yy = y + gap; yy < y + h - 4; yy += gap) add('line', { x1: x + 6, y1: yy, x2: x + w - 6, y2: yy, stroke: ink, 'stroke-width': 0.25, 'stroke-dasharray': '1.5 2.5', opacity: 0.5 }); };
  const S = Math.min(W, H);

  if (p.type === 'foda') {
    const cols = ['#bbf7d0', '#bfdbfe', '#fde68a', '#fecaca'];
    const gx = W / 2, gh = (H - top) / 2;
    [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([c, r], i) => {
      const x = c * gx, y = top + r * gh;
      add('rect', { x: x + 3, y: y + 3, width: gx - 6, height: gh - 6, rx: 4, fill: (p.colors && p.colors[i]) || cols[i], 'fill-opacity': op * 0.55, stroke: ink, 'stroke-width': p.width });
      add('rect', { x: x + 3, y: y + 3, width: gx - 6, height: S * 0.07, rx: 4, fill: (p.colors && p.colors[i]) || cols[i], 'fill-opacity': Math.max(op, 0.8), stroke: ink, 'stroke-width': p.width });
      add('text', Object.assign({ x: x + gx / 2, y: y + 3 + S * 0.035 }, font(S * 0.035)), L[i]);
      lines(x + 3, y + 3 + S * 0.07, gx - 6, gh - 6 - S * 0.07);
    });
    add('text', Object.assign({ x: gx / 2, y: top - S * 0.018 }, font(S * 0.02, 600)), 'Internas (del grupo)');
    add('text', Object.assign({ x: gx * 1.5, y: top - S * 0.018 }, font(S * 0.02, 600)), 'Externas (del entorno)');
  } else if (p.type === 'arbol') {
    const cx = W / 2;
    const crownY = top + (H - top) * 0.22, crownR = Math.min(W * 0.42, (H - top) * 0.24);
    // Copa (efectos)
    [[-0.55, 0.1], [0.55, 0.1], [0, -0.35], [-0.3, -0.2], [0.3, -0.2], [0, 0.25]].forEach(([dx, dy]) =>
      add('circle', { cx: cx + dx * crownR, cy: crownY + dy * crownR, r: crownR * 0.62, fill: '#86efac', 'fill-opacity': op * 0.6, stroke: ink, 'stroke-width': p.width }));
    add('text', Object.assign({ x: cx, y: crownY - crownR * 0.1 }, font(S * 0.04)), L[0]);
    // Tronco (problema central)
    const tw = W * 0.2, ty = crownY + crownR * 0.7, th = (H - top) * 0.28;
    add('path', { d: `M${cx - tw / 2} ${ty} L${cx + tw / 2} ${ty} L${cx + tw * 0.65} ${ty + th} L${cx - tw * 0.65} ${ty + th} Z`, fill: '#d6a77a', 'fill-opacity': Math.max(op, 0.7), stroke: ink, 'stroke-width': p.width });
    add('text', Object.assign({ x: cx, y: ty + th / 2 }, font(S * 0.032)), L[1]);
    // Raíces (causas)
    const ry = ty + th;
    [-0.42, -0.22, 0, 0.22, 0.42].forEach((k, i) => add('path', { d: `M${cx + k * tw * 1.2} ${ry} C${cx + k * W * 0.6} ${ry + (H - ry) * 0.3}, ${cx + k * W * 0.9} ${ry + (H - ry) * 0.6}, ${cx + k * W * 1.05} ${H - 10 - (i % 2) * 14}`, fill: 'none', stroke: '#92400e', 'stroke-width': p.width * 4, 'stroke-linecap': 'round', opacity: 0.85 }));
    add('text', Object.assign({ x: cx, y: ry + (H - ry) * 0.55 }, font(S * 0.04)), L[2]);
    add('line', { x1: 8, y1: ry, x2: W - 8, y2: ry, stroke: '#78350f', 'stroke-width': p.width * 2, 'stroke-dasharray': '6 4' });
  } else if (p.type === 'linea') {
    const n = L.length, y = top + (H - top) * 0.45, x0 = W * 0.05, x1 = W * 0.95;
    add('line', { x1: x0, y1: y, x2: x1 - 8, y2: y, stroke: ink, 'stroke-width': p.width * 4, 'stroke-linecap': 'round' });
    add('path', { d: `M${x1} ${y} l-14 -8 v16 Z`, fill: ink });
    const cols = ['#fde68a', '#bfdbfe', '#bbf7d0', '#fecaca', '#ddd6fe', '#fed7aa'];
    L.forEach((t, i) => {
      const x = x0 + (i + 0.5) * (x1 - x0 - 10) / n, up = i % 2 === 0;
      const bw = (x1 - x0) / n * 0.9, bh = (H - top) * 0.33, by = up ? y - 12 - bh : y + 12;
      add('circle', { cx: x, cy: y, r: S * 0.02, fill: (p.colors && p.colors[i]) || cols[i % cols.length], stroke: ink, 'stroke-width': p.width });
      add('text', Object.assign({ x, y }, font(S * 0.018)), String(i + 1));
      add('rect', { x: x - bw / 2, y: by, width: bw, height: bh, rx: 4, fill: (p.colors && p.colors[i]) || cols[i % cols.length], 'fill-opacity': op * 0.5, stroke: ink, 'stroke-width': p.width });
      add('text', Object.assign({ x, y: by + S * 0.03 }, font(S * 0.026)), t);
      lines(x - bw / 2, by + S * 0.05, bw, bh - S * 0.05, 12);
    });
  } else if (p.type === 'ruleta') {
    const cx = W / 2, cy = top + (H - top) / 2, r = Math.min(W, H - top) * 0.46, n = L.length;
    const cols = ['#fde68a', '#bfdbfe', '#bbf7d0', '#fecaca', '#ddd6fe', '#fed7aa', '#a5f3fc', '#f5d0fe', '#d9f99d', '#fecdd3', '#c7d2fe', '#fef08a'];
    L.forEach((t, i) => {
      const a0 = (i / n) * 2 * Math.PI - Math.PI / 2, a1 = ((i + 1) / n) * 2 * Math.PI - Math.PI / 2;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      add('path', { d: `M${cx} ${cy} L${cx + r * Math.cos(a0)} ${cy + r * Math.sin(a0)} A${r} ${r} 0 ${large} 1 ${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)} Z`,
        fill: (p.colors && p.colors[i]) || cols[i % cols.length], 'fill-opacity': Math.max(op, 0.3), stroke: ink, 'stroke-width': p.width });
      const am = (a0 + a1) / 2, tr = r * 0.66;
      const deg = am * 180 / Math.PI + (Math.cos(am) < 0 ? 180 : 0);
      add('text', Object.assign({ x: cx + tr * Math.cos(am), y: cy + tr * Math.sin(am), transform: `rotate(${deg} ${cx + tr * Math.cos(am)} ${cy + tr * Math.sin(am)})` }, font(Math.min(r * 0.09, (r * 1.1) / Math.max(6, t.length)))), t);
    });
    add('circle', { cx, cy, r: 3, fill: ink });
    add('circle', { cx, cy, r, fill: 'none', stroke: ink, 'stroke-width': p.width * 2 });
  } else if (p.type === 'mapa') {
    // Marco, rosa de los vientos y una simbología para completar en grupo
    add('rect', { x: 6, y: top, width: W - 12, height: H - top - 6, rx: 6, fill: '#f0fdf4', 'fill-opacity': op * 0.6, stroke: ink, 'stroke-width': p.width * 2 });
    for (let x = 6 + 40; x < W - 6; x += 40) add('line', { x1: x, y1: top, x2: x, y2: H - 6, stroke: ink, 'stroke-width': 0.2, opacity: 0.25 });
    for (let y = top + 40; y < H - 6; y += 40) add('line', { x1: 6, y1: y, x2: W - 6, y2: y, stroke: ink, 'stroke-width': 0.2, opacity: 0.25 });
    const rx = W - 6 - S * 0.09, ry = top + S * 0.09, rr = S * 0.06;
    add('path', { d: `M${rx} ${ry - rr} L${rx + rr * 0.25} ${ry} L${rx} ${ry + rr} L${rx - rr * 0.25} ${ry} Z`, fill: ink });
    add('path', { d: `M${rx - rr} ${ry} L${rx} ${ry - rr * 0.25} L${rx + rr} ${ry} L${rx} ${ry + rr * 0.25} Z`, fill: 'none', stroke: ink, 'stroke-width': p.width });
    add('text', Object.assign({ x: rx, y: ry - rr - S * 0.02 }, font(S * 0.025)), 'N');
    const lw = W * 0.34, lh = S * 0.05 * (L.length + 1.4), lx = 6 + S * 0.03, ly = H - 6 - lh - S * 0.03;
    add('rect', { x: lx, y: ly, width: lw, height: lh, rx: 4, fill: '#ffffff', stroke: ink, 'stroke-width': p.width });
    add('text', Object.assign({ x: lx + lw / 2, y: ly + S * 0.03 }, font(S * 0.025)), 'Simbología');
    const cols = ['#22c55e', '#ef4444', '#3b82f6', '#f59e0b', '#a855f7', '#14b8a6'];
    L.forEach((t, i) => {
      const yy = ly + S * 0.05 * (i + 1.5);
      add('circle', { cx: lx + S * 0.03, cy: yy, r: S * 0.012, fill: (p.colors && p.colors[i]) || cols[i % cols.length] });
      add('text', Object.assign({ x: lx + S * 0.055, y: yy }, font(S * 0.02, 500), { 'text-anchor': 'start' }), t);
    });
  }
};

/* Cuántas casillas caben con la configuración actual (para el editor y el lector de JSON) */
EP.patternCapacity = (p, W, H) => {
  if (EP.isTech(p.type)) return EP.TECH_FLEX.includes(p.type) ? 12 : EP.TECH_LABELS[p.type].length;
  const n = Math.max(2, Math.min(40, p.n | 0));
  if (p.type === 'grid' || p.type === 'snake') return n * Math.max(1, Math.floor(H / (W / n)));
  if (p.type === 'track') { const rows = Math.max(3, Math.floor(H / (W / n))); return 2 * n + 2 * (rows - 2); }
  if (p.type === 'hex') {
    const r = W / (n * Math.sqrt(3) + Math.sqrt(3) / 2);
    return n * Math.max(1, Math.floor((H - 0.5 * r) / (1.5 * r)));
  }
  return 0;
};

/* Miniatura: dibuja la cara a tamaño real y la reduce con zoom para que quepa */
EP.thumb = (item, side, project, maxW, maxH) => {
  const { w, h } = EP.itemSize(item, project);
  const scale = Math.min(maxW / (w * EP.MM), maxH / (h * EP.MM));
  const face = EP.renderFace(item, side, project);
  face.style.zoom = scale;
  return face;
};
