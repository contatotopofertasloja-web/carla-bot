// src/bot.js — FSM completo + ajustes finos (nome, objeções vagas, sem link indevido)
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

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const OBJECTIONS_PATH = path.join(__dirname, "prompts", "objections.json");

const PRICE_TARGET = Number(process.env.PRICE_TARGET || 170);

const STATES = {
  GREET:  "greet",
  QUALIFY:"qualify",
  DOR:    "dor",
  OFFER:  "offer",
  CLOSE:  "close",
  POS:    "pos"
};

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

// Intenções diretas
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

// Objeções
const DEFAULT_OBJECTIONS = {
  caro: ["Entendo! Mas dura até 3 meses — sai menos de R$2/dia ✨","Você só paga quando receber (COD), sem risco 😉"],
  medo_estragar: ["Essa é sem formol 🌿 trata enquanto alinha — segura pro fio.","Pode ficar tranquila: não resseca e não tem cheiro forte."],
  nao_confio: ["Pagamento só na entrega 🚚💵 sem risco nenhum.","Você recebe o produto primeiro e só então paga, combinado?"]
};
function loadObjections() {
  try {
    if (fs.existsSync(OBJECTIONS_PATH)) {
      const raw  = fs.readFileSync(OBJECTIONS_PATH, "utf-8");
      const json = JSON.parse(raw);
      return json.data || DEFAULT_OBJECTIONS;
    }
  } catch {}
  return DEFAULT_OBJECTIONS;
}
const OBJECTIONS = loadObjections();

function detectObjection(text = "") {
  const t = text.toLowerCase();
  if (/car[oa]|caríssimo|muito caro/.test(t)) return "caro";
  if (/medo|estragar|danificar|quebrar/.test(t)) return "medo_estragar";
  if (/(não|nao)\s*confio|golpe|desconfiad[ao]/.test(t)) return "nao_confio";
  if (/não sei|nao sei|será que|sera que|tenho dúvida|tenho duvida/.test(t)) return "nao_confio"; // 👈 dúvidas vagas
  return null;
}
function answerObjection(kind) {
  return pick(OBJECTIONS[kind] || []);
}

function detectComprovante(text = "") {
  const t = (text || "").toLowerCase();
  return /(paguei|pago|comprovante|print|enviei.*comprovante|mandei.*comprovante)/i.test(t);
}
function detectHairType(text = "") {
  const m = String(text || "").toLowerCase().match(/liso|ondulad[oa]?|cachead[oa]?|cresp[oa]?/i);
  return m ? m[0] : null;
}

// Captura de nome
function detectNameCandidate(text = "") {
  const t = String(text || "").trim();
  if (!t) return null;
  const m1 = t.match(/meu\s+nome\s+é\s+([A-Za-zÀ-ÿ\s]+)/i);
  if (m1 && m1[1]) return capitalize(m1[1].trim());
  if (/^sou\s+[A-Za-zÀ-ÿ]+/i.test(t)) return capitalize(t.split(/\s+/)[1]);
  if (/^[A-ZÀ-Ý][a-zà-ÿ]+$/.test(t)) return capitalize(t);
  return null;
}
function capitalize(s = "") { return s ? s[0].toUpperCase() + s.slice(1) : s; }

export const bot = {
  async handleMessage({ userId = "unknown", text = "", context = {} }) {
    const mem = await getMemory(userId);
    let state = mem?.state || STATES.GREET;
    const jaEnviouFotoAbertura = Boolean(mem?.welcomed);

    const hairTypeDetected = detectHairType(text);
    if (hairTypeDetected) await setMemory(userId, { ...(mem || {}), hairType: hairTypeDetected });

    const nameCandidate = detectNameCandidate(text);
    if (nameCandidate && (!mem?.name || mem?.askedName)) {
      await setMemory(userId, { ...(mem || {}), name: nameCandidate, askedName: false });
    }

    let reply = "";

    try {
      // 0) Mídia
      if (context?.hasMedia || textIndicaMidia(text)) {
        reply = respostaMidia();
        await setMemory(userId, { state, lastUserText: text, welcomed: jaEnviouFotoAbertura });
        return reply;
      }

      // 1) Pergunta direta sobre nome
      if (/qual.*meu.*nome|lembra.*meu.*nome/i.test(text)) {
        if (mem?.name) return `Claro que lembro 💕 Seu nome é ${mem.name}!`;
        return "Ainda não me contou seu nome 💕 qual é?";
      }

      // 2) Intenções diretas
      const intent = detectDirectIntent(text);
      const direct = directAnswer(intent);
      if (direct) {
        const prefix = !jaEnviouFotoAbertura ? "[ENVIAR_FOTO_PRODUTO:Essa é a Progressiva Vegetal 🌿 ✨]\n" : "";
        const out = (prefix + direct).trim();
        await setMemory(userId, { state, lastUserText: text, welcomed: true });
        return out;
      }

      // 3) Objeções
      const obj = detectObjection(text);
      if (obj) {
        const ans = answerObjection(obj);
        await setMemory(userId, { state, lastUserText: text, welcomed: jaEnviouFotoAbertura });
        return ans;
      }

      // 4) Comprovante → pós-venda
      if (detectComprovante(text)) {
        reply = await postSale({ text, context: { ...(context||{}), userId }, prompts, productPrompt, price: PRICE_TARGET });
        state = STATES.POS;
        await setMemory(userId, { state, lastUserText: text, welcomed: true });
        return reply;
      }

      // 5) FSM
      if (state === STATES.GREET) {
        reply = await greet({ text, context, prompts, productPrompt });
        state = STATES.QUALIFY;
      }
      else if (state === STATES.QUALIFY) {
        if (hairTypeDetected) {
          const nome = (mem?.name || nameCandidate) ? `${mem?.name || nameCandidate}, ` : "";
          reply = `${nome}me conta: qual a maior dificuldade que ele te dá? Frizz, volume ou alinhamento?`;
          state = STATES.DOR;
        } else {
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
        state = STATES.CLOSE;
      }
      else if (state === STATES.POS) {
        reply = await postSale({ text, context: { ...(context||{}), userId }, prompts, productPrompt, price: PRICE_TARGET });
        state = STATES.POS;
      }

      if (!jaEnviouFotoAbertura && state !== STATES.GREET) {
        reply = "[ENVIAR_FOTO_PRODUTO:Essa é a Progressiva Vegetal 🌿 ✨]\n" + String(reply || "");
      }

    } catch (err) {
      console.error("[BOT][ERR]", err);
      reply = "Dei uma travadinha aqui, pode repetir? 💕";
    }

    await setMemory(userId, {
      ...(await getMemory(userId)),
      state,
      lastUserText: text,
      welcomed: true
    });

    return String(reply || "").trim();
  }
};
