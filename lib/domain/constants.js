export const EMPLOYEE_ROLES = Object.freeze({
  OWNER: "OWNER",
  ADMIN: "ADMIN",
  MANAGER: "MANAGER",
  CASHIER: "CASHIER",
  WAITER: "WAITER",
  KITCHEN: "KITCHEN",
  BAR: "BAR",
});

export const PREP_STATIONS = Object.freeze({
  KITCHEN: "KITCHEN",
  BAR: "BAR",
});

export const SESSION_STATUS = Object.freeze({
  OPEN: "OPEN",
  PAYMENT_PENDING: "PAYMENT_PENDING",
  CLOSED: "CLOSED",
  CANCELLED: "CANCELLED",
});

export const ORDER_ITEM_STATUS = Object.freeze({
  NEW: "NEW",
  PREPARING: "PREPARING",
  READY: "READY",
  SENT: "SENT",
  CANCELLED: "CANCELLED",
});
