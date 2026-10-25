/** Ngân hàng hỗ trợ tạo mã VietQR (mã dùng cho img.vietqr.io). */
export const BANKS: { code: string; name: string }[] = [
  { code: "VCB", name: "Vietcombank" }, { code: "TCB", name: "Techcombank" }, { code: "MB", name: "MB Bank" },
  { code: "ACB", name: "ACB" }, { code: "BIDV", name: "BIDV" }, { code: "ICB", name: "VietinBank" },
  { code: "VBA", name: "Agribank" }, { code: "VPB", name: "VPBank" }, { code: "TPB", name: "TPBank" },
  { code: "STB", name: "Sacombank" }, { code: "VIB", name: "VIB" }, { code: "HDB", name: "HDBank" },
  { code: "SHB", name: "SHB" }, { code: "OCB", name: "OCB" }, { code: "MSB", name: "MSB" },
  { code: "EIB", name: "Eximbank" }, { code: "SEAB", name: "SeABank" }, { code: "LPB", name: "LPBank" },
  { code: "ABB", name: "ABBank" }, { code: "NAB", name: "Nam A Bank" }, { code: "BAB", name: "Bac A Bank" },
  { code: "NCB", name: "NCB" }, { code: "VAB", name: "VietABank" }, { code: "PVCB", name: "PVcomBank" },
];

export interface BankInfo { code: string; account: string; holder: string }

/** Link ảnh QR chuyển khoản đã điền sẵn số tiền và nội dung. */
export function vietQrUrl(bank: BankInfo, amount: number, info: string): string {
  const q = new URLSearchParams({
    amount: String(Math.max(Math.floor(amount), 0)),
    addInfo: info,
    accountName: bank.holder,
  });
  return `https://img.vietqr.io/image/${encodeURIComponent(bank.code)}-${encodeURIComponent(bank.account)}-compact2.png?${q}`;
}
