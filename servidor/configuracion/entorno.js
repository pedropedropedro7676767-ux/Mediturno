// Lee las variables del archivo .env (sin librerías) y las entrega ya listas para usar.
const fs = require("fs"), path = require("path"), crypto = require("crypto");
try {
  fs.readFileSync(path.join(__dirname, "..", "..", ".env"), "utf8").split(/\r?\n/).forEach(linea => {
    const m = linea.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  });
} catch { /* sin .env se usan las variables del hosting */ }
const e = process.env, PUERTO = +e.PORT || 3000;
if (!e.SECRETO) console.log("AVISO: falta SECRETO en .env. Las sesiones se cerrarán cada vez que reinicies el servidor.");
module.exports = {
  PUERTO,
  DB: { host: e.DB_HOST || "localhost", port: +e.DB_PORT || 3306, user: e.DB_USUARIO || "root", password: e.DB_CONTRASENA || "", database: e.DB_NOMBRE || "mediturno",
        ssl: e.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined },
  SECRETO: e.SECRETO || crypto.randomBytes(32).toString("hex"),
  ADMIN_EMAIL: (e.ADMIN_EMAIL || "admin@mediturno.com").trim().toLowerCase(),
  RESEND_API_KEY: e.RESEND_API_KEY, CORREO_DE: e.CORREO_DE || "MediTurno <onboarding@resend.dev>",
  ANTHROPIC_API_KEY: e.ANTHROPIC_API_KEY, MODELO: e.MODELO || "claude-sonnet-5-5",
  URL_BASE: (e.URL_PUBLICA || `http://localhost:${PUERTO}`).replace(/\/$/, ""),
  DATOS_PRUEBA: (e.DATOS_PRUEBA || "si") === "si"
};
