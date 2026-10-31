/* Avisos (notificaciones push) — tarjeta del inicio para activarlos o desactivarlos.
   Necesita data/push.json con la dirección del servidor de avisos y la clave pública (se carga desde Editoras → Avisos).
   Si eso no está configurado, o el navegador no admite avisos, no se muestra nada. */
(function () {
  'use strict';
  var caja = document.getElementById('avisos');
  if (!caja) return;
  var CFG = null;
  var K_CERRADO = 'mda_avisos_cerrado', K_SYNC = 'mda_avisos_sync', DIA = 86400000;

  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} return null; }
  function soportado() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
  function servidorOk(u) { return typeof u === 'string' && (/^https:\/\/[^\s\/]+/.test(u) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(u)); }
  function claveBytes(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
    var r = atob(s), a = new Uint8Array(r.length); for (var i = 0; i < r.length; i++) a[i] = r.charCodeAt(i); return a;
  }
  function mismaClave(sub) {
    var k = sub && sub.options && sub.options.applicationServerKey; if (!k) return true;
    var a = new Uint8Array(k), b = claveBytes(CFG.clave); if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true;
  }
  function espera(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function toast(t) { if (window.Comun && Comun.aviso) Comun.aviso(t); }
  function msg(t) { var m = document.getElementById('avisos-msg'); if (m) m.textContent = t || ''; }

  /* El servidor gratuito se "duerme" si no se usa: la primera vez puede tardar cerca de un minuto, por eso se reintenta. */
  function post(ruta, cuerpo) {
    var intentos = 0;
    function una() {
      intentos++;
      var ctl = window.AbortController ? new AbortController() : null, t = ctl && setTimeout(function () { ctl.abort(); }, 70000);
      return fetch(CFG.servidor + ruta, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo), signal: ctl ? ctl.signal : undefined })
        .then(function (r) {
          clearTimeout(t);
          if (r.ok) return r;
          if (r.status >= 500 && intentos < 3) return espera(4000).then(una);
          throw new Error('http ' + r.status);
        }, function (e) { clearTimeout(t); if (intentos < 3) return espera(4000).then(una); throw e; });
    }
    return una();
  }

  function pintar(sub) {
    if (Notification.permission === 'denied') { caja.innerHTML = ''; return; }
    if (sub) {
      caja.innerHTML = '<div class="avisos avisos-on"><p>🔔 Avisos activados</p><button type="button" class="enlace" data-avisos="off">Desactivar</button></div>';
      return;
    }
    var c = parseInt(ls(K_CERRADO), 10) || 0;
    if (c && Date.now() - c < 14 * DIA) { caja.innerHTML = ''; return; }
    caja.innerHTML = '<div class="avisos"><p>Te avisamos cuando haya un devocional o contenido nuevo.</p>' +
      '<button type="button" class="btn-leer" data-avisos="on">Activar avisos</button>' +
      '<button type="button" class="cerrar" data-avisos="cerrar" aria-label="Cerrar">×</button>' +
      '<p class="avisos-msg" id="avisos-msg" role="status" aria-live="polite"></p></div>';
  }

  function activar(boton) {
    boton.disabled = true;
    var pedir = Notification.permission === 'granted' ? Promise.resolve('granted') : Notification.requestPermission();
    pedir.then(function (p) {
      if (p !== 'granted') { msg(p === 'denied' ? 'Los avisos quedaron bloqueados. Podés habilitarlos desde la configuración del navegador.' : 'No se activaron los avisos.'); throw 'cancel'; }
      msg('Activando… la primera vez puede tardar hasta un minuto.');
      return navigator.serviceWorker.ready;
    }).then(function (reg) {
      return reg.pushManager.getSubscription().then(function (s) {
        if (s && !mismaClave(s)) return s.unsubscribe().then(function () { return null; });
        return s;
      }).then(function (s) { return s || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: claveBytes(CFG.clave) }); });
    }).then(function (sub) {
      return post('/suscribir', { suscripcion: sub.toJSON() }).then(function () { return sub; }, function (e) {
        return sub.unsubscribe().catch(function () {}).then(function () { throw e; });   // si el servidor no la registró, no queda a medias
      });
    }).then(function (sub) {
      ls(K_SYNC, String(Date.now())); pintar(sub); toast('Listo, vas a recibir avisos.');
    }).catch(function (e) {
      boton.disabled = false;
      if (e !== 'cancel') msg('No se pudieron activar los avisos. Revisá tu conexión y probá de nuevo en un rato.');
    });
  }

  function desactivar() {
    navigator.serviceWorker.ready.then(function (reg) { return reg.pushManager.getSubscription(); }).then(function (sub) {
      if (!sub) return;
      var endpoint = sub.endpoint;
      return sub.unsubscribe().then(function () { post('/desuscribir', { endpoint: endpoint }).catch(function () {}); });
    }).then(function () { ls(K_CERRADO, String(Date.now())); pintar(null); toast('Avisos desactivados.'); });
  }

  caja.addEventListener('click', function (e) {
    var b = e.target.closest('[data-avisos]'); if (!b) return;
    var a = b.getAttribute('data-avisos');
    if (a === 'on') activar(b);
    else if (a === 'off') desactivar();
    else if (a === 'cerrar') { ls(K_CERRADO, String(Date.now())); caja.innerHTML = ''; }
  });

  if (!soportado()) return;   // por ejemplo iPhone en una pestaña de Safari: los avisos solo funcionan con la app instalada
  fetch('data/push.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }).then(function (c) {
    if (!c || !servidorOk(c.servidor) || !/^[A-Za-z0-9_-]{80,100}$/.test(c.clavePublica || '')) return;
    CFG = { servidor: c.servidor.replace(/\/+$/, ''), clave: c.clavePublica };
    return navigator.serviceWorker.ready.then(function (reg) { return reg.pushManager.getSubscription(); }).then(function (sub) {
      if (sub && !mismaClave(sub)) return sub.unsubscribe().then(function () { return null; });   // se cambió la clave del servidor: hay que volver a activar
      return sub;
    }).then(function (sub) {
      pintar(sub);
      /* Una vez por semana se le recuerda al servidor esta suscripción (por si cambió), sin molestar a nadie. */
      if (sub && Notification.permission === 'granted' && Date.now() - (parseInt(ls(K_SYNC), 10) || 0) > 7 * DIA) {
        post('/suscribir', { suscripcion: sub.toJSON() }).then(function () { ls(K_SYNC, String(Date.now())); }).catch(function () {});
      }
    });
  }).catch(function () {});
})();
