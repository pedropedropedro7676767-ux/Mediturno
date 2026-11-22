// Rutas que no necesitan iniciar sesión: datos públicos, registro, login, acceso del admin, enlaces de correo y chatbot.
const crypto = require("crypto");
const { consultar } = require("../configuracion/db");
const U = require("../utilidades");
const { enviarCorreo } = require("../servicios/correo");
const { preguntarIA } = require("../servicios/ia");
const { responderCita, resolverSolicitud } = require("../servicios/acciones");

const DOCTORES_ACTIVOS = "SELECT u.id, u.nombre, d.especialidad AS esp, d.precio FROM doctores d JOIN usuarios u ON u.id = d.usuario_id WHERE u.activo = 1 ORDER BY u.nombre";
// Asistente básico: se usa cuando no hay llave de IA o si la IA falla.
function respuestaBasica(t, doctores) {
  if (/hola|buenas/.test(t)) return "¡Hola! Puedo ayudarte con doctores, precios y cómo pedir tu cita.";
  if (/doctor|especialista|m[eé]dico/.test(t)) return "Doctores: " + doctores.map(d => `${d.nombre} (${d.esp})`).join(", ") + ".";
  if (/precio|costo|cu[aá]nto/.test(t)) return "Consultas: " + doctores.map(d => `${d.nombre} $${d.precio}`).join(", ") + ".";
  if (/cita|agendar|reserv|horario|hora/.test(t)) return "Entra a “Mis citas”, elige doctor y fecha, y verás las horas libres. El doctor acepta o rechaza tu solicitud.";
  return "En este modo solo respondo dudas básicas: doctores, precios y cómo pedir cita.";
}
// Busca la cita o solicitud a la que apunta un enlace de correo (solo si sigue pendiente).
async function objetivo(a) {
  if (!a || !a.t) throw U.error(410, "Este enlace venció o no es válido.");
  const sql = a.t.startsWith("cita")
    ? "SELECT c.fecha, c.hora, u.nombre FROM citas c JOIN usuarios u ON u.id = c.paciente_id WHERE c.id = ? AND c.estado = 'pendiente'"
    : "SELECT nombre, especialidad FROM solicitudes_doctor WHERE id = ? AND estado = 'pendiente'";
  const [x] = await consultar(sql, [a.id]);
  if (!x) throw U.error(410, "Esto ya fue respondido.");
  return x;
}

module.exports = [
  U.ruta("GET", /^config$/, null, () => U.configuracion()),
  U.ruta("GET", /^doctores$/, null, () => consultar(DOCTORES_ACTIVOS)),
  U.ruta("GET", /^horas$/, null, async ({ consulta }) => ({ libres: await U.horasLibres(+consulta.docId, consulta.fecha) })),

  // CREATE: registro de cuentas nuevas. Solo hay dos tipos: paciente (entra de inmediato) y doctor (queda en revisión hasta que el administrador lo apruebe).
  U.ruta("POST", /^registro$/, null, async ({ cuerpo }) => {
    const tipo = cuerpo.tipo === "doctor" ? "doctor" : "paciente";   // cualquier otro valor (por ejemplo "admin") se trata como paciente
    const nombre = U.texto(cuerpo.nombre, 100), email = U.correo(cuerpo.email), pass = String(cuerpo.pass || ""), telefono = U.digitos(cuerpo.tel), esp = U.texto(cuerpo.esp, 80);
    if (!nombre || !email || pass.length < 6) throw U.error(400, "Revisa tu nombre, correo y contraseña (mínimo 6 caracteres).");
    if (telefono && telefono.length < 10) throw U.error(400, "El teléfono debe tener al menos 10 dígitos.");
    if (tipo === "doctor" && !esp) throw U.error(400, "Escribe tu especialidad.");
    const [existe] = await consultar("SELECT email FROM usuarios WHERE email = ? UNION SELECT email FROM solicitudes_doctor WHERE email = ? AND estado = 'pendiente'", [email, email]);
    if (existe) throw U.error(400, "Ese correo ya tiene cuenta o una solicitud en revisión.");
    if (tipo === "paciente") {
      await consultar("INSERT INTO usuarios (rol, nombre, email, contrasena, telefono) VALUES ('paciente', ?, ?, ?, ?)", [nombre, email, await U.hash(pass), telefono]);
      return { ok: true, pendiente: false };
    }
    // Doctor: se guarda como SOLICITUD (con su contraseña ya en hash) y se avisa al administrador. Aún no existe como usuario.
    const r = await consultar("INSERT INTO solicitudes_doctor (nombre, email, especialidad, telefono, contrasena) VALUES (?, ?, ?, ?, ?)", [nombre, email, esp, telefono, await U.hash(pass)]);
    const [admin] = await consultar("SELECT id, email FROM usuarios WHERE rol = 'admin'");
    await U.notificar(admin.id, admin.email, "solicitud de alta de doctor", `${nombre} (${esp}, ${email}) pide unirse como doctor.`,
      `Aprobar: ${U.enlace("doc-si", r.insertId)}\nRechazar: ${U.enlace("doc-no", r.insertId)}`);
    return { ok: true, pendiente: true };
  }),
  // Inicio de sesión de pacientes y doctores (el administrador entra con código por correo, ver abajo)
  U.ruta("POST", /^login$/, null, async ({ cuerpo }) => {
    const email = U.correo(cuerpo.email), pass = String(cuerpo.pass || "");
    const [u] = await consultar("SELECT * FROM usuarios WHERE email = ? AND rol <> 'admin' AND activo = 1", [email]);
    if (u && await U.verificar(pass, u.contrasena)) return U.abrirSesion(u);
    // ¿Es un doctor cuya solicitud aún no se aprueba? (solo se le avisa si la contraseña es correcta)
    const [s] = await consultar("SELECT * FROM solicitudes_doctor WHERE email = ? ORDER BY id DESC LIMIT 1", [email]);
    if (s && s.contrasena && await U.verificar(pass, s.contrasena)) {
      if (s.estado === "pendiente") throw U.error(403, "Tu solicitud de doctor sigue en revisión. El administrador debe aprobarla.");
      if (s.estado === "rechazada") throw U.error(403, "Tu solicitud de doctor fue rechazada por el administrador.");
    }
    throw U.error(401, "Correo o contraseña incorrectos.");
  }),

  // Acceso especial del administrador: paso 1, pedir el código por correo
  U.ruta("POST", /^admin\/codigo$/, null, async ({ cuerpo }) => {
    const email = U.correo(cuerpo.email), [admin] = await consultar("SELECT id FROM usuarios WHERE rol = 'admin' AND email = ?", [email]);
    if (admin) {
      const codigo = String(100000 + crypto.randomInt(900000));
      await consultar("DELETE FROM codigos_admin WHERE email = ?", [email]);
      await consultar("INSERT INTO codigos_admin (email, codigo, expira, intentos) VALUES (?, ?, ?, 0)", [email, await U.hash(codigo), Date.now() + 10 * 60000]);
      enviarCorreo(email, "MediTurno: tu código de administrador", `Tu código de acceso es ${codigo}. Vence en 10 minutos. Si no fuiste tú, ignora este correo.`);
    }
    return { ok: true };   // misma respuesta aunque el correo no sea el del administrador
  }),
  // paso 2, comprobar el código
  U.ruta("POST", /^admin\/entrar$/, null, async ({ cuerpo }) => {
    const email = U.correo(cuerpo.email), [k] = await consultar("SELECT * FROM codigos_admin WHERE email = ?", [email]);
    if (!k || k.expira < Date.now() || k.intentos >= 5) throw U.error(401, "Código inválido o vencido. Pide uno nuevo.");
    if (!(await U.verificar(U.texto(cuerpo.codigo, 6), k.codigo))) {
      await consultar("UPDATE codigos_admin SET intentos = intentos + 1 WHERE email = ?", [email]);
      throw U.error(401, "Código incorrecto.");
    }
    await consultar("DELETE FROM codigos_admin WHERE email = ?", [email]);   // el código sirve una sola vez
    const [admin] = await consultar("SELECT * FROM usuarios WHERE rol = 'admin' AND email = ?", [email]);
    await U.bitacora("Administrador", "Inicio de sesión");
    return U.abrirSesion(admin);
  }),

  // Enlaces de los correos: GET solo muestra la pregunta; POST ejecuta la acción (evita que un escáner de correo la active solo)
  U.ruta("GET", /^accion\/([\w.\-]+)$/, null, async ({ partes }) => {
    const a = U.leerFirma(partes[1]), x = await objetivo(a), si = a.t.endsWith("-si");
    return { texto: a.t.startsWith("cita") ? `¿${si ? "Aceptar" : "Rechazar"} la cita de ${x.nombre} el ${x.fecha} a las ${U.hhmm(x.hora)}?` : `¿${si ? "Aprobar" : "Rechazar"} a ${x.nombre} (${x.especialidad}) como doctor?` };
  }),
  U.ruta("POST", /^accion\/([\w.\-]+)$/, null, async ({ partes }) => {
    const a = U.leerFirma(partes[1]); await objetivo(a);
    const si = a.t.endsWith("-si");
    if (a.t.startsWith("cita")) await responderCita(a.id, si ? "aprobada" : "rechazada", "Doctor (correo)");
    else await resolverSolicitud(a.id, si, "Administrador (correo)");
    return { mensaje: "Listo: " + (si ? "aprobado." : "rechazado.") };
  }),

  U.ruta("POST", /^chat$/, null, async ({ cuerpo }) => {
    const mensaje = U.texto(cuerpo.mensaje, 1000), config = await U.configuracion(), doctores = await consultar(DOCTORES_ACTIVOS);
    const sistema = `Eres el asistente virtual de ${config.nombre}, un sistema de citas médicas. Responde en español, breve y amable. Doctores: ${doctores.map(d => `${d.nombre} (${d.esp}, $${d.precio} MXN)`).join("; ")}. Cada doctor define su propio horario; el paciente ve las horas libres al pedir cita. Para pedir cita el paciente crea su cuenta, entra a "Mis citas" y elige doctor, fecha y hora; el doctor acepta o rechaza y se avisa por correo. Contacto: ${config.telefono}. No des diagnósticos ni recetas: si es urgente, indica acudir a urgencias.`;
    return { respuesta: (await preguntarIA(sistema, mensaje, cuerpo.historial)) || respuestaBasica(mensaje.toLowerCase(), doctores) };
  })
];
