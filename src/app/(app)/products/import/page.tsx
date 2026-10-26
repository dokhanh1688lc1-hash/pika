import Link from "next/link";
import { ExcelImportForm } from "@/components/ExcelImportForm";
import { PageHeader } from "@/components/ui";
import { requireMember } from "@/lib/guard";
import { importProducts } from "./actions";

export default async function ImportProductsPage() {
  await requireMember("products.manage", "/products");
  return (
    <>
      <PageHeader title="Nhập hàng hoá từ Excel" subtitle="Thêm mới hoặc cập nhật nhiều sản phẩm cùng lúc" />
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <a href="/api/excel/template?type=products" className="btn-secondary">Tải file mẫu</a>
        <a href="/api/excel/export?type=products" className="btn-secondary">Xuất danh sách hiện có</a>
        <Link href="/products" className="btn-secondary">← Quay lại</Link>
      </div>
      <div className="card mb-4 space-y-1 text-sm text-gray-600">
        <p>• Dòng 1 là tiêu đề cột. Cột bắt buộc: <b>Mã (SKU)</b>; mã mới cần thêm <b>Tên</b>.</p>
        <p>• Mã đã có → cập nhật Tên, Nhóm hàng, Giá bán, Giá vốn, Tồn tối thiểu, Số buổi (ô trống thì giữ nguyên).</p>
        <p>• Mã chưa có → tạo mới. Loại: Hàng hoá / Dịch vụ / Liệu trình (mặc định Hàng hoá). Có thể điền <b>Tồn đầu kỳ</b> cho hàng mới.</p>
        <p>• Nếu có bất kỳ lỗi nào, hệ thống không lưu gì và báo rõ từng dòng. Tối đa 2000 dòng, 5MB.</p>
      </div>
      <ExcelImportForm action={importProducts} />
    </>
  );
}
