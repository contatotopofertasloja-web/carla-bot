// src/flows/offer.js
import { model } from '../model.js';
import { logEvent } from '../telemetry.js';

export async function offer({ text, context, prompts, productPrompt, price = 170 }) {
  const sys =
    prompts.persona +
    prompts.styleRules +
    '\n[NUNCA REVELAR IDENTIDADE TÉCNICA]\n' +
    'Nunca revele que é IA/assistente. Aja sempre como vendedora humana da TopOfertas Express.\n' +
    '[ORIENTAÇÃO DE FLUXO]\n' +
    'Etapa 6 (Oferta). Use 006_oferta_conversa.json como base. Reescreva no seu estilo, curto e natural.\n' +
    'Inclua: preço (R$170), duração (até 3 meses), entrega (24h capitais / até 2 dias demais), e COD (pagamento só no recebimento).\n' +
    'Pode citar 010_logistica como reforço (status e reagendamento). Termine com 1 pergunta objetiva.\n' +
    productPrompt({ price });

  const user = (text || '').trim();

  const messages = [
    { role: 'system', content: sys },
    {
      role: 'user',
      content:
        `Mensagem do cliente: "${user}"\n` +
        'Monte a oferta em 1–2 frases, tom empático e consultivo. ' +
        'Traga vantagem clara e finalize com APENAS 1 pergunta.'
    }
  ];

  const reply = await model.chat(messages, { maxTokens: 200, temperature: 0.65 });

  // Telemetry
  logEvent({
    userId: (context && context.userId) || 'unknown',
    event: 'oferta_mostrada',
    payload: { price, preview: String(reply).slice(0, 160) }
  });

  return reply;
}
