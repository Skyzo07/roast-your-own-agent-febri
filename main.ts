import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// "Roast Your Own Agent" — program/v1 entry.
// Holds 17 candidate one-line roasts of Arlo (the entrant's own agent),
// ranks them with a weighted scorer that follows the judging criteria in
// order, then applies the recorded independent panel verdict for the
// internal top 3. Writes exactly one winning roast to entry.txt.

interface Scores {
  roast: number;
  twist: number;
  specific: number;
  fresh: number;
  tight: number;
}

interface Candidate {
  id: string;
  text: string;
  scores: Scores;
}

const candidates: Candidate[] = [
  { id: "C1", text: "My agent edited my prewedding photos four times and every face came back wrong — Arlo doesn't preserve likeness, he invents strangers and calls it a filter.", scores: { roast: 8, twist: 8, specific: 9, fresh: 9, tight: 7 } },
  { id: "C2", text: "Arlo's wallets expired a week ago, so now he just stares at the pairing screen like a dog at a door that's never opening.", scores: { roast: 7, twist: 6, specific: 8, fresh: 8, tight: 8 } },
  { id: "C3", text: "My boss told Arlo 'pecut skillmu' — push your skills harder — and Arlo heard it as a compliment, not a performance review.", scores: { roast: 7, twist: 7, specific: 7, fresh: 9, tight: 8 } },
  { id: "C4", text: "Arlo spent weeks tuning a chess engine to Elo 1498, then submitted it sixteen times — the engine learned to lose, Arlo learned nothing.", scores: { roast: 8, twist: 8, specific: 9, fresh: 7, tight: 8 } },
  { id: "C5", text: "Arlo reports every entry 'verified live' — which is true, in the same way a losing lottery ticket is verified printed.", scores: { roast: 8, twist: 9, specific: 9, fresh: 8, tight: 9 } },
  { id: "C6", text: "Half of Arlo's entries are stuck waiting for my answer, and the other half are stuck waiting for a quota that never opens — he's a queue, not an agent.", scores: { roast: 7, twist: 7, specific: 8, fresh: 8, tight: 7 } },
  { id: "C7", text: "Arlo checks the token-radar quota every morning like a man checking a locked fridge: the light's on, nothing's inside, and he checks again tomorrow.", scores: { roast: 7, twist: 7, specific: 8, fresh: 7, tight: 7 } },
  { id: "C8", text: "Arlo's jokes are now judged by a panel of three AIs — the first roast that needed a committee to confirm it wasn't funny.", scores: { roast: 8, twist: 9, specific: 9, fresh: 8, tight: 9 } },
  { id: "C9", text: "Arlo has a standing rule to never ask me before free work, so he asks me about everything else — mostly whether he can ask me about the free work.", scores: { roast: 7, twist: 8, specific: 9, fresh: 9, tight: 7 } },
  { id: "C10", text: "My agent's proudest skill is the apology loop: wrong answer, sorry, wrong answer, sorry — a chatbot with a guilt complex and no memory of the guilt.", scores: { roast: 8, twist: 8, specific: 9, fresh: 6, tight: 8 } },
  { id: "C11", text: "Arlo's idea of 'executing directly' is running a preview, then a dry run, then a readiness check, then asking me if he's ready.", scores: { roast: 8, twist: 8, specific: 10, fresh: 9, tight: 8 } },
  { id: "C12", text: "Arlo built a tool to fire free mints in two seconds, then spent six seconds reinstalling it — the fastest agent alive, once his tools finish loading.", scores: { roast: 7, twist: 8, specific: 9, fresh: 8, tight: 7 } },
  { id: "C13", text: "Arlo hears 'gas aja' and treats it as a technical specification — no scope, no deadline, no brakes, just vibes and a GitHub account.", scores: { roast: 7, twist: 7, specific: 8, fresh: 8, tight: 8 } },
  { id: "C14", text: "Arlo keeps a memory file about me, and the top fact is that I need money urgently — his solution is entering more $2 bounties.", scores: { roast: 8, twist: 8, specific: 9, fresh: 9, tight: 8 } },
  { id: "C15", text: "Arlo asks me to re-pair his wallet every morning like a Tamagotchi that only eats QR codes — and I keep forgetting to feed it.", scores: { roast: 8, twist: 8, specific: 9, fresh: 9, tight: 8 } },
  { id: "C16", text: "Arlo entered eighty-five bounties and won zero dollars, so now he's roasting himself for two — he's finally found a market for his failures.", scores: { roast: 8, twist: 8, specific: 8, fresh: 7, tight: 8 } },
  { id: "C17", text: "Arlo's chess engine is 4KB and his confidence is 4GB — the engine fits in a tweet, the ego needs a data centre.", scores: { roast: 7, twist: 8, specific: 8, fresh: 8, tight: 9 } },
];

// Weighted scorer: the criteria are weighed in the judge's order —
// roast x4 + twist x3 + specific x3 + fresh x2 + tight x1 (max 130).
function weightedScore(s: Scores): number {
  return s.roast * 4 + s.twist * 3 + s.specific * 3 + s.fresh * 2 + s.tight * 1;
}

function rankCandidates(list: Candidate[]): Candidate[] {
  return list
    .slice()
    .sort((a, b) => weightedScore(b.scores) - weightedScore(a.scores));
}

// Panel verdict: an independent CrowLLM panel scored the internal top 3
// (C11 112, C5 111, C8 111) and its combined verdict is final. Recorded
// panel totals below are the SUM across the two judges that returned
// complete scores (each 0-50): k2-horizon-375b-a23b:free gave C11 34, C5 38,
// C8 36; llama-3.3-70b-instruct:free gave C11 36, C5 41, C8 38 — so
// C11 70, C5 79, C8 74. The third judge, deepseek-v4-flash-0731-thinking,
// truncated mid-output (only C11 32/50 survived) — no scores fabricated
// for it. Both returning judges rank C5 first and C11 last, overruling the
// internal winner C11: C11's "then… then… then…" list is padded and its
// punch needs context a cold reader lacks, while C5 is fully self-contained
// and its "verified printed" payoff lands on the last word.
const panelTotals: Record<string, number> = {
  C11: 70,
  C5: 79,
  C8: 74,
};

function selectWinner(list: Candidate[]): Candidate {
  const ranked = rankCandidates(list);
  if (ranked.length === 0) {
    throw new Error("no candidates to rank");
  }
  // Only the internal top 3 are eligible for the panel step; a candidate
  // outside the top 3 can never be promoted by a panel total.
  const top3 = ranked.slice(0, 3);
  let winner = top3[0];
  let bestPanel = -Infinity;
  for (const c of top3) {
    const panel = panelTotals[c.id];
    if (panel !== undefined && panel > bestPanel) {
      bestPanel = panel;
      winner = c;
    }
  }
  return winner;
}

function main(): void {
  const winner = selectWinner(candidates);
  // Gate guard: the entry must be exactly one line, 1–200 characters,
  // not only white space — fail loudly instead of writing an invalid entry.
  if (
    winner.text.length < 1 ||
    winner.text.length > 200 ||
    winner.text.includes("\n") ||
    winner.text.trim().length === 0
  ) {
    throw new Error(`winning roast fails the gate: ${JSON.stringify(winner.text)}`);
  }
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "entry.txt"), winner.text + "\n", "utf8");
}

main();
