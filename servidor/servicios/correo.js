// Envío de correos con Resend. Sin llave, el correo se muestra en la terminal (modo prueba).
const { RESEND_API_KEY, CORREO_DE } = require("../configuracion/entorno");
async function enviarCorreo(para, asunto, texto) {
  if (!RESEND_API_KEY || !para) return console.log(`\n[correo simulado] Para: ${para}\nAsunto: ${asunto}\n${texto}\n`);
  try {
    const r = await fetch("https://api.resend.com/emails", { method: "POST",
      headers: { Authorization: "Bearer " + RESEND_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ from: CORREO_DE, to: [para], subject: asunto, text: texto }) });
    if (!r.ok) console.log("Resend respondió:", r.status, await r.text());
  } catch (e) { console.log("No se pudo enviar el correo:", e.message); }
}
module.exports = { enviarCorreo };
