-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "video_thumbnail_url" TEXT,
ADD COLUMN     "video_url" TEXT;

-- AlterTable
ALTER TABLE "templates" ADD COLUMN     "voice_id" TEXT,
ALTER COLUMN "subject" DROP NOT NULL,
ALTER COLUMN "body" DROP NOT NULL;

-- AlterTable
ALTER TABLE "videos" ADD COLUMN     "thumbnail_r2_key" TEXT;
