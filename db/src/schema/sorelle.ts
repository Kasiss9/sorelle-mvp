import { boolean, integer, json, pgTable, serial, smallint, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const users = pgTable("sorelle_users", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  email: text("email").notNull(),
  marketingConsent: boolean("marketing_consent"),
  marketingConsentAt: timestamp("marketing_consent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export const sessions = pgTable("sorelle_sessions", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id"),
  title: text("title").notNull(),
  imageUrl: text("image_url"),
  imageData: text("image_data"),
  imagesData: json("images_data").$type<string[]>(),
  messageCount: integer("message_count").notNull().default(0),
  isSaved: boolean("is_saved").notNull().default(false),
  bodyType: text("body_type"),
  skinTone: text("skin_tone"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertSessionSchema = createInsertSchema(sessions).omit({ id: true, createdAt: true, messageCount: true });
export type Session = typeof sessions.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;

export const sessionMessages = pgTable("sorelle_messages", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  quickAction: text("quick_action"),
  imageData: text("image_data"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertSessionMessageSchema = createInsertSchema(sessionMessages).omit({ id: true, createdAt: true });
export type SessionMessage = typeof sessionMessages.$inferSelect;
export type InsertSessionMessage = z.infer<typeof insertSessionMessageSchema>;

export const uploadedImages = pgTable("sorelle_uploads", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertUploadedImageSchema = createInsertSchema(uploadedImages).omit({ id: true, createdAt: true });
export type UploadedImage = typeof uploadedImages.$inferSelect;
export type InsertUploadedImage = z.infer<typeof insertUploadedImageSchema>;

export const savedLooks = pgTable("sorelle_saved_looks", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").notNull(),
  // Nullable — set to null when the originating session is cleaned up.
  // This means saved looks survive independent of session lifecycle.
  sessionId: integer("session_id").references(() => sessions.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  imageUrl: text("image_url"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertSavedLookSchema = createInsertSchema(savedLooks).omit({ id: true, createdAt: true });
export type SavedLook = typeof savedLooks.$inferSelect;
export type InsertSavedLook = z.infer<typeof insertSavedLookSchema>;

export const feedback = pgTable("sorelle_feedback", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").notNull(),
  sessionId: integer("session_id").references(() => sessions.id, { onDelete: "set null" }),
  rating: smallint("rating"),
  nps: smallint("nps"),
  comment: text("comment"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertFeedbackSchema = createInsertSchema(feedback).omit({ id: true, createdAt: true });
export type Feedback = typeof feedback.$inferSelect;
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
