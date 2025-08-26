// src/flows/greet.js — abertura calorosa + pedir nome (blindado)
import { model } from '../model.js';
import { logEvent } from '../telemetry.js';
import { setMemory } from '../memory.js';

// Garante no máximo 1 pergunta
function oneQuestionOnly(answer = '') {
  const s = String(answer || '');
  const parts = s.split('?');
  if (parts.length <= 2) return s.trim();
  return (parts.slice(0, 2).join('?') + (s.endsWith('?') ? '?' : '')).trim();
}

export async function greet({ text, context, prompts, productPrompt, price = 170 }) {
  const userId = (context && context.userId) || 'unknown';

  const sys =
    prompts.persona +
    prompts.styleRules +
    '\n[NUNCA REVELAR IDENTIDADE TÉCNICA]\n' +
    'Você é vendedora humana da TopOfertas Express.\n' +
    '[ETAPA 1 — ABERTURA]\n' +
    '- Responda em até 2 frases curtas.\n' +
    '- Seja calorosa, empática e use emojis suaves.\n' +
    '- Apresente o produto de forma natural, mostrando experiência própria (“eu uso e amo o resultado”).\n' +
    '- Sempre valide a emoção do cliente (ex.: “eu também tinha esse receio antes de testar”).\n' +
    '- Peça o NOME do cliente de forma natural (ex.: “E o seu nome, qual é? 💕”).\n' +
    '- Termine sempre com apenas 1 pergunta.\n' +
    productPrompt({ price });

  const userMsg =
    `Mensagem do cliente: "${(text || '').trim()}"\n` +
    'Monte a resposta de abertura em 2 frases + 1 pergunta, pedindo o nome do cliente com empatia.';

  const messages = [
    { role: 'system', content: sys },
    { role: 'user', content: userMsg }
  ];

  let reply = await model.chat(messages, { maxTokens: 180, temperature: 0.7 });
  reply = oneQuestionOnly(String(reply || '').trim());

  // 🚑 Fallback se vier vazio ou curto
  if (!reply || reply.length < 20) {
    reply = "Oi! Seja muito bem-vinda 💕 Eu sou a Carla da TopOfertas Express, uso essa progressiva e amo o resultado. Qual é o seu nome? 💇‍♀️";
  }

  // 🔐 Marca que já pediu o nome (pra personalizar nas próximas etapas)
  await setMemory(userId, { askedName: true, updatedAt: Date.now() });

  // 📊 Telemetry
  logEvent({
    userId,
    event: 'abertura_enviada',
    payload: { preview: reply.slice(0, 120) }
  });

  return reply;
}
