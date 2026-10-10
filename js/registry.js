/* Iron Ledger — Shared event-handler tables. Kept free of imports so every module can register handlers at load time. */
// data-act="name" → ACT.name(button, event)   (clicks)
export const ACT={};
// data-ch="name"  → CH.name(input, event)     (change events)
export const CH={};
// data-in="name"  → IN.name(input, event)     (input events)
export const IN={};
