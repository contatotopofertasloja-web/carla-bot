// src/bot.js — versão com detecção de objeções e fallback seguro (ESM)
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { getMemory, setMemory } from "./memory.js";
import prompts from "./prompts/base.js";              // adapter (default export)
import { productPrompt } from "./prompts/product.js";
import { greet } from "./flows/greet.js";
import { qualify } from "./flows/qualify.js";
import { offer } from "./flows/offer.js";
import { closeDeal } from "./flows/close.js";

// ===== Resolve paths (para ler JSON local mesmo em ESM) =====
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OBJECTIONS_PATH = path.join(__dirname, "prompts", "objections.json"); // opcional

// ===== Configs =====
const PRICE_TARGET = Number(process.env.PRICE_TARGET || 170);

// JSON carregado pelo adapter (pode ser null se estiver em fallback JS)
const CFG = prompts.__carla_json || null;

// Atalhos tolerantes para dados do produto/regras
const PRODUCT = CFG?.product || {};
const PRICE = PRODUCT?.price || {};
const RULES = CFG?.rules || {};
const MEDIA = RULES?.media || null;

// ===== Helpers =====
function pick(arr = []) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function textIndicaMidia(text = "") {
  // Heurística: usuário dizendo que mandou mídia
  const re =
    /(te?\s*(mandei|enviei)|segue|acabei de\s*(mandar|enviar)).*(foto|imagem|áudio|audio|vídeo|video|documento|arquivo)/i;
  return re.test(text);
}

function respostaMidia() {
  // Variantes padrão para quando o usuário manda mídia (e a “central não abre”)
  const variantsFromRules =
    typeof MEDIA === "string" ? [MEDIA] : MEDIA?.variants || null;

  const variants =
    variantsFromRules ||
    [
      "Amiga, minha central não abre áudio/foto 😅 me conta rapidinho por texto? Assim já te ajudo agora!",
      "Consigo te ajudar mais rápido por texto 💕 me resume aqui o que apareceu?"
    ];
  return pick(variants);
}

// Intent direta (resposta seca, sem puxar assunto)
function detectDirectIntent(text = "") {
  const t = text.toLowerCase();
  if (/(quantos?\s*ml|ml|quantidade)/i.test(t)) return "ml";
  if (/(sem\s*formol|formol)/i.test(t)) return "formol";
  if (/(quanto\s*custa|preço|valor)/i.test(t)) return "price";
  if (/(link|checkout|quero\s*comprar|onde\s*pago)/i.test(t)) return "checkout";
  if (/(foto|imagem|mostra|manda a foto)/i.test(t)) return "photo";
  return null;
}

function enforceSingleQuestion(answer = "") {
  const parts = answer.split("?");
  if (parts.length <= 2) return answer; // 0 ou 1 '?'
  return parts.slice(0, 2).join("?").trim(); // mantém só a 1ª pergunta
}

function directAnswer(intent) {
  if (!intent) return null;

  const vol = PRODUCT?.volume_ml ? `${PRODUCT.volume_ml}ml` : "500ml";
  const dur = PRODUCT?.duration_hint || "dura até 3 meses";
  const priceLabel = PRICE?.label || "R$170 com frete grátis";
  const checkoutUrl =
    PRICE?.checkout_url ||
    "https://entrega.logzz.com.br/pay/memmpxgmg/progcreme170";

  if (intent === "ml") return `${vol}, ${dur} 😉`;
  if (intent === "formol") return "Sim 🌿 fórmula vegetal, sem formol.";
  if (intent === "price") return `Hoje está por ${priceLabel} ✨`;
  if (intent === "checkout")
    return `Perfeito 🎉 aqui está o link oficial do checkout: ${checkoutUrl}`;
  if (intent === "photo")
    return `[ENVIAR_FOTO_PRODUTO:Essa é a Progressiva Vegetal Profissional 🌿 sem formol e com brilho de salão ✨]`;
  return null;
}

// Foto de abertura
function legendaFotoAbertura() {
  return pick([
    "Essa é a Progressiva Vegetal Profissional 🌿 sem formol e com brilho de salão ✨",
    "Olha a Progressiva Vegetal Profissional 🌿 quer que eu te explique rapidinho como funciona?"
  ]);
}
function comandoFotoAbertura() {
  const legenda = legendaFotoAbertura();
  return `[ENVIAR_FOTO_PRODUTO:${legenda}]`;
}

// ===== Objeções (detecção + respostas com fallback) =====
const DEFAULT_OBJECTIONS = {
  caro: [
    "Entendo totalmente! Mas pense que o tratamento dura até 3 meses, sai menos de R$2 por dia para manter o cabelo alinhado.",
    "Muita gente pensa no valor imediato, mas quando compara com salão, percebe que economiza bastante.",
    "Se colocar na ponta do lápis, você gasta mais em chapinha, produtos e tempo do que investindo nesse tratamento.",
    "E o melhor: você só paga quando receber, no pagamento na entrega, sem risco pra você.",
    "A vantagem é que você resolve de uma vez e não precisa se preocupar nos próximos meses."
  ],
  medo_estragar: [
    "Essa preocupação é super válida! Mas a Progressiva Vegetal é sem formol, totalmente segura para os fios.",
    "Diferente das químicas fortes, ela hidrata enquanto alinha, então o cabelo sai mais macio e saudável.",
    "O objetivo dela não é agredir, mas tratar e alinhar ao mesmo tempo.",
    "Muitas clientes que tiveram experiências ruins com outras progressivas se surpreendem com a leveza dessa.",
    "Pode ficar tranquila: não tem cheiro forte, não arde e não resseca o cabelo."
  ],
  nao_funcionou: [
    "Eu entendo sua frustração! A diferença dessa é que ela tem efeito real já na primeira aplicação.",
    "Outras progressivas usam química agressiva que só mascara o fio. Essa atua de forma natural e duradoura.",
    "Temos clientes que já tentaram várias e só aqui encontraram resultado de verdade.",
    "O efeito é comprovado e dura até 3 meses sem precisar de retoque constante.",
    "Você só precisa aplicar uma vez e já percebe o cabelo alinhado e sem frizz."
  ],
  tem_formol: [
    "Pode ficar tranquila: é 100% sem formol.",
    "Esse é justamente o diferencial: resultado profissional sem química agressiva.",
    "Não causa ardência, não tem cheiro forte e é seguro até para couro cabeludo sensível.",
    "Além de alinhar, hidrata e fortalece os fios.",
    "É por isso que chamamos de Premium: liso, natural e saudável."
  ],
  sem_tempo: [
    "A aplicação é super prática e rápida, sem precisar de salão.",
    "Depois de aplicar, você economiza horas toda semana sem precisar de chapinha.",
    "É só aplicar e pronto: você esquece a luta com o frizz por até 3 meses.",
    "O tempo que você investe uma vez compensa muito na rotina depois.",
    "Imagine acordar já com o cabelo alinhado, sem perder tempo arrumando."
  ],
  nao_confio: [
    "É normal ter essa dúvida, mas aqui você tem o pagamento na entrega: só paga quando receber.",
    "Você não precisa colocar cartão ou pagar antes, só recebe e aí sim paga.",
    "Isso garante que você não corre nenhum risco.",
    "Muita gente compra pela primeira vez assim e depois repete porque se sente segura.",
    "Além disso, você recebe o produto original, lacrado e com garantia."
  ]
};

function loadObjections() {
  try {
    if (fs.existsSync(OBJECTIONS_PATH)) {
      const raw = fs.readFileSync(OBJECTIONS_PATH, "utf-8");
      const json = JSON.parse(raw);
      // espera-se um shape { data: { caro: [...], medo_estragar: [...] } }
      return json.data || DEFAULT_OBJECTIONS;
    }
  } catch (e) {
    console.warn("[BOT] Falha ao ler objections.json, usando defaults:", e);
  }
  return DEFAULT_OBJECTIONS;
}
const OBJECTIONS = loadObjections();

function detectObjection(text = "") {
  const t = text.toLowerCase();
  if (/car[oa]|caríssimo|muito caro/.test(t)) return "caro";
  if (/medo|estragar|danificar|quebrar/.test(t)) return "medo_estragar";
  if (/(não|nao)\s*(funcionou|deu certo)/.test(t)) return "nao_funcionou";
  if (/formol/.test(t)) return "tem_formol";
  if (/tempo|sem tempo|correria|demorado/.test(t)) return "sem_tempo";
  if (/(não|nao)\s*confio|desconfiad[ao]/.test(t)) return "nao_confio";
  return null;
}
function answerObjection(kind) {
  const arr = OBJECTIONS?.[kind] || [];
  return arr.length ? pick(arr) : null;
}

// ===== BOT =====
export const bot = {
  async handleMessage({ userId = "unknown", text = "", context = {} }) {
    const mem = await getMemory(userId);
    const step = mem?.step || "greet";
    const jaEnviouFotoAbertura = Boolean(mem?.welcomed);

    let reply = "";
    let newStep = step;

    try {
      // 0) Política de mídia
      if (context?.hasMedia || textIndicaMidia(text)) {
        reply = respostaMidia();
        await setMemory(userId, {
          step,
          lastUserText: text,
          welcomed: jaEnviouFotoAbertura,
          updatedAt: Date.now()
        });
        return reply;
      }

      // 1) Intent direta (resposta seca/objetiva)
      const intent = detectDirectIntent(text);
      const direct = directAnswer(intent);
      if (direct) {
        let prefixoFoto = "";
        if (!jaEnviouFotoAbertura) prefixoFoto = comandoFotoAbertura() + "\n";
        const out = `${prefixoFoto}${direct}`.trim();

        await setMemory(userId, {
          step,
          lastUserText: text,
          welcomed: true,
          updatedAt: Date.now()
        });
        return out;
      }

      // 2) Objeções (ANTES do fluxo principal)
      const obj = detectObjection(text);
      if (obj) {
        const respostaObj = answerObjection(obj);
        if (respostaObj) {
          // Não avança etapa: trata a objeção e mantém step atual
          await setMemory(userId, {
            step,
            lastUserText: text,
            welcomed: jaEnviouFotoAbertura,
            updatedAt: Date.now()
          });
          return respostaObj;
        }
      }

      // 3) Fluxo principal por etapas
      if (step === "greet") {
        reply = await greet({ text, context, prompts, productPrompt });
        newStep = "qualify";
      } else if (step === "qualify") {
        reply = await qualify({ text, context, prompts, productPrompt });
        // avança só se detectar intenção mínima
        newStep = /sim|quero|interessad|como funciona|tem entrega/i.test(text)
          ? "offer"
          : "qualify";
      } else if (step === "offer") {
        reply = await offer({
          text,
          context,
          prompts,
          productPrompt,
          price: PRICE_TARGET
        });
        newStep = "close";
      } else {
        reply = await closeDeal({
          text,
          context,
          prompts,
          productPrompt,
          price: PRICE_TARGET
        });
        newStep = "close";
        reply = enforceSingleQuestion(reply);
      }

      // 4) Foto automática na 1ª resposta
      let prefixoFoto = "";
      if (!jaEnviouFotoAbertura) {
        prefixoFoto = comandoFotoAbertura() + "\n";
      }
      reply = `${prefixoFoto}${reply}`.trim();
    } catch (err) {
      console.error("[BOT][ERR]", err);
      reply =
        "Dei uma travadinha aqui. Quer que eu te passe o passo a passo rapidinho?";
    }

    // 5) Persistência de memória
    await setMemory(userId, {
      step: newStep,
      lastUserText: text,
      welcomed: true,
      updatedAt: Date.now()
    });

    return reply;
  }
};
