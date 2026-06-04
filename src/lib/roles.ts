export type UserRole = "admin" | "merchant" | "customer";

export function isAdminRole(role: string | undefined | null): role is "admin" {
  return role === "admin";
}

export function isStaffRole(role: string | undefined | null): role is "admin" | "merchant" {
  return role === "admin" || role === "merchant";
}
