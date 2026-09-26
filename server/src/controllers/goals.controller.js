import * as goals from "../services/goals.service.js";

export const suggest = async (req, res) => res.json(await goals.suggestGoals(req.user.id));
export const createGoal = async (req, res) => res.status(201).json(await goals.setGoal(req.user.id, req.body));
