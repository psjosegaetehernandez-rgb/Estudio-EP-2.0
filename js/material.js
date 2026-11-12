/* Estudio EP — "Mi material": imágenes y juegos que José Luis sube a la carpeta mi-material/
   sin tocar código.
   La app busca los archivos de tres formas, en este orden:
   1. Si está publicada en GitHub Pages, le pregunta a GitHub qué archivos hay en la carpeta (automático).
   2. Si no, lee mi-material/lista.txt (un archivo por línea), por si se publica en otro lugar.
   3. En el computador (sin internet) se puede elegir la carpeta con el botón «Abrir carpeta». */
window.EP = window.EP || {};

/* Solo si la página usa un dominio propio en vez de usuario.github.io:
   escribe aquí 'usuario/repositorio' (por ejemplo 'joseluisgaete/Estudio-EP'). Si no, déjalo vacío. */
EP.MATERIAL_REPO = '';

EP.MATERIAL_DIR = 'mi-material';
EP.IMG_EXT = /\.(jpe?g|png|webp|gif)$/i;
EP.material = { images: [], games: [], source: null, loading: false, error: null, local: false };

EP.prettyName = (file) => decodeURIComponent(file.split('/').pop()).replace(/\.[^.]+$/, '').replace(/\.estudio-ep$/, '').replace(/[_-]+/g, ' ').trim();

/* Descubre usuario, repositorio y subcarpeta a partir de la dirección de la página */
EP.githubGuess = (host = location.hostname, pathname = location.pathname) => {
  const dirs = pathname.split('/').filter(Boolean);
  if (dirs.length && /\.[a-z0-9]+$/i.test(dirs[dirs.length - 1])) dirs.pop(); // quita index.html
  if (EP.MATERIAL_REPO) {
    const [owner, repo] = EP.MATERIAL_REPO.split('/');
    return [{ owner, repo, sub: '' }];
  }
  if (!host.endsWith('.github.io')) return [];
  const owner = host.replace('.github.io', '');
  const out = [];
  if (dirs.length) out.push({ owner, repo: dirs[0], sub: dirs.slice(1).join('/') });
  out.push({ owner, repo: `${owner}.github.io`, sub: dirs.join('/') });
  return out;
};

EP.githubList = async (folder) => {
  for (const g of EP.githubGuess()) {
    const path = [g.sub, EP.MATERIAL_DIR, folder].filter(Boolean).join('/');
    const r = await fetch(`https://api.github.com/repos/${g.owner}/${g.repo}/contents/${path}`, { headers: { Accept: 'application/vnd.github+json' } });
    if (r.status === 404) continue;
    if (r.status === 403) throw new Error('GitHub pidió esperar un rato (demasiadas consultas). Intenta de nuevo en unos minutos.');
    if (!r.ok) throw new Error('No se pudo leer la carpeta en GitHub.');
    const list = await r.json();
    return Array.isArray(list) ? list.filter(f => f.type === 'file').map(f => `${folder}/${f.name}`) : [];
  }
  return null; // no es GitHub o no se encontró la carpeta
};

EP.loadMaterial = async (force = false) => {
  const M = EP.material;
  if (M.local && !force) return;
  M.loading = true; M.error = null; M.local = false;
  EP.ui.renderLeft();
  try {
    let files = null;
    const cacheKey = 'ep2_material_' + location.pathname;
    const cached = !force && sessionStorage.getItem(cacheKey);
    if (cached) { const c = JSON.parse(cached); files = c.files; M.source = c.source; }
    if (!files && EP.githubGuess().length) {
      const imgs = await EP.githubList('imagenes');
      const games = await EP.githubList('juegos');
      if (imgs || games) { files = [...(imgs || []), ...(games || [])]; M.source = 'github'; }
    }
    if (!files) {
      const r = await fetch(`${EP.MATERIAL_DIR}/lista.txt`, { cache: 'no-store' });
      if (!r.ok) throw new Error('nolist');
      files = (await r.text()).split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
      M.source = 'lista';
    }
    try { sessionStorage.setItem(cacheKey, JSON.stringify({ files, source: M.source })); } catch (e) { /* opcional */ }
    const safe = files.filter(f => !f.includes('..') && /^(imagenes|juegos)\//.test(f));
    M.images = safe.filter(f => f.startsWith('imagenes/') && EP.IMG_EXT.test(f))
      .map(f => ({ name: EP.prettyName(f), url: `${EP.MATERIAL_DIR}/${f.split('/').map(encodeURIComponent).join('/')}` }));
    M.games = safe.filter(f => f.startsWith('juegos/') && /\.json$/i.test(f))
      .map(f => ({ name: EP.prettyName(f), url: `${EP.MATERIAL_DIR}/${f.split('/').map(encodeURIComponent).join('/')}` }));
  } catch (e) {
    M.images = []; M.games = [];
    M.error = location.protocol === 'file:' || e.message === 'nolist' || e instanceof TypeError
      ? 'offline' : e.message;
  }
  M.loading = false;
  EP.ui.renderLeft();
};

/* Carpeta elegida desde el computador (funciona sin internet) */
EP.loadLocalFolder = (fileList) => {
  const M = EP.material;
  (M._urls || []).forEach(u => URL.revokeObjectURL(u));
  M._urls = [];
  const files = [...fileList];
  const mk = (f) => { const u = URL.createObjectURL(f); M._urls.push(u); return { name: EP.prettyName(f.name), url: u, file: f }; };
  M.images = files.filter(f => EP.IMG_EXT.test(f.name)).sort((a, b) => a.name.localeCompare(b.name)).map(mk);
  M.games = files.filter(f => /\.json$/i.test(f.name)).sort((a, b) => a.name.localeCompare(b.name)).map(mk);
  M.local = true; M.error = null; M.source = 'local';
  EP.ui.renderLeft();
  EP.ui.toast(`Cargué ${M.images.length} imágenes y ${M.games.length} juegos de la carpeta.`, 'ok');
};

EP.materialFile = async (m) => {
  if (m.file) return m.file;
  const r = await fetch(m.url);
  if (!r.ok) throw new Error('No se pudo descargar «' + m.name + '».');
  const b = await r.blob();
  return new File([b], m.name, { type: b.type || 'image/jpeg' });
};

/* Usa una imagen: en la pieza seleccionada, o crea una carta nueva con ella */
EP.useMaterialImage = async (m, mode) => {
  try {
    const file = await EP.materialFile(m);
    let it = EP.sel();
    if (mode === 'new' || !it) {
      it = EP.newCard({ name: m.name, front: { layout: 'imagen', title: '', text: '' } });
      EP.state.project.items.push(it);
      EP.state.selectedId = it.id;
      EP.state.side = 'front';
    }
    await EP.actions.setImage(it, EP.state.side, file);
    EP.ui.renderLeft();
  } catch (e) {
    EP.ui.toast(e.message || 'No se pudo usar la imagen.', 'error');
  }
};

/* Agrega las piezas de un juego guardado en mi-material/juegos al juego abierto */
EP.useMaterialGame = async (m, mode) => {
  try {
    const file = await EP.materialFile(m);
    if (mode === 'open') return EP.games.importFile(file);
    const data = JSON.parse(await file.text());
    if (!EP.importer.isNative(data)) return EP.importer.open(data, m.name, 'add');
    const p = EP.sanitizeProject(data);
    Object.assign(EP.state.project.assets, p.assets);
    const info = EP.state.project.info;
    if (!info.rules && !info.objective) Object.assign(info, p.info);
    EP.actions.add(p.items);
    EP.ui.toast(`Agregaste «${m.name}» (${p.items.length} piezas).`, 'ok');
  } catch (e) {
    EP.ui.toast(e instanceof SyntaxError ? `«${m.name}» no es un JSON válido. Revisa que el archivo esté completo (a veces la IA lo corta al final).` : e.message, 'error');
  }
};
