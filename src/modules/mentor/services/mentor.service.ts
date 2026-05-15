import { NotificationType } from '@prisma/client';
import { ApiError } from '@shared/errors/api-error.js';
import { notificationsService } from '@modules/notifications/services/notifications.service.js';
import { mentorRepository } from '../repositories/mentor.repository.js';
import type { UserRole } from '@constants/roles.js';

const mentorRoles: UserRole[] = ['MENTOR', 'COACH', 'ADMIN'];

const displayName = (user?: { firstName?: string; lastName?: string; username?: string } | null) =>
  [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.username || 'Mentor';

const assertMentor = (role: UserRole) => {
  if (!mentorRoles.includes(role)) {
    throw new ApiError(403, 'Mentor access required');
  }
};

const assertReviewAccess = (review: any, userId: string, role: UserRole) => {
  if (role === 'ADMIN') return;
  if (review.userId === userId || review.mentorId === userId) return;
  throw new ApiError(403, 'You do not have access to this mentor review');
};

const canSeeMentorOnly = (review: any, actorId: string, role: UserRole) =>
  role === 'ADMIN' || review.mentorId === actorId;

const serializeReviewForActor = (review: any, actorId: string, role: UserRole) => ({
  ...review,
  comments:
    review.comments?.filter(
      (comment: any) =>
        comment.visibility !== 'MENTOR_ONLY' || canSeeMentorOnly(review, actorId, role)
    ) ?? []
});

const notify = async ({
  userId,
  title,
  message,
  actionLink,
  metadata
}: {
  userId?: string | null;
  title: string;
  message: string;
  actionLink?: string;
  metadata?: Record<string, unknown>;
}) => {
  if (!userId) return;
  await notificationsService.sendNotification({
    userId,
    type: NotificationType.SYSTEM,
    title,
    message,
    actionLink,
    metadata: { category: 'MENTOR', ...metadata },
    channels: ['IN_APP']
  });
};

export const mentorService = {
  async getMyMentor(userId: string) {
    const assignment = await mentorRepository.findActiveAssignmentForUser(userId);
    const sessions = await mentorRepository.listSessions({ userId }, 10);
    return {
      assignment,
      mentor: assignment?.mentor ?? null,
      sessions
    };
  },

  async ensureAssignment(userId: string) {
    const existing = await mentorRepository.findActiveAssignmentForUser(userId);
    if (existing) return existing;

    const mentor = await mentorRepository.findFirstAvailableMentor();
    if (!mentor) {
      throw new ApiError(404, 'No mentors are currently available');
    }

    const assignment = await mentorRepository.createAssignment(mentor.id, userId);
    await notify({
      userId,
      title: 'Mentor assigned',
      message: `${displayName(assignment.mentor)} is now connected to your career workspace.`,
      actionLink: '/dashboard/user/mentor',
      metadata: { assignmentId: assignment.id, mentorId: assignment.mentorId }
    });

    return assignment;
  },

  async getDashboard(mentorId: string, role: UserRole) {
    assertMentor(role);
    const reviewWhere =
      role === 'ADMIN'
        ? {}
        : {
            mentorId
          };
    const sessionWhere =
      role === 'ADMIN'
        ? {}
        : {
            mentorId
          };

    const [assignedUsers, pendingReviews, upcomingSessions, recentReviews, recentSessions] =
      await Promise.all([
        role === 'ADMIN' ? [] : mentorRepository.listAssignedUsers(mentorId),
        mentorRepository.listReviews({
          ...reviewWhere,
          status: { in: ['PENDING', 'IN_REVIEW', 'CHANGES_REQUESTED'] }
        }),
        mentorRepository.listSessions({
          ...sessionWhere,
          status: { in: ['REQUESTED', 'APPROVED'] }
        }),
        mentorRepository.listReviews(reviewWhere, 10),
        mentorRepository.listSessions(sessionWhere, 10)
      ]);

    return {
      stats: {
        assignedUsers: assignedUsers.length,
        pendingReviews: pendingReviews.length,
        upcomingSessions: upcomingSessions.length,
        completedReviews: recentReviews.filter((review: any) =>
          ['APPROVED', 'COMPLETED'].includes(review.status)
        ).length
      },
      assignedUsers,
      pendingReviews,
      upcomingSessions,
      roadmapReviewQueue: pendingReviews.filter((review: any) =>
        ['ROADMAP', 'MILESTONE'].includes(review.type)
      ),
      resumeReviewQueue: pendingReviews.filter((review: any) => review.type === 'RESUME'),
      activityFeed: [
        ...recentReviews.map((review: any) => ({
          id: review.id,
          type: 'REVIEW',
          title: review.title,
          status: review.status,
          user: review.user,
          createdAt: review.updatedAt
        })),
        ...recentSessions.map((session: any) => ({
          id: session.id,
          type: 'SESSION',
          title: session.topic,
          status: session.status,
          user: session.user,
          createdAt: session.updatedAt
        }))
      ]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 12)
    };
  },

  async listReviews(userId: string, role: UserRole) {
    const where = role === 'ADMIN' ? {} : mentorRoles.includes(role) ? { mentorId: userId } : { userId };
    const reviews = await mentorRepository.listReviews(where, 50);
    return reviews.map((review: any) => serializeReviewForActor(review, userId, role));
  },

  async requestReview(
    userId: string,
    input: {
      type: string;
      title: string;
      message?: string;
      entityType?: string;
      entityId?: string;
    }
  ) {
    const assignment = await this.ensureAssignment(userId);
    const review = await mentorRepository.createReview({
      userId,
      mentorId: assignment.mentorId,
      assignmentId: assignment.id,
      type: input.type,
      title: input.title,
      message: input.message,
      entityType: input.entityType,
      entityId: input.entityId,
      status: 'PENDING'
    });

    await notify({
      userId: assignment.mentorId,
      title: 'New mentor review request',
      message: `${displayName(assignment.user)} requested ${input.type.toLowerCase()} feedback.`,
      actionLink: '/dashboard/mentor',
      metadata: { reviewId: review.id, reviewType: input.type }
    });

    return review;
  },

  async updateReview(
    reviewId: string,
    actorId: string,
    role: UserRole,
    input: {
      status?: string;
      score?: number;
      verdict?: string;
      suggestedEdits?: unknown;
    }
  ) {
    const review = await mentorRepository.findReviewById(reviewId);
    if (!review) throw new ApiError(404, 'Mentor review not found');
    assertMentor(role);
    assertReviewAccess(review, actorId, role);

    const completed = ['APPROVED', 'COMPLETED', 'REJECTED'].includes(input.status ?? '');
    const updated = await mentorRepository.updateReview(reviewId, {
      ...input,
      ...(completed ? { completedAt: new Date() } : {})
    });

    if (completed && updated.mentorId) {
      await mentorRepository.incrementCompletedReviews(updated.mentorId);
    }

    await notify({
      userId: updated.userId,
      title: 'Mentor review updated',
      message: `${displayName(updated.mentor)} updated your ${updated.type.toLowerCase()} review.`,
      actionLink: '/dashboard/user/mentor',
      metadata: { reviewId: updated.id, reviewStatus: updated.status }
    });

    return updated;
  },

  async addComment(
    reviewId: string,
    actorId: string,
    role: UserRole,
    input: { body: string; parentId?: string; visibility?: string }
  ) {
    const review = await mentorRepository.findReviewById(reviewId);
    if (!review) throw new ApiError(404, 'Mentor review not found');
    assertReviewAccess(review, actorId, role);
    const requestedVisibility = input.visibility ?? 'USER_AND_MENTOR';
    const visibility =
      requestedVisibility === 'MENTOR_ONLY' && canSeeMentorOnly(review, actorId, role)
        ? 'MENTOR_ONLY'
        : 'USER_AND_MENTOR';

    const comment = await mentorRepository.addComment({
      reviewId,
      authorId: actorId,
      parentId: input.parentId,
      body: input.body,
      visibility
    });

    const notifyUserId = actorId === review.userId ? review.mentorId : review.userId;
    if (visibility !== 'MENTOR_ONLY') {
      await notify({
        userId: notifyUserId,
        title: 'Mentor comment added',
        message: `${displayName(comment.author)} added feedback on "${review.title}".`,
        actionLink: notifyUserId === review.userId ? '/dashboard/user/mentor' : '/dashboard/mentor',
        metadata: { reviewId, commentId: comment.id }
      });
    }

    return comment;
  },

  async requestSession(
    userId: string,
    input: {
      topic: string;
      message?: string;
      scheduledAt?: string;
      durationMinutes?: number;
      reviewId?: string;
    }
  ) {
    const assignment = await this.ensureAssignment(userId);
    const session = await mentorRepository.createSession({
      userId,
      mentorId: assignment.mentorId,
      reviewId: input.reviewId,
      topic: input.topic,
      message: input.message,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      durationMinutes: input.durationMinutes ?? 30,
      status: 'REQUESTED'
    });

    await notify({
      userId: assignment.mentorId,
      title: 'New mentor session request',
      message: `${displayName(assignment.user)} requested a mentor session.`,
      actionLink: '/dashboard/mentor',
      metadata: { sessionId: session.id }
    });

    return session;
  },

  async updateSession(sessionId: string, actorId: string, role: UserRole, input: { status: string; scheduledAt?: string }) {
    const session = await mentorRepository.findSessionById(sessionId);
    if (!session) throw new ApiError(404, 'Mentor session not found');
    assertMentor(role);
    if (role !== 'ADMIN' && session.mentorId !== actorId) {
      throw new ApiError(403, 'You do not have access to this mentor session');
    }

    const updated = await mentorRepository.updateSession(sessionId, {
      status: input.status,
      ...(input.scheduledAt ? { scheduledAt: new Date(input.scheduledAt) } : {})
    });

    await notify({
      userId: updated.userId,
      title: `Mentor session ${updated.status.toLowerCase()}`,
      message: `${displayName(updated.mentor)} updated your mentor session request.`,
      actionLink: '/dashboard/user/mentor',
      metadata: { sessionId: updated.id, sessionStatus: updated.status }
    });

    return updated;
  }
};
