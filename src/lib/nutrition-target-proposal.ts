// Mirrors lib/nutrition-target-proposal.ts in the main repo — parses the AI
// Nutrition Coach's structured target-change marker out of a chat reply.
// See that file for the full explanation of the marker format and why this
// stays dependency-free.

export interface TargetProposal {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

const PROPOSAL_RE = /\[\[PROPOSE_TARGET\s+calories=(\d+)\s+proteinG=(\d+)\s+carbsG=(\d+)\s+fatG=(\d+)\]\]\s*$/;

export function extractTargetProposal(content: string): {
  cleanText: string;
  proposal: TargetProposal | null;
} {
  const match = content.match(PROPOSAL_RE);
  if (!match) return { cleanText: content, proposal: null };

  const [, calories, proteinG, carbsG, fatG] = match;
  return {
    cleanText: content.slice(0, match.index).trimEnd(),
    proposal: {
      calories: Number(calories),
      proteinG: Number(proteinG),
      carbsG: Number(carbsG),
      fatG: Number(fatG),
    },
  };
}
