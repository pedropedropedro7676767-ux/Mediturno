// Cada 30 minutos avisa a los pacientes cuya cita aprobada es en menos de 24 horas.
const { consultar } = require("../configuracion/db");
const U = require("../utilidades");
async function recordatorios() {
  const citas = await consultar("SELECT c.id, c.fecha, c.hora, c.paciente_id, up.email, ud.nombre AS dnombre FROM citas c JOIN usuarios up ON up.id = c.paciente_id JOIN usuarios ud ON ud.id = c.doctor_id WHERE c.estado = 'aprobada' AND c.recordada = 0");
  for (const c of citas) {
    const cuando = new Date(`${c.fecha}T${U.hhmm(c.hora)}:00`).getTime();
    if (cuando > Date.now() && cuando - Date.now() < U.DIA) {
      await consultar("UPDATE citas SET recordada = 1 WHERE id = ?", [c.id]);
      await U.notificar(c.paciente_id, c.email, "recordatorio de tu cita", `Recuerda: tienes cita con ${c.dnombre} el ${c.fecha} a las ${U.hhmm(c.hora)}.`);
    }
  }
}
module.exports = { recordatorios };
