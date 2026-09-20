import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isRetryableStatus,
  parseRetryAfterMs,
  computeBackoffDelay,
} from '../dist/openrouter/index.js';

// --- isRetryableStatus: only transient conditions should ever be retried ---

test('treats rate limits and 5xx as retryable', () => {
  for (const status of [429, 500, 502, 503, 504, 599]) {
    assert.equal(isRetryableStatus(status), true, `expected ${status} to be retryable`);
  }
});

test('treats selected timeout/conflict codes as retryable', () => {
  for (const status of [408, 409, 425]) {
    assert.equal(isRetryableStatus(status), true, `expected ${status} to be retryable`);
  }
});

test('does not retry hard client errors that would fail identically', () => {
  for (const status of [400, 401, 403, 404, 422, 200, 301]) {
    assert.equal(isRetryableStatus(status), false, `expected ${status} to NOT be retryable`);
  }
});

// --- parseRetryAfterMs: delta-seconds and HTTP-date forms, clamped ---

test('parses Retry-After delta-seconds into milliseconds', () => {
  assert.equal(parseRetryAfterMs('5'), 5000);
  assert.equal(parseRetryAfterMs('0'), 0);
});

test('clamps an absurd Retry-After so a bad server cannot stall us forever', () => {
  assert.equal(parseRetryAfterMs('9999'), 30000);
});

test('parses an HTTP-date Retry-After into a future delay', () => {
  const future = new Date(Date.now() + 3000).toUTCString();
  const ms = parseRetryAfterMs(future);
  assert.ok(ms !== undefined && ms > 0 && ms <= 30000, `unexpected ms: ${ms}`);
});

test('returns undefined for a missing or unparseable header', () => {
  assert.equal(parseRetryAfterMs(null), undefined);
  assert.equal(parseRetryAfterMs(undefined), undefined);
  assert.equal(parseRetryAfterMs('not-a-date'), undefined);
});

// --- computeBackoffDelay: exponential growth, jitter, server hint wins ---

test('backoff grows exponentially with the attempt number', () => {
  const a0 = computeBackoffDelay(0);
  const a3 = computeBackoffDelay(3);
  assert.ok(a0 >= 500 && a0 < 750, `attempt 0 out of range: ${a0}`);
  assert.ok(a3 >= 4000, `attempt 3 should be much larger: ${a3}`);
});

test('backoff never exceeds the 8s base ceiling (plus jitter)', () => {
  const a20 = computeBackoffDelay(20);
  assert.ok(a20 <= 8250, `backoff should be capped: ${a20}`);
});

test('a larger server-provided Retry-After overrides our own backoff', () => {
  assert.equal(computeBackoffDelay(0, 12000), 12000);
});

test('a smaller server-provided Retry-After does not shrink our backoff', () => {
  assert.ok(computeBackoffDelay(4, 10) >= 8000);
});
