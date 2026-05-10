import bcrypt from 'bcryptjs';

const PASSWORD_SALT_ROUNDS = 12;

export const hashPassword = (password: string) => bcrypt.hash(password, PASSWORD_SALT_ROUNDS);

export const verifyPassword = (password: string, passwordHash: string) =>
  bcrypt.compare(password, passwordHash);
