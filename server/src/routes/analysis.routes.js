import { Router } from "express";
import { aiLimiter } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import { AnalysisPatchBody } from "../validation/schemas.js";
import { analyze, patchAnalysis } from "../controllers/analysis.controller.js";

export const router = Router();
router.post("/analyze", aiLimiter, analyze);
router.patch("/analysis", validate(AnalysisPatchBody), patchAnalysis);
