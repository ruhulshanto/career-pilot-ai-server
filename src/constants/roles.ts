export const USER_ROLES = ['USER', 'ADMIN', 'COACH', 'MENTOR'] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const isValidRole = (role: string): role is UserRole =>
  USER_ROLES.includes(role as UserRole);
