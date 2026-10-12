// CHAT (C1) — shared rules + text cleaning, used by the server (server/chat.js) and the browser (net/netChat.js).
// Channels: 'local' = everyone in your room (the city you stand in, or your run map) · 'party' = your party, any map.
// No world channel yet (owner). The SERVER decides who hears a message and cleans / filters it: a client cannot.
export const CHAT_RULES = {
  channels: ['local', 'party'],
  maxLen: 200,          // characters after cleaning
  minGap: 0.8,          // s between two messages of one player
  burst: 5,             // at most this many messages ...
  burstWindow: 10,      // ... per this many seconds
  history: 30,          // messages kept in the browser's chat log
  bubble: 5,            // s a speech bubble stays over the speaker's head
  bubbleRange: 700,     // px: bubbles of farther players are not drawn
};

// control characters out, whitespace collapsed, trimmed, cut to maxLen (keeps Thai / emoji)
export function cleanChat(text) {
  if (typeof text !== 'string') return '';
  const s = text.replace(/[\u0000-\u001f\u007f​-‏‪-‮⁠-⁤]/g, ' ').replace(/\s+/g, ' ').trim();
  return [...s].slice(0, CHAT_RULES.maxLen).join('');
}

// PROFANITY FILTER (owner: on). Each entry = a regex; the match becomes *** of the same length.
// Thai words that hide inside ordinary words carry a lookahead (หีบ = chest, สัดส่วน = proportion).
const BAD = [
  /f+u+c+k+\w*/gi, /\bsh+i+t+\w*/gi, /\bb+i+t+c+h+\w*/gi, /\bc+u+n+t+\w*/gi, /\ba+s+s+h+o+l+e+\w*/gi, /\bd+i+c+k+s?\b/gi,
  /\bn+i+g+g+\w*/gi, /\bwh+o+r+e+\w*/gi, /\bslut+\w*/gi, /\bfag+\w*/gi, /\bretard\w*/gi,
  /ควย/g, /เหี้ย/g, /เหี่ย/g, /สัส/g, /สัด(?!ส่วน)/g, /เย็ด/g, /หี(?![บด])/g, /แตด/g, /ระยำ/g, /ส้นตีน/g, /ไอ้สัตว์/g,
  /อีสัตว์/g, /จัญไร/g, /ชาติหมา/g, /พ่อมึงตาย/g, /แม่มึงตาย/g, /อีดอก/g, /ดอกทอง/g, /กะหรี่/g, /ไอ้เวร/g,
];
export function filterChat(text) {
  let s = text;
  for (const re of BAD) s = s.replace(re, (m) => '*'.repeat([...m].length));
  return s;
}

// C3 QUICK CHAT: one-tap lines (phones). Sent as an id; the server turns it into this English text and each reader's
// game shows it in their own language (i18n/th/messages.js). A new line = one entry here + its Thai.
export const QUICK_CHAT = {
  help: 'Help!', wait: 'Wait for me!', ready: 'Ready!', go: "Let's go!", boss: 'Boss here!', heal: 'I need healing!',
  back: 'Fall back!', revive: 'Revive me!', gate: 'Meet at the Dungeon Gate', thanks: 'Thanks!', gg: 'Good game!', ok: 'OK!',
};
