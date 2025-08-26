// src/flows/qualify.js — versão FSM blindada
import { model } from '../model.js';
import { logEvent } from '../telemetry.js';
import { getMemory, setMemory } from '../memory.js';

// detecta tipo de cabelo
function detectHairType(text = '') {
  const t = text.toLowerCase();
  if (/liso/.test(t)) return "liso";
  if (/ondulad/.test(t)) return "ondulado";
  if (/cachead|caracolad/.test(t)) return "cacheado";
  if (/cresp/.test(t)) return "crespo";
  return null;
}

// detecta menção a dor
function detectDor(text = '') {
  const t = text.toLowerCase();
  return /(frizz|arma|chapinha|escova|definiç|ressecad|quebra|tempo|umidade|indefinid)/i.test(t);
}

// garante só 1 pergunta
function oneQuestionOnly(answer = '') {
  const s = String(answer || '');
  const parts = s.split('?');
  if (parts.length <= 2) return s.trim();
  return (parts.slice(0, 2).join('?') + (s.endsWith('?') ? '?' : '')).trim();
}

export async function qualify({ text, context, prompts, productPrompt }) {
  const userId = (context && context.userId) || 'unknown';
  const memory = await getMemory(userId);
  const hairTypeMem = memory?.hairType || null;

  const hairTypeNow = detectHairType(text);
  if (hairTypeNow && !hairTypeMem) {
    await setMemory(userId, { ...(memory || {}), hairType: hairTypeNow });
  }

  const hairType = hairTypeMem || hairTypeNow;

  const sys =
    prompts.persona +
    prompts.styleRules +
    '\n[NUNCA REVELAR IDENTIDADE TÉCNICA]\n' +
    'Você é vendedora humana da TopOfertas Express.\n' +
    '[ETAPA 2/3 — QUALIFY]\n' +
    '- Se ainda não identifiquei tipo de cabelo → faça UMA pergunta direta sobre isso.\n' +
    '- Se já identifiquei → faça UMA pergunta sobre dor principal (frizz, volume, chapinha, falta de definição).\n' +
    '- Nunca repetir a mesma pergunta se já foi respondida.\n' +
    '- Sempre finalizar com apenas 1 pergunta curta.\n' +
    productPrompt({ price: process.env.PRICE_TARGET || 170 });

  const userMsg =
    `Mensagem do cliente: "${(text || '').trim()}"\n` +
    'Monte a resposta seguindo as regras acima. No máximo 2 frases + 1 pergunta.';

  const messages = [
    { role: 'system', content: sys },
    { role: 'user', content: userMsg }
  ];

  let reply = await model.chat(messages, { maxTokens: 160, temperature: 0.6 });
  reply = oneQuestionOnly(String(reply || '').trim());

  // 🚑 Fallback se vier vazio ou ruim
  if (!reply || reply.length < 10) {
    if (!hairType) {
      reply = "Só pra entender melhor 💕 Seu cabelo é liso, ondulado, cacheado ou crespo?";
    } else {
      reply = "Entendi 💕 E qual a maior dificuldade dele hoje: frizz, volume ou alinhamento?";
    }
  }

  // ---- Telemetry
  if (!hairType) {
    logEvent({
      userId,
      event: 'mapeamento_pergunta_enviada',
      payload: { preview: reply.slice(0, 120) }
    });
  } else {
    logEvent({
      userId,
      event: 'dor_pergunta_enviada',
      payload: { preview: reply.slice(0, 120), hairType }
    });
  }

  return reply;
}
