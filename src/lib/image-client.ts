/** Thu nhỏ ảnh (trình duyệt) về tối đa 900px và nén WEBP để tải nhanh, không vượt giới hạn dung lượng. */
export async function compressImage(file: File, max = 900, quality = 0.82, outName = "image.webp"): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
  if (!blob) return file;
  return new File([blob], outName, { type: "image/webp" });
}

