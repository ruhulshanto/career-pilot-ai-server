import {
  AiFeedbackType,
  AiProvider,
  InterviewStatus,
  JobApplicationStatus,
  NotificationStatus,
  NotificationType,
  PrismaClient,
  ProcessingStatus,
  UserRole
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const demoPassword = 'Demo@123456';
const demoEmails = {
  user: 'demo.user@careerai.local',
  admin: 'demo.admin@careerai.local',
  mentor: 'demo.mentor@careerai.local'
};

const addDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

const profileProjects = [
  {
    title: 'AI Career Copilot Dashboard',
    url: 'https://example.com/career-copilot',
    summary: 'Built a dashboard that turns resume and interview signals into weekly career actions.',
    technologies: ['Next.js', 'Node.js', 'PostgreSQL', 'AI APIs']
  },
  {
    title: 'Job Match Scoring Engine',
    url: 'https://github.com/careerai/demo-job-match',
    summary: 'Created a weighted skills matching prototype for role recommendations.',
    technologies: ['TypeScript', 'Prisma', 'Redis']
  }
];

const demoSkills = [
  'React',
  'TypeScript',
  'Node.js',
  'PostgreSQL',
  'System Design',
  'AI Product Thinking',
  'Interview Communication'
];

const resetDemoData = async (userId: string) => {
  await prisma.$transaction([
    prisma.mentorComment.deleteMany({
      where: { review: { OR: [{ userId }, { mentorId: userId }] } }
    }),
    prisma.mentorSession.deleteMany({
      where: { OR: [{ userId }, { mentorId: userId }] }
    }),
    prisma.mentorReview.deleteMany({
      where: { OR: [{ userId }, { mentorId: userId }] }
    }),
    prisma.mentorAssignment.deleteMany({
      where: { OR: [{ userId }, { mentorId: userId }] }
    }),
    prisma.analyticsEvent.deleteMany({ where: { userId } }),
    prisma.notification.deleteMany({ where: { userId } }),
    prisma.jobApplication.deleteMany({ where: { userId } }),
    prisma.jobRecommendation.deleteMany({ where: { userId } }),
    prisma.careerGoal.deleteMany({ where: { userId } }),
    prisma.aiFeedback.deleteMany({ where: { userId } }),
    prisma.chatbotMessage.deleteMany({
      where: { session: { userId } }
    }),
    prisma.chatbotSession.deleteMany({ where: { userId } }),
    prisma.interviewSession.deleteMany({ where: { userId } }),
    prisma.careerRoadmap.deleteMany({ where: { userId } }),
    prisma.resume.deleteMany({ where: { userId } }),
    prisma.onboardingProgress.deleteMany({ where: { userId } }),
    prisma.refreshToken.deleteMany({ where: { userId } }),
    prisma.accountSession.deleteMany({ where: { userId } }),
    prisma.emailVerificationToken.deleteMany({ where: { userId } }),
    prisma.passwordResetToken.deleteMany({ where: { userId } })
  ]);
};

const upsertDemoUser = async (data: {
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  headline: string;
  currentPosition: string;
  targetRole: string;
}) => {
  const passwordHash = await bcrypt.hash(demoPassword, 12);
  const user = await prisma.user.upsert({
    where: { email: data.email },
    update: {
      role: data.role,
      isDemo: true,
      isActive: true,
      emailVerifiedAt: new Date(),
      headline: data.headline,
      targetRole: data.targetRole,
      currentPosition: data.currentPosition,
      currentCompany: 'CareerAI Demo Labs',
      yearsExperience: data.role === UserRole.MENTOR ? 9 : 4,
      bio:
        data.role === UserRole.ADMIN
          ? 'Demo admin account for exploring platform analytics, monitoring, queues, and operational visibility.'
          : 'Demo career profile with realistic resume, roadmap, interview, job, and mentoring data for product exploration.',
      location: 'San Francisco, CA',
      phoneNumber: '+1 555 010 2040',
      showEmail: true,
      isPublicProfile: true,
      avatarUrl: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(
        `${data.firstName} ${data.lastName}`
      )}`,
      profileSkills: demoSkills,
      profileCertifications: [
        { name: 'AWS Cloud Practitioner', issuer: 'AWS', year: '2025' },
        { name: 'Professional Scrum Master I', issuer: 'Scrum.org', year: '2024' }
      ],
      profileProjects,
      education: [
        {
          school: 'Demo State University',
          degree: 'B.S. Computer Science',
          year: '2021'
        }
      ],
      languages: ['English', 'Spanish'],
      preferredJobType: 'Full-time',
      preferredWorkMode: 'REMOTE',
      preferredSalaryRange: '$130k - $160k',
      experienceSummary:
        'Four years building production web applications, AI-enabled workflows, and cross-functional product features.',
      socialLinks: {
        github: 'https://github.com/careerai-demo',
        linkedin: 'https://linkedin.com/in/careerai-demo',
        portfolio: 'https://careerai-demo.example.com'
      },
      passwordHash
    },
    create: {
      email: data.email,
      username: data.username,
      firstName: data.firstName,
      lastName: data.lastName,
      passwordHash,
      role: data.role,
      isDemo: true,
      isActive: true,
      emailVerifiedAt: new Date(),
      headline: data.headline,
      targetRole: data.targetRole,
      currentPosition: data.currentPosition,
      currentCompany: 'CareerAI Demo Labs',
      yearsExperience: data.role === UserRole.MENTOR ? 9 : 4,
      bio: 'Demo career account with realistic seeded progress across the platform.',
      location: 'San Francisco, CA',
      phoneNumber: '+1 555 010 2040',
      showEmail: true,
      isPublicProfile: true,
      avatarUrl: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(
        `${data.firstName} ${data.lastName}`
      )}`,
      profileSkills: demoSkills,
      profileCertifications: [
        { name: 'AWS Cloud Practitioner', issuer: 'AWS', year: '2025' },
        { name: 'Professional Scrum Master I', issuer: 'Scrum.org', year: '2024' }
      ],
      profileProjects,
      education: [
        {
          school: 'Demo State University',
          degree: 'B.S. Computer Science',
          year: '2021'
        }
      ],
      languages: ['English', 'Spanish'],
      preferredJobType: 'Full-time',
      preferredWorkMode: 'REMOTE',
      preferredSalaryRange: '$130k - $160k',
      experienceSummary:
        'Four years building production web applications, AI-enabled workflows, and cross-functional product features.',
      socialLinks: {
        github: 'https://github.com/careerai-demo',
        linkedin: 'https://linkedin.com/in/careerai-demo',
        portfolio: 'https://careerai-demo.example.com'
      }
    }
  });

  await resetDemoData(user.id);
  return user;
};

const seedCareerData = async (userId: string, roleTarget = 'Senior Frontend Engineer') => {
  await prisma.onboardingProgress.create({
    data: {
      userId,
      completedSteps: [
        'UPLOAD_RESUME',
        'GENERATE_ROADMAP',
        'TAKE_INTERVIEW',
        'VIEW_JOB_MATCHES',
        'CREATE_GOAL'
      ],
      currentStep: 'COMPLETE',
      completedAt: new Date()
    }
  });

  const resume = await prisma.resume.create({
    data: {
      userId,
      title: 'Demo Resume - Senior Frontend Engineer',
      fileUrl: 'demo://resume/senior-frontend-engineer.pdf',
      fileType: 'application/pdf',
      fileSize: 420_000,
      status: ProcessingStatus.COMPLETED,
      parsedText:
        'Senior frontend engineer with React, TypeScript, design systems, API integration, and AI workflow experience.'
    }
  });

  await prisma.aiFeedback.create({
    data: {
      userId,
      resumeId: resume.id,
      type: AiFeedbackType.RESUME_ANALYSIS,
      provider: AiProvider.GROQ,
      status: ProcessingStatus.COMPLETED,
      score: 88,
      summary: 'Strong frontend resume with clear product impact and AI workflow experience.',
      strengths: ['Modern frontend stack', 'Measurable impact', 'Strong product collaboration'],
      weaknesses: ['Add more architecture metrics', 'Clarify leadership scope'],
      suggestions: ['Quantify performance improvements', 'Add accessibility examples'],
      promptTokens: 1200,
      completionTokens: 620,
      rawResponse: {
        atsScore: 88,
        roleFitScore: 91,
        keywords: ['React', 'TypeScript', 'Next.js', 'AI workflows']
      }
    }
  });

  const roadmap = await prisma.careerRoadmap.create({
    data: {
      userId,
      sourceResumeId: resume.id,
      targetRole: roleTarget,
      currentLevel: 'Mid-level',
      title: `${roleTarget} Growth Roadmap`,
      summary: 'A focused 12-week plan to strengthen architecture, interviewing, and portfolio evidence.',
      estimatedDurationMonths: 3,
      progress: 58,
      status: ProcessingStatus.COMPLETED,
      milestones: [
        { title: 'Refresh portfolio proof', status: 'COMPLETED' },
        { title: 'Practice system design', status: 'IN_PROGRESS' },
        { title: 'Apply to targeted roles', status: 'PENDING' }
      ],
      skills: demoSkills,
      timeline: { weeks: 12, pace: 'focused' },
      projects: profileProjects,
      certifications: ['AWS Cloud Practitioner', 'Scrum Master I'],
      learningRecommendations: ['Frontend architecture', 'AI product systems', 'Behavioral interview storytelling']
    }
  });

  await prisma.roadmapMilestone.createMany({
    data: [
      {
        roadmapId: roadmap.id,
        sequence: 1,
        title: 'Optimize resume and portfolio',
        description: 'Improve ATS keywords and publish two portfolio case studies.',
        durationWeeks: 2,
        dueDate: addDays(-14),
        status: 'COMPLETED',
        progress: 100,
        completedAt: addDays(-10)
      },
      {
        roadmapId: roadmap.id,
        sequence: 2,
        title: 'Complete frontend system design practice',
        description: 'Practice architecture tradeoffs for dashboards, forms, and real-time AI experiences.',
        durationWeeks: 4,
        dueDate: addDays(7),
        status: 'IN_PROGRESS',
        progress: 62
      },
      {
        roadmapId: roadmap.id,
        sequence: 3,
        title: 'Run targeted job search sprint',
        description: 'Apply to high-fit roles and track follow-ups with weekly mentoring.',
        durationWeeks: 6,
        dueDate: addDays(28),
        status: 'PENDING',
        progress: 20
      }
    ]
  });

  await prisma.roadmapSkill.createMany({
    data: [
      { roadmapId: roadmap.id, name: 'React Architecture', category: 'Frontend', targetLevel: 'Advanced', priority: 'High', progress: 78, status: 'PRACTICING' },
      { roadmapId: roadmap.id, name: 'System Design', category: 'Architecture', targetLevel: 'Intermediate', priority: 'High', progress: 54, status: 'LEARNING' },
      { roadmapId: roadmap.id, name: 'AI Product Thinking', category: 'Product', targetLevel: 'Intermediate', priority: 'Medium', progress: 68, status: 'PRACTICING' }
    ]
  });

  await prisma.roadmapProject.createMany({
    data: profileProjects.map((project, index) => ({
      roadmapId: roadmap.id,
      title: project.title,
      description: project.summary,
      difficulty: index === 0 ? 'Advanced' : 'Intermediate',
      estimatedWeeks: index === 0 ? 4 : 2,
      technologies: project.technologies,
      skillsDemonstrated: ['Product thinking', 'Frontend systems', 'AI workflows'],
      portfolioValue: 'High',
      status: index === 0 ? 'COMPLETED' : 'IN_PROGRESS'
    }))
  });

  const completedInterview = await prisma.interviewSession.create({
    data: {
      userId,
      title: 'Demo Senior Frontend Mock Interview',
      roleTarget,
      level: 'Senior',
      status: InterviewStatus.COMPLETED,
      questions: [
        { id: 'q1', prompt: 'Tell me about a complex frontend architecture decision.' },
        { id: 'q2', prompt: 'How would you design a real-time notification center?' }
      ],
      transcript: [
        { role: 'interviewer', content: 'How do you approach frontend architecture?' },
        { role: 'candidate', content: 'I start with user workflows, data boundaries, and failure states.' }
      ],
      score: 84,
      scheduledAt: addDays(-4),
      startedAt: addDays(-4),
      completedAt: addDays(-4)
    }
  });

  await prisma.aiFeedback.create({
    data: {
      userId,
      interviewSessionId: completedInterview.id,
      type: AiFeedbackType.INTERVIEW_FEEDBACK,
      provider: AiProvider.GROQ,
      status: ProcessingStatus.COMPLETED,
      score: 84,
      summary: 'Clear technical structure with strong examples. Improve concision on system design tradeoffs.',
      strengths: ['Structured thinking', 'Strong frontend examples'],
      weaknesses: ['Could quantify tradeoffs faster'],
      suggestions: ['Use STAR format', 'Lead with constraints before solution'],
      promptTokens: 900,
      completionTokens: 480
    }
  });

  await prisma.interviewSession.create({
    data: {
      userId,
      title: 'Upcoming Product Engineering Interview',
      roleTarget,
      level: 'Senior',
      status: InterviewStatus.SCHEDULED,
      questions: [],
      scheduledAt: addDays(2)
    }
  });

  const jobs = await Promise.all(
    [
      ['demo-frontend-platform', 'Senior Frontend Platform Engineer', 'Northstar AI', 'Remote', 94],
      ['demo-product-engineer', 'AI Product Engineer', 'SignalWorks', 'New York, NY', 91],
      ['demo-design-systems', 'Design Systems Engineer', 'Atlas Cloud', 'Remote', 88],
      ['demo-fullstack', 'Full Stack Engineer, Career Tools', 'LatticePath', 'San Francisco, CA', 86],
      ['demo-react-lead', 'React Technical Lead', 'BrightOps', 'Austin, TX', 84]
    ].map(([externalId, title, company, location, score]) =>
      prisma.jobRecommendation.create({
        data: {
          userId,
          source: 'demo-seed',
          externalId: `${externalId}-${userId}`,
          title: String(title),
          company: String(company),
          location: String(location),
          jobUrl: 'https://example.com/demo-job',
          matchScore: Number(score),
          skillsMatch: ['React', 'TypeScript', 'Architecture'],
          metadata: { demo: true, salary: '$130k - $170k' },
          expiresAt: addDays(30)
        }
      })
    )
  );

  await Promise.all(
    jobs.map((job, index) =>
      prisma.jobApplication.create({
        data: {
          userId,
          jobRecommendationId: job.id,
          status:
            index === 1
              ? JobApplicationStatus.INTERVIEW_SCHEDULED
              : JobApplicationStatus.APPLIED,
          notes: 'Demo application seeded for product exploration.',
          appliedAt: addDays(-index - 1),
          interviewAt: index === 1 ? addDays(5) : null
        }
      })
    )
  );

  await prisma.careerGoal.createMany({
    data: [
      {
        userId,
        title: 'Land a senior frontend role',
        description: 'Focus applications on AI-enabled SaaS teams with strong frontend platform needs.',
        targetRole: roleTarget,
        targetDate: addDays(90),
        progress: 64,
        nextSteps: ['Finish architecture case study', 'Apply to 5 high-fit roles', 'Practice one mock interview']
      },
      {
        userId,
        title: 'Publish portfolio case studies',
        description: 'Turn roadmap projects into public proof of work.',
        targetRole: roleTarget,
        targetDate: addDays(30),
        progress: 75,
        nextSteps: ['Record metrics', 'Add screenshots', 'Share public profile']
      }
    ]
  });

  const chat = await prisma.chatbotSession.create({
    data: {
      userId,
      title: 'Demo career mentoring plan',
      context: { targetRole: roleTarget, demo: true },
      messages: [],
      lastMessageAt: new Date()
    }
  });

  await prisma.chatbotMessage.createMany({
    data: [
      {
        sessionId: chat.id,
        role: 'user',
        content: 'Help me prioritize my next career steps this week.',
        metadata: { demo: true }
      },
      {
        sessionId: chat.id,
        role: 'assistant',
        content:
          'This week, finish one portfolio case study, practice one architecture prompt, and apply to three high-match roles.',
        metadata: { demo: true }
      }
    ]
  });

  await prisma.notification.createMany({
    data: [
      {
        userId,
        type: NotificationType.INTERVIEW_REMINDER,
        status: NotificationStatus.UNREAD,
        title: 'Upcoming interview practice',
        message: 'Your Product Engineering interview practice is scheduled soon.',
        actionLink: '/dashboard/user/interview',
        dedupeKey: `demo-interview-${userId}`,
        metadata: { demo: true }
      },
      {
        userId,
        type: NotificationType.ROADMAP_REMINDER,
        status: NotificationStatus.UNREAD,
        title: 'Next roadmap task ready',
        message: 'Continue your frontend system design milestone.',
        actionLink: '/dashboard/user/roadmap',
        dedupeKey: `demo-roadmap-${userId}`,
        metadata: { demo: true }
      },
      {
        userId,
        type: NotificationType.JOB_MATCH,
        status: NotificationStatus.READ,
        title: '5 new demo job matches',
        message: 'Review seeded job matches for your target role.',
        actionLink: '/dashboard/user/jobs',
        dedupeKey: `demo-jobs-${userId}`,
        metadata: { demo: true }
      }
    ]
  });
};

const seed = async () => {
  const adminPasswordHash = await bcrypt.hash('Admin@123456', 12);

  await prisma.user.upsert({
    where: { email: 'admin@career-platform.local' },
    update: {},
    create: {
      email: 'admin@career-platform.local',
      username: 'admin',
      firstName: 'Platform',
      lastName: 'Admin',
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
      emailVerifiedAt: new Date()
    }
  });

  const demoUser = await upsertDemoUser({
    email: demoEmails.user,
    username: 'demo_user',
    firstName: 'Avery',
    lastName: 'Stone',
    role: UserRole.USER,
    headline: 'Frontend engineer growing into AI product engineering',
    currentPosition: 'Frontend Engineer',
    targetRole: 'Senior Frontend Engineer'
  });

  const demoAdmin = await upsertDemoUser({
    email: demoEmails.admin,
    username: 'demo_admin',
    firstName: 'Riley',
    lastName: 'Admin',
    role: UserRole.ADMIN,
    headline: 'Demo platform owner with analytics access',
    currentPosition: 'Platform Operations Lead',
    targetRole: 'Product Analytics Lead'
  });

  const demoMentor = await upsertDemoUser({
    email: demoEmails.mentor,
    username: 'demo_mentor',
    firstName: 'Jordan',
    lastName: 'Mentor',
    role: UserRole.MENTOR,
    headline: 'Career mentor focused on interview readiness and role strategy',
    currentPosition: 'Career Mentor',
    targetRole: 'AI Career Mentor'
  });

  await seedCareerData(demoUser.id, 'Senior Frontend Engineer');
  await seedCareerData(demoAdmin.id, 'Platform Analytics Lead');
  await seedCareerData(demoMentor.id, 'AI Career Mentor');

  console.log('Seeded demo accounts:');
  console.log(`- Demo User: ${demoEmails.user} / ${demoPassword}`);
  console.log(`- Demo Admin: ${demoEmails.admin} / ${demoPassword}`);
  console.log(`- Demo Mentor: ${demoEmails.mentor} / ${demoPassword}`);
};

seed()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
