// src/flows/close.js
import { model } from '../model.js';

export async function closeDeal({ text, context, prompts, productPrompt, price }) {
  const link = context?.checkoutUrl || 'https://exemplo.com/pedido';
  const sys = prompts.persona + prompts.styleRules + productPrompt({ price });

  const messages = [
    { role: 'system', content: sys },
    {
      role: 'user',
      content: `Finalize com naturalidade e incentive o fechamento.
Se houver objeção, responda curto, traga benefício prático e reforço de confiança.
Se perguntarem diretamente, você pode mencionar que usa o produto (Carla morena de cabelos lisos).
Inclua o link de pedido: ${link} e 1 CTA curto.`,
    },
  ];

  return model.chat(messages, { maxTokens: 180, temperature: 0.65 });
}
