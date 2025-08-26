 // funil-reader.js
import fs from "fs";

// caminho do arquivo de log gerado pelo telemetry.js
const LOG_FILE = "./telemetry.log.json";

// eventos do funil em ordem
const FUNIL = [
  "session_start",
  "abertura_enviada",
  "mapeamento_pergunta_enviada",
  "dor_pergunta_enviada",
  "oferta_mostrada",
  "checkout_enviado",
  "pos_pagamento_enviado",
  "cupom_liberado"
];

// lê e parseia o arquivo de log
function loadLogs() {
  if (!fs.existsSync(LOG_FILE)) {
    console.error(`Arquivo ${LOG_FILE} não encontrado!`);
    process.exit(1);
  }
  const content = fs.readFileSync(LOG_FILE, "utf-8").trim();
  if (!content) return [];
  return content
    .split("\n")
    .map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

// agrupa por dia
function groupByDay(logs) {
  const days = {};
  for (const log of logs) {
    const d = new Date(log.timestamp || Date.now());
    const day = d.toISOString().split("T")[0];
    if (!days[day]) days[day] = [];
    days[day].push(log);
  }
  return days;
}

// gera resumo do funil
function resumoFunil(logs) {
  const resumo = {};
  for (const step of FUNIL) resumo[step] = 0;
  for (const log of logs) {
    if (FUNIL.includes(log.event)) {
      resumo[log.event]++;
    }
  }
  return resumo;
}

// calcula taxas de conversão entre etapas
function calcTaxas(resumo) {
  const taxas = {};
  for (let i = 0; i < FUNIL.length - 1; i++) {
    const atual = FUNIL[i];
    const prox = FUNIL[i + 1];
    const base = resumo[atual] || 0;
    const avancou = resumo[prox] || 0;
    taxas[`${atual} → ${prox}`] = base
      ? ((avancou / base) * 100).toFixed(1) + "%"
      : "-";
  }
  return taxas;
}

// --- execução ---
const logs = loadLogs();
const dias = groupByDay(logs);

for (const [dia, registros] of Object.entries(dias)) {
  console.log(`\n📅 Dia: ${dia}`);
  const resumo = resumoFunil(registros);
  console.table(resumo);
  console.table(calcTaxas(resumo));
}

// top objeções se tiverem payload.objection
const objeções = {};
for (const log of logs) {
  if (log.payload && log.payload.objection) {
    const o = log.payload.objection;
    objeções[o] = (objeções[o] || 0) + 1;
  }
}
if (Object.keys(objeções).length) {
  console.log("\n🚧 Top objeções detectadas:");
  console.table(objeções);
}

