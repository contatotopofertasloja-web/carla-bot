// src/model.js
import OpenAI from 'openai';

const apiKey = (process.env.OPENAI_API_KEY || '').trim();
export const openai = new OpenAI({ apiKey });
const MODEL_NAME = process.env.MODEL_NAME || 'gpt-5-large';

export const model = {
  async chat(messages, { maxTokens = 300, temperature = 0.7, timeoutMs = 20000 } = {}) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const resp = await openai.chat.completions.create({
        model: MODEL_NAME,
        messages,
        temperature,
        max_tokens: maxTokens,
      }, { signal: controller.signal });

      return resp.choices?.[0]?.message?.content?.trim() || '';
    } finally {
      clearTimeout(id);
    }
  },
};
