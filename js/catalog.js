/* Estudio EP — catálogo de plantillas listas para usar.
   Incluye los kits que José Luis ya había creado (Taller EP, VIH Tarapacá, Mitos de América)
   y plantillas genéricas para armar dinámicas propias. */
window.EP = window.EP || {};

EP.CATALOG = [
  {
    id: 'refranes', group: 'Kits de José Luis', icon: 'fa-puzzle-piece', color: '#d97706',
    name: 'Taller EP · Refranes', desc: 'Cada refrán partido en dos cartas. Cada participante busca su otra mitad.',
    build() {
      const refranes = [
        ['No hay mal', 'que dure cien años'], ['A quien madruga,', 'Dios lo ayuda'],
        ['Más vale pájaro en mano', 'que cien volando'], ['El que ríe último,', 'ríe mejor'],
        ['No es oro', 'todo lo que reluce'], ['Camarón que se duerme', 'se lo lleva la corriente'],
        ['Dime con quién andas', 'y te diré quién eres'], ['Perro que ladra', 'no muerde']
      ];
      const style = { bg: '#ffffff', title: '', titleFont: 'Merriweather', titleSize: 15, titleColor: '#b45309',
        footer: 'Busca tu otra mitad', textColor: '#d97706', borderW: 1.2, borderColor: '#d97706', padding: 6 };
      const back = { bg: '#fef3c7', icon: 'fa-puzzle-piece', iconColor: '#d97706', iconSize: 36, borderW: 1.2, borderColor: '#d97706' };
      return refranes.flatMap(([a, b], i) => [a, b].map((txt, k) => EP.newCard({
        name: `Refrán ${i + 1}${k ? 'B' : 'A'}`, front: Object.assign({}, style, { title: txt, text: '' }), back
      })));
    }
  },
  {
    id: 'vih', group: 'Kits de José Luis', icon: 'fa-heart-pulse', color: '#8B3A3A',
    name: 'Taller VIH Tarapacá', desc: 'Cartas de mito o verdad, situaciones para conversar y la guía de la persona facilitadora.',
    info: {
      players: '10 a 25', time: '2 h 30 min', objective: 'Derribar mitos sobre el VIH y tejer una red de cuidado colectivo.',
      rules: 'Fase 1 · Encuadre (20 min): técnica de la telaraña. Hablemos de lo que nos da miedo y de cómo nos sostenemos.\n\nFase 2 · Árbol de mitos (40 min): raíces (mitos), tronco (miedos), hojas (consecuencias del silencio).\n\nFase 3 · Vínculos y violencia (40 min): teatro foro sobre negociar el condón. El autocuidado es un acto político.\n\nFase 4 · Ruta del cuidado (45 min): usen las cartas para dialogar sin juicios.'
    },
    build() {
      const mitos = [
        ['El contagio', 'Si tengo VIH, mi pareja se va a contagiar seguro, aunque me cuide.'],
        ['El examen', 'El test duele, es caro y todo el pueblo se va a enterar de mi resultado.'],
        ['El estigma', 'Solo las personas promiscuas o los homosexuales se contagian de VIH.'],
        ['El matrimonio', 'Una mujer casada no necesita cuidarse, su esposo la protege de todo.'],
        ['Las ITS', 'Si tengo una infección como sífilis o gonorrea, se me quita sola con el tiempo.'],
        ['El futuro', 'El VIH es una sentencia de muerte. Si me sale positivo, mi vida se acaba.']
      ];
      const situaciones = [
        ['Violencia', 'Tu pareja se enoja y te grita porque le pediste usar condón. ¿Qué haces?'],
        ['La infidelidad', 'Descubres que tu pareja te fue infiel. Tienes miedo de hacerte el test. ¿Cómo lo enfrentas?'],
        ['La amiga', 'Una amiga te confiesa que tiene miedo de tener VIH, pero no va al médico por vergüenza. ¿Cómo la apoyas?']
      ];
      const base = { layout: 'banda', bg: '#fdfbf7', accent: '#8B3A3A', titleColor: '#ffffff', titleSize: 11,
        textColor: '#334155', textSize: 10, borderW: 0.6, borderColor: '#8B3A3A', footer: 'Tarapacá · Cuidado colectivo' };
      const back = { bg: '#5c1a1b', icon: 'fa-bullseye', iconColor: '#fdfbf7', iconSize: 40 };
      const card = (head, t, x, n) => EP.newCard({ name: n, back,
        front: Object.assign({}, base, { title: head, text: `${t}\n\n${x}` }) });
      return [
        ...mitos.map(([t, x]) => card('Mito o verdad', t, x, 'Mito: ' + t)),
        ...situaciones.map(([t, x]) => card('Situación', t, x, 'Situación: ' + t))
      ];
    }
  },
  {
    id: 'mitos', group: 'Kits de José Luis', icon: 'fa-earth-americas', color: '#B8860B',
    name: 'Mitos de América', desc: 'Cartas de territorio, desafío, memoria y personaje con estilo dorado.',
    build() {
      const tipos = [['Territorio', 'fa-mountain'], ['Desafío', 'fa-triangle-exclamation'], ['Memoria', 'fa-brain'], ['Personaje', 'fa-user']];
      return tipos.map(([t, icon]) => EP.newCard({
        name: t, sizeId: 'tarot',
        front: { bg: '#0f172a', icon, iconColor: '#D4AF37', iconSize: 30, title: t, titleFont: 'Playfair', titleColor: '#D4AF37',
          titleSize: 16, text: 'Escribe aquí el relato, el desafío o el recuerdo.', font: 'Merriweather', textColor: '#e2e8f0',
          borderW: 1, borderColor: '#D4AF37', valign: 'top', padding: 7 },
        back: { bg: '#1e293b', icon: 'fa-feather', iconColor: '#D4AF37', iconSize: 34, title: 'Mitos de América',
          titleFont: 'Playfair', titleColor: '#D4AF37', titleSize: 13, borderW: 1, borderColor: '#D4AF37' }
      }));
    }
  },
  {
    id: 'emociones', group: 'Para talleres', icon: 'fa-face-smile', color: '#0e7490',
    name: 'Cartas de emociones', desc: 'Ocho emociones con color e ícono, para reconocer y nombrar lo que sentimos.',
    build() {
      const e = [['Alegría', '#facc15', 'fa-face-smile'], ['Tristeza', '#60a5fa', 'fa-face-sad-tear'], ['Rabia', '#ef4444', 'fa-face-angry'],
        ['Miedo', '#a78bfa', 'fa-face-grimace'], ['Sorpresa', '#fb923c', 'fa-face-surprise'], ['Calma', '#4ade80', 'fa-dove'],
        ['Vergüenza', '#f472b6', 'fa-eye'], ['Ternura', '#fda4af', 'fa-hand-holding-heart']];
      return e.map(([n, c, icon]) => EP.newCard({ name: n,
        front: { bg: c, icon, iconColor: '#1f2937', iconSize: 44, title: n, titleColor: '#1f2937', titleSize: 18,
          text: '¿Cuándo sentiste esto por última vez?', textColor: '#1f2937' },
        back: { bg: '#1f2937', icon: 'fa-heart', iconColor: '#ffffff', title: 'Emociones', titleColor: '#fff', titleSize: 12 } }));
    }
  },
  {
    id: 'preguntas', group: 'Para talleres', icon: 'fa-comments', color: '#15803d',
    name: 'Preguntas para conversar', desc: 'Doce preguntas abiertas para abrir el diálogo en grupo.',
    build() {
      const q = ['¿Qué te hace sentir en casa?', '¿A quién acudes cuando necesitas ayuda?', '¿Qué aprendiste de tu familia que quieres conservar?',
        '¿Qué te gustaría cambiar de tu barrio?', '¿Cuándo fue la última vez que te sentiste orgullosa u orgulloso de ti?',
        '¿Qué te cuesta pedir?', '¿Qué cosa pequeña te alegra el día?', '¿Qué consejo le darías a tu yo de hace diez años?',
        '¿Qué significa para ti cuidar a otra persona?', '¿Qué te da fuerza en los días difíciles?', '¿Qué te gustaría que el grupo supiera de ti?',
        '¿Qué te llevas de esta sesión?'];
      return q.map((t, i) => EP.newCard({ name: 'Pregunta ' + (i + 1),
        front: { layout: 'banda', accent: '#15803d', title: 'Conversemos', titleColor: '#fff', titleSize: 11, text: t, textSize: 12,
          textColor: '#14532d', font: 'Merriweather' },
        back: { bg: '#15803d', icon: 'fa-comments', iconColor: '#fff' } }));
    }
  },
  {
    id: 'dilemas', group: 'Para talleres', icon: 'fa-scale-balanced', color: '#7c3aed',
    name: 'Cartas de dilema', desc: 'Situaciones con dos caminos. El grupo discute qué haría y por qué.',
    build() {
      const d = [['Encuentras una billetera con dinero y sin documentos.', '¿La entregas a carabineros o la guardas?'],
        ['Tu amigo copia en una prueba y te pide no decir nada.', '¿Guardas el secreto o hablas?'],
        ['Te ofrecen un trabajo bien pagado lejos de tu familia.', '¿Te vas o te quedas?'],
        ['Ves a alguien molestando a un compañero.', '¿Intervienes o pides ayuda a otra persona?']];
      return d.map(([s, q], i) => EP.newCard({ name: 'Dilema ' + (i + 1),
        front: { layout: 'banda', accent: '#7c3aed', title: '¿Qué harías?', titleColor: '#fff', titleSize: 12, text: `${s}\n\n${q}`,
          textColor: '#2e1065', footer: 'Discutan en grupo' },
        back: { bg: '#7c3aed', icon: 'fa-question', iconColor: '#fff' } }));
    }
  },
  {
    id: 'memoria', group: 'Plantillas de juego', icon: 'fa-clone', color: '#be185d',
    name: 'Memoria (parejas)', desc: 'Ocho parejas de cartas cuadradas con ícono. Cambia los íconos por imágenes propias.',
    build() {
      const icons = ['fa-sun', 'fa-moon', 'fa-leaf', 'fa-fire', 'fa-water', 'fa-heart', 'fa-star', 'fa-key'];
      return icons.flatMap((icon, i) => [0, 1].map(k => EP.newCard({ name: `Pareja ${i + 1}${k ? 'B' : 'A'}`, sizeId: 'cuadrada', radius: 4,
        front: { icon, iconColor: '#be185d', iconSize: 40, title: '', text: '' },
        back: { bg: '#be185d', icon: 'fa-clone', iconColor: '#fff' } })));
    }
  },
  {
    id: 'roles', group: 'Plantillas de juego', icon: 'fa-user-secret', color: '#334155',
    name: 'Roles secretos', desc: 'Seis cartas de rol con el mismo dorso para repartir sin que se vean.',
    build() {
      return ['Rol 1', 'Rol 2', 'Rol 3', 'Rol 4', 'Rol 5', 'Rol 6'].map(n => EP.newCard({ name: n, sizeId: 'tarot',
        front: { layout: 'imagen_texto', title: n, text: 'Describe aquí qué puede hacer este rol y cuál es su objetivo secreto.', valign: 'top' },
        back: { bg: '#334155', icon: 'fa-user-secret', iconColor: '#fff', iconSize: 40 } }));
    }
  },
  {
    id: 'fichas', group: 'Plantillas de juego', icon: 'fa-circle', color: '#ea580c',
    name: 'Fichas de jugador', desc: 'Seis fichas redondas de 30 mm, una por color.',
    build() {
      const c = [['Rojo', '#dc2626'], ['Azul', '#2563eb'], ['Verde', '#16a34a'], ['Amarillo', '#eab308'], ['Morado', '#9333ea'], ['Naranja', '#ea580c']];
      return c.map(([n, col]) => EP.newToken({ name: 'Ficha ' + n, front: { bg: col, icon: 'fa-user', borderColor: '#111827' }, back: { bg: col } }));
    }
  },
  {
    id: 'tab-recorrido', group: 'Tableros', icon: 'fa-route', color: '#0369a1',
    name: 'Tablero de recorrido', desc: 'Casillas por el borde, en 4 hojas tamaño carta.',
    build() { return [EP.newBoard({ name: 'Recorrido', pattern: { type: 'track', n: 8 }, front: { title: 'El camino', valign: 'center', accent: '#0369a1' } })]; }
  },
  {
    id: 'tab-serpiente', group: 'Tableros', icon: 'fa-stairs', color: '#0369a1',
    name: 'Tablero serpenteante', desc: 'Casillas numeradas que avanzan en zigzag, en 4 hojas.',
    build() { return [EP.newBoard({ name: 'Serpenteante', pattern: { type: 'snake', n: 8, fill: '#ffffff', fillAlt: '#dbeafe' }, front: { title: '', valign: 'top' } })]; }
  },
  {
    id: 'tab-hex', group: 'Tableros', icon: 'fa-cubes', color: '#0369a1',
    name: 'Mapa hexagonal', desc: 'Hexágonos numerados para mapas de territorio, en 4 hojas.',
    build() { return [EP.newBoard({ name: 'Mapa hexagonal', pattern: { type: 'hex', n: 7, fill: '#ecfccb', fillAlt: '#d9f99d', color: '#3f6212' }, front: { title: '' } })]; }
  },

  /* ---------- Técnicas participativas (papelógrafos impresos en varias hojas) ---------- */
  {
    id: 'tec-foda', group: 'Técnicas participativas', icon: 'fa-table-cells-large', color: '#15803d',
    name: 'FODA', desc: 'Fortalezas, Oportunidades, Debilidades y Amenazas en 4 hojas carta (41 × 53 cm).',
    info: { objective: 'Analizar en grupo la situación de una organización, un territorio o un problema.',
      rules: '1. Presenta las cuatro zonas.\n2. En grupos, escriban en post-its lo que ven en cada zona (10 minutos por zona).\n3. Peguen los post-its y lean en voz alta.\n4. Agrupen las ideas parecidas.\n5. Cierren eligiendo una fortaleza para enfrentar una amenaza.' },
    build() { return [EP.newBoard({ name: 'FODA', pattern: { type: 'foda', opacity: 100, width: 0.8, color: '#1c2321' }, front: { title: 'FODA', titleSize: 34, valign: 'top', bg: '#ffffff' } })]; }
  },
  {
    id: 'tec-arbol', group: 'Técnicas participativas', icon: 'fa-tree', color: '#15803d',
    name: 'Árbol de problemas', desc: 'Raíces (causas), tronco (problema central) y copa (efectos), en 4 hojas.',
    info: { objective: 'Entender un problema desde sus causas y sus consecuencias, para decidir dónde actuar.',
      rules: '1. Acuerden el problema central y escríbanlo en el tronco.\n2. Pregunten «¿por qué pasa esto?» y escriban las causas en las raíces.\n3. Pregunten «¿qué provoca?» y escriban los efectos en la copa.\n4. Para pasar al árbol de objetivos, den vuelta cada problema en positivo.' },
    build() { return [EP.newBoard({ name: 'Árbol de problemas', pattern: { type: 'arbol', width: 0.8, color: '#1c2321' }, front: { title: 'Árbol de problemas', titleSize: 30, valign: 'top' } })]; }
  },
  {
    id: 'tec-linea', group: 'Técnicas participativas', icon: 'fa-timeline', color: '#15803d',
    name: 'Línea de tiempo (IAP)', desc: 'Fases de la Investigación Acción Participativa en 2 hojas horizontales. Cambia o agrega etapas.',
    info: { objective: 'Reconstruir en grupo la historia de un proceso o planificar sus etapas.',
      rules: '1. Expliquen cada etapa de la línea.\n2. Cada persona aporta hechos, fechas o recuerdos en post-its.\n3. Ubíquenlos en la etapa que corresponda.\n4. Conversen: ¿qué se repite?, ¿qué falta?, ¿qué aprendimos?' },
    build() { return [EP.newBoard({ name: 'Línea de tiempo', sheets: { cols: 2, rows: 1, orient: 'landscape' }, pattern: { type: 'linea', width: 0.8, color: '#1c2321' }, front: { title: 'Línea de tiempo', titleSize: 26, valign: 'top' } })]; }
  },
  {
    id: 'tec-mapa', group: 'Técnicas participativas', icon: 'fa-map-location-dot', color: '#15803d',
    name: 'Mapa colectivo', desc: 'Base para cartografía social con rosa de los vientos y simbología, en 6 hojas.',
    info: { objective: 'Dibujar entre todos el territorio: lugares, riesgos, redes y lo que se quiere cambiar.',
      rules: '1. Ubiquen primero puntos conocidos: la sede, la escuela, la plaza.\n2. Dibujen calles y lugares importantes.\n3. Marquen con los colores de la simbología.\n4. Conversen sobre lo que aparece en el mapa y lo que no.' },
    build() { return [EP.newBoard({ name: 'Mapa colectivo', sheets: { cols: 3, rows: 2, orient: 'portrait' }, pattern: { type: 'mapa', width: 0.6, color: '#1c2321' }, front: { title: 'Nuestro territorio', titleSize: 30, valign: 'top' } })]; }
  },

  /* ---------- Mecánicas de juego para adaptar a cualquier tema ---------- */
  {
    id: 'mec-colores', group: 'Mecánicas de juego', icon: 'fa-palette', color: '#dc2626',
    name: 'Cartas de colores y números', desc: '4 colores del 1 al 9 y cartas especiales. Se descarta por color o número; con las especiales se responde una pregunta.',
    info: { objective: 'Conversar sobre el tema mientras se juega a descartar cartas.',
      rules: 'Se reparten 7 cartas. Por turno, descarta una carta del mismo color o número que la de la mesa.\nCarta «Pregunta»: responde la pregunta del tema que lee quien facilita.\nCarta «Cambia color»: elige el color que sigue.\nCarta «Salta»: el siguiente pierde el turno.\nGana quien se queda sin cartas.' },
    build() {
      const cols = [['Rojo', '#dc2626'], ['Azul', '#1d4ed8'], ['Verde', '#15803d'], ['Amarillo', '#ca8a04']];
      const out = [];
      cols.forEach(([n, c]) => {
        for (let k = 1; k <= 9; k++) out.push(EP.newCard({ name: `${n} ${k}`, front: { bg: c, title: String(k), titleSize: 60, titleColor: '#fff', titleFont: 'Bebas', text: '', footer: n, textColor: '#fff', borderW: 3, borderColor: '#ffffff' }, back: { bg: '#1c1917', title: 'Tu tema', titleColor: '#fff', titleFont: 'Bebas', titleSize: 26, icon: '' } }));
        ['Pregunta', 'Salta'].forEach(s => out.push(EP.newCard({ name: `${n} ${s}`, front: { bg: c, title: s, titleSize: 26, titleColor: '#fff', titleFont: 'Bebas', text: s === 'Pregunta' ? 'Responde una pregunta sobre el tema' : 'El siguiente pierde el turno', textColor: '#fff', borderW: 3, borderColor: '#ffffff' }, back: { bg: '#1c1917', title: 'Tu tema', titleColor: '#fff', titleFont: 'Bebas', titleSize: 26, icon: '' } })));
      });
      out.push(EP.newCard({ name: 'Cambia color', copies: 4, front: { bg: '#1c1917', title: 'Cambia color', titleSize: 22, titleColor: '#fff', titleFont: 'Bebas', text: 'Elige el color que sigue', textColor: '#fff', icon: 'fa-palette', iconColor: '#f2c14e' }, back: { bg: '#1c1917', title: 'Tu tema', titleColor: '#fff', titleFont: 'Bebas', titleSize: 26, icon: '' } }));
      return out;
    }
  },
  {
    id: 'mec-loteria', group: 'Mecánicas de juego', icon: 'fa-table-cells', color: '#7c2d12',
    name: 'Lotería', desc: '16 cartas de llamado y 4 tablas de 4 × 4, cada una con las palabras en otro orden.',
    info: { objective: 'Repasar conceptos del tema de forma entretenida.',
      rules: 'Quien facilita saca una carta de llamado y la lee (o la explica sin decir la palabra).\nQuien tenga esa palabra en su tabla la marca con una ficha.\nGana quien completa una fila. Antes de ganar, explica qué significa cada palabra de su fila.' },
    build() {
      const words = ['Respeto', 'Confianza', 'Celos', 'Control', 'Libertad', 'Diálogo', 'Límites', 'Consentimiento', 'Apoyo', 'Miedo', 'Igualdad', 'Cuidado', 'Autonomía', 'Amistad', 'Escucha', 'Acuerdo'];
      const calls = words.map(w => EP.newCard({ name: w, front: { layout: 'banda', accent: '#7c2d12', title: 'Lotería', titleColor: '#fff', titleSize: 11, text: w, textSize: 20, font: 'Merriweather' }, back: { bg: '#7c2d12', icon: 'fa-table-cells', iconColor: '#fff' } }));
      const shuffle = (a, seed) => a.map((v, i) => [Math.sin(seed * 99 + i * 7.3), v]).sort((x, y) => x[0] - y[0]).map(x => x[1]);
      const tablas = [1, 2, 3, 4].map(k => EP.newBoard({ name: 'Tabla ' + k, sheets: { cols: 1, rows: 1, orient: 'portrait' },
        pattern: { type: 'grid', n: 4, count: 16, numbers: false, labels: shuffle(words, k), labelSize: 16, fill: '#fff7ed', fillAlt: '#ffedd5', color: '#7c2d12', width: 0.8 },
        front: { title: '', bg: '#ffffff' } }));
      return [...calls, ...tablas];
    }
  },
  {
    id: 'mec-ruleta', group: 'Mecánicas de juego', icon: 'fa-dharmachakra', color: '#0e7490',
    name: 'Ruleta', desc: 'Ruleta de 6 a 12 sectores en una hoja, para recortar y girar con un lápiz y un clip.',
    info: { rules: 'Pega la ruleta en cartón. Pon un clip en el centro sujeto con la punta de un lápiz y hazlo girar.\nHaz lo que indique el sector donde se detenga.' },
    build() { return [EP.newBoard({ name: 'Ruleta', sheets: { cols: 1, rows: 1, orient: 'portrait' }, pattern: { type: 'ruleta', width: 0.8, color: '#1c2321' }, front: { title: '' } })]; }
  },
  {
    id: 'mec-misterio', group: 'Mecánicas de juego', icon: 'fa-magnifying-glass', color: '#334155',
    name: 'Misterio (detective)', desc: 'Sospechosos, lugares, objetos y pistas. Una carta de cada tipo va escondida en el sobre de la solución.',
    info: { objective: 'Razonar en grupo y descubrir qué pasó, a partir de una situación del tema.',
      rules: 'Sin mirar, guarden en un sobre una carta de sospechoso, una de lugar y una de objeto: esa es la solución.\nMezclen el resto y repártanlas.\nPor turno, propón una hipótesis («Fue ___, en ___, con ___»). Quien tenga una de esas cartas la muestra en secreto.\nAnota lo que descartas. Quien adivina la solución explica por qué y gana.' },
    build() {
      const mk = (kind, names, color, icon) => names.map(n => EP.newCard({ name: n, sizeId: 'tarot', front: { layout: 'imagen_texto', title: n, text: 'Describe aquí este ' + kind.toLowerCase() + '.', footer: kind, accent: color, borderW: 1.5, borderColor: color }, back: { bg: color, icon, iconColor: '#fff', iconSize: 40, title: kind, titleColor: '#fff', titleFont: 'Bebas', titleSize: 20 } }));
      return [...mk('Sospechoso', ['Sospechoso 1', 'Sospechoso 2', 'Sospechoso 3', 'Sospechoso 4', 'Sospechoso 5'], '#334155', 'fa-user-secret'),
        ...mk('Lugar', ['Lugar 1', 'Lugar 2', 'Lugar 3', 'Lugar 4', 'Lugar 5'], '#7c2d12', 'fa-house'),
        ...mk('Objeto', ['Objeto 1', 'Objeto 2', 'Objeto 3', 'Objeto 4', 'Objeto 5'], '#14532d', 'fa-key'),
        ...mk('Pista', ['Pista 1', 'Pista 2', 'Pista 3', 'Pista 4'], '#4c1d95', 'fa-magnifying-glass')];
    }
  },
  {
    id: 'mec-adivina', group: 'Mecánicas de juego', icon: 'fa-circle-question', color: '#be185d',
    name: 'Adivina el personaje', desc: '12 personajes con características. Se adivina haciendo preguntas de sí o no.',
    info: { rules: 'Cada persona saca un personaje en secreto.\nPor turno, haz una pregunta de sí o no («¿Tu personaje pide ayuda cuando lo necesita?»).\nCon las respuestas vas descartando. Gana quien adivina primero.\nAl final, conversen: ¿qué características les parecieron más importantes?' },
    build() {
      return Array.from({ length: 12 }, (_, i) => EP.newCard({ name: 'Personaje ' + (i + 1), front: { layout: 'imagen_texto', title: 'Personaje ' + (i + 1), text: 'Característica 1\nCaracterística 2\nCaracterística 3', accent: '#be185d', borderW: 1.5, borderColor: '#be185d' }, back: { bg: '#be185d', icon: 'fa-circle-question', iconColor: '#fff', iconSize: 40 } }));
    }
  },
  {
    id: 'mec-dibuja', group: 'Mecánicas de juego', icon: 'fa-pencil', color: '#ca8a04',
    name: 'Dibuja y adivina', desc: '20 cartas de palabras para dibujar o actuar sin hablar, en tres niveles.',
    info: { rules: 'Por equipos. Una persona saca una carta y tiene 1 minuto para dibujar (o actuar) la palabra sin hablar ni escribir letras.\nSi su equipo adivina, gana los puntos de la carta.\nDespués de adivinar, conversen qué tiene que ver esa palabra con el tema.' },
    build() {
      const lv = [['Fácil', 1, '#16a34a'], ['Media', 2, '#ca8a04'], ['Difícil', 3, '#dc2626']];
      return Array.from({ length: 20 }, (_, i) => { const [n, pts, c] = lv[i % 3]; return EP.newCard({ name: 'Palabra ' + (i + 1), front: { layout: 'banda', accent: c, title: `${n} · ${pts} punto${pts > 1 ? 's' : ''}`, titleColor: '#fff', titleSize: 11, text: 'Palabra ' + (i + 1), textSize: 20, font: 'Merriweather', footer: 'Dibuja o actúa sin hablar' }, back: { bg: '#ca8a04', icon: 'fa-pencil', iconColor: '#fff' } }); });
    }
  },
  {
    id: 'mec-imagenes', group: 'Mecánicas de juego', icon: 'fa-images', color: '#0369a1',
    name: 'Cartas de imagen para contar historias', desc: '24 cartas grandes de solo imagen y fichas numeradas para votar.',
    info: { rules: 'Cada persona recibe 5 cartas. Quien narra elige una, dice una frase y la deja boca abajo.\nLos demás eligen de su mano la carta que mejor calce con la frase.\nSe mezclan, se muestran y todos votan con sus fichas cuál era la de quien narra.\nConversen qué vio cada persona en las imágenes.' },
    build() {
      const cards = Array.from({ length: 24 }, (_, i) => EP.newCard({ name: 'Imagen ' + (i + 1), sizeId: 'grande', radius: 4, front: { layout: 'imagen', title: '', text: '', bg: '#e2e8f0' }, back: { bg: '#0369a1', icon: 'fa-images', iconColor: '#fff', iconSize: 40 } }));
      const votes = [1, 2, 3, 4, 5, 6].map(k => EP.newToken({ name: 'Voto ' + k, copies: 6, front: { bg: '#0369a1', icon: '', title: String(k), titleSize: 18, titleColor: '#fff', titleFont: 'Bebas' }, back: { bg: '#0369a1' } }));
      return [...cards, ...votes];
    }
  },
  {
    id: 'mec-escape', group: 'Mecánicas de juego', icon: 'fa-lock', color: '#111827',
    name: 'Escape room', desc: '5 desafíos con candado, sus pistas y la carta final. Cada desafío entrega un número del código.',
    info: { objective: 'Resolver desafíos en equipo antes de que se acabe el tiempo.',
      rules: 'Tiempo: 30 a 45 minutos.\nEl equipo recibe el Desafío 1. Al resolverlo obtiene un número del código y el desafío siguiente.\nSi se traban, pueden pedir una pista (máximo 3 en todo el juego).\nCon los 5 números abren el candado final.\nCierre: ¿cómo se organizaron?, ¿quién escuchó a quién?' },
    build() {
      const out = [];
      for (let i = 1; i <= 5; i++) {
        out.push(EP.newCard({ name: 'Desafío ' + i, sizeId: 'tarot', front: { layout: 'banda', accent: '#111827', title: 'Desafío ' + i, titleColor: '#fff', titleSize: 14, text: 'Escribe aquí el acertijo o la tarea. Al resolverlo, el equipo obtiene un número.', footer: `Número del código: posición ${i}`, icon: 'fa-lock', iconColor: '#111827' }, back: { bg: '#111827', icon: 'fa-lock', iconColor: '#f2c14e', iconSize: 40 } }));
        out.push(EP.newCard({ name: 'Pista ' + i, front: { layout: 'banda', accent: '#f2c14e', title: 'Pista · desafío ' + i, titleColor: '#111827', titleSize: 11, text: 'Escribe una ayuda que no regale la respuesta.' }, back: { bg: '#f2c14e', icon: 'fa-lightbulb', iconColor: '#111827' } }));
      }
      out.push(EP.newCard({ name: 'Candado final', sizeId: 'tarot', front: { layout: 'banda', accent: '#15803d', title: '¡Lo lograron!', titleColor: '#fff', text: 'Escribe aquí el mensaje final del tema.', icon: 'fa-lock-open', iconColor: '#15803d' }, back: { bg: '#15803d', icon: 'fa-lock-open', iconColor: '#fff', iconSize: 40 } }));
      return out;
    }
  }
];
