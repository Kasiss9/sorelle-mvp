import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, savedLooks, sessions } from "@workspace/db";
import { getAuth } from "@clerk/express";

const router: IRouter = Router();

router.get("/saved", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }

  // Join with sessions to fall back to the session thumbnail when the saved
  // look's own imageUrl is null (e.g. saved before thumbnail generation was fixed).
  const MAX_THUMBNAIL_LEN = 200 * 1024;
  const rows = await db
    .select({
      id: savedLooks.id,
      clerkUserId: savedLooks.clerkUserId,
      sessionId: savedLooks.sessionId,
      title: savedLooks.title,
      imageUrl: savedLooks.imageUrl,
      notes: savedLooks.notes,
      createdAt: savedLooks.createdAt,
      sessionImageUrl: sessions.imageUrl,
    })
    .from(savedLooks)
    .leftJoin(sessions, eq(savedLooks.sessionId, sessions.id))
    .where(eq(savedLooks.clerkUserId, userId))
    .orderBy(desc(savedLooks.createdAt));

  const looks = rows.map(({ sessionImageUrl, ...look }) => {
    const fallback =
      !look.imageUrl &&
      sessionImageUrl &&
      sessionImageUrl.length <= MAX_THUMBNAIL_LEN
        ? sessionImageUrl
        : null;
    return { ...look, imageUrl: look.imageUrl ?? fallback };
  });

  res.json(looks);
});

router.post("/saved", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }

  const { sessionId, title, notes } = req.body;
  if (!sessionId || !title) {
    res.status(400).json({ error: "sessionId and title are required" });
    return;
  }

  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.clerkUserId, userId)));

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const MAX_THUMBNAIL_LEN = 200 * 1024;
  const [look] = await db.insert(savedLooks).values({
    clerkUserId: userId,
    sessionId,
    title,
    // Store the thumbnail if it is small enough (base64 or https).
    // Reject full-size base64 blobs which would bloat the DB and responses.
    imageUrl: (session.imageUrl && session.imageUrl.length <= MAX_THUMBNAIL_LEN)
      ? session.imageUrl
      : null,
    notes: notes ?? null,
  }).returning();

  await db.update(sessions).set({ isSaved: true }).where(eq(sessions.id, sessionId));

  res.status(201).json(look);
});

router.delete("/saved/:id", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  // Verify ownership directly via clerkUserId — no session join needed.
  const [look] = await db
    .select()
    .from(savedLooks)
    .where(and(eq(savedLooks.id, id), eq(savedLooks.clerkUserId, userId)));

  if (!look) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  await db.delete(savedLooks).where(eq(savedLooks.id, id));
  res.sendStatus(204);
});

export default router;
