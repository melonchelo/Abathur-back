/** Misma fórmula que `VoteWeightPolicy` en el front. El peso que vale es el que calcula el servidor. */
export function voteWeight(reputation: number): number {
  return Math.min(5, Math.max(1, Math.floor(reputation / 10)));
}
