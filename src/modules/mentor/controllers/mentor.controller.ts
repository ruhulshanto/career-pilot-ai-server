import { asyncHandler } from '@shared/utils/async-handler.js';
import { apiResponse } from '@shared/responses/api-response.js';
import { mentorService } from '../services/mentor.service.js';
import type { Request, Response } from 'express';

export const mentorController = {
  getMyMentor: asyncHandler(async (req: Request, res: Response) => {
    const result = await mentorService.getMyMentor(req.user!.id);
    res.status(200).json(apiResponse('Mentor assignment retrieved', result));
  }),

  getDashboard: asyncHandler(async (req: Request, res: Response) => {
    const result = await mentorService.getDashboard(req.user!.id, req.user!.role);
    res.status(200).json(apiResponse('Mentor dashboard retrieved', result));
  }),

  listReviews: asyncHandler(async (req: Request, res: Response) => {
    const result = await mentorService.listReviews(req.user!.id, req.user!.role);
    res.status(200).json(apiResponse('Mentor reviews retrieved', result));
  }),

  requestReview: asyncHandler(async (req: Request, res: Response) => {
    const result = await mentorService.requestReview(req.user!.id, req.body);
    res.status(201).json(apiResponse('Mentor review requested', result));
  }),

  updateReview: asyncHandler(async (req: Request, res: Response) => {
    const result = await mentorService.updateReview(
      req.params.id as string,
      req.user!.id,
      req.user!.role,
      req.body
    );
    res.status(200).json(apiResponse('Mentor review updated', result));
  }),

  addComment: asyncHandler(async (req: Request, res: Response) => {
    const result = await mentorService.addComment(
      req.params.id as string,
      req.user!.id,
      req.user!.role,
      req.body
    );
    res.status(201).json(apiResponse('Mentor comment added', result));
  }),

  requestSession: asyncHandler(async (req: Request, res: Response) => {
    const result = await mentorService.requestSession(req.user!.id, req.body);
    res.status(201).json(apiResponse('Mentor session requested', result));
  }),

  updateSession: asyncHandler(async (req: Request, res: Response) => {
    const result = await mentorService.updateSession(
      req.params.id as string,
      req.user!.id,
      req.user!.role,
      req.body
    );
    res.status(200).json(apiResponse('Mentor session updated', result));
  })
};
