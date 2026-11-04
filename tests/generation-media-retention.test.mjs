import { strict as assert } from "node:assert";
import { test } from "node:test";
import { GENERATED_MEDIA_RETENTION_MS, isGenerationMediaAvailable } from "../src/lib/generation-media-retention.ts";

const now = Date.parse("2026-11-04T12:00:00Z");

test("generated media expires at seven days, not before", () => {
  assert.equal(isGenerationMediaAvailable(new Date(now - GENERATED_MEDIA_RETENTION_MS + 1).toISOString(), null, now), true);
  assert.equal(isGenerationMediaAvailable(new Date(now - GENERATED_MEDIA_RETENTION_MS).toISOString(), null, now), false);
  assert.equal(isGenerationMediaAvailable(new Date(now - GENERATED_MEDIA_RETENTION_MS - 1).toISOString(), null, now), false);
});

test("explicit expiry takes precedence and unknown dates are not assumed expired", () => {
  assert.equal(isGenerationMediaAvailable("2026-01-01T00:00:00Z", "2026-11-05T00:00:00Z", now), true);
  assert.equal(isGenerationMediaAvailable("2026-11-04T00:00:00Z", "2026-11-04T12:00:00Z", now), false);
  assert.equal(isGenerationMediaAvailable(undefined, undefined, now), true);
  assert.equal(isGenerationMediaAvailable("invalid", undefined, now), true);
});
