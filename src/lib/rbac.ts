export type Role = "owner" | "manager" | "cashier" | "technician" | "stock_keeper";

export type Permission =
  | "pos.sell"
  | "orders.refund"
  | "products.manage"
  | "inventory.manage"
  | "customers.manage"
  | "appointments.manage"
  | "staff.manage"
  | "reports.view"
  | "ai.use"
  | "settings.manage";

const ALL: Permission[] = [
  "pos.sell", "orders.refund", "products.manage", "inventory.manage",
  "customers.manage", "appointments.manage", "staff.manage",
  "reports.view", "ai.use", "settings.manage",
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: ALL,
  manager: ALL.filter((p) => p !== "settings.manage"),
  cashier: ["pos.sell", "customers.manage", "appointments.manage"],
  technician: ["appointments.manage"],
  stock_keeper: ["inventory.manage", "products.manage"],
};

export const can = (role: Role, permission: Permission) =>
  ROLE_PERMISSIONS[role].includes(permission);

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Chủ cửa hàng",
  manager: "Quản lý",
  cashier: "Thu ngân",
  technician: "Kỹ thuật viên",
  stock_keeper: "Thủ kho",
};
