import { AppError } from "@/lib/errors";

export const ROLES = ["viewer", "member", "admin", "owner"] as const;
export type Role = (typeof ROLES)[number];

export const ACTIONS = {
  "generation.read": ["viewer", "member", "admin", "owner"],
  "generation.create": ["member", "admin", "owner"],
  "generation.delete_own": ["member", "admin", "owner"],
  "generation.delete_any": ["admin", "owner"],
  "generation.share": ["member", "admin", "owner"],
  "credits.read": ["member", "admin", "owner"],
  "billing.manage": ["owner"],
  "members.manage": ["admin", "owner"],
  "api_keys.manage": ["admin", "owner"],
} as const;

export type Action = keyof typeof ACTIONS;

export function authorize(action: Action, role: Role | null) {
  if (!role || !(ACTIONS[action] as readonly string[]).includes(role)) {
    throw new AppError("FORBIDDEN", "You cannot do that in this workspace.");
  }
}
