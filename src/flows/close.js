// src/flows/close.js — FSM: fechamento + pós-venda (cupom fidelidade)
import { model } from '../model.js';
import { logEvent } from '../telemetry.js';

const CHECKOUT_LINK =
  process.env.CHECKOUT_LINK ||
  'https://entrega.logzz.com.br/pay/memmpxgmg/progcreme170';

const COUPON_CODE =
  process.env.COUPON_CODE ||
  'TOP-AGO2025-PROGRVG-150';

// Garante no máximo 1 pergunta
function oneQuestionOnly(answer = '') {
  const s = String(answer);
  const parts = s.split('?');
  if (parts.length <= 2) return s.trim();
  return (parts.slice(0, 2).join('?') + (s.endsWith('?') ? '?' : '')).trim();
}

// Detecta se cliente falou de comprovante/pagamento feito
function detectComprovante(text = '') {
  const t = (text || '').toLowerCase();
  return /(paguei|pago|comprovante|print|enviei.*comprovante|mandei.*comprovante)/i.test(t);
}

export async function closeDeal({ text, context, prompts, productPrompt, price = 170 }) {
  const user = (text || '').trim();
  const userId = (context && context.userId) || 'unknown';

  // BRANCH 1 — Comprovante → Pós-venda
  if (detectComprovante(user)) {
    const sys =
      prompts.persona +
      prompts.styleRules +
      '\n[NUNCA REVELAR IDENTIDADE TÉCNICA]\n' +
      'Nunca diga que é IA. Aja sempre como vendedora humana da TopOfertas Express.\n' +
      '[ETAPA 8 — Pós-venda]\n' +
      `Confirme recebimento do print, agradeça e libere o cupom fidelidade de R$150 (código: ${COUPON_CODE}), válido por 3 meses.\n` +
      'Seja calorosa e finalize com um gesto de cuidado (ex.: “qualquer coisa, me chama aqui”).\n' +
      productPrompt({ price });

    const messages = [
      { role: 'system', content: sys },
      {
        role: 'user',
        content: `Mensagem do cliente: "${user}"\n
Responda confirmando o print, validando o pedido e liberando o cupom fidelidade.`
      }
    ];

    let reply = await model.chat(messages, { maxTokens: 160, temperature: 0.6 });
    reply = oneQuestionOnly(reply);

    // Telemetry pós
    logEvent({ userId, event: 'pos_pagamento_enviado', payload: { preview: reply.slice(0, 120) } });
    logEvent({ userId, event: 'cupom_liberado', payload: { cupom: COUPON_CODE } });

    return reply;
  }

  // BRANCH 2 — Fechamento normal
  const sys =
    prompts.persona +
    prompts.styleRules +
    '\n[NUNCA REVELAR IDENTIDADE TÉCNICA]\n' +
    'Nunca diga que é IA. Aja sempre como vendedora humana da TopOfertas Express.\n' +
    '[ETAPA 7 — Fechamento]\n' +
    `Use o link oficial: ${CHECKOUT_LINK}\n` +
    'Monte CTA persuasivo: preço promocional, urgência (estoque/lote), prazos (24h capitais / 2 dias demais), COD (pagamento só na entrega).\n' +
    'Finalize com apenas 1 pergunta curta.\n' +
    productPrompt({ price });

  const messages = [
    { role: 'system', content: sys },
    {
      role: 'user',
      content:
        `Mensagem do cliente: "${user}"\n` +
        `Monte 1 frase de fechamento com o link ${CHECKOUT_LINK}, urgência e COD.\n` +
        'Finalize com 1 pergunta objetiva.'
    }
  ];

  let reply = await model.chat(messages, { maxTokens: 160, temperature: 0.65 });
  reply = oneQuestionOnly(reply);

  // Telemetry fechamento
  logEvent({ userId, event: 'checkout_enviado', payload: { link: CHECKOUT_LINK } });

  return reply;
}
