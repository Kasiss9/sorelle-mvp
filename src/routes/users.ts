import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, users } from "@workspace/db";

const router: IRouter = Router();

router.post("/users/sync", async (req, res): Promise<void> => {
  const { clerkUserId, email } = req.body;
  if (!clerkUserId || !email) {
    res.status(400).json({ error: "clerkUserId and email are required" });
    return;
  }

  const existing = await db.select().from(users).where(eq(users.clerkUserId, clerkUserId));

  if (existing.length > 0) {
    const [updated] = await db
      .update(users)
      .set({ email })
      .where(eq(users.clerkUserId, clerkUserId))
      .returning();
    res.json({
      id: updated.id,
      email: updated.email,
      marketingConsent: updated.marketingConsent ?? null,
    });
    return;
  }

  const [created] = await db
    .insert(users)
    .values({ clerkUserId, email })
    .returning();

  res.json({
    id: created.id,
    email: created.email,
    marketingConsent: created.marketingConsent ?? null,
  });
});

router.post("/users/consent", async (req, res): Promise<void> => {
  const { clerkUserId, consent } = req.body;
  if (!clerkUserId || typeof consent !== "boolean") {
    res.status(400).json({ error: "clerkUserId and consent (boolean) are required" });
    return;
  }

  await db
    .update(users)
    .set({ marketingConsent: consent, marketingConsentAt: new Date() })
    .where(eq(users.clerkUserId, clerkUserId));

  res.status(204).end();
});

export default router;
