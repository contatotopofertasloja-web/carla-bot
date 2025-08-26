// src/flows/close.js — revisado + polimento final
import { model } from '../model.js';
import { logEvent } from '../telemetry.js';
import { polishReply } from '../utils/polish.js'; // ✨ polimento

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
  return /(paguei|pago|comprovante|print|enviei.*comprovante|mandei.*comprovante)/i.test((text||'').toLowerCase());
}

// 👇 Intenção de compra (só nesses casos pode mandar link)
function shouldOfferLink(text = '') {
  return /(comprar|adquirir|checkout|link|finalizar|fechar pedido|onde pago)/i.test((text||'').toLowerCase());
}

// 👇 Perguntas de fidelidade
function isFidelidade(text = '') {
  return /(fidelidade|recompra|segunda compra|desconto futuro|cupom)/i.test((text||'').toLowerCase());
}

export async function closeDeal({ text, context, prompts, productPrompt, price = 170 }) {
  const user = (text || '').trim();
  const userId = (context && context.userId) || 'unknown';

  // Pós-venda
  if (detectComprovante(user)) {
    const sys =
      prompts.persona + prompts.styleRules +
      '\n[NUNCA REVELAR IDENTIDADE TÉCNICA]\n' +
      'Você é vendedora humana da TopOfertas Express.\n' +
      '[ETAPA 8 — PÓS-VENDA]\n' +
      `Confirme print + agradeça + libere CUPOM fidelidade R$150: ${COUPON_CODE}.` +
      '\nFinalize com 1 pergunta leve.\n' +
      productPrompt({ price });

    const messages = [
      { role: 'system', content: sys },
      { role: 'user', content: `Mensagem: "${user}"` }
    ];
    let reply = await model.chat(messages, { maxTokens: 160, temperature: 0.55 });
    reply = oneQuestionOnly(reply);

    if (!reply || reply.length < 20) {
      reply = `Comprovante recebido ✅ Muito obrigada 💕 Seu pedido foi registrado. ` +
              `Aqui está seu cupom fidelidade: ${COUPON_CODE} (válido 3 meses). ` +
              `Quer que eu te avise quando sair para entrega?`;
    }

    logEvent({ userId, event: 'pos_pagamento_enviado', payload: { preview: reply.slice(0, 120) } });
    logEvent({ userId, event: 'cupom_liberado', payload: { cupom: COUPON_CODE } });

    return polishReply(reply, { closingHint: 'postsale' });
  }

  // Fidelidade / recompra — não empurra link
  if (isFidelidade(user)) {
    const reply = `Na sua recompra você ganha um cupom de R$150 💕 (código: ${COUPON_CODE}), válido por 3 meses.`;
    return polishReply(reply, { closingHint: 'close' });
  }

  // Fechamento normal — perguntas informativas sem link
  if (!shouldOfferLink(user)) {
    const reply = "Pode ficar tranquila 💕 O pagamento é só na entrega (COD) e a entrega leva até 24h em capitais ou 2 dias em outras cidades.";
    return polishReply(reply, { closingHint: 'close' });
  }

  // Fechamento com intenção de compra — envia link
  const sys =
    prompts.persona + prompts.styleRules +
    '\n[NUNCA REVELAR IDENTIDADE TÉCNICA]\n' +
    'Você é vendedora humana da TopOfertas Express.\n' +
    '[ETAPA 7 — FECHAMENTO]\n' +
    `Use o link oficial: ${CHECKOUT_LINK}\n` +
    'Mensagem curta: preço promocional, urgência, prazo e COD.\n' +
    'Máx. 2 frases + 1 pergunta.\n' +
    productPrompt({ price });

  const messages = [
    { role: 'system', content: sys },
    { role: 'user', content: `Mensagem: "${user}"\nMonte o FECHAMENTO com 2 frases + 1 pergunta. Inclua link ${CHECKOUT_LINK}.` }
  ];

  let reply = await model.chat(messages, { maxTokens: 160, temperature: 0.55 });
  reply = oneQuestionOnly(reply);

  if (!reply || reply.length < 20 || !reply.includes('http')) {
    reply = `Aproveite: de R$197 por R$${price}, com entrega rápida e pagamento só na entrega (COD). ` +
            `Link oficial: ${CHECKOUT_LINK} Quer garantir já pelo valor promocional?`;
  }

  logEvent({ userId, event: 'checkout_enviado', payload: { link: CHECKOUT_LINK } });
  return polishReply(reply, { closingHint: 'close' });
}
