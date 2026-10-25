"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getMembership } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { defaultBranchId } from "@/lib/guard";
import { can } from "@/lib/rbac";
import { getAdminClient } from "@/lib/supabase/admin";

const Input = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().min(1).max(1000),
        staffId: z.string().uuid().nullable(),
      }),
    )
    .min(1)
    .max(100),
  customerId: z.string().uuid().nullable(),
  method: z.enum(["cash", "transfer", "card", "ewallet"]),
  paid: z.number().int().min(0).max(10_000_000_000),
  discount: z.number().int().min(0).max(10_000_000_000),
  note: z.string().max(300),
});

export type CheckoutInput = z.infer<typeof Input>;

export type CheckoutResult =
  | { ok: true; code: string; total: number; paid: number; status: string; points: number }
  | { ok: false; error: string };

export async function checkout(raw: CheckoutInput): Promise<CheckoutResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Đang ở chế độ demo: hãy kết nối Supabase để lưu đơn hàng." };
  }
  const member = await getMembership();
  if (!member) return { ok: false, error: "Chưa đăng nhập." };
  if (!can(member.role, "pos.sell")) return { ok: false, error: "Bạn không có quyền bán hàng." };

  const parsed = Input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dữ liệu đơn hàng không hợp lệ." };
  const input = parsed.data;

  const branch = await defaultBranchId(member.storeId);
  if (!branch) return { ok: false, error: "Cửa hàng chưa có chi nhánh." };

  // Giá luôn lấy từ database trong hàm create_pos_order, không dùng giá từ trình duyệt
  const { data, error } = await getAdminClient().rpc("create_pos_order", {
    p_store: member.storeId,
    p_branch: branch,
    p_cashier: member.staffId,
    p_customer: input.customerId,
    p_items: input.items.map((i) => ({
      product_id: i.productId, quantity: i.quantity, staff_id: i.staffId,
    })),
    p_payments: input.paid > 0 ? [{ method: input.method, amount: input.paid }] : [],
    p_discount: input.discount,
    p_note: input.note || null,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/orders");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  revalidatePath("/customers");
  return {
    ok: true,
    code: String(data.code),
    total: Number(data.total),
    paid: Number(data.paid),
    status: String(data.status),
    points: Number(data.points),
  };
}
