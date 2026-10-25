"use client";

export function RemoveStaffButton({
  id, name, action,
}: { id: string; name: string; action: (form: FormData) => void | Promise<void> }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(`Xoá nhân viên "${name}"? Nếu đã có lịch sử bán hàng, nhân viên sẽ được chuyển sang ngừng hoạt động.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className="rounded-lg px-2 py-1 text-xs text-rose-700 hover:bg-rose-50">Xoá</button>
    </form>
  );
}
