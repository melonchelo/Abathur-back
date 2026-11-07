import type { DecisionKind } from '../audit/audit.model';
import type { CommunityResult, DecisionOutcome } from './proposals.model';

/**
 * - Sin resultado comunitario (no hubo quórum): `excepcional`.
 * - `controvertida`: cualquier decisión se aparta, porque no hubo mayoría.
 * - `recomendada` + aceptar o `desaconsejada` + rechazar: `acorde`.
 * - El resto se aparta del resultado comunitario.
 */
export function classifyDecision(communityResult: CommunityResult | null, outcome: DecisionOutcome): DecisionKind {
  if (communityResult === null) return 'excepcional';
  if (communityResult === 'controvertida') return 'apartada';
  const followsCommunity =
    (communityResult === 'recomendada' && outcome === 'aceptar') ||
    (communityResult === 'desaconsejada' && outcome === 'rechazar');
  return followsCommunity ? 'acorde' : 'apartada';
}

/** El motivo puede ir vacío solo cuando la decisión acompaña un resultado con quórum. */
export function isReasonRequired(kind: DecisionKind): kind is Exclude<DecisionKind, 'acorde'> {
  return kind !== 'acorde';
}
