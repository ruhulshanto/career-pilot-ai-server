import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

import { errorMiddleware } from '@middlewares/error.middleware.js';
import { usersService } from '@modules/users/services/users.service.js';
import { updateUserProfileSchema } from '@modules/users/validations/users.validation.js';
import { prismaMock } from '../mocks/prisma.mock.js';

describe('User profile updates', () => {
  it('normalizes profile update input before persistence', () => {
    const parsed = updateUserProfileSchema.parse({
      username: ' shanto_dev ',
      firstName: ' Shanto ',
      headline: ' ',
      preferredWorkMode: '',
      yearsExperience: '',
      profileSkills: [' React ', 'Node.js'],
      languages: [' English ', 'Bangla'],
      socialLinks: {
        linkedin: 'linkedin.com/in/shanto',
        github: '',
      },
    });

    expect(parsed).toMatchObject({
      username: 'shanto_dev',
      firstName: 'Shanto',
      headline: null,
      preferredWorkMode: null,
      yearsExperience: null,
      profileSkills: ['React', 'Node.js'],
      languages: ['English', 'Bangla'],
      socialLinks: {
        linkedin: 'https://linkedin.com/in/shanto',
        github: '',
      },
    });
  });

  it('supports empty optional profile sections without failing validation', () => {
    const parsed = updateUserProfileSchema.parse({
      bio: '',
      targetRole: null,
      location: undefined,
      education: null,
      profileCertifications: null,
      profileProjects: [],
      profileSkills: null,
      languages: null,
      socialLinks: null,
    });

    expect(parsed).toMatchObject({
      bio: null,
      targetRole: null,
      education: [],
      profileCertifications: [],
      profileProjects: [],
      profileSkills: [],
      languages: [],
      socialLinks: {},
    });
    expect(parsed).toHaveProperty('location', undefined);
  });

  it('accepts partial PATCH updates without requiring the full profile shape', () => {
    const parsed = updateUserProfileSchema.parse({
      targetRole: ' AI Product Engineer ',
    });

    expect(parsed).toEqual({
      targetRole: 'AI Product Engineer',
    });
  });

  it('ignores avatarUrl in profile PATCH because photos use the upload endpoint', () => {
    const parsed = updateUserProfileSchema.parse({
      firstName: 'Shanto',
      avatarUrl: '/uploads/local-profile-photo.png',
    });

    expect(parsed).toEqual({
      firstName: 'Shanto',
    });
  });

  it('returns field-level validation errors for invalid profile payloads', () => {
    const result = updateUserProfileSchema.safeParse({
      preferredWorkMode: 'Remote',
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    const json = vi.fn();
    const status = vi.fn(() => ({ json }));

    errorMiddleware(
      result.error,
      {} as any,
      { status } as any,
      vi.fn(),
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        code: 'VALIDATION_ERROR',
        details: expect.objectContaining({
          issues: expect.arrayContaining([
            expect.objectContaining({
              field: 'preferredWorkMode',
            }),
          ]),
        }),
      }),
    );
  });

  it('accepts only backend-safe preferred work mode enum values', () => {
    for (const preferredWorkMode of ['REMOTE', 'HYBRID', 'ONSITE'] as const) {
      const parsed = updateUserProfileSchema.parse({ preferredWorkMode });
      expect(parsed.preferredWorkMode).toBe(preferredWorkMode);
    }

    expect(
      updateUserProfileSchema.safeParse({ preferredWorkMode: 'Hybrid' }).success,
    ).toBe(false);
  });

  it('rejects non-http profile links', () => {
    const result = updateUserProfileSchema.safeParse({
      socialLinks: {
        website: 'javascript:alert(1)',
      },
    });

    expect(result.success).toBe(false);
  });

  it('returns a safe conflict error when username is already taken', async () => {
    const duplicateUsernameError = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on the fields: (`username`)',
      {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['username'] },
      },
    );

    prismaMock.user.update.mockRejectedValueOnce(duplicateUsernameError);

    await expect(
      usersService.updateProfile('user_123', { username: 'taken_username' }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'USERNAME_TAKEN',
      message: 'That username is already taken.',
    });
  });
});
