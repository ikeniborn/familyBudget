-- AlterTable
ALTER TABLE "t_d_user" ADD COLUMN     "user_login" VARCHAR,
ADD COLUMN     "user_password" VARCHAR,
ADD COLUMN     "refresh_token" VARCHAR,
ADD COLUMN     "auth_method" VARCHAR NOT NULL DEFAULT 'telegram',
ADD COLUMN     "updated_dttm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "user_telegram_id" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "t_d_user_user_login_key" ON "t_d_user"("user_login");