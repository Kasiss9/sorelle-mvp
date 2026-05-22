import { motion, AnimatePresence } from "framer-motion";
import { Bookmark, Trash2, ImageIcon, RefreshCw } from "lucide-react";
import Layout from "@/components/layout";
import {
  useListSaved,
  getListSavedQueryKey,
  useDeleteSaved,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth } from "@clerk/react";

export default function Saved() {
  const { t, i18n } = useTranslation();
  const { isSignedIn } = useAuth();
  const { data: looks, isLoading, isError, refetch } = useListSaved({
    query: {
      queryKey: getListSavedQueryKey(),
      enabled: isSignedIn === true,
      retry: false,
      staleTime: 0,
      refetchOnMount: "always",
    },
  });
  const deleteSavedMutation = useDeleteSaved();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDelete = async (id: number) => {
    try {
      await deleteSavedMutation.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListSavedQueryKey() });
      toast({ title: t("saved.removeSuccess") });
    } catch {
      toast({ title: t("saved.removeError"), variant: "destructive" });
    }
  };

  return (
    <Layout>
      <div className="p-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-2xl font-serif text-foreground mb-1 mt-4">{t("saved.title")}</h2>
          <p className="text-muted-foreground text-sm mb-8">{t("saved.subtitle")}</p>

          {(isLoading || !isSignedIn) && (
            <div className="flex flex-col gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 rounded-2xl bg-card animate-pulse" />
              ))}
            </div>
          )}

          {isError && !isLoading && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-muted-foreground text-sm mb-4">{t("saved.loadError", "Couldn't load your saved looks.")}</p>
              <button
                onClick={() => refetch()}
                className="flex items-center gap-2 text-sm font-medium text-primary"
              >
                <RefreshCw className="w-4 h-4" />
                {t("saved.retry", "Try again")}
              </button>
            </div>
          )}

          {!isLoading && !isError && isSignedIn && (!looks || looks.length === 0) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-card flex items-center justify-center mb-5 shadow-sm">
                <Bookmark className="w-7 h-7 text-muted-foreground" strokeWidth={1.5} />
              </div>
              <h3 className="font-serif text-xl text-foreground mb-2">{t("saved.emptyTitle")}</h3>
              <p className="text-muted-foreground text-sm max-w-[240px] leading-relaxed mb-6">
                {t("saved.emptyDesc")}
              </p>
              <Link
                href="/upload"
                className="text-sm font-medium text-primary underline underline-offset-4 decoration-primary/40"
              >
                {t("saved.emptyCta")}
              </Link>
            </motion.div>
          )}

          {!isLoading && !isError && looks && looks.length > 0 && (
            <div className="flex flex-col gap-4">
              <AnimatePresence>
                {looks.map((look, i) => (
                  <motion.div
                    key={look.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.35, delay: i * 0.05 }}
                    className="flex items-center gap-4 bg-card border border-border/50 rounded-2xl p-4 shadow-sm"
                  >
                    <Link
                      href={look.sessionId ? `/chat/${look.sessionId}` : "#"}
                      className="flex items-center gap-4 flex-1 min-w-0"
                    >
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-background border border-border/30 flex-shrink-0 flex items-center justify-center">
                        {look.imageUrl ? (
                          <img src={look.imageUrl} alt={look.title} className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-6 h-6 text-muted-foreground/40" strokeWidth={1.5} />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground text-sm truncate">{look.title}</p>
                        {look.notes && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">{look.notes}</p>
                        )}
                        <p className="text-[11px] text-muted-foreground/60 mt-1">
                          {new Date(look.createdAt).toLocaleDateString(i18n.language, { month: "short", day: "numeric" })}
                        </p>
                        {!look.sessionId && (
                          <p className="text-[10px] text-muted-foreground/40 mt-0.5 italic">{t("saved.sessionGone", "Chat no longer available")}</p>
                        )}
                      </div>
                    </Link>

                    <button
                      onClick={() => handleDelete(look.id)}
                      disabled={deleteSavedMutation.isPending}
                      className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-background transition-colors flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      </div>
    </Layout>
  );
}
