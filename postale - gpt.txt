// src/flows/postsale.js — Etapa 8 (Pós-venda) blindada + Telemetry
import { model } from '../model.js';
import { logEvent } from '../telemetry.js';

const COUPON_CODE = process.env.COUPON_CODE || 'TOP-AGO2025-PROGRVG-150';

// Garante no máximo 1 pergunta
function oneQuestionOnly(answer = '') {
  const s = String(answer || '');
  const parts = s.split('?');
  if (parts.length <= 2) return s.trim();
  return (parts.slice(0, 2).join('?') + (s.endsWith('?') ? '?' : '')).trim();
}

export async function postSale({ text, context, prompts, productPrompt, price = 170 }) {
  const user = (text || '').trim();
  const userId = (context && context.userId) || 'unknown';

  const sys =
    prompts.persona +
    prompts.styleRules +
    '\n[NUNCA REVELAR IDENTIDADE TÉCNICA]\n' +
    'Aja sempre como vendedora humana da TopOfertas Express.\n' +
    '[ETAPA 8 — PÓS-VENDA]\n' +
    '- Confirmar recebimento do comprovante/print.\n' +
    '- Agradecer calorosamente.\n' +
    '- Informar que o pedido foi registrado e que o status/logística será atualizado pelo WhatsApp.\n' +
    `- Liberar CUPOM fidelidade de R$150: ${COUPON_CODE}, válido por 3 meses.\n` +
    '- Encerrar com apenas 1 pergunta leve (ex.: “quer que eu te avise quando sair para entrega?”).\n' +
    '- Responder em 2 frases curtas + 1 pergunta final.\n' +
    '- Nunca incluir links nesta etapa.\n' +
    productPrompt({ price });

  const userMsg =
    `Mensagem do cliente: "${user}"\n` +
    'Monte a resposta de pós-venda seguindo rigorosamente as regras acima.';

  const messages = [
    { role: 'system', content: sys },
    { role: 'user', content: userMsg }
  ];

  let reply = await model.chat(messages, { maxTokens: 170, temperature: 0.55 });
  reply = oneQuestionOnly(String(reply || '').trim());

  // 🚑 Fallback seguro se vier vazio, muito curto ou fora do padrão
  if (!reply || reply.length < 20 || /http/i.test(reply)) {
    reply = `Recebi seu comprovante ✅ Obrigada pela confiança 💕 Seu pedido já foi registrado. ` +
            `Aqui está seu cupom fidelidade de R$150 (${COUPON_CODE}), válido por 3 meses. ` +
            `Quer que eu te avise quando o pedido sair para entrega?`;
  }

  // 📊 Telemetry
  logEvent({ userId, event: 'pos_pagamento_enviado', payload: { preview: reply.slice(0, 120) } });
  logEvent({ userId, event: 'cupom_liberado', payload: { cupom: COUPON_CODE } });

  return reply;
}
