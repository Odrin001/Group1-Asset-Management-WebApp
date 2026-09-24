const pendingScans = new Map();

function processScannerDetection({ uid, currentRoom, scanner, room }) {
  const expectedScanner = currentRoom === "Outside" ? "outside" : "inside";
  const pendingScanner = pendingScans.get(uid);

  if (scanner === expectedScanner) {
    pendingScans.set(uid, scanner);
    return { status: "pending" };
  }

  if (pendingScanner !== expectedScanner || scanner === pendingScanner) {
    return { status: "ignored" };
  }

  pendingScans.delete(uid);
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
  pendingScans.clear();
}

module.exports = { processScannerDetection, resetScannerState };