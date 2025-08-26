// src/flows/greet.js — revisado: abertura calorosa + pedir nome
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
    '- Responda em 2 frases curtas.\n' +
    '- Seja calorosa, empática e use emojis suaves.\n' +
    '- Apresente o produto de forma sutil.\n' +
    '- Peça o NOME do cliente de forma natural (ex.: “E o seu nome, qual é? 💕”).\n' +
    '- Finalize sempre com 1 pergunta curta.\n' +
    productPrompt({ price });

  const userMsg =
    `Mensagem do cliente: "${(text || '').trim()}"\n` +
    'Monte uma resposta de abertura em 2 frases + 1 pergunta, pedindo o nome do cliente.';

  const messages = [
    { role: 'system', content: sys },
    { role: 'user', content: userMsg }
  ];

  let reply = await model.chat(messages, { maxTokens: 160, temperature: 0.6 });
  reply = oneQuestionOnly(String(reply || '').trim());

  if (!reply || reply.length < 20) {
    reply = "Oi! Seja muito bem-vinda 💕 Eu sou a Carla da TopOfertas Express. Qual é o seu nome?";
  }

  // 🔐 Salva flag de que já pediu o nome (pra personalizar depois)
  await setMemory(userId, { askedName: true, updatedAt: Date.now() });

  // 📊 Telemetry
  logEvent({ userId, event: 'abertura_enviada', payload: { preview: reply.slice(0, 120) } });

  return reply;
}
