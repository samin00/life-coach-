import * as plan from "../services/plan.service.js";

export const createPlan = async (req, res) => res.status(201).json(await plan.createPlan(req.user.id));
export const getPlan = async (req, res) => res.json(await plan.getPlan(req.user.id));
export const patchProgress = async (req, res) => res.json(await plan.updateProgress(req.user.id, req.body));
