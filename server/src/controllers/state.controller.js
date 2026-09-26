import * as state from "../services/state.service.js";

export const getState = async (req, res) => res.json(await state.getState(req.user.id));
export const reset = async (req, res) => res.json(await state.resetUser(req.user.id));
