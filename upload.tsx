import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ImagePlus, Loader2, ArrowRight, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import Layout from "@/components/layout";
import { useCreateSession, useSendMessage } from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";

interface SelectedImage {
  file: File;
  preview: string;
}

function generateThumbnail(dataUrl: string, maxPx = 160): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(maxPx / img.width, maxPx / img.height, 1);
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(dataUrl); return; }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function ChipGroup({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string; swatch?: string }[];
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(active ? null : opt.value)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all ${
              active
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
            }`}
          >
            {opt.swatch && (
              <span
                className="w-3 h-3 rounded-full border border-black/10 flex-shrink-0"
                style={{ background: opt.swatch }}
              />
            )}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export default function Upload() {
  const [, setLocation] = useLocation();
  const { t, i18n } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<SelectedImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [activeSuggestion, setActiveSuggestion] = useState<string | null>(null);
  const [bodyType, setBodyType] = useState<string | null>(null);
  const [skinTone, setSkinTone] = useState<string | null>(null);

  const createSessionMutation = useCreateSession();
  const sendMessageMutation = useSendMessage();

  const BODY_TYPES = [
    { value: "Hourglass", label: t("upload.bodyTypes.hourglass") },
    { value: "Pear", label: t("upload.bodyTypes.pear") },
    { value: "Apple", label: t("upload.bodyTypes.apple") },
    { value: "Rectangle", label: t("upload.bodyTypes.rectangle") },
    { value: "Inverted Triangle", label: t("upload.bodyTypes.invertedTriangle") },
  ];

  const SKIN_TONES = [
    { value: "Fair cool", label: t("upload.skinTones.fairCool"), swatch: "#F6E8DC" },
    { value: "Fair warm", label: t("upload.skinTones.fairWarm"), swatch: "#F5DEC8" },
    { value: "Light", label: t("upload.skinTones.light"), swatch: "#E8C9A8" },
    { value: "Medium cool", label: t("upload.skinTones.mediumCool"), swatch: "#C9996A" },
    { value: "Medium warm", label: t("upload.skinTones.mediumWarm"), swatch: "#C28A4E" },
    { value: "Tan", label: t("upload.skinTones.tan"), swatch: "#A0673A" },
    { value: "Deep cool", label: t("upload.skinTones.deepCool"), swatch: "#6B3A2A" },
    { value: "Deep warm", label: t("upload.skinTones.deepWarm"), swatch: "#5C3118" },
  ];

  const SUGGESTIONS = [
    t("upload.suggestions.s1"),
    t("upload.suggestions.s2"),
    t("upload.suggestions.s3"),
    t("upload.suggestions.s4"),
    t("upload.suggestions.s5"),
    t("upload.suggestions.s6"),
    t("upload.suggestions.s7"),
    t("upload.suggestions.s8"),
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImages((prev) => {
          if (prev.length >= 5) return prev;
          return [...prev, { file, preview: reader.result as string }];
        });
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleStartStyling = async () => {
    if (!images.length) return;
    setIsProcessing(true);
    setUploadError(null);
    try {
      const thumbnail = await generateThumbnail(images[0].preview);
      const session = await createSessionMutation.mutateAsync({
        data: {
          title: images.length > 1 ? `Comparing ${images.length} looks` : "Styling session",
          imageUrl: thumbnail,
          imagesData: images.map((img) => img.preview),
          bodyType: bodyType ?? undefined,
          skinTone: skinTone ?? undefined,
        },
      });

      const messageContent = activeSuggestion ?? (images.length > 1
        ? "Can you compare these outfits and tell me which works best?"
        : "What do you think of this look?");

      await sendMessageMutation.mutateAsync({
        id: session.id,
        data: {
          content: messageContent,
          language: i18n.language?.slice(0, 2) ?? "en",
        },
      });

      setLocation(`/chat/${session.id}`);
    } catch (error) {
      console.error("Failed to start session:", error);
      setUploadError(t("upload.errorRetry"));
      setIsProcessing(false);
    }
  };

  return (
    <Layout>
      <div className="p-6 flex flex-col">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-2xl font-serif text-foreground mb-1 mt-4">{t("upload.title")}</h2>
          <p className="text-muted-foreground text-sm mb-6">
            {images.length > 1
              ? t("upload.subtitle_multi", { count: images.length })
              : t("upload.subtitle_single")}
          </p>

          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            multiple
            onChange={handleFileChange}
          />

          {images.length === 0 && (
            <div
              className="w-full aspect-[3/4] bg-card rounded-2xl border-2 border-dashed border-border/50 flex flex-col items-center justify-center cursor-pointer hover:bg-card/80 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="flex flex-col items-center text-muted-foreground p-6 text-center">
                <ImagePlus className="w-10 h-10 mb-3 opacity-50" />
                <span className="font-medium text-foreground mb-1">{t("upload.tapToUpload")}</span>
                <span className="text-xs">{t("upload.uploadHint")}</span>
                <span className="text-xs text-muted-foreground/60 mt-1">{t("upload.uploadLimit")}</span>
              </div>
            </div>
          )}

          {images.length > 0 && (
            <AnimatePresence>
              <div className="grid grid-cols-2 gap-3">
                {images.map((img, i) => (
                  <motion.div
                    key={img.preview.slice(-20)}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    transition={{ duration: 0.25 }}
                    className={`relative rounded-2xl overflow-hidden bg-card border border-border/30 shadow-sm ${
                      images.length === 1 ? "col-span-2 aspect-[3/4]" : "aspect-[3/4]"
                    }`}
                  >
                    <img src={img.preview} alt={`Look ${i + 1}`} className="w-full h-full object-cover" />
                    {images.length > 1 && (
                      <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center text-[10px] font-semibold text-foreground">
                        {i + 1}
                      </div>
                    )}
                    <button
                      onClick={() => removeImage(i)}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-foreground/70 backdrop-blur-sm flex items-center justify-center text-background hover:bg-foreground transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                ))}
                {images.length < 5 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="aspect-[3/4] rounded-2xl border-2 border-dashed border-border/40 bg-card/40 flex flex-col items-center justify-center cursor-pointer hover:bg-card/60 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Plus className="w-6 h-6 text-muted-foreground/60 mb-1" strokeWidth={1.5} />
                    <span className="text-[11px] text-muted-foreground/60">{t("upload.addPhoto")}</span>
                  </motion.div>
                )}
              </div>
            </AnimatePresence>
          )}

          {images.length > 0 && !isProcessing && (
            <div className="mt-8 space-y-6 animate-in fade-in slide-in-from-bottom-4">

              {/* Body type */}
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <p className="text-sm font-medium text-foreground">{t("upload.bodyType")}</p>
                  <span className="text-muted-foreground font-normal text-[11px]">{t("upload.optional")}</span>
                </div>
                <ChipGroup options={BODY_TYPES} value={bodyType} onChange={setBodyType} />
              </div>

              {/* Skin tone */}
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <p className="text-sm font-medium text-foreground">{t("upload.skinTone")}</p>
                  <span className="text-muted-foreground font-normal text-[11px]">{t("upload.optional")}</span>
                </div>
                <ChipGroup options={SKIN_TONES} value={skinTone} onChange={setSkinTone} />
              </div>

              {/* Prompt suggestions */}
              <div>
                <p className="text-sm font-medium text-foreground mb-2.5">{t("upload.whatToAsk")}</p>
                <div className="flex flex-wrap gap-2 mb-6">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setActiveSuggestion(activeSuggestion === suggestion ? null : suggestion)}
                      className={`text-xs px-4 py-2 rounded-full border transition-all ${
                        activeSuggestion === suggestion
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                      }`}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleStartStyling}
                className="w-full rounded-full h-14 text-base font-medium shadow-sm bg-foreground text-background hover:bg-foreground/90"
              >
                {images.length > 1
                  ? t("upload.compareCta", { count: images.length })
                  : t("upload.startCta")}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}

          {uploadError && !isProcessing && (
            <div className="mt-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm text-center">
              {uploadError}
            </div>
          )}

          {isProcessing && (
            <div className="mt-8 flex flex-col items-center justify-center p-6 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mb-3 text-primary" />
              <span className="text-sm">{t("upload.analyzing")}</span>
            </div>
          )}
        </motion.div>
      </div>
    </Layout>
  );
}
