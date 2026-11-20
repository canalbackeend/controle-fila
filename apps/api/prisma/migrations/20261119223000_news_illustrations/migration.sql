CREATE TABLE "NewsIllustration" (
    "category" TEXT NOT NULL,
    "fileTitle" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "license" TEXT NOT NULL,
    "licenseUrl" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    CONSTRAINT "NewsIllustration_pkey" PRIMARY KEY ("category")
);
