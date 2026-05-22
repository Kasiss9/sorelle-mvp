import { useState } from "react";
import { motion } from "framer-motion";
import { History, MessageSquare, ImageIcon, Sparkles, RefreshCw, MessageCircleHeart } from "lucide-react";
import Layout from "@/components/layout";
import {
  useListSessions,
  getListSessionsQueryKey,
  useGetRecentSessions,
  getGetRecentSessionsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth } from "@clerk/react";
import FeedbackModal from "@/components/feedback-modal";

export default function Sessions() {
  const { t, i18n } = useTranslation();
  const { isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  // Only skip retries on 401 (not-yet-authed race condition).
  // All other errors (cold DB start, network blip) should retry up to 2 times.
  const retryFn = (failureCount: number, error: unknown) => {
    if (error && typeof error === "object" && "status" in error && (error as { status: number }).status === 401) return false;
    return failureCount < 2;
  };

  const { data: sessions, isLoading, isError, refetch } = useListSessions({
    query: {
      queryKey: getListSessionsQueryKey(),
      enabled: isSignedIn === true,
      retry: retryFn,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 6000),
      staleTime: 0,
      refetchOnMount: "always",
    },
  });
  const { data: summary } = useGetRecentSessions({
    query: {
      queryKey: getGetRecentSessionsQueryKey(),
      enabled: isSignedIn === true,
      retry: retryFn,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 6000),
      staleTime: 0,
      refetchOnMount: "always",
    },
  });

  const handleRetry = () => {
    queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
    refetch();
  };

  return (
    <Layout>
      <div className="p-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-start justify-between mt-4 mb-1">
            <h2 className="text-2xl font-serif text-foreground">{t("sessions.title")}</h2>
            <button
              onClick={() => setFeedbackOpen(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition-colors mt-1.5"
            >
              <MessageCircleHeart className="w-4 h-4" strokeWidth={1.5} />
              {t("feedback.buttonLabel")}
            </button>
          </div>
          <p className="text-muted-foreground text-sm mb-6">{t("sessions.subtitle")}</p>

          {summary && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="flex gap-3 mb-8"
            >
              <div className="flex-1 bg-card rounded-2xl p-4 border border-border/40 shadow-sm text-center">
                <p className="text-2xl font-serif text-foreground">{summary.totalSessions}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 tracking-wide uppercase">{t("sessions.statSessions")}</p>
              </div>
              <div className="flex-1 bg-card rounded-2xl p-4 border border-border/40 shadow-sm text-center">
                <p className="text-2xl font-serif text-foreground">{summary.savedCount}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 tracking-wide uppercase">{t("sessions.statSaved")}</p>
              </div>
            </motion.div>
          )}

          {(isLoading || !isSignedIn) && (
            <div className="flex flex-col gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-20 rounded-2xl bg-card animate-pulse" />
              ))}
            </div>
          )}

          {isError && !isLoading && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-muted-foreground text-sm mb-4">{t("sessions.loadError", "Couldn't load your sessions.")}</p>
              <button
                onClick={handleRetry}
                className="flex items-center gap-2 text-sm font-medium text-primary"
              >
                <RefreshCw className="w-4 h-4" />
                {t("sessions.retry", "Try again")}
              </button>
            </div>
          )}

          {!isLoading && !isError && isSignedIn && (!sessions || sessions.length === 0) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center justify-center py-16 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-card flex items-center justify-center mb-5 shadow-sm">
                <Sparkles className="w-7 h-7 text-muted-foreground" strokeWidth={1.5} />
              </div>
              <h3 className="font-serif text-xl text-foreground mb-2">{t("sessions.emptyTitle")}</h3>
              <p className="text-muted-foreground text-sm max-w-[240px] leading-relaxed mb-6">
                {t("sessions.emptyDesc")}
              </p>
              <Link
                href="/upload"
                className="text-sm font-medium text-primary underline underline-offset-4 decoration-primary/40"
              >
                {t("sessions.emptyCta")}
              </Link>
            </motion.div>
          )}

          {!isLoading && !isError && sessions && sessions.length > 0 && (
            <div className="flex flex-col gap-3">
              {sessions.map((session, i) => (
                <motion.div
                  key={session.id}
                  data-testid={`session-${session.id}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: i * 0.05 }}
                >
                  <Link href={`/chat/${session.id}`} className="block">
                    <div className="flex items-center gap-4 bg-card border border-border/50 rounded-2xl p-4 shadow-sm hover:bg-card/70 active:scale-[0.98] transition-all">
                      <div className="w-14 h-14 rounded-xl overflow-hidden bg-background border border-border/30 flex-shrink-0 flex items-center justify-center">
                        {session.imageUrl ? (
                          <img src={session.imageUrl} alt={session.title} className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-5 h-5 text-muted-foreground/40" strokeWidth={1.5} />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground text-sm truncate">{session.title}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <MessageSquare className="w-3 h-3 text-muted-foreground/60" strokeWidth={1.5} />
                          <span className="text-[11px] text-muted-foreground/60">
                            {t("sessions.message", { count: session.messageCount })}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                          {new Date(session.createdAt).toLocaleDateString(i18n.language, { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      </div>

                      <div className="text-muted-foreground/40 flex-shrink-0">
                        <History className="w-4 h-4" strokeWidth={1.5} />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </Layout>
  );
}
