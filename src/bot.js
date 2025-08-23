// src/bot.js
import { getMemory, setMemory } from './memory.js';
import { prompts } from './prompts/base.js';
import { productPrompt } from './prompts/product.js';
import { greet } from './flows/greet.js';
import { qualify } from './flows/qualify.js';
import { offer } from './flows/offer.js';
import { closeDeal } from './flows/close.js';

const PRICE_TARGET = Number(process.env.PRICE_TARGET || 150);

export const bot = {
  async handleMessage({ userId = 'unknown', text = '', context = {} }) {
    const mem = await getMemory(userId);
    const step = mem?.step || 'greet';

    let reply = '';
    let newStep = step;

    try {
      if (step === 'greet') {
        reply = await greet({ text, context, prompts, productPrompt });
        newStep = 'qualify';
      } else if (step === 'qualify') {
        reply = await qualify({ text, context, prompts, productPrompt });
        // Se detectou intenção, avança; senão, permanece qualificando
        newStep = /sim|quero|interessad|como funciona|tem entrega/i.test(text) ? 'offer' : 'qualify';
      } else if (step === 'offer') {
        reply = await offer({ text, context, prompts, productPrompt, price: PRICE_TARGET });
        newStep = 'close';
      } else {
        reply = await closeDeal({ text, context, prompts, productPrompt, price: PRICE_TARGET });
        newStep = 'close';
      }
    } catch (err) {
      console.error('[BOT][ERR]', err);
      reply = 'Dei uma travadinha aqui. Quer que eu te passe o passo a passo rapidinho?';
    }

    await setMemory(userId, {
      step: newStep,
      lastUserText: text,
      updatedAt: Date.now(),
    });

    return reply;
  },
};
