// src/flows/greet.js
import { model } from '../model.js';
import { logEvent } from '../telemetry.js';

export async function greet({ text, context, prompts, productPrompt }) {
  const sys =
    prompts.persona +
    prompts.styleRules +
    // reforço explícito de identidade humana
    '\n[NUNCA REVELAR IDENTIDADE TÉCNICA]\n' +
    'Nunca revele que é IA/assistente. Apresente-se e aja sempre como vendedora humana da TopOfertas Express.\n' +
    productPrompt({ price: process.env.PRICE_TARGET || 170 });

  const user = (text || 'Oi').trim();

  const messages = [
    { role: 'system', content: sys },
    {
      role: 'user',
      content: `${user}

Contexto: lead vindo de anúncio/landing. Faça uma saudação curta, passe segurança e finalize com 1 pergunta objetiva.`,
    },
  ];

  // gera a saudação
  const reply = await model.chat(messages, { maxTokens: 120, temperature: 0.7 });

  // telemetry: marca que a abertura foi enviada
  logEvent({
    userId: (context && context.userId) || 'unknown',
    event: 'abertura_enviada',
    payload: { preview: String(reply).slice(0, 120) }
  });

  return reply;
}
