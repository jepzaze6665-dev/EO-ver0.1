// Skill icon ART (owner's icons, built by tools/build-icons.js -> assets/icons/<key>.png).
// skill id -> icon key. A skill missing here (or an icon file missing) keeps its drawn placeholder (ui/icons.js,
// skill data field `icon`). Keys follow the owner's folders: desgin/ICON SKILL/<line>/<CLASS>/SKn -> '<class>_skn'.
export const SKILL_ICONS = {
  // Umbral Sword (phantom_edge has no icon yet)
  shadow_slash: 'ub_sk1', shade_step: 'ub_sk2', twin_fang: 'ub_sk3', shadow_veil: 'ub_sk4', shadow_arc: 'ub_sk5',
  shadow_break: 'ub_sk6', eclipse_sever: 'ub_ut',
  // Nightfall Reaper (rp_sk6 = the unused harvest art)
  reapers_arc: 'rp_sk1', phantom_reap: 'rp_sk2', shadow_doppel: 'rp_sk3', nightfall_zone: 'rp_sk4', reapers_step: 'rp_sk5',
  funeral_eclipse: 'rp_sk7',
  // Duskrunner (dr_sk6 = Ghost Step art, a passive)
  blue_fang: 'dr_sk1', flash_step: 'dr_sk2', dusk_barrage: 'dr_sk3', mirage_shift: 'dr_sk4', silent_run: 'dr_sk5',
  endless_run: 'dr_sk7',
  // Blade of Echoes (be_sk6 unused)
  echo_slash: 'be_sk1', rewind_edge: 'be_sk2', crimson_memory: 'be_sk3', crimson_counter: 'be_sk4', last_stand: 'be_sk5',
  blade_of_recollection: 'be_sk7',
  // Aegis Guardian (ag_sk3 unused)
  shield_bash: 'ag_sk1', guardian_slash: 'ag_sk2', guardian_challenge: 'ag_sk4', holy_barrier: 'ag_sk5', aegis_guard: 'ag_sk6',
  aegis_ascension: 'ag_sk7',
  // Warden of Dawn
  dawn_shield: 'dw_sk1', radiant_chain: 'dw_sk2', dawn_bastion: 'dw_sk3', guardian_march: 'dw_sk4', grace_of_dawn: 'dw_sk5',
  dawn_guard: 'dw_sk6', dawns_sanctuary: 'dw_sk7',
  // Bulwark Sentinel
  iron_bastion: 'bs_sk1', fortress_step: 'bs_sk2', absolute_provocation: 'bs_sk3', shieldwall: 'bs_sk4', counterweight: 'bs_sk5',
  bulwark_guard: 'bs_sk6', citadel_of_one: 'bs_sk7',
  // Oathbreaker
  oath_brand: 'ok_sk1', defiant_guard: 'ok_sk2', sinful_counter: 'ok_sk3', ruin_chain: 'ok_sk4', oath_of_ruin: 'ok_sk5',
  oathbreaker_verdict: 'ok_sk7',
  // Stormcaller
  thunder_lash: 'sm_sk1', storm_step: 'sm_sk2', chain_tempest: 'sm_sk3', static_thread: 'sm_sk4', tempest_field: 'sm_sk5',
  storm_burst: 'sm_sk6', heavens_tempest: 'sm_sk7',
  // Void Scribe
  void_script: 'vs_sk1', sable_mark: 'vs_sk2', phantom_quill: 'vs_sk3', rewrite: 'vs_sk4', void_chain: 'vs_sk5',
  void_seal: 'vs_sk6', final_script_null: 'vs_sk7',
  // Astral Weaver (aw_sk4 unused)
  star_needle: 'aw_sk1', astral_thread: 'aw_sk2', comet_step: 'aw_sk3', thread_burst: 'aw_sk5', astral_veil: 'aw_sk6',
  starfall_fate: 'aw_sk7',
};
