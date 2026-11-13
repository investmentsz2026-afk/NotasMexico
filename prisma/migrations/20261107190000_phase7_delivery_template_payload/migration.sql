-- AlterTable
ALTER TABLE "notification_deliveries" ADD COLUMN "subject" VARCHAR(255);
ALTER TABLE "notification_deliveries" ADD COLUMN "html_body" TEXT;
ALTER TABLE "notification_deliveries" ADD COLUMN "text_body" TEXT;

