const DEFAULT_MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_IMAGE_SIDE = 1280;

export async function compressImageToDataUrl(
  file: File,
  maxBytes = DEFAULT_MAX_IMAGE_BYTES
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose an image file.");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("The picture could not be read.");
  }

  try {
    const scale = Math.min(
      1,
      MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height)
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("The picture could not be processed.");
    }

    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
    const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
    const imageBytes = Math.floor((base64.length * 3) / 4) - padding;

    if (imageBytes > maxBytes) {
      const maxMegabytes = maxBytes / (1024 * 1024);
      throw new Error(
        `Picture is still larger than ${maxMegabytes} MB after compression.`
      );
    }

    return dataUrl;
  } finally {
    bitmap.close();
  }
}
