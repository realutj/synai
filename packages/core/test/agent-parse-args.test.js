import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseToolCallArguments, repairToolCallArguments } from '../dist/agent/index.js';

test('parses valid JSON arguments', () => {
  const { args, failed } = parseToolCallArguments('{"path":"a.ts","content":"x"}');
  assert.equal(failed, false);
  assert.deepEqual(args, { path: 'a.ts', content: 'x' });
});

test('treats undefined arguments as an empty object, not a failure', () => {
  const { args, failed } = parseToolCallArguments(undefined);
  assert.equal(failed, false);
  assert.deepEqual(args, {});
});

test('treats an empty string as an empty object, not a failure', () => {
  const { args, failed } = parseToolCallArguments('');
  assert.equal(failed, false);
  assert.deepEqual(args, {});
});

test('flags malformed JSON as failed instead of executing garbage input', () => {
  const { args, failed } = parseToolCallArguments('{path: "unquoted key"');
  assert.equal(failed, true);
  assert.equal(args.raw, '{path: "unquoted key"');
});

// --- Salvage path: these all used to hard-fail and force an extra model round-trip ---

test('recovers arguments truncated mid-object by the stream', () => {
  const { args, failed, repaired } = parseToolCallArguments('{"filePath":"src/a.ts"');
  assert.equal(failed, false);
  assert.equal(repaired, true);
  assert.deepEqual(args, { filePath: 'src/a.ts' });
});

test('recovers nested truncation by closing every open delimiter', () => {
  const { args, failed } = parseToolCallArguments('{"ops":[{"filePath":"a"},{"filePath":"b"');
  assert.equal(failed, false);
  assert.deepEqual(args, { ops: [{ filePath: 'a' }, { filePath: 'b' }] });
});

test('recovers a trailing comma before a closing brace', () => {
  const { args, failed } = parseToolCallArguments('{"a":1,"b":2,}');
  assert.equal(failed, false);
  assert.deepEqual(args, { a: 1, b: 2 });
});

test('recovers single-quoted JSON when no double quotes are present', () => {
  const { args, failed } = parseToolCallArguments("{'path':'src/index.ts'}");
  assert.equal(failed, false);
  assert.deepEqual(args, { path: 'src/index.ts' });
});

test('recovers JSON wrapped in a markdown code fence', () => {
  const { args, failed } = parseToolCallArguments('```json\n{"query":"useEffect"}\n```');
  assert.equal(failed, false);
  assert.deepEqual(args, { query: 'useEffect' });
});

test('does not corrupt already-valid JSON containing double quotes', () => {
  const { args, repaired } = parseToolCallArguments('{"content":"say \\"hi\\""}');
  assert.equal(repaired, undefined);
  assert.deepEqual(args, { content: 'say "hi"' });
});

test('ignores braces inside string values when balancing delimiters', () => {
  const { args, failed } = parseToolCallArguments('{"code":"function f() { return 1; }"');
  assert.equal(failed, false);
  assert.deepEqual(args, { code: 'function f() { return 1; }' });
});

test('never invents data: an unrepairable payload still reports failure', () => {
  assert.equal(repairToolCallArguments('not json at all'), null);
  assert.equal(repairToolCallArguments(''), null);
  assert.equal(repairToolCallArguments(undefined), null);
  const { failed } = parseToolCallArguments('not json at all');
  assert.equal(failed, true);
});

