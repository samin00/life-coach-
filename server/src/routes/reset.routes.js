import { Router } from "express";
import { reset } from "../controllers/state.controller.js";

export const router = Router();
router.delete("/reset", reset);
