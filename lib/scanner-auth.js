const { timingSafeEqual } = require("node:crypto");

let warnedAboutUnprotectedEndpoint = false;

function isScannerAuthorized(requestKey, configuredKey, nodeEnv) {
  if (configuredKey !== undefined) {
    if (
      typeof requestKey !== "string" ||
      typeof configuredKey !== "string" ||
      requestKey.length === 0 ||
      configuredKey.length === 0
    ) {
      return false;
    }

    const requestBuffer = Buffer.from(requestKey, "utf8");
    const configuredBuffer = Buffer.from(configuredKey, "utf8");
    return (
      requestBuffer.length === configuredBuffer.length &&
      timingSafeEqual(requestBuffer, configuredBuffer)
    );
  }

  if (nodeEnv === "production") {
    return false;
  }

  if (!warnedAboutUnprotectedEndpoint) {
    console.warn(
      "WARNING: SCANNER_API_KEY is not set; the scanner endpoint is unprotected."
    );
    warnedAboutUnprotectedEndpoint = true;
  }

  return true;
}

module.exports = { isScannerAuthorized };
