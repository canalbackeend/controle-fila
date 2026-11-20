ALTER TABLE "NewsIllustration"
    DROP CONSTRAINT "NewsIllustration_pkey",
    ADD CONSTRAINT "NewsIllustration_pkey" PRIMARY KEY ("category", "fileTitle");

ALTER TABLE "NewsItem" ADD COLUMN "articleUrl" TEXT;
