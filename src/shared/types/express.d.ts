import type { UserRole } from '@constants/roles.js';

declare global {
  namespace Express {
    interface User {
      id: string;
      role: UserRole;
    }

    interface Request {
      user?: User;
    }
  }
}

export {};
