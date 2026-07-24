-- AlterTable
ALTER TABLE "lead_lists" ADD COLUMN     "stats_pulled_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "outreach_contact_id" UUID,
ADD COLUMN     "outreach_email" TEXT,
ADD COLUMN     "outreach_email_reason" TEXT;

-- CreateTable
CREATE TABLE "provider_email_stats" (
    "id" UUID NOT NULL,
    "provider" "EmailProvider" NOT NULL,
    "external_campaign_id" TEXT NOT NULL,
    "external_lead_email" TEXT NOT NULL,
    "sequence_number" INTEGER NOT NULL,
    "lead_id" UUID,
    "sent_at" TIMESTAMP(3),
    "open_count" INTEGER NOT NULL DEFAULT 0,
    "click_count" INTEGER NOT NULL DEFAULT 0,
    "replied_at" TIMESTAMP(3),
    "bounced" BOOLEAN NOT NULL DEFAULT false,
    "raw" JSONB,
    "pulled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_email_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "provider_email_stats_lead_id_idx" ON "provider_email_stats"("lead_id");

-- CreateIndex
CREATE UNIQUE INDEX "provider_email_stats_provider_external_campaign_id_external_key" ON "provider_email_stats"("provider", "external_campaign_id", "external_lead_email", "sequence_number");

-- AddForeignKey
ALTER TABLE "provider_email_stats" ADD CONSTRAINT "provider_email_stats_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

