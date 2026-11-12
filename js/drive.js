/* Estudio EP — respaldo y sincronización con Google Drive.
   Cada juego, sesión y diseño se guarda como un archivo .json en la carpeta «Estudio EP» del Drive del usuario.
   Permiso usado: drive.file (la app solo ve los archivos que ella misma creó, nunca el resto del Drive).
   El navegador sigue siendo la copia de trabajo; Drive es la copia que viaja entre computador y celular.

   Reglas de sincronización (por cada archivo):
   - Existe solo aquí            → se sube (o, si ya se había sincronizado y no cambió, se borró en otro equipo: se borra aquí).
   - Existe solo en Drive        → se baja (o, si se borró aquí y Drive no cambió desde entonces, se manda a la papelera de Drive).
   - Existe en los dos           → gana el más nuevo. Si cambiaron los dos, lo que pierde se guarda como versión (juegos)
                                   o como copia (sesiones y diseños). Nunca se pierde nada.
   Cada cambio local queda con fecha posterior a la que ya tenía, así un reloj desigual entre equipos no confunde el orden.
   Lo borrado en Drive va a su papelera (se puede recuperar durante 30 días). */
window.EP = window.EP || {};

(() => {
  const $ = (s) => document.querySelector(s);
  const F = () => EP.F;
  const FOLDER = 'Estudio EP';
  const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email';
  const STORE = { juego: 'projects', sesion: 'sessions', diseno: 'designs' };
  const PREFIX = { juego: 'juego', sesion: 'sesion', diseno: 'diseno' };
  const LS = 'ep2_drive';

  class AuthError extends Error {}

  /* ---------- Estado guardado en este navegador ---------- */
  const load = () => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; } };
  let st = Object.assign({ on: false, email: '', folderId: '', synced: {}, pendingDel: {}, last: 0, token: '', exp: 0 }, load());
  const persist = () => { try { localStorage.setItem(LS, JSON.stringify(st)); } catch (e) { /* sin espacio: se sigue igual */ } };

  /* ---------- Conexión real con la API de Google Drive ---------- */
  const API = 'https://www.googleapis.com';
  const realBackend = {
    async call(method, path, { query, body, headers = {}, raw } = {}) {
      const q = query ? '?' + new URLSearchParams(query) : '';
      const r = await fetch(path.startsWith('http') ? path + q : API + path + q, {
        method, body, headers: Object.assign({ Authorization: 'Bearer ' + EP.drive.token() }, headers)
      });
      if (r.status === 401) throw new AuthError('La sesión de Google expiró.');
      if (!r.ok) { let m = ''; try { m = (await r.json()).error.message; } catch (e) { /* sin detalle */ } throw new Error('Drive respondió ' + r.status + (m ? ': ' + m : '')); }
      return raw ? r : (r.status === 204 ? null : r.json());
    },
    async email() { const u = await this.call('GET', '/oauth2/v3/userinfo'); return u.email || ''; },
    async folder(knownId) {
      if (knownId) {
        try { const f = await this.call('GET', '/drive/v3/files/' + knownId, { query: { fields: 'id,trashed' } }); if (f && !f.trashed) return { id: f.id, created: false }; }
        catch (e) { if (e instanceof AuthError) throw e; }
      }
      const found = await this.call('GET', '/drive/v3/files', { query: { q: `mimeType='application/vnd.google-apps.folder' and name='${FOLDER}' and trashed=false`, fields: 'files(id)', spaces: 'drive' } });
      if (found.files && found.files.length) return { id: found.files[0].id, created: false };
      const f = await this.call('POST', '/drive/v3/files', { body: JSON.stringify({ name: FOLDER, mimeType: 'application/vnd.google-apps.folder' }), headers: { 'Content-Type': 'application/json' } });
      return { id: f.id, created: true };
    },
    async list(folderId) {
      const out = [];
      let pageToken;
      do {
        const r = await this.call('GET', '/drive/v3/files', { query: Object.assign({
          q: `'${folderId}' in parents and trashed=false`, fields: 'nextPageToken,files(id,name,appProperties)', pageSize: '1000', spaces: 'drive'
        }, pageToken ? { pageToken } : {}) });
        (r.files || []).forEach(f => { const a = f.appProperties || {}; if (a.epKind && a.epId) out.push({ fileId: f.id, kind: a.epKind, id: a.epId, updated: Number(a.epUpdated) || 0 }); });
        pageToken = r.nextPageToken;
      } while (pageToken);
      return out;
    },
    async upload({ fileId, folderId, name, kind, id, updated, content }) {
      const meta = { name, mimeType: 'application/json', appProperties: { epKind: kind, epId: id, epUpdated: String(updated) } };
      if (!fileId) meta.parents = [folderId];
      const blob = new Blob([content], { type: 'application/json' });
      const method = fileId ? 'PATCH' : 'POST';
      const path = '/upload/drive/v3/files' + (fileId ? '/' + fileId : '');
      if (blob.size < 4.5 * 1024 * 1024) {
        const b = 'ep' + Math.random().toString(36).slice(2);
        const body = new Blob([`--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n`, blob, `\r\n--${b}--`]);
        const r = await this.call(method, path, { query: { uploadType: 'multipart', fields: 'id' }, body, headers: { 'Content-Type': 'multipart/related; boundary=' + b } });
        return r.id;
      }
      // Archivos grandes (juegos con muchas imágenes): subida por partes
      const start = await this.call(method, path, { query: { uploadType: 'resumable', fields: 'id' }, raw: true, body: JSON.stringify(meta),
        headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': 'application/json', 'X-Upload-Content-Length': String(blob.size) } });
      const loc = start.headers.get('Location');
      if (!loc) throw new Error('Drive no aceptó la subida.');
      const r = await fetch(loc, { method: 'PUT', body: blob, headers: { 'Content-Type': 'application/json' } });
      if (!r.ok) throw new Error('No se pudo subir el archivo (' + r.status + ').');
      return (await r.json()).id;
    },
    async download(fileId) {
      const r = await this.call('GET', '/drive/v3/files/' + fileId, { query: { alt: 'media' }, raw: true });
      return JSON.parse(await r.text());
    },
    async trash(fileId) {
      await this.call('PATCH', '/drive/v3/files/' + fileId, { body: JSON.stringify({ trashed: true }), headers: { 'Content-Type': 'application/json' } });
    }
  };

  /* ---------- Inicio de sesión con Google (Google Identity Services) ---------- */
  let gisP = null;
  const loadGIS = () => gisP || (gisP = new Promise((res, rej) => {
    if (window.google && google.accounts && google.accounts.oauth2) return res();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
    s.onload = () => res(); s.onerror = () => { gisP = null; rej(new Error('No se pudo cargar el inicio de sesión de Google. Revisa la conexión a internet.')); };
    document.head.appendChild(s);
  }));
  const askToken = (interactive) => new Promise(async (res, rej) => {
    try { await loadGIS(); } catch (e) { return rej(e); }
    const client = google.accounts.oauth2.initTokenClient({
      client_id: EP.CONFIG.googleClientId, scope: SCOPES,
      callback: (r) => {
        if (r.error) return rej(new Error(r.error === 'access_denied' ? 'No diste permiso para usar Drive.' : 'Google no entregó el permiso (' + r.error + ').'));
        st.token = r.access_token; st.exp = Date.now() + (Number(r.expires_in) || 3600) * 1000 - 60000; persist(); res();
      },
      error_callback: (e) => rej(new Error(e && e.type === 'popup_closed' ? 'Cerraste la ventana de Google antes de terminar.' : 'No se pudo abrir la ventana de Google. Si el navegador bloqueó la ventana emergente, permítela.'))
    });
    client.requestAccessToken({ prompt: interactive && !st.email ? 'consent' : '', hint: st.email || undefined });
  });

  /* ---------- Contenido de cada tipo ---------- */
  const fileName = (kind, obj) => `${PREFIX[kind]}-${EP.slug(obj.name || kind)}-${obj.id}.json`.slice(0, 180);
  const localIndex = async () => {
    const out = new Map();
    (await EP.db.list()).forEach(m => out.set('juego:' + m.id, { kind: 'juego', id: m.id, updated: m.updated || 0 }));
    for (const kind of ['sesion', 'diseno']) (await EP.db.all(STORE[kind])).forEach(o => out.set(kind + ':' + o.id, { kind, id: o.id, updated: o.updated || 0 }));
    return out;
  };
  const readLocal = (kind, id) => kind === 'juego' ? EP.db.get(id) : EP.db.getIn(STORE[kind], id);

  // Lo que llega de Drive se revisa igual que un archivo importado (por si alguien lo editó a mano)
  const cleanProject = (raw) => {
    const p = EP.sanitizeProject(raw);
    p.id = String(raw.id); p.created = Number(raw.created) || Date.now(); p.updated = Number(raw.updated) || Date.now();
    p.versions = (Array.isArray(raw.versions) ? raw.versions : []).slice(0, 25).map(v => {
      try {
        const d = JSON.parse(v.data);
        const sp = EP.sanitizeProject(Object.assign({}, d, { items: Array.isArray(d.items) ? d.items : [], assets: p.assets }));
        return { id: String(v.id || EP.uid()), name: String(v.name || 'Versión').slice(0, 80), date: Number(v.date) || 0, count: sp.items.length,
          data: JSON.stringify({ name: sp.name, info: sp.info, items: sp.items, print: sp.print }) };
      } catch (e) { return null; }
    }).filter(Boolean);
    return p;
  };
  const str = (v, n = 4000) => String(v ?? '').slice(0, n);
  const okImg = (v) => typeof v === 'string' && /^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(v);
  const cleanSession = (raw) => {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.phases)) throw new Error('Sesión dañada');
    const s = EP.newSession(str(raw.name, 120));
    s.id = String(raw.id); s.created = Number(raw.created) || Date.now(); s.updated = Number(raw.updated) || Date.now();
    ['date', 'place', 'group', 'facilitator', 'objective', 'closing', 'notes'].forEach(k => s[k] = str(raw[k]));
    s.phases = raw.phases.slice(0, 200).map(f => ({ title: str(f && f.title, 200), minutes: Math.max(0, Math.min(600, Number(f && f.minutes) || 0)), activity: str(f && f.activity, 2000), materials: str(f && f.materials, 2000) }));
    s.games = (Array.isArray(raw.games) ? raw.games : []).slice(0, 50).map(g => ({ id: str(g && g.id, 80), name: str(g && g.name, 120), summary: str(g && g.summary, 200) }));
    s.images = (Array.isArray(raw.images) ? raw.images : []).filter(i => i && okImg(i.data)).slice(0, 24).map(i => ({ id: str(i.id, 80), data: i.data, caption: str(i.caption, 120) }));
    return s;
  };
  const cleanDesign = (raw) => {
    if (!raw || typeof raw !== 'object' || !raw.front || !raw.back) throw new Error('Diseño dañado');
    const kind = raw.kind === 'token' ? 'token' : 'card';
    const p = EP.sanitizeProject({ items: [{ kind, w: raw.w, h: raw.h, shape: raw.shape, radius: raw.radius, front: raw.front, back: raw.back, copies: 1 }], assets: raw.assets || {} });
    if (!p.items.length) throw new Error('Diseño dañado');
    const it = p.items[0];
    return { id: String(raw.id), name: str(raw.name, 60), kind, w: it.w, h: it.h, sizeId: str(raw.sizeId, 30) || 'custom', shape: it.shape, radius: it.radius,
      front: it.front, back: it.back, assets: p.assets, updated: Number(raw.updated) || Date.now() };
  };
  const writeLocal = async (kind, data) => {
    if (kind === 'juego') await EP.db.putQuiet(cleanProject(data));
    else if (kind === 'sesion') await EP.db.saveQuiet('sessions', cleanSession(data));
    else await EP.db.saveQuiet('designs', cleanDesign(data));
  };
  const removeLocal = (kind, id) => kind === 'juego' ? EP.db.removeQuiet(id) : EP.db.delQuiet(STORE[kind], id);

  // ¿Se está editando esto ahora mismo, con cambios aún sin guardar?
  const busyLocal = (kind, id) => (kind === 'juego' && EP._dirty && EP.state.project && EP.state.project.id === id)
    || (kind === 'sesion' && EP.sessions && EP.sessions.dirty && EP.state.session && EP.state.session.id === id);

  /* ---------- Sincronización ---------- */
  let running = false, again = false, timer = null, status = 'off', lastError = '';
  const setStatus = (s, err) => { status = s; lastError = err || ''; EP.drive.paint(); };

  EP.drive = {
    backend: realBackend,
    AuthError,
    state: () => st,
    status: () => status,
    lastError: () => lastError,
    token: () => st.token,
    tokenOk: () => !!st.token && Date.now() < st.exp,
    configured: () => !!(EP.CONFIG && EP.CONFIG.googleClientId),
    online: () => /^https?:$/.test(location.protocol),
    available: () => EP.drive.configured() && EP.drive.online(),
    _reset(over) { st = Object.assign({ on: false, email: '', folderId: '', synced: {}, pendingDel: {}, last: 0, token: '', exp: 0 }, over || {}); persist(); status = 'off'; },

    /* Botón «Conectar»: tiene que venir de un clic (Google abre una ventanita) */
    async connect() {
      if (!EP.drive.available()) { EP.drive.explain(); return; }
      try {
        setStatus('syncing');
        await askToken(true);
        const email = await EP.drive.backend.email().catch(() => '');
        if (st.email && email && email !== st.email) { st.synced = {}; st.pendingDel = {}; st.folderId = ''; } // otra cuenta: parte de cero
        st.email = email || st.email; st.on = true; persist();
        await EP.drive.sync({ first: true });
      } catch (e) {
        setStatus(st.on ? 'needsAuth' : 'off', e.message);
        EP.ui.toast(e.message, 'error');
      }
    },
    disconnect() {
      try { if (st.token && window.google && google.accounts) google.accounts.oauth2.revoke(st.token, () => {}); } catch (e) { /* opcional */ }
      const email = st.email;
      EP.drive._reset({ email });
      EP.drive.paint();
      EP.ui.toast('Drive desconectado. Tus archivos siguen en tu Drive y en este navegador.', 'info');
    },
    /* Cuando la sesión de Google venció, un clic la renueva y sincroniza */
    async resume() {
      try { setStatus('syncing'); await askToken(true); await EP.drive.sync(); }
      catch (e) { setStatus('needsAuth', e.message); EP.ui.toast(e.message, 'error'); }
    },
    // Al cambiar algo: se sube a los pocos segundos
    schedule(ms = 2500) {
      if (!st.on) return;
      clearTimeout(timer);
      if (!EP.drive.tokenOk()) { setStatus('needsAuth'); return; }
      if (status !== 'syncing') setStatus('pending');
      timer = setTimeout(() => EP.drive.sync(), ms);
    },
    async sync(opts = {}) {
      if (!st.on) return null;
      if (!EP.drive.tokenOk()) { setStatus('needsAuth'); return null; }
      if (running) { again = true; return null; }
      if (typeof navigator !== 'undefined' && navigator.onLine === false) { setStatus('offline'); return null; }
      running = true; setStatus('syncing');
      const report = { up: 0, down: 0, delLocal: 0, delRemote: 0, conflicts: 0, skipped: 0, errors: [] };
      const B = EP.drive.backend;
      try {
        const fold = await B.folder(st.folderId);
        if (fold.created || fold.id !== st.folderId) { st.synced = {}; } // carpeta nueva: nada se da por sincronizado
        st.folderId = fold.id;
        const remoteList = await B.list(st.folderId);
        const R = new Map();
        for (const r of remoteList) {
          const k = r.kind + ':' + r.id;
          if (!STORE[r.kind]) continue;
          const prev = R.get(k);
          if (!prev || r.updated > prev.updated) { if (prev) await B.trash(prev.fileId).catch(() => {}); R.set(k, r); }
          else await B.trash(r.fileId).catch(() => {});
        }
        const L = await localIndex();
        // Protección: si Drive aparece vacío, nunca se borra nada de este equipo
        const remoteEmpty = R.size === 0;
        if (remoteEmpty) st.synced = {};
        const keys = new Set([...L.keys(), ...R.keys(), ...Object.keys(st.pendingDel)]);
        let reopen = false, reSession = false;
        const openId = EP.state.project && EP.state.project.id;
        const sesId = EP.state.session && EP.state.session.id;

        for (const key of keys) {
          const [kind, id] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
          if (!STORE[kind]) continue;
          const l = L.get(key), r = R.get(key), s = st.synced[key];
          try {
            if (busyLocal(kind, id)) { report.skipped++; continue; } // se sincroniza apenas se guarde
            const upload = async () => {
              const obj = await readLocal(kind, id);
              if (!obj) return;
              const fileId = await B.upload({ fileId: r && r.fileId, folderId: st.folderId, name: fileName(kind, obj), kind, id, updated: obj.updated || 0, content: JSON.stringify(obj) });
              st.synced[key] = obj.updated || 0; report.up++;
              return fileId;
            };
            const download = async () => {
              const data = await B.download(r.fileId);
              data.id = id; data.updated = r.updated;
              await writeLocal(kind, data);
              st.synced[key] = r.updated; report.down++;
              if (kind === 'juego' && id === openId) reopen = true;
              if (kind === 'sesion' && id === sesId) reSession = true;
            };
            if (l && !r) {
              if (s !== undefined && l.updated <= s && !remoteEmpty) {
                // Se borró en otro equipo y aquí no se tocó desde entonces
                await removeLocal(kind, id); delete st.synced[key]; report.delLocal++;
                if (kind === 'juego' && id === openId) reopen = true;
                if (kind === 'sesion' && id === sesId) { EP.state.session = null; reSession = true; }
              } else await upload();
            } else if (!l && r) {
              if (st.pendingDel[key] !== undefined && s !== undefined && r.updated <= s) { await B.trash(r.fileId); delete st.synced[key]; report.delRemote++; }
              else await download(); // nuevo de otro equipo, o editado allá después de borrarlo aquí (gana lo editado)
            } else if (l && r) {
              const both = s !== undefined && l.updated > s && r.updated > s; // cambió en los dos lados desde la última vez
              if (l.updated === r.updated) st.synced[key] = l.updated;
              else if (both && r.updated > l.updated) {
                // Gana lo de Drive; lo de aquí queda guardado
                const mine = await readLocal(kind, id);
                await download();
                await keepLoser(kind, id, mine, 'Cambios de este equipo antes de sincronizar', ' (copia de este equipo)');
                report.conflicts++;
              } else if (both) {
                // Gana lo de aquí; lo que venía del otro equipo queda guardado
                const theirs = await B.download(r.fileId);
                theirs.id = id;
                const clean = kind === 'juego' ? cleanProject(theirs) : kind === 'sesion' ? cleanSession(theirs) : cleanDesign(theirs);
                await keepLoser(kind, id, clean, 'Cambios del otro equipo', ' (copia del otro equipo)');
                await upload();
                report.conflicts++;
              } else if (r.updated > l.updated) await download();
              else await upload();
            }
            delete st.pendingDel[key];
          } catch (e) {
            if (e instanceof AuthError) throw e;
            report.errors.push(key + ': ' + e.message);
          }
        }
        st.last = Date.now(); persist();
        if (EP.sessions) EP.sessions.cache = null;
        if (EP.designs) EP.designs.cache = null;
        await refreshUI(reopen, reSession, report);
        setStatus(report.errors.length ? 'error' : 'ok', report.errors[0]);
        if (opts.first) EP.ui.toast(report.down ? `Drive conectado. Bajé ${report.down} archivo${report.down > 1 ? 's' : ''} desde tu Drive.` : 'Drive conectado. Tus juegos y sesiones ya están respaldados.', 'ok');
        else if (report.down) EP.ui.toast(`Llegaron cambios desde tu Drive (${report.down}).`, 'info');
        if (report.conflicts) EP.ui.toast('Algo cambió en dos equipos a la vez. Me quedé con lo más nuevo y guardé lo otro como versión (en Juegos) o como copia, para que no se pierda.', 'info');
        return report;
      } catch (e) {
        persist();
        if (e instanceof AuthError) { st.token = ''; st.exp = 0; persist(); setStatus('needsAuth', e.message); }
        else setStatus(navigator.onLine === false ? 'offline' : 'error', e.message);
        return Object.assign(report, { fatal: e.message });
      } finally {
        running = false;
        if (again) { again = false; setTimeout(() => EP.drive.sync(), 300); }
      }
    },
    // Avisos del almacenamiento: qué cambió en este equipo
    noteChange(kind, id, deleted) {
      if (!st.on) return;
      const key = kind + ':' + id;
      if (deleted) { st.pendingDel[key] = Date.now(); persist(); }
      EP.drive.schedule();
    }
  };

  // Conflicto: la parte que pierde no se borra. En juegos queda como versión; en sesiones y diseños, como copia.
  const keepLoser = async (kind, id, loser, versionName, copySuffix) => {
    if (!loser) return;
    if (kind === 'juego') {
      const p = await EP.db.get(id);
      if (!p) return;
      p.versions = p.versions || [];
      p.versions.unshift({ id: EP.uid(), name: versionName, date: Date.now(), count: (loser.items || []).length,
        data: JSON.stringify({ name: loser.name, info: loser.info, items: loser.items || [], print: loser.print }) });
      if (p.versions.length > 25) p.versions.length = 25;
      p.assets = Object.assign({}, loser.assets || {}, p.assets);
      await EP.db.put(p); // cambia la fecha: sube a Drive con la versión incluida
    } else {
      const c = EP.clone(loser); c.id = EP.uid(); c.name = String(loser.name || '').slice(0, 90) + copySuffix;
      await EP.db.save(STORE[kind], c);
    }
  };

  const refreshUI = async (reopen, reSession, report) => {
    if (!EP.ui || !EP.state) return;
    if (reopen && EP.state.project) {
      const still = await EP.db.get(EP.state.project.id);
      if (still) await EP.games.open(still.id);
      else { const l = await EP.db.list(); if (l.length) await EP.games.open(l[0].id); else await EP.games.create('Mi primer juego'); }
    }
    if (reSession && EP.state.session) {
      const s = await EP.db.getIn('sessions', EP.state.session.id);
      EP.state.session = s || null;
    }
    if (report.down || report.delLocal || report.conflicts) { EP.ui.renderLeft(); EP.ui.renderCenter(); }
  };

  /* ---------- Pantalla: chip en la barra de arriba y bloque en la pestaña Juegos ---------- */
  const LABEL = {
    off: ['fa-cloud', 'Drive'], ok: ['fa-cloud', 'Drive al día'], syncing: ['fa-rotate fa-spin', 'Sincronizando…'],
    pending: ['fa-cloud-arrow-up', 'Por subir'], needsAuth: ['fa-cloud-arrow-up', 'Toca para sincronizar'],
    offline: ['fa-plane', 'Sin internet'], error: ['fa-triangle-exclamation', 'Drive con problemas']
  };
  EP.drive.paint = () => {
    const chip = $('#driveChip');
    if (chip) {
      chip.hidden = !st.on;
      const [ic, tx] = LABEL[status] || LABEL.off;
      chip.className = 'drive-chip ' + status;
      chip.replaceChildren();
      const i = EP.el('i', 'fa-solid ' + ic); i.setAttribute('aria-hidden', 'true');
      const t = EP.el('span'); t.textContent = tx;
      chip.append(i, t);
      chip.title = status === 'ok' ? 'Todo respaldado en Google Drive' + (st.last ? ' (' + EP.ago(st.last) + ')' : '') : (lastError || tx);
    }
    const blk = $('#driveBlock');
    if (blk && EP.state && EP.state.tab === 'juegos') EP.ui.driveBlock(blk, true);
  };
  EP.drive.explain = () => {
    const msg = !EP.drive.online()
      ? 'Para conectar Drive, la app tiene que abrirse desde su página web (por ejemplo GitHub Pages), no con doble clic desde la carpeta. Es una regla de Google.'
      : 'Falta el permiso de Google para esta app. Quien la instaló tiene que pegar el «ID de cliente» en js/config.js (está explicado en el LEEME).';
    EP.ui.toast(msg, 'info');
  };
  const chipClick = () => {
    if (status === 'needsAuth') EP.drive.resume();
    else if (status === 'syncing') return;
    else if (EP.drive.tokenOk()) EP.drive.sync();
    else EP.drive.resume();
  };

  EP.ui.driveBlock = (blk, refill) => {
    if (!refill) blk.id = 'driveBlock';
    blk.replaceChildren();
    blk.className = 'block drive-block';
    const h = EP.el('h3'); h.textContent = 'Respaldo en Google Drive';
    blk.appendChild(h);
    if (!st.on) {
      blk.appendChild(F().p('Conecta tu Drive y todo lo que hagas se guarda solo en una carpeta «Estudio EP». Así no pierdes nada y lo abres también desde el celular. La app solo ve los archivos que ella crea, nunca el resto de tu Drive.'));
      const b = F().btn('Conectar con Google Drive', 'fa-cloud-arrow-up', EP.drive.connect, 'primary wide');
      blk.appendChild(b);
      if (!EP.drive.available()) blk.appendChild(F().p(EP.drive.online() ? 'Todavía falta activar el permiso de Google (ver LEEME).' : 'Se activa cuando abres la app desde su página web, no desde la carpeta.', 'help small'));
      return;
    }
    const line = EP.el('p', 'drive-line');
    const [ic, tx] = LABEL[status] || LABEL.off;
    const i = EP.el('i', 'fa-solid ' + ic); i.setAttribute('aria-hidden', 'true');
    const t = EP.el('span'); t.textContent = ' ' + tx + (st.last && status === 'ok' ? ' · última vez ' + EP.ago(st.last) : '');
    line.append(i, t);
    blk.appendChild(line);
    if (st.email) blk.appendChild(F().p('Cuenta: ' + st.email, 'help'));
    if (lastError && status !== 'ok') blk.appendChild(F().p(lastError, 'help bad'));
    const row = EP.el('div', 'row');
    row.append(F().btn('Sincronizar ahora', 'fa-rotate', chipClick, 'small'), F().btn('Desconectar', 'fa-link-slash', async () => {
      if (await EP.ui.confirm('¿Desconectar Drive?', 'Tus archivos se quedan en tu Drive y en este navegador. Solo deja de sincronizarse.', 'Desconectar')) EP.drive.disconnect();
    }, 'small ghost'));
    blk.appendChild(row);
  };

  /* ---------- Arranque ---------- */
  EP.drive.init = () => {
    const bar = $('.topbar');
    const status0 = $('#saveStatus');
    if (bar && status0 && !$('#driveChip')) {
      const chip = EP.el('button', 'drive-chip'); chip.id = 'driveChip'; chip.type = 'button'; chip.hidden = true;
      chip.addEventListener('click', chipClick);
      status0.after(chip);
    }
    EP.db.onChange(EP.drive.noteChange);
    if (st.on) {
      if (EP.drive.tokenOk()) setTimeout(() => EP.drive.sync(), 800);
      else setStatus('needsAuth');
    }
    // Al volver a la app (por ejemplo, del celular al PC) se traen los cambios
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && st.on && EP.drive.tokenOk()) EP.drive.sync(); });
    window.addEventListener('online', () => { if (st.on) EP.drive.schedule(500); });
    window.addEventListener('offline', () => { if (st.on) setStatus('offline'); });
    setInterval(() => { if (st.on && EP.drive.tokenOk() && document.visibilityState === 'visible' && !running) EP.drive.sync(); }, 120000);
    EP.drive.paint();
  };
})();
