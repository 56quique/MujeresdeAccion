/* Servidor de avisos (notificaciones push) — Mujeres de Acción
   Qué hace:
   - Recibe y guarda las suscripciones de los celulares que activan los avisos.
   - Envía un aviso a todas (o solo a un celular de prueba) cuando una editora lo pide.
   Dónde guarda las suscripciones: en un repositorio PRIVADO de GitHub (archivo suscripciones.json),
   porque en el plan gratuito de Render los archivos locales se borran y la base de datos vence a los 30 días.
   Solo usa módulos propios de Node + la librería web-push. Todas las claves van en variables de entorno (nunca en el código). */
'use strict';
const http = require('http');
const crypto = require('crypto');
const webpush = require('web-push');

const E = process.env;
const PUERTO = Number(E.PORT) || 3000;
const CLAVE_ADMIN = String(E.CLAVE_ADMIN || '');
const MAX_SUSCRIPCIONES = Number(E.MAX_SUSCRIPCIONES) || 5000;
const GH = {
  api: String(E.GITHUB_API || 'https://api.github.com').replace(/\/+$/, ''),
  token: E.DATOS_TOKEN || '', owner: E.DATOS_OWNER || '', repo: E.DATOS_REPO || '',
  rama: E.DATOS_RAMA || 'main', ruta: 'suscripciones.json'
};

/* ---------- Configuración y comprobaciones ---------- */
let SITIO = '', ORIGEN = '';
try { const u = new URL(E.SITIO_URL); SITIO = u.href.replace(/\/*$/, '/'); ORIGEN = u.origin; } catch (_) {}
const ORIGENES_OK = new Set([ORIGEN].concat(String(E.ORIGENES_EXTRA || '').split(',').map(s => s.trim()).filter(Boolean)).filter(Boolean));

const faltan = [];
['VAPID_PUBLIC', 'VAPID_PRIVATE', 'VAPID_CONTACTO', 'CLAVE_ADMIN', 'SITIO_URL', 'DATOS_TOKEN', 'DATOS_OWNER', 'DATOS_REPO']
  .forEach(n => { if (!E[n] || (n === 'SITIO_URL' && !ORIGEN)) faltan.push(n); });
if (CLAVE_ADMIN && CLAVE_ADMIN.length < 12 && !faltan.includes('CLAVE_ADMIN')) faltan.push('CLAVE_ADMIN (muy corta: mínimo 12 caracteres)');
let problemaVapid = '';
if (!faltan.some(f => f.startsWith('VAPID') )) {
  try { webpush.setVapidDetails(E.VAPID_CONTACTO, E.VAPID_PUBLIC, E.VAPID_PRIVATE); }
  catch (e) { problemaVapid = 'Las claves VAPID o el contacto no son válidos: ' + e.message; faltan.push('VAPID (inválidas)'); }
}
const LISTO = faltan.length === 0;
if (!LISTO) console.error('[avisos] Faltan o están mal estas variables de entorno: ' + faltan.join(', ') + (problemaVapid ? ' — ' + problemaVapid : ''));

/* Solo se envían avisos a los servicios de push conocidos (evita que alguien nos haga llamar a direcciones cualquiera). */
const HOSTS_PUSH = [/(^|\.)fcm\.googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)notify\.windows\.com$/];
const HOSTS_EXTRA = String(E.PUSH_HOSTS_EXTRA || '').split(',').map(s => s.trim()).filter(Boolean);
function hostPushOk(endpoint) {
  try {
    const u = new URL(endpoint);
    if (u.protocol !== 'https:') return false;
    return HOSTS_PUSH.some(r => r.test(u.hostname)) || HOSTS_EXTRA.includes(u.hostname);
  } catch (_) { return false; }
}
function suscripcionValida(s) {
  return !!(s && typeof s.endpoint === 'string' && s.endpoint.length < 700 && hostPushOk(s.endpoint) &&
    s.keys && typeof s.keys.p256dh === 'string' && typeof s.keys.auth === 'string' &&
    /^[A-Za-z0-9_-]{60,120}$/.test(s.keys.p256dh) && /^[A-Za-z0-9_-]{16,40}$/.test(s.keys.auth));
}

/* ---------- Almacén de suscripciones (archivo JSON en un repo privado de GitHub) ---------- */
const almacen = (() => {
  let lista = [], sha = null, cargado = false, cola = Promise.resolve();
  const enc = encodeURIComponent;
  function llamar(metodo, cuerpo) {
    const url = `${GH.api}/repos/${enc(GH.owner)}/${enc(GH.repo)}/contents/${GH.ruta}` + (metodo === 'GET' ? `?ref=${enc(GH.rama)}` : '');
    return fetch(url, {
      method: metodo,
      headers: Object.assign({ Authorization: 'Bearer ' + GH.token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'mda-avisos' }, cuerpo ? { 'Content-Type': 'application/json' } : {}),
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      signal: AbortSignal.timeout(25000)
    });
  }
  async function cargar() {
    const r = await llamar('GET');
    if (r.status === 404) { lista = []; sha = null; cargado = true; return; }
    if (!r.ok) throw new Error('GitHub respondió ' + r.status + (r.status === 401 || r.status === 403 ? ' (revisá la llave DATOS_TOKEN)' : ''));
    const j = await r.json();
    let d = {}; try { d = JSON.parse(Buffer.from(j.content || '', 'base64').toString('utf8')); } catch (_) {}
    lista = Array.isArray(d.suscripciones) ? d.suscripciones.filter(s => s && typeof s.endpoint === 'string' && s.keys) : [];
    sha = j.sha; cargado = true;
  }
  function contenido(nueva) {
    const c = { message: 'Avisos: suscripciones (' + nueva.length + ')', branch: GH.rama, content: Buffer.from(JSON.stringify({ suscripciones: nueva }, null, 1), 'utf8').toString('base64') };
    if (sha) c.sha = sha;
    return c;
  }
  /* fn recibe una copia de la lista y devuelve {cambio, lista, valor}. Si hay cambio, se guarda en GitHub antes de contestar. */
  function operar(fn) {
    const p = cola.then(async () => {
      if (!cargado) await cargar();
      for (let intento = 0; intento < 2; intento++) {
        const res = fn(lista.slice());
        if (!res.cambio) return res.valor;
        const r = await llamar('PUT', contenido(res.lista));
        if (r.ok) { const j = await r.json(); sha = (j.content && j.content.sha) || sha; lista = res.lista; return res.valor; }
        if ((r.status === 409 || r.status === 422) && intento === 0) { await cargar(); continue; }   // alguien tocó el archivo: se vuelve a leer y se reintenta
        cargado = false;
        throw new Error('No se pudo guardar en GitHub (' + r.status + ')');
      }
    });
    cola = p.catch(() => {});
    return p;
  }
  function leer(fn) { const p = cola.then(async () => { if (!cargado) await cargar(); return fn(lista); }); cola = p.catch(() => {}); return p; }
  return { operar, leer };
})();

/* ---------- Utilidades HTTP ---------- */
const intentos = new Map();   // limitador sencillo en memoria: clave -> [horas de los intentos]
function recientes(clave, ventanaMs) {
  const ahora = Date.now(), l = (intentos.get(clave) || []).filter(t => ahora - t < ventanaMs);
  intentos.set(clave, l);
  if (intentos.size > 5000) for (const [k, v] of intentos) if (!v.some(t => ahora - t < ventanaMs)) intentos.delete(k);
  return l;
}
function anotar(clave, ventanaMs) { recientes(clave, ventanaMs).push(Date.now()); }
function limitado(clave, max, ventanaMs) { const l = recientes(clave, ventanaMs); l.push(Date.now()); return l.length > max; }
function ipDe(req) { return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim() || 'x'; }
function responder(res, estado, obj, cors) {
  res.writeHead(estado, Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }, cors || {}));
  res.end(JSON.stringify(obj));
}
function leerJSON(req, max = 20000) {
  return new Promise((ok, mal) => {
    let tam = 0; const partes = [];
    req.on('data', c => { tam += c.length; if (tam > max) { mal(Object.assign(new Error('grande'), { estado: 413 })); req.destroy(); } else partes.push(c); });
    req.on('end', () => { try { ok(partes.length ? JSON.parse(Buffer.concat(partes).toString('utf8')) : {}); } catch (_) { mal(Object.assign(new Error('json'), { estado: 400 })); } });
    req.on('error', mal);
  });
}
function esAdmin(req) {
  if (!CLAVE_ADMIN || CLAVE_ADMIN.length < 12) return false;
  const m = /^Bearer (.+)$/.exec(String(req.headers.authorization || ''));
  if (!m) return false;
  const a = crypto.createHash('sha256').update(m[1]).digest(), b = crypto.createHash('sha256').update(CLAVE_ADMIN).digest();
  return crypto.timingSafeEqual(a, b);
}
function urlDestino(u) {
  const t = String(u || '').trim();
  if (!t) return SITIO;
  try { const d = new URL(t, SITIO); return d.origin === ORIGEN ? d.href : null; } catch (_) { return null; }
}
const recorta = (t, n) => String(t == null ? '' : t).replace(/\s+/g, ' ').trim().slice(0, n);

/* ---------- Rutas ---------- */
async function enviarAvisos(req, res, cors) {
  const b = await leerJSON(req);
  const titulo = recorta(b.titulo, 80), mensaje = recorta(b.mensaje, 240), url = urlDestino(b.url);
  if (!titulo || !mensaje) return responder(res, 400, { error: 'Falta el título o el mensaje.' }, cors);
  if (!url) return responder(res, 400, { error: 'El enlace tiene que ser una página de la app.' }, cors);
  const solo = typeof b.solo === 'string' && b.solo ? b.solo : null;
  const destinos = await almacen.leer(l => l.filter(s => !solo || s.endpoint === solo));
  if (!destinos.length) return responder(res, 200, { enviadas: 0, fallidas: 0, eliminadas: 0, total: 0, aviso: solo ? 'Ese celular no está registrado en el servidor. Activá los avisos desde la app y probá de nuevo.' : 'Todavía no hay suscriptoras.' }, cors);
  const carga = JSON.stringify({ titulo, mensaje, url });
  let enviadas = 0, fallidas = 0; const muertas = [];
  for (let i = 0; i < destinos.length; i += 15) {
    await Promise.all(destinos.slice(i, i + 15).map(async s => {
      try { await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, carga, { TTL: 172800, urgency: 'normal' }); enviadas++; }
      catch (e) { if (e && (e.statusCode === 404 || e.statusCode === 410)) muertas.push(s.endpoint); else { fallidas++; console.error('[avisos] fallo al enviar:', e && e.statusCode, String(e && e.body || e && e.message || '').slice(0, 160)); } }
    }));
  }
  if (muertas.length) await almacen.operar(l => { const n = l.filter(s => !muertas.includes(s.endpoint)); return { cambio: n.length !== l.length, lista: n, valor: null }; }).catch(e => console.error('[avisos] no se pudieron limpiar bajas:', e.message));
  console.log(`[avisos] enviado "${titulo}": ${enviadas} ok, ${fallidas} fallidas, ${muertas.length} bajas`);
  responder(res, 200, { enviadas, fallidas, eliminadas: muertas.length, total: destinos.length }, cors);
}

async function manejar(req, res) {
  const u = new URL(req.url, 'http://x'), ruta = u.pathname.replace(/\/+$/, '') || '/';
  const origen = req.headers.origin;
  let cors = {};
  if (origen) {
    if (!ORIGENES_OK.has(origen)) return responder(res, 403, { error: 'Origen no permitido.' });
    cors = { 'Access-Control-Allow-Origin': origen, Vary: 'Origin', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '600' };
  }
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }

  if (req.method === 'GET' && ruta === '/salud') return responder(res, 200, { ok: true, listo: LISTO, faltan: LISTO ? [] : faltan }, cors);
  if (!LISTO) return responder(res, 503, { error: 'El servidor todavía no está configurado.', faltan }, cors);

  if (req.method === 'POST' && ruta === '/suscribir') {
    if (!origen) return responder(res, 403, { error: 'Origen no permitido.' });
    if (limitado('s:' + ipDe(req), 30, 3600000)) return responder(res, 429, { error: 'Demasiados intentos. Probá más tarde.' }, cors);
    const b = await leerJSON(req), s = b.suscripcion;
    if (!suscripcionValida(s)) return responder(res, 400, { error: 'Suscripción no válida.' }, cors);
    const nueva = { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth }, alta: new Date().toISOString() };
    const r = await almacen.operar(l => {
      const i = l.findIndex(x => x.endpoint === nueva.endpoint);
      if (i >= 0) { if (l[i].keys.p256dh === nueva.keys.p256dh && l[i].keys.auth === nueva.keys.auth) return { cambio: false, valor: 'ya' }; l[i] = Object.assign({}, l[i], { keys: nueva.keys }); return { cambio: true, lista: l, valor: 'actualizada' }; }
      if (l.length >= MAX_SUSCRIPCIONES) return { cambio: false, valor: 'lleno' };
      l.push(nueva); return { cambio: true, lista: l, valor: 'nueva' };
    });
    if (r === 'lleno') return responder(res, 507, { error: 'Se alcanzó el máximo de suscriptoras.' }, cors);
    return responder(res, 200, { ok: true }, cors);
  }
  if (req.method === 'POST' && ruta === '/desuscribir') {
    if (!origen) return responder(res, 403, { error: 'Origen no permitido.' });
    if (limitado('d:' + ipDe(req), 30, 3600000)) return responder(res, 429, { error: 'Demasiados intentos.' }, cors);
    const b = await leerJSON(req);
    if (typeof b.endpoint !== 'string') return responder(res, 400, { error: 'Falta el endpoint.' }, cors);
    await almacen.operar(l => { const n = l.filter(x => x.endpoint !== b.endpoint); return { cambio: n.length !== l.length, lista: n, valor: null }; });
    return responder(res, 200, { ok: true }, cors);
  }

  if (ruta === '/enviar' || ruta === '/diagnostico') {
    /* Se cuentan solo las claves equivocadas; con muchas seguidas se bloquea ANTES de comparar la clave. */
    const VENT = 900000, kIp = 'a:' + ipDe(req);
    if (recientes(kIp, VENT).length >= 8 || recientes('a:*', VENT).length >= 60) return responder(res, 429, { error: 'Demasiados intentos con clave incorrecta. Esperá 15 minutos.' }, cors);
    if (!esAdmin(req)) { anotar(kIp, VENT); anotar('a:*', VENT); return responder(res, 401, { error: 'Clave incorrecta.' }, cors); }
    if (req.method === 'POST' && ruta === '/enviar') return enviarAvisos(req, res, cors);
    if (req.method === 'GET' && ruta === '/diagnostico') {
      try { const n = await almacen.leer(l => l.length); return responder(res, 200, { suscriptoras: n, almacen: 'ok' }, cors); }
      catch (e) { return responder(res, 200, { suscriptoras: null, almacen: 'error: ' + e.message }, cors); }
    }
  }
  responder(res, 404, { error: 'No existe.' }, cors);
}

http.createServer((req, res) => {
  manejar(req, res).catch(e => {
    const estado = e && e.estado ? e.estado : 500;
    if (estado === 500) console.error('[avisos] error:', e && e.message);
    if (!res.headersSent) responder(res, estado, { error: estado === 413 ? 'Pedido demasiado grande.' : estado === 400 ? 'Pedido mal formado.' : 'Error del servidor. Probá de nuevo.' });
    else res.end();
  });
}).listen(PUERTO, '0.0.0.0', () => console.log('[avisos] escuchando en el puerto ' + PUERTO + (LISTO ? '' : ' (SIN CONFIGURAR)')));
