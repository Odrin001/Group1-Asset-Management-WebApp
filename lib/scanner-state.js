function createInMemoryStore() {
  const pendingScans = new Map();

  return {
    async markPending(uid, scanner) {
      pendingScans.set(uid, scanner);
    },
    async consumePending(uid, expectedScanner) {
      if (pendingScans.get(uid) !== expectedScanner) {
        return false;
      }

      pendingScans.delete(uid);
      return true;
    },
    reset() {
      pendingScans.clear();
    },
  };
}

const inMemoryStore = createInMemoryStore();

/**
 * @typedef {{
 *   markPending: (uid: string, scanner: string) => Promise<void>,
 *   consumePending: (uid: string, expectedScanner: string) => Promise<boolean>
 * }} PendingScanStore
 */

/**
 * @param {{ uid: string, currentRoom: string, scanner: string, room: string }} detection
 * @param {PendingScanStore} [store]
 */
async function processScannerDetection(
  detection,
  store = inMemoryStore
) {
  const { uid, currentRoom, scanner, room } = detection;
  const expectedScanner = currentRoom === "Outside" ? "outside" : "inside";

  if (scanner === expectedScanner) {
    await store.markPending(uid, scanner);
    return { status: "pending" };
  }

  const consumed = await store.consumePending(uid, expectedScanner);
  if (!consumed) {
    return { status: "ignored" };
  }

  const action = expectedScanner === "outside" ? "ENTER" : "EXIT";
  return {
    status: "confirmed",
    action,
    fromRoom: action === "ENTER" ? "-" : currentRoom,
    toRoom: action === "ENTER" ? room : "-",
    nextRoom: action === "ENTER" ? room : "Outside",
  };
}

function resetScannerState() {
  inMemoryStore.reset();
}

module.exports = { processScannerDetection, resetScannerState };