// CRUD de citas. Create: POST citas · Read: GET citas · Update: PATCH citas/:id · Delete: DELETE citas/:id
const { consultar } = require("../configuracion/db");
const U = require("../utilidades");
const { responderCita } = require("../servicios/acciones");

const SELECT_CITAS = `SELECT c.id, c.fecha, c.hora, c.motivo, c.telefono AS tel, c.estado, c.nota, c.doctor_id AS docId,
  ud.nombre AS docNombre, d.especialidad AS esp, d.precio, up.nombre AS pacNombre
  FROM citas c JOIN usuarios ud ON ud.id = c.doctor_id JOIN doctores d ON d.usuario_id = c.doctor_id JOIN usuarios up ON up.id = c.paciente_id`;
const vista = f => ({ ...f, hora: U.hhmm(f.hora) });   // "09:00:00" -> "09:00"
// Estados a los que puede pasar una cita cuando responde el doctor o el administrador.
const TRANSICIONES = { pendiente: ["aprobada", "rechazada", "cancelada"], aprobada: ["atendida", "cancelada"] };

module.exports = [
  // READ: cada rol ve solo lo suyo
  U.ruta("GET", /^citas$/, [], async ({ usuario }) => {
    const filtro = usuario.rol === "paciente" ? " WHERE c.paciente_id = ?" : usuario.rol === "doctor" ? " WHERE c.doctor_id = ?" : "";
    return (await consultar(SELECT_CITAS + filtro + " ORDER BY c.fecha, c.hora", filtro ? [usuario.id] : [])).map(vista);
  }),

  // CREATE
  U.ruta("POST", /^citas$/, ["paciente"], async ({ usuario, cuerpo }) => {
    const docId = +cuerpo.docId, fecha = String(cuerpo.fecha || ""), hora = String(cuerpo.hora || ""), motivo = U.texto(cuerpo.motivo, 500), telefono = U.digitos(cuerpo.tel || usuario.telefono);
    if (!motivo) throw U.error(400, "Escribe el motivo de la consulta.");
    if (!(await U.horasLibres(docId, fecha)).includes(hora)) throw U.error(400, "Ese horario ya no está disponible.");
    let r;
    try { r = await consultar("INSERT INTO citas (paciente_id, doctor_id, fecha, hora, motivo, telefono) VALUES (?, ?, ?, ?, ?, ?)", [usuario.id, docId, fecha, hora, motivo, telefono]); }
    catch (e) { if (U.esDuplicado(e)) throw U.error(400, "Alguien acaba de apartar ese horario. Elige otro."); throw e; }
    const [doc] = await consultar("SELECT nombre, email FROM usuarios WHERE id = ?", [docId]);
    await U.bitacora(usuario.nombre, `Pidió la cita #${r.insertId}`);
    await U.notificar(docId, doc.email, "nueva solicitud de cita", `${usuario.nombre} pide cita el ${fecha} a las ${hora}.\nMotivo: ${motivo}`,
      `Aceptar: ${U.enlace("cita-si", r.insertId)}\nRechazar: ${U.enlace("cita-no", r.insertId)}`);
    return { ok: true, id: r.insertId };
  }),

  // UPDATE: el paciente cancela o reprograma; el doctor/administrador responde
  U.ruta("PATCH", /^citas\/(\d+)$/, [], async ({ usuario, cuerpo, partes }) => {
    const [c] = await consultar("SELECT * FROM citas WHERE id = ?", [+partes[1]]);
    if (!c || (usuario.rol === "paciente" && c.paciente_id !== usuario.id) || (usuario.rol === "doctor" && c.doctor_id !== usuario.id)) throw U.error(404, "Cita no encontrada.");
    if (usuario.rol === "paciente") {
      if (!["pendiente", "aprobada"].includes(c.estado)) throw U.error(400, "Esta cita ya no se puede modificar.");
      const [doc] = await consultar("SELECT email FROM usuarios WHERE id = ?", [c.doctor_id]);
      if (cuerpo.estado === "cancelada") {
        await responderCita(c.id, "cancelada", usuario.nombre);
        await U.notificar(c.doctor_id, doc.email, "cita cancelada", `${usuario.nombre} canceló su cita del ${c.fecha} a las ${U.hhmm(c.hora)}.`);
      } else if (cuerpo.fecha) {   // reprogramar: debe haber un horario libre y la cita vuelve a "pendiente"
        const fecha = String(cuerpo.fecha), hora = String(cuerpo.hora || "");
        if (!(await U.horasLibres(c.doctor_id, fecha)).includes(hora)) throw U.error(400, "Ese horario no está disponible.");
        try { await consultar("UPDATE citas SET fecha = ?, hora = ?, estado = 'pendiente', activa = 1, recordada = 0 WHERE id = ?", [fecha, hora, c.id]); }
        catch (e) { if (U.esDuplicado(e)) throw U.error(400, "Ese horario ya fue apartado."); throw e; }
        await U.bitacora(usuario.nombre, `Reprogramó la cita #${c.id}`);
        await U.notificar(c.doctor_id, doc.email, "cita reprogramada", `${usuario.nombre} pidió mover su cita al ${fecha} a las ${hora}.`,
          `Aceptar: ${U.enlace("cita-si", c.id)}\nRechazar: ${U.enlace("cita-no", c.id)}`);
      } else throw U.error(400, "Acción no válida.");
    } else {
      if (!(TRANSICIONES[c.estado] || []).includes(cuerpo.estado)) throw U.error(400, "Esa cita no puede pasar a ese estado.");
      await responderCita(c.id, cuerpo.estado, usuario.nombre, U.texto(cuerpo.nota, 300));
    }
    return { ok: true };
  }),

  // DELETE: el administrador elimina cualquiera; el paciente solo las suyas ya canceladas o rechazadas
  U.ruta("DELETE", /^citas\/(\d+)$/, ["admin", "paciente"], async ({ usuario, partes }) => {
    const [c] = await consultar("SELECT * FROM citas WHERE id = ?", [+partes[1]]);
    if (!c || (usuario.rol === "paciente" && c.paciente_id !== usuario.id)) throw U.error(404, "Cita no encontrada.");
    if (usuario.rol === "paciente" && !["cancelada", "rechazada"].includes(c.estado)) throw U.error(400, "Primero cancela la cita para poder eliminarla.");
    await consultar("DELETE FROM citas WHERE id = ?", [c.id]);
    await U.bitacora(usuario.nombre, `Eliminó la cita #${c.id}`);
    return { ok: true };
  })
];
