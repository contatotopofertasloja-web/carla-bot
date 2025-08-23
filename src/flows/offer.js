// src/flows/offer.js
import { model } from '../model.js';

export async function offer({ text, context, prompts, productPrompt, price }) {
  const sys = prompts.persona + prompts.styleRules + productPrompt({ price });

  const messages = [
    { role: 'system', content: sys },
    {
      role: 'user',
      content: `Com base no entendimento anterior, apresente a oferta em até 2 linhas.
Inclua: benefícios (sem formol, brilho/acabamento), preço R$ ${price}, informe que o produto pode ser parcelado em até 12 x no cartão, parcelas são conferidas diretamente pelo link, pagamento na entrega. Frasco 500ml e duração típica até 3 meses (de forma responsável, pode variar).
Inclua 1 CTA direto para avançar.`,
    },
  ];

  return model.chat(messages, { maxTokens: 170, temperature: 0.7 });
}
