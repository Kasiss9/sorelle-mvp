import { useState, useRef, useEffect } from "react";
import { useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, BookmarkPlus, ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Layout from "@/components/layout";
import {
  useGetSession,
  getGetSessionQueryKey,
  useListMessages,
  getListMessagesQueryKey,
  useSendMessage,
  useSaveLook,
  getListSavedQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

export default function Chat() {
  const { sessionId } = useParams();
  const id = parseInt(sessionId || "0", 10);
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  const [inputValue, setInputValue] = useState("");
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [latchedImageUrls, setLatchedImageUrls] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const QUICK_ACTIONS = [
    t("chat.quickActions.moreElegant"),
    t("chat.quickActions.moreCasual"),
    t("chat.quickActions.moreFlattering"),
    t("chat.quickActions.dateNight"),
    t("chat.quickActions.workwear"),
    t("chat.quickActions.vacationStyling"),
    t("chat.quickActions.minimalist"),
    t("chat.quickActions.capsule"),
  ];

  const authRetry = (failureCount: number, error: unknown) => {
    const status = error && typeof error === "object" && "status" in error
      ? (error as { status: number }).status : 0;
    if (status === 404) return false;
    if (status === 401) return failureCount < 4;
    return failureCount < 2;
  };
  const authRetryDelay = (_: number, error: unknown) => {
    const status = error && typeof error === "object" && "status" in error
      ? (error as { status: number }).status : 0;
    return status === 401 ? 300 : 1500;
  };

  const { data: session, isError: sessionError } = useGetSession(id, {
    query: {
      enabled: !!id,
      queryKey: getGetSessionQueryKey(id),
      staleTime: 5 * 60 * 1000,
      retry: authRetry,
      retryDelay: authRetryDelay,
    },
  });

  const { data: messages } = useListMessages(id, {
    query: {
      enabled: !!id,
      queryKey: getListMessagesQueryKey(id),
      retry: authRetry,
      retryDelay: authRetryDelay,
    },
  });

  const sendMessageMutation = useSendMessage();
  const saveLookMutation = useSaveLook();

  useEffect(() => {
    const urls = session?.imageUrls;
    if (urls && urls.length > 0 && latchedImageUrls.length === 0) {
      setLatchedImageUrls(urls);
    }
  }, [session?.imageUrls, latchedImageUrls.length]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo(0, scrollRef.current.scrollHeight);
    }
  }, [messages, sendMessageMutation.isPending]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setPendingImage(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleSend = async (content: string, quickAction: string | null = null) => {
    if (!content.trim() && !quickAction && !pendingImage) return;

    const imageToSend = pendingImage;
    setInputValue("");
    setPendingImage(null);

    try {
      await sendMessageMutation.mutateAsync({
        id,
        data: {
          content: content || (quickAction ?? ""),
          quickAction,
          imageData: imageToSend ?? undefined,
          language: i18n.language?.slice(0, 2) ?? "en",
        },
      });
      queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(id) });
    } catch (error) {
      console.error("Failed to send message", error);
    }
  };

  const handleSave = async () => {
    if (!session) return;
    try {
      await saveLookMutation.mutateAsync({
        data: { sessionId: session.id, title: session.title || "Saved Look" },
      });
      await queryClient.invalidateQueries({ queryKey: getListSavedQueryKey() });
      toast({ title: t("chat.lookSaved"), description: t("chat.lookSavedDesc") });
    } catch {
      toast({ title: t("chat.saveError"), variant: "destructive" });
    }
  };

  if (sessionError) {
    return (
      <Layout>
        <div className="flex flex-col h-full items-center justify-center gap-4 px-6 text-center">
          <p className="text-muted-foreground text-sm">{t("chat.sessionLoadError", "Couldn't load this session.")}</p>
          <button
            onClick={() => window.history.back()}
            className="text-sm font-medium text-primary underline underline-offset-4"
          >
            {t("chat.goBack", "Go back")}
          </button>
        </div>
      </Layout>
    );
  }

  if (!session) {
    return (
      <Layout>
        <div className="flex h-full items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col h-full bg-background">
        {/* Header */}
        <header className="bg-background/90 backdrop-blur-md sticky top-0 z-10 border-b border-border">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="font-serif font-medium text-lg">Sorelle</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSave}
              disabled={saveLookMutation.isPending}
              className="text-muted-foreground hover:text-foreground"
            >
              <BookmarkPlus className="w-5 h-5" />
            </Button>
          </div>

          {latchedImageUrls.length > 1 && (
            <div className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar">
              {latchedImageUrls.map((url, i) => (
                <div
                  key={i}
                  className="flex-shrink-0 w-12 h-16 rounded-xl overflow-hidden border border-border/40 shadow-sm bg-card"
                >
                  <img src={url} alt={`Look ${i + 1}`} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </header>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6" ref={scrollRef}>
          {latchedImageUrls.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-2 justify-end ml-auto max-w-[85%]"
            >
              {latchedImageUrls.length === 1 ? (
                <div className="rounded-2xl rounded-tr-sm overflow-hidden border border-border/30 shadow-sm w-44 h-56">
                  <img src={latchedImageUrls[0]} alt="Your outfit" className="w-full h-full object-cover" />
                </div>
              ) : (
                latchedImageUrls.map((url, i) => (
                  <div
                    key={i}
                    className="relative rounded-2xl overflow-hidden border border-border/30 shadow-sm flex-shrink-0"
                    style={{ width: latchedImageUrls.length === 2 ? "48%" : "32%", aspectRatio: "3/4" }}
                  >
                    <img src={url} alt={`Look ${i + 1}`} className="w-full h-full object-cover" />
                    <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center text-[10px] font-semibold text-foreground">
                      {i + 1}
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          )}

          {messages?.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex flex-col max-w-[85%] ${
                msg.role === "user" ? "self-end items-end ml-auto" : "self-start items-start"
              }`}
            >
              {msg.role === "assistant" && (
                <span className="text-[10px] text-muted-foreground mb-1 ml-1 font-medium tracking-wide uppercase">
                  Sorelle
                </span>
              )}
              {msg.role === "user" && msg.imageUrl && (
                <div className="mb-1.5 rounded-xl overflow-hidden border border-border/30 shadow-sm w-40 h-52">
                  <img src={msg.imageUrl} alt="Attached" className="w-full h-full object-cover" />
                </div>
              )}
              <div
                className={`px-4 py-3 rounded-2xl text-[15px] leading-relaxed shadow-sm ${
                  msg.role === "user"
                    ? "bg-foreground text-background rounded-tr-sm"
                    : "bg-card text-card-foreground rounded-tl-sm border border-border/50"
                }`}
              >
                {msg.content}
              </div>
            </motion.div>
          ))}

          {sendMessageMutation.isPending && (
            <div className="flex flex-col self-start max-w-[85%]">
              <span className="text-[10px] text-muted-foreground mb-1 ml-1 font-medium tracking-wide uppercase">
                {t("chat.typing")}
              </span>
              <div className="px-4 py-4 rounded-2xl rounded-tl-sm bg-card border border-border/50 flex gap-1 items-center shadow-sm w-16">
                <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}

          {!sendMessageMutation.isPending &&
            messages &&
            messages.length > 0 &&
            messages[messages.length - 1].role === "assistant" && (
              <div className="pt-2 space-y-3 animate-in fade-in slide-in-from-bottom-2">
                <Button
                  onClick={handleSave}
                  disabled={saveLookMutation.isPending}
                  variant="outline"
                  className="w-full rounded-full border-primary/40 text-primary hover:bg-primary/5 hover:border-primary font-medium gap-2 shadow-sm"
                >
                  <BookmarkPlus className="w-4 h-4" />
                  {saveLookMutation.isPending ? t("chat.saving", "Saving…") : t("chat.saveThisLook", "Save this look")}
                </Button>
                <div className="flex flex-wrap gap-2">
                  {QUICK_ACTIONS.map((action) => (
                    <button
                      key={action}
                      onClick={() => handleSend(action, action)}
                      className="text-xs px-4 py-2 rounded-full bg-background border border-border text-muted-foreground hover:border-primary/50 hover:text-foreground transition-all shadow-sm"
                    >
                      {action}
                    </button>
                  ))}
                </div>
              </div>
            )}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-background border-t border-border mt-auto">
          <AnimatePresence>
            {pendingImage && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                className="flex items-center gap-2 mb-3"
              >
                <div className="relative w-14 rounded-xl overflow-hidden border border-border/40 shadow-sm flex-shrink-0">
                  <img src={pendingImage} alt="Pending" className="w-14 h-[72px] object-cover rounded-xl" />
                  <button
                    onClick={() => setPendingImage(null)}
                    className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-foreground/70 flex items-center justify-center"
                  >
                    <X className="w-3 h-3 text-background" />
                  </button>
                </div>
                <span className="text-xs text-muted-foreground">{t("chat.photoAttached")}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageSelect}
          />

          <form
            onSubmit={(e) => { e.preventDefault(); handleSend(inputValue); }}
            className="flex items-center gap-2"
          >
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={sendMessageMutation.isPending}
              className="flex-shrink-0 w-10 h-10 rounded-full bg-card border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card/80 transition-colors shadow-sm disabled:opacity-40"
            >
              <ImagePlus className="w-4.5 h-4.5" strokeWidth={1.5} />
            </button>

            <div className="relative flex-1">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={pendingImage ? t("chat.placeholderPhoto") : t("chat.placeholder")}
                className="rounded-full pl-4 pr-12 h-12 bg-card border-border/50 focus-visible:ring-primary focus-visible:border-primary shadow-sm"
                disabled={sendMessageMutation.isPending}
              />
              <Button
                type="submit"
                size="icon"
                className="absolute right-1 top-1 w-10 h-10 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                disabled={(!inputValue.trim() && !pendingImage) || sendMessageMutation.isPending}
              >
                <Send className="w-4 h-4 ml-0.5" />
              </Button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}
