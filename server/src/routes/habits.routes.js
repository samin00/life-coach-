import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { HabitInputBody } from "../validation/schemas.js";
import { createHabitInput } from "../controllers/habits.controller.js";

export const router = Router();
router.post("/habits", validate(HabitInputBody), createHabitInput);
