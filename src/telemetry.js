// src/telemetry.js
import fs from "fs";
import path from "path";

const LOG_PATH = path.resolve(process.cwd(), "telemetry.log.json");

/**
 * Registra um evento de telemetria.
 * @param {Object} options
 * @param {string} options.userId - Identificação do usuário (ex: número de telefone).
 * @param {string} options.event - Nome do evento (ex: "abertura", "oferta", "checkout_enviado").
 * @param {Object} [options.payload] - Dados extras do evento (ex: texto enviado, etapa, produto).
 */
export function logEvent({ userId = "unknown", event, payload = {} }) {
  const entry = {
    ts: new Date().toISOString(),
    userId,
    event,
    payload
  };

  // 1) Mostra no console
  console.log("[TELEMETRY]", JSON.stringify(entry));

  // 2) Salva em arquivo local
  saveToFile(entry);
}

/**
 * Salva cada entrada em um arquivo JSON (append mode).
 */
function saveToFile(entry) {
  try {
    let current = [];
    if (fs.existsSync(LOG_PATH)) {
      const raw = fs.readFileSync(LOG_PATH, "utf-8");
      current = raw ? JSON.parse(raw) : [];
    }
    current.push(entry);
    fs.writeFileSync(LOG_PATH, JSON.stringify(current, null, 2));
  } catch (err) {
    console.error("[TELEMETRY][ERR]", err);
  }
}
