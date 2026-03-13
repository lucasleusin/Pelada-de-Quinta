-- CreateTable
CREATE TABLE "site_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "siteName" TEXT NOT NULL,
    "siteShortName" TEXT NOT NULL,
    "siteDescription" TEXT NOT NULL,
    "locationLabel" TEXT NOT NULL,
    "headerBadge" TEXT NOT NULL,
    "logoUrl" TEXT,
    "logoPath" TEXT,
    "faviconUrl" TEXT,
    "faviconPath" TEXT,
    "shareImageUrl" TEXT,
    "shareImagePath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id")
);
