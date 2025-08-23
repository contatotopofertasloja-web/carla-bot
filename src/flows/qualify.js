// src/flows/qualify.js
import { model } from '../model.js';

export async function qualify({ text, context, prompts, productPrompt }) {
  const sys = prompts.persona + prompts.styleRules + productPrompt({ price: process.env.PRICE_TARGET || 170 });

  const messages = [
    { role: 'system', content: sys },
    {
      role: 'user',
      content: `Mensagem do cliente: "${(text || '').trim()}"
Faça 1 ou 2 perguntas rápidas para entender tipo de cabelo/objetivo e forma de pagamento. Sem parecer interrogatório.`,
    },
  ];

  return model.chat(messages, { maxTokens: 180, temperature: 0.65 });
}
