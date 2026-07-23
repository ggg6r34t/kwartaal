export type Role = "owner" | "bookkeeper";

export const ROLE_RANK: Record<Role, number> = {
  bookkeeper: 0,
  owner: 1,
};

export function roleAtLeast(role: Role, minimum: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}
