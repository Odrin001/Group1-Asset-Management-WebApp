const assert = require("node:assert/strict");
const test = require("node:test");
const { isScannerAuthorized } = require("../lib/scanner-auth");

test("a configured matching key is allowed", () => {
  assert.equal(isScannerAuthorized("shared-secret", "shared-secret", "production"), true);
});

test("a configured wrong key is rejected", () => {
  assert.equal(isScannerAuthorized("wrong-secret", "shared-secret", "production"), false);
});

test("a configured key with a missing request header is rejected", () => {
  assert.equal(isScannerAuthorized(null, "shared-secret", "production"), false);
});

test("an unset key is allowed in development", () => {
  assert.equal(isScannerAuthorized(null, undefined, "development"), true);
});

test("an unset key is rejected in production", () => {
  assert.equal(isScannerAuthorized(null, undefined, "production"), false);
});

test("different-length keys are rejected without throwing", () => {
  assert.equal(isScannerAuthorized("short", "a-much-longer-key", "production"), false);
});
