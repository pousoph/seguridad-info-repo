// Mostrar u ocultar la contraseña. Solo cambia el tipo del campo en el
// navegador; no participa en la autenticación, que ocurre en el servidor.
(function () {
  var botones = document.querySelectorAll('[data-ver-clave]');
  Array.prototype.forEach.call(botones, function (boton) {
    var campo = document.getElementById(boton.getAttribute('data-ver-clave'));
    if (!campo) return;
    var mostrar = boton.querySelector('[data-icono="mostrar"]');
    var ocultar = boton.querySelector('[data-icono="ocultar"]');

    boton.addEventListener('click', function () {
      var visible = campo.type === 'text';
      campo.type = visible ? 'password' : 'text';
      boton.setAttribute('aria-pressed', String(!visible));
      boton.setAttribute('aria-label', visible ? 'Mostrar contraseña' : 'Ocultar contraseña');
      mostrar.hidden = !visible;
      ocultar.hidden = visible;
      campo.focus({ preventScroll: true });
    });
  });
})();
