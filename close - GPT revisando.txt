// src/flows/close.js — revisado: fechamento persuasivo + pós-venda (cupom)
import { model } from '../model.js';
import { logEvent } from '../telemetry.js';

const CHECKOUT_LINK =
  process.env.CHECKOUT_LINK ||
  'https://entrega.logzz.com.br/pay/memmpxgmg/progcreme170';

const COUPON_CODE =
  process.env.COUPON_CODE ||
  'TOP-AGO2025-PROGRVG-150';

function oneQuestionOnly(answer = '') {
  const s = String(answer || '');
  const parts = s.split('?');
  if (parts.length <= 2) return s.trim();
  return (parts.slice(0, 2).join('?') + (s.endsWith('?') ? '?' : '')).trim();
}

function detectComprovante(text = '') {
  const t = (text || '').toLowerCase();
  return /(paguei|pago|comprovante|print|enviei.*comprovante|mandei.*comprovante)/i.test(t);
}

export async function closeDeal({ text, context, prompts, productPrompt, price = 170 }) {
  const user = (text || '').trim();
  const userId = (context && context.userId) || 'unknown';

  // Pós-venda: cliente mandou comprovante
  if (detectComprovante(user)) {
    const sys =
      prompts.persona +
      prompts.styleRules +
      '\n[NUNCA REVELAR IDENTIDADE TÉCNICA]\n' +
      'Você é vendedora humana da TopOfertas Express.\n' +
      '[ETAPA 8 — PÓS-VENDA]\n' +
      '- Confirme recebimento do print.\n' +
      '- Agradeça calorosamente.\n' +
      `- Libere CUPOM fidelidade: ${COUPON_CODE}, válido 3 meses.\n` +
      '- Termine com 1 pergunta leve.\n' +
      productPrompt({ price });

    const messages = [
      { role: 'system', content: sys },
      { role: 'user', content: `Mensagem: "${user}"` }
    ];

    let reply = await model.chat(messages, { maxTokens: 160, temperature: 0.55 });
    reply = oneQuestionOnly(reply);

    if (!reply || reply.length < 20) {
      reply = `Comprovante recebido ✅ Muito obrigada 💕 Seu pedido já foi registrado. ` +
              `Aqui está seu cupom fidelidade de R$150: ${COUPON_CODE} (válido por 3 meses). ` +
              `Quer que eu te avise quando o pedido sair para entrega?`;
    }

    logEvent({ userId, event: 'pos_pagamento_enviado', payload: { preview: reply.slice(0, 120) } });
    logEvent({ userId, event: 'cupom_liberado', payload: { cupom: COUPON_CODE } });

    return reply;
  }

  // Fechamento normal
  const sys =
    prompts.persona +
    prompts.styleRules +
    '\n[NUNCA REVELAR IDENTIDADE TÉCNICA]\n' +
    'Você é vendedora humana da TopOfertas Express.\n' +
    '[ETAPA 7 — FECHAMENTO]\n' +
    `Use o link oficial: ${CHECKOUT_LINK}\n` +
    'Monte mensagem persuasiva: preço promocional, urgência (estoque), prazo (24h capitais / 2 dias demais) e COD.\n' +
    'No máximo 2 frases + 1 pergunta.\n' +
    productPrompt({ price });

  const messages = [
    { role: 'system', content: sys },
    { role: 'user', content: `Mensagem: "${user}"\nMonte o FECHAMENTO com 2 frases + 1 pergunta. Inclua link ${CHECKOUT_LINK}.` }
  ];

  let reply = await model.chat(messages, { maxTokens: 160, temperature: 0.55 });
  reply = oneQuestionOnly(reply);

  if (!reply || reply.length < 20 || !reply.includes('http')) {
    reply =
      `Pra você aproveitar: de R$197 por R$${price}, com entrega rápida e pagamento só na entrega (COD). ` +
      `Link oficial: ${CHECKOUT_LINK} Quer garantir já pelo valor promocional?`;
  }

  logEvent({ userId, event: 'checkout_enviado', payload: { link: CHECKOUT_LINK } });

  return reply;
}
