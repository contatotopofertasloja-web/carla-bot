// src/flows/offer.js — versão FSM/persuasiva (197→170, COD, urgência) + Telemetry
import { model } from '../model.js';
import { logEvent } from '../telemetry.js';
import { getMemory, setMemory } from '../memory.js';

// ---- Configs com defaults seguros
const CHECKOUT_LINK =
  process.env.CHECKOUT_LINK ||
  'https://entrega.logzz.com.br/pay/memmpxgmg/progcreme170';

const PRICE_ORIGINAL = Number(process.env.PRICE_ORIGINAL || 197);
const PRICE_PROMO    = Number(process.env.PRICE_TARGET   || 170);

// ---- Helpers
function oneQuestionOnly(answer = '') {
  const s = String(answer);
  const parts = s.split('?');
  if (parts.length <= 2) return s.trim();
  return (parts.slice(0, 2).join('?') + (s.endsWith('?') ? '?' : '')).trim();
}

function benefitByHairType(hairType) {
  const t = (hairType || '').toLowerCase();
  if (t.includes('liso'))      return 'liso mais alinhado e sem frizz sem precisar de chapinha diária';
  if (t.includes('ondulado'))  return 'ondas definidas com menos volume e frizz controlado';
  if (t.includes('cacheado'))  return 'cachos mais definidos, com redução de frizz e alinhamento leve';
  if (t.includes('crespo'))    return 'redução de volume mantendo o fio saudável e macio, sem agressão';
  return 'cabelo alinhado, macio e com brilho de salão por até 3 meses';
}

function tieInByDor(dor) {
  const d = (dor || '').toLowerCase();
  if (!d) return '';
  if (/(frizz|arma)/.test(d))       return 'controla o frizz já na primeira aplicação';
  if (/(volume)/.test(d))           return 'reduz volume sem “pesar” o fio';
  if (/(chapinha|escova)/.test(d))  return 'te livra da chapinha/escova diária';
  if (/(definiç|cache)/.test(d))    return 'melhora definição sem ressecar';
  if (/(ressecad|quebra)/.test(d))  return 'hidrata enquanto alinha, reduzindo ressecamento e quebra';
  if (/(tempo|rotina)/.test(d))     return 'deixa a rotina mais rápida, com menos tempo arrumando o cabelo';
  return '';
}

// ---- Oferta
export async function offer({ text, context, prompts, productPrompt, price = PRICE_PROMO }) {
  const userId   = (context && context.userId) || 'unknown';
  const memory   = await getMemory(userId);
  const hairType = memory?.hairType || memory?.hair_type || null;
  const dorUser  = memory?.dor || memory?.main_pain || null;
  const nome     = memory?.name || memory?.nome || '';

  // heurística: se usuário citou o tipo ou a dor nesta mensagem, persistir
  const t = String(text || '').toLowerCase();
  if (/liso|ondulad|cachead|cresp/.test(t)) {
    await setMemory(userId, { ...(memory || {}), hairType: t.match(/liso|ondulad[oa]?|cachead[oa]?|cresp[oa]?/i)[0] });
  }
  if (/(frizz|arma|volume|chapinha|escova|definiç|ressecad|quebra|tempo|umidade)/i.test(t)) {
    await setMemory(userId, { ...(memory || {}), dor: text });
  }

  const beneficioPeloCabelo = benefitByHairType(hairType);
  const amarraDor           = tieInByDor(dorUser);

  const precoLinha   = `de R$ ${PRICE_ORIGINAL} por **R$ ${PRICE_PROMO}**`;
  const prazoLinha   = 'Entrega em **até 24h** nas capitais e **até 2 dias** nas demais cidades.';
  const codLinha     = 'Pagamento **só no recebimento (COD)** — sem risco, sem cartão.';
  const urgencia     = 'Lote promocional com estoque limitado.';

  // 🔐 System prompt orientando o modelo (sem link aqui; link fica no CLOSE)
  const sys =
    prompts.persona +
    prompts.styleRules +
    '\n[NUNCA REVELAR IDENTIDADE TÉCNICA]\n' +
    'Aja sempre como vendedora humana da TopOfertas Express. Não diga que é IA.\n' +
    '[ETAPA 6 — OFERTA]\n' +
    '- Apresente a oferta com 2–3 frases, no máximo.\n' +
    `- Traga SEMPRE: ${precoLinha}; benefício principal; "${codLinha}"; "${prazoLinha}"; e ${urgencia}.\n` +
    '- Personalize pelo tipo de cabelo e, se houver, pela dor citada.\n' +
    '- Finalize com APENAS 1 pergunta (ex.: “quer garantir pelo valor promocional?”).\n' +
    '- NÃO envie link nesta etapa (o link é só no fechamento/Etapa 7).\n' +
    productPrompt({ price: PRICE_PROMO });

  // 🧠 Mensagem do usuário para guiar o tom
  const userMsg =
    (nome ? `Nome do cliente: ${nome}\n` : '') +
    (hairType ? `Tipo de cabelo detectado: ${hairType}\n` : '') +
    (dorUser ? `Dor detectada: ${dorUser}\n` : '') +
    `Mensagem do cliente agora: "${(text || '').trim()}"\n` +
    'Monte a OFERTA seguindo as regras acima. 2–3 frases. 1 pergunta no final. Sem link.';

  const messages = [
    { role: 'system', content: sys },
    { role: 'user', content: userMsg }
  ];

  // 🔮 Gera a oferta
  let reply = await model.chat(messages, { maxTokens: 180, temperature: 0.6 });
  reply = String(reply || '').trim();

  // 🧱 Fallback de segurança (se o modelo vier fraco, montamos uma oferta manual)
  if (!reply || reply.length < 20 || /https?:\/\//i.test(reply)) {
    const partes = [
      nome ? `${nome}, ` : '',
      `pra você fazermos assim: ${precoLinha}, `,
      `com ${beneficioPeloCabelo}${amarraDor ? ` — ${amarraDor}` : ''}. `,
      `${codLinha} ${prazoLinha} ${urgencia} `,
      'Posso garantir pra você por este valor agora?'
    ];
    reply = partes.join('').replace(/\s+/g, ' ').trim();
  }

  // 🧹 Garantia de 1 pergunta e sem link nesta etapa
  reply = oneQuestionOnly(reply).replace(/https?:\/\/\S+/g, '').trim();

  // 📊 Telemetry
  logEvent({
    userId,
    event: 'oferta_mostrada',
    payload: {
      hairType: hairType || null,
      dor: dorUser || null,
      preview: reply.slice(0, 160),
      price_original: PRICE_ORIGINAL,
      price_promo: PRICE_PROMO
    }
  });

  return reply;
}
