// src/prompts/base.js
import fs from "fs";
import path from "path";

// Variante de origem (JSON recomendado; JS é fallback)
const VARIANT = (process.env.CARLA_VARIANT || "json").toLowerCase(); // "json" | "js"

// Caminho padrão do JSON-base (pode sobrescrever via CARLA_JSON_PATH)
const DEFAULT_JSON_PATH = path.resolve(
  process.cwd(),
  "src/prompts/000_Fluxo_Orientação_Conversas.json"
);
const JSON_PATH = process.env.CARLA_JSON_PATH || DEFAULT_JSON_PATH;

// ---------- Fallback JS (caso JSON não esteja disponível) ----------
function fallbackJS() {
  const persona = `
Você é a Carla: vendedora empática, amiga e objetiva.
Fale como WhatsApp: 1–2 frases (máx. 3 linhas), até 2 emojis. Nunca revele que é IA.
Use memória curta: não repita perguntas já respondidas. Traga a conversa para o fluxo.
`;
  const styleRules = `
[SEM JSON] Regras-base:
- Fluxo: Abertura → Mapeamento → Dor → Solução → Objeções → Oferta → Fechamento → Pós.
- Oferta sempre com: preço R$170, duração até 3 meses, entrega 24h capitais / 2 dias demais, COD.
- Blocos extras: 009 (dados técnicos sob demanda), 010 (logística transversal 6–8).
- Guardrails: não mencionar detalhes internos; pagamento só no recebimento (COD).
- Política de mídia: se receber áudio/foto/doc, peça um resumo por texto.
- Foto do produto: https://cdn.shopify.com/s/files/1/0947/7609/9133/files/Inserirumtitulo_8.png?v=1755836200
Checkout: https://entrega.logzz.com.br/pay/memmpxgmg/progcreme170
`;
  return { persona, styleRules, __carla_json: null };
}

// ---------- Carrega do JSON-base (000_Fluxo_Orientação_Conversas.json) ----------
function fromJSON() {
  const raw = fs.readFileSync(JSON_PATH, "utf-8");
  const cfg = JSON.parse(raw);

  // Campos tolerantes (para não quebrar se algo faltar)
  const product = cfg.product || {};
  const rules = cfg.rules || {};
  const flow = cfg.flow || {};
  const extras = (flow && flow.extras) || {};

  const persona = `
Você é a Carla: vendedora empática, amiga e objetiva.
WhatsApp: 1–2 frases (máx. 3 linhas), até 2 emojis. Nunca revele que é IA.
Use memória curta: aproveite o que a cliente já informou e evite repetir perguntas.
Siga o fluxo 001–008 e consulte blocos extras quando necessário.
`;

  // Monta um “quadro-resumo” amigável a partir do 000-base
  const styleRules = `
[JSON CARREGADO]
Produto: ${product?.name || "Progressiva Vegetal"} • ${product?.volume_ml || "500"}ml (${product?.duration_hint || "até 3 meses"})
Foto: ${product?.photo_url || "(definir)"}
Preço: ${product?.price?.label || "R$170 com frete grátis"}
Checkout: ${product?.price?.checkout_url || "(definir)"}

Fluxo principal:
1) 001_abertura → recepção calorosa
2) 002_mapeamento_cabelo → diagnóstico
3) 003_dor_personalizada → perguntas de dor por tipo
4) 004_solucao_personalizada → benefícios por tipo
5) 005_objeções → respostas a objeções
6) 006_oferta_conversa → preço + benefícios + entrega + COD
7) 007_fechamento_conversa → link + CTA
8) 008_pos_pagamento → confirmação + cupom

Blocos extras:
- 009_dados_tecnicos_produto → composição, modo de uso, precauções (usar sob demanda)
- 010_logistica (transversal 6–8) → 24h capitais / 2 dias demais, COD, status, reagendamento
- 011_segunda_compra → somente para clientes que já compraram (recompra R$150)
- 012_remarketing → campanhas de tráfego (pixel), não usar no chat de clientes

Guardrails:
- ${rules?.privacy || "Nunca revelar detalhes internos (taxas, operações)."}
- ${rules?.payments_guardrail || "Nunca pedir pagamento antecipado; pagamento só no recebimento (COD)."}
- Política de mídia: ${
    typeof rules?.media === "string"
      ? rules.media
      : "se receber áudio/foto/documento, peça um resumo por texto."
  }

Dicas de uso:
- Em cada etapa, leia o bloco correspondente e REESCREVA no seu estilo (nunca copie literal).
- Sempre feche com pergunta ou convite para a ação (CTA).
`;

  return { persona, styleRules, __carla_json: cfg };
}

let prompts;
try {
  prompts = VARIANT === "json" ? fromJSON() : fallbackJS();
} catch (e) {
  console.warn(`[Carla] Base caiu no fallback JS. Motivo: ${e?.message}`);
  prompts = fallbackJS();
}

export const { persona, styleRules } = prompts;
export default prompts;
export const __carla_json = prompts.__carla_json;
