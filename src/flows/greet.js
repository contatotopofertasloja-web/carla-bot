// src/flows/greet.js
import { model } from '../model.js';

export async function greet({ text, context, prompts, productPrompt }) {
  const sys = prompts.persona + prompts.styleRules + productPrompt({ price: process.env.PRICE_TARGET || 170 });
  const user = (text || 'Oi').trim();

  const messages = [
    { role: 'system', content: sys },
    {
      role: 'user',
      content: `${user}

Contexto: lead vindo de anúncio/landing. Faça uma saudação curta, passe segurança e finalize com 1 pergunta objetiva.`,
    },
  ];

  return model.chat(messages, { maxTokens: 120, temperature: 0.7 });
}
