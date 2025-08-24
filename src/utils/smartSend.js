// src/utils/smartSend.js
// Envia respostas do modelo tratando o comando [ENVIAR_FOTO_PRODUTO:LEGEND]
// 1) Se achar o comando, envia a IMAGEM primeiro (com a legenda)
// 2) Em seguida, envia o texto restante (se houver)

import prompts from "../prompts/base.js";

// Tenta pegar a URL do produto do JSON (via adapter). Se não tiver, usa fallback fixo.
const CFG = prompts.__carla_json || null;
const PRODUCT_IMAGE_URL =
  CFG?.product?.photo_url ||
  "https://cdn.shopify.com/s/files/1/0947/7609/9133/files/Inserirumtitulo_8.png?v=1755836200";

// Regex para capturar o comando com legenda opcional:
// [ENVIAR_FOTO_PRODUTO]           -> sem legenda
// [ENVIAR_FOTO_PRODUTO: legenda]  -> com legenda
const RE_CMD = /\[ENVIAR_FOTO_PRODUTO(?::([^\]]+))?\]/i;

/**
 * Envia a mensagem tratando mídia especial.
 * @param {import("@whiskeysockets/baileys").WASocket} sock
 * @param {string} jid
 * @param {string} replyText - resposta crua vinda do bot (pode conter o comando)
 */
export async function smartSend(sock, jid, replyText = "") {
  const text = (replyText || "").trim();

  // 0) Nada pra fazer
  if (!text) return;

  // 1) Procura comando de foto
  const match = text.match(RE_CMD);

  if (match) {
    // 1.1) Extrai legenda (se houver)
    const legenda = (match[1] || "").trim() ||
      "Essa é a Progressiva Vegetal Profissional 🌿 sem formol e com brilho de salão ✨";

    // 1.2) Envia a imagem primeiro
    await sock.sendMessage(jid, {
      image: { url: PRODUCT_IMAGE_URL },
      caption: legenda
    });

    // 1.3) Remove a linha do comando do texto e envia o restante (se sobrar)
    const restante = text.replace(RE_CMD, "").trim();
    if (restante) {
      await sock.sendMessage(jid, { text: restante });
    }
    return;
  }

  // 2) Sem comando → envia como texto normal
  await sock.sendMessage(jid, { text });
}
