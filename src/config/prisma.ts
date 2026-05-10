import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

type PrismaErrorListener = {
  $on(event: 'error', listener: (event: unknown) => void): void;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error']
  });

const prismaWithListeners = prisma as PrismaErrorListener;
prismaWithListeners.$on('error', (event) => {
  console.error('Prisma client error:', event);
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
