-- Voice announcements are paused; every TV goes back to the beep.
UPDATE "PanelConfig" SET "callSound" = 'BEEP' WHERE "callSound" = 'VOICE';
