/* MediTurno · interfaz (navegador). Todo lo importante se guarda en el servidor y la base de datos MySQL. */
const $ = s => document.querySelector(s);
const esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
// Para conectar la página a un servidor ya publicado en internet, escribe aquí su dirección. Ejemplo: "https://mediturno.miservidor.com"
const API_BASE = "";
const mem = {};
const alm = {
  get: k => { try { return localStorage.getItem(k); } catch { return mem[k] ?? null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { mem[k] = v; } }
};
let yo = JSON.parse(alm.get("yo") || "null"), token = alm.get("tk") || "", cfg = {}, doctores = [], citasCache = [];
const hoy = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const ini = n => esc(n.replace(/^Dra?\.\s*/, "").split(" ").map(p => p[0]).slice(0, 2).join(""));

// Envía una petición al servidor y devuelve la respuesta en JSON. Si falla, lanza un error con un mensaje claro.
async function api(ruta, metodo = "GET", datos) {
  let r;
  try { r = await fetch(API_BASE + "/api/" + ruta, {method: metodo, headers: {"Content-Type": "application/json", Authorization: "Bearer " + token}, body: datos ? JSON.stringify(datos) : undefined}); }
  catch { throw new Error("No se pudo conectar con el servidor. Revisa que esté encendido."); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || "Error del servidor"), {s: r.status});
  return j;
}
function toast(t) { const e = $("#toast"); e.textContent = t; e.hidden = false; setTimeout(() => e.hidden = true, 4500); }
function descargar(nombre, texto, tipo) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([texto], {type: tipo})); a.download = nombre; a.click(); }

/* ---------- Navegación según el rango ---------- */
const MENU = {
  paciente: [["inicio", "Inicio"], ["agenda", "Mis citas"], ["doctores", "Doctores"], ["cuenta", "Mi cuenta"]],
  doctor: [["inicio", "Inicio"], ["agenda", "Agenda"], ["horario", "Mi horario"], ["cuenta", "Mi cuenta"]],
  admin: [["inicio", "Inicio"], ["agenda", "Agenda"], ["doctores", "Doctores"], ["admin", "Administración"], ["cuenta", "Cuenta"]]
};
async function barra() {
  const n = yo ? (await api("notificaciones").catch(() => [])).filter(x => !x.leida).length : 0;
  $("#menu").innerHTML = yo ? MENU[yo.rol].map(([v, t]) => `<button data-ir="${v}">${t}${v === "cuenta" && n ? ` (${n})` : ""}</button>`).join("") + `<button data-a="salir">Salir</button>` : "";
  $("#menuBtn").hidden = !yo;
}
async function ir(v) {
  if (!yo) v = "acceso"; else if (!MENU[yo.rol].some(m => m[0] === v)) v = "inicio";
  document.querySelectorAll(".vista").forEach(s => s.hidden = s.id !== v);
  window.scrollTo(0, 0); $("#menu").classList.remove("abierto");
  try { await PINTAR[v]?.(); } catch (e) { if (e.s === 401) salir(); else alert(e.message); }
}
function setSesion(r) { yo = r.user; token = r.token; alm.set("yo", JSON.stringify(yo)); alm.set("tk", token); barra(); ir("inicio"); }
function salir() { yo = null; token = ""; alm.set("yo", ""); alm.set("tk", ""); barra(); ir("acceso"); }

/* ---------- Formularios y botones (se manejan por data-f y data-a) ---------- */
const val = f => Object.fromEntries([...f.elements].filter(x => x.name).map(x => [x.name, x.type === "checkbox" ? x.checked : x.value]));
const aviso = (f, t, ok) => { const m = f.querySelector(".msg"); if (m) { m.textContent = t; m.className = "msg " + (ok ? "ok" : "mal"); } };
const FORMS = {
  // Inicio de sesión. Paciente/doctor: correo + contraseña. Administrador: correo, se pide un código y se vuelve a presionar Entrar.
  async login(f, v) {
    if (v.acceso !== "admin") return setSesion(await api("login", "POST", {email: v.email, pass: v.pass}));
    if (!v.codigo) {
      await api("admin/codigo", "POST", {email: v.email});
      $("#lbCodigo").hidden = false; f.elements.codigo.required = true; $("#btnLogin").textContent = "Entrar como administrador";
      return aviso(f, "Si el correo es el del administrador, te enviamos un código de 6 dígitos. Escríbelo y presiona Entrar.", true);
    }
    setSesion(await api("admin/entrar", "POST", {email: v.email, codigo: v.codigo}));
  },
  // Registro de cuentas nuevas: paciente (entra de inmediato) o doctor (queda pendiente hasta que el administrador lo apruebe)
  async reg(f, v) {
    const r = await api("registro", "POST", v); f.reset(); ajustarReg();
    aviso(f, r.pendiente ? "Solicitud enviada. Podrás iniciar sesión cuando el administrador apruebe tu cuenta de doctor." : "Cuenta creada. Ya puedes iniciar sesión.", true);
  },
  async cita(f, v) { await api("citas", "POST", v); toast("Solicitud enviada. El doctor la revisará y te avisará."); await pintarAgenda(); },
  async perfil(f, v) { yo = await api("yo", "PATCH", {nombre: v.nombre, tel: v.tel}); alm.set("yo", JSON.stringify(yo)); toast("Datos guardados."); },
  async clave(f, v) { await api("yo", "PATCH", {actual: v.actual, nueva: v.nueva}); f.reset(); toast("Contraseña actualizada."); },
  async horario(f, v) {
    const dias = {}; for (let i = 0; i < 7; i++) dias[i] = {on: v["on" + i], ini: v["i" + i], fin: v["f" + i]};
    await api("agenda", "PUT", {dias, duracion: v.duracion, bloqueos: v.bloqueos}); toast("Agenda guardada.");
  },
  async config(f, v) { await api("admin/config", "PUT", v); cfg = await api("config"); toast("Datos de la clínica guardados."); },
  async altaDoc(f, v) { await api("admin/doctores", "POST", v); toast("Doctor dado de alta. Le llegó un correo con su acceso."); await pintarAdmin(); },
  async editDoc(f, v) { await api("admin/usuarios/" + f.dataset.id, "PATCH", {esp: v.esp, precio: v.precio}); toast("Doctor actualizado."); }
};
const ACC = {
  panel(b) {
    document.querySelectorAll(".panel").forEach(p => p.hidden = p.id !== "p-" + b.dataset.p);
    document.querySelectorAll(".tab").forEach(t => t.classList.toggle("act", t.dataset.p === b.dataset.p));
  },
  salir,
  async pedir(b) { await ir("agenda"); $("#cDoc").value = b.dataset.id; await horas(); },
  async est(b) {
    const e = b.dataset.e, id = b.dataset.id; let datos;
    if (e === "reprog") {
      const fecha = prompt("Nueva fecha (AAAA-MM-DD):"); if (!fecha) return;
      const {libres} = await api(`horas?docId=${citasCache.find(x => x.id == id).docId}&fecha=${fecha}`);
      if (!libres.length) return alert("Ese día no hay horarios libres.");
      const hora = prompt("Horas libres: " + libres.join(", ") + "\nEscribe una:"); if (!hora) return;
      datos = {fecha, hora};
    } else { if (e === "cancelada" && !confirm("¿Seguro que quieres cancelar esta cita?")) return; datos = {estado: e}; if (yo.rol !== "paciente") datos.nota = prompt("Nota para el paciente (opcional):") || ""; }
    await api("citas/" + id, "PATCH", datos); toast("Listo."); await pintarAgenda();
  },
  // DELETE: siempre pide confirmación antes de eliminar
  async borrar(b) {
    if (!confirm(b.dataset.msg || "¿Eliminar esta cita? Esta acción no se puede deshacer.")) return;
    await api(b.dataset.ruta, "DELETE"); toast("Registro eliminado.");
    if (b.dataset.vista === "admin") await pintarAdmin(); else await pintarAgenda();
  },
  async activo(b) { await api("admin/usuarios/" + b.dataset.id, "PATCH", {activo: b.dataset.v === "1"}); await pintarAdmin(); },
  async sol(b) { await api("admin/solicitudes/" + b.dataset.id, "PATCH", {aprobar: b.dataset.v === "1"}); toast("Listo."); await pintarAdmin(); },
  async csv() {
    const q = c => `"${String(c).replace(/"/g, '""')}"`;
    descargar("citas-mediturno.csv", "\ufeff" + ["Fecha,Hora,Doctor,Paciente,Motivo,Estado,Precio", ...(await api("citas")).map(c => [c.fecha, c.hora, c.docNombre, c.pacNombre, c.motivo, c.estado, c.precio].map(q).join(","))].join("\n"), "text/csv");
  },
  async respaldo() { descargar(`respaldo-mediturno-${hoy()}.json`, JSON.stringify(await api("admin/respaldo"), null, 1), "application/json"); },
  async leer() { await api("notificaciones/leer", "POST"); await pintarCuenta(); barra(); }
};
document.addEventListener("submit", async e => {
  const f = e.target, fn = FORMS[f.dataset?.f]; if (!fn) return;
  e.preventDefault();
  try { await fn(f, val(f)); } catch (x) { if (x.s === 401 && yo) salir(); else aviso(f, x.message, false); }
});
document.addEventListener("click", async e => {
  const b = e.target.closest("[data-ir],[data-a]"); if (!b) return;
  try { if (b.dataset.ir) { e.preventDefault(); await ir(b.dataset.ir); } else await ACC[b.dataset.a](b); }
  catch (x) { if (x.s === 401) salir(); else alert(x.message); }
});
// Muestra u oculta campos según el tipo de cuenta elegido
function ajustarLogin() {
  const f = $("#p-login"), admin = f.elements.acceso.value === "admin";
  $("#lbPass").hidden = admin; f.elements.pass.required = !admin;
  $("#lbCodigo").hidden = true; f.elements.codigo.required = false; f.elements.codigo.value = "";
  $("#btnLogin").textContent = admin ? "Enviarme un código" : "Entrar";
}
function ajustarReg() {
  const doctor = $("#p-reg").elements.tipo.value === "doctor";
  $("#lbEsp").hidden = !doctor; $("#notaDoc").hidden = !doctor; $("#p-reg").elements.esp.required = doctor;
}
document.addEventListener("change", e => {
  const t = e.target;
  if (t.id === "acceso-tipo") ajustarLogin();
  if (t.id === "tipoReg") ajustarReg();
  if (t.matches("#cDoc,#cFecha")) horas();
  if (t.id === "fEstado") $("#tablaCitas").innerHTML = tabla(citasCache);
  if (t.id === "bEsp") listarDoc();
});
document.addEventListener("input", e => { if (e.target.id === "bDoc") listarDoc(); });
$("#menuBtn").onclick = () => { const a = $("#menu").classList.toggle("abierto"); $("#menuBtn").setAttribute("aria-expanded", a); };

/* ---------- 2. Bienvenida ---------- */
function cifras(l, ing) {
  const v = l.filter(c => ["aprobada", "atendida"].includes(c.estado));
  return `<div class="cifras"><div><b>${l.length}</b>Citas</div><div><b>${l.filter(c => c.estado === "pendiente").length}</b>Pendientes</div><div><b>${l.filter(c => c.estado === "aprobada").length}</b>Aprobadas</div>${ing ? `<div><b>$${v.reduce((s, c) => s + c.precio, 0)}</b>Ingresos (MXN)</div>` : `<div><b>${l.filter(c => c.estado === "atendida").length}</b>Atendidas</div>`}</div>`;
}
const tarjetaDoc = (d, i) => `<article class="tarjeta c${i % 3}"><span class="avatar">${ini(d.nombre)}</span><h3>${esc(d.nombre)}</h3><p>${esc(d.esp)} · $${d.precio} MXN</p>${yo.rol === "paciente" ? `<button class="btn" data-a="pedir" data-id="${d.id}">Pedir cita</button>` : ""}</article>`;
async function pintarInicio() {
  const [citas, docs] = await Promise.all([api("citas"), api("doctores")]);
  const pend = citas.filter(c => c.estado === "pendiente").length, sols = yo.rol === "admin" ? (await api("admin/solicitudes")).length : 0;
  const prox = citas.filter(c => c.estado === "aprobada" && c.fecha >= hoy()).sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora))[0];
  const T = {
    paciente: [`Hola, ${yo.nombre}`, "¿Necesitas una consulta? Elige a tu doctor y pide tu cita en un minuto.", "agenda", "Pedir cita"],
    doctor: [`Buen día, ${yo.nombre}`, `Tienes ${pend} solicitud(es) por responder.`, "agenda", "Ver mi agenda"],
    admin: [`Panel de ${cfg.nombre || "MediTurno"}`, `${pend} cita(s) pendientes y ${sols} solicitud(es) de doctores por revisar.`, "admin", "Administración"]
  }[yo.rol];
  $("#heroI").innerHTML = `<div><span class="rol">${{paciente: "Paciente", doctor: "Doctor", admin: "Administrador"}[yo.rol]}</span><h1>${esc(T[0])}</h1><p>${esc(T[1])}</p><div class="acciones"><button class="btn claro" data-ir="${T[2]}">${T[3]}</button></div></div>
    <div class="ticket" aria-hidden="true">${yo.rol === "paciente" ? `<small>Tu próxima cita</small><strong>${prox ? prox.hora : "—"}</strong><span>${prox ? esc(prox.fecha + " · " + prox.docNombre) : "Aún no tienes citas aprobadas"}</span>` : `<small>Por responder</small><strong>${pend}</strong><span>solicitudes pendientes</span>`}</div>`;
  $("#cifrasI").innerHTML = cifras(citas, yo.rol === "admin");
  $("#destacados").innerHTML = docs.slice(0, 3).map(tarjetaDoc).join("");
  $("#contactoI").innerHTML = `<div><h3>Horario de consultas</h3><p>${esc(cfg.horario)}</p></div><div><h3>Ubicación</h3><p>${esc(cfg.direccion)}</p></div><div><h3>Contacto</h3><p>${esc(cfg.telefono)} ${esc(cfg.correo)}</p></div>`;
}

/* ---------- 3. Agenda de citas ---------- */
function formCita() {
  return `<form class="form" data-f="cita"><h3>Pedir una cita</h3><label>Doctor<select name="docId" id="cDoc">${doctores.map(d => `<option value="${d.id}">${esc(d.nombre)} · ${esc(d.esp)} · $${d.precio}</option>`).join("")}</select></label><label>Fecha<input type="date" name="fecha" id="cFecha" min="${hoy()}" required></label><label>Hora disponible<select name="hora" id="cHora" required></select></label><label>Teléfono (WhatsApp)<input name="tel" inputmode="numeric" value="${esc(yo.tel || "")}" required></label><label>Motivo<textarea name="motivo" rows="3" required></textarea></label><button class="btn">Enviar solicitud</button><p class="msg" role="status"></p></form>`;
}
async function horas() {
  const d = $("#cDoc").value, f = $("#cFecha").value;
  if (!f) { $("#cHora").innerHTML = "<option value=''>Primero elige una fecha</option>"; return; }
  const {libres} = await api(`horas?docId=${d}&fecha=${f}`);
  $("#cHora").innerHTML = libres.length ? libres.map(h => `<option>${h}</option>`).join("") : "<option value=''>Sin horarios este día</option>";
}
function acciones(c) {
  const b = (e, t, cl = "") => `<button class="btn ch ${cl}" data-a="est" data-e="${e}" data-id="${c.id}">${t}</button>`;
  const borrar = `<button class="btn ch no" data-a="borrar" data-ruta="citas/${c.id}" data-vista="agenda">Eliminar</button>`;
  if (yo.rol === "paciente") return ["pendiente", "aprobada"].includes(c.estado) ? b("reprog", "Reprogramar", "sec") + b("cancelada", "Cancelar", "no") : borrar;
  if (c.estado === "pendiente") return b("aprobada", "Aceptar") + b("rechazada", "Rechazar", "no") + (yo.rol === "admin" ? borrar : "");
  const wa = c.tel && c.estado !== "cancelada" ? `<a href="https://wa.me/52${c.tel}?text=${encodeURIComponent(`Hola ${c.pacNombre}, sobre tu cita del ${c.fecha} a las ${c.hora}: ${c.estado}.`)}" target="_blank" rel="noopener">WhatsApp</a>` : "";
  return (c.estado === "aprobada" ? b("atendida", "Atendida") + b("cancelada", "Cancelar", "no") : "") + wa + (yo.rol === "admin" ? borrar : "");
}
function tabla(lista) {
  const f = $("#fEstado") ? $("#fEstado").value : "";
  lista = lista.filter(c => !f || c.estado === f).sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
  if (!lista.length) return "<p>No hay citas para mostrar.</p>";
  return `<div class="envol"><table class="tabla"><thead><tr><th>Fecha</th><th>Doctor</th><th>Paciente</th><th>Motivo</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${lista.map(c => `<tr><td data-label="Fecha">${c.fecha}<br>${c.hora}</td><td data-label="Doctor">${esc(c.docNombre)}<br><small>${esc(c.esp)}</small></td><td data-label="Paciente">${esc(c.pacNombre)}</td><td data-label="Motivo">${esc(c.motivo)}</td><td data-label="Estado"><span class="est ${c.estado}">${c.estado}</span>${c.nota ? `<br><small>${esc(c.nota)}</small>` : ""}</td><td data-label="Acciones">${acciones(c)}</td></tr>`).join("")}</tbody></table></div>`;
}
async function pintarAgenda() {
  [citasCache, doctores] = await Promise.all([api("citas"), api("doctores")]);
  $("#agTitulo").textContent = {paciente: "Mis citas", doctor: "Mi agenda", admin: "Agenda de la clínica"}[yo.rol];
  $("#formCitaCont").innerHTML = yo.rol === "paciente" ? formCita() : "";
  if (yo.rol === "paciente") await horas();
  $("#filtroCont").innerHTML = `<label class="filtro">Mostrar <select id="fEstado"><option value="">Todas</option>${["pendiente", "aprobada", "rechazada", "cancelada", "atendida"].map(e => `<option>${e}</option>`).join("")}</select></label>`;
  $("#tablaCitas").innerHTML = tabla(citasCache);
}

/* ---------- 4. Doctores ---------- */
function listarDoc() {
  const q = ($("#bDoc").value || "").toLowerCase(), e = $("#bEsp").value;
  $("#listaDoc").innerHTML = doctores.filter(d => (!e || d.esp === e) && d.nombre.toLowerCase().includes(q)).map(tarjetaDoc).join("") || "<p>No hay doctores con ese filtro.</p>";
}
async function pintarDoctores() {
  doctores = await api("doctores");
  $("#filtroDoc").innerHTML = `<input id="bDoc" placeholder="Buscar doctor" aria-label="Buscar doctor"><select id="bEsp" aria-label="Especialidad"><option value="">Todas las especialidades</option>${[...new Set(doctores.map(d => d.esp))].map(e => `<option>${esc(e)}</option>`).join("")}</select>`;
  listarDoc();
}

/* ---------- 5. Mi horario (doctor) ---------- */
async function pintarHorario() {
  const a = await api("agenda");
  $("#horarioCont").innerHTML = `<form class="form" data-f="horario"><p>Marca los días que atiendes y su horario. Los pacientes solo verán las horas libres dentro de este horario.</p>${[1, 2, 3, 4, 5, 6, 0].map(i => `<div class="fila"><label><input type="checkbox" name="on${i}" ${a.dias[i].on ? "checked" : ""}> ${DIAS[i]}</label><input type="time" name="i${i}" value="${a.dias[i].ini}" aria-label="Inicio ${DIAS[i]}"><input type="time" name="f${i}" value="${a.dias[i].fin}" aria-label="Fin ${DIAS[i]}"></div>`).join("")}<label>Duración de cada consulta<select name="duracion">${[20, 30, 45, 60].map(m => `<option value="${m}" ${a.duracion === m ? "selected" : ""}>${m} minutos</option>`).join("")}</select></label><label>Días bloqueados (vacaciones, congreso…)<input name="bloqueos" value="${esc(a.bloqueos.join(", "))}" placeholder="2026-12-24, 2026-12-25"></label><button class="btn">Guardar horario</button><p class="msg" role="status"></p></form>`;
}

/* ---------- 6. Administración ---------- */
async function pintarAdmin() {
  const [citas, us, sols, c, bit] = await Promise.all([api("citas"), api("admin/usuarios"), api("admin/solicitudes"), api("config"), api("admin/bitacora")]);
  const fila = u => `<tr><td data-label="Nombre">${esc(u.nombre)}<br><small>${esc(u.email)}</small></td><td data-label="Rol">${u.rol}</td><td data-label="Estado">${u.activo ? "Activo" : "Inactivo"}</td><td data-label="Acciones">${u.rol === "doctor" ? `<form class="en-linea" data-f="editDoc" data-id="${u.id}"><input name="esp" value="${esc(u.esp)}" aria-label="Especialidad"><input name="precio" type="number" min="0" value="${u.precio}" aria-label="Precio"><button class="btn ch sec">Guardar</button></form>` : ""}${u.rol !== "admin" ? `<button class="btn ch ${u.activo ? "no" : ""}" data-a="activo" data-id="${u.id}" data-v="${u.activo ? 0 : 1}">${u.activo ? "Desactivar" : "Activar"}</button><button class="btn ch no" data-a="borrar" data-ruta="admin/usuarios/${u.id}" data-vista="admin" data-msg="¿Eliminar a ${esc(u.nombre)}? Esta acción no se puede deshacer.">Eliminar</button>` : ""}</td></tr>`;
  $("#adminCont").innerHTML = `${cifras(citas, true)}
  <h3>Solicitudes de doctores</h3>${sols.map(s => `<div class="aviso">${esc(s.nombre)} · ${esc(s.esp)} · ${esc(s.email)} <button class="btn ch" data-a="sol" data-id="${s.id}" data-v="1">Aprobar</button><button class="btn ch no" data-a="sol" data-id="${s.id}" data-v="0">Rechazar</button></div>`).join("") || "<p>No hay solicitudes pendientes. Cuando llegue una, también te llega a tu correo con enlaces para aprobarla.</p>"}
  <h3>Dar de alta a un doctor</h3><form class="form" data-f="altaDoc"><label>Nombre<input name="nombre" required></label><label>Especialidad<input name="esp" required></label><label>Precio de consulta<input name="precio" type="number" min="0" required></label><label>Correo del doctor (distinto al tuyo)<input type="email" name="email" required></label><label>Teléfono<input name="tel" inputmode="numeric"></label><button class="btn">Dar de alta</button><p class="msg" role="status"></p></form>
  <h3>Usuarios</h3><div class="envol"><table class="tabla"><thead><tr><th>Nombre</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${us.map(fila).join("")}</tbody></table></div>
  <h3>Datos de la clínica</h3><form class="form" data-f="config"><label>Nombre<input name="nombre" value="${esc(c.nombre)}"></label><label>Dirección<input name="direccion" value="${esc(c.direccion)}"></label><label>Teléfono<input name="telefono" value="${esc(c.telefono)}"></label><label>Correo de contacto<input name="correo" value="${esc(c.correo)}"></label><label>Horario<input name="horario" value="${esc(c.horario)}"></label><button class="btn">Guardar</button><p class="msg" role="status"></p></form>
  <h3>Reportes y respaldo</h3><button class="btn" data-a="csv">Descargar citas (Excel / CSV)</button><button class="btn sec" data-a="respaldo">Descargar respaldo de la base de datos</button>
  <h3>Bitácora</h3>${bit.slice(0, 25).map(b => `<div class="aviso">${esc(b.t)} · ${esc(b.quien)}: ${esc(b.txt)}</div>`).join("") || "<p>Sin movimientos todavía.</p>"}`;
}

/* ---------- 7. Mi cuenta ---------- */
async function pintarCuenta() {
  const ns = await api("notificaciones");
  $("#cuentaCont").innerHTML = `<div class="dos"><form class="form" data-f="perfil"><h3>Mis datos</h3><label>Nombre<input name="nombre" value="${esc(yo.nombre)}" required></label><label>Teléfono<input name="tel" value="${esc(yo.tel || "")}"></label><p>${esc(yo.email)} · ${yo.rol}</p><button class="btn">Guardar</button><p class="msg" role="status"></p></form>${yo.rol !== "admin" ? `<form class="form" data-f="clave"><h3>Cambiar contraseña</h3><label>Actual<input type="password" name="actual" required></label><label>Nueva (mínimo 6)<input type="password" name="nueva" minlength="6" required></label><button class="btn sec">Cambiar</button><p class="msg" role="status"></p></form>` : ""}</div>
  <h3>Notificaciones</h3>${ns.map(n => `<div class="aviso ${n.leida ? "" : "nueva"}">${esc(n.fecha)} · ${esc(n.txt)}</div>`).join("") || "<p>No tienes notificaciones.</p>"}<button class="btn sec" data-a="leer">Marcar como leídas</button>`;
}
const PINTAR = {inicio: pintarInicio, agenda: pintarAgenda, doctores: pintarDoctores, horario: pintarHorario, admin: pintarAdmin, cuenta: pintarCuenta};

/* ---------- Chatbot con IA (pasa por el servidor) ---------- */
const hist = [];
function burbuja(t, yoMsg) {
  const d = document.createElement("div"); d.className = "burbuja" + (yoMsg ? " yo" : ""); d.textContent = t;
  $("#chatLog").append(d); $("#chatLog").scrollTop = 1e6;
}
$("#chatAbrir").onclick = () => { $("#chat").hidden = !$("#chat").hidden; if (!$("#chatLog").children.length) burbuja("¡Hola! Soy el asistente de MediTurno. ¿En qué te ayudo?"); };
$("#chatCerrar").onclick = () => $("#chat").hidden = true;
$("#chatForm").onsubmit = async e => {
  e.preventDefault();
  const t = $("#chatTxt").value.trim(); if (!t) return;
  burbuja(t, true); $("#chatTxt").value = "";
  try {
    const {respuesta} = await api("chat", "POST", {mensaje: t, historial: hist});
    hist.push({role: "user", content: t}, {role: "assistant", content: respuesta}); burbuja(respuesta);
  } catch { burbuja("No pude conectar con el asistente. Revisa que el servidor siga encendido."); }
};

/* ---------- Arranque ---------- */
(async () => {
  try { cfg = await api("config"); } catch {}
  await barra(); ir("inicio");
})();
