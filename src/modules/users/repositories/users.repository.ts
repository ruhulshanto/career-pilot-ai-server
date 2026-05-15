import { prisma } from '@config/prisma.js';
import type { UpdateUserProfilePayload } from '../types/users.types.js';

const userSelect = {
  id: true,
  email: true,
  username: true,
  firstName: true,
  lastName: true,
  role: true,
  avatarUrl: true,
  headline: true,
  bio: true,
  targetRole: true,
  location: true,
  phoneNumber: true,
  showEmail: true,
  currentCompany: true,
  currentPosition: true,
  yearsExperience: true,
  education: true,
  profileSkills: true,
  profileCertifications: true,
  profileProjects: true,
  preferredJobType: true,
  preferredWorkMode: true,
  preferredSalaryRange: true,
  languages: true,
  experienceSummary: true,
  mentorSpecialties: true,
  mentorExpertise: true,
  mentorRating: true,
  mentorCompletedReviews: true,
  socialLinks: true,
  isPublicProfile: true,
  createdAt: true,
  updatedAt: true
} as const;

export const usersRepository = {
  findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: userSelect as any
    });
  },

  updateProfile(id: string, data: UpdateUserProfilePayload) {
    return (prisma.user.update as any)({
      where: { id },
      data: {
        ...data,
        avatarUrl: data.avatarUrl === '' ? null : data.avatarUrl,
        socialLinks: data.socialLinks === null ? null : data.socialLinks ?? undefined,
        education: data.education as any,
        profileSkills: data.profileSkills as any,
        profileCertifications: data.profileCertifications as any,
        profileProjects: data.profileProjects as any,
        languages: data.languages as any,
        mentorSpecialties: data.mentorSpecialties as any,
        mentorExpertise: data.mentorExpertise as any
      },
      select: userSelect as any
    });
  },

  findPublicByUsername(username: string) {
    return (prisma.user.findFirst as any)({
      where: {
        username,
        deletedAt: null,
        isActive: true,
        isPublicProfile: true
      },
      select: userSelect as any
    });
  },

  getPortfolioSignals(userId: string) {
    return Promise.all([
      prisma.aiFeedback.findFirst({
        where: {
          userId,
          type: 'RESUME_ANALYSIS',
          status: 'COMPLETED',
          score: { not: null },
          resume: { deletedAt: null }
        },
        orderBy: { createdAt: 'desc' },
        select: { score: true, strengths: true, weaknesses: true, suggestions: true, rawResponse: true }
      }),
      prisma.careerRoadmap.findFirst({
        where: { userId, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          targetRole: true,
          progress: true,
          skills: true,
          certifications: true,
          projects: true,
          milestoneRecords: {
            orderBy: { sequence: 'asc' },
            select: {
              id: true,
              title: true,
              description: true,
              status: true,
              progress: true,
              completedAt: true
            }
          },
          skillRecords: {
            orderBy: [{ status: 'asc' }, { name: 'asc' }],
            select: {
              name: true,
              category: true,
              targetLevel: true,
              priority: true,
              progress: true,
              status: true
            }
          },
          projectRecords: {
            orderBy: { updatedAt: 'desc' },
            take: 6,
            select: {
              title: true,
              description: true,
              difficulty: true,
              status: true,
              technologies: true
            }
          }
        }
      }),
      prisma.interviewSession.aggregate({
        where: {
          userId,
          deletedAt: null,
          status: 'COMPLETED',
          score: { not: null }
        },
        _avg: { score: true },
        _count: { id: true }
      }),
      prisma.jobApplication.count({
        where: { userId, status: { in: ['APPLIED', 'INTERVIEW_SCHEDULED', 'OFFER'] } }
      }),
      prisma.careerGoal.findMany({
        where: { userId, status: { not: 'ARCHIVED' } },
        orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
        take: 6,
        select: {
          id: true,
          title: true,
          status: true,
          progress: true,
          targetRole: true
        }
      })
    ]);
  }
};
