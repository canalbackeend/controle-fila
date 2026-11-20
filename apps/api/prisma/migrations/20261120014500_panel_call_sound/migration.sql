CREATE TYPE "CallSound" AS ENUM ('BEEP', 'VOICE');

ALTER TABLE "PanelConfig"
    ADD COLUMN "callSound" "CallSound" NOT NULL DEFAULT 'BEEP';
