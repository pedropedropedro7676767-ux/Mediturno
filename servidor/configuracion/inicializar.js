// Al arrancar: deja listos los datos básicos (clínica, administrador único y datos de prueba).
const fs = require("fs"), path = require("path"), mysql = require("mysql2/promise");
const { consultar } = require("./db");
const { DB, ADMIN_EMAIL, DATOS_PRUEBA } = require("./entorno");
const U = require("../utilidades");

// Crea la base de datos y las tablas si no existen, leyendo database/esquema.sql. Así no hay que importarlo a mano.
async function prepararBD() {
  const { database, ...conexion } = DB;
  try {   // en un hosting sin permiso para crear bases, la base ya existe y este paso se omite
    const c = await mysql.createConnection(conexion);
    await c.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await c.end();
  } catch (e) { if (e.code === "ECONNREFUSED") throw e; }
  const sql = fs.readFileSync(path.join(__dirname, "..", "..", "database", "esquema.sql"), "utf8").replace(/--.*$/gm, "");   // quita los comentarios
  for (const sentencia of sql.split(";").map(s => s.trim()).filter(Boolean))
    if (!/^(CREATE DATABASE|USE)\b/i.test(sentencia)) await consultar(sentencia);
  // Bases creadas con una versión anterior: agrega la columna nueva si falta (error 1060 = ya existe)
  try { await consultar("ALTER TABLE solicitudes_doctor ADD COLUMN contrasena VARCHAR(200) NULL"); } catch (e) { if (e.errno !== 1060) throw e; }
}
async function inicializar() {
  await prepararBD();
  const basicos = { nombre: "MediTurno", direccion: "Escribe aquí la dirección de tu clínica", telefono: "Escribe aquí tu teléfono", correo: "", horario: "Según la agenda de cada doctor" };
  for (const [clave, valor] of Object.entries(basicos)) {
    const [f] = await consultar("SELECT clave FROM config WHERE clave = ?", [clave]);
    if (!f) await consultar("INSERT INTO config (clave, valor) VALUES (?, ?)", [clave, valor]);
  }
  const [admin] = await consultar("SELECT id FROM usuarios WHERE rol = 'admin'");   // el administrador es ÚNICO
  if (!admin) await consultar("INSERT INTO usuarios (rol, nombre, email) VALUES ('admin', 'Administrador', ?)", [ADMIN_EMAIL]);
  else await consultar("UPDATE usuarios SET email = ? WHERE id = ?", [ADMIN_EMAIL, admin.id]);
  if (!DATOS_PRUEBA) return;
  const [hayDoctores] = await consultar("SELECT usuario_id FROM doctores LIMIT 1");
  if (hayDoctores) return;
  const claveDoctor = await U.hash("Doctor123*");
  for (const [nombre, email, esp, precio] of [["Dra. Laura Mendoza", "laura@mediturno.test", "Medicina general", 400], ["Dr. Andrés Rivas", "andres@mediturno.test", "Pediatría", 550], ["Dra. Sofía Cantú", "sofia@mediturno.test", "Dermatología", 700]]) {
    const r = await consultar("INSERT INTO usuarios (rol, nombre, email, contrasena) VALUES ('doctor', ?, ?, ?)", [nombre, email, claveDoctor]);
    await consultar("INSERT INTO doctores (usuario_id, especialidad, precio, agenda) VALUES (?, ?, ?, ?)", [r.insertId, esp, precio, JSON.stringify(U.agendaBase())]);
  }
  await consultar("INSERT INTO usuarios (rol, nombre, email, contrasena) VALUES ('paciente', 'Paciente de Prueba', 'paciente@mediturno.test', ?)", [await U.hash("Paciente123*")]);
}
module.exports = { inicializar };
