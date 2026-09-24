const assert = require("node:assert/strict");
const test = require("node:test");
const {
  processScannerDetection,
  resetScannerState,
} = require("../lib/scanner-state");

test.beforeEach(resetScannerState);

test("repeated outside reads do not create an enter", () => {
  assert.equal(processScannerDetection({ uid: "123", currentRoom: "Outside", scanner: "outside", room: "Room1" }).status, "pending");
  assert.equal(processScannerDetection({ uid: "123", currentRoom: "Outside", scanner: "outside", room: "Room1" }).status, "pending");
});

test("outside then inside confirms one enter and repeated inside reads only wait", () => {
  processScannerDetection({ uid: "123", currentRoom: "Outside", scanner: "outside", room: "Room1" });
  const transition = processScannerDetection({ uid: "123", currentRoom: "Outside", scanner: "inside", room: "Room1" });
  assert.deepEqual(transition, { status: "confirmed", action: "ENTER", fromRoom: "-", toRoom: "Room1", nextRoom: "Room1" });
  assert.equal(processScannerDetection({ uid: "123", currentRoom: "Room1", scanner: "inside", room: "Room1" }).status, "pending");
});

test("inside then outside confirms one exit", () => {
  processScannerDetection({ uid: "123", currentRoom: "Room1", scanner: "inside", room: "Room1" });
  assert.equal(processScannerDetection({ uid: "123", currentRoom: "Room1", scanner: "inside", room: "Room1" }).status, "pending");
  assert.equal(processScannerDetection({ uid: "123", currentRoom: "Room1", scanner: "outside", room: "Room1" }).action, "EXIT");
});

test("wrong order and different UIDs never pair", () => {
  assert.equal(processScannerDetection({ uid: "123", currentRoom: "Outside", scanner: "inside", room: "Room1" }).status, "ignored");
  processScannerDetection({ uid: "123", currentRoom: "Outside", scanner: "outside", room: "Room1" });
  assert.equal(processScannerDetection({ uid: "456", currentRoom: "Outside", scanner: "inside", room: "Room1" }).status, "ignored");
  assert.equal(processScannerDetection({ uid: "123", currentRoom: "Outside", scanner: "inside", room: "Room1" }).action, "ENTER");
});

test("multiple UIDs keep independent pending transitions", () => {
  processScannerDetection({ uid: "123", currentRoom: "Outside", scanner: "outside", room: "Room1" });
  processScannerDetection({ uid: "456", currentRoom: "Outside", scanner: "outside", room: "Room1" });
  assert.equal(processScannerDetection({ uid: "123", currentRoom: "Outside", scanner: "inside", room: "Room1" }).action, "ENTER");
  assert.equal(processScannerDetection({ uid: "456", currentRoom: "Outside", scanner: "inside", room: "Room1" }).action, "ENTER");
});