-- CreateEnum
CREATE TYPE "ListStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED');

-- CreateEnum
CREATE TYPE "KonciRegistrationStatus" AS ENUM ('PENDING', 'PREPARED', 'NEEDS_PHONE', 'FAILED', 'SKIPPED');

-- DropForeignKey
ALTER TABLE "campaign_leads" DROP CONSTRAINT "campaign_leads_campaign_id_fkey";

-- DropForeignKey
ALTER TABLE "campaign_leads" DROP CONSTRAINT "campaign_leads_contact_id_fkey";

-- DropForeignKey
ALTER TABLE "campaign_leads" DROP CONSTRAINT "campaign_leads_lead_id_fkey";

-- DropForeignKey
ALTER TABLE "campaign_steps" DROP CONSTRAINT "campaign_steps_campaign_id_fkey";

-- DropForeignKey
ALTER TABLE "campaign_steps" DROP CONSTRAINT "campaign_steps_template_id_fkey";

-- DropForeignKey
ALTER TABLE "emails" DROP CONSTRAINT "emails_campaign_lead_id_fkey";

-- DropForeignKey
ALTER TABLE "videos" DROP CONSTRAINT "videos_campaign_lead_id_fkey";

-- AlterTable
ALTER TABLE "emails" DROP COLUMN "campaign_lead_id";

-- AlterTable
ALTER TABLE "lead_lists" ADD COLUMN     "status" "ListStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "templates" DROP COLUMN "body",
DROP COLUMN "subject";

-- AlterTable
ALTER TABLE "videos" DROP COLUMN "campaign_lead_id";

-- DropTable
DROP TABLE "campaign_leads";

-- DropTable
DROP TABLE "campaign_steps";

-- DropTable
DROP TABLE "campaigns";

-- DropEnum
DROP TYPE "CampaignLeadStatus";

-- DropEnum
DROP TYPE "CampaignStatus";

-- CreateTable
CREATE TABLE "konci_registrations" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "konci_lead_id" TEXT NOT NULL,
    "status" "KonciRegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "claim_url" TEXT,
    "claim_expires_at" TIMESTAMP(3),
    "error" TEXT,
    "raw" JSONB,
    "last_polled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "konci_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "konci_registrations_lead_id_key" ON "konci_registrations"("lead_id");

-- CreateIndex
CREATE UNIQUE INDEX "konci_registrations_konci_lead_id_key" ON "konci_registrations"("konci_lead_id");

-- CreateIndex
CREATE INDEX "konci_registrations_status_idx" ON "konci_registrations"("status");

-- AddForeignKey
ALTER TABLE "konci_registrations" ADD CONSTRAINT "konci_registrations_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

