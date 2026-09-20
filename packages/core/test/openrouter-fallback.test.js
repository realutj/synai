import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FALLBACK_FREE_MODELS } from '../dist/openrouter/index.js';

test('openrouter/free (the self-healing meta-router) is the first fallback entry', () => {
  assert.ok(FALLBACK_FREE_MODELS.length > 0);
  assert.equal(FALLBACK_FREE_MODELS[0].id, 'openrouter/free');
});

test('every fallback entry is marked free with zero pricing', () => {
  for (const m of FALLBACK_FREE_MODELS) {
    assert.equal(m.isFree, true, `${m.id} should be marked isFree`);
    assert.equal(m.pricing.prompt, '0', `${m.id} should have zero prompt price`);
    assert.equal(m.pricing.completion, '0', `${m.id} should have zero completion price`);
  }
});

test('no duplicate model ids in the fallback list', () => {
  const ids = FALLBACK_FREE_MODELS.map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length);
});
