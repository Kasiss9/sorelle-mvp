import { Link } from "wouter";
import { motion } from "framer-motion";
import { Sparkles, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function Home() {
  const { t } = useTranslation();

  return (
    <div className="min-h-[100dvh] w-full bg-background flex justify-center overflow-hidden">
      <div className="w-full max-w-[430px] relative flex flex-col items-center justify-center p-8 text-center bg-gradient-to-b from-background to-card/30">
        <div className="absolute top-4 left-4">
          <Link
            href="/sign-in"
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-xs font-medium py-1.5 px-2 rounded-lg hover:bg-muted"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>{t("nav.signIn", "Sign in")}</span>
          </Link>
        </div>
        <div className="absolute top-4 right-4">
          <LanguageSwitcher />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-[320px] flex flex-col items-center"
        >
          <div className="w-16 h-16 rounded-full bg-card flex items-center justify-center mb-8 shadow-sm text-primary">
            <Sparkles className="w-8 h-8" strokeWidth={1.5} />
          </div>

          <h1 className="text-4xl font-serif text-foreground mb-4 tracking-tight leading-tight whitespace-pre-line">
            {t("home.headline")}
          </h1>

          <p className="text-muted-foreground font-sans text-sm leading-relaxed mb-12">
            {t("home.subtitle")}
          </p>

          <Link href="/upload" className="w-full">
            <Button size="lg" className="w-full rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-base h-14 shadow-md transition-all">
              {t("home.cta")}
            </Button>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
