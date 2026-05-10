import { vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'vitest-mock-extended';

// Use a separate mock for prisma to avoid global side effects
export const prismaMock = mockDeep<PrismaClient>() as unknown as DeepMockProxy<PrismaClient>;

// Mock the prisma singleton
vi.mock('@config/prisma.js', () => ({
  prisma: prismaMock,
}));
