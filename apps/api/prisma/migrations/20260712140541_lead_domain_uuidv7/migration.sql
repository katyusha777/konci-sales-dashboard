-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('CSV', 'SCRAPIO', 'MANUAL');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'ENRICHED', 'IN_CAMPAIGN', 'CONTACTED', 'ENGAGED', 'REPLIED', 'CLOSED_WON', 'CLOSED_LOST', 'DO_NOT_CONTACT');

-- CreateEnum
CREATE TYPE "EnrichmentStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ContactSource" AS ENUM ('SCRAPIO', 'APOLLO', 'MANUAL', 'WEBSITE', 'PDL', 'HUNTER', 'FULLENRICH');

-- CreateEnum
CREATE TYPE "ContactEmailStatus" AS ENUM ('UNKNOWN', 'VALID', 'BOUNCED', 'UNSUBSCRIBED', 'COMPLAINED');

-- CreateEnum
CREATE TYPE "CostType" AS ENUM ('ENRICHMENT', 'VIDEO', 'EMAIL');

-- CreateEnum
CREATE TYPE "EnrichmentProvider" AS ENUM ('GOOGLE_PLACES', 'FIRECRAWL', 'OPENROUTER', 'PDL', 'HUNTER', 'FULLENRICH', 'APOLLO', 'SCRAPIO');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "CampaignLeadStatus" AS ENUM ('PENDING', 'SCHEDULED', 'SENT', 'COMPLETED', 'REPLIED', 'FAILED', 'CANCELLED', 'SUPPRESSED');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'OPENED', 'CLICKED', 'BOUNCED', 'COMPLAINED', 'FAILED');

-- CreateEnum
CREATE TYPE "EmailEventType" AS ENUM ('DELIVERED', 'OPENED', 'CLICKED', 'BOUNCED', 'COMPLAINED', 'UNSUBSCRIBED');

-- CreateEnum
CREATE TYPE "VideoStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "VideoEventType" AS ENUM ('PAGE_VIEW', 'PLAY', 'PAUSE', 'PROGRESS_25', 'PROGRESS_50', 'PROGRESS_75', 'COMPLETED');

-- Dev-only rows carry cuid ids that cannot cast to uuid — wipe before converting
-- the id columns (fresh-start data decision, plan §9.6; auth is parked).
TRUNCATE "sessions", "users", "health_checks";

-- DropForeignKey
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_user_id_fkey";

-- AlterTable
ALTER TABLE "health_checks" DROP CONSTRAINT "health_checks_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "health_checks_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "users" DROP CONSTRAINT "users_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");

-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "google_place_id" TEXT,
    "website" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "street" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postal_code" TEXT,
    "country" TEXT,
    "industry" TEXT,
    "categories" TEXT[],
    "google_rating" DOUBLE PRECISION,
    "google_review_count" INTEGER,
    "employee_count" INTEGER,
    "social_links" JSONB,
    "services" TEXT[],
    "business_hours" JSONB,
    "description" TEXT,
    "owner_name" TEXT,
    "source" "LeadSource" NOT NULL,
    "source_meta" JSONB,
    "enrichment_status" "EnrichmentStatus" NOT NULL DEFAULT 'PENDING',
    "enrichment_score" INTEGER NOT NULL DEFAULT 0,
    "enrichment_attempts" INTEGER NOT NULL DEFAULT 0,
    "last_enriched_at" TIMESTAMP(3),
    "enrichment_error" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "assigned_to" TEXT,
    "last_contacted_at" TIMESTAMP(3),
    "last_engaged_at" TIMESTAMP(3),
    "konci_customer_id" TEXT,
    "demo_phone" TEXT,
    "demo_pin" TEXT,
    "total_cost_usd" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "job_title" TEXT,
    "linkedin_url" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "email_status" "ContactEmailStatus" NOT NULL DEFAULT 'UNKNOWN',
    "source" "ContactSource" NOT NULL,
    "confidence" INTEGER,
    "enriched_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_notes" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "author" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_costs" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "type" "CostType" NOT NULL,
    "amount_usd" DECIMAL(10,4) NOT NULL,
    "description" TEXT NOT NULL,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrichment_responses" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "provider" "EnrichmentProvider" NOT NULL,
    "operation" TEXT NOT NULL,
    "request" JSONB NOT NULL,
    "response" JSONB,
    "success" BOOLEAN NOT NULL,
    "error" TEXT,
    "cost_usd" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "duration_ms" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enrichment_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avatars" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "heygen_avatar_id" TEXT NOT NULL,
    "voice_id" TEXT,
    "preview_image_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "avatars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "templates" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "avatar_id" UUID,
    "video_script" TEXT,
    "heygen_template_id" TEXT,
    "video_scenes" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "max_sends_per_hour" INTEGER NOT NULL DEFAULT 50,
    "max_sends_per_day" INTEGER NOT NULL DEFAULT 200,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_steps" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "template_id" UUID NOT NULL,
    "delay_days" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "campaign_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_leads" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "contact_id" UUID,
    "status" "CampaignLeadStatus" NOT NULL DEFAULT 'PENDING',
    "current_step" INTEGER NOT NULL DEFAULT 0,
    "next_send_at" TIMESTAMP(3),
    "with_video" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emails" (
    "id" UUID NOT NULL,
    "campaign_lead_id" UUID,
    "lead_id" UUID NOT NULL,
    "contact_id" UUID,
    "template_id" UUID,
    "subject" TEXT NOT NULL,
    "provider_message_id" TEXT,
    "status" "EmailStatus" NOT NULL DEFAULT 'PENDING',
    "tracking_token" TEXT NOT NULL,
    "was_test_mode" BOOLEAN NOT NULL DEFAULT false,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_events" (
    "id" UUID NOT NULL,
    "email_id" UUID NOT NULL,
    "type" "EmailEventType" NOT NULL,
    "external_id" TEXT NOT NULL,
    "payload" JSONB,
    "occurred_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "videos" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "campaign_lead_id" UUID,
    "template_id" UUID,
    "avatar_id" UUID,
    "heygen_video_id" TEXT NOT NULL,
    "status" "VideoStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "r2_key" TEXT,
    "duration_seconds" INTEGER,
    "token" TEXT NOT NULL,
    "cost_usd" DECIMAL(10,4),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_events" (
    "id" UUID NOT NULL,
    "video_id" UUID NOT NULL,
    "type" "VideoEventType" NOT NULL,
    "position_seconds" INTEGER,
    "user_agent" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leads_domain_key" ON "leads"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "leads_google_place_id_key" ON "leads"("google_place_id");

-- CreateIndex
CREATE INDEX "leads_status_idx" ON "leads"("status");

-- CreateIndex
CREATE INDEX "leads_enrichment_status_idx" ON "leads"("enrichment_status");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_lead_id_email_key" ON "contacts"("lead_id", "email");

-- CreateIndex
CREATE INDEX "lead_notes_lead_id_idx" ON "lead_notes"("lead_id");

-- CreateIndex
CREATE INDEX "lead_costs_lead_id_idx" ON "lead_costs"("lead_id");

-- CreateIndex
CREATE INDEX "enrichment_responses_lead_id_idx" ON "enrichment_responses"("lead_id");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_steps_campaign_id_order_key" ON "campaign_steps"("campaign_id", "order");

-- CreateIndex
CREATE INDEX "campaign_leads_status_next_send_at_idx" ON "campaign_leads"("status", "next_send_at");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_leads_campaign_id_lead_id_key" ON "campaign_leads"("campaign_id", "lead_id");

-- CreateIndex
CREATE UNIQUE INDEX "emails_tracking_token_key" ON "emails"("tracking_token");

-- CreateIndex
CREATE INDEX "emails_lead_id_idx" ON "emails"("lead_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_events_external_id_key" ON "email_events"("external_id");

-- CreateIndex
CREATE INDEX "email_events_email_id_idx" ON "email_events"("email_id");

-- CreateIndex
CREATE UNIQUE INDEX "videos_token_key" ON "videos"("token");

-- CreateIndex
CREATE INDEX "videos_status_idx" ON "videos"("status");

-- CreateIndex
CREATE INDEX "video_events_video_id_idx" ON "video_events"("video_id");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_costs" ADD CONSTRAINT "lead_costs_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrichment_responses" ADD CONSTRAINT "enrichment_responses_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "templates" ADD CONSTRAINT "templates_avatar_id_fkey" FOREIGN KEY ("avatar_id") REFERENCES "avatars"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_steps" ADD CONSTRAINT "campaign_steps_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_steps" ADD CONSTRAINT "campaign_steps_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_leads" ADD CONSTRAINT "campaign_leads_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_leads" ADD CONSTRAINT "campaign_leads_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_leads" ADD CONSTRAINT "campaign_leads_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emails" ADD CONSTRAINT "emails_campaign_lead_id_fkey" FOREIGN KEY ("campaign_lead_id") REFERENCES "campaign_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emails" ADD CONSTRAINT "emails_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emails" ADD CONSTRAINT "emails_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emails" ADD CONSTRAINT "emails_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_events" ADD CONSTRAINT "email_events_email_id_fkey" FOREIGN KEY ("email_id") REFERENCES "emails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_campaign_lead_id_fkey" FOREIGN KEY ("campaign_lead_id") REFERENCES "campaign_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_avatar_id_fkey" FOREIGN KEY ("avatar_id") REFERENCES "avatars"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_events" ADD CONSTRAINT "video_events_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

