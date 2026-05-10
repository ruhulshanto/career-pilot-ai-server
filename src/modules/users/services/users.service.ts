import { usersRepository } from '@modules/users/repositories/users.repository.js';
import { ApiError } from '@shared/errors/api-error.js';

export const usersService = {
  async getProfile(userId: string) {
    const user = await usersRepository.findById(userId);

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    return user;
  }
};
