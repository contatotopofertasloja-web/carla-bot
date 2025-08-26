// src/prompts/product.js
export function productPrompt({ price } = {}) {
  const p = Number(price ?? process.env.PRICE_TARGET ?? 170);
  const name = process.env.PRODUCT_NAME || "Progressiva Vegetal Premium";
  const volume = process.env.PRODUCT_VOLUME || "500ml";
  const duration = process.env.PRODUCT_DURATION || "até 3 meses";
  const claims = process.env.PRODUCT_CLAIMS || "sem formol, acabamento profissional";

  return `
[PRODUTO]
- nome: ${name}
- preço: R$ ${p}
- volume: ${volume}
- duração: ${duration}
- claims: ${claims}

[REGRAS DE RESPOSTA]
- Sempre mencionar que o pagamento é na entrega (COD).
- Se perguntarem "quanto custa", responder direto: preço + 1 benefício + CTA curto.
- Evitar blocos longos; responder em 1–2 frases no máximo.
`.trim();
}
