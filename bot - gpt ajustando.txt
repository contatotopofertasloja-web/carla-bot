// src/bot.js — FSM completo + captura automática de NOME
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { getMemory, setMemory } from "./memory.js";
import prompts from "./prompts/base.js";
import { productPrompt } from "./prompts/product.js";

import { greet } from "./flows/greet.js";
import { qualify } from "./flows/qualify.js";
import { offer } from "./flows/offer.js";
import { closeDeal } from "./flows/close.js";
import { postSale } from "./flows/postsale.js";

// ===== Resolve paths =====
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const OBJECTIONS_PATH = path.join(__dirname, "prompts", "objections.json"); // opcional

// ===== Configs =====
const PRICE_TARGET = Number(process.env.PRICE_TARGET || 170);

// ===== Estados do funil =====
const STATES = {
  GREET:  "greet",   // abertura
  QUALIFY:"qualify", // mapeamento do cabelo
  DOR:    "dor",     // exploração da dor
  OFFER:  "offer",   // apresentação de oferta
  CLOSE:  "close",   // fechamento com link
  POS:    "pos"      // pós-venda (comprovante/cupom)
};

// ===== Helpers =====
function pick(arr = []) { return arr[Math.floor(Math.random() * arr.length)]; }

function textIndicaMidia(text = "") {
  return /(foto|imagem|áudio|audio|vídeo|video|documento|arquivo)/i.test(text);
}
function respostaMidia() {
  return pick([
    "Amiga, minha central não abre áudio/foto 😅 me conta rapidinho por texto? Assim já te ajudo agora!",
    "Consigo te ajudar mais rápido por texto 💕 me resume aqui o que apareceu?"
  ]);
}

// Intenções diretas (perguntas secas)
function detectDirectIntent(text = "") {
  const t = text.toLowerCase();
  if (/(quantos?\s*ml|ml|quantidade)/i.test(t)) return "ml";
  if (/(sem\s*formol|formol)/i.test(t))         return "formol";
  if (/(quanto\s*custa|preço|valor)/i.test(t))  return "price";
  if (/(link|checkout|quero\s*comprar|onde\s*pago)/i.test(t)) return "checkout";
  if (/(foto|imagem|mostra|manda a foto)/i.test(t)) return "photo";
  return null;
}
function directAnswer(intent) {
  if (!intent) return null;
  if (intent === "ml")      return "500ml, dura até 3 meses 😉";
  if (intent === "formol")  return "Zero formol 🌿 seguro e natural.";
  if (intent === "price")   return "De R$197 por R$170 ✨ pagamento só na entrega (COD).";
  if (intent === "checkout")return "Perfeito 🎉 aqui está o link oficial: https://entrega.logzz.com.br/pay/memmpxgmg/progcreme170";
  if (intent === "photo")   return "[ENVIAR_FOTO_PRODUTO:Essa é a Progressiva Vegetal 🌿 sem formol e com brilho de salão ✨]";
  return null;
}

// Objeções — load opcional de arquivo + fallback
const DEFAULT_OBJECTIONS = {
  caro: [
    "Entendo! Mas dura até 3 meses — sai menos de R$2/dia ✨",
    "Você só paga quando receber (COD), sem risco 😉"
  ],
  medo_estragar: [
    "Essa é sem formol 🌿 trata enquanto alinha — segura pro fio.",
    "Pode ficar tranquila: não resseca e não tem cheiro forte."
  ],
  nao_confio: [
    "Pagamento só na entrega 🚚💵 sem risco nenhum.",
    "Você recebe o produto primeiro e só então paga, combinado?"
  ]
};
function loadObjections() {
  try {
    if (fs.existsSync(OBJECTIONS_PATH)) {
      const raw  = fs.readFileSync(OBJECTIONS_PATH, "utf-8");
      const json = JSON.parse(raw);
      return json.data || DEFAULT_OBJECTIONS;
    }
  } catch { /* ignore e usa default */ }
  return DEFAULT_OBJECTIONS;
}
const OBJECTIONS = loadObjections();

function detectObjection(text = "") {
  const t = text.toLowerCase();
  if (/car[oa]|caríssimo|muito caro/.test(t)) return "caro";
  if (/medo|estragar|danificar|quebrar/.test(t)) return "medo_estragar";
  if (/(não|nao)\s*confio|golpe|desconfiad[ao]/.test(t)) return "nao_confio";
  return null;
}
function answerObjection(kind) {
  return pick(OBJECTIONS[kind] || []);
}

// Comprovante → pós-venda
function detectComprovante(text = "") {
  const t = (text || "").toLowerCase();
  return /(paguei|pago|comprovante|print|enviei.*comprovante|mandei.*comprovante|enviei.*print|mandei.*print)/i.test(t);
}

// Detecta tipo de cabelo (para memória curta)
function detectHairType(text = "") {
  const m = String(text || "").toLowerCase().match(/liso|ondulad[oa]?|cachead[oa]?|cresp[oa]?/i);
  return m ? m[0] : null;
}

// === Captura automática de NOME ===
// Regras simples para PT-BR: "meu nome é X", "sou X", ou um nome curto (1–3 palavras, sem números/links)
function detectNameCandidate(text = "") {
  const t = String(text || "").trim();
  if (!t) return null;

  // Padrões explícitos
  const m1 = t.match(/meu\s+nome\s+é\s+([A-Za-zÀ-ÿ'´`^~\-]+\s?[A-Za-zÀ-ÿ'´`^~\-]*)/i);
  if (m1 && m1[1]) return sanitizeName(m1[1]);

  const m2 = t.match(/eu\s*me\s*chamo\s+([A-Za-zÀ-ÿ'´`^~\-]+\s?[A-Za-zÀ-ÿ'´`^~\-]*)/i);
  if (m2 && m2[1]) return sanitizeName(m2[1]);

  const m3 = t.match(/^(sou|meu\s+apelido\s+é)\s+([A-Za-zÀ-ÿ'´`^~\-]+\s?[A-Za-zÀ-ÿ'´`^~\-]*)$/i);
  if (m3 && m3[2]) return sanitizeName(m3[2]);

  // Heurística: mensagem curta de 1–3 palavras, sem dígitos/URL, com inicial maiúscula
  if (!/https?:\/\//i.test(t) && !/\d/.test(t)) {
    const words = t.split(/\s+/).filter(Boolean);
    if (words.length >= 1 && words.length <= 3) {
      const looksName = words.every(w => /^[A-Za-zÀ-ÿ'´`^~\-]+$/.test(w)) && /^[A-ZÀ-Ý]/.test(words[0]);
      if (looksName) return sanitizeName(words.map(capitalize).join(" "));
    }
  }

  return null;
}
function sanitizeName(n) {
  return String(n || "")
    .replace(/[^A-Za-zÀ-ÿ'´`^~\-\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map(capitalize)
    .join(" ");
}
function capitalize(s = "") { return s ? s[0].toUpperCase() + s.slice(1) : s; }

// ===== BOT (FSM) =====
export const bot = {
  async handleMessage({ userId = "unknown", text = "", context = {} }) {
    const mem = await getMemory(userId);
    let state = mem?.state || STATES.GREET;
    const jaEnviouFotoAbertura = Boolean(mem?.welcomed);

    // Persistir hairType rapidamente se aparecer
    const hairTypeDetected = detectHairType(text);
    if (hairTypeDetected) {
      await setMemory(userId, { ...(mem || {}), hairType: hairTypeDetected });
    }

    // Captura automática de nome (se a abertura pediu nome ou ainda não temos)
    const nameCandidate = detectNameCandidate(text);
    if (nameCandidate && (!mem?.name || mem?.askedName)) {
      await setMemory(userId, { ...(mem || {}), name: nameCandidate, askedName: false, updatedAt: Date.now() });
    }

    let reply = "";

    try {
      // 0) Mídia
      if (context?.hasMedia || textIndicaMidia(text)) {
        reply = respostaMidia();
        await setMemory(userId, { state, lastUserText: text, welcomed: jaEnviouFotoAbertura, updatedAt: Date.now() });
        return reply;
      }

      // 1) Intenções diretas (respostas secas)
      const intent = detectDirectIntent(text);
      const direct = directAnswer(intent);
      if (direct) {
        const prefix = !jaEnviouFotoAbertura ? "[ENVIAR_FOTO_PRODUTO:Essa é a Progressiva Vegetal 🌿 ✨]\n" : "";
        const out = (prefix + direct).trim();
        await setMemory(userId, { state, lastUserText: text, welcomed: true, updatedAt: Date.now() });
        return out;
      }

      // 2) Objeções (tratadas antes de avançar no funil)
      const obj = detectObjection(text);
      if (obj) {
        const ans = answerObjection(obj);
        await setMemory(userId, { state, lastUserText: text, welcomed: jaEnviouFotoAbertura, updatedAt: Date.now() });
        return ans;
      }

      // 3) Comprovante → vai direto para pós-venda (POS)
      if (detectComprovante(text)) {
        reply = await postSale({ text, context: { ...(context||{}), userId }, prompts, productPrompt, price: PRICE_TARGET });
        state = STATES.POS;
        await setMemory(userId, { state, lastUserText: text, welcomed: true, updatedAt: Date.now() });
        return reply;
      }

      // 4) FSM: fluxo por estado
      if (state === STATES.GREET) {
        reply = await greet({ text, context, prompts, productPrompt });
        state = STATES.QUALIFY;
      }
      else if (state === STATES.QUALIFY) {
        // Se já detectou tipo de cabelo, avança e pergunta de dor diretamente
        if (hairTypeDetected || /liso|ondulad|cachead|cresp/i.test(text)) {
          const nome = (mem?.name || nameCandidate) ? `${mem?.name || nameCandidate}, ` : "";
          reply = `${nome}me conta: qual a maior dificuldade que ele te dá? Frizz, volume ou alinhamento?`;
          state = STATES.DOR;
        } else {
          // Ainda não temos tipo — usa flow pra perguntar uma única vez
          reply = await qualify({ text, context, prompts, productPrompt });
          state = STATES.QUALIFY;
        }
      }
      else if (state === STATES.DOR) {
        reply = await offer({ text, context, prompts, productPrompt, price: PRICE_TARGET });
        state = STATES.OFFER;
      }
      else if (state === STATES.OFFER) {
        reply = await offer({ text, context, prompts, productPrompt, price: PRICE_TARGET });
        state = STATES.CLOSE;
      }
      else if (state === STATES.CLOSE) {
        reply = await closeDeal({ text, context, prompts, productPrompt, price: PRICE_TARGET });
        state = STATES.CLOSE; // fica em CLOSE até detectar comprovante
      }
      else if (state === STATES.POS) {
        reply = await postSale({ text, context: { ...(context||{}), userId }, prompts, productPrompt, price: PRICE_TARGET });
        state = STATES.POS;
      }

      // 5) Foto automática na primeira resposta
      if (!jaEnviouFotoAbertura && state !== STATES.GREET) {
        reply = "[ENVIAR_FOTO_PRODUTO:Essa é a Progressiva Vegetal 🌿 ✨]\n" + String(reply || "");
      }

    } catch (err) {
      console.error("[BOT][ERR]", err);
      reply = "Dei uma travadinha aqui, pode repetir? 💕";
    }

    // 6) Persistência
    await setMemory(userId, {
      ...(await getMemory(userId)), // garante merge
      state,
      lastUserText: text,
      welcomed: true,
      updatedAt: Date.now()
    });

    return String(reply || "").trim();
  }
};
