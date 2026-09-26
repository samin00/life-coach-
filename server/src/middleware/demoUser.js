import { prisma } from "../lib/prisma.js";

// ---------------------------------------------------------------------------
// AUTH PLUG-IN POINT: this middleware stands in for authentication.
// It find-or-creates one shared demo user and attaches it as req.user.
// Replace it with real auth (session/JWT verification) that sets req.user;
// nothing downstream needs to change.
// ---------------------------------------------------------------------------
const DEMO_USER_ID = "demo-user";
let cached = null;

export async function demoUser(req, res, next) {
  try {
    if (!cached) {
      cached = await prisma.user.upsert({ where: { id: DEMO_USER_ID }, update: {}, create: { id: DEMO_USER_ID } });
    }
    req.user = cached;
    next();
  } catch (err) {
    next(err);
  }
}
