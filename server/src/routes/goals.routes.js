import { Router } from "express";
import { aiLimiter } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import { GoalBody } from "../validation/schemas.js";
import { suggest, createGoal } from "../controllers/goals.controller.js";

export const router = Router();
router.post("/goals/suggest", aiLimiter, suggest);
router.post("/goals", validate(GoalBody), createGoal);
