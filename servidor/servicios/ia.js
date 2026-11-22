// Chatbot con IA (API de Claude). Devuelve null si no hay llave o si falla, para usar el asistente básico.
const { ANTHROPIC_API_KEY, MODELO } = require("../configuracion/entorno");
async function preguntarIA(sistema, mensaje, historial) {
  if (!ANTHROPIC_API_KEY) return null;
  const previos = (Array.isArray(historial) ? historial : [])
    .filter(x => x && ["user", "assistant"].includes(x.role) && typeof x.content === "string").slice(-8);
  while (previos.length && previos[0].role !== "user") previos.shift();   // la conversación debe empezar con "user"
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST",
      headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODELO, max_tokens: 400, system: sistema, messages: [...previos, { role: "user", content: mensaje }] }) });
    return (await r.json()).content?.[0]?.text || null;
  } catch { return null; }
}
module.exports = { preguntarIA };
