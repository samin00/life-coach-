import { Router } from "express";
import { getState } from "../controllers/state.controller.js";

export const router = Router();
router.get("/state", getState);
