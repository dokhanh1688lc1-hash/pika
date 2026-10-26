import Link from "next/link";
import { ExcelImportForm } from "@/components/ExcelImportForm";
import { PageHeader } from "@/components/ui";
import { requireMember } from "@/lib/guard";
import { importStock } from "./actions";

export default async function ImportStockPage() {
  await requireMember("inventory.manage", "/inventory");
  return (
    <>
      <PageHeader title="Nhập kho từ Excel" subtitle="Nhập hàng hoặc kiểm kho nhiều sản phẩm cùng lúc (chi nhánh chính)" />
      <div className="mb-4 flex flex-wrap gap-2">
        <a href="/api/excel/template?type=stock" className="btn-secondary">Tải file mẫu</a>
        <a href="/api/excel/export?type=stock" className="btn-secondary">Xuất tồn kho hiện tại</a>
        <Link href="/inventory" className="btn-secondary">← Quay lại</Link>
      </div>
      <div className="card mb-4 space-y-1 text-sm text-gray-600">
        <p>• Cột: <b>Mã SP</b>*, <b>Số lượng</b>*, Giá nhập, Hạn sử dụng (dd/mm/yyyy), Số lô, Ghi chú.</p>
        <p>• <b>Nhập thêm</b>: cộng số lượng vào tồn (tạo lô nếu có hạn dùng). <b>Kiểm kho</b>: đặt tồn đúng bằng số lượng trong file.</p>
        <p>• Mã phải có sẵn (thêm sản phẩm mới ở trang Hàng hoá). Có lỗi thì không lưu gì.</p>
      </div>
      <ExcelImportForm action={importStock}>
        <fieldset className="flex gap-6 text-sm">
          <label className="flex items-center gap-2"><input type="radio" name="mode" value="in" defaultChecked /> Nhập thêm</label>
          <label className="flex items-center gap-2"><input type="radio" name="mode" value="set" /> Kiểm kho (đặt lại tồn)</label>
        </fieldset>
      </ExcelImportForm>
    </>
  );
}
