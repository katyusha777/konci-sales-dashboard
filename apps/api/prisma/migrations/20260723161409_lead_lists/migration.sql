-- CreateEnum
CREATE TYPE "EmailProvider" AS ENUM ('SMARTLEAD');

-- CreateEnum
CREATE TYPE "ListSyncStatus" AS ENUM ('PENDING', 'SYNCED', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "lead_lists" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "provider" "EmailProvider",
    "external_campaign_id" TEXT,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_list_members" (
    "id" UUID NOT NULL,
    "list_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "sync_status" "ListSyncStatus" NOT NULL DEFAULT 'PENDING',
    "synced_at" TIMESTAMP(3),
    "sync_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_list_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lead_list_members_lead_id_idx" ON "lead_list_members"("lead_id");

-- CreateIndex
CREATE UNIQUE INDEX "lead_list_members_list_id_lead_id_key" ON "lead_list_members"("list_id", "lead_id");

-- AddForeignKey
ALTER TABLE "lead_list_members" ADD CONSTRAINT "lead_list_members_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "lead_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_list_members" ADD CONSTRAINT "lead_list_members_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
