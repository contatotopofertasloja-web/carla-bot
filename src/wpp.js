// src/wpp.js — compatível com Node 18 (WebCrypto) + Baileys com export nomeado
import { webcrypto } from 'crypto';
import qrcode from 'qrcode';
import fs from 'fs';
// ---- Typing helpers ----
const msPerChar = Number(process.env.TYPING_MS_PER_CHAR || 35); // ms por caractere
const minMs = Number(process.env.TYPING_MIN_MS || 800);         // mínimo
const maxMs = Number(process.env.TYPING_MAX_MS || 5000);        // máximo

function calcTypingMs(text) {
  const len = Math.max(1, String(text || '').length);
  return Math.min(maxMs, Math.max(minMs, len * msPerChar));
}
function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// Garante WebCrypto no Node 18
if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}

// IMPORT DINÂMICO (export NOMEADO, não default!)
const baileys = await import('@whiskeysockets/baileys');
const {
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} = baileys;

const AUTH_DIR = process.env.WPP_AUTH_DIR || '/app/baileys-auth';

function extractText(m) {
  const msg = m?.message || {};
  return (
    msg.conversation ||
    msg?.extendedTextMessage?.text ||
    msg?.imageMessage?.caption ||
    msg?.videoMessage?.caption ||
    ''
  );
}

let sock = null;
let qrCodeData = null;
let wppReady = false;

async function simulateTyping(sock, to, text) {
  try {
    await sock.presenceSubscribe(to);
    await sock.sendPresenceUpdate('composing', to);
    await delay(calcTypingMs(text));
    await sock.sendPresenceUpdate('paused', to);
  } catch (e) {
    console.warn('[WPP][typing][warn]', e?.message || e);
  }
}

export function isWppReady() { return wppReady; }
export async function getQrDataURL() {
  if (!qrCodeData) return null;
  return qrcode.toDataURL(qrCodeData);
}
export function getSock() { return sock; }

export async function startBaileys({ onMessage }) {
  try { fs.mkdirSync(AUTH_DIR, { recursive: true }); } catch {}

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false
  });

  sock.ev.on('connection.update', (update) => {
    const { qr, connection, lastDisconnect } = update;
    if (qr) { qrCodeData = qr; wppReady = false; console.log('[WPP] QRCode gerado'); }
    if (connection === 'open') { qrCodeData = null; wppReady = true; console.log('[WPP] Conectado com sucesso'); }
    if (connection === 'close') {
      console.log('[WPP] Conexão fechada, tentando reconectar...', lastDisconnect?.error?.message || '');
      setTimeout(() => startBaileys({ onMessage }).catch(console.error), 2000);
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async (packet) => {
    try {
      if (packet.type !== 'notify') return;
      for (const m of packet.messages) {
        if (!m.message || m.key.fromMe) continue;
        const from = m.key.remoteJid;
        const text = extractText(m).trim();
        if (!text) continue;
        console.log(`[MSG] ${from}: ${text}`);
       if (typeof onMessage === 'function') {
  const reply = await onMessage({ from, text, raw: m });
  if (reply && sock) {
    await simulateTyping(sock, from, reply);
    await sock.sendMessage(from, { text: String(reply) });
  }
}



    } catch (err) {
      console.error('[WPP][ERR][messages.upsert]', err);
    }
  });

  return sock;
}
