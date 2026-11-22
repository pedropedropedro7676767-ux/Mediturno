// Funciones exclusivas del administrador (el rango más alto).
const { consultar } = require("../configuracion/db");
const U = require("../utilidades");
const { altaDoctor, resolverSolicitud } = require("../servicios/acciones");
const SOLO_ADMIN = ["admin"];
module.exports = [
  U.ruta("PUT", /^admin\/config$/, SOLO_ADMIN, async ({ usuario, cuerpo }) => {
    for (const clave of ["nombre", "direccion", "telefono", "correo", "horario"])
      if (cuerpo[clave] !== undefined) await consultar("UPDATE config SET valor = ? WHERE clave = ?", [U.texto(cuerpo[clave], 200), clave]);
    await U.bitacora(usuario.nombre, "Editó los datos de la clínica");
    return U.configuracion();
  }),
  // READ: todos los usuarios con sus datos de doctor
  U.ruta("GET", /^admin\/usuarios$/, SOLO_ADMIN, () => consultar("SELECT u.id, u.rol, u.nombre, u.email, u.telefono AS tel, u.activo, d.especialidad AS esp, d.precio FROM usuarios u LEFT JOIN doctores d ON d.usuario_id = u.id ORDER BY u.rol, u.nombre")),
  // UPDATE: activar/desactivar y editar especialidad y precio
  U.ruta("PATCH", /^admin\/usuarios\/(\d+)$/, SOLO_ADMIN, async ({ usuario, cuerpo, partes }) => {
    const [x] = await consultar("SELECT * FROM usuarios WHERE id = ? AND rol <> 'admin'", [+partes[1]]);
    if (!x) throw U.error(404, "Usuario no encontrado.");
    if (cuerpo.activo !== undefined) await consultar("UPDATE usuarios SET activo = ? WHERE id = ?", [cuerpo.activo ? 1 : 0, x.id]);
    if (x.rol === "doctor") {
      const esp = U.texto(cuerpo.esp, 80), precio = Number(cuerpo.precio);
      if (esp) await consultar("UPDATE doctores SET especialidad = ? WHERE usuario_id = ?", [esp, x.id]);
      if (cuerpo.precio !== undefined) {
        if (!Number.isInteger(precio) || precio < 0) throw U.error(400, "El precio debe ser un número entero mayor o igual a 0.");
        await consultar("UPDATE doctores SET precio = ? WHERE usuario_id = ?", [precio, x.id]);
      }
    }
    await U.bitacora(usuario.nombre, `Editó a ${x.nombre}`);
    return { ok: true };
  }),
  // DELETE: si el usuario ya tiene citas, MySQL lo impide (llave foránea) y se sugiere desactivarlo
  U.ruta("DELETE", /^admin\/usuarios\/(\d+)$/, SOLO_ADMIN, async ({ usuario, partes }) => {
    const [x] = await consultar("SELECT * FROM usuarios WHERE id = ? AND rol <> 'admin'", [+partes[1]]);
    if (!x) throw U.error(404, "Usuario no encontrado.");
    try { await consultar("DELETE FROM usuarios WHERE id = ?", [x.id]); }
    catch (e) { if (U.esReferenciado(e)) throw U.error(409, "No se puede eliminar: tiene citas registradas. Mejor desactívalo."); throw e; }
    await U.bitacora(usuario.nombre, `Eliminó a ${x.nombre}`);
    return { ok: true };
  }),
  // CREATE: alta directa de un doctor
  U.ruta("POST", /^admin\/doctores$/, SOLO_ADMIN, async ({ usuario, cuerpo }) => {
    const nombre = U.texto(cuerpo.nombre, 100), esp = U.texto(cuerpo.esp, 80), email = U.correo(cuerpo.email), precio = Number(cuerpo.precio);
    if (!nombre || !esp || !email || !Number.isInteger(precio) || precio < 0) throw U.error(400, "Revisa los datos del doctor (el precio debe ser un número entero).");
    const [existe] = await consultar("SELECT id FROM usuarios WHERE email = ?", [email]);
    if (existe) throw U.error(400, "Ese correo ya existe (el doctor debe tener un correo distinto al del administrador).");
    await altaDoctor({ nombre, email, esp, telefono: U.digitos(cuerpo.tel), precio });
    await U.bitacora(usuario.nombre, `Dio de alta a ${nombre}`);
    return { ok: true };
  }),
  U.ruta("GET", /^admin\/solicitudes$/, SOLO_ADMIN, () => consultar("SELECT id, nombre, email, especialidad AS esp, telefono AS tel FROM solicitudes_doctor WHERE estado = 'pendiente'")),
  U.ruta("PATCH", /^admin\/solicitudes\/(\d+)$/, SOLO_ADMIN, async ({ usuario, cuerpo, partes }) => { await resolverSolicitud(+partes[1], !!cuerpo.aprobar, usuario.nombre); return { ok: true }; }),
  U.ruta("GET", /^admin\/bitacora$/, SOLO_ADMIN, () => consultar("SELECT quien, texto AS txt, fecha AS t FROM bitacora ORDER BY id DESC LIMIT 50")),
  // Respaldo: copia de las tablas principales (sin contraseñas)
  U.ruta("GET", /^admin\/respaldo$/, SOLO_ADMIN, async () => ({
    usuarios: await consultar("SELECT id, rol, nombre, email, telefono, activo, creado FROM usuarios"),
    doctores: await consultar("SELECT * FROM doctores"), citas: await consultar("SELECT * FROM citas"),
    solicitudes_doctor: await consultar("SELECT * FROM solicitudes_doctor"), config: await consultar("SELECT * FROM config")
  }))
];
