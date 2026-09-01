/*
 * analisis.js
 * Taller de Cifrado Clásico - Seguridad de la Información 2026-II
 *
 * Herramientas de diagnóstico: índice de coincidencia, conteo de
 * frecuencias y clasificación del tipo de cifrado.
 * Depende de alfabeto.js.
 */

/* Tablas de referencia

   Los valores son los del punto 4 de la guía. La guía no incluye la Ñ
   aunque el alfabeto de trabajo sí la tiene, así que se completa con
   0.31 % (valor habitual en corpus del español). Para el inglés la Ñ
   no existe y se deja en 0.

   Las tablas no suman exactamente 100 (español 100.14, inglés 100.02).
   Se normalizan al usarlas, no se retocan los valores de la guía. */

   const FRECUENCIA_ESPANOL = {
    A: 12.53, B: 1.42, C: 4.68, D: 5.86, E: 13.68, F: 0.69, G: 1.01,
    H: 0.70,  I: 6.25, J: 0.44, K: 0.02, L: 4.97,  M: 3.15, N: 6.71,
    'Ñ': 0.31,
    O: 8.68,  P: 2.51, Q: 0.88, R: 6.87, S: 7.98,  T: 4.63, U: 3.93,
    V: 0.90,  W: 0.01, X: 0.22, Y: 0.90, Z: 0.52
  };
  
  const FRECUENCIA_INGLES = {
    A: 8.17, B: 1.49, C: 2.78, D: 4.25, E: 12.70, F: 2.23, G: 2.02,
    H: 6.09, I: 6.97, J: 0.15, K: 0.77, L: 4.03,  M: 2.41, N: 6.75,
    'Ñ': 0,
    O: 7.51, P: 1.93, Q: 0.10, R: 5.99, S: 6.33,  T: 9.06, U: 2.76,
    V: 0.98, W: 2.36, X: 0.15, Y: 1.97, Z: 0.07
  };
  
  /* Valores de referencia del IC según el punto 3 de la guía.
     Para el polialfabético la guía da un rango 0.038 - 0.045; se usa su
     punto medio como referencia puntual. */
  const IC_REFERENCIA = {
    espanol: 0.077,
    ingles: 0.066,
    polialfabetico: 0.0415
  };
  
  /* Longitud mínima que exige el punto 1 del taller. Por debajo de esto
     el IC es ruidoso y la clasificación se marca como poco fiable. */
  const LONGITUD_MINIMA = 400;
  
  /* Índice de coincidencia */
  
  /**
   * IC = Σ fi(fi − 1) / N(N − 1)
   *
   * Mide la probabilidad de que dos letras tomadas al azar del texto
   * sean iguales. Un cifrado monoalfabético conserva el IC del idioma
   * porque solo renombra letras; uno polialfabético lo aplana.
   *
   * @param {string} texto
   * @returns {number} 0 si el texto tiene menos de dos letras
   */
  function calcularIC(texto) {
    const limpio = normalizar(texto);
    const n = limpio.length;
    if (n < 2) return 0;
  
    const conteo = {};
    for (let i = 0; i < n; i++) {
      conteo[limpio[i]] = (conteo[limpio[i]] || 0) + 1;
    }
  
    let suma = 0;
    for (const letra in conteo) {
      suma += conteo[letra] * (conteo[letra] - 1);
    }
  
    return suma / (n * (n - 1));
  }
  
  /* Conteo de frecuencias */
  
  /**
   * Frecuencias del criptograma, ordenadas de mayor a menor.
   * Incluye las 27 letras aunque no aparezcan, para poder comparar
   * fila por fila contra la tabla de referencia.
   *
   * @returns {{total: number, letras: Array<{letra,veces,porcentaje,esperadoEs,esperadoEn}>}}
   */
  function contarFrecuencias(texto) {
    const limpio = normalizar(texto);
    const total = limpio.length;
  
    const conteo = {};
    for (let i = 0; i < M; i++) conteo[ALFABETO[i]] = 0;
    for (let i = 0; i < total; i++) conteo[limpio[i]]++;
  
    const letras = ALFABETO.split('').map(function (letra) {
      return {
        letra: letra,
        veces: conteo[letra],
        porcentaje: total === 0 ? 0 : (conteo[letra] * 100) / total,
        esperadoEs: FRECUENCIA_ESPANOL[letra],
        esperadoEn: FRECUENCIA_INGLES[letra]
      };
    });
  
    /* Orden descendente por conteo; a igualdad, orden alfabético, para
       que el resultado sea estable entre ejecuciones. */
    letras.sort(function (a, b) {
      if (b.veces !== a.veces) return b.veces - a.veces;
      return indiceDe(a.letra) - indiceDe(b.letra);
    });
  
    return { total: total, letras: letras };
  }
  
  /**
   * Las n letras más frecuentes. El ataque al afín las necesita para
   * plantear el sistema de ecuaciones.
   */
  function letrasMasFrecuentes(texto, n = 3) {
    return contarFrecuencias(texto).letras
      .filter(function (f) { return f.veces > 0; })
      .slice(0, n);
  }
  
  /* Clasificación del cifrado */  
  /**
   * Decide si el criptograma es monoalfabético o polialfabético.
   *
   * No se usan los rangos cerrados de la guía a propósito: el Reto 3 del
   * PDF, que es Vigenère, da IC = 0.0492 y quedaría fuera del rango
   * 0.038 - 0.045, con lo cual un umbral estricto lo clasificaría mal.
   * Se compara con los tres valores de referencia y gana el más cercano.
   *
   * @returns {{ic, tipo, referencia, cifradosPosibles, fiable, nota}}
   */
  function clasificarPorIC(texto) {
    const limpio = normalizar(texto);
    const ic = calcularIC(limpio);
  
    const candidatos = [
      { nombre: 'monoalfabético (español)', valor: IC_REFERENCIA.espanol,        tipo: 'monoalfabetico' },
      { nombre: 'monoalfabético (inglés)',  valor: IC_REFERENCIA.ingles,         tipo: 'monoalfabetico' },
      { nombre: 'polialfabético',           valor: IC_REFERENCIA.polialfabetico, tipo: 'polialfabetico' }
    ];
  
    let mejor = candidatos[0];
    let menorDistancia = Infinity;
    candidatos.forEach(function (c) {
      const d = Math.abs(ic - c.valor);
      if (d < menorDistancia) {
        menorDistancia = d;
        mejor = c;
      }
    });
  
    const esMono = mejor.tipo === 'monoalfabetico';
    const fiable = limpio.length >= LONGITUD_MINIMA;
  
    let nota;
    if (!fiable) {
      nota = 'El texto tiene ' + limpio.length + ' letras y el taller exige mínimo ' +
             LONGITUD_MINIMA + '. Por debajo de ese tamaño el IC es inestable, así que ' +
             'la clasificación es orientativa: confirma con el ataque.';
    } else if (esMono) {
      nota = 'El IC no distingue César de Afín: los dos son monoalfabéticos. Prueba ' +
             'primero la fuerza bruta del César; si ninguna de las 26 rotaciones da ' +
             'texto legible, es Afín.';
    } else {
      nota = 'Hay más de un alfabeto en juego. El siguiente paso es Kasiski para ' +
             'hallar la longitud de la clave.';
    }
  
    return {
      ic: ic,
      tipo: mejor.tipo,
      referencia: mejor.nombre,
      distancia: menorDistancia,
      cifradosPosibles: esMono ? ['César', 'Afín'] : ['Vigenère'],
      ataqueSugerido: esMono ? 'Fuerza bruta y, si falla, ecuaciones' : 'Kasiski',
      fiable: fiable,
      nota: nota
    };
  }
  
  /* Puntuación de candidatos
  
     La guía dice "iterar hasta encontrar coherencia". Para no revisar 26
     textos a ojo, se mide qué tan español parece cada candidato con la
     prueba chi-cuadrado contra la tabla de referencia. */
  
  /**
   * Chi-cuadrado entre las frecuencias observadas y una tabla esperada.
   * Cuanto menor, más se parece el texto al idioma.
   *
   * @param {string} texto
   * @param {Object} tabla FRECUENCIA_ESPANOL o FRECUENCIA_INGLES
   * @returns {number} Infinity si el texto está vacío
   */
  function chiCuadrado(texto, tabla = FRECUENCIA_ESPANOL) {
    const limpio = normalizar(texto);
    const n = limpio.length;
    if (n === 0) return Infinity;
  
    /* Las tablas de la guía no suman 100 exactos, así que se normalizan. */
    let sumaTabla = 0;
    for (const letra in tabla) sumaTabla += tabla[letra];
  
    const conteo = {};
    for (let i = 0; i < M; i++) conteo[ALFABETO[i]] = 0;
    for (let i = 0; i < n; i++) conteo[limpio[i]]++;
  
    let chi = 0;
    for (let i = 0; i < M; i++) {
      const letra = ALFABETO[i];
      /* Suelo para letras con esperado 0 (la Ñ en inglés): evita dividir
         por cero y penaliza su aparición, que es lo que corresponde. */
      const esperado = Math.max((tabla[letra] / sumaTabla) * n, 0.01);
      const diferencia = conteo[letra] - esperado;
      chi += (diferencia * diferencia) / esperado;
    }
  
    return chi;
  }
  
  /**
   * Atajo para ordenar candidatos de un ataque: menor puntaje, más
   * probable que sea español legible.
   */
  function puntuarEspanol(texto) {
    return chiCuadrado(texto, FRECUENCIA_ESPANOL);
  }
  
  /* Pruebas */
  
  function pruebasAnalisis() {
    const c1 = RETOS_GUIA.reto1.cifrado;
    const c2 = RETOS_GUIA.reto2.cifrado;
    const c3 = RETOS_GUIA.reto3.cifrado;
    const resultados = [];
  
    function comprobar(nombre, condicion, detalle) {
      resultados.push(condicion);
      console.log((condicion ? 'ok    ' : 'FALLA ') + nombre + (detalle ? '  ' + detalle : ''));
    }
  
    const ic1 = calcularIC(c1), ic2 = calcularIC(c2), ic3 = calcularIC(c3);
  
    comprobar('IC Reto 1 cerca de 0.070', Math.abs(ic1 - 0.0700) < 0.001, ic1.toFixed(4));
    comprobar('IC Reto 2 cerca de 0.073', Math.abs(ic2 - 0.0730) < 0.001, ic2.toFixed(4));
    comprobar('IC Reto 3 cerca de 0.049', Math.abs(ic3 - 0.0492) < 0.001, ic3.toFixed(4));
  
    comprobar('Reto 1 se clasifica monoalfabético', clasificarPorIC(c1).tipo === 'monoalfabetico');
    comprobar('Reto 2 se clasifica monoalfabético', clasificarPorIC(c2).tipo === 'monoalfabetico');
    comprobar('Reto 3 se clasifica polialfabético', clasificarPorIC(c3).tipo === 'polialfabetico',
              '(el rango cerrado de la guía habría fallado aquí)');
  
    /* El texto claro debe puntuar mucho mejor que su versión cifrada. */
    const claro = normalizar(RETOS_GUIA.reto1.claro);
    comprobar('el texto en claro puntúa mejor que el cifrado',
              puntuarEspanol(claro) < puntuarEspanol(c1),
              'claro ' + puntuarEspanol(claro).toFixed(1) + ' vs cifrado ' + puntuarEspanol(c1).toFixed(1));
  
    /* La rotación correcta del Reto 1 debe ser la de menor chi-cuadrado. */
    let mejorK = 0, mejorPuntaje = Infinity;
    for (let k = 0; k < M; k++) {
      const p = puntuarEspanol(descifrarCesar(c1, k));
      if (p < mejorPuntaje) { mejorPuntaje = p; mejorK = k; }
    }
    comprobar('chi-cuadrado señala k = 5 como la mejor rotación', mejorK === 5, 'k = ' + mejorK);
  
    /* Las tres letras más frecuentes del Reto 2, para el ataque afín. */
    const top = letrasMasFrecuentes(c2, 3).map(function (f) { return f.letra + '(' + f.veces + ')'; });
    console.log('info  Reto 2, letras más frecuentes: ' + top.join(' '));
    comprobar('la más frecuente del Reto 2 es H, no B como dice la guía',
              letrasMasFrecuentes(c2, 1)[0].letra === 'H');
  
    const fallos = resultados.filter(function (r) { return !r; }).length;
    return fallos === 0 ? 'Módulo correcto' : fallos + ' prueba(s) con error';
  }