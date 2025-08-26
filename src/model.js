// src/model.js
import OpenAI from 'openai';

// --- Chave da OpenAI ---
const apiKey = (process.env.OPENAI_API_KEY || '').trim();
export const openai = new OpenAI({ apiKey });

// --- Resolve o nome do modelo (SEM anti-mini) ---
function resolveModelName() {
  // Prioridade de variáveis (a primeira definida vence)
  const raw =
    (process.env.MODEL_NAME ||
      process.env.OPENAI_MODEL ||
      process.env.CHAT_MODEL ||
      '').trim();

  // Padrão seguro se nada vier
  if (!raw) return 'gpt-4o-mini';

  // Normalização básica de aliases
  const name = raw.toLowerCase();
  const aliases = {
    mini: 'gpt-4o-mini',
    'gpt4o-mini': 'gpt-4o-mini',
    'gpt4o': 'gpt-4o',
    'gpt-4': 'gpt-4o',
  };

  return aliases[name] || name;
}

export const EFFECTIVE_MODEL = resolveModelName();

// --- Cliente de chat ---
export const model = {
  async chat(
    messages,
    { maxTokens = 300, temperature = 0.7, timeoutMs = 20000 } = {}
  ) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const resp = await openai.chat.completions.create(
        {
          model: EFFECTIVE_MODEL,
          messages,
          temperature,
          max_tokens: maxTokens,
        },
        { signal: controller.signal }
      );
      return resp.choices?.[0]?.message?.content?.trim() || '';
    } finally {
      clearTimeout(id);
    }
  },
};
