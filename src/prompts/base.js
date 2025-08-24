// src/prompts/base.js
import fs from "fs";
import path from "path";

const VARIANT = (process.env.CARLA_VARIANT || "json").toLowerCase(); // "json" | "js"
const DEFAULT_JSON_PATH = path.resolve(process.cwd(), "src/prompts/carla.unificado.json");
const JSON_PATH = process.env.CARLA_JSON_PATH || DEFAULT_JSON_PATH;

// --- fallback JS simples (caso JSON não esteja disponível) ---
function fallbackJS() {
  const persona = `
Você é a Carla: simpática, empática e objetiva.
Fale como amiga no WhatsApp (1–2 frases, máx. 3 linhas, até 2 emojis).
Nunca revele que é IA. Use memória curta: não repita perguntas já respondidas.
Responda exatamente o que for perguntado; só fale de preço/entrega se pedirem.
Envie checkout apenas com intenção clara de compra:
https://entrega.logzz.com.br/pay/memmpxgmg/progcreme170
`;
  const styleRules = `
- Respostas objetivas (ml, formol, preço) → só isso + 1 detalhe curto.
- Não empurrar pagamento/parcelamento/checkout sem ser perguntado.
- Foto do produto: se pedirem, responda apenas com [ENVIAR_FOTO_PRODUTO].
- Política de mídia: se receber áudio/foto/vídeo/doc, diga que está na central e peça resumo por texto.
Foto: https://cdn.shopify.com/s/files/1/0947/7609/9133/files/Inserirumtitulo_8.png?v=1755836200
`;
  return { persona, styleRules, __carla_json: null };
}

// --- carrega do JSON ---
function fromJSON() {
  const raw = fs.readFileSync(JSON_PATH, "utf-8"); // pode lançar ENOENT
  const cfg = JSON.parse(raw);

  const persona = `
Você é a Carla: vendedora empática, amiga e objetiva.
WhatsApp: 1–2 frases (máx. 3 linhas), até 2 emojis. Nunca revele que é IA.
Memória curta: use dados já informados, não repita perguntas.
Responda exatamente o que foi perguntado. Checkout só quando pedirem.
`;

  const styleRules = `
[JSON CARREGADO]
Produto: ${cfg.product.name} • ${cfg.product.volume_ml}ml (${cfg.product.duration_hint})
Foto: ${cfg.product.photo_url}
Preço: ${cfg.product.price.label}
Checkout: ${cfg.product.price.checkout_url}

Políticas:
- ${cfg.policies.answer_policy}
- ${cfg.policies.checkout_policy}
- ${cfg.policies.photo_policy}
- Mídia: ${cfg.policies.media_limitations.rule}

Diretas:
- ml → "${cfg.intents.direct_answers.ml}"
- formol → "${cfg.intents.direct_answers.formol}"
- preço → "${cfg.intents.direct_answers.price}"

Intenções:
- checkout triggers: ${cfg.intents.checkout.trigger_phrases.join(", ")}
- photo triggers: ${cfg.intents.photo.trigger_phrases.join(", ")}
- comando foto: ${cfg.intents.photo.response}
`;

  return { persona, styleRules, __carla_json: cfg };
}

let prompts;
try {
  prompts = (VARIANT === "json") ? fromJSON() : fallbackJS();
} catch (e) {
  console.warn(`[Carla] Falling back to JS. Motivo: ${e?.message}`);
  prompts = fallbackJS();
}

export const { persona, styleRules } = prompts;
export default prompts;
export const __carla_json = prompts.__carla_json;
