import { Router, type IRouter, type Request, type Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

const router: IRouter = Router();

function checkSecret(req: Request, res: Response): boolean {
  const secret = process.env.ADMIN_REPORT_SECRET;
  if (!secret) {
    res.status(503).send("Admin report not configured.");
    return false;
  }
  const token = req.query["token"] as string | undefined;
  if (!token || token !== secret) {
    res.status(401).send("Unauthorized.");
    return false;
  }
  return true;
}

type UserStats = {
  total: string;
  subscribed: string;
  declined: string;
  pending: string;
  new_today: string;
  new_7d: string;
};

type SessionStats = {
  total: string;
  today: string;
  last7d: string;
};

type MessageStats = {
  total: string;
  today: string;
  last7d: string;
};

type SavedStats = {
  total: string;
  today: string;
  last7d: string;
};

type RecentUser = {
  email: string;
  marketing_consent: boolean | null;
  created_at: string;
};

router.get("/admin/report", async (req, res): Promise<void> => {
  if (!checkSecret(req, res)) return;

  const usersResult = await db.execute<UserStats>(sql`
    SELECT
      COUNT(*)::text                                                              AS total,
      COUNT(*) FILTER (WHERE marketing_consent = true)::text                     AS subscribed,
      COUNT(*) FILTER (WHERE marketing_consent = false)::text                    AS declined,
      COUNT(*) FILTER (WHERE marketing_consent IS NULL)::text                    AS pending,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 day')::text       AS new_today,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::text      AS new_7d
    FROM sorelle_users
  `);
  const users = usersResult.rows[0]!;

  const sessionsResult = await db.execute<SessionStats>(sql`
    SELECT
      COUNT(*)::text                                                              AS total,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 day')::text       AS today,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::text      AS last7d
    FROM sorelle_sessions
  `);
  const sessions = sessionsResult.rows[0]!;

  const messagesResult = await db.execute<MessageStats>(sql`
    SELECT
      COUNT(*)::text                                                              AS total,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 day')::text       AS today,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::text      AS last7d
    FROM sorelle_messages
  `);
  const messages = messagesResult.rows[0]!;

  const savedResult = await db.execute<SavedStats>(sql`
    SELECT
      COUNT(*)::text                                                              AS total,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 day')::text       AS today,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::text      AS last7d
    FROM sorelle_saved_looks
  `);
  const saved = savedResult.rows[0]!;

  const recentUsersResult = await db.execute<RecentUser>(sql`
    SELECT email, marketing_consent, created_at
    FROM sorelle_users
    ORDER BY created_at DESC
    LIMIT 10
  `);
  const recentUsers = recentUsersResult.rows;

  const now = new Date();
  const generatedAt = now.toLocaleString("en-GB", {
    timeZone: "Europe/Amsterdam",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const subscribedPct =
    users.total === "0"
      ? 0
      : Math.round((parseInt(users.subscribed) / parseInt(users.total)) * 100);

  const userRows = recentUsers
    .map((u: RecentUser) => {
      const badge =
        u.marketing_consent === true
          ? `<span class="badge badge-yes">Newsletter</span>`
          : u.marketing_consent === false
            ? `<span class="badge badge-no">Declined</span>`
            : `<span class="badge badge-pending">Pending</span>`;
      const date = new Date(u.created_at).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
      });
      return `<div class="user-row">
        <span class="user-email">${u.email}</span>
        ${badge}
        <span class="user-date">${date}</span>
      </div>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sorelle — Daily Report</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Inter:wght@400;500&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #F5F1EA;
      color: #3A261D;
      font-family: 'Inter', sans-serif;
      font-size: 14px;
      min-height: 100vh;
      padding: 32px 16px 64px;
    }
    .container { max-width: 640px; margin: 0 auto; }
    header { text-align: center; margin-bottom: 36px; }
    header h1 {
      font-family: 'Cormorant Garamond', serif;
      font-size: 2.4rem;
      font-weight: 500;
      letter-spacing: 0.02em;
      color: #3A261D;
    }
    header p { font-size: 12px; color: #9a8070; margin-top: 6px; letter-spacing: 0.03em; }
    .section { margin-bottom: 24px; }
    .section-label {
      font-size: 10px; font-weight: 500; letter-spacing: 0.12em;
      text-transform: uppercase; color: #9a8070; margin-bottom: 10px; padding-left: 2px;
    }
    .card {
      background: #fff; border-radius: 16px; padding: 20px 24px;
      border: 1px solid rgba(58,38,29,0.08); box-shadow: 0 1px 4px rgba(58,38,29,0.04);
    }
    .grid { display: grid; gap: 10px; }
    .grid-2 { grid-template-columns: 1fr 1fr; }
    .grid-3 { grid-template-columns: 1fr 1fr 1fr; }
    .stat {
      background: #F5F1EA; border-radius: 12px;
      padding: 14px 16px; text-align: center;
    }
    .stat-value {
      font-family: 'Cormorant Garamond', serif;
      font-size: 2rem; font-weight: 500; color: #3A261D; line-height: 1;
    }
    .stat-label {
      font-size: 10px; color: #9a8070; margin-top: 4px;
      letter-spacing: 0.06em; text-transform: uppercase;
    }
    .progress-bar-track {
      background: #F5F1EA; border-radius: 99px; height: 8px;
      overflow: hidden; margin: 12px 0 4px;
    }
    .progress-bar-fill {
      background: #D8A7A2; height: 100%; border-radius: 99px;
    }
    .progress-label {
      display: flex; justify-content: space-between;
      font-size: 11px; color: #9a8070;
    }
    .divider { height: 1px; background: rgba(58,38,29,0.07); margin: 14px 0; }
    .row {
      display: flex; justify-content: space-between;
      align-items: center; padding: 8px 0;
    }
    .row + .row { border-top: 1px solid rgba(58,38,29,0.05); }
    .row-label { color: #3A261D; }
    .row-value { font-weight: 500; color: #3A261D; }
    .badge {
      display: inline-block; font-size: 10px; font-weight: 500;
      letter-spacing: 0.04em; border-radius: 99px; padding: 2px 8px;
      vertical-align: middle;
    }
    .badge-yes { background: #e8f5e9; color: #388e3c; }
    .badge-no  { background: #fbe9e7; color: #bf360c; }
    .badge-pending { background: #f5f5f5; color: #9a8070; }
    .two-col {
      display: grid; grid-template-columns: 1fr 1fr; gap: 0;
    }
    .two-col > div:last-child {
      border-left: 1px solid rgba(58,38,29,0.07);
      padding-left: 20px;
    }
    .two-col > div:first-child {
      padding-right: 20px;
    }
    .col-label {
      font-size: 11px; color: #9a8070; font-weight: 500;
      margin-bottom: 8px; text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .user-row {
      display: flex; align-items: center; gap: 10px; padding: 9px 0;
    }
    .user-row + .user-row { border-top: 1px solid rgba(58,38,29,0.05); }
    .user-email {
      flex: 1; color: #3A261D; font-size: 13px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .user-date { font-size: 11px; color: #9a8070; flex-shrink: 0; }
    footer {
      text-align: center; margin-top: 40px;
      font-size: 11px; color: #bbb;
    }
    @media (max-width: 420px) {
      .grid-3 { grid-template-columns: 1fr 1fr; }
      .two-col { grid-template-columns: 1fr; }
      .two-col > div:last-child { border-left: none; border-top: 1px solid rgba(58,38,29,0.07); padding-left: 0; padding-top: 12px; margin-top: 4px; }
      .two-col > div:first-child { padding-right: 0; }
    }
  </style>
</head>
<body>
<div class="container">

  <header>
    <h1>Sorelle</h1>
    <p>Daily report &mdash; ${generatedAt}</p>
  </header>

  <div class="section">
    <div class="section-label">Users</div>
    <div class="card">
      <div class="grid grid-3">
        <div class="stat">
          <div class="stat-value">${users.total}</div>
          <div class="stat-label">Total</div>
        </div>
        <div class="stat">
          <div class="stat-value">${users.new_today}</div>
          <div class="stat-label">Today</div>
        </div>
        <div class="stat">
          <div class="stat-value">${users.new_7d}</div>
          <div class="stat-label">Last 7 days</div>
        </div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-label">Newsletter consent</div>
    <div class="card">
      <div class="progress-label">
        <span>${users.subscribed} subscribed</span>
        <span>${subscribedPct}%</span>
      </div>
      <div class="progress-bar-track">
        <div class="progress-bar-fill" style="width:${subscribedPct}%"></div>
      </div>
      <div class="divider"></div>
      <div class="row">
        <span class="row-label">Subscribed</span>
        <span class="row-value">${users.subscribed} <span class="badge badge-yes">YES</span></span>
      </div>
      <div class="row">
        <span class="row-label">Declined</span>
        <span class="row-value">${users.declined} <span class="badge badge-no">NO</span></span>
      </div>
      <div class="row">
        <span class="row-label">Not yet answered</span>
        <span class="row-value">${users.pending} <span class="badge badge-pending">PENDING</span></span>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-label">Styling sessions</div>
    <div class="card">
      <div class="grid grid-3">
        <div class="stat">
          <div class="stat-value">${sessions.total}</div>
          <div class="stat-label">All time</div>
        </div>
        <div class="stat">
          <div class="stat-value">${sessions.today}</div>
          <div class="stat-label">Today</div>
        </div>
        <div class="stat">
          <div class="stat-value">${sessions.last7d}</div>
          <div class="stat-label">Last 7 days</div>
        </div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-label">Engagement</div>
    <div class="card">
      <div class="two-col">
        <div>
          <div class="col-label">Messages</div>
          <div class="row" style="padding-top:0">
            <span class="row-label">All time</span>
            <span class="row-value">${messages.total}</span>
          </div>
          <div class="row">
            <span class="row-label">Today</span>
            <span class="row-value">${messages.today}</span>
          </div>
          <div class="row">
            <span class="row-label">Last 7 days</span>
            <span class="row-value">${messages.last7d}</span>
          </div>
        </div>
        <div>
          <div class="col-label">Saved looks</div>
          <div class="row" style="padding-top:0">
            <span class="row-label">All time</span>
            <span class="row-value">${saved.total}</span>
          </div>
          <div class="row">
            <span class="row-label">Today</span>
            <span class="row-value">${saved.today}</span>
          </div>
          <div class="row">
            <span class="row-label">Last 7 days</span>
            <span class="row-value">${saved.last7d}</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-label">Recent sign-ups (last 10)</div>
    <div class="card">
      ${recentUsers.length === 0
        ? `<p style="color:#9a8070;text-align:center;padding:12px 0">No users yet.</p>`
        : userRows}
    </div>
  </div>

  <footer>Sorelle admin &mdash; refresh anytime for the latest numbers</footer>

</div>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.send(html);
});

export default router;
