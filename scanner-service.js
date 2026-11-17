const fs = require("node:fs");
const path = require("node:path");

const configPath = path.join(__dirname, "scanner-config.json");
let scannerConfig = {};

if (fs.existsSync(configPath)) {
  try {
    scannerConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
    if (
      typeof scannerConfig !== "object" ||
      scannerConfig === null ||
      Array.isArray(scannerConfig)
    ) {
      throw new Error("Configuration must be a JSON object");
    }
  } catch (err) {
    console.error(`❌ Invalid scanner configuration at ${configPath}:`, err.message);
    process.exit(1);
  }
}

const apiUrl =
  typeof scannerConfig.apiUrl === "string"
    ? scannerConfig.apiUrl
    : "http://localhost:3000/api/scanner";
const apiKey =
  typeof scannerConfig.apiKey === "string" && scannerConfig.apiKey.length > 0
    ? scannerConfig.apiKey
    : undefined;
const room = typeof scannerConfig.room === "string" ? scannerConfig.room : "Room1";
const insidePort =
  typeof scannerConfig.insidePort === "string" ? scannerConfig.insidePort : "COM5";
const outsidePort =
  typeof scannerConfig.outsidePort === "string" ? scannerConfig.outsidePort : "COM6";

const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");

const scanners = [
  { path: insidePort, side: "inside" },
  { path: outsidePort, side: "outside" },
];

const ports = scanners.map(({ path, side }) => {
  const port = new SerialPort({ path, baudRate: 9600 });
  const parser = port.pipe(new ReadlineParser({ delimiter: "\r\n" }));

  port.on("open", () => {
    console.log(`✅ RFID Scanner Connected on ${path} (${side})`);
  });

  port.on("error", (err) => {
    console.error(`❌ Serial error on ${path}:`, err.message);
  });

  parser.on("data", (uid) => handleScan(uid, side));
  return port;
});

process.on("SIGINT", () => {
  console.log("🔄 Closing serial port...");
  closePorts();
});

process.on("SIGTERM", () => {
  console.log("🔄 Closing serial port...");
  closePorts();
});

function closePorts() {
  let remaining = ports.length;
  ports.forEach((port) => {
    port.close((err) => {
      if (err) console.error("❌ Error closing port:", err.message);
      remaining -= 1;
      if (remaining === 0) process.exit(0);
    });
  });
}

async function handleScan(uid, scanner) {
  uid = uid.replace(/[^0-9]/g, "").trim();

  if (!uid) return;

  console.log(`📡 Scan detected on ${scanner}:`, uid);

  try {
    const headers = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers["x-scanner-key"] = apiKey;
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        uid,
        room,
        scanner,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      console.log("✅ Scan recorded:", data);
    } else {
      const message =
        typeof data.message === "string" ? data.message : response.statusText;
      console.error(
        `❌ Server rejected scan (status ${response.status}): ${message}`
      );
    }
  } catch (err) {
    console.error("❌ API Error:", err.message);
  }
}