import { getAdminClient } from "@/lib/supabase/admin";

export const BUCKET = "product-images";
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MIME = ["image/jpeg", "image/png", "image/webp"];

/** Nhận diện loại ảnh từ nội dung file (không tin vào tên hay content-type do trình duyệt gửi). */
function sniff(buf: Buffer): { ext: string; type: string } | null {
  if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ext: "jpg", type: "image/jpeg" };
  }
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { ext: "png", type: "image/png" };
  }
  if (buf.length > 12 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") {
    return { ext: "webp", type: "image/webp" };
  }
  return null;
}

export async function saveProductImage(
  storeId: string,
  productId: string,
  file: File,
): Promise<{ url: string } | { error: string }> {
  if (file.size > MAX_IMAGE_BYTES) return { error: "Ảnh quá lớn (tối đa 2MB)." };
  const buf = Buffer.from(await file.arrayBuffer());
  const kind = sniff(buf);
  if (!kind) return { error: "Chỉ nhận ảnh JPG, PNG hoặc WEBP." };

  const db = getAdminClient();
  const path = `${storeId}/${productId}-${Date.now()}.${kind.ext}`;
  const options = { contentType: kind.type, cacheControl: "31536000" };

  let { error } = await db.storage.from(BUCKET).upload(path, buf, options);
  if (error && /bucket not found/i.test(error.message)) {
    // Lần đầu: tự tạo kho ảnh công khai rồi tải lại
    const created = await db.storage.createBucket(BUCKET, {
      public: true, fileSizeLimit: MAX_IMAGE_BYTES, allowedMimeTypes: MIME,
    });
    if (created.error && !/already exists/i.test(created.error.message)) {
      return { error: `Không tạo được kho ảnh: ${created.error.message}` };
    }
    ({ error } = await db.storage.from(BUCKET).upload(path, buf, options));
  }
  if (error) return { error: `Không tải được ảnh: ${error.message}` };

  const { data } = db.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl };
}

/** Xoá file ảnh cũ theo URL công khai (bỏ qua nếu không phải ảnh của kho này). */
export async function deleteProductImage(url: string | null | undefined): Promise<void> {
  if (!url) return;
  const marker = `/${BUCKET}/`;
  const i = url.indexOf(marker);
  if (i < 0) return;
  const path = decodeURIComponent(url.slice(i + marker.length).split("?")[0]);
  await getAdminClient().storage.from(BUCKET).remove([path]);
}
