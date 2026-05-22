import { Router, type IRouter } from "express";
import { eq, desc, count, and, lt, isNotNull } from "drizzle-orm";
import { db, sessions, sessionMessages, savedLooks } from "@workspace/db";
import { getAuth } from "@clerk/express";
import { logger } from "../lib/logger";
import { Jimp } from "jimp";

const THUMBNAIL_MAX_PX = 160;
const MAX_THUMBNAIL_LEN = 200 * 1024;

async function generateThumbnail(base64DataUrl: string): Promise<string | null> {
  try {
    const base64 = base64DataUrl.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64, "base64");
    const image = await Jimp.read(buffer);
    image.scaleToFit({ w: THUMBNAIL_MAX_PX, h: THUMBNAIL_MAX_PX });
    const thumb = await image.getBase64("image/jpeg");
    return thumb.length <= MAX_THUMBNAIL_LEN ? thumb : null;
  } catch {
    return null;
  }
}

const router: IRouter = Router();

// Columns that are safe to return to the client.
// imageData and imagesData (the full-resolution copies) are excluded to keep
// responses small. imageUrl holds the primary image and is included so that
// thumbnails work in the chat header and saved-looks grid.
// The messages route reads imageData/imagesData directly from the DB when it
// needs to pass full images to OpenAI.
const SESSION_SAFE_COLUMNS = {
  id: sessions.id,
  clerkUserId: sessions.clerkUserId,
  title: sessions.title,
  imageUrl: sessions.imageUrl,
  messageCount: sessions.messageCount,
  isSaved: sessions.isSaved,
  bodyType: sessions.bodyType,
  skinTone: sessions.skinTone,
  createdAt: sessions.createdAt,
} as const;

function isBase64DataUrl(url: string | null | undefined): boolean {
  return typeof url === "string" && url.startsWith("data:");
}

// Keep base64 URLs that are thumbnail-sized (≤ MAX_THUMBNAIL_LEN chars).
// Strip oversized base64 blobs — they're multi-MB raw uploads that would crash
// the browser. Regular https:// URLs are always kept.
function isSafeImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  if (!isBase64DataUrl(url)) return true;
  return url.length <= MAX_THUMBNAIL_LEN;
}

function toLeanSession(s: { imageUrl?: string | null; [key: string]: unknown }) {
  const safeUrl = isSafeImageUrl(s.imageUrl as string) ? (s.imageUrl ?? null) : null;
  return { ...s, imageUrl: safeUrl, imageUrls: safeUrl ? [safeUrl] : [] };
}

function requireUserId(req: Parameters<typeof getAuth>[0], res: { status: (n: number) => { json: (b: unknown) => void } }): string | null {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Not signed in" });
    return null;
  }
  return userId;
}

router.get("/sessions/recent", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const [recentSessions, [{ totalSessions }], [{ savedCount }]] = await Promise.all([
    db
      .select(SESSION_SAFE_COLUMNS)
      .from(sessions)
      .where(eq(sessions.clerkUserId, userId))
      .orderBy(desc(sessions.createdAt))
      .limit(10),
    db
      .select({ totalSessions: count() })
      .from(sessions)
      .where(eq(sessions.clerkUserId, userId)),
    db
      .select({ savedCount: count() })
      .from(savedLooks)
      .where(eq(savedLooks.clerkUserId, userId)),
  ]);

  res.json({
    totalSessions,
    savedCount,
    recentSessions: recentSessions.map(toLeanSession),
  });
});

router.get("/sessions", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Delete unsaved sessions older than 24 hours (cascade removes messages).
  // Wipe raw image bytes from ALL sessions older than 24 hours — the thumbnail
  // (imageUrl) is kept for display; the full-size imageData is no longer needed.
  await Promise.all([
    db.delete(sessions).where(
      and(
        eq(sessions.clerkUserId, userId),
        eq(sessions.isSaved, false),
        lt(sessions.createdAt, cutoff),
      ),
    ),
    db.update(sessions)
      .set({ imageData: null, imagesData: null })
      .where(
        and(
          eq(sessions.clerkUserId, userId),
          lt(sessions.createdAt, cutoff),
          isNotNull(sessions.imageData),
        ),
      ),
  ]);

  const recentSessions = await db
    .select(SESSION_SAFE_COLUMNS)
    .from(sessions)
    .where(eq(sessions.clerkUserId, userId))
    .orderBy(desc(sessions.createdAt))
    .limit(10);

  res.json(recentSessions.map(toLeanSession));
});

router.post("/sessions", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const { title, imageUrl, imageData, imagesData, bodyType, skinTone } = req.body;
  if (!title) {
    res.status(400).json({ error: "title is required" });
    return;
  }

  const images: string[] = Array.isArray(imagesData) && imagesData.length > 0
    ? imagesData
    : (imageData ? [imageData] : []);

  // Always generate thumbnail server-side from the first uploaded image.
  // Client-provided imageUrl is used as a fast-path fallback if small enough.
  const firstImage = images[0] ?? imageData ?? null;
  let primaryImageUrl: string | null = null;
  if (firstImage) {
    primaryImageUrl = await generateThumbnail(firstImage);
  }
  if (!primaryImageUrl && imageUrl && imageUrl.length <= MAX_THUMBNAIL_LEN) {
    primaryImageUrl = imageUrl;
  }
  const primaryImageData = firstImage;

  const [session] = await db
    .insert(sessions)
    .values({
      clerkUserId: userId,
      title,
      imageUrl: primaryImageUrl,
      imageData: primaryImageData,
      imagesData: images.length > 0 ? images : null,
      bodyType: bodyType ?? null,
      skinTone: skinTone ?? null,
    })
    .returning({ ...SESSION_SAFE_COLUMNS });

  res.status(201).json({ ...session, imageUrls: [] });
});

router.get("/sessions/:id", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [session] = await db
    .select({ ...SESSION_SAFE_COLUMNS, imagesData: sessions.imagesData })
    .from(sessions)
    .where(and(eq(sessions.id, id), eq(sessions.clerkUserId, userId)));

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  // imageUrls for display: use the thumbnail stored in imageUrl only if it is small.
  // Old sessions may have a full-size base64 in imageUrl — strip those entirely.
  // imagesData holds full-size blobs for OpenAI only — never sent to clients.
  const safeImageUrl = session.imageUrl && session.imageUrl.length <= MAX_THUMBNAIL_LEN
    ? session.imageUrl
    : null;
  const imageUrls: string[] = safeImageUrl ? [safeImageUrl] : [];

  // Drop both imagesData (full-res OpenAI blobs) and the raw imageUrl (may be huge).
  // Replace imageUrl with the safe small version (or null).
  const { imagesData: _drop, imageUrl: _rawImageUrl, ...sessionSafe } = session;
  res.json({ ...sessionSafe, imageUrl: safeImageUrl, imageUrls });
});

router.delete("/sessions/:id", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  await db.delete(sessions).where(and(eq(sessions.id, id), eq(sessions.clerkUserId, userId)));
  res.sendStatus(204);
});

export default router;
