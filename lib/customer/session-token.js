import { createHash, randomBytes } from "node:crypto";

export const CUSTOMER_COOKIE = "comanda_customer_token";

export function createCustomerToken() {
  return randomBytes(32).toString("base64url");
}

export function hashCustomerToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export const customerCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 12,
};
