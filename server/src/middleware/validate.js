import { AppError } from "./errorHandler.js";

/** Validate req.body against a zod schema; replaces req.body with parsed data. */
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body ?? {});
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue.path.length ? issue.path.join(".") + ": " : "";
    return next(new AppError(400, "VALIDATION_ERROR", where + issue.message));
  }
  req.body = result.data;
  next();
};
