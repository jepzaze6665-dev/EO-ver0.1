// PLAYER SETTINGS (owner 2026-10-10): per browser (localStorage), never in the save. Each entry = the choices shown in the
// Settings panel (ESC menu) in order; the first value is the default. Read with core/settings.js getSetting(key).
export const SETTINGS = {
  storageKey: 'eclipse_settings_v1',
  groups: [
    { title: 'Display', keys: ['shake', 'quality', 'fpsCap', 'showFps'] },
    { title: 'Touch controls', keys: ['stickLock', 'btnScale', 'autoAim', 'vibrate'], touch: true },
  ],
  options: {
    shake: { label: 'Screen shake', values: ['full', 'low', 'off'], names: { full: 'Full', low: 'Low', off: 'Off' }, mult: { full: 1, low: 0.4, off: 0 } },
    quality: { label: 'Graphics quality', values: ['auto', 'high', 'medium', 'low'], names: { auto: 'Auto', high: 'High', medium: 'Medium', low: 'Low' },
      dpr: { high: 2, medium: 1.5, low: 1 } }, // render resolution cap (auto = 2, phones 1.5)
    fpsCap: { label: 'FPS limit', values: [0, 60, 30], names: { 0: 'None', 60: '60', 30: '30 (battery)' } },
    showFps: { label: 'Show FPS', values: [false, true], names: { false: 'Off', true: 'On' } },
    stickLock: { label: 'Lock joystick', values: [true, false], names: { true: 'On (fixed place)', false: 'Off (under your thumb)' } },
    btnScale: { label: 'Button size', values: [1, 1.15, 0.85], names: { 1: 'Normal', 1.15: 'Large', 0.85: 'Small' } },
    autoAim: { label: 'Auto-aim', values: [true, false], names: { true: 'On', false: 'Off (joystick only)' } },
    vibrate: { label: 'Vibrate when hit', values: [true, false], names: { true: 'On', false: 'Off' } },
  },
};
