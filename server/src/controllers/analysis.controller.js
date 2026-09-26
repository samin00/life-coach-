import * as analysis from "../services/analysis.service.js";

export const analyze = async (req, res) => res.status(201).json(await analysis.runAnalysis(req.user.id));
export const patchAnalysis = async (req, res) => res.json(await analysis.updateAnalysis(req.user.id, req.body));
