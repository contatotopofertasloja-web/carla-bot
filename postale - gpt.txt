// src/flows/qualify.js — versão FSM amigável
import { model } from '../model.js';
import { logEvent } from '../telemetry.js';

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

export async function qualify({ text, context, prompts, productPrompt }) {
  const userId = (context && context.userId) || 'unknown';
  const hairType = detectHairType(text);
  const sys =
    prompts.persona +
    prompts.styleRules +
    '\n[NUNCA REVELAR IDENTIDADE TÉCNICA]\n' +
    'Nunca diga que é IA/assistente. Aja sempre como vendedora humana da TopOfertas Express.\n' +
    '[ORIENTAÇÃO DE FLUXO]\n' +
    'Nesta etapa do funil, se ainda não identificou o tipo de cabelo → faça UMA pergunta objetiva para descobrir. ' +
    'Se já identificou o tipo de cabelo → faça UMA pergunta sobre a dor principal (frizz, volume, chapinha, falta de definição). ' +
    'Nunca repita a mesma pergunta se já foi respondida. ' +
    'Finalizar sempre com apenas UMA pergunta curta.\n' +
    productPrompt({ price: process.env.PRICE_TARGET || 170 });

  let user = (text || '').trim();

  const messages = [
    { role: 'system', content: sys },
    {
      role: 'user',
      content: `Mensagem do cliente: "${user}"
Responda em tom curto, empático e consultivo:
- Se ainda não tenho o tipo de cabelo, pergunte isso.
- Se já tenho, explore apenas a dor principal.
- Use no máximo 2 frases.
- Termine sempre com 1 pergunta objetiva.`,
    },
  ];

  const reply = await model.chat(messages, { maxTokens: 160, temperature: 0.65 });

  // ---- Telemetry
  if (!hairType) {
    logEvent({
      userId,
      event: 'mapeamento_pergunta_enviada',
      payload: { preview: String(reply).slice(0, 120) }
    });
  } else if (detectDor(String(reply))) {
    logEvent({
      userId,
      event: 'dor_pergunta_enviada',
      payload: { preview: String(reply).slice(0, 120), hairType }
    });
  }

  return reply;
}
