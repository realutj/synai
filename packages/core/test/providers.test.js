import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Redirect the per-user data dir (and home, for the legacy `.synairc` mirror) to a
// throwaway location BEFORE core is imported, so these tests never read or clobber
// the developer's real SynAI configuration.
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'synai-providers-test-'));
process.env.APPDATA = sandbox;
process.env.USERPROFILE = sandbox;

const {
  PROVIDERS,
  providerCount,
  getProvider,
  listProviders,
  searchProviders,
  findProviderByEnvVar,
  listKeyBasedProviders,
  maskApiKey,
} = await import('../dist/providers/index.js');
const { ConfigManager } = await import('../dist/config/index.js');

function makeWorkspace() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'synai-providers-ws-'));
}

// ── Registry integrity ────────────────────────────────────────────────────────

test('registry exposes at least 75 providers', () => {
  assert.ok(providerCount() >= 75, `expected >= 75 providers, got ${providerCount()}`);
  assert.equal(PROVIDERS.length, providerCount());
});

test('provider ids and env vars are unique', () => {
  const ids = PROVIDERS.map((p) => p.id);
  const envVars = PROVIDERS.map((p) => p.envVar);
  assert.deepEqual(
    ids.filter((id, i) => ids.indexOf(id) !== i),
    [],
    'duplicate provider ids'
  );
  assert.deepEqual(
    envVars.filter((v, i) => envVars.indexOf(v) !== i),
    [],
    'duplicate env vars'
  );
});

test('every provider carries complete, well-formed metadata', () => {
  for (const p of PROVIDERS) {
    assert.ok(p.id && /^[a-z0-9-]+$/.test(p.id), `bad id: ${p.id}`);
    assert.ok(p.name, `missing name: ${p.id}`);
    assert.ok(/^[A-Z][A-Z0-9_]*$/.test(p.envVar), `bad envVar for ${p.id}: ${p.envVar}`);
    assert.ok(/^https?:\/\//.test(p.docsUrl), `bad docsUrl for ${p.id}`);
    assert.equal(typeof p.requiresKey, 'boolean', `requiresKey must be boolean for ${p.id}`);
    if (p.baseUrl) assert.ok(/^https?:\/\//.test(p.baseUrl), `bad baseUrl for ${p.id}`);
  }
});

test('local servers are excluded from the key-based list', () => {
  const keyBased = listKeyBasedProviders();
  assert.ok(keyBased.every((p) => p.requiresKey), 'key-based list must honour requiresKey');
  assert.ok(!keyBased.some((p) => p.id === 'ollama'), 'ollama needs no key');
  const noKey = PROVIDERS.filter((p) => !p.requiresKey);
  assert.ok(noKey.every((p) => p.apiStyle === 'local' || p.customBaseUrl));
});

test('getProvider is case-insensitive and returns undefined for unknown ids', () => {
  assert.equal(getProvider('OpenAI')?.id, 'openai');
  assert.equal(getProvider('GROQ')?.id, 'groq');
  assert.equal(getProvider('does-not-exist'), undefined);
  assert.equal(getProvider(''), undefined);
});

test('searchProviders matches by id, name and env var', () => {
  assert.ok(searchProviders('groq').some((p) => p.id === 'groq'));
  assert.ok(searchProviders('GROQ_API_KEY').some((p) => p.id === 'groq'));
  assert.ok(searchProviders('Claude').some((p) => p.id === 'anthropic'));
  assert.equal(searchProviders('').length, listProviders().length);
  assert.equal(searchProviders('zzz-no-such-provider').length, 0);
});

test('findProviderByEnvVar resolves the owner of an env var', () => {
  assert.equal(findProviderByEnvVar('OPENAI_API_KEY')?.id, 'openai');
  assert.equal(findProviderByEnvVar('openai_api_key')?.id, 'openai');
  assert.equal(findProviderByEnvVar('NOT_A_REAL_VAR'), undefined);
});

test('maskApiKey never reveals the body of a secret', () => {
  const masked = maskApiKey('sk-or-v1-abcdef1234567890');
  assert.ok(masked.startsWith('sk-o'), 'keeps a short prefix');
  assert.ok(masked.endsWith('7890'), 'keeps a short suffix');
  assert.ok(!masked.includes('abcdef'), 'hides the secret body');
  assert.equal(maskApiKey('short'), '********');
  assert.equal(maskApiKey(''), '-');
  assert.equal(maskApiKey(undefined), '-');
  assert.equal(maskApiKey(null), '-');
});

// ── ConfigManager provider-key behaviour ─────────────────────────────────────

test('setProviderKey round-trips and reports the masked key', () => {
  const manager = new ConfigManager(makeWorkspace());
  const res = manager.setProviderKey('groq', 'gsk_test_1234567890abcdef');
  assert.equal(res.ok, true);
  assert.match(res.message, /gsk_\*{8}cdef/);
  assert.equal(manager.getProviderKey('groq'), 'gsk_test_1234567890abcdef');
  assert.equal(manager.hasProviderKey('groq'), true);
});

test('setProviderKey rejects unknown providers and empty keys', () => {
  const manager = new ConfigManager(makeWorkspace());
  assert.equal(manager.setProviderKey('not-a-provider', 'x').ok, false);
  assert.equal(manager.setProviderKey('groq', '   ').ok, false);
});

test('an ambient env var is used when nothing is stored', () => {
  process.env.CEREBRAS_API_KEY = 'csk_from_environment';
  const manager = new ConfigManager(makeWorkspace());
  assert.equal(manager.getProviderKey('cerebras'), 'csk_from_environment');
  delete process.env.CEREBRAS_API_KEY;
});

test('a stored key wins over an ambient env var', () => {
  const manager = new ConfigManager(makeWorkspace());
  manager.setProviderKey('mistral', 'stored-key');
  process.env.MISTRAL_API_KEY = 'env-key';
  assert.equal(manager.getProviderKey('mistral'), 'stored-key');
  delete process.env.MISTRAL_API_KEY;
});

test('removeProviderKey deletes only the stored value', () => {
  const manager = new ConfigManager(makeWorkspace());
  manager.setProviderKey('deepseek', 'to-be-removed');
  assert.equal(manager.removeProviderKey('deepseek').ok, true);
  assert.equal(manager.hasProviderKey('deepseek'), false);
  assert.equal(manager.removeProviderKey('deepseek').ok, false, 'second removal is a no-op');
});

test('listProviderKeyStatus reports configured state and its source', () => {
  const manager = new ConfigManager(makeWorkspace());
  manager.setProviderKey('together', 'stored-together-key');

  const together = manager.listProviderKeyStatus().find((s) => s.provider.id === 'together');
  assert.equal(together.configured, true);
  assert.equal(together.source, 'stored');

  const unconfigured = manager
    .listProviderKeyStatus()
    .find((s) => s.provider.id === 'perplexity');
  assert.equal(unconfigured.configured, false);
  assert.equal(unconfigured.source, 'none');
});

test('an env-sourced key is reported as env, not as none', () => {
  process.env.XAI_API_KEY = 'xai-from-env';
  const manager = new ConfigManager(makeWorkspace());
  const xai = manager.listProviderKeyStatus().find((s) => s.provider.id === 'xai');
  assert.equal(xai.configured, true);
  assert.equal(xai.source, 'env');
  delete process.env.XAI_API_KEY;
});

test('the legacy top-level apiKey keeps satisfying OpenRouter', () => {
  const manager = new ConfigManager(makeWorkspace());
  manager.saveGlobalConfig({ apiKey: 'sk-or-legacy-key' });
  assert.equal(manager.getProviderKey('openrouter'), 'sk-or-legacy-key');
});

test('alternate env vars are honoured for providers that document them', () => {
  delete process.env.GEMINI_API_KEY;
  process.env.GOOGLE_API_KEY = 'google-alt-key';
  const manager = new ConfigManager(makeWorkspace());
  assert.equal(manager.getProviderKey('google'), 'google-alt-key');
  delete process.env.GOOGLE_API_KEY;
});

