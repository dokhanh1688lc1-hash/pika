"use client";

import { ImagePlus } from "lucide-react";
import { useRef, useState } from "react";

/** Thu nhỏ ảnh về tối đa 900px và nén WEBP để tải nhanh, không vượt giới hạn dung lượng. */
async function compress(file: File, max = 900, quality = 0.82): Promise<File> {
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
  return new File([blob], "image.webp", { type: "image/webp" });
}

export function ImagePicker({ name = "image", current }: { name?: string; current?: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(current ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const out = await compress(file);
      const dt = new DataTransfer();
      dt.items.add(out);
      if (inputRef.current) inputRef.current.files = dt.files;
      setPreview(URL.createObjectURL(out));
    } catch {
      // Không nén được (ví dụ ảnh HEIC trên máy không giải mã được): chỉ nhận JPG/PNG/WEBP
      if (/^image\/(jpeg|png|webp)$/.test(file.type)) {
        setPreview(URL.createObjectURL(file));
      } else {
        if (inputRef.current) inputRef.current.value = "";
        setPreview(current ?? null);
        setError("Không đọc được ảnh này. Hãy chọn ảnh JPG, PNG hoặc WEBP (ảnh HEIC: chụp lại ở chế độ 'Tương thích nhất').");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <label className="flex cursor-pointer items-center gap-4">
      <span className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-400">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Ảnh sản phẩm" className="h-full w-full object-cover" />
        ) : (
          <ImagePlus size={24} />
        )}
      </span>
      <span className="text-sm text-slate-600">
        {busy ? "Đang xử lý ảnh…" : preview ? "Bấm để đổi ảnh" : "Chọn ảnh sản phẩm (JPG, PNG, WEBP)"}
        <span className="block text-xs text-slate-400">Ảnh tự thu nhỏ trước khi tải lên</span>
        {error && <span className="mt-1 block text-xs text-rose-600">{error}</span>}
      </span>
      <input ref={inputRef} type="file" name={name} accept="image/*" onChange={onChange} className="hidden" />
    </label>
  );
}
