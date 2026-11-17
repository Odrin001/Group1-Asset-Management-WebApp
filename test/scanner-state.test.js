const assert = require("node:assert/strict");
const test = require("node:test");
const {
  processScannerDetection,
  resetScannerState,
} = require("../lib/scanner-state");

test.beforeEach(resetScannerState);

test("the first scan is pending", async () => {
  assert.deepEqual(
    await processScannerDetection({
      uid: "123",
      currentRoom: "Outside",
      scanner: "outside",
      room: "Room1",
    }),
    { status: "pending" }
  );
});

test("repeated outside reads do not create an enter", async () => {
  assert.equal((await processScannerDetection({ uid: "123", currentRoom: "Outside", scanner: "outside", room: "Room1" })).status, "pending");
  assert.equal((await processScannerDetection({ uid: "123", currentRoom: "Outside", scanner: "outside", room: "Room1" })).status, "pending");
});

test("outside then inside confirms one enter and repeated inside reads only wait", async () => {
  await processScannerDetection({ uid: "123", currentRoom: "Outside", scanner: "outside", room: "Room1" });
  const transition = await processScannerDetection({ uid: "123", currentRoom: "Outside", scanner: "inside", room: "Room1" });
  assert.deepEqual(transition, { status: "confirmed", action: "ENTER", fromRoom: "-", toRoom: "Room1", nextRoom: "Room1" });
  assert.deepEqual(
    await processScannerDetection({ uid: "123", currentRoom: "Room1", scanner: "inside", room: "Room1" }),
    { status: "pending" }
  );
});

test("inside then outside confirms one exit", async () => {
  await processScannerDetection({ uid: "123", currentRoom: "Room1", scanner: "inside", room: "Room1" });
  assert.deepEqual(
    await processScannerDetection({ uid: "123", currentRoom: "Room1", scanner: "inside", room: "Room1" }),
    { status: "pending" }
  );
  assert.deepEqual(
    await processScannerDetection({ uid: "123", currentRoom: "Room1", scanner: "outside", room: "Room1" }),
    { status: "confirmed", action: "EXIT", fromRoom: "Room1", toRoom: "-", nextRoom: "Outside" }
  );
});

test("wrong order and different UIDs never pair", async () => {
  assert.equal((await processScannerDetection({ uid: "123", currentRoom: "Outside", scanner: "inside", room: "Room1" })).status, "ignored");
  await processScannerDetection({ uid: "123", currentRoom: "Outside", scanner: "outside", room: "Room1" });
  assert.equal((await processScannerDetection({ uid: "456", currentRoom: "Outside", scanner: "inside", room: "Room1" })).status, "ignored");
  assert.equal((await processScannerDetection({ uid: "123", currentRoom: "Outside", scanner: "inside", room: "Room1" })).action, "ENTER");
});

test("multiple UIDs keep independent pending transitions", async () => {
  await processScannerDetection({ uid: "123", currentRoom: "Outside", scanner: "outside", room: "Room1" });
  await processScannerDetection({ uid: "456", currentRoom: "Outside", scanner: "outside", room: "Room1" });
  assert.equal((await processScannerDetection({ uid: "123", currentRoom: "Outside", scanner: "inside", room: "Room1" })).action, "ENTER");
  assert.equal((await processScannerDetection({ uid: "456", currentRoom: "Outside", scanner: "inside", room: "Room1" })).action, "ENTER");
});

test("a confirmed transition cannot consume the pending scan again", async () => {
  await processScannerDetection({ uid: "123", currentRoom: "Outside", scanner: "outside", room: "Room1" });
  assert.equal((await processScannerDetection({ uid: "123", currentRoom: "Outside", scanner: "inside", room: "Room1" })).status, "confirmed");
  assert.deepEqual(
    await processScannerDetection({ uid: "123", currentRoom: "Outside", scanner: "inside", room: "Room1" }),
    { status: "ignored" }
  );
});