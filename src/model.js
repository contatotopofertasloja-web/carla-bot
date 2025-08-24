// src/model.js
import OpenAI from 'openai';

// --- Chave da OpenAI ---
const apiKey = (process.env.OPENAI_API_KEY || '').trim();
export const openai = new OpenAI({ apiKey });

// --- Resolver nome do modelo (com anti-mini) ---
function resolveModelName() {
  const raw =
    (process.env.MODEL_NAME ||
     process.env.OPENAI_MODEL ||
     process.env.CHAT_MODEL ||
     '').trim();

  // Se vier vazio ou explicitamente mini, força gpt-4o
  if (!raw || raw === 'gpt-4o-mini') return 'gpt-4o';

  return raw;
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
