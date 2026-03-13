export type SiteSettingsPublic = {
  id: string;
  siteName: string;
  siteShortName: string;
  siteDescription: string;
  locationLabel: string;
  headerBadge: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  shareImageUrl: string | null;
  updatedAt: string;
};

export const DEFAULT_SITE_SETTINGS_VALUES = {
  siteName: "Pelada da Quinta",
  siteShortName: "CH-RS - Pelada",
  siteDescription: "Gestao da pelada semanal de Cachoeira do Sul",
  locationLabel: "Cachoeira do Sul",
  headerBadge: "Gestao Semanal",
} as const;

export const DEFAULT_SITE_SETTINGS: SiteSettingsPublic = {
  id: "default",
  ...DEFAULT_SITE_SETTINGS_VALUES,
  logoUrl: null,
  faviconUrl: null,
  shareImageUrl: null,
  updatedAt: new Date(0).toISOString(),
};
