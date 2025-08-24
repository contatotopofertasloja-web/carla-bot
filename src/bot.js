// src/bot.js
import { getMemory, setMemory } from './memory.js';
import prompts from './prompts/base.js';              // adapter (default export)
import { productPrompt } from './prompts/product.js';
import { greet } from './flows/greet.js';
import { qualify } from './flows/qualify.js';
import { offer } from './flows/offer.js';
import { closeDeal } from './flows/close.js';

// ===== Configs =====
const PRICE_TARGET = Number(process.env.PRICE_TARGET || 170);

// JSON carregado pelo adapter (pode ser null se estiver em fallback JS)
const CFG = prompts.__carla_json || null;

// ===== Helpers =====
function pick(arr = []) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function textIndicaMidia(text = '') {
  // Heurística: usuário dizendo que mandou mídia
  const re = /(te?\s*(mandei|enviei)|segue|acabei de\s*(mandar|enviar)).*(foto|imagem|áudio|audio|vídeo|video|documento|arquivo)/i;
  return re.test(text);
}

function respostaMidia() {
  const variants =
    CFG?.policies?.media_limitations?.variants || [
      'Amiga, tô na central e não consigo abrir áudio/foto 😅 me conta rapidinho por texto?',
      'Consigo te ajudar mais rápido por texto agora 💕 me resume aqui?'
    ];
  return pick(variants);
}
// Identifica intenções objetivas no texto do cliente
function detectDirectIntent(text='') {
  const t = text.toLowerCase();
  if (/(quantos?\s*ml|ml|quantidade)/i.test(t)) return 'ml';
  if (/(sem\s*formol|formol)/i.test(t)) return 'formol';
  if (/(quanto\s*custa|preço|valor)/i.test(t)) return 'price';
  if (/(link|checkout|quero\s*comprar|onde\s*pago)/i.test(t)) return 'checkout';
  if (/(foto|imagem|mostra|manda a foto)/i.test(t)) return 'photo';
  return null;
}

// Garante apenas 1 pergunta por resposta (remove excessos)
function enforceSingleQuestion(answer='') {
  const parts = answer.split('?');
  if (parts.length <= 2) return answer;           // 0 ou 1 '?'
  return parts.slice(0,2).join('?').trim();       // mantém só a primeira pergunta
}

// Responde direto para intents objetivas, sem puxar assunto extra
function directAnswer(intent, CFG) {
  if (!intent) return null;
  const d = CFG?.intents?.direct_answers || {};
  if (intent === 'ml') return d.ml || '500ml, dura até 3 meses 😉';
  if (intent === 'formol') return d.formol || 'Sim 🌿 é fórmula vegetal, sem formol.';
  if (intent === 'price') return d.price || 'Hoje está por R$170 com frete grátis ✨';
  if (intent === 'checkout') return CFG?.intents?.checkout?.response ||
    'Perfeito 🎉 aqui está o link oficial do checkout: https://entrega.logzz.com.br/pay/memmpxgmg/progcreme170';
  if (intent === 'photo') return `[ENVIAR_FOTO_PRODUTO:Essa é a Progressiva Vegetal Profissional 🌿 sem formol e com brilho de salão ✨]`;
  return null;
}

// Legenda da foto de abertura (sem link, como combinado)
function legendaFotoAbertura() {
  return pick([
    'Essa é a Progressiva Vegetal Profissional 🌿 sem formol e com brilho de salão ✨',
    'Olha a Progressiva Vegetal Profissional 🌿 quer que eu te explique rapidinho como funciona?'
  ]);
}

// Gera comando especial para o transport converter em imagem real
// Formato: [ENVIAR_FOTO_PRODUTO:LEGENDA AQUI]
function comandoFotoAbertura() {
  const legenda = legendaFotoAbertura();
  return `[ENVIAR_FOTO_PRODUTO:${legenda}]`;
}

// ===== BOT =====
export const bot = {
  async handleMessage({ userId = 'unknown', text = '', context = {} }) {
    const mem = await getMemory(userId);
    const step = mem?.step || 'greet';
    const jaEnviouFotoAbertura = Boolean(mem?.welcomed);

    let reply = '';
    let newStep = step;

    try {
      // 0) Política de mídia: se vier mídia real (context.hasMedia) OU texto indicando mídia
      if (context?.hasMedia || textIndicaMidia(text)) {
        reply = respostaMidia();
        // Mantém o step atual; apenas orienta a resumir por texto
        await setMemory(userId, {
          step,
          lastUserText: text,
          welcomed: jaEnviouFotoAbertura,
          updatedAt: Date.now()
        });
        return reply;
      }
// Prioridade máxima: se o usuário fez pergunta direta, respondemos direto
const intent = detectDirectIntent(text);
const direct = directAnswer(intent, CFG);
if (direct) {
  // Foto na abertura (se ainda não foi) + resposta direta
  let prefixoFoto = '';
  if (!jaEnviouFotoAbertura) prefixoFoto = comandoFotoAbertura() + '\n';
  const out = `${prefixoFoto}${direct}`.trim();

  await setMemory(userId, {
    step, lastUserText: text, welcomed: true, updatedAt: Date.now()
  });
  return out;
}

      // 1) Fluxo principal por etapas
      if (step === 'greet') {
        reply = await greet({ text, context, prompts, productPrompt });
        newStep = 'qualify';
      } else if (step === 'qualify') {
        reply = await qualify({ text, context, prompts, productPrompt });
        // avança só se detectar intenção mínima
        newStep = /sim|quero|interessad|como funciona|tem entrega/i.test(text) ? 'offer' : 'qualify';
      } else if (step === 'offer') {
        reply = await offer({ text, context, prompts, productPrompt, price: PRICE_TARGET });
        newStep = 'close';
      } else {
        reply = await closeDeal({ text, context, prompts, productPrompt, price: PRICE_TARGET });
        newStep = 'close';
        reply = enforceSingleQuestion(reply);

      }

      // 2) Foto automática na abertura da conversa (uma vez por usuário, por persistência)
      //    Enviamos SEMPRE quando for a primeira interação (mem.welcomed falsy).
      //    O transport (smartSend) converte [ENVIAR_FOTO_PRODUTO:...] em imagem real com legenda.
      let prefixoFoto = '';
      if (!jaEnviouFotoAbertura) {
        prefixoFoto = comandoFotoAbertura() + '\n';
      }

      // 3) Resposta final (se houver prefixo de foto, vai primeiro; depois o texto da etapa)
      reply = `${prefixoFoto}${reply}`.trim();

    } catch (err) {
      console.error('[BOT][ERR]', err);
      reply = 'Dei uma travadinha aqui. Quer que eu te passe o passo a passo rapidinho?';
    }

    // 4) Persistência de memória (marca welcomed após a primeira resposta)
    await setMemory(userId, {
      step: newStep,
      lastUserText: text,
      welcomed: true, // após primeira resposta, consideramos foto enviada
      updatedAt: Date.now()
    });

    return reply;
  }
};
