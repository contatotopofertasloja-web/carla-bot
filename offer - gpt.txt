// src/flows/offer.js — revisado: 2 frases + 1 pergunta, com fallback rígido
import { model } from '../model.js';
import { logEvent } from '../telemetry.js';
import { getMemory, setMemory } from '../memory.js';

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
  if (t.includes('liso'))      return 'liso alinhado sem chapinha diária';
  if (t.includes('ondulado'))  return 'ondas definidas e menos frizz';
  if (t.includes('cacheado'))  return 'cachos definidos e redução de volume';
  if (t.includes('crespo'))    return 'volume reduzido com fios hidratados';
  return 'cabelo alinhado, macio e com brilho de salão';
}

export async function offer({ text, context, prompts, productPrompt, price = PRICE_PROMO }) {
  const userId   = (context && context.userId) || 'unknown';
  const memory   = await getMemory(userId);
  const hairType = memory?.hairType || null;
  const nome     = memory?.name || '';

  const precoLinha = `de R$ ${PRICE_ORIGINAL} por R$ ${PRICE_PROMO}`;
  const prazoLinha = 'Entrega em até 24h (capitais) ou até 2 dias (demais cidades).';
  const codLinha   = 'Pagamento só no recebimento (COD).';
  const urgencia   = 'Estoque promocional limitado.';

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

  // Fallback se vier ruim
  if (!reply || reply.length < 20 || reply.split('.').length > 3) {
    reply =
      `${nome ? nome + ', ' : ''}olha só: ${precoLinha}, ` +
      `com ${benefitByHairType(hairType)}. ${codLinha} ${prazoLinha} ${urgencia} ` +
      'Quer garantir pelo preço promocional?';
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

  return reply;
}
