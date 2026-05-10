import { describe, it, expect, vi } from 'vitest';
import { authService } from '@modules/auth/services/auth.service.js';
import { prismaMock } from '../mocks/prisma.mock.js';
import bcrypt from 'bcryptjs';

describe('AuthService', () => {
  describe('register', () => {
    it('should create a new user and return tokens', async () => {
      const userData = {
        firstName: 'Test',
        lastName: 'User',
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      // Mock prisma.user.findUnique to return null (user doesn't exist)
      prismaMock.user.findUnique.mockResolvedValue(null);
      
      // Mock prisma.user.create
      prismaMock.user.create.mockResolvedValue({
        id: 'user_123',
        email: userData.email,
        username: userData.username,
        firstName: userData.firstName,
        lastName: userData.lastName,
        passwordHash: 'hashed_password',
        role: 'USER',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        avatarUrl: null,
        headline: null,
        location: null,
        lastLoginAt: null
      });

      const result = await authService.register(userData);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(prismaMock.user.create).toHaveBeenCalled();
    });

    it('should throw error if email is already taken', async () => {
      const userData = {
        firstName: 'Test',
        lastName: 'User',
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      prismaMock.user.findUnique.mockResolvedValue({ id: 'existing' } as any);

      await expect(authService.register(userData)).rejects.toThrow('Email already taken');
    });
  });
});
