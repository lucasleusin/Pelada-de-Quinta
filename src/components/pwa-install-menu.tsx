"use client";

import Link from "next/link";
import { CheckCircle2, Download, Shield, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
};

type LegacyMediaQueryList = MediaQueryList & {
  addListener?: (listener: (event: MediaQueryListEvent) => void) => void;
  removeListener?: (listener: (event: MediaQueryListEvent) => void) => void;
};

function isStandaloneMode() {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

function isIosDevice() {
  if (typeof window === "undefined") {
    return false;
  }

  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export function PwaInstallMenu() {
  const [open, setOpen] = useState(false);
  const [online, setOnline] = useState(true);
  const [standalone, setStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [hint, setHint] = useState("");

  useEffect(() => {
    const syncState = () => {
      setOnline(window.navigator.onLine);
      setStandalone(isStandaloneMode());
    };

    const mediaQuery = window.matchMedia("(display-mode: standalone)") as LegacyMediaQueryList;
    const handleDisplayModeChange = () => syncState();
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    syncState();

    window.addEventListener("online", syncState);
    window.addEventListener("offline", syncState);
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleDisplayModeChange);
    } else if (typeof mediaQuery.addListener === "function") {
      mediaQuery.addListener(handleDisplayModeChange);
    }

    return () => {
      window.removeEventListener("online", syncState);
      window.removeEventListener("offline", syncState);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", handleDisplayModeChange);
      } else if (typeof mediaQuery.removeListener === "function") {
        mediaQuery.removeListener(handleDisplayModeChange);
      }
    };
  }, []);

  async function handleInstall() {
    if (standalone) {
      setHint("O app ja esta instalado neste aparelho.");
      return;
    }

    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice.catch(() => null);

      if (choice?.outcome === "accepted") {
        setHint("Instalacao iniciada no navegador.");
        setDeferredPrompt(null);
        setOpen(false);
        return;
      }

      setHint("Voce pode instalar depois pelo menu do navegador.");
      return;
    }

    if (isIosDevice()) {
      setHint("No iPhone: abra no Safari, toque em Compartilhar e depois em Adicionar a Tela de Inicio.");
      return;
    }

    setHint("No Android: abra o menu do navegador e escolha Instalar app ou Adicionar a tela inicial.");
  }

  return (
    <div className="relative md:hidden">
      <div className="flex items-center gap-2">
        {!online ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700">
            <WifiOff className="size-3" />
            Offline
          </span>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-full bg-white"
          onClick={() => setOpen((current) => !current)}
        >
          {open ? "Fechar" : "Mais"}
        </Button>
      </div>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-emerald-200 bg-white/95 p-3 shadow-xl backdrop-blur">
          <div className="flex flex-col gap-2">
            <button
              type="button"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "w-full justify-start rounded-xl bg-white",
              )}
              onClick={handleInstall}
            >
              {standalone ? <CheckCircle2 className="size-4" /> : <Download className="size-4" />}
              {standalone ? "App instalado" : "Instalar app"}
            </button>

            <Link
              href="/admin"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "w-full justify-start rounded-xl bg-white",
              )}
              onClick={() => setOpen(false)}
            >
              <Shield className="size-4" />
              Admin
            </Link>
          </div>

          <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
              App no celular
            </p>
            <p className="mt-1 text-sm text-emerald-900">
              {hint ||
                (standalone
                  ? "Voce esta usando a versao instalada."
                  : "Instale na tela inicial para abrir como app no iPhone ou Android.")}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
