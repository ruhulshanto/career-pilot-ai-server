import type { UserRole } from '@constants/roles.js';

declare global {
  namespace Express {
    interface User {
      id: string;
      role: UserRole;
      sessionId?: string;
    }

    interface Request {
      user?: User;
    }
  }
}

export {};
