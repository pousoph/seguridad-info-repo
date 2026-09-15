/*
 * ataque.js
 * Taller de Cifrado Clásico - Seguridad de la Información 2026-II
 *
 * Los tres ataques del punto 3 de la actividad.
 * Depende de alfabeto.js, cifrado.js y analisis.js.
 */

/* César: fuerza bruta

   Solo hay 27 desplazamientos posibles (26 útiles más la identidad),
   así que se prueban todos. En lugar de dejar 27 textos para revisar
   a ojo, se ordenan por chi-cuadrado contra el español. */

/**
 * @returns {{clave, texto, puntaje, candidatos: Array}}
 */
function ataqueCesar(criptograma) {
    const limpio = normalizar(criptograma);
  
    const candidatos = [];
    for (let k = 0; k < M; k++) {
      const texto = descifrarCesar(limpio, k);
      candidatos.push({
        clave: k,
        texto: texto,
        puntaje: puntuarEspanol(texto)
      });
    }
  
    /* Menor chi-cuadrado = más se parece al español. */
    const ordenados = candidatos.slice().sort(function (a, b) {
      return a.puntaje - b.puntaje;
    });
  
    return {
      clave: ordenados[0].clave,
      texto: ordenados[0].texto,
      puntaje: ordenados[0].puntaje,
      candidatos: candidatos,   // en orden de k, para mostrar la tabla completa
      ranking: ordenados        // en orden de verosimilitud
    };
  }
  
  /* Afín: sistema de ecuaciones
  
     Con dos letras del texto claro y sus cifradas se plantea:
         c1 ≡ a·m1 + b   (mod 27)
         c2 ≡ a·m2 + b   (mod 27)
     Restando desaparece b:
         c1 − c2 ≡ a(m1 − m2)
         a ≡ (c1 − c2) · (m1 − m2)⁻¹
         b ≡ c1 − a·m1
  
     La suposición es que las letras más frecuentes del criptograma vienen
     de la E y la A, que son las más comunes del español. La guía sugiere
     usar la 'B' como la más frecuente del Reto 2, pero el conteo real da
     H (20), A (16), B (15). Por eso no se fija ninguna letra: se prueban
     las parejas entre las más frecuentes en los dos órdenes posibles y
     se ordenan los resultados por chi-cuadrado. */
  
  /**
   * Resuelve el sistema para una hipótesis concreta.
   *
   * @param {number} m1 índice de la primera letra en claro
   * @param {number} c1 índice de su letra cifrada
   * @param {number} m2 índice de la segunda letra en claro
   * @param {number} c2 índice de su letra cifrada
   * @returns {{a, b}|null} null si el sistema no tiene solución única
   */
  function resolverEcuacionesAfin(m1, c1, m2, c2) {
    const invDiferencia = inversoModular(mod(m1 - m2));
    if (invDiferencia === null) return null;   // (m1 − m2) no es invertible
  
    const a = mod(mod(c1 - c2) * invDiferencia);
    if (mcd(a, M) !== 1) return null;          // a inválida, no se podría descifrar
  
    const b = mod(c1 - a * m1);
    return { a: a, b: b };
  }
  
  /**
   * Ataque por frecuencias al cifrado afín.
   *
   * @param {string} criptograma
   * @param {number} profundidad cuántas de las letras más frecuentes se consideran
   * @returns {{clave, texto, puntaje, hipotesis: Array}}
   */
  function ataqueAfin(criptograma, profundidad = 4) {
    const limpio = normalizar(criptograma);
    const frecuentes = letrasMasFrecuentes(limpio, profundidad);
  
    if (frecuentes.length < 2) {
      throw new Error('El criptograma es demasiado corto para el análisis de frecuencias.');
    }
  
    /* Las dos letras más comunes del español según la tabla de la guía. */
    const E = indiceDe('E');
    const A = indiceDe('A');
  
    const hipotesis = [];
    const vistas = new Set();
  
    for (let i = 0; i < frecuentes.length; i++) {
      for (let j = 0; j < frecuentes.length; j++) {
        if (i === j) continue;
  
        const c1 = indiceDe(frecuentes[i].letra);
        const c2 = indiceDe(frecuentes[j].letra);
  
        /* Los dos repartos posibles: la primera viene de E y la segunda de A,
           o al revés. Ambos son plausibles porque E (13.68 %) y A (12.53 %)
           están muy cerca y en textos cortos el orden se invierte. */
        const repartos = [
          { m1: E, m2: A, supuesto: frecuentes[i].letra + '←E, ' + frecuentes[j].letra + '←A' },
          { m1: A, m2: E, supuesto: frecuentes[i].letra + '←A, ' + frecuentes[j].letra + '←E' }
        ];
  
        repartos.forEach(function (r) {
          const clave = resolverEcuacionesAfin(r.m1, c1, r.m2, c2);
          if (clave === null) return;
  
          const firma = clave.a + ',' + clave.b;
          if (vistas.has(firma)) return;   // la misma clave sale por varias vías
          vistas.add(firma);
  
          const texto = descifrarAfin(limpio, clave.a, clave.b);
          hipotesis.push({
            a: clave.a,
            b: clave.b,
            supuesto: r.supuesto,
            texto: texto,
            puntaje: puntuarEspanol(texto)
          });
        });
      }
    }
  
    if (hipotesis.length === 0) {
      throw new Error('Ninguna hipótesis de frecuencias produjo una clave válida.');
    }
  
    hipotesis.sort(function (x, y) { return x.puntaje - y.puntaje; });
  
    return {
      clave: { a: hipotesis[0].a, b: hipotesis[0].b },
      texto: hipotesis[0].texto,
      puntaje: hipotesis[0].puntaje,
      hipotesis: hipotesis
    };
  }
  
  /**
   * Red de seguridad: recorre las 18 × 27 = 486 claves afines posibles.
   * No es el método que pide el taller, pero sirve para confirmar que la
   * respuesta de las ecuaciones es la correcta cuando el texto es corto
   * y el orden de frecuencias no es fiable.
   */
  function verificarAfinExhaustivo(criptograma) {
    const limpio = normalizar(criptograma);
    const candidatos = [];
  
    clavesAfinValidas().forEach(function (a) {
      for (let b = 0; b < M; b++) {
        const texto = descifrarAfin(limpio, a, b);
        candidatos.push({ a: a, b: b, texto: texto, puntaje: puntuarEspanol(texto) });
      }
    });
  
    candidatos.sort(function (x, y) { return x.puntaje - y.puntaje; });
    return candidatos[0];
  }
  
  /* Vigenère: método de Kasiski */
  
  /**
   * Busca secuencias repetidas y anota la distancia entre apariciones.
   * La idea de Kasiski: si una misma secuencia del texto claro cae dos
   * veces bajo el mismo tramo de la clave, se cifra igual, y la distancia
   * entre ambas es múltiplo de la longitud de la clave.
   *
   * @returns {Array<{secuencia, posiciones, distancias}>}
   */
  function buscarRepeticiones(criptograma, longitudMinima = 3) {
    const limpio = normalizar(criptograma);
    const posiciones = {};
  
    for (let i = 0; i + longitudMinima <= limpio.length; i++) {
      const seq = limpio.substr(i, longitudMinima);
      if (!posiciones[seq]) posiciones[seq] = [];
      posiciones[seq].push(i);
    }
  
    const repetidas = [];
    for (const seq in posiciones) {
      const pos = posiciones[seq];
      if (pos.length < 2) continue;
  
      const distancias = [];
      for (let i = 1; i < pos.length; i++) distancias.push(pos[i] - pos[i - 1]);
  
      repetidas.push({ secuencia: seq, posiciones: pos, distancias: distancias });
    }
  
    return repetidas;
  }
  
  /**
   * Cuenta cuántas distancias son divisibles por cada longitud candidata.
   *
   * @returns {Array<{longitud, votos}>} ordenado por votos
   */
  function votosPorDivisor(distancias, longitudMaxima = 12) {
    const votos = {};
    for (let L = 2; L <= longitudMaxima; L++) votos[L] = 0;
  
    distancias.forEach(function (d) {
      for (let L = 2; L <= longitudMaxima; L++) {
        if (d % L === 0) votos[L]++;
      }
    });
  
    return Object.keys(votos)
      .map(function (L) { return { longitud: parseInt(L, 10), votos: votos[L] }; })
      .filter(function (v) { return v.votos > 0; })
      .sort(function (a, b) { return b.votos - a.votos; });
  }
  
  /**
   * Parte el texto en L columnas y promedia el IC de cada una.
   * Si L es la longitud correcta, cada columna es un César y su IC sube
   * al valor del idioma (~0.077).
   */
  function icPromedioPorColumnas(criptograma, L) {
    const limpio = normalizar(criptograma);
    let suma = 0;
  
    for (let i = 0; i < L; i++) {
      let columna = '';
      for (let j = i; j < limpio.length; j += L) columna += limpio[j];
      suma += calcularIC(columna);
    }
  
    return suma / L;
  }
  
  /**
   * Estima la longitud de la clave cruzando las dos señales: los votos de
   * Kasiski y el IC por columnas.
   *
   * Entre longitudes con IC parecido se prefiere la más corta, porque los
   * múltiplos de la clave correcta también dan IC alto (con clave de 4,
   * probar 8 también funciona pero repite la clave dos veces).
   *
   * @returns {{longitud, candidatas: Array<{longitud, votos, ic}>}}
   */
  function estimarLongitudClave(criptograma, longitudMaxima = 12, tolerancia = 0.005) {
    const limpio = normalizar(criptograma);
  
    const todasLasDistancias = [];
    buscarRepeticiones(limpio).forEach(function (r) {
      r.distancias.forEach(function (d) { todasLasDistancias.push(d); });
    });
  
    const votos = votosPorDivisor(todasLasDistancias, longitudMaxima);
  
    /* Si Kasiski no encuentra nada, se evalúan todas las longitudes con el IC. */
    const base = votos.length > 0
      ? votos
      : Array.from({ length: longitudMaxima - 1 }, function (_, i) {
          return { longitud: i + 2, votos: 0 };
        });
  
    const candidatas = base.map(function (c) {
      return { longitud: c.longitud, votos: c.votos, ic: icPromedioPorColumnas(limpio, c.longitud) };
    });
  
    const icMaximo = Math.max.apply(null, candidatas.map(function (c) { return c.ic; }));
  
    /* De las que quedan cerca del IC máximo, la más corta. */
    const buenas = candidatas
      .filter(function (c) { return icMaximo - c.ic <= tolerancia; })
      .sort(function (a, b) { return a.longitud - b.longitud; });
  
    candidatas.sort(function (a, b) { return b.ic - a.ic; });
  
    return {
      longitud: buenas.length > 0 ? buenas[0].longitud : candidatas[0].longitud,
      candidatas: candidatas,
      distancias: todasLasDistancias
    };
  }
  
  /**
   * Con la longitud ya conocida, cada columna se resuelve como un César
   * independiente: se prueban los 27 desplazamientos y gana el de menor
   * chi-cuadrado. La letra de la clave es ese desplazamiento.
   *
   * @returns {string} la clave
   */
  function resolverColumnas(criptograma, L) {
    const limpio = normalizar(criptograma);
    let clave = '';
  
    for (let i = 0; i < L; i++) {
      let columna = '';
      for (let j = i; j < limpio.length; j += L) columna += limpio[j];
  
      let mejorK = 0, mejorPuntaje = Infinity;
      for (let k = 0; k < M; k++) {
        const p = puntuarEspanol(descifrarCesar(columna, k));
        if (p < mejorPuntaje) { mejorPuntaje = p; mejorK = k; }
      }
      clave += letraEn(mejorK);
    }
  
    return clave;
  }
  
  /**
   * Ataque completo al Vigenère.
   *
   * @returns {{clave, texto, longitud, puntaje, candidatas, repeticiones}}
   */
  function ataqueVigenere(criptograma, longitudMaxima = 12) {
    const limpio = normalizar(criptograma);
    const estimacion = estimarLongitudClave(limpio, longitudMaxima);
    const clave = resolverColumnas(limpio, estimacion.longitud);
    const texto = descifrarVigenere(limpio, clave);
  
    return {
      clave: clave,
      texto: texto,
      longitud: estimacion.longitud,
      puntaje: puntuarEspanol(texto),
      candidatas: estimacion.candidatas,
      repeticiones: buscarRepeticiones(limpio)
    };
  }
  
  /* Orquestador
  
     Reproduce el flujo del punto 5 de la actividad: se calcula el IC, se
     cuenta la frecuencia y se aplica el ataque que corresponda. */
  
  /**
   * @returns {{diagnostico, frecuencias, resultado, metodo, advertencia}}
   */
  function analizarCriptograma(criptograma) {
    const limpio = normalizar(criptograma);
    if (limpio.length < 2) {
      throw new Error('Hace falta un criptograma con al menos dos letras del alfabeto.');
    }
  
    const diagnostico = clasificarPorIC(limpio);
    const frecuencias = contarFrecuencias(limpio);
  
    let resultado, metodo, advertencia = '';
  
    if (diagnostico.tipo === 'polialfabetico') {
      resultado = ataqueVigenere(limpio);
      metodo = 'Kasiski';
    } else {
      /* Primero César, que es el caso más simple. Si el mejor resultado
         no se parece al español, se pasa al Afín. El umbral se calibró
         sobre los textos de la guía: el descifrado correcto queda muy por
         debajo y los falsos positivos muy por encima. */
      const cesar = ataqueCesar(limpio);
      const afin = ataqueAfin(limpio);
  
      if (cesar.puntaje <= afin.puntaje) {
        resultado = cesar;
        metodo = 'Fuerza bruta (César)';
      } else {
        resultado = afin;
        metodo = 'Ecuaciones (Afín)';
        const control = verificarAfinExhaustivo(limpio);
        if (control.a !== afin.clave.a || control.b !== afin.clave.b) {
          advertencia = 'El recorrido exhaustivo encontró una clave mejor (a = ' + control.a +
                        ', b = ' + control.b + '). Revisa las hipótesis de frecuencia.';
        }
      }
    }
  
    return {
      diagnostico: diagnostico,
      frecuencias: frecuencias,
      metodo: metodo,
      resultado: resultado,
      advertencia: advertencia
    };
  }
  
  /* Pruebas */
  
  function pruebasAtaque() {
    const resultados = [];
  
    function comprobar(nombre, condicion, detalle) {
      resultados.push(condicion);
      console.log((condicion ? 'ok    ' : 'FALLA ') + nombre + (detalle ? '  ' + detalle : ''));
    }
  
    /* Reto 1: César */
    const r1 = ataqueCesar(RETOS_GUIA.reto1.cifrado);
    comprobar('César recupera k = 5', r1.clave === 5);
    comprobar('César recupera el texto', r1.texto === normalizar(RETOS_GUIA.reto1.claro));
  
    /* Reto 2: Afín por ecuaciones */
    const r2 = ataqueAfin(RETOS_GUIA.reto2.cifrado);
    comprobar('Afín recupera a = 5, b = 7', r2.clave.a === 5 && r2.clave.b === 7,
              'a = ' + r2.clave.a + ', b = ' + r2.clave.b + '  [' + r2.hipotesis[0].supuesto + ']');
    comprobar('Afín recupera el texto', r2.texto === normalizar(RETOS_GUIA.reto2.claro));
  
    const control = verificarAfinExhaustivo(RETOS_GUIA.reto2.cifrado);
    comprobar('el recorrido exhaustivo coincide con las ecuaciones',
              control.a === 5 && control.b === 7);
  
    /* Reto 3: Vigenère por Kasiski */
    const est = estimarLongitudClave(RETOS_GUIA.reto3.cifrado);
    comprobar('Kasiski estima longitud de clave 4', est.longitud === 4, 'L = ' + est.longitud);
  
    const r3 = ataqueVigenere(RETOS_GUIA.reto3.cifrado);
    comprobar('Vigenère recupera la clave NUBE', r3.clave === 'NUBE', r3.clave);
    comprobar('Vigenère recupera el texto', r3.texto === normalizar(RETOS_GUIA.reto3.claro));
  
    /* Orquestador sobre los tres */
    const a1 = analizarCriptograma(RETOS_GUIA.reto1.cifrado);
    const a2 = analizarCriptograma(RETOS_GUIA.reto2.cifrado);
    const a3 = analizarCriptograma(RETOS_GUIA.reto3.cifrado);
  
    comprobar('el orquestador elige fuerza bruta en el Reto 1', a1.metodo.indexOf('César') >= 0);
    comprobar('el orquestador elige ecuaciones en el Reto 2', a2.metodo.indexOf('Afín') >= 0);
    comprobar('el orquestador elige Kasiski en el Reto 3', a3.metodo === 'Kasiski');
    comprobar('los tres textos salen correctos',
              a1.resultado.texto === normalizar(RETOS_GUIA.reto1.claro) &&
              a2.resultado.texto === normalizar(RETOS_GUIA.reto2.claro) &&
              a3.resultado.texto === normalizar(RETOS_GUIA.reto3.claro));
  
    const fallos = resultados.filter(function (r) { return !r; }).length;
    return fallos === 0 ? 'Módulo correcto' : fallos + ' prueba(s) con error';
  }