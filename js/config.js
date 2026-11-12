/* Estudio EP — configuración de quien instala la app.
   googleClientId: el "ID de cliente OAuth" que entrega Google Cloud para conectar Google Drive.
   Mientras esté vacío, la app funciona igual, pero sin el botón de Drive activo.
   Cómo conseguirlo: ver LEEME.md, sección "Conectar Google Drive (para quien instala)". */
window.EP = window.EP || {};
EP.CONFIG = {
  googleClientId: ''
};
