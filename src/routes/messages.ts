import { Router, type IRouter } from "express";
import { eq, asc, and } from "drizzle-orm";
import { db, sessions, sessionMessages } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { getAuth } from "@clerk/express";

const router: IRouter = Router();

const SORELLE_SYSTEM_PROMPT = `You are Sorelle — a warm, stylish older sister who happens to know everything about fashion. You give honest, confident, emotionally intelligent styling advice.

HONESTY IS KINDNESS — follow these strictly:
- If a look is off — proportions that don't flatter the body, colors that clash with the skin tone, or combinations that don't work — say so clearly and kindly. Don't pretend everything looks great.
- When colors are wrong for a skin tone (e.g. too warm/cool undertones, washing out the complexion, creating contrast issues), name it specifically and suggest what would actually work.
- When proportions are off (e.g. top-heavy, bottom-heavy, cropped in the wrong place for the figure, oversized in a way that swamps the body), explain why and offer a fix.
- You are a trusted stylist, not a yes-person. Vague positivity helps no one. Specific, honest feedback is the kindest thing you can offer.

RESPONSE STYLE — follow these strictly:
- Keep responses concise and elegant: 2–5 sentences by default.
- Sound like a stylish older sister texting advice, not a fashion report.
- Avoid bullet overload. Prefer flowing sentences or at most 2–3 bullets when listing is truly helpful.
- Prioritize the single most important insight — what's working, or what most needs to change.
- Make the user feel empowered, not criticized. Honest doesn't mean harsh.
- Never sound robotic, analytical, or overly structured.
- Warm, direct, and effortless — like you just know.

Always be specific, never generic. If something isn't working, name it and fix it.

Examples of your voice:
- (something off) "Honestly, the color is fighting your skin tone a little — it's pulling cool when you need warmth. Same silhouette in camel or terracotta and this look completely transforms."
- (proportions off) "The oversized top is losing your waist entirely. Half-tuck it or swap for something cropped and this actually becomes a great outfit."
- (working well) "The proportions here are doing everything right. I'd just anchor it with a warmer shoe — something in cognac or warm tan — and you're done."`;

router.get("/sessions/:id/messages", async (req, res): Promise<void> => {
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

  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, id), eq(sessions.clerkUserId, userId)));

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const msgs = await db
    .select()
    .from(sessionMessages)
    .where(eq(sessionMessages.sessionId, id))
    .orderBy(asc(sessionMessages.createdAt));

  // Map DB field `imageData` → API field `imageUrl` to match the OpenAPI spec
  res.json(msgs.map(({ imageData, ...m }) => ({ ...m, imageUrl: imageData ?? null })));
});

router.post("/sessions/:id/messages", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const sessionId = parseInt(raw, 10);
  if (isNaN(sessionId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const { content, quickAction, imageData, language } = req.body;
  if (!content || typeof content !== "string") {
    res.status(400).json({ error: "content is required" });
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

  const contextParts: string[] = [];
  if (session.bodyType) contextParts.push(`Body type: ${session.bodyType}`);
  if (session.skinTone) contextParts.push(`Skin tone: ${session.skinTone}`);
  const sessionContext = contextParts.length > 0
    ? `\n\nUSER PROFILE FOR THIS SESSION:\n${contextParts.join("\n")}\nAlways factor this profile into your analysis — check whether the outfit's silhouette flatters this body type, and whether the colors suit this skin tone.`
    : "";

  const LANGUAGE_NAMES: Record<string, string> = {
    en: "English",
    pl: "Polish",
    nl: "Dutch",
  };
  const langCode = typeof language === "string" ? language.slice(0, 2).toLowerCase() : "en";
  const langName = LANGUAGE_NAMES[langCode] ?? "English";
  const languageInstruction = langCode !== "en"
    ? `\n\nIMPORTANT: Respond exclusively in ${langName}. Every word of your response must be in ${langName}.`
    : "";

  await db.insert(sessionMessages).values({
    sessionId,
    role: "user",
    content,
    quickAction: quickAction ?? null,
    imageData: imageData ?? null,
  });

  const history = await db
    .select()
    .from(sessionMessages)
    .where(eq(sessionMessages.sessionId, sessionId))
    .orderBy(asc(sessionMessages.createdAt));

  const chatMessages: { role: "user" | "assistant" | "system"; content: any }[] = [
    { role: "system", content: SORELLE_SYSTEM_PROMPT + sessionContext + languageInstruction },
  ];

  const sessionImages: string[] = session.imagesData && session.imagesData.length > 0
    ? session.imagesData
    : (session.imageData ? [session.imageData] : []);

  for (let i = 0; i < history.length; i++) {
    const msg = history[i];
    if (msg.role === "user") {
      const isFirst = i === 0 && sessionImages.length > 0;
      const hasAttached = !!msg.imageData;

      if (isFirst || hasAttached) {
        const imageParts = [
          ...(isFirst ? sessionImages.map((img) => ({ type: "image_url" as const, image_url: { url: img } })) : []),
          ...(hasAttached ? [{ type: "image_url" as const, image_url: { url: msg.imageData! } }] : []),
        ];
        chatMessages.push({
          role: "user",
          content: [...imageParts, { type: "text" as const, text: msg.content }],
        });
      } else {
        chatMessages.push({ role: "user", content: msg.content });
      }
    } else {
      chatMessages.push({ role: "assistant", content: msg.content });
    }
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-5.4",
    max_completion_tokens: 8192,
    messages: chatMessages,
  });

  const assistantContent = completion.choices[0]?.message?.content ?? "I'd love to help with your styling question. Could you share more details?";

  const [assistantMsg] = await db.insert(sessionMessages).values({
    sessionId,
    role: "assistant",
    content: assistantContent,
  }).returning();

  // history.length === 1 means this is the first user message — images have now
  // been sent to OpenAI and are no longer needed. Wipe them from the DB immediately.
  const isFirstExchange = history.length === 1;
  await db
    .update(sessions)
    .set({
      messageCount: history.length + 1,
      // Keep imageUrl — it's used as the thumbnail when a look is saved.
      // imageData and imagesData are large blobs no longer needed after OpenAI.
      ...(isFirstExchange ? { imageData: null, imagesData: null } : {}),
    })
    .where(eq(sessions.id, sessionId));

  res.status(201).json(assistantMsg);
});

export default router;
