import { Router, type IRouter } from "express";
import { db, feedback } from "@workspace/db";
import { getAuth } from "@clerk/express";

const router: IRouter = Router();

router.post("/feedback", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { sessionId, rating, nps, comment } = req.body as {
    sessionId?: number | null;
    rating?: number | null;
    nps?: number | null;
    comment?: string | null;
  };

  if (rating != null && (rating < 1 || rating > 5)) {
    res.status(400).json({ error: "rating must be 1–5" });
    return;
  }
  if (nps != null && (nps < 0 || nps > 10)) {
    res.status(400).json({ error: "nps must be 0–10" });
    return;
  }

  const [result] = await db
    .insert(feedback)
    .values({
      clerkUserId: userId,
      sessionId: sessionId ?? null,
      rating: rating ?? null,
      nps: nps ?? null,
      comment: comment?.trim() || null,
    })
    .returning({ id: feedback.id });

  res.status(201).json({ id: result.id });
});

export default router;
