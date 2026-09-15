/*
 * app.js
 * Taller de Cifrado Clásico - Seguridad de la Información 2026-II
 *
 * Conecta los módulos con las dos vistas. Cada controlador arranca solo
 * si encuentra sus elementos en la página, así que el mismo archivo sirve
 * para index.html y para cifrar.html.
 */

function $(id) { return document.getElementById(id); }

/**
 * Construye una tabla. Se arma con createElement en vez de innerHTML
 * para que ningún texto de entrada pueda inyectar marcado.
 */
function crearTabla(cabeceras, filas, indiceDestacado) {
  const tabla = document.createElement('table');

  const thead = document.createElement('thead');
  const filaCab = document.createElement('tr');
  cabeceras.forEach(function (c) {
    const th = document.createElement('th');
    th.textContent = c.texto;
    if (c.numerica) th.className = 'num';
    filaCab.appendChild(th);
  });
  thead.appendChild(filaCab);
  tabla.appendChild(thead);

  const tbody = document.createElement('tbody');
  filas.forEach(function (fila, i) {
    const tr = document.createElement('tr');
    if (i === indiceDestacado) tr.className = 'destacada';
    fila.forEach(function (valor, j) {
      const td = document.createElement('td');
      td.textContent = valor;
      if (cabeceras[j].numerica) td.className = 'num';
      if (cabeceras[j].recorte) td.className = 'recorte';
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  tabla.appendChild(tbody);

  return tabla;
}

function crearDesplegable(titulo, contenido, abierto) {
  const det = document.createElement('details');
  if (abierto) det.open = true;
  const sum = document.createElement('summary');
  sum.textContent = titulo;
  det.appendChild(sum);
  const cuerpo = document.createElement('div');
  cuerpo.className = 'cuerpo';
  cuerpo.appendChild(contenido);
  det.appendChild(cuerpo);
  return det;
}

/**
 * Copiar sin la API del portapapeles: la página corre sobre HTTP sin
 * certificado, tal como exige el taller, y navigator.clipboard solo
 * existe en contextos seguros.
 */
function copiarTexto(texto) {
  const area = document.createElement('textarea');
  area.value = texto;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  let exito = false;
  try { exito = document.execCommand('copy'); } catch (e) { exito = false; }
  document.body.removeChild(area);
  return exito;
}

/**
 * El color de la página lo decide el cifrado detectado, así que el
 * diagnóstico se lee sin necesidad de leer.
 */
function activarPaleta(tipo) {
  if (tipo) {
    document.body.setAttribute('data-cifrado', tipo);
  } else {
    document.body.removeAttribute('data-cifrado');
  }
}

function describirEntrada(informe) {
  if (informe.longitud === 0) return 'Sin letras válidas todavía.';
  let texto = informe.longitud + ' letras válidas';
  if (informe.descartados > 0) {
    texto += ' · se descartaron ' + informe.simbolos.join(' ');
  }
  return texto;
}

/**
 * Dibuja un histograma de 27 barras.
 *
 * @param {Array<{letra, valor, esperado}>} filas en orden alfabético
 *        esperado es opcional; cuando existe se dibuja como silueta detrás
 */
function pintarHistograma(histograma, eje, filas) {
  histograma.textContent = '';
  eje.textContent = '';

  let maximo = 0;
  filas.forEach(function (f) {
    maximo = Math.max(maximo, f.valor, f.esperado || 0);
  });
  if (maximo === 0) maximo = 1;

  filas.forEach(function (f) {
    const grupo = document.createElement('div');
    grupo.className = 'barra-grupo';
    grupo.title = f.titulo || (f.letra + ': ' + f.valor.toFixed(2) + ' %');

    if (typeof f.esperado === 'number') {
      const silueta = document.createElement('div');
      silueta.className = 'fondo-esperado';
      silueta.style.height = ((f.esperado / maximo) * 100) + '%';
      grupo.appendChild(silueta);
    }

    const barra = document.createElement('div');
    barra.className = 'barra';
    barra.style.height = ((f.valor / maximo) * 100) + '%';
    grupo.appendChild(barra);

    histograma.appendChild(grupo);

    const etiqueta = document.createElement('span');
    etiqueta.textContent = f.letra;
    eje.appendChild(etiqueta);
  });
}

/* ==================================================================
   Portada: la tabla de frecuencias del español del punto 4 de la guía
   ================================================================== */

function iniciarReferencia() {
  const histograma = $('histograma-referencia');
  if (!histograma) return;

  const filas = ALFABETO.split('').map(function (letra) {
    return {
      letra: letra,
      valor: FRECUENCIA_ESPANOL[letra],
      titulo: letra + ': ' + FRECUENCIA_ESPANOL[letra].toFixed(2) + ' % en español'
    };
  });

  pintarHistograma(histograma, $('eje-referencia'), filas);
}

/* ==================================================================
   Vista de análisis
   ================================================================== */

function iniciarAnalisis() {
  const entrada = $('criptograma');
  if (!entrada) return;

  const estado = $('estado-entrada');

  function actualizarEstado() {
    estado.textContent = describirEntrada(prepararEntrada(entrada.value));
  }

  entrada.addEventListener('input', actualizarEstado);
  actualizarEstado();

  $('limpiar').addEventListener('click', function () {
    entrada.value = '';
    actualizarEstado();
    ['seccion-diagnostico', 'seccion-frecuencias', 'seccion-resultado'].forEach(function (id) {
      $(id).hidden = true;
    });
    activarPaleta(null);
    entrada.focus();
  });

  $('analizar').addEventListener('click', ejecutarAnalisis);

  function ejecutarAnalisis() {
    let informe;
    try {
      informe = analizarCriptograma(entrada.value);
    } catch (e) {
      estado.textContent = e.message;
      return;
    }

    /* El color se decide antes de pintar, para que barras, tablas y
       resaltados salgan ya con el hue del cifrado detectado. */
    if (informe.metodo.indexOf('César') >= 0) {
      activarPaleta('cesar');
    } else if (informe.metodo.indexOf('Afín') >= 0) {
      activarPaleta('afin');
    } else {
      activarPaleta('vigenere');
    }

    pintarDiagnostico(informe.diagnostico);
    pintarFrecuencias(informe.frecuencias);
    pintarResultado(informe);

    $('seccion-diagnostico').hidden = false;
    $('seccion-frecuencias').hidden = false;
    $('seccion-resultado').hidden = false;

    /* Único momento de movimiento de la página: el panel de diagnóstico
       se inunda del color y vuelve a su fondo. */
    const panel = $('panel-diagnostico');
    panel.classList.remove('revelado');
    void panel.offsetWidth;
    panel.classList.add('revelado');
  }

  function pintarDiagnostico(d) {
    $('ic-valor').textContent = d.ic.toFixed(4);

    $('veredicto-tipo').textContent = d.tipo === 'polialfabetico'
      ? 'Cifrado polialfabético'
      : 'Cifrado monoalfabético';

    $('veredicto-detalle').textContent =
      'El valor obtenido se acerca más a la referencia de ' + d.referencia +
      ' (diferencia de ' + d.distancia.toFixed(4) + '). Cifrados compatibles: ' +
      d.cifradosPosibles.join(' o ') + '. Ataque que corresponde: ' + d.ataqueSugerido + '.';

    $('veredicto-nota').textContent = d.nota;

    const aviso = $('veredicto-aviso');
    if (!d.fiable) {
      aviso.textContent = 'Clasificación orientativa: el taller exige mínimo 400 caracteres ' +
                          'y este texto no llega.';
      aviso.classList.remove('oculto');
    } else {
      aviso.classList.add('oculto');
    }
  }

  function pintarFrecuencias(f) {
    /* En orden alfabético, no por conteo, para poder comparar cada barra
       con su valor esperado de un vistazo. */
    const enOrden = f.letras.slice().sort(function (a, b) {
      return indiceDe(a.letra) - indiceDe(b.letra);
    });

    pintarHistograma($('histograma'), $('eje-letras'), enOrden.map(function (l) {
      return {
        letra: l.letra,
        valor: l.porcentaje,
        esperado: l.esperadoEs,
        titulo: l.letra + ': ' + l.veces + ' veces (' + l.porcentaje.toFixed(2) +
                ' %, esperado ' + l.esperadoEs.toFixed(2) + ' %)'
      };
    }));

    const top = f.letras.filter(function (l) { return l.veces > 0; }).slice(0, 3);
    $('leyenda-frecuencias').textContent =
      'Sobre ' + f.total + ' letras. Las más frecuentes son ' +
      top.map(function (l) { return l.letra + ' (' + l.veces + ')'; }).join(', ') +
      '. En español las más comunes son E (13.68 %) y A (12.53 %).';

    const cuerpo = $('tabla-frecuencias');
    cuerpo.textContent = '';
    f.letras.forEach(function (l) {
      const tr = document.createElement('tr');
      [l.letra, String(l.veces), l.porcentaje.toFixed(2), l.esperadoEs.toFixed(2), l.esperadoEn.toFixed(2)]
        .forEach(function (valor, i) {
          const td = document.createElement('td');
          td.textContent = valor;
          if (i > 0) td.className = 'num';
          tr.appendChild(td);
        });
      cuerpo.appendChild(tr);
    });
  }

  function pintarResultado(informe) {
    const r = informe.resultado;

    $('dato-metodo').textContent = informe.metodo;
    $('dato-longitud').textContent = r.texto.length + ' letras';
    $('texto-recuperado').textContent = r.texto;

    if (informe.metodo.indexOf('César') >= 0) {
      $('dato-clave').textContent = 'b = ' + r.clave;
    } else if (informe.metodo.indexOf('Afín') >= 0) {
      $('dato-clave').textContent = 'a = ' + r.clave.a + ', b = ' + r.clave.b;
    } else {
      $('dato-clave').textContent = r.clave;
    }

    const aviso = $('resultado-aviso');
    if (informe.advertencia) {
      aviso.textContent = informe.advertencia;
      aviso.classList.remove('oculto');
    } else {
      aviso.classList.add('oculto');
    }

    pintarEvidencia(informe);
  }

  function pintarEvidencia(informe) {
    const zona = $('evidencia');
    zona.textContent = '';
    const r = informe.resultado;

    if (informe.metodo.indexOf('César') >= 0) {
      const filas = r.candidatos.map(function (c) {
        return [String(c.clave), c.puntaje.toFixed(1), c.texto.slice(0, 40)];
      });
      const destacada = r.candidatos.findIndex(function (c) { return c.clave === r.clave; });
      zona.appendChild(crearDesplegable(
        'Las 27 rotaciones probadas',
        crearTabla([
          { texto: 'b' },
          { texto: 'Chi-cuadrado', numerica: true },
          { texto: 'Inicio del texto', recorte: true }
        ], filas, destacada)
      ));

    } else if (informe.metodo.indexOf('Afín') >= 0) {
      const filas = r.hipotesis.map(function (h) {
        return [h.supuesto, 'a = ' + h.a + ', b = ' + h.b, h.puntaje.toFixed(1), h.texto.slice(0, 40)];
      });
      zona.appendChild(crearDesplegable(
        'Hipótesis de frecuencia evaluadas',
        crearTabla([
          { texto: 'Suposición' },
          { texto: 'Clave obtenida' },
          { texto: 'Chi-cuadrado', numerica: true },
          { texto: 'Inicio del texto', recorte: true }
        ], filas, 0),
        true
      ));

    } else {
      const repetidas = r.repeticiones
        .slice()
        .sort(function (a, b) { return b.posiciones.length - a.posiciones.length; })
        .slice(0, 12)
        .map(function (rep) {
          return [rep.secuencia, rep.posiciones.join(', '), rep.distancias.join(', ')];
        });

      if (repetidas.length > 0) {
        zona.appendChild(crearDesplegable(
          'Secuencias repetidas encontradas',
          crearTabla([
            { texto: 'Secuencia' },
            { texto: 'Posiciones' },
            { texto: 'Distancias', numerica: true }
          ], repetidas)
        ));
      }

      const filas = r.candidatas.map(function (c) {
        return [String(c.longitud), String(c.votos), c.ic.toFixed(4)];
      });
      const destacada = r.candidatas.findIndex(function (c) { return c.longitud === r.longitud; });
      zona.appendChild(crearDesplegable(
        'Longitudes de clave evaluadas',
        crearTabla([
          { texto: 'Longitud' },
          { texto: 'Distancias divisibles', numerica: true },
          { texto: 'IC medio por columna', numerica: true }
        ], filas, destacada),
        true
      ));
    }
  }
}

/* ==================================================================
   Vista de cifrado
   ================================================================== */

function iniciarCifrado() {
  const selector = $('tipo-cifrado');
  if (!selector) return;

  const claveB = $('clave-b');
  const claveA = $('clave-a');
  const clavePalabra = $('clave-palabra');
  const textoClaro = $('texto-claro');
  const salida = $('texto-cifrado');
  const estadoClave = $('estado-clave');

  /* El desplegable de 'a' se llena con las 18 claves coprimas con 27. */
  clavesAfinValidas().forEach(function (a) {
    const op = document.createElement('option');
    op.value = String(a);
    op.textContent = String(a);
    if (a === 5) op.selected = true;
    claveA.appendChild(op);
  });

  function tipo() { return selector.value; }

  function mostrarCampos() {
    $('campo-b').classList.toggle('oculto', tipo() === 'vigenere');
    $('campo-a').classList.toggle('oculto', tipo() !== 'afin');
    $('campo-palabra').classList.toggle('oculto', tipo() !== 'vigenere');
    activarPaleta(tipo());
  }

  /**
   * Aplica el cifrado actual a un texto.
   */
  function aplicar(texto) {
    if (tipo() === 'cesar') {
      return cifrarCesar(texto, parseInt(claveB.value, 10) || 0);
    }
    if (tipo() === 'afin') {
      return cifrarAfin(texto, parseInt(claveA.value, 10), parseInt(claveB.value, 10) || 0);
    }
    return cifrarVigenere(texto, clavePalabra.value);
  }

  function revisarClave() {
    if (tipo() === 'vigenere') {
      const k = prepararClaveVigenere(clavePalabra.value);
      estadoClave.textContent = k.length === 0
        ? 'La clave debe tener al menos una letra del alfabeto.'
        : 'Clave normalizada: ' + k;
    } else {
      estadoClave.textContent = '';
    }
  }

  function actualizarEstadoClaro() {
    $('estado-claro').textContent = describirEntrada(prepararEntrada(textoClaro.value));
  }

  function cifrarAhora() {
    try {
      salida.textContent = aplicar(textoClaro.value);
    } catch (e) {
      salida.textContent = '';
      estadoClave.textContent = e.message;
    }
  }

  selector.addEventListener('change', function () { mostrarCampos(); revisarClave(); });
  clavePalabra.addEventListener('input', revisarClave);
  textoClaro.addEventListener('input', actualizarEstadoClaro);

  $('cifrar').addEventListener('click', cifrarAhora);

  $('copiar').addEventListener('click', function () {
    if (!salida.textContent) return;
    const boton = $('copiar');
    boton.textContent = copiarTexto(salida.textContent) ? 'Copiado' : 'Selecciona y copia manualmente';
    setTimeout(function () { boton.textContent = 'Copiar resultado'; }, 2000);
  });

  $('validar').addEventListener('click', function () {
    const zona = $('resultado-validacion');
    zona.textContent = '';

    const casos = [
      { nombre: 'Reto 1 · César b = 5',  obtenido: cifrarCesar(RETOS_GUIA.reto1.claro, 5),        esperado: RETOS_GUIA.reto1.cifrado },
      { nombre: 'Reto 1 · César b = 11', obtenido: cifrarCesar(RETOS_GUIA.reto1.claro, 11),       esperado: RETOS_GUIA.reto1.cifrado },
      { nombre: 'Reto 2 · Afín a = 5, b = 7', obtenido: cifrarAfin(RETOS_GUIA.reto2.claro, 5, 7), esperado: RETOS_GUIA.reto2.cifrado },
      { nombre: 'Reto 3 · Vigenère NUBE', obtenido: cifrarVigenere(RETOS_GUIA.reto3.claro, 'NUBE'), esperado: RETOS_GUIA.reto3.cifrado }
    ];

    const filas = casos.map(function (c) {
      return [c.nombre, c.obtenido === c.esperado ? 'Coincide' : 'No coincide', c.obtenido.slice(0, 32)];
    });

    zona.appendChild(crearTabla([
      { texto: 'Caso' },
      { texto: 'Resultado' },
      { texto: 'Inicio del cifrado', recorte: true }
    ], filas));

    const nota = document.createElement('p');
    nota.className = 'leyenda';
    nota.textContent = 'El Reto 1 con b = 11 no coincide: la guía declara esa clave, ' +
                       'pero el desplazamiento que reproduce su criptograma es 5.';
    zona.appendChild(nota);
  });

  mostrarCampos();
  revisarClave();
  actualizarEstadoClaro();
}

document.addEventListener('DOMContentLoaded', function () {
  iniciarReferencia();
  iniciarAnalisis();
  iniciarCifrado();
});