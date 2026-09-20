import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Unit tests (and any subprocess they spawn, via env inheritance) must never
// touch the developer's real ~/.synai: a test that reaches core startup can
// otherwise spawn a real hub daemon against the real discovery record, or
// trigger a real background auto-update. Point everything at a per-worker
// temp dir before any test file is imported. Tests that need specific paths
// still override these per-test.
const isolatedRoot = mkdtempSync(join(tmpdir(), "synai-cli-vitest-"));
process.env.SYNAI_DIR = join(isolatedRoot, ".synai");
process.env.SYNAI_DATA_DIR = join(isolatedRoot, "data");
process.env.SYNAI_HUB_DISCOVERY_PATH = join(isolatedRoot, "hub-discovery.json");
process.env.SYNAI_NO_AUTO_UPDATE = "1";
