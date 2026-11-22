// Funciones de apoyo que usan todas las rutas: validaciones, seguridad, horarios y avisos.
const crypto = require("crypto");
const { consultar } = require("./configuracion/db");
const { SECRETO, URL_BASE } = require("./configuracion/entorno");
const { enviarCorreo } = require("./servicios/correo");

const DIA = 864e5;   // un día en milisegundos
const error = (estado, mensaje) => Object.assign(new Error(mensaje), { estado });   // error con código HTTP
const ruta = (metodo, patron, roles, manejador) => ({ metodo, patron, roles, manejador });

/* ---------- Validación y limpieza de datos ---------- */
const texto = (v, max) => String(v ?? "").trim().slice(0, max);
const digitos = v => String(v ?? "").replace(/\D/g, "").slice(0, 15);
const correo = v => { const c = texto(v, 120).toLowerCase(); return /^\S+@\S+\.\S+$/.test(c) ? c : ""; };   // "" si no es válido
const fechaValida = f => /^\d{4}-\d{2}-\d{2}$/.test(f || "") && !isNaN(new Date(f + "T12:00:00"));
const f2 = n => String(n).padStart(2, "0");
const hoy = () => { const d = new Date(); return `${d.getFullYear()}-${f2(d.getMonth() + 1)}-${f2(d.getDate())}`; };
const hhmm = h => String(h).slice(0, 5);   // "09:00:00" -> "09:00"
const mins = h => +h.slice(0, 2) * 60 + +h.slice(3, 5);
const aHora = m => f2(Math.floor(m / 60)) + ":" + f2(m % 60);
const esDuplicado = e => !!e && e.errno === 1062;      // error de MySQL: valor repetido en un campo UNIQUE
const esReferenciado = e => !!e && e.errno === 1451;   // error de MySQL: el registro lo usan otras tablas

/* ---------- Contraseñas: se guardan como hash (scrypt), nunca en texto normal ---------- */
const scrypt = (p, sal) => new Promise((ok, no) => crypto.scrypt(p, sal, 32, (e, k) => e ? no(e) : ok(k.toString("hex"))));
async function hash(contrasena, sal = crypto.randomBytes(8).toString("hex")) { return sal + ":" + await scrypt(contrasena, sal); }
async function verificar(contrasena, guardado) { return !!guardado && (await hash(contrasena, guardado.split(":")[0])) === guardado; }

/* ---------- Tokens firmados: sirven para las sesiones y para los enlaces de los correos ---------- */
const firma = cuerpo => crypto.createHmac("sha256", SECRETO).update(cuerpo).digest("base64url");
function firmar(datos, vigenciaMs) {
  const cuerpo = Buffer.from(JSON.stringify({ ...datos, exp: Date.now() + vigenciaMs })).toString("base64url");
  return cuerpo + "." + firma(cuerpo);
}
function leerFirma(token) {   // devuelve los datos si la firma es correcta y no ha vencido; si no, null
  const [cuerpo, f] = String(token || "").split("."), esperada = cuerpo ? firma(cuerpo) : "";
  if (!cuerpo || !f || f.length !== esperada.length || !crypto.timingSafeEqual(Buffer.from(f), Buffer.from(esperada))) return null;
  try { const d = JSON.parse(Buffer.from(cuerpo, "base64url").toString()); return d.exp > Date.now() ? d : null; } catch { return null; }
}
const publico = u => ({ id: u.id, nombre: u.nombre, email: u.email, rol: u.rol, tel: u.telefono });
const abrirSesion = u => ({ token: firmar({ u: u.id }, 7 * DIA), user: publico(u) });
async function usuarioDeToken(token) {
  const d = leerFirma(token); if (!d || d.u === undefined) return null;
  const [u] = await consultar("SELECT * FROM usuarios WHERE id = ? AND activo = 1", [d.u]);
  return u || null;
}
const enlace = (tipo, id) => `${URL_BASE}/accion/${firmar({ t: tipo, id }, 7 * DIA)}`;   // enlace de un correo

/* ---------- Agenda del doctor y horas libres ---------- */
const agendaBase = () => ({ duracion: 30, bloqueos: [],
  dias: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map(d => [d, { on: d > 0 && d < 6, ini: "09:00", fin: "14:00" }])) });
async function horasLibres(doctorId, fecha) {
  if (!fechaValida(fecha)) return [];
  const [d] = await consultar("SELECT d.agenda FROM doctores d JOIN usuarios u ON u.id = d.usuario_id WHERE d.usuario_id = ? AND u.activo = 1", [doctorId]);
  if (!d) return [];
  const agenda = JSON.parse(d.agenda), dia = agenda.dias[new Date(fecha + "T12:00:00").getDay()], ahora = new Date(), libres = [];
  if (fecha < hoy() || !dia || !dia.on || agenda.bloqueos.includes(fecha)) return [];   // pasado, día sin servicio o bloqueado
  const ocupadas = (await consultar("SELECT hora FROM citas WHERE doctor_id = ? AND fecha = ? AND activa = 1", [doctorId, fecha])).map(c => hhmm(c.hora));
  for (let m = mins(dia.ini); m + agenda.duracion <= mins(dia.fin); m += agenda.duracion) {   // ciclo: una hora por cada consulta
    const hora = aHora(m), yaPaso = fecha === hoy() && m <= ahora.getHours() * 60 + ahora.getMinutes();
    if (!ocupadas.includes(hora) && !yaPaso) libres.push(hora);
  }
  return libres;
}

/* ---------- Avisos ---------- */
async function notificar(usuarioId, destino, asunto, mensaje, enlaces = "") {   // aviso dentro de la app + correo
  await consultar("INSERT INTO notificaciones (usuario_id, texto) VALUES (?, ?)", [usuarioId, mensaje]);
  enviarCorreo(destino, "MediTurno: " + asunto, mensaje + (enlaces ? "\n" + enlaces : ""));
}
const bitacora = (quien, mensaje) => consultar("INSERT INTO bitacora (quien, texto) VALUES (?, ?)", [quien, mensaje]);
async function configuracion() {
  return Object.fromEntries((await consultar("SELECT clave, valor FROM config")).map(f => [f.clave, f.valor]));
}
module.exports = { DIA, error, ruta, texto, digitos, correo, fechaValida, hoy, hhmm, mins, esDuplicado, esReferenciado, hash, verificar,
  firmar, leerFirma, publico, abrirSesion, usuarioDeToken, enlace, agendaBase, horasLibres, notificar, bitacora, configuracion };
