-- CreateTable
CREATE TABLE "ComicGeneration" (
    "id" SERIAL NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComicGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ComicGeneration_ipAddress_key" ON "ComicGeneration"("ipAddress");
