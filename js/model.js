/* Estudio EP — modelo de datos
   Desarrollado por Punta Digital y José Luis Gaete */
window.EP = window.EP || {};

EP.APP_VERSION = '2.4.0';
EP.MM = 96 / 25.4; // px por mm en pantalla

EP.uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
EP.clone = (o) => JSON.parse(JSON.stringify(o));

EP.PAPERS = {
  carta:  { name: 'Carta (21,6 × 27,9 cm)', w: 215.9, h: 279.4 },
  oficio: { name: 'Oficio (21,6 × 33 cm)',  w: 215.9, h: 330.2 },
  a4:     { name: 'A4 (21 × 29,7 cm)',      w: 210,   h: 297 }
};

EP.CARD_SIZES = [
  { id: 'poker',    name: 'Póker (6,3 × 8,8 cm)',     w: 63,  h: 88 },
  { id: 'tarot',    name: 'Tarot (7 × 12 cm)',        w: 70,  h: 120 },
  { id: 'mini',     name: 'Mini (4,4 × 6,3 cm)',      w: 44,  h: 63 },
  { id: 'grande',   name: 'Grande (8,9 × 12,7 cm)',   w: 89,  h: 127 },
  { id: 'cuadrada', name: 'Cuadrada (7 × 7 cm)',      w: 70,  h: 70 },
  { id: 'postal',   name: 'Postal (10 × 14,8 cm)',    w: 100, h: 148 }
];

EP.TOKEN_SIZES = [20, 25, 30, 40, 50, 60];
EP.TOKEN_SHAPES = { circle: 'Círculo', rect: 'Cuadrado', hex: 'Hexágono' };

EP.BOARD_SHEETS = [
  { cols: 1, rows: 1, name: '1 hoja' },
  { cols: 2, rows: 1, name: '2 hojas (2 × 1)' },
  { cols: 2, rows: 2, name: '4 hojas (2 × 2)' },
  { cols: 3, rows: 2, name: '6 hojas (3 × 2)' },
  { cols: 3, rows: 3, name: '9 hojas (3 × 3)' }
];

EP.PATTERNS = {
  none: 'Libre (solo imagen / color)',
  grid: 'Cuadrícula',
  snake: 'Recorrido serpenteante numerado',
  track: 'Recorrido por el borde',
  hex: 'Hexágonos',
  // Técnicas participativas (papelógrafos en varias hojas)
  foda: 'FODA (4 cuadrantes)',
  arbol: 'Árbol de problemas',
  linea: 'Línea de tiempo',
  mapa: 'Mapa colectivo',
  ruleta: 'Ruleta para recortar'
};
/* Textos por defecto de cada técnica: se editan en «Texto de cada casilla» (una línea por zona) */
EP.TECH_LABELS = {
  foda: ['Fortalezas', 'Oportunidades', 'Debilidades', 'Amenazas'],
  arbol: ['Efectos (consecuencias)', 'Problema central', 'Causas (raíces)'],
  linea: ['Diagnóstico', 'Planificación', 'Acción', 'Reflexión', 'Sistematización'],
  mapa: ['Lugares seguros', 'Lugares de riesgo', 'Redes de apoyo', 'Lo que queremos cambiar'],
  ruleta: ['Pregunta', 'Reto', 'Comodín', 'Pierdes el turno', 'Avanza 2', 'Elige tú']
};
EP.isTech = (t) => !!EP.TECH_LABELS[t];
EP.TECH_FLEX = ['linea', 'mapa', 'ruleta'];

EP.LAYOUTS = {
  texto:   'Texto centrado',
  imagen_texto: 'Imagen arriba + texto',
  imagen:  'Solo imagen',
  banda:   'Banda con título'
};

EP.FONTS = {
  Inter: "'Inter', sans-serif",
  Merriweather: "'Merriweather', serif",
  Playfair: "'Playfair Display', serif",
  Patrick: "'Patrick Hand', cursive",
  Bebas: "'Bebas Neue', sans-serif"
};
EP.FONT_NAMES = { Inter: 'Moderna', Merriweather: 'Clásica', Playfair: 'Elegante', Patrick: 'Manuscrita', Bebas: 'Titular' };

EP.ICONS = ['', 'fa-star', 'fa-heart', 'fa-scroll', 'fa-mountain', 'fa-triangle-exclamation', 'fa-brain',
  'fa-user', 'fa-users', 'fa-hands-holding-circle', 'fa-comments', 'fa-question', 'fa-lightbulb',
  'fa-puzzle-piece', 'fa-leaf', 'fa-seedling', 'fa-sun', 'fa-moon', 'fa-fire', 'fa-water', 'fa-wind',
  'fa-shield-heart', 'fa-key', 'fa-dice', 'fa-crown', 'fa-feather', 'fa-house', 'fa-flag', 'fa-eye',
  'fa-gem', 'fa-coins', 'fa-bullseye', 'fa-face-smile', 'fa-face-sad-tear', 'fa-face-angry',
  'fa-face-surprise', 'fa-face-grimace', 'fa-dove', 'fa-hand-holding-heart', 'fa-music', 'fa-book',
  'fa-tree', 'fa-paw', 'fa-skull', 'fa-ghost', 'fa-compass', 'fa-anchor', 'fa-bolt', 'fa-clock'];

EP.defaultFace = (o = {}) => Object.assign({
  layout: 'texto',
  bg: '#ffffff', accent: '#1e3a5f',
  image: null, imgRef: '', fit: 'cover', imgX: 50, imgY: 50, imgZoom: 100, imgOpacity: 100,
  icon: '', iconColor: '#1e3a5f', iconSize: 22,
  title: '', text: '', footer: '',
  titleFont: 'Merriweather', font: 'Inter',
  titleSize: 14, textSize: 10,
  titleColor: '#1e293b', textColor: '#334155',
  align: 'center', valign: 'center',
  borderW: 0, borderColor: '#1e3a5f', padding: 4
}, o);

EP.defaultBack = (o = {}) => EP.defaultFace(Object.assign({
  bg: '#1e3a5f', icon: 'fa-star', iconColor: '#ffffff', iconSize: 30,
  titleColor: '#ffffff', textColor: '#e2e8f0'
}, o));

EP.newCard = (o = {}) => {
  const size = EP.CARD_SIZES.find(s => s.id === (o.sizeId || 'poker')) || EP.CARD_SIZES[0];
  return {
    id: EP.uid(), kind: 'card', name: o.name || 'Carta',
    sizeId: size.id, w: o.w || size.w, h: o.h || size.h,
    shape: 'rect', radius: o.radius != null ? o.radius : 3, copies: o.copies || 1,
    front: EP.defaultFace(Object.assign({ title: 'Título', text: 'Escribe aquí el texto de la carta.' }, o.front || {})),
    back: EP.defaultBack(o.back || {})
  };
};

EP.newToken = (o = {}) => {
  const d = o.size || 30;
  return {
    id: EP.uid(), kind: 'token', name: o.name || 'Ficha',
    w: d, h: d, shape: o.shape || 'circle', radius: 2, copies: o.copies || 1,
    front: EP.defaultFace(Object.assign({ bg: '#f59e0b', icon: 'fa-star', iconColor: '#ffffff', iconSize: Math.round(d * 0.6),
      title: '', text: '', titleSize: 9, borderW: 0.8, borderColor: '#78350f' }, o.front || {})),
    back: EP.defaultFace(Object.assign({ bg: '#78350f', icon: '', titleColor: '#fff' }, o.back || {}))
  };
};

EP.newBoard = (o = {}) => ({
  id: EP.uid(), kind: 'board', name: o.name || 'Tablero',
  sheets: Object.assign({ cols: 2, rows: 2, orient: 'portrait' }, o.sheets || {}),
  shape: 'rect', radius: 0, copies: 1,
  /* opacity: relleno de las casillas (0 = transparente, deja ver la imagen de fondo).
     count: total de casillas (0 = todas las que caben). labels/colors: texto y color de cada casilla, en orden. */
  pattern: Object.assign({ type: 'none', n: 8, color: '#334155', width: 0.6, numbers: true, fill: '#ffffff', fillAlt: '#e2e8f0',
    opacity: 100, count: 0, labels: [], colors: [], labelSize: 0 }, o.pattern || {}),
  front: EP.defaultFace(Object.assign({ bg: '#f8fafc', title: 'Mi tablero', text: '', titleSize: 48, textSize: 18,
    valign: 'top', padding: 12, titleFont: 'Playfair' }, o.front || {})),
  back: EP.defaultFace()
});

EP.defaultPrint = () => ({
  paper: 'carta', margin: 6, gap: 0, marks: 'margen', backs: 'long', rotate: true,
  include: { card: true, token: true, board: true }, offX: 0, offY: 0, rulesSheet: false, onlySelected: false, testSheet: false
});

EP.newProject = (name) => ({
  id: EP.uid(), name: name || 'Juego sin nombre', version: 2, created: Date.now(), updated: Date.now(),
  info: { players: '', time: '', age: '', objective: '', rules: '', materials: '', facilitator: '', closing: '', ideas: '' },
  versions: [], // puntos guardados para volver atrás: { id, name, date, data }
  items: [], assets: {}, print: EP.defaultPrint()
});

/* Tamaño real (mm) de un elemento. Los tableros dependen del papel elegido. */
EP.itemSize = (item, project) => {
  if (item.kind !== 'board') return { w: item.w, h: item.h };
  const pr = project.print, p = EP.PAPERS[pr.paper] || EP.PAPERS.carta;
  let pw = p.w, ph = p.h;
  if (item.sheets.orient === 'landscape') [pw, ph] = [ph, pw];
  const uw = pw - 2 * pr.margin, uh = ph - 2 * pr.margin;
  return { w: uw * item.sheets.cols, h: uh * item.sheets.rows, tileW: uw, tileH: uh };
};

/* Normaliza proyectos importados / antiguos */
EP.normalizeProject = (p) => {
  const base = EP.newProject(p.name);
  p = Object.assign(base, p);
  p.info = Object.assign(base.info, p.info || {});
  p.print = Object.assign(EP.defaultPrint(), p.print || {});
  p.print.include = Object.assign({ card: true, token: true, board: true }, p.print.include || {});
  p.assets = p.assets || {};
  p.items = (p.items || []).map(it => {
    const fresh = it.kind === 'board' ? EP.newBoard() : it.kind === 'token' ? EP.newToken() : EP.newCard();
    const out = Object.assign(fresh, it);
    out.front = EP.defaultFace(it.front || {});
    out.back = EP.defaultFace(it.back || {});
    if (it.kind === 'board') {
      out.sheets = Object.assign({ cols: 2, rows: 2, orient: 'portrait' }, it.sheets || {});
      out.pattern = Object.assign(EP.newBoard().pattern, it.pattern || {});
    }
    return out;
  });
  return p;
};
