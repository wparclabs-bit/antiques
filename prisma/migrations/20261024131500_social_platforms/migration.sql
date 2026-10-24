-- Ticket 10: the Settings-managed social-platform list feeding the
-- posting log's picker (the log's platform text stays free).
CREATE TABLE "SocialPlatform" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialPlatform_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SocialPlatform_name_key" ON "SocialPlatform"("name");
