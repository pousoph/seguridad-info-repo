/*
 * alfabeto.js
 * Taller de Cifrado Clásico - Seguridad de la Información 2026-II
 *
 * Base de todos los demás módulos: define el alfabeto de trabajo,
 * normaliza el texto de entrada y resuelve la aritmética modular.
 */

/* Alfabeto español de 27 letras. La Ñ va en la posición 14, entre N y O.
   Este orden se verificó contra los tres criptogramas de la guía. */
   const ALFABETO = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';
   const M = ALFABETO.length; // 27
   
   /* Índice de acceso rápido letra -> posición, para no recorrer la cadena. */
   const INDICES = {};
   for (let i = 0; i < M; i++) {
     INDICES[ALFABETO[i]] = i;
   }
   
   /* Marcador temporal para proteger la Ñ durante la descomposición Unicode.
      Se usa un carácter de control que jamás va a aparecer en un texto real. */
   const MARCA_ENIE = '\u0001';
   
   /**
    * Módulo que siempre devuelve un resultado entre 0 y m-1.
    * En JavaScript el operador % conserva el signo del dividendo:
    * (-3 % 27) da -3, no 24. Descifrar implica restar, así que sin esto
    * todos los descifrados quedan fuera de rango.
    */
   function mod(n, m = M) {
     return ((n % m) + m) % m;
   }
   
   /**
    * Posición de una letra dentro del alfabeto. Devuelve -1 si no pertenece.
    */
   function indiceDe(letra) {
     const i = INDICES[letra];
     return i === undefined ? -1 : i;
   }
   
   /**
    * Letra que ocupa una posición. Aplica mod, así que acepta índices
    * negativos o mayores que 26 sin reventar.
    */
   function letraEn(indice) {
     return ALFABETO[mod(indice)];
   }
   
   /**
    * Normaliza el texto según las reglas del punto 1 del taller:
    * mayúsculas, sin tildes ni diéresis, sin espacios ni puntuación,
    * conservando únicamente las 27 letras del alfabeto.
    *
    * La Ñ se protege antes de descomponer: NFD la separa en N + tilde,
    * y al borrar los diacríticos se convertiría en N.
    *
    * @param {string} texto
    * @returns {string} texto normalizado
    */
   function normalizar(texto) {
     if (typeof texto !== 'string') return '';
   
     return texto
       .normalize('NFC')                 // unifica la Ñ en un solo carácter
       .toUpperCase()
       .split('Ñ').join(MARCA_ENIE)      // la aparta del camino
       .normalize('NFD')                 // separa letras y diacríticos
       .replace(/[\u0300-\u036f]/g, '')  // borra tildes y diéresis: Á->A, Ü->U
       .split(MARCA_ENIE).join('Ñ')      // la devuelve a su sitio
       .split('')
       .filter(function (c) { return c in INDICES; })
       .join('');
   }
   
   /**
    * Normaliza e informa qué se descartó, para poder avisarle al usuario
    * en lugar de recortar la entrada sin decir nada.
    *
    * @param {string} texto
    * @returns {{texto: string, longitud: number, descartados: number, simbolos: string[]}}
    */
   function prepararEntrada(texto) {
     const original = typeof texto === 'string' ? texto : '';
     const limpio = normalizar(original);
   
     /* Se cuentan solo los caracteres visibles que se perdieron; los espacios
        y saltos de línea se descartan por diseño y no son un problema. */
     const perdidos = [];
     const vistos = new Set();
   
     original
       .normalize('NFC')
       .toUpperCase()
       .split('')
       .forEach(function (c) {
         if (/\s/.test(c)) return;
         if (normalizar(c).length === 0 && !vistos.has(c)) {
           vistos.add(c);
           perdidos.push(c);
         }
       });
   
     return {
       texto: limpio,
       longitud: limpio.length,
       descartados: perdidos.length,
       simbolos: perdidos
     };
   }
   
   /**
    * Confirma que un texto ya está listo para cifrar o analizar.
    */
   function esTextoValido(texto) {
     return typeof texto === 'string' &&
            texto.length > 0 &&
            texto.split('').every(function (c) { return c in INDICES; });
   }
   
   /* ------------------------------------------------------------------
      Pruebas rápidas. Abrir la consola del navegador y llamar
      pruebasAlfabeto() para verificar el módulo antes de seguir.
      ------------------------------------------------------------------ */
   function pruebasAlfabeto() {
     const casos = [
       ['ANTIGÜEDAD',            'ANTIGUEDAD'],
       ['El Niño, año 2026.',    'ELNIÑOAÑO'],
       ['criptografía',          'CRIPTOGRAFIA'],
       ['ñ',                     'Ñ'],
       ['¿Qué tal?',             'QUETAL']
     ];
   
     let fallos = 0;
     casos.forEach(function (par) {
       const obtenido = normalizar(par[0]);
       const ok = obtenido === par[1];
       if (!ok) fallos++;
       console.log((ok ? 'ok  ' : 'FALLA ') + par[0] + ' -> ' + obtenido +
                   (ok ? '' : ' (esperado ' + par[1] + ')'));
     });
   
     console.log(mod(-3) === 24 ? 'ok   mod(-3) = 24' : 'FALLA mod(-3)');
     console.log(indiceDe('Ñ') === 14 ? 'ok   Ñ está en 14' : 'FALLA posición de la Ñ');
     console.log(M === 27 ? 'ok   alfabeto de 27' : 'FALLA tamaño del alfabeto');
   
     return fallos === 0 ? 'Módulo correcto' : fallos + ' caso(s) con error';
   }