import { strict as assert } from "node:assert";
import { test } from "node:test";
import { latestVideoResult } from "../src/features/create/latest-video-result.ts";

test("latest remains the newest output after viewing an older history item", () => {
  const history = [{ url: "new.mp4" }, { url: "old.mp4" }];
  let selected = history[1].url;
  assert.equal(selected, "old.mp4");
  selected = latestVideoResult(null, history);
  assert.equal(selected, "new.mp4");
  selected = history[1].url;
  assert.equal(selected, "old.mp4");
  assert.equal(latestVideoResult("current.mp4", history), "current.mp4");
  assert.equal(latestVideoResult(null, []), null);
});
