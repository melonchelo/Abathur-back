import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { containsHtml } from '../src/shared/content';
import { classifyDecision } from '../src/modules/proposals/decision.policy';
import { voteWeight } from '../src/modules/reputation/reputation.policy';
import { resolveCommunityResult, tallyVotes } from '../src/modules/votes/voting.policy';

describe('voteWeight', () => {
  it('reputación 10 → 1, 30 → 3, 50 o más → 5', () => {
    assert.equal(voteWeight(10), 1);
    assert.equal(voteWeight(30), 3);
    assert.equal(voteWeight(50), 5);
    assert.equal(voteWeight(120), 5);
  });

  it('nunca baja de 1', () => {
    assert.equal(voteWeight(0), 1);
    assert.equal(voteWeight(-8), 1);
  });
});

describe('tallyVotes y resolveCommunityResult', () => {
  it('pesos 3, 3 y 1, dos a favor y uno en contra: 6 contra 1, recomendada', () => {
    const tally = tallyVotes([
      { choice: 'a_favor', weightAtVote: 3 },
      { choice: 'a_favor', weightAtVote: 3 },
      { choice: 'en_contra', weightAtVote: 1 },
    ]);
    assert.deepEqual(tally, { votes: 3, favor: 6, contra: 1, quorum: true });
    assert.equal(resolveCommunityResult(tally.favor, tally.contra), 'recomendada');
  });

  it('pesos 4, 2 y 2, el 4 en contra: 4 contra 4, controvertida', () => {
    const tally = tallyVotes([
      { choice: 'en_contra', weightAtVote: 4 },
      { choice: 'a_favor', weightAtVote: 2 },
      { choice: 'a_favor', weightAtVote: 2 },
    ]);
    assert.equal(tally.quorum, true);
    assert.equal(resolveCommunityResult(tally.favor, tally.contra), 'controvertida');
  });

  it('menos de tres votos no tiene quórum', () => {
    assert.equal(tallyVotes([{ choice: 'a_favor', weightAtVote: 5 }, { choice: 'a_favor', weightAtVote: 5 }]).quorum, false);
  });

  it('más peso en contra: desaconsejada', () => {
    assert.equal(resolveCommunityResult(1, 6), 'desaconsejada');
  });
});

describe('classifyDecision', () => {
  it('acorde cuando acompaña el resultado', () => {
    assert.equal(classifyDecision('recomendada', 'aceptar'), 'acorde');
    assert.equal(classifyDecision('desaconsejada', 'rechazar'), 'acorde');
  });

  it('apartada cuando se aparta o hubo empate', () => {
    assert.equal(classifyDecision('recomendada', 'rechazar'), 'apartada');
    assert.equal(classifyDecision('desaconsejada', 'aceptar'), 'apartada');
    assert.equal(classifyDecision('controvertida', 'aceptar'), 'apartada');
  });

  it('excepcional sin quórum', () => {
    assert.equal(classifyDecision(null, 'aceptar'), 'excepcional');
  });
});

describe('containsHtml', () => {
  it('detecta etiquetas HTML', () => {
    assert.equal(containsHtml('<p>hola</p>'), true);
    assert.equal(containsHtml('texto <br/> más'), true);
    assert.equal(containsHtml('<div class="x">'), true);
    assert.equal(containsHtml('<!-- comentario -->'), true);
  });

  it('acepta Markdown con signos sueltos', () => {
    assert.equal(containsHtml('# Título\n\n- si a < b y c > d\n'), false);
  });
});
