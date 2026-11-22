// Agenda del doctor: qué días y horas atiende, duración de cada consulta y días bloqueados.
const { consultar } = require("../configuracion/db");
const U = require("../utilidades");
const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const hora = h => /^\d\d:\d\d$/.test(h);
module.exports = [
  U.ruta("GET", /^agenda$/, ["doctor"], async ({ usuario }) => JSON.parse((await consultar("SELECT agenda FROM doctores WHERE usuario_id = ?", [usuario.id]))[0].agenda)),
  U.ruta("PUT", /^agenda$/, ["doctor"], async ({ usuario, cuerpo }) => {
    const dias = {};
    for (let i = 0; i < 7; i++) {   // ciclo: valida cada día de la semana
      const d = (cuerpo.dias || {})[i] || {}, activo = !!d.on;
      if (activo && !(hora(d.ini) && hora(d.fin) && U.mins(d.ini) < U.mins(d.fin))) throw U.error(400, `Revisa el horario del ${DIAS[i]}: el inicio debe ser antes del final.`);
      dias[i] = { on: activo, ini: d.ini || "09:00", fin: d.fin || "14:00" };
    }
    const agenda = { duracion: [20, 30, 45, 60].includes(+cuerpo.duracion) ? +cuerpo.duracion : 30, dias,
      bloqueos: String(cuerpo.bloqueos || "").split(/[,\s]+/).filter(U.fechaValida) };
    await consultar("UPDATE doctores SET agenda = ? WHERE usuario_id = ?", [JSON.stringify(agenda), usuario.id]);
    await U.bitacora(usuario.nombre, "Cambió su agenda");
    return agenda;
  })
];
