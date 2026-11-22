// Datos personales y notificaciones de quien tiene la sesión abierta.
const { consultar } = require("../configuracion/db");
const U = require("../utilidades");
module.exports = [
  U.ruta("GET", /^yo$/, [], ({ usuario }) => U.publico(usuario)),
  U.ruta("PATCH", /^yo$/, [], async ({ usuario, cuerpo }) => {
    if (cuerpo.nombre !== undefined) {
      const nombre = U.texto(cuerpo.nombre, 100); if (!nombre) throw U.error(400, "El nombre no puede ir vacío.");
      await consultar("UPDATE usuarios SET nombre = ? WHERE id = ?", [nombre, usuario.id]); usuario.nombre = nombre;
    }
    if (cuerpo.tel !== undefined) {
      const tel = U.digitos(cuerpo.tel); if (tel && tel.length < 10) throw U.error(400, "El teléfono debe tener al menos 10 dígitos.");
      await consultar("UPDATE usuarios SET telefono = ? WHERE id = ?", [tel, usuario.id]); usuario.telefono = tel;
    }
    if (cuerpo.nueva) {
      if (usuario.rol === "admin") throw U.error(400, "El administrador entra con código por correo, no usa contraseña.");
      if (String(cuerpo.nueva).length < 6) throw U.error(400, "La nueva contraseña debe tener mínimo 6 caracteres.");
      if (!(await U.verificar(String(cuerpo.actual || ""), usuario.contrasena))) throw U.error(400, "La contraseña actual no es correcta.");
      await consultar("UPDATE usuarios SET contrasena = ? WHERE id = ?", [await U.hash(String(cuerpo.nueva)), usuario.id]);
    }
    return U.publico(usuario);
  }),
  U.ruta("GET", /^notificaciones$/, [], ({ usuario }) => consultar("SELECT id, texto AS txt, creada AS fecha, leida FROM notificaciones WHERE usuario_id = ? ORDER BY id DESC LIMIT 30", [usuario.id])),
  U.ruta("POST", /^notificaciones\/leer$/, [], async ({ usuario }) => { await consultar("UPDATE notificaciones SET leida = 1 WHERE usuario_id = ?", [usuario.id]); return { ok: true }; })
];
