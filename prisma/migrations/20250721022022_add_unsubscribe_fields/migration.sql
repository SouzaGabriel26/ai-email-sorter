-- AlterTable
ALTER TABLE "emails" ADD COLUMN     "unsubscribeAttemptedAt" TIMESTAMP(3),
ADD COLUMN     "unsubscribeCompletedAt" TIMESTAMP(3),
ADD COLUMN     "unsubscribeError" TEXT,
ADD COLUMN     "unsubscribeLinks" JSONB,
ADD COLUMN     "unsubscribeStatus" TEXT;
