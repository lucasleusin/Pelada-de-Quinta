"use client";

import { createContext, useContext, useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { DEFAULT_SITE_SETTINGS, type SiteSettingsPublic } from "@/lib/site-settings-contract";

type SiteSettingsContextValue = {
  settings: SiteSettingsPublic;
  setSettings: Dispatch<SetStateAction<SiteSettingsPublic>>;
};

const noopSetSiteSettings: Dispatch<SetStateAction<SiteSettingsPublic>> = () => undefined;

const fallbackContext: SiteSettingsContextValue = {
  settings: DEFAULT_SITE_SETTINGS,
  setSettings: noopSetSiteSettings,
};

const SiteSettingsContext = createContext<SiteSettingsContextValue | null>(null);

export function SiteSettingsProvider({
  initialSettings,
  children,
}: {
  initialSettings: SiteSettingsPublic;
  children: ReactNode;
}) {
  const [settings, setSettings] = useState(initialSettings);

  useEffect(() => {
    setSettings(initialSettings);
  }, [initialSettings]);

  return <SiteSettingsContext.Provider value={{ settings, setSettings }}>{children}</SiteSettingsContext.Provider>;
}

export function useSiteSettings() {
  return useContext(SiteSettingsContext)?.settings ?? DEFAULT_SITE_SETTINGS;
}

export function useSiteSettingsController() {
  return useContext(SiteSettingsContext) ?? fallbackContext;
}
