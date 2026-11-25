export type Role = "admin" | "sales" | "warehouse" | "purchasing" | "booker" | "delivery" | "recovery";

export interface User {
  id: string;
  name: string;
  initials: string;
  role: Role;
  title: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  brand: string;
  packSize: number; // pcs per carton
  cartonPrice: number;
  taxPct: number;
  stock: number; // pcs physically in warehouse (incl. reserved)
  reserved: number; // pcs reserved against approved orders
  reorder: number; // pcs
  expiry?: string;
  hue: number; // thumbnail colour
}

export interface Customer {
  id: string;
  name: string;
  area: string;
  route: string;
  bookerId: string;
  type: "credit" | "cash";
  creditLimit: number;
  creditDays: number;
  balance: number;
  oldestDue: number; // days since oldest unpaid invoice
  phone: string;
}

export type Unit = "ctn" | "pcs";

export interface Line {
  productId: string;
  unit: Unit;
  qty: number;
  rate: number; // per selected unit
  discPct: number;
  pickedQty?: number; // set by warehouse (in same unit)
}

export type OrderStatus =
  | "booked"
  | "approved"
  | "picked"
  | "invoiced"
  | "delivered"
  | "paid"
  | "hold"
  | "cancelled";

export interface Stamp {
  status: OrderStatus;
  at: number;
  by: string; // initials
}

export interface Order {
  id: string;
  folio: string;
  customerId: string;
  bookerId: string;
  lines: Line[];
  status: OrderStatus;
  createdAt: number;
  trail: Stamp[];
  challanNo?: string;
  invoiceNo?: string;
  deliveryBoyId?: string;
  paid: number;
  note?: string;
  returned?: number; // credit note value
  signature?: string; // data URL captured by KE
  filed?: boolean; // invoice filed by KE on credit
}

export interface PurchaseLine {
  productId: string;
  ordered: number; // cartons
  received?: number; // cartons
}
export interface PurchaseOrder {
  id: string;
  folio: string;
  supplier: string;
  lines: PurchaseLine[];
  status: "ordered" | "received" | "approved";
  createdAt: number;
}

export interface Payment {
  id: string;
  customerId: string;
  orderId?: string;
  amount: number;
  at: number;
  by: string;
}

export interface ReturnNote {
  id: string;
  folio: string;
  orderId: string;
  customerId: string;
  productId: string;
  qtyPcs: number;
  condition: "good" | "damaged";
  value: number;
  at: number;
}

export interface Activity {
  id: string;
  at: number;
  text: string;
}
