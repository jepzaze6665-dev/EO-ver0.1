// C1 CHAT BOX (DOM, bottom left): the chat log + a text field. [Enter] opens it (game.js), Enter sends, Esc closes,
// Tab switches channel; "/p text" = party, "/l text" = local. While you type the game ignores your keys (input.js skips
// text fields). Idle log fades out; in a hard fight it shows only the last lines. Online only.
// C3: QUICK CHAT row (one tap = a ready line, shown to each reader in their own language). On phones the 💬 button
// (touchControls) opens the box WITHOUT the keyboard: quick lines first, tap the text field to type; ✕ closes.
import { CHAT_RULES, QUICK_CHAT } from '../net/chat.js';
import { t as tl, tx } from '../i18n/i18n.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const CH = { local: { label: 'Local', color: '#f2ece0' }, party: { label: 'Party', color: '#8fd8ff' }, system: { label: '', color: '#b8a8c8' } };
const SHOW = 8, IDLE = 12, FIGHT_LINES = 3;

export class ChatBox {
  constructor(game) {
    this.game = game;
    this.ch = null;          // chosen channel (null = party when in one, else local)
    this.typing = false;
    this.lastLine = 0;
    const el = this.el = document.createElement('div');
    el.className = 'chatbox hidden';
    el.innerHTML = `<div class="chat-log"></div>
      <div class="chat-quick">${Object.keys(QUICK_CHAT).map((q) => `<button type="button" data-q="${q}"></button>`).join('')}</div>
      <form class="chat-in"><button type="button" class="chat-ch"></button><input maxlength="${CHAT_RULES.maxLen}" autocomplete="off" spellcheck="false"><button type="button" class="chat-x">✕</button></form>`;
    document.body.appendChild(el);
    this.logEl = el.querySelector('.chat-log');
    this.input = el.querySelector('input');
    this.chBtn = el.querySelector('.chat-ch');
    el.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); this.submit(); });
    this.chBtn.addEventListener('click', () => { this.toggleCh(); if (!this.touch) this.input.focus(); });
    el.querySelector('.chat-x').addEventListener('click', () => this.close());
    el.querySelector('.chat-quick').addEventListener('click', (e) => {
      const b = e.target.closest('[data-q]');
      if (b && this.chat) { this.chat.sendQuick(this.channel(), b.dataset.q); this.close(); }
    });
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); this.close(); }
      if (e.key === 'Tab') { e.preventDefault(); this.toggleCh(); }
      e.stopPropagation();
    });
    // PC: clicking away closes it (phones keep it open: the quick row and ✕ are tapped outside the field)
    this.input.addEventListener('blur', () => setTimeout(() => { if (!this.touch && document.activeElement !== this.input && !this.el.matches(':hover')) this.close(); }, 0));
    this.logEl.addEventListener('pointerdown', () => { if (!this.typing && !this.touch) this.open(); }); // PC: click the log to type (phones: the 💬 button)
  }
  get touch() { return !!this.game.touch; }
  toggle() { if (this.typing) this.close(); else this.open(); }
  get chat() { return this.game.online && this.game.online.chat; }
  channel() {
    const inParty = !!(this.game.online && this.game.online.party);
    if (this.ch === 'party' && !inParty) return 'local';
    return this.ch || (inParty ? 'party' : 'local');
  }
  toggleCh() { this.ch = this.channel() === 'party' ? 'local' : 'party'; this.render(); }

  available() {
    const g = this.game, o = g.online;
    return !!(o && o.chat && o.net.online && g.state === 'play');
  }
  open() {
    if (!this.available()) return;
    this.typing = true;
    this.el.classList.add('typing');
    this.game.input.clearAll();
    this.render();
    if (!this.touch) this.input.focus(); // phones: no keyboard until the field is tapped
  }
  close() {
    if (!this.typing) return;
    this.typing = false;
    this.el.classList.remove('typing');
    this.input.value = '';
    this.input.blur();
    this.game.input.clearAll();
    this.render();
  }
  submit() {
    let text = this.input.value, ch = this.channel();
    const m = /^\/(p|party|l|local)\s*(.*)$/i.exec(text);
    if (m) { ch = /^p/i.test(m[1]) ? 'party' : 'local'; text = m[2]; if (!text) { this.ch = ch; this.input.value = ''; this.render(); return; } }
    if (text.trim()) this.chat.send(ch, text);
    this.close();
  }

  render() {
    const chat = this.chat;
    const ch = this.channel();
    this.chBtn.textContent = '[' + tl(CH[ch].label) + ']';
    this.chBtn.style.color = CH[ch].color;
    for (const b of this.el.querySelectorAll('[data-q]')) b.textContent = tx(QUICK_CHAT[b.dataset.q]);
    if (!chat) { this.logEl.innerHTML = ''; return; }
    const fight = !this.typing && this.game.ui.hud.intenseFight && this.game.ui.hud.intenseFight();
    const lines = chat.log.slice(-(this.typing ? CHAT_RULES.history : fight ? FIGHT_LINES : SHOW));
    this.logEl.innerHTML = lines.map((l) => {
      const c = CH[l.ch] || CH.local;
      const tag = l.ch === 'party' ? `<span class="chat-tag">[${tl('Party')}]</span> ` : '';
      const who = l.from ? `<b>${esc(l.from)}:</b> ` : '';
      return `<div class="chat-line" style="color:${c.color}">${tag}${who}${esc(l.ch === 'system' ? tx(l.text) : l.text)}</div>`;
    }).join('');
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  // every frame (ui.js): show / hide, idle fade
  update() {
    const on = this.available();
    this.el.classList.toggle('hidden', !on);
    const btn = document.querySelector('#touch [data-k=chat]'); if (btn) btn.style.display = on ? '' : 'none';
    if (!on) { if (this.typing) this.close(); return; }
    const chat = this.chat;
    if (!this.hooked || this.hooked !== chat) { this.hooked = chat; chat.onChange(() => { this.lastLine = performance.now(); this.render(); }); this.render(); }
    const idle = !this.typing && (performance.now() - this.lastLine) / 1000 > IDLE;
    this.el.classList.toggle('idle', idle);
    const fight = !!(this.game.ui.hud.intenseFight && this.game.ui.hud.intenseFight());
    if (fight !== this.fight) { this.fight = fight; this.render(); }
  }
}
