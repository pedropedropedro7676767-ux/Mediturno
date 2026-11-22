// Conexión con MySQL. Se usa un "pool": varias conexiones reutilizables.
const mysql = require("mysql2/promise");
const { DB } = require("./entorno");
const pool = mysql.createPool({ ...DB, waitForConnections: true, connectionLimit: 10, charset: "utf8mb4",
  dateStrings: true });   // las fechas llegan como texto "2026-11-23" y no como objetos Date

// Ejecuta una consulta SQL. Los "?" se rellenan con "parametros" (así se evita la inyección SQL).
// SELECT devuelve un arreglo de filas; INSERT/UPDATE/DELETE devuelven {insertId, affectedRows}.
async function consultar(sql, parametros = []) {
  const [resultado] = await pool.query(sql, parametros);
  return resultado;
}
module.exports = { consultar };
