// Menú lateral en móvil: el botón hamburguesa abre y cierra el sidebar.
(function () {
  var shell = document.getElementById('shell');
  var boton = document.getElementById('abrir-menu');
  var telon = document.getElementById('telon');
  if (!shell || !boton) return;

  function fijar(abierto) {
    shell.classList.toggle('menu-abierto', abierto);
    boton.setAttribute('aria-expanded', String(abierto));
    boton.setAttribute('aria-label', abierto ? 'Cerrar menú' : 'Abrir menú');
  }

  boton.addEventListener('click', function () {
    fijar(!shell.classList.contains('menu-abierto'));
  });
  if (telon) telon.addEventListener('click', function () { fijar(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') fijar(false);
  });
})();
