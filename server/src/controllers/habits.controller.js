import * as habits from "../services/habits.service.js";

export const createHabitInput = async (req, res) => res.status(201).json(await habits.replaceHabitInput(req.user.id, req.body));
