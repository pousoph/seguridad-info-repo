/*
 * cifrado.js
 * Taller de Cifrado Clásico - Seguridad de la Información 2026-II
 *
 * Los tres cifrados de la guía, en ambas direcciones.
 * Depende de alfabeto.js: mod, indiceDe, letraEn, normalizar, M.
 */

/**
 * Máximo común divisor por el algoritmo de Euclides.
 */
function mcd(a, b) {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b !== 0) {
      const t = b;
      b = a % b;
      a = t;
    }
    return a;
  }
  
  /**
   * Valores de 'a' válidos para el cifrado afín: los coprimos con 27.
   * Como 27 = 3^3, son todos los que no son múltiplos de 3. Son 18 en total.
   */
  function clavesAfinValidas() {
    const validas = [];
    for (let a = 1; a < M; a++) {
      if (mcd(a, M) === 1) validas.push(a);
    }
    return validas;
  }
  
  /**
   * Inverso multiplicativo de a módulo m, es decir el a⁻¹ tal que
   * a · a⁻¹ ≡ 1 (mod m). Sin él no se puede descifrar el afín.
   * Con módulo 27 la búsqueda directa es instantánea y no vale la pena
   * complicarse con Euclides extendido.
   *
   * @returns {number|null} null si a no es invertible
   */
  function inversoModular(a, m = M) {
    a = mod(a, m);
    if (mcd(a, m) !== 1) return null;
    for (let x = 1; x < m; x++) {
      if (mod(a * x, m) === 1) return x;
    }
    return null;
  }
  
  /* César:  C = (m + b) mod 27*/
  
  function cifrarCesar(texto, b) {
    const limpio = normalizar(texto);
    let salida = '';
    for (let i = 0; i < limpio.length; i++) {
      salida += letraEn(indiceDe(limpio[i]) + b);
    }
    return salida;
  }
  
  function descifrarCesar(texto, b) {
    const limpio = normalizar(texto);
    let salida = '';
    for (let i = 0; i < limpio.length; i++) {
      salida += letraEn(indiceDe(limpio[i]) - b);
    }
    return salida;
  }
  
  /* Afín:  C = (a·m + b) mod 27,  con mcd(a, 27) = 1
     El César es el caso particular a = 1. */
  
  /**
   * Comprueba si una pareja (a, b) sirve como clave afín.
   * @returns {{valida: boolean, motivo: string}}
   */
  function validarClaveAfin(a, b) {
    if (!Number.isInteger(a) || !Number.isInteger(b)) {
      return { valida: false, motivo: 'a y b deben ser números enteros.' };
    }
    if (mcd(mod(a), M) !== 1) {
      return {
        valida: false,
        motivo: 'a = ' + a + ' no es coprimo con 27, así que el cifrado no se puede ' +
                'deshacer. Valores válidos: ' + clavesAfinValidas().join(', ') + '.'
      };
    }
    return { valida: true, motivo: '' };
  }
  
  function cifrarAfin(texto, a, b) {
    const control = validarClaveAfin(a, b);
    if (!control.valida) throw new Error(control.motivo);
  
    const limpio = normalizar(texto);
    let salida = '';
    for (let i = 0; i < limpio.length; i++) {
      salida += letraEn(a * indiceDe(limpio[i]) + b);
    }
    return salida;
  }
  
  /**
   * Descifrado afín: m = a⁻¹ · (C − b) mod 27
   */
  function descifrarAfin(texto, a, b) {
    const control = validarClaveAfin(a, b);
    if (!control.valida) throw new Error(control.motivo);
  
    const inv = inversoModular(a);
    const limpio = normalizar(texto);
    let salida = '';
    for (let i = 0; i < limpio.length; i++) {
      salida += letraEn(inv * (indiceDe(limpio[i]) - b));
    }
    return salida;
  }
  
  /* Vigenère: cada letra se desplaza según la letra de la clave que le
     corresponda, repitiendo la clave a lo largo del texto. */
  
  /**
   * La clave pasa por la misma normalización que el texto: si el usuario
   * escribe "nube" o "Nubé" debe funcionar igual.
   * @returns {string} clave lista para usar, o '' si no queda nada
   */
  function prepararClaveVigenere(clave) {
    return normalizar(clave);
  }
  
  function cifrarVigenere(texto, clave) {
    const k = prepararClaveVigenere(clave);
    if (k.length === 0) throw new Error('La clave debe tener al menos una letra del alfabeto.');
  
    const limpio = normalizar(texto);
    let salida = '';
    for (let i = 0; i < limpio.length; i++) {
      salida += letraEn(indiceDe(limpio[i]) + indiceDe(k[i % k.length]));
    }
    return salida;
  }
  
  function descifrarVigenere(texto, clave) {
    const k = prepararClaveVigenere(clave);
    if (k.length === 0) throw new Error('La clave debe tener al menos una letra del alfabeto.');
  
    const limpio = normalizar(texto);
    let salida = '';
    for (let i = 0; i < limpio.length; i++) {
      salida += letraEn(indiceDe(limpio[i]) - indiceDe(k[i % k.length]));
    }
    return salida;
  }
  
  /* Validación contra la guía del taller
     Es el punto 1 de "¿Qué se espera como análisis?": meter el texto
     original y comprobar que el cifrado coincide con el del PDF.*/
  
  const RETOS_GUIA = {
    reto1: {
      claro: 'Habla sobre la historia de la criptografía desde la antigüedad, mencionando ' +
             'que la necesidad de ocultar mensajes ha existido siempre para proteger ' +
             'secretos militares y políticos.',
      cifrado: 'MFGPFXTGWJPFMNXYTWNFIJPFHWNUYTLWFKNFIJXIJPFFRYNLZJIFIQJRHNTRFRITVZJPFR' +
               'JHJXNIFIIJTHZPYFWQJRXFÑJXMFJCNXYNITXNJQUWJUFWFUWTYJLJWXJHWJYTXQNPNYFWJXDUTPNYNHTX'
    },
    reto2: {
      claro: 'Explica el análisis de frecuencias y cómo las letras como la E y la A son ' +
             'las más comunes en el idioma español, permitiendo romper cifrados ' +
             'monoalfabéticos con relativa facilidad.',
      cifrado: 'ASGITQHAIHRHITUTUVAFPAQEARQTHUXQBNBIHUIAZPHUQBNBIHAXIHHUBRIHUNHUQBNERA' +
               'UARAITVTBNHAUGHWBIGAPNTZTARVBPBNGAPQTFPHVBUNBRBHIFHMAZTQBUQBRPAIHZTJHFHQTITVHV'
    },
    reto3: {
      claro: 'Describe la máquina Enigma y cómo Alan Turing logró descifrarla en Bletchley ' +
             'Park, cambiando el curso de la Segunda Guerra Mundial gracias al uso de las ' +
             'primeras computadoras electromecánicas.',
      cifrado: 'PYTGECCIXUNEDOJQNYÑMSGBCOJNSNFBQGOSMZAMSSMPHQNDMRMBVXUFQÑFFXOBMILKBVWW' +
               'BPÑCBQPJFOOOSWBXFONNFKHHEESOFVEUNYZXJEXASEOCBWNFVWBXFONNQVUGFVNNDSYKVXNXPVNNFOQWUVBGFGNHJGNN'
    }
  };
  
  /**
   * Corre la validación completa. Llamar desde la consola del navegador.
   */
  function pruebasCifrado() {
    const resultados = [];
  
    function comprobar(nombre, obtenido, esperado) {
      const ok = obtenido === esperado;
      resultados.push(ok);
      console.log((ok ? 'ok    ' : 'FALLA ') + nombre);
      if (!ok) {
        console.log('   esperado: ' + esperado.slice(0, 60) + '...');
        console.log('   obtenido: ' + obtenido.slice(0, 60) + '...');
      }
    }
  
    /* Reto 1. La guía dice k = 11, pero el desplazamiento real es 5.
       Se comprueban los dos para dejar la evidencia por escrito. */
    comprobar('Reto 1 - César con k = 5 reproduce el cifrado de la guía',
              cifrarCesar(RETOS_GUIA.reto1.claro, 5), RETOS_GUIA.reto1.cifrado);
  
    const conOnce = cifrarCesar(RETOS_GUIA.reto1.claro, 11);
    console.log((conOnce !== RETOS_GUIA.reto1.cifrado ? 'ok    ' : 'FALLA ') +
                'Reto 1 - con k = 11 NO coincide (confirma el error de la guía)');
    resultados.push(conOnce !== RETOS_GUIA.reto1.cifrado);
  
    comprobar('Reto 2 - Afín con a = 5, b = 7',
              cifrarAfin(RETOS_GUIA.reto2.claro, 5, 7), RETOS_GUIA.reto2.cifrado);
  
    comprobar('Reto 3 - Vigenère con clave NUBE',
              cifrarVigenere(RETOS_GUIA.reto3.claro, 'NUBE'), RETOS_GUIA.reto3.cifrado);
  
    /* Ida y vuelta: descifrar lo cifrado debe devolver el texto normalizado. */
    comprobar('Reto 1 - descifrado devuelve el original',
              descifrarCesar(RETOS_GUIA.reto1.cifrado, 5), normalizar(RETOS_GUIA.reto1.claro));
    comprobar('Reto 2 - descifrado devuelve el original',
              descifrarAfin(RETOS_GUIA.reto2.cifrado, 5, 7), normalizar(RETOS_GUIA.reto2.claro));
    comprobar('Reto 3 - descifrado devuelve el original',
              descifrarVigenere(RETOS_GUIA.reto3.cifrado, 'NUBE'), normalizar(RETOS_GUIA.reto3.claro));
  
    /* El inverso modular debe existir para las 18 claves válidas. */
    const sinInverso = clavesAfinValidas().filter(function (a) { return inversoModular(a) === null; });
    console.log((sinInverso.length === 0 ? 'ok    ' : 'FALLA ') +
                'las ' + clavesAfinValidas().length + ' claves afines válidas tienen inverso');
    resultados.push(sinInverso.length === 0);
  
    /* Una clave inválida tiene que rechazarse, no producir basura. */
    let rechazada = false;
    try { cifrarAfin('PRUEBA', 3, 4); } catch (e) { rechazada = true; }
    console.log((rechazada ? 'ok    ' : 'FALLA ') + 'a = 3 se rechaza por no ser coprimo con 27');
    resultados.push(rechazada);
  
    const fallos = resultados.filter(function (r) { return !r; }).length;
    return fallos === 0 ? 'Módulo correcto' : fallos + ' prueba(s) con error';
  }