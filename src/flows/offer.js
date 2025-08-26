// src/flows/offer.js — versão completão revisada (mapa de dores + site no pós-venda)
import { model } from '../model.js';
import { logEvent } from '../telemetry.js';
import { getMemory, setMemory } from '../memory.js';
import { polishReply } from '../utils/polish.js';

const PRICE_ORIGINAL = Number(process.env.PRICE_ORIGINAL || 197);
const PRICE_PROMO    = Number(process.env.PRICE_TARGET   || 170);
const ANTI_DUP_TTL_MS = 2 * 60 * 1000;

// 🔒 Link do site (usado apenas em menções pós-venda)
const SITE_LINK = "https://tpofertas.com/pages/landing-page-aug-17-15-30-50?_ab=0&key=1755492288021";

// ----------------- Helpers -----------------
function oneQuestionOnly(answer = '') {
  const s = String(answer || '');
  const parts = s.split('?');
  if (parts.length <= 2) return s.trim();
  return (parts.slice(0, 2).join('?') + (s.endsWith('?') ? '?' : '')).trim();
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
function isDorFrizz(t='')        { return /(frizz|arrepiado|arrepiados)/i.test(t.toLowerCase()); }
function isDorVolume(t='')       { return /(volume|armado|cheio)/i.test(t.toLowerCase()); }
function isDorAlinhamento(t='')  { return /(alinhado|alinhamento|chapado|liso perfeito)/i.test(t.toLowerCase()); }

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
    const reply = `Eu entendo sua dúvida 💕. Pode ficar tranquila: é seguro, sem formol, e você só paga quando receber (COD). Depois da compra você recebe acesso ao nosso site com instruções e vídeos exclusivos.`;
    logEvent({ userId, event: 'objection_tratada', payload: { tipo: 'duvida_vaga' } });
    return polishReply(await filterDuplicateReply(userId, reply) || reply, { closingHint: 'offer' });
  }

  // 2) Objeções clássicas
  if (isObjectionFunciona(userMsgRaw)) {
    const reply = 'Sim, funciona de verdade 💕. Ele reduz o frizz e deixa o cabelo alinhado com acabamento natural. Instruções e vídeos oficiais ficam disponíveis no nosso site após a compra.';
    logEvent({ userId, event: 'objection_tratada', payload: { tipo: 'funciona' } });
    return polishReply(await filterDuplicateReply(userId, reply) || reply, { closingHint: 'offer' });
  }
  if (isObjectionEstraga(userMsgRaw)) {
    const reply = 'Pode ficar tranquila 💕. A fórmula é sem formol e pensada pra alinhar e dar brilho sem ressecar. Mais instruções seguras ficam disponíveis no nosso site após a compra.';
    logEvent({ userId, event: 'objection_tratada', payload: { tipo: 'seguranca' } });
    return polishReply(await filterDuplicateReply(userId, reply) || reply, { closingHint: 'offer' });
  }
  if (isObjectionAnvisa(userMsgRaw)) {
    const reply = 'Sim, trabalhamos com produtos liberados pela ANVISA 💕. O número de registro consta no rótulo do produto e instruções oficiais estão no nosso site, liberado no pós-venda.';
    logEvent({ userId, event: 'objection_tratada', payload: { tipo: 'anvisa' } });
    return polishReply(await filterDuplicateReply(userId, reply) || reply, { closingHint: 'offer' });
  }

  // 3) Mapa de dores
  if (isDorFrizz(userMsgRaw)) {
    const reply = 'Ele sela as cutículas e reduz o frizz já na primeira aplicação 💕. Mais instruções e vídeos estão no nosso site, liberado no pós-venda.';
    logEvent({ userId, event: 'dor_detectada', payload: { tipo: 'frizz' } });
    return polishReply(reply, { closingHint: 'offer' });
  }
  if (isDorVolume(userMsgRaw)) {
    const reply = 'Ele reduz o volume mantendo movimento natural, sem chapinha pesada 💕. Mais instruções e vídeos ficam disponíveis no nosso site após a compra.';
    logEvent({ userId, event: 'dor_detectada', payload: { tipo: 'volume' } });
    return polishReply(reply, { closingHint: 'offer' });
  }
  if (isDorAlinhamento(userMsgRaw)) {
    const reply = 'Deixa o cabelo alinhado, macio e com brilho de salão 💕. Depois da compra você recebe acesso ao nosso site com instruções e lançamentos de produtos.';
    logEvent({ userId, event: 'dor_detectada', payload: { tipo: 'alinhamento' } });
    return polishReply(reply, { closingHint: 'offer' });
  }

  // 4) Perguntas informativas consultivas
  if (isAskHowToUse(userMsgRaw)) {
    const reply = 'A aplicação é simples: lave, seque 80%, aplique mecha a mecha, deixe agir conforme o rótulo e finalize com escova/chapinha leve. Detalhes completos ficam no nosso site após a compra.';
    logEvent({ userId, event: 'faq_respondida', payload: { tipo: 'como_usar' } });
    return polishReply(reply, { closingHint: 'offer' });
  }
  if (isAskDifferential(userMsgRaw)) {
    const reply = 'O diferencial é o alinhamento natural, sem formol, reduzindo frizz e deixando macio e brilhante 💕. Mais detalhes ficam no nosso site oficial após a compra.';
    logEvent({ userId, event: 'faq_respondida', payload: { tipo: 'diferencial' } });
    return polishReply(reply, { closingHint: 'offer' });
  }
  if (isAskMl(userMsgRaw)) {
    const reply = 'O frasco vem com 500ml, suficiente para até 3 meses de uso 💕. Mais informações de rendimento ficam no nosso site após a compra.';
    logEvent({ userId, event: 'faq_respondida', payload: { tipo: 'ml' } });
    return polishReply(reply, { closingHint: 'offer' });
  }
  if (isAskDuracao(userMsgRaw)) {
    const reply = 'O efeito dura em média até 3 meses, dependendo da rotina 💕. No pós-venda você recebe link do nosso site com dicas para prolongar o resultado.';
    logEvent({ userId, event: 'faq_respondida', payload: { tipo: 'duracao' } });
    return polishReply(reply, { closingHint: 'offer' });
  }

  // 5) Kits e desconto
  if (isDiscountOrKit(userMsgRaw)) {
    const reply = 'Se levar mais de um, consigo verificar uma condição especial 💕. Mais detalhes ficam no nosso site, liberado após a compra.';
    logEvent({ userId, event: 'objection.discount', payload: { texto: userMsgRaw } });
    return polishReply(reply, { closingHint: 'offer' });
  }

  // 6) Fallback elegante
  if (userMsgRaw.split(' ').length <= 3 && !/preç|valor|promo/i.test(userMsgRaw)) {
    const reply = 'Não tenho certeza sobre isso 💕, mas falando do produto posso te explicar melhor como ele funciona. Instruções completas ficam no nosso site após a compra.';
    logEvent({ userId, event: 'fallback_aleatorio', payload: { texto: userMsgRaw } });
    return polishReply(reply, { closingHint: 'offer' });
  }

  // 7) Oferta padrão (sem link)
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
    reply = `${nome ? nome + ', ' : ''}olha só: ${precoLinha}. Ele garante ${hairType ? benefitByHairType(hairType) : 'cabelo alinhado e macio com brilho de salão'} 💕. ${codLinha} ${prazoLinha} ${urgencia}`;
  }

  logEvent({ userId, event: 'oferta_mostrada', payload: { hairType, preview: reply.slice(0,160), price_original: PRICE_ORIGINAL, price_promo: PRICE_PROMO } });
  const safe = await filterDuplicateReply(userId, reply);
  return polishReply(safe || reply, { closingHint: 'offer' });
}
