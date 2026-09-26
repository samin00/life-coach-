import rateLimit from "express-rate-limit";

/** 20 requests / 15 minutes per IP on AI-backed endpoints. */
export const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).json({ error: { code: "RATE_LIMITED", message: "Too many AI requests. Try again in a few minutes." } }),
});
