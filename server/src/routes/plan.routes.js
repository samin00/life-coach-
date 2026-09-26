import { Router } from "express";
import { aiLimiter } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import { ProgressPatchBody } from "../validation/schemas.js";
import { createPlan, getPlan, patchProgress } from "../controllers/plan.controller.js";

export const router = Router();
router.post("/plan", aiLimiter, createPlan);
router.get("/plan", getPlan);
router.patch("/plan/progress", validate(ProgressPatchBody), patchProgress);
