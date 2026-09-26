export class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function notFound(req, res) {
  res.status(404).json({ error: { code: "NOT_FOUND", message: `Route not found: ${req.method} ${req.path}` } });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }
  // express.json() errors
  if (err && err.type === "entity.parse.failed") {
    return res.status(400).json({ error: { code: "INVALID_JSON", message: "Malformed JSON body" } });
  }
  if (err && err.type === "entity.too.large") {
    return res.status(413).json({ error: { code: "PAYLOAD_TOO_LARGE", message: "Request body too large" } });
  }
  // Log full detail server-side only; never leak stack traces or secrets.
  console.error(`[error] ${req.method} ${req.originalUrl}:`, err);
  res.status(500).json({ error: { code: "INTERNAL", message: "Internal error" } });
}
