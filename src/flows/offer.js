// src/flows/offer.js — FSM blindada + polimento final
import { model } from '../model.js';
import { logEvent } from '../telemetry.js';
import { getMemory } from '../memory.js';
import { polishReply } from '../utils/polish.js'; // ✨ novo utilitário

// Configs
const PRICE_ORIGINAL = Number(process.env.PRICE_ORIGINAL || 197);
const PRICE_PROMO    = Number(process.env.PRICE_TARGET   || 170);

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

// Detecta dúvida vaga/insegurança
function isDuvidaVaga(text = '') {
  return /(não sei|nao sei|será que|sera que|tenho dúvida|tenho duvida)/i.test((text || '').toLowerCase());
}

export async function offer({ text, context, prompts, productPrompt, price = PRICE_PROMO }) {
  const userId   = (context && context.userId) || 'unknown';
  const memory   = await getMemory(userId);
  const hairType = memory?.hairType || null;
  const nome     = memory?.name || '';

  const precoLinha = `de R$ ${PRICE_ORIGINAL} por R$ ${PRICE_PROMO}`;
  const prazoLinha = 'Entrega rápida: até 24h (capitais) ou 2 dias úteis (demais cidades).';
  const codLinha   = 'Pagamento só quando receber em mãos (COD).';
  const urgencia   = 'Promoção válida enquanto durar o estoque.';

  // Caso seja dúvida vaga → responde com acolhimento
  if (isDuvidaVaga(text)) {
    let resposta =
      `${nome ? nome + ', ' : ''}eu entendo sua dúvida 💕 Pode ficar tranquila: ` +
      `o tratamento é seguro, sem formol, e você só paga quando receber (${codLinha}). ` +
      `Hoje ele está ${precoLinha}. Quer que eu te mostre depoimentos reais de clientes?`;

    logEvent({ userId, event: 'objection_tratada', payload: { tipo: 'nao_confio', preview: resposta.slice(0, 120) } });
    return polishReply(resposta, { closingHint: 'offer' });
  }

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
    productPrompt({ price });

  const userMsg =
    (nome ? `Cliente: ${nome}\n` : '') +
    (hairType ? `Tipo de cabelo: ${hairType}\n` : '') +
    `Mensagem: "${(text || '').trim()}"\n` +
    'Monte a OFERTA com 2 frases + 1 pergunta, sem link.';

  const messages = [
    { role: 'system', content: sys },
    { role: 'user', content: userMsg }
  ];

  let reply = await model.chat(messages, { maxTokens: 180, temperature: 0.55 });
  reply = String(reply || '').trim();

  // Fallback caso venha ruim ou com link
  if (!reply || reply.length < 20 || /https?:\/\//i.test(reply)) {
    reply =
      `${nome ? nome + ', ' : ''}olha só: ${precoLinha}, ` +
      `com ${benefitByHairType(hairType)}. ${codLinha} ${prazoLinha} ${urgencia} ` +
      'Quer garantir o seu pelo valor promocional?';
  }

  reply = oneQuestionOnly(reply);

  logEvent({
    userId,
    event: 'oferta_mostrada',
    payload: {
      hairType,
      preview: reply.slice(0, 160),
      price_original: PRICE_ORIGINAL,
      price_promo: PRICE_PROMO
    }
  });

  // ✨ Polimento final (máx 2 frases, 2 emojis, 1 pergunta, pergunta de oferta)
  return polishReply(reply, { closingHint: 'offer' });
}
