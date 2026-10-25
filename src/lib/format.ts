export const vnd = (n: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(n);

export const num = (n: number) => new Intl.NumberFormat("vi-VN").format(n);
