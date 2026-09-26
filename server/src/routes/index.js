import { Router } from "express";
import { demoUser } from "../middleware/demoUser.js";
import { router as health } from "./health.routes.js";
import { router as state } from "./state.routes.js";
import { router as habits } from "./habits.routes.js";
import { router as analysis } from "./analysis.routes.js";
import { router as goals } from "./goals.routes.js";
import { router as plan } from "./plan.routes.js";
import { router as reset } from "./reset.routes.js";

export const api = Router();
api.use(health); // no user needed
api.use(demoUser); // AUTH PLUG-IN POINT: swap for real auth middleware
api.use(state, habits, analysis, goals, plan, reset);
