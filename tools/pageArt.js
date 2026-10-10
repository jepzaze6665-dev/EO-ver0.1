// FACEBOOK PAGE ART (dev tool): profile picture + cover photo from the title art.
//   const A = await import('/tools/pageArt.js'); await A.build()   // -> recordings/fb_profile.png, fb_cover.png
const img = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
const save = async (c, name) => (await fetch(`/dev/recording/${name}.png`, { method: 'POST', body: await c.convertToBlob() })).ok;

export async function build() {
  await document.fonts.load('600 40px Kanit');
  const [bg, logo, emblem] = await Promise.all(['bg', 'logo', 'emblem'].map((n) => img(`/assets/ui/title/${n}.png`)));

  // PROFILE 720×720: the eclipse emblem centred on black with a violet glow (safe inside the circle crop)
  const p = new OffscreenCanvas(720, 720), x = p.getContext('2d');
  x.fillStyle = '#07050c'; x.fillRect(0, 0, 720, 720);
  const gl = x.createRadialGradient(360, 360, 60, 360, 360, 360);
  gl.addColorStop(0, 'rgba(160,90,240,0.45)'); gl.addColorStop(0.55, 'rgba(90,40,150,0.18)'); gl.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = gl; x.fillRect(0, 0, 720, 720);
  const es = 500, eh = es * (emblem.height / emblem.width);
  x.drawImage(emblem, 360 - es / 2, 360 - eh / 2, es, eh);

  // COVER 1640×624: title background (cover-fit), darkened left for the profile picture, logo + tagline right of centre
  const c = new OffscreenCanvas(1640, 624), y = c.getContext('2d');
  const s = Math.max(1640 / bg.width, 624 / bg.height), bw = bg.width * s, bh = bg.height * s;
  y.drawImage(bg, (1640 - bw) / 2, (624 - bh) / 2 - 40, bw, bh);
  const sh = y.createLinearGradient(0, 0, 1640, 0);
  sh.addColorStop(0, 'rgba(0,0,0,0.15)'); sh.addColorStop(0.5, 'rgba(0,0,0,0)'); sh.addColorStop(0.75, 'rgba(0,0,0,0.45)'); sh.addColorStop(1, 'rgba(0,0,0,0.6)');
  y.fillStyle = sh; y.fillRect(0, 0, 1640, 624);
  const bot = y.createLinearGradient(0, 380, 0, 624); bot.addColorStop(0, 'rgba(0,0,0,0)'); bot.addColorStop(1, 'rgba(0,0,0,0.65)');
  y.fillStyle = bot; y.fillRect(0, 0, 1640, 624);
  const lw = 560, lh = lw * (logo.height / logo.width), lx = 1040, ly = 175;
  y.drawImage(logo, lx - lw / 2, ly - lh / 2, lw, lh);
  y.textAlign = 'center'; y.shadowColor = 'rgba(0,0,0,0.9)'; y.shadowBlur = 14;
  y.fillStyle = '#e8c16a'; y.font = '600 40px Kanit'; y.fillText('COMING SOON', lx, ly + lh / 2 + 52);
  y.fillStyle = '#e6dcf2'; y.font = '400 26px Kanit'; y.fillText('เกมแอคชัน RPG ออนไลน์ · ลุยด่านกับเพื่อน 4 คน', lx, ly + lh / 2 + 96);
  return { profile: await save(p, 'fb_profile'), cover: await save(c, 'fb_cover') };
}
