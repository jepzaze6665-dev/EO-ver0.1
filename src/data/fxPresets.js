// Procedural VFX presets (src/vfx/proceduralFx.js params). Made / tuned in the VFX Lab (tools/vfxlab.html: "Copy JSON"),
// pasted here by id. Only fields that differ from FX_DEFAULTS are needed.
export const FX_PRESETS = {
  ember_shell: { shape: 'orb', seed: 3, warp: 1.3, hole: 0.45, frontAlpha: 0.3, colors: ['#3a0610', '#8a1020', '#d8283a', '#ff7a6a', '#ffe0c8'], rimColor: '#fff0e0' },
  void_orb: { shape: 'orb', seed: 7, warp: 1.8, scale: 2.4, hole: 0.18, colors: ['#0c0418', '#2a0c52', '#5a1fa0', '#9a5cf0', '#e2c8ff'], rimColor: '#f0e0ff', spin: 0.3 },
  dawn_barrier: { shape: 'orb', seed: 11, warp: 0.6, scale: 4, hole: 0.42, rim: 0.05, colors: ['#4a3208', '#a07418', '#e8b838', '#ffe48a', '#fff8e0'], rimColor: '#ffffff', frontAlpha: 0.35, pulse: 0.4 },
  frost_ring: { shape: 'ring', seed: 5, thickness: 0.3, hole: 0.22, colors: ['#08203a', '#1c5a8a', '#4aa8e0', '#a8e4ff', '#f0fcff'], rimColor: '#ffffff', spin: 0.4 },
  storm_pillar: { shape: 'pillar', seed: 9, thickness: 0.22, warp: 1.6, speed: 0.9, hole: 0.25, colors: ['#101a3a', '#2c4ab0', '#5a8cff', '#b8d4ff', '#ffffff'], rimColor: '#e8f4ff' },
  rune_disc: { shape: 'disc', seed: 2, warp: 0.9, scale: 2.5, hole: 0.5, rim: 0.08, colors: ['#0a1a20', '#145060', '#28a0b0', '#80e8e0', '#e8fff8'], rimColor: '#ffffff', alpha: 0.85 },
};
