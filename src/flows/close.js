// src/flows/close.js — versão completão refinada
import { model } from '../model.js';
import { logEvent } from '../telemetry.js';
import { getMemory, setMemory } from '../memory.js';
import { polishReply, getRandomClosingQuestion } from '../utils/polish.js';

const CHECKOUT_LINK = process.env.CHECKOUT_LINK || 'https://entrega.logzz.com.br/pay/memmpxgmg/progcreme170';
const COUPON_CODE   = process.env.COUPON_CODE   || 'TOP-AGO2025-PROGRVG-150';
const ANTI_DUP_TTL_MS = 2 * 60 * 1000;

// ----------------- Helpers -----------------
function oneQuestionOnly(answer = '') {
  const s = String(answer || '');
  const parts = s.split('?');
  if (parts.length <= 2) return s.trim();
  return (parts.slice(0, 2).join('?') + (s.endsWith('?') ? '?' : '')).trim();
}

async function filterDuplicateReply(userId, reply) {
  try {
    const mem = (await getMemory(userId)) || {};
    const now = Date.now();
    const last = mem.lastCloseReply || { text: '', at: 0 };
    if (reply && last.text === reply && now - (last.at || 0) < ANTI_DUP_TTL_MS) {
      return null;
    }
    await setMemory(userId, { ...mem, lastCloseReply: { text: reply, at: now } });
  } catch {}
  return reply;
}

// ----------------- Detectores -----------------
function detectComprovante(t = '') { return /(paguei|pago|comprovante|print|enviei|mandei.*comprovante)/i.test(t.toLowerCase()); }
function shouldOfferLink(t = '')   { return /(comprar|adquirir|checkout|link|finalizar|fechar pedido|onde pago|como pago|quero pagar|preço|valor|quanto custa)/i.test(t.toLowerCase()); }
function isFidelidade(t = '')      { return /(fidelidade|recompra|segunda compra|desconto futuro|cupom)/i.test(t.toLowerCase()); }
function isObjectionFunciona(t=''){ return /(funciona|funcionar)/i.test(t.toLowerCase()); }
function isObjectionEstraga(t='') { return /(estraga|danifica|cair.*cabelo|quebra.*cabelo|resseca)/i.test(t.toLowerCase()); }
function isObjectionAnvisa(t='')  { return /(anvisa|autorizado|registro.*anvisa|liberado)/i.test(t.toLowerCase()); }
function isOffensive(t='')        { return /(vai se f|merda|porra|caralh|burra|idiot|otári|imbecil)/i.test(t.toLowerCase()); }

// ----------------- Flow principal -----------------
export async function closeDeal({ text, context, prompts, productPrompt, price = 170 }) {
  const user = (text || '').trim();
  const userId = (context && context.userId) || 'unknown';

  // 0) Ofensa
  if (isOffensive(user)) {
    const reply = 'Entendo que você possa estar chateada 💕. Se preferir, podemos encerrar por aqui. Se quiser falar sobre o produto em outro momento, estarei aqui pra te ajudar.';
    logEvent({ userId, event: 'ofensa_detectada', payload: { preview: reply.slice(0, 120) } });
    return polishReply(reply, { closingHint: 'close' });
  }

  // 1) Pós-venda (comprovante)
  if (detectComprovante(user)) {
    const reply = `Comprovante recebido ✅ Muito obrigada 💕 Seu pedido foi registrado. Aqui está seu cupom fidelidade: ${COUPON_CODE} (válido 3 meses). ${getRandomClosingQuestion('postsale')}`;
    logEvent({ userId, event: 'pos_pagamento_enviado' });
    logEvent({ userId, event: 'cupom_liberado', payload: { cupom: COUPON_CODE } });
    const safe = await filterDuplicateReply(userId, reply);
    return polishReply(safe || reply, { closingHint: 'postsale' });
  }

  // 2) Fidelidade
  if (isFidelidade(user)) {
    const reply = `Na sua recompra você ganha um cupom de R$150 💕 (código: ${COUPON_CODE}), válido por 3 meses. ${getRandomClosingQuestion('close')}`;
    const safe = await filterDuplicateReply(userId, reply);
    return polishReply(safe || reply, { closingHint: 'close' });
  }

  // 3) Objeções
  if (isObjectionFunciona(user)) {
    const reply = 'Eu entendo a sua dúvida 💕. Ele funciona sim: reduz o frizz e deixa o cabelo alinhado, com acabamento natural. Muitas clientes já aprovaram. Quer que eu te explique como aplicar certinho?';
    logEvent({ userId, event: 'objection_tratada', payload: { tipo: 'funciona' } });
    return polishReply(await filterDuplicateReply(userId, reply) || reply, { closingHint: 'close' });
  }
  if (isObjectionEstraga(user)) {
    const reply = 'Pode ficar tranquila 💕. A fórmula é sem formol e não resseca: o objetivo é alinhar e dar brilho mantendo o cabelo saudável. Quer que eu te mostre o passo a passo seguro?';
    logEvent({ userId, event: 'objection_tratada', payload: { tipo: 'seguranca' } });
    return polishReply(await filterDuplicateReply(userId, reply) || reply, { closingHint: 'close' });
  }
  if (isObjectionAnvisa(user)) {
    const reply = 'Sim, trabalhamos com produtos liberados para comercialização no Brasil 💕. Se quiser, te envio o número de registro e orientações oficiais. Quer conferir?';
    logEvent({ userId, event: 'objection_tratada', payload: { tipo: 'anvisa' } });
    return polishReply(await filterDuplicateReply(userId, reply) || reply, { closingHint: 'close' });
  }

  // 4) Se não tem intenção de compra → responde consultivo (sem link)
  if (!shouldOfferLink(user)) {
    const reply = `Pode ficar tranquila 💕 O pagamento é só na entrega (COD) e a entrega leva até 24h em capitais ou 2 dias em outras cidades. ${getRandomClosingQuestion('close')}`;
    const safe = await filterDuplicateReply(userId, reply);
    return polishReply(safe || reply, { closingHint: 'close' });
  }

  // 5) Se tem intenção clara → manda preço + depois o link
  const precoLinha = `Aproveite: de R$197 por R$${price}, com pagamento só na entrega (COD) e entrega rápida.`;
  const reply1 = `${precoLinha} ${getRandomClosingQuestion('close')}`;
  const reply2 = `👉 Link oficial: ${CHECKOUT_LINK}`;

  logEvent({ userId, event: 'checkout_enviado', payload: { link: CHECKOUT_LINK } });

  // devolve em duas mensagens sequenciais
  return [ polishReply(reply1, { closingHint: 'close' }), reply2 ];
}
