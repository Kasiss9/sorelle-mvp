# Sorelle

An emotionally intelligent AI stylist for women — upload an outfit photo, chat naturally with Sorelle for styling advice, save your favorite looks.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/sorelle run dev` — run the frontend (reads PORT from env)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `AI_INTEGRATIONS_OPENAI_BASE_URL` + `AI_INTEGRATIONS_OPENAI_API_KEY` — OpenAI via Replit AI Integrations (auto-set)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Wouter + Framer Motion + Tailwind
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- AI: OpenAI gpt-5.4 with vision (via Replit AI Integrations)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth)
- `lib/api-client-react/src/generated/` — generated React Query hooks
- `lib/api-zod/src/generated/` — generated Zod schemas for server
- `lib/db/src/schema/sorelle.ts` — Sorelle DB tables (sessions, messages, uploads, saved_looks)
- `lib/db/src/schema/conversations.ts` + `messages.ts` — OpenAI integration tables
- `artifacts/sorelle/src/pages/` — Frontend pages (home, upload, chat, saved, sessions)
- `artifacts/sorelle/src/components/layout.tsx` — Bottom nav layout component
- `artifacts/api-server/src/routes/` — API routes (sessions, messages, uploads, saved, health)

## Architecture decisions

- OpenAPI-first: spec in `lib/api-spec/openapi.yaml` drives all codegen; never hand-write API types
- Sessions store `imageData` (base64 data URL) for passing to OpenAI Vision on the first message
- AI uses OpenAI gpt-5.4 with the full conversation history + image on first message
- SORELLE_SYSTEM_PROMPT in `messages.ts` defines Sorelle's personality as a stylish older sister
- Frontend is mobile-first, max-w-[430px] centered, with bottom tab nav

## Product

- **Welcome screen** — "Style that gets you." onboarding with dusty rose CTA
- **Upload screen** — image upload with example prompt suggestions (tap to select), then start conversation
- **Chat screen** — real AI styling advice via GPT-4o vision, quick action chips, bookmark to save
- **Saved Looks** — grid of saved outfit chats with thumbnails
- **Sessions** — history of all styling conversations with summary stats

## User preferences

- Premium quiet luxury aesthetic — warm ivories, no neon, no tech startup look
- Mobile-first design, centered app shell
- Cormorant Garamond (serif) for headlines, Inter (sans-serif) for UI
- Color palette: Warm Ivory #F5F1EA, Dusty Rose #D8A7A2 (accent), Espresso #3A261D (text)

## Gotchas

- Always run codegen after changing `lib/api-spec/openapi.yaml`
- `imageData` is stored as a base64 data URL in the sessions table — large but avoids needing object storage for MVP
- OpenAI vision is sent only on the first message of a session (when `session.imageData` exists and it's the first message in history)
- Replit AI Integrations handles OpenAI credentials — never ask user for API keys

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
