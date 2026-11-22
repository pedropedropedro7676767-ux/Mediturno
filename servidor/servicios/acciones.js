// Operaciones que se usan desde varios lugares (panel y enlaces de correo).
const crypto = require("crypto");
const { consultar } = require("../configuracion/db");
const U = require("../utilidades");

// Cambia el estado de una cita y avisa al paciente.
async function responderCita(id, estado, quien, nota = "") {
  const [c] = await consultar("SELECT c.*, up.email AS pemail, ud.nombre AS dnombre FROM citas c JOIN usuarios up ON up.id = c.paciente_id JOIN usuarios ud ON ud.id = c.doctor_id WHERE c.id = ?", [id]);
  const activa = ["pendiente", "aprobada"].includes(estado) ? 1 : null;   // rechazar/cancelar libera el horario
  await consultar("UPDATE citas SET estado = ?, nota = ?, activa = ? WHERE id = ?", [estado, nota || c.nota, activa, id]);
  await U.bitacora(quien, `Cita #${id}: ${estado}`);
  await U.notificar(c.paciente_id, c.pemail, `tu cita fue ${estado}`, `Tu cita con ${c.dnombre} el ${c.fecha} a las ${U.hhmm(c.hora)}: ${estado.toUpperCase()}.${nota ? "\nNota: " + nota : ""}`);
}
// Crea la cuenta de un doctor. Si se recibe "contrasenaHash" (doctor que se registró solo) se usa esa contraseña; si no (alta directa del administrador) se genera una temporal.
async function altaDoctor({ nombre, email, esp, telefono, precio, contrasenaHash }) {
  const pass = contrasenaHash ? null : crypto.randomBytes(4).toString("hex");
  const r = await consultar("INSERT INTO usuarios (rol, nombre, email, contrasena, telefono) VALUES ('doctor', ?, ?, ?, ?)", [nombre, email, contrasenaHash || await U.hash(pass), telefono || ""]);
  try { await consultar("INSERT INTO doctores (usuario_id, especialidad, precio, agenda) VALUES (?, ?, ?, ?)", [r.insertId, esp, precio, JSON.stringify(U.agendaBase())]); }
  catch (e) { await consultar("DELETE FROM usuarios WHERE id = ?", [r.insertId]); throw e; }   // no dejar un usuario a medias
  const acceso = pass ? `Correo: ${email}\nContraseña temporal: ${pass}\nEntra y cámbiala en "Mi cuenta".` : `Ya puedes iniciar sesión con tu correo y la contraseña que elegiste al registrarte.`;
  await U.notificar(r.insertId, email, "tu cuenta de doctor fue aprobada", `Bienvenido(a) a MediTurno.\n${acceso}\nAquí te llegarán las solicitudes de cita con enlaces para aceptarlas o rechazarlas.`);
  return r.insertId;
}
async function resolverSolicitud(id, aprobar, quien) {
  const [s] = await consultar("SELECT * FROM solicitudes_doctor WHERE id = ? AND estado = 'pendiente'", [id]);
  if (!s) throw U.error(404, "Solicitud no encontrada o ya respondida.");
  await consultar("UPDATE solicitudes_doctor SET estado = ? WHERE id = ?", [aprobar ? "aprobada" : "rechazada", id]);
  if (aprobar) {
    await altaDoctor({ nombre: s.nombre, email: s.email, esp: s.especialidad, telefono: s.telefono, precio: 500, contrasenaHash: s.contrasena });
    await consultar("UPDATE solicitudes_doctor SET contrasena = NULL WHERE id = ?", [id]);   // ya no hace falta guardarla aquí
  }
  else require("./correo").enviarCorreo(s.email, "MediTurno: tu solicitud", "Por ahora no pudimos aprobar tu solicitud para unirte como doctor.");
  await U.bitacora(quien, `Solicitud de ${s.nombre}: ${aprobar ? "aprobada" : "rechazada"}`);
}
module.exports = { responderCita, altaDoctor, resolverSolicitud };
