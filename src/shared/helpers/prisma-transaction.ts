import { PrismaClient } from '@prisma/client';
import { prisma } from '@config/prisma.js';

export const runInTransaction = async <T>(
  callback: (
    tx: Omit<
      PrismaClient,
      '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'
    >
  ) => Promise<T>
): Promise<T> => {
  return prisma.$transaction(callback);
};

export const runInTransactionWithRetry = async <T>(
  callback: (
    tx: Omit<
      PrismaClient,
      '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'
    >
  ) => Promise<T>,
  maxRetries: number = 3
): Promise<T> => {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await prisma.$transaction(callback);
    } catch (error) {
      lastError = error as Error;

      // Retry on serialization failures or deadlocks
      if (
        attempt < maxRetries &&
        error instanceof Error &&
        (error.message.includes('serialization') ||
          error.message.includes('deadlock'))
      ) {
        continue;
      }

      throw error;
    }
  }

  throw lastError!;
};
