/*
  Warnings:

  - You are about to drop the column `expectedDate` on the `PurchaseOrder` table. All the data in the column will be lost.
  - You are about to drop the column `orderDate` on the `PurchaseOrder` table. All the data in the column will be lost.
  - You are about to drop the column `taxTotal` on the `PurchaseOrder` table. All the data in the column will be lost.
  - The `status` column on the `PurchaseOrder` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `taxAmount` on the `PurchaseOrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `taxRate` on the `PurchaseOrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `total` on the `PurchaseOrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `unitPrice` on the `PurchaseOrderItem` table. All the data in the column will be lost.
  - Added the required column `createdById` to the `PurchaseOrder` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'RECEIVED', 'CANCELLED');

-- AlterTable
ALTER TABLE "PurchaseOrder" DROP COLUMN "expectedDate",
DROP COLUMN "orderDate",
DROP COLUMN "taxTotal",
ADD COLUMN     "createdById" TEXT NOT NULL,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "discount" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "shippingCost" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "tax" DECIMAL(65,30) NOT NULL DEFAULT 0,
DROP COLUMN "status",
ADD COLUMN     "status" "PurchaseStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "PurchaseOrderItem" DROP COLUMN "taxAmount",
DROP COLUMN "taxRate",
DROP COLUMN "total",
DROP COLUMN "unitPrice",
ADD COLUMN     "discount" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "lineTotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "tax" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "unitCost" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
