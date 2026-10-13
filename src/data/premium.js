// PREMIUM CURRENCY (owner 2026-10-10): DIAMONDS — bought with real money (top-up, not built yet). Spent on respecs.
// The server ledger owns the balance (server/economy.js op 'd'): a client can never GIVE itself diamonds (only the future
// top-up / an admin on the server, or 'dev' grants on a dev-login server); spending is checked against the ledger.
export const PREMIUM = {
  name: 'Diamonds',
  respec: {
    evolution: 50, // undo one skill evolution (Player.revertEvolution)
    skills: 100,   // reset every skill level of the current class, points back (Player.resetSkillLevels)
  },
  // RECLASS (owner 2026-10-13): one Class 2 per line; choosing another one needs a Reclass first (progression.reclass)
  reclass: 300,
  devGrant: 100,   // Dev Panel button (dev mode only)
};
