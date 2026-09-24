const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");

const scanners = [
  { path: "COM5", side: "inside" },
  { path: "COM6", side: "outside" },
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
    const response = await fetch(
      "http://localhost:3000/api/scanner",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uid,
          room: "Room1",
          scanner,
        }),
      }
    );

    const data = await response.json();

    console.log("✅ Scan recorded:", data);
  } catch (err) {
    console.error("❌ API Error:", err.message);
  }
}