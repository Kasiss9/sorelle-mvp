import { Router, type IRouter } from "express";
import { db, uploadedImages } from "@workspace/db";

const router: IRouter = Router();

router.post("/uploads", async (req, res): Promise<void> => {
  const { imageData, mimeType } = req.body;
  if (!imageData || !mimeType) {
    res.status(400).json({ error: "imageData and mimeType are required" });
    return;
  }

  const dataUrl = `data:${mimeType};base64,${imageData}`;

  const [upload] = await db.insert(uploadedImages).values({ url: dataUrl }).returning();
  res.status(201).json(upload);
});

export default router;
