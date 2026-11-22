// Servidor principal: recibe las peticiones del navegador, las envía a la ruta correcta y responde en JSON.
const http = require("http"), fs = require("fs"), path = require("path");
const { PUERTO } = require("./configuracion/entorno");
const U = require("./utilidades");
const { inicializar } = require("./configuracion/inicializar");
const { recordatorios } = require("./servicios/recordatorios");
const rutas = [...require("./rutas/publicas"), ...require("./rutas/citas"), ...require("./rutas/doctor"), ...require("./rutas/cuenta"), ...require("./rutas/admin")];

const CARPETA_PUBLICA = path.join(__dirname, "..", "public");
const TIPOS = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".mp4": "video/mp4", ".mp3": "audio/mpeg", ".json": "application/json" };
const esc = t => String(t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Busca la ruta que coincide, revisa el rango del usuario y ejecuta su manejador.
async function atender(metodo, rutaUrl, consulta, cuerpo, token) {
  for (const r of rutas) {
    const partes = rutaUrl.match(r.patron);
    if (r.metodo !== metodo || !partes) continue;
    let usuario = null;
    if (r.roles) {   // roles = null: pública · [] = cualquier usuario · ["admin"] = solo ese rango
      usuario = await U.usuarioDeToken(token);
      if (!usuario) throw U.error(401, "Tu sesión expiró. Ingresa de nuevo.");
      if (r.roles.length && !r.roles.includes(usuario.rol)) throw U.error(403, "No tienes permiso para esto.");
    }
    return r.manejador({ usuario, cuerpo, consulta, partes });
  }
  throw U.error(404, "No existe esa ruta.");
}
function leerCuerpo(req) {
  return new Promise((ok, no) => {
    let datos = "";
    req.on("data", c => { datos += c; if (datos.length > 1e5) { no(U.error(413, "Datos demasiado grandes.")); req.destroy(); } });
    req.on("end", () => { try { ok(datos ? JSON.parse(datos) : {}); } catch { no(U.error(400, "Datos inválidos.")); } });
  });
}
function archivoEstatico(res, rutaUrl) {   // sirve la carpeta public/ (HTML, CSS, JS, imágenes)
  const archivo = path.normalize(path.join(CARPETA_PUBLICA, decodeURIComponent(rutaUrl === "/" ? "/index.html" : rutaUrl)));
  if (!archivo.startsWith(CARPETA_PUBLICA)) { res.writeHead(404); return res.end("No encontrado"); }
  fs.readFile(archivo, (e, datos) => {
    if (e) { res.writeHead(404); return res.end("No encontrado"); }
    res.writeHead(200, { "Content-Type": TIPOS[path.extname(archivo)] || "application/octet-stream" }); res.end(datos);
  });
}
async function paginaAccion(req, res, token) {   // página a la que llevan los enlaces de los correos
  let mensaje, boton = "", codigo = 200;
  try {
    token = token.replace(/[^\w.\-]/g, "");
    if (req.method === "POST") mensaje = (await atender("POST", "accion/" + token, {}, {}, "")).mensaje;
    else { mensaje = (await atender("GET", "accion/" + token, {}, {}, "")).texto; boton = `<form method="POST"><button style="font-size:1.1rem;padding:.8rem 2rem;border:0;border-radius:99px;background:#0E6E78;color:#fff;cursor:pointer">Confirmar</button></form>`; }
  } catch (e) { codigo = e.estado || 500; mensaje = e.estado ? e.message : "Error interno."; }
  res.writeHead(codigo, { "Content-Type": "text/html; charset=utf-8" });
  res.end(`<!DOCTYPE html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:system-ui,sans-serif;text-align:center;padding:3rem 1rem"><h1 style="color:#0E6E78">MediTurno</h1><p style="font-size:1.2rem">${esc(mensaje)}</p>${boton}`);
}

const servidor = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname.startsWith("/accion/")) return await paginaAccion(req, res, url.pathname.slice(8));
    if (!url.pathname.startsWith("/api/")) return archivoEstatico(res, url.pathname);
    res.setHeader("Access-Control-Allow-Origin", "*"); res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
    if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
    const cuerpo = ["GET", "DELETE"].includes(req.method) ? {} : await leerCuerpo(req);
    const resultado = await atender(req.method, url.pathname.slice(5), Object.fromEntries(url.searchParams), cuerpo, (req.headers.authorization || "").slice(7));
    res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(resultado));
  } catch (e) {   // los errores propios llevan mensaje claro; los demás se registran y se responde algo genérico
    if (!e.estado) console.error(e);
    if (!res.headersSent) res.writeHead(e.estado || 500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: e.estado ? e.message : "Error interno del servidor." }));
  }
});

inicializar().then(() => {
  servidor.listen(PUERTO, "0.0.0.0", () => {
    console.log(`MediTurno listo en http://localhost:${PUERTO}`);
    // Direcciones para abrirlo desde el celular (mismo Wi-Fi). Casi siempre es la que empieza con 192.168
    const ips = Object.values(require("os").networkInterfaces()).flat().filter(i => (i.family === "IPv4" || i.family === 4) && !i.internal).map(i => i.address);
    if (ips.length) { console.log("\nEn el CELULAR (mismo Wi-Fi) abre una de estas direcciones:"); ips.forEach(ip => console.log(`   http://${ip}:${PUERTO}`)); }
    recordatorios().catch(() => {}); setInterval(() => recordatorios().catch(() => {}), 30 * 60 * 1000);
  });
}).catch(e => { console.error("No se pudo preparar la base de datos. Revisa tu .env y que MySQL esté encendido.\n", e.message); process.exit(1); });
