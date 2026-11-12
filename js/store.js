/* Estudio EP — almacenamiento (IndexedDB) e imágenes */
window.EP = window.EP || {};

EP.db = (() => {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    // Versión 2: agrega "designs" (Mis diseños) y "sessions" (sesiones de educación popular).
    // Los juegos guardados en la versión 1 se conservan tal cual.
    const r = indexedDB.open('estudio-ep', 2);
    r.onupgradeneeded = () => {
      const d = r.result;
      ['projects', 'meta', 'designs', 'sessions'].forEach(s => { if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: 'id' }); });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
  const tx = async (stores, mode, fn) => {
    const d = await open();
    return new Promise((res, rej) => {
      const t = d.transaction(stores, mode);
      let out;
      Promise.resolve(fn(t)).then(v => { out = v; });
      t.oncomplete = () => res(out);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    });
  };
  const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

  // Avisos de cambios (los usa la sincronización con Drive). kind: 'juego' | 'sesion' | 'diseno'
  const listeners = [];
  const KIND = { projects: 'juego', sessions: 'sesion', designs: 'diseno' };
  const notify = (kind, id, deleted) => listeners.forEach(fn => { try { fn(kind, id, !!deleted); } catch (e) { console.error(e); } });
  // Fecha siempre creciente: dos guardados en el mismo milisegundo no quedan "iguales".
  // Además, cada cambio queda después de la fecha que ya tenía (base): si algo llegó del celular con el reloj
  // adelantado, lo que se edite aquí encima igual cuenta como más nuevo y no se pierde.
  // (Un pequeño salto al azar evita que dos equipos con el reloj atrasado elijan justo la misma fecha.)
  let lastStamp = 0;
  const stamp = (base) => {
    lastStamp = Math.max(Date.now(), lastStamp + 1);
    const b = Number(base) || 0;
    return b >= lastStamp ? b + 2 + Math.floor(Math.random() * 999) : lastStamp;
  };

  const putProject = (p) => {
    const meta = { id: p.id, name: p.name, updated: p.updated, created: p.created, count: p.items.length,
      versions: (p.versions || []).length,
      cards: p.items.filter(i => i.kind === 'card').length,
      tokens: p.items.filter(i => i.kind === 'token').length,
      boards: p.items.filter(i => i.kind === 'board').length };
    return tx(['projects', 'meta'], 'readwrite', t => {
      t.objectStore('projects').put(p);
      t.objectStore('meta').put(meta);
    });
  };
  const removeProject = (id) => tx(['projects', 'meta'], 'readwrite', t => {
    t.objectStore('projects').delete(id);
    t.objectStore('meta').delete(id);
  });

  return {
    KIND,
    onChange(fn) { listeners.push(fn); },
    async list() {
      return tx(['meta'], 'readonly', t => req(t.objectStore('meta').getAll()))
        .then(a => (a || []).sort((x, y) => y.updated - x.updated));
    },
    async get(id) { return tx(['projects'], 'readonly', t => req(t.objectStore('projects').get(id))); },
    async put(p) { p.updated = stamp(p.updated);await putProject(p); notify('juego', p.id); },
    async remove(id) { await removeProject(id); notify('juego', id, true); },
    // Bibliotecas que sirven para todos los juegos: 'designs' y 'sessions'
    async all(store) {
      return tx([store], 'readonly', t => req(t.objectStore(store).getAll()))
        .then(a => (a || []).sort((x, y) => (y.updated || 0) - (x.updated || 0)));
    },
    async getIn(store, id) { return tx([store], 'readonly', t => req(t.objectStore(store).get(id))); },
    async save(store, obj) { obj.updated = stamp(obj.updated);await tx([store], 'readwrite', t => { t.objectStore(store).put(obj); }); notify(KIND[store], obj.id); },
    async del(store, id) { await tx([store], 'readwrite', t => { t.objectStore(store).delete(id); }); notify(KIND[store], id, true); },
    // Escrituras que llegan desde Drive: conservan la fecha y no vuelven a avisar
    async putQuiet(p) { await putProject(p); },
    async removeQuiet(id) { await removeProject(id); },
    async saveQuiet(store, obj) { await tx([store], 'readwrite', t => { t.objectStore(store).put(obj); }); },
    async delQuiet(store, id) { await tx([store], 'readwrite', t => { t.objectStore(store).delete(id); }); }
  };
})();

/* ---- Imágenes: se guardan como dataURL en project.assets, en pantalla se usan blob: URLs ---- */
EP._blobCache = {};
EP.assetURL = (project, id) => {
  if (!id || !project.assets[id]) return null;
  if (EP._blobCache[id]) return EP._blobCache[id];
  try {
    const data = project.assets[id];
    const [head, b64] = data.split(',');
    const mime = (head.match(/data:(.*?);/) || [])[1] || 'image/png';
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    EP._blobCache[id] = URL.createObjectURL(new Blob([arr], { type: mime }));
  } catch (e) {
    EP._blobCache[id] = project.assets[id];
  }
  return EP._blobCache[id];
};

/* Lee un archivo de imagen, lo reduce a un tamaño razonable y lo guarda en el proyecto */
EP.importImage = (file, project, maxPx = 1800) => new Promise((res, rej) => {
  if (!file || !file.type.startsWith('image/')) return rej(new Error('El archivo no es una imagen'));
  const reader = new FileReader();
  reader.onerror = () => rej(reader.error);
  reader.onload = () => {
    const img = new Image();
    img.onerror = () => rej(new Error('No se pudo leer la imagen'));
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const transparent = /png|webp|gif|svg/.test(file.type);
      let data = transparent ? c.toDataURL('image/webp', 0.92) : c.toDataURL('image/jpeg', 0.9);
      if (!data.startsWith('data:image/webp') && transparent) data = c.toDataURL('image/png');
      const id = 'img_' + EP.uid();
      project.assets[id] = data;
      res(id);
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

/* Quita imágenes que ya no usa ningún elemento */
EP.pruneAssets = (project) => {
  const used = new Set();
  const mark = (items) => (items || []).forEach(i => { if (i.front && i.front.image) used.add(i.front.image); if (i.back && i.back.image) used.add(i.back.image); });
  mark(project.items);
  // Las imágenes de las versiones guardadas también se conservan, para poder volver a ellas
  (project.versions || []).forEach(v => { try { mark(JSON.parse(v.data).items); } catch (e) { /* versión dañada */ } });
  Object.keys(project.assets).forEach(k => { if (!used.has(k)) delete project.assets[k]; });
};

EP.download = (filename, text, type = 'application/json') => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
};

EP.slug = (s) => (s || 'juego').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'juego';
