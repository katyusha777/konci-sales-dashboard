-- Rename instead of Prisma's default drop-and-recreate so existing rows survive.
ALTER TABLE "HealthCheck" RENAME TO "health_checks";
ALTER TABLE "health_checks" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "health_checks" RENAME CONSTRAINT "HealthCheck_pkey" TO "health_checks_pkey";
