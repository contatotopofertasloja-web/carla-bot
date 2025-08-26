// src/utils/polish.js
const EMOJI_REGEX =
  /([\u203C-\u3299]|\u00A9|\u00AE|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;

function clampEmojis(str, max = 2) {
  const all = [...str.matchAll(EMOJI_REGEX)];
  if (all.length <= max) return str;
  let kept = 0;
  return str.replace(EMOJI_REGEX, () => (++kept <= max ? '$$KEEP$$' : ''));
}

function restoreKeep(str) {
  return str.replace(/\$\$KEEP\$\$/g, (m) => m && m.replace('$$KEEP$$', ''));
}

function limitSentences(str, max = 2) {
  const parts = str
    .split(/(?<=[\.\!\?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out = parts.slice(0, max).join(' ');
  return out || str.trim();
}

function oneQuestionOnly(str = '') {
  const s = String(str || '');
  const q = s.split('?');
  if (q.length <= 2) return s.trim();
  return (q.slice(0, 2).join('?') + (s.endsWith('?') ? '?' : '')).trim();
}

function smartClosingQuestion(hint = 'default') {
  switch ((hint || '').toLowerCase()) {
    case 'need_name':
      return 'E o seu nome, qual é?';
    case 'hair_type':
      return 'Seu cabelo é liso, ondulado, cacheado ou crespo?';
    case 'pain':
      return 'Qual a maior dificuldade hoje: frizz, volume ou alinhamento?';
    case 'offer':
      return 'Quer garantir o seu pelo valor promocional?';
    case 'close':
      return 'Posso te enviar o link oficial pra finalizar agora?';
    case 'postsale':
      return 'Quer que eu te avise quando sair para entrega?';
    default:
      return 'Quer que eu te ajude com mais alguma dúvida?';
  }
}

export function polishReply(text, { maxSentences = 2, maxEmojis = 2, forceOneQuestion = true, closingHint = 'default' } = {}) {
  if (!text) return '';
  // normalização básica
  let out = text.replace(/\s+/g, ' ').replace(/\s([!?.,;:])/g, '$1').trim();

  // limitar frases
  out = limitSentences(out, maxSentences);

  // garantir 1 pergunta
  if (forceOneQuestion) out = oneQuestionOnly(out);

  // limitar emojis
  out = clampEmojis(out, maxEmojis);
  out = restoreKeep(out);

  // se não terminar com interrogação, acrescenta pergunta inteligente
  if (!/[!?]\s*$/.test(out)) {
    const q = smartClosingQuestion(closingHint);
    if (out.endsWith('.') || out.endsWith('!')) out = out.slice(0, -1);
    out = `${out}. ${q}`;
  }

  return out.trim();
}
