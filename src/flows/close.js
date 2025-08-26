// src/flows/close.js — refinado: polimento + anti-duplicata + objeções + ofensa
import { model } from '../model.js';
import { logEvent } from '../telemetry.js';
import { getMemory, setMemory } from '../memory.js';
import { polishReply } from '../utils/polish.js';

const CHECKOUT_LINK =
  process.env.CHECKOUT_LINK ||
  'https://entrega.logzz.com.br/pay/memmpxgmg/progcreme170';

const COUPON_CODE = process.env.COUPON_CODE || 'TOP-AGO2025-PROGRVG-150';
const ANTI_DUP_TTL_MS = 2 * 60 * 1000; // 2 minutos

function oneQuestionOnly(answer = '') {
  const s = String(answer || '');
  const parts = s.split('?');
  if (parts.length <= 2) return s.trim();
  return (parts.slice(0, 2).join('?') + (s.endsWith('?') ? '?' : '')).trim();
}

// -- Detectores auxiliares ----------------------------------------------------
function detectComprovante(text = '') {
  return /(paguei|pago|comprovante|print|enviei.*comprovante|mandei.*comprovante)/i.test(
    (text || '').toLowerCase()
  );
}

function shouldOfferLink(text = '') {
  return /(comprar|adquirir|checkout|link|finalizar|fechar pedido|onde pago|como pago|quero pagar)/i.test(
    (text || '').toLowerCase()
  );
}

function isFidelidade(text = '') {
  return /(fidelidade|recompra|segunda compra|desconto futuro|cupom)/i.test(
    (text || '').toLowerCase()
  );
}

function isObjectionFunciona(text = '') {
  return /(será que funciona|sera que funciona|funciona mesmo|funciona\?|funcionar)/i.test(
    (text || '').toLowerCase()
  );
}

function isObjectionEstraga(text = '') {
  return /(estraga|danifica|cair.*cabelo|quebra.*cabelo|resseca)/i.test(
    (text || '').toLowerCase()
  );
}

function isObjectionAnvisa(text = '') {
  return /(anvisa|é autorizado|e autorizado|registro.*anvisa|liberado pela anvisa)/i.test(
    (text || '').toLowerCase()
  );
}

function isOffensive(text = '') {
  return /(vai se f|merda|porra|caralh|burra|idiot|otári|imbecil)/i.test((text || '').toLowerCase());
}

// -- Anti-duplicata (usa memory por usuário) ---------------------------------
async function filterDuplicateReply(userId, reply) {
  try {
    const mem = (await getMemory(userId)) || {};
    const now = Date.now();
    const last = mem.lastCloseReply || { text: '', at: 0 };
    if (reply && last.text === reply && now - (last.at || 0) < ANTI_DUP_TTL_MS) {
      // troca por uma variante curtinha para não repetir a mesma
      return null; // indica para gerar fallback variante
    }
    await setMemory(userId, { ...mem, lastCloseReply: { text: reply, at: now } });
  } catch {}
  return reply;
}

// -- Flow principal -----------------------------------------------------------
export async function closeDeal({ text, context, prompts, productPrompt, price = 170 }) {
  const user = (text || '').trim();
  const userId = (context && context.userId) || 'unknown';

  // 0) Linguagem ofensiva → encerra educadamente (sem venda)
  if (isOffensive(user)) {
    const reply =
      'Entendo que você possa estar chateada 💕. Se preferir, podemos encerrar por aqui. ' +
      'Se quiser falar sobre o produto em outro momento, estarei aqui pra te ajudar. Tudo bem?';
    logEvent({ userId, event: 'ofensa_detectada', payload: { preview: reply.slice(0, 120) } });
    return polishReply(reply, { closingHint: 'close' });
  }

  // 1) Pós-venda (comprovante)
  if (detectComprovante(user)) {
    const sys =
      prompts.persona +
      prompts.styleRules +
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
      reply =
        `Comprovante recebido ✅ Muito obrigada 💕 Seu pedido foi registrado. ` +
        `Aqui está seu cupom fidelidade: ${COUPON_CODE} (válido 3 meses). ` +
        `Quer que eu te avise quando sair para entrega?`;
    }

    logEvent({ userId, event: 'pos_pagamento_enviado', payload: { preview: reply.slice(0, 120) } });
    logEvent({ userId, event: 'cupom_liberado', payload: { cupom: COUPON_CODE } });

    const safe = await filterDuplicateReply(userId, reply);
    return polishReply(safe || 'Obrigada 💕 Seu pedido está confirmado. Quer que eu te avise quando sair para entrega?', {
      closingHint: 'postsale'
    });
  }

  // 2) Fidelidade / recompra — sem link
  if (isFidelidade(user)) {
    const reply = `Na sua recompra você ganha um cupom de R$150 💕 (código: ${COUPON_CODE}), válido por 3 meses.`;
    const safe = await filterDuplicateReply(userId, reply);
    return polishReply(safe || 'Na recompra, você tem um cupom de R$150 válido por 3 meses. Posso te avisar quando tivermos promoções?', {
      closingHint: 'close'
    });
  }

  // 3) Objeções (empatia + prova social), sem link
  if (isObjectionFunciona(user)) {
    const reply =
      'Eu entendo a sua dúvida 💕. Ele funciona sim: reduz o frizz e deixa o cabelo alinhado, com acabamento natural. ' +
      'Tenho vários feedbacks positivos de clientes que amaram o resultado. Quer que eu te conte como aplicar certinho?';
    const safe = await filterDuplicateReply(userId, reply);
    logEvent({ userId, event: 'objection_tratada', payload: { tipo: 'funciona' } });
    return polishReply(safe || reply, { closingHint: 'close' });
  }

  if (isObjectionEstraga(user)) {
    const reply =
      'Pode ficar tranquila 💕. A fórmula é sem formol e não resseca: o objetivo é alinhar e dar brilho mantendo o cabelo saudável. ' +
      'Se preferir, te passo o passo a passo para aplicar com segurança em casa. Quer?';
    const safe = await filterDuplicateReply(userId, reply);
    logEvent({ userId, event: 'objection_tratada', payload: { tipo: 'seguranca' } });
    return polishReply(safe || reply, { closingHint: 'close' });
  }

  if (isObjectionAnvisa(user)) {
    const reply =
      'Sim, trabalhamos com produtos liberados para comercialização no Brasil 💕. ' +
      'Se quiser, te envio o número de registro e as orientações de uso recomendadas. Quer conferir?';
    const safe = await filterDuplicateReply(userId, reply);
    logEvent({ userId, event: 'objection_tratada', payload: { tipo: 'anvisa' } });
    return polishReply(safe || reply, { closingHint: 'close' });
  }

  // 4) Fechamento informativo sem intenção de compra — sem link
  if (!shouldOfferLink(user)) {
    const reply =
      'Pode ficar tranquila 💕 O pagamento é só na entrega (COD) e a entrega leva até 24h em capitais ou 2 dias em outras cidades.';
    const safe = await filterDuplicateReply(userId, reply);
    return polishReply(safe || reply, { closingHint: 'close' });
  }

  // 5) Fechamento com intenção clara — COM link
  const sys =
    prompts.persona +
    prompts.styleRules +
    '\n[NUNCA REVELAR IDENTIDADE TÉCNICA]\n' +
    'Você é vendedora humana da TopOfertas Express.\n' +
    '[ETAPA 7 — FECHAMENTO]\n' +
    `Use o link oficial: ${CHECKOUT_LINK}\n` +
    'Mensagem curta: preço promocional, urgência, prazo e COD.\n' +
    'Máx. 2 frases + 1 pergunta.\n' +
    productPrompt({ price });

  const messages = [
    { role: 'system', content: sys },
    {
      role: 'user',
      content: `Mensagem: "${user}"\nMonte o FECHAMENTO com 2 frases + 1 pergunta. Inclua link ${CHECKOUT_LINK}.`
    }
  ];

  let reply = await model.chat(messages, { maxTokens: 160, temperature: 0.55 });
  reply = oneQuestionOnly(reply);

  if (!reply || reply.length < 20 || !reply.includes('http')) {
    reply =
      `Aproveite: de R$197 por R$${price}, com entrega rápida e pagamento só na entrega (COD). ` +
      `Link oficial: ${CHECKOUT_LINK} Quer garantir já pelo valor promocional?`;
  }

  logEvent({ userId, event: 'checkout_enviado', payload: { link: CHECKOUT_LINK } });

  const safe = await filterDuplicateReply(userId, reply);
  return polishReply(
    safe || `Aqui está o link oficial: ${CHECKOUT_LINK} Posso confirmar seu pedido pelo valor promocional?`,
    { closingHint: 'close' }
  );
}
