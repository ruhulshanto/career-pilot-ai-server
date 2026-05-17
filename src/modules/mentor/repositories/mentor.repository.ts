import { prisma } from '@config/prisma.js';

const db = prisma as any;

const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  username: true,
  email: true,
  avatarUrl: true,
  headline: true,
  bio: true,
  targetRole: true,
  currentPosition: true,
  currentCompany: true,
  location: true,
  mentorSpecialties: true,
  mentorExpertise: true,
  mentorRating: true,
  mentorCompletedReviews: true
};

export const mentorRepository = {
  findMentorById(id: string) {
    return db.user.findFirst({
      where: { id, role: { in: ['MENTOR', 'ADMIN'] }, deletedAt: null },
      select: userSelect
    });
  },

  findFirstAvailableMentor() {
    return db.user.findFirst({
      where: { role: 'MENTOR', isActive: true, deletedAt: null },
      orderBy: [{ mentorCompletedReviews: 'asc' }, { createdAt: 'asc' }],
      select: userSelect
    });
  },

  findActiveAssignmentForUser(userId: string) {
    return db.mentorAssignment.findFirst({
      where: { userId, status: 'ACTIVE' },
      include: { mentor: { select: userSelect }, user: { select: userSelect } },
      orderBy: { assignedAt: 'desc' }
    });
  },

  findAssignmentByMentorAndUser(mentorId: string, userId: string) {
    return db.mentorAssignment.findFirst({
      where: { mentorId, userId, status: 'ACTIVE' },
      include: { mentor: { select: userSelect }, user: { select: userSelect } }
    });
  },

  createAssignment(mentorId: string, userId: string) {
    return db.mentorAssignment.create({
      data: { mentorId, userId },
      include: { mentor: { select: userSelect }, user: { select: userSelect } }
    });
  },

  listAssignedUsers(mentorId: string) {
    return db.mentorAssignment.findMany({
      where: { mentorId, status: 'ACTIVE' },
      include: { user: { select: userSelect } },
      orderBy: { assignedAt: 'desc' },
      take: 25
    });
  },

  createReview(data: Record<string, unknown>) {
    return db.mentorReview.create({
      data,
      include: {
        user: { select: userSelect },
        mentor: { select: userSelect },
        comments: {
          include: { author: { select: userSelect } },
          orderBy: { createdAt: 'asc' }
        }
      }
    });
  },

  findReviewById(id: string) {
    return db.mentorReview.findFirst({
      where: { id },
      include: {
        user: { select: userSelect },
        mentor: { select: userSelect },
        comments: {
          include: { author: { select: userSelect } },
          orderBy: { createdAt: 'asc' }
        },
        sessions: { orderBy: { createdAt: 'desc' } }
      }
    });
  },

  listReviews(where: Record<string, unknown>, take = 25) {
    return db.mentorReview.findMany({
      where,
      include: {
        user: { select: userSelect },
        mentor: { select: userSelect },
        comments: { include: { author: { select: userSelect } }, orderBy: { createdAt: 'asc' } }
      },
      orderBy: { createdAt: 'desc' },
      take
    });
  },

  updateReview(id: string, data: Record<string, unknown>) {
    return db.mentorReview.update({
      where: { id },
      data,
      include: {
        user: { select: userSelect },
        mentor: { select: userSelect },
        comments: { include: { author: { select: userSelect } }, orderBy: { createdAt: 'asc' } }
      }
    });
  },

  addComment(data: Record<string, unknown>) {
    return db.mentorComment.create({
      data,
      include: { author: { select: userSelect } }
    });
  },

  createSession(data: Record<string, unknown>) {
    return db.mentorSession.create({
      data,
      include: {
        user: { select: userSelect },
        mentor: { select: userSelect },
        review: true
      }
    });
  },

  findSessionById(id: string) {
    return db.mentorSession.findFirst({
      where: { id },
      include: { user: { select: userSelect }, mentor: { select: userSelect }, review: true }
    });
  },

  updateSession(id: string, data: Record<string, unknown>) {
    return db.mentorSession.update({
      where: { id },
      data,
      include: { user: { select: userSelect }, mentor: { select: userSelect }, review: true }
    });
  },

  listSessions(where: Record<string, unknown>, take = 20) {
    return db.mentorSession.findMany({
      where,
      include: { user: { select: userSelect }, mentor: { select: userSelect }, review: true },
      orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'desc' }],
      take
    });
  },

  incrementCompletedReviews(mentorId: string) {
    return db.user.update({
      where: { id: mentorId },
      data: { mentorCompletedReviews: { increment: 1 } }
    });
  }
};
