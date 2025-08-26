// src/flows/offer.js — versão completão refinada
import { model } from '../model.js';
import { logEvent } from '../telemetry.js';
import { getMemory, setMemory } from '../memory.js';
import { polishReply } from '../utils/polish.js';

const PRICE_ORIGINAL = Number(process.env.PRICE_ORIGINAL || 197);
const PRICE_PROMO    = Number(process.env.PRICE_TARGET   || 170);
const ANTI_DUP_TTL_MS = 2 * 60 * 1000;

// ----------------- Helpers -----------------
function oneQuestionOnly(answer = '') {
  const s = String(answer || '');
  const parts = s.split('?');
  if (parts.length <= 2) return s.trim();
  return (parts.slice(0, 2).join('?') + (s.endsWith('?') ? '?' : '')).trim();
}
function benefitByHairType(hairType) {
  const t = (hairType || '').toLowerCase();
  if (t.includes('liso'))      return 'liso alinhado sem precisar chapinha todo dia';
  if (t.includes('ondulad'))   return 'ondas definidas com menos frizz';
  if (t.includes('cachead'))   return 'cachos definidos, hidratados e com menos volume';
  if (t.includes('crespo'))    return 'redução de volume e fios macios';
  return 'cabelo alinhado, macio e com brilho de salão';
}
async function filterDuplicateReply(userId, reply, key = 'lastOfferReply') {
  try {
    const mem = (await getMemory(userId)) || {};
    const now = Date.now();
    const last = mem[key] || { text: '', at: 0 };
    if (reply && last.text === reply && now - (last.at || 0) < ANTI_DUP_TTL_MS) {
      return null;
    }
    await setMemory(userId, { ...mem, [key]: { text: reply, at: now } });
  } catch {}
  return reply;
}

// ----------------- Detectores -----------------
function isOffensive(t = '')     { return /(vai se f|merda|porra|caralh|burra|idiot|otári|imbecil)/i.test(t.toLowerCase()); }
function isDuvidaVaga(t = '')    { return /(não sei|nao sei|será que|tenho dúvida|tenho duvida)/i.test(t.toLowerCase()); }
function isObjectionFunciona(t=''){ return /(funciona|funcionar)/i.test(t.toLowerCase()); }
function isObjectionEstraga(t=''){ return /(estraga|danifica|cair.*cabelo|quebra.*cabelo|resseca)/i.test(t.toLowerCase()); }
function isObjectionAnvisa(t='') { return /(anvisa|autorizado|registro.*anvisa|liberado)/i.test(t.toLowerCase()); }
function isAskHowToUse(t='')     { return /(como usa|como utilizar|modo de uso|passo a passo|aplicar|aplicação)/i.test(t.toLowerCase()); }
function isAskDifferential(t=''){ return /(diferencial|por que melhor|o que tem de diferente|diferença)/i.test(t.toLowerCase()); }
function isAskMl(t='')           { return /(quantos ml|quantidade|ml tem)/i.test(t.toLowerCase()); }
function isAskDuracao(t='')      { return /(quanto dura|duração|tempo dura|meses)/i.test(t.toLowerCase()); }
function isDiscountOrKit(t='')   { return /(desconto|promoção|promo|levar dois|kit|família|family)/i.test(t.toLowerCase()); }

// ----------------- Flow principal -----------------
export async function offer({ text, context, prompts, productPrompt, price = PRICE_PROMO }) {
  const userMsgRaw = (text || '').trim();
  const userId     = (context && context.userId) || 'unknown';

  // 0) Ofensa
  if (isOffensive(userMsgRaw)) {
    const reply = 'Entendo que você possa estar chateada 💕. Se preferir, podemos encerrar por aqui. Se quiser conversar sobre o produto em outro momento, estarei aqui pra te ajudar.';
    logEvent({ userId, event: 'ofensa_detectada', payload: { stage: 'offer' } });
    return polishReply(reply, { closingHint: 'offer' });
  }

  // 1) Dúvida vaga
  if (isDuvidaVaga(userMsgRaw)) {
    const reply = `Eu entendo sua dúvida 💕. Pode ficar tranquila: é seguro, sem formol, e você só paga quando receber (COD). Quer que eu te mostre depoimentos reais de clientes?`;
    logEvent({ userId, event: 'objection_tratada', payload: { tipo: 'duvida_vaga' } });
    return polishReply(await filterDuplicateReply(userId, reply) || reply, { closingHint: 'offer' });
  }

  // 2) Objeções clássicas
  if (isObjectionFunciona(userMsgRaw)) {
    const reply = 'Sim, funciona de verdade 💕. Ele reduz o frizz e deixa o cabelo alinhado com acabamento natural. Quer que eu te explique como aplicar pra potencializar o efeito?';
    logEvent({ userId, event: 'objection_tratada', payload: { tipo: 'funciona' } });
    return polishReply(await filterDuplicateReply(userId, reply) || reply, { closingHint: 'offer' });
  }
  if (isObjectionEstraga(userMsgRaw)) {
    const reply = 'Pode ficar tranquila 💕. A fórmula é sem formol e pensada pra alinhar e dar brilho sem ressecar. Eu te passo o passo a passo seguro pra aplicar em casa. Quer?';
    logEvent({ userId, event: 'objection_tratada', payload: { tipo: 'seguranca' } });
    return polishReply(await filterDuplicateReply(userId, reply) || reply, { closingHint: 'offer' });
  }
  if (isObjectionAnvisa(userMsgRaw)) {
    const reply = 'Sim, trabalhamos com produtos liberados para comercialização no Brasil 💕. Se quiser, te envio o número de registro e orientações de uso. Quer conferir?';
    logEvent({ userId, event: 'objection_tratada', payload: { tipo: 'anvisa' } });
    return polishReply(await filterDuplicateReply(userId, reply) || reply, { closingHint: 'offer' });
  }

  // 3) Perguntas informativas consultivas
  if (isAskHowToUse(userMsgRaw)) {
    const reply = 'A aplicação é simples: lave, seque 80%, aplique mecha a mecha, deixe agir conforme o rótulo e finalize com escova/chapinha leve. Quer que eu mande o passo a passo detalhado?';
    logEvent({ userId, event: 'faq_respondida', payload: { tipo: 'como_usar' } });
    return polishReply(reply, { closingHint: 'offer' });
  }
  if (isAskDifferential(userMsgRaw)) {
    const reply = 'O diferencial é o alinhamento natural, sem formol, reduzindo frizz e deixando macio e brilhante. Quer que eu detalhe mais algum ponto?';
    logEvent({ userId, event: 'faq_respondida', payload: { tipo: 'diferencial' } });
    return polishReply(reply, { closingHint: 'offer' });
  }
  if (isAskMl(userMsgRaw)) {
    const reply = 'O frasco vem com 500ml, suficiente para até 3 meses de uso 💕. Quer que eu te mostre como aproveitar melhor o rendimento?';
    logEvent({ userId, event: 'faq_respondida', payload: { tipo: 'ml' } });
    return polishReply(reply, { closingHint: 'offer' });
  }
  if (isAskDuracao(userMsgRaw)) {
    const reply = 'O efeito dura em média até 3 meses, dependendo da rotina e dos cuidados. Quer que eu te mostre dicas pra manter o resultado por mais tempo?';
    logEvent({ userId, event: 'faq_respondida', payload: { tipo: 'duracao' } });
    return polishReply(reply, { closingHint: 'offer' });
  }

  // 4) Kits e desconto
  if (isDiscountOrKit(userMsgRaw)) {
    const reply = 'Se levar mais de um, consigo verificar uma condição especial 💕. Posso confirmar quantas unidades você gostaria?';
    logEvent({ userId, event: 'objection.discount', payload: { texto: userMsgRaw } });
    return polishReply(reply, { closingHint: 'offer' });
  }

  // 5) Fallback elegante para aleatórios
  if (userMsgRaw.split(' ').length <= 3 && !/preç|valor|promo/i.test(userMsgRaw)) {
    const reply = 'Não tenho certeza sobre isso 💕, mas falando do produto posso te explicar melhor como ele funciona. Quer que eu detalhe?';
    logEvent({ userId, event: 'fallback_aleatorio', payload: { texto: userMsgRaw } });
    return polishReply(reply, { closingHint: 'offer' });
  }

  // 6) Oferta padrão (sem link)
  const memory = (await getMemory(userId)) || {};
  const hairType = memory?.hairType || null;
  const nome     = memory?.name || '';
  const precoLinha = `de R$ ${PRICE_ORIGINAL} por R$ ${PRICE_PROMO}`;
  const prazoLinha = 'Entrega rápida: até 24h (capitais) ou 2 dias úteis (demais cidades).';
  const codLinha   = 'Pagamento só quando receber em mãos (COD).';
  const urgencia   = 'Promoção válida enquanto durar o estoque.';

  const sys =
    prompts.persona +
    prompts.styleRules +
    '\n[NUNCA REVELAR IDENTIDADE TÉCNICA]\n' +
    'Você é vendedora humana da TopOfertas Express.\n' +
    '[ETAPA 6 — OFERTA]\n' +
    '- Responder em no máximo 2 frases + 1 pergunta.\n' +
    `- Sempre incluir: ${precoLinha}, ${codLinha}, ${prazoLinha}, ${urgencia}.\n` +
    '- Personalizar se souber tipo de cabelo.\n' +
    '- Não enviar link nesta etapa.\n' +
    productPrompt({ price: PRICE_PROMO });

  const userMsg =
    (nome ? `Cliente: ${nome}\n` : '') +
    (hairType ? `Tipo de cabelo: ${hairType}\n` : '') +
    `Mensagem: "${userMsgRaw}"\n` +
    'Monte a OFERTA com 2 frases + 1 pergunta, sem link.';

  const messages = [
    { role: 'system', content: sys },
    { role: 'user', content: userMsg }
  ];

  let reply = await model.chat(messages, { maxTokens: 180, temperature: 0.55 });
  reply = oneQuestionOnly(String(reply || '').trim());

  if (!reply || reply.length < 20 || /https?:\/\//i.test(reply)) {
    reply = `${nome ? nome + ', ' : ''}olha só: ${precoLinha}, com ${benefitByHairType(hairType)}. ${codLinha} ${prazoLinha} ${urgencia} Quer garantir o seu pelo valor promocional?`;
  }

  logEvent({ userId, event: 'oferta_mostrada', payload: { hairType, preview: reply.slice(0,160), price_original: PRICE_ORIGINAL, price_promo: PRICE_PROMO } });
  const safe = await filterDuplicateReply(userId, reply);
  return polishReply(safe || `Está ${precoLinha}. ${codLinha} ${prazoLinha}. Quer garantir o seu pelo valor promocional?`, { closingHint: 'offer' });
}
