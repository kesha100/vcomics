-- CreateTable
CREATE TABLE "User" (
    "userId" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Vcomics" (
    "vcomicsId" SERIAL NOT NULL,
    "userId" INTEGER,
    "strip" TEXT NOT NULL,

    CONSTRAINT "Vcomics_pkey" PRIMARY KEY ("vcomicsId")
);

-- CreateTable
CREATE TABLE "Panel" (
    "panelId" SERIAL NOT NULL,
    "image_url" TEXT NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "Panel_pkey" PRIMARY KEY ("panelId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Vcomics" ADD CONSTRAINT "Vcomics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;
