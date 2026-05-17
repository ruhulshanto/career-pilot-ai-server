import { z } from 'zod';

const emptyToNull = (value: unknown) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const trimString = (value: unknown) =>
  typeof value === 'string' ? value.trim() : value;

const normalizeUrl = (value: unknown) => {
  if (value === null) return '';
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return '';
  return /^[a-z][a-z\d+\-.]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

const nullableText = (max: number) =>
  z.preprocess(emptyToNull, z.string().trim().max(max).nullable().optional());

const urlOrEmpty = z.preprocess(
  normalizeUrl,
  z
    .string()
    .url('Use a valid full URL, for example https://linkedin.com/in/username.')
    .refine(
      (value) => /^https?:\/\//i.test(value),
      'Only http and https links are supported.'
    )
    .or(z.literal(''))
    .optional()
);

const cleanStringArray = (maxItems: number, maxLength = 80) =>
  z.preprocess(
    (value) => (value === null ? [] : value),
    z.array(z.preprocess(trimString, z.string().min(1).max(maxLength))).max(maxItems).optional()
  );

const cleanObjectArray = z.preprocess(
  (value) => (value === null ? [] : value),
  z.array(z.record(z.unknown())).optional()
);

const nullableInt = z.preprocess((value) => {
  if (value === '' || value === null) return null;
  if (typeof value === 'string' && value.trim() !== '') return Number(value);
  return value;
}, z.number().int().min(0).max(60).nullable().optional());

const nullableWorkMode = z.preprocess(
  emptyToNull,
  z.enum(['REMOTE', 'HYBRID', 'ONSITE']).nullable().optional()
);

const socialLinksSchema = z.preprocess(
  (value) => (value === null ? {} : value),
  z
    .object({
      linkedin: urlOrEmpty,
      github: urlOrEmpty,
      portfolio: urlOrEmpty,
      website: urlOrEmpty
    })
    .optional()
);

export const updateUserProfileSchema = z.object({
  username: z
    .preprocess(trimString, z.string().min(3).max(40).regex(/^[a-zA-Z0-9_-]+$/))
    .optional(),
  firstName: z.preprocess(trimString, z.string().min(1).max(80)).optional(),
  lastName: z.preprocess(trimString, z.string().min(1).max(80)).optional(),
  headline: nullableText(160),
  bio: nullableText(1200),
  targetRole: nullableText(120),
  location: nullableText(120),
  phoneNumber: nullableText(40),
  showEmail: z.boolean().optional(),
  currentCompany: nullableText(120),
  currentPosition: nullableText(120),
  yearsExperience: nullableInt,
  education: cleanObjectArray,
  profileSkills: cleanStringArray(80),
  profileCertifications: cleanObjectArray,
  profileProjects: cleanObjectArray,
  preferredJobType: nullableText(80),
  preferredWorkMode: nullableWorkMode,
  preferredSalaryRange: nullableText(120),
  languages: cleanStringArray(30),
  experienceSummary: nullableText(1600),
  mentorSpecialties: cleanStringArray(20),
  mentorExpertise: cleanStringArray(30),
  socialLinks: socialLinksSchema,
  avatarUrl: urlOrEmpty,
  isPublicProfile: z.boolean().optional()
});
