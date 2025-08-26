// src/flows/qualify.js
import { model } from '../model.js';
import { logEvent } from '../telemetry.js';

function detectMapeamentoPergunta(text = '') {
  const t = text.toLowerCase();
  // gatilhos típicos de mapeamento (002_mapeamento_cabelo)
  return /(tipo de cabelo|seu cabelo|é liso|ondulado|cachead|crespo|caracolado|volume|alinhado)/i.test(t);
}

function detectDorPergunta(text = '') {
  const t = text.toLowerCase();
  // gatilhos típicos de dor (003_dor_personalizada)
  return /(frizz|arma|chapinha|escova|definiç|ressecad|quebra|tempo|umidade|indefinid)/i.test(t);
}

export async function qualify({ text, context, prompts, productPrompt }) {
  const sys =
    prompts.persona +
    prompts.styleRules +
    // reforço explícito de identidade humana
    '\n[NUNCA REVELAR IDENTIDADE TÉCNICA]\n' +
    'Nunca revele que é IA/assistente. Apresente-se e aja sempre como vendedora humana da TopOfertas Express.\n' +
    // dica para o modelo consultar os blocos corretos
    '[ORIENTAÇÃO DE FLUXO]\n' +
    'Nesta etapa, faça 1–2 perguntas curtas: primeiro mapeie o tipo de cabelo (use 002_mapeamento_cabelo.json) e/ou explore a dor (use 003_dor_personalizada.json) conforme o contexto. Reescreva no seu estilo, sem copiar literal. Finalize com 1 pergunta objetiva.\n' +
    productPrompt({ price: process.env.PRICE_TARGET || 170 });

  const user = (text || '').trim();

  const messages = [
    { role: 'system', content: sys },
    {
      role: 'user',
      content: `Mensagem do cliente: "${user}"
Faça 1 ou 2 perguntas rápidas para entender o TIPO DE CABELO/OBJETIVO e (se fizer sentido) a DOR principal (ex.: frizz, volume, chapinha diária, falta de definição).
- Tom: curto, empático, consultivo (1–2 frases, máx. 3 linhas).
- Evite parecer interrogatório.
- Termine com apenas UMA pergunta.`,
    },
  ];

  const reply = await model.chat(messages, { maxTokens: 180, temperature: 0.65 });

  // ---- Telemetry: o que foi perguntado nessa etapa?
  const userId = (context && context.userId) || 'unknown';
  if (detectMapeamentoPergunta(String(reply))) {
    logEvent({
      userId,
      event: 'mapeamento_pergunta_enviada',
      payload: { preview: String(reply).slice(0, 120) }
    });
  }
  if (detectDorPergunta(String(reply))) {
    logEvent({
      userId,
      event: 'dor_pergunta_enviada',
      payload: { preview: String(reply).slice(0, 120) }
    });
  }

  return reply;
}
