/*
  Warnings:

  - A unique constraint covering the columns `[subdomain]` on the table `App` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "App" ADD COLUMN "subdomain" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "App_subdomain_key" ON "App"("subdomain");
