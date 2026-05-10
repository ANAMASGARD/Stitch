-- DropForeignKey
ALTER TABLE "user_usage" DROP CONSTRAINT IF EXISTS "user_usage_userId_fkey";

-- DropTable
DROP TABLE IF EXISTS "user_usage";

-- AlterTable
ALTER TABLE "user" DROP COLUMN IF EXISTS "subscriptionStatus",
DROP COLUMN IF EXISTS "subscriptionTier";
