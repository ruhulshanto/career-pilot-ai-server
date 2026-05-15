import { usersRepository } from '@modules/users/repositories/users.repository.js';
import { ApiError } from '@shared/errors/api-error.js';
import { Prisma } from '@prisma/client';
import type { UpdateUserProfilePayload } from '../types/users.types.js';

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') {
        const record = item as Record<string, unknown>;
        return typeof record.name === 'string'
          ? record.name
          : typeof record.title === 'string'
            ? record.title
            : null;
      }
      return null;
    })
    .filter((item): item is string => Boolean(item));
};

const asObjectArray = (value: unknown): Array<Record<string, unknown>> =>
  Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === 'object' && !Array.isArray(item)
      )
    : [];

const profileCompletion = (
  user: any,
  signals: {
    hasRoadmap: boolean;
    hasInterviewActivity: boolean;
    hasGoals: boolean;
  }
) => {
  const links = user.socialLinks && typeof user.socialLinks === 'object'
    ? Object.values(user.socialLinks).filter(Boolean).length
    : 0;
  const skills = asStringArray(user.profileSkills).length;
  const education = asObjectArray(user.education).length;
  const fields = [
    user.avatarUrl,
    user.bio,
    skills > 0 ? 'skills' : null,
    education > 0 ? 'education' : null,
    signals.hasRoadmap ? 'roadmap' : null,
    signals.hasInterviewActivity ? 'interview' : null,
    signals.hasGoals ? 'goals' : null,
    user.targetRole,
    links > 0 ? 'links' : null
  ];
  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
};

const buildAchievements = (signals: {
  atsScore: number;
  interviewCount: number;
  roadmapProgress: number;
  applicationsSent: number;
  completedMilestones: number;
}) =>
  [
    signals.atsScore >= 75
      ? {
          id: 'resume-optimized',
          title: 'Resume Optimized',
          description: `ATS score reached ${signals.atsScore}/100.`
        }
      : null,
    signals.interviewCount > 0
      ? {
          id: 'first-interview-complete',
          title: 'First Interview Complete',
          description: 'Completed at least one mock interview.'
        }
      : null,
    signals.roadmapProgress > 0
      ? {
          id: 'roadmap-started',
          title: 'Roadmap Started',
          description: 'Started a personalized career roadmap.'
        }
      : null,
    signals.applicationsSent >= 5
      ? {
          id: 'five-applications-sent',
          title: '5 Applications Sent',
          description: 'Tracked five active job applications.'
        }
      : null,
    signals.completedMilestones > 0
      ? {
          id: 'skill-milestone-complete',
          title: 'Skill Milestone Complete',
          description: 'Completed a roadmap milestone.'
        }
      : null
  ].filter((item): item is { id: string; title: string; description: string } => item !== null);

const mapPortfolio = async (user: any) => {
  const [resumeFeedback, roadmap, interviewAggregate, applicationsSent, careerGoals] =
    await usersRepository.getPortfolioSignals(user.id);
  const raw = (resumeFeedback?.rawResponse ?? {}) as Record<string, unknown>;
  const atsScore = Math.round(
    typeof raw.atsScore === 'number' ? raw.atsScore : resumeFeedback?.score ?? 0
  );
  const interviewReadiness = Math.round(interviewAggregate._avg.score ?? 0);
  const completedMilestones =
    roadmap?.milestoneRecords.filter((item) => item.status === 'COMPLETED') ?? [];
  const roadmapProgress = Math.round(roadmap?.progress ?? 0);
  const skills = roadmap?.skillRecords?.length
    ? [
        ...asStringArray(user.profileSkills).map((name) => ({ name, source: 'profile' })),
        ...roadmap.skillRecords.map((skill) => ({
        name: skill.name,
        category: skill.category,
        targetLevel: skill.targetLevel,
        priority: skill.priority,
        progress: Math.round(skill.progress),
        status: skill.status,
        source: 'roadmap'
      }))
      ]
    : [
        ...asStringArray(user.profileSkills).map((name) => ({ name, source: 'profile' })),
        ...asStringArray(roadmap?.skills).map((name) => ({ name, source: 'roadmap' }))
      ];
  const projects = [
    ...asObjectArray(user.profileProjects).map((project) => ({
      title: String(project.title ?? 'Project'),
      description: typeof project.description === 'string' ? project.description : undefined,
      url: typeof project.url === 'string' ? project.url : undefined,
      technologies: asStringArray(project.technologies),
      source: 'profile'
    })),
    ...(roadmap?.projectRecords?.length
      ? roadmap.projectRecords.map((project) => ({
        title: project.title,
        description: project.description,
        difficulty: project.difficulty,
        status: project.status,
        technologies: asStringArray(project.technologies),
        source: 'roadmap'
      }))
      : asStringArray(roadmap?.projects).map((title) => ({ title, source: 'roadmap' })))
  ];
  const certifications = [
    ...asObjectArray(user.profileCertifications).map((certification) => ({
      title: String(certification.title ?? 'Certification'),
      issuer: typeof certification.issuer === 'string' ? certification.issuer : undefined,
      url: typeof certification.url === 'string' ? certification.url : undefined,
      source: 'profile'
    })),
    ...asStringArray(roadmap?.certifications).map((title) => ({ title, source: 'roadmap' }))
  ];

  const signals = {
    atsScore,
    interviewCount: interviewAggregate._count.id,
    roadmapProgress,
    applicationsSent,
    completedMilestones: completedMilestones.length
  };

  return {
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.showEmail ? user.email : undefined,
      avatarUrl: user.avatarUrl,
      headline: user.headline,
      bio: user.bio,
      targetRole: user.targetRole ?? roadmap?.targetRole,
      location: user.location,
      phoneNumber: user.phoneNumber,
      showEmail: user.showEmail,
      currentCompany: user.currentCompany,
      currentPosition: user.currentPosition,
      yearsExperience: user.yearsExperience,
      education: asObjectArray(user.education),
      preferredJobType: user.preferredJobType,
      preferredWorkMode: user.preferredWorkMode,
      preferredSalaryRange: user.preferredSalaryRange,
      languages: asStringArray(user.languages),
      experienceSummary: user.experienceSummary,
      mentorSpecialties: asStringArray(user.mentorSpecialties),
      mentorExpertise: asStringArray(user.mentorExpertise),
      mentorRating: user.mentorRating,
      mentorCompletedReviews: user.mentorCompletedReviews,
      socialLinks: user.socialLinks,
      isPublicProfile: user.isPublicProfile
    },
    stats: {
      atsScore,
      interviewReadiness,
      roadmapProgress,
      applicationsSent,
      completedMilestones: completedMilestones.length,
      profileCompletion: profileCompletion(user, {
        hasRoadmap: roadmapProgress > 0,
        hasInterviewActivity: interviewAggregate._count.id > 0,
        hasGoals: careerGoals.length > 0
      })
    },
    roadmap: roadmap
      ? {
          id: roadmap.id,
          targetRole: roadmap.targetRole,
          progress: roadmapProgress,
          completedMilestones: completedMilestones.slice(0, 6).map((item) => ({
            id: item.id,
            title: item.title,
            description: item.description,
            completedAt: item.completedAt
          }))
        }
      : null,
    skills,
    certifications,
    projects,
    careerGoals: careerGoals.map((goal) => ({
      id: goal.id,
      title: goal.title,
      status: goal.status,
      progress: Math.round(goal.progress),
      targetRole: goal.targetRole
    })),
    achievements: buildAchievements(signals)
  };
};

export const usersService = {
  async getProfile(userId: string) {
    const user = await usersRepository.findById(userId);

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    return user;
  },

  async updateProfile(userId: string, payload: UpdateUserProfilePayload) {
    try {
      const user = await usersRepository.updateProfile(userId, payload);
      return user;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ApiError(409, 'That username is already taken.', {
          code: 'USERNAME_TAKEN'
        });
      }

      throw error;
    }
  },

  async getMyPortfolio(userId: string) {
    const user = await usersRepository.findById(userId);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    return mapPortfolio(user);
  },

  async getPublicPortfolio(username: string) {
    const user = await usersRepository.findPublicByUsername(username);
    if (!user) {
      throw new ApiError(404, 'Public profile not found');
    }

    return mapPortfolio(user);
  }
};
