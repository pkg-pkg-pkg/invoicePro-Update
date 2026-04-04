/*
  Warnings:

  - The `group` column on the `Customer` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "GSTReportType" AS ENUM ('GSTR1', 'GSTR2A', 'GSTR2B', 'GSTR3B', 'GSTR4', 'GSTR9');

-- CreateEnum
CREATE TYPE "FilingStatus" AS ENUM ('PENDING', 'FILED', 'REVISED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CustomerGroup" ADD VALUE 'BLACKLIST';
ALTER TYPE "CustomerGroup" ADD VALUE 'DEFAULTER';

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "signature" TEXT;

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "blacklistReason" TEXT,
ADD COLUMN     "blacklistedAt" TIMESTAMP(3),
ADD COLUMN     "blacklistedBy" TEXT,
ADD COLUMN     "customGroup" TEXT,
ADD COLUMN     "isBlacklisted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isDefaulter" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastInvoiceDate" TIMESTAMP(3),
ADD COLUMN     "lastPaymentDate" TIMESTAMP(3),
ADD COLUMN     "outstandingAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "totalInvoices" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalPaid" DECIMAL(65,30) NOT NULL DEFAULT 0,
DROP COLUMN "group",
ADD COLUMN     "group" TEXT NOT NULL DEFAULT 'RETAIL';

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "cess" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "InvoiceItem" ADD COLUMN     "cess" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "CompanySettings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "moduleInvoice" BOOLEAN NOT NULL DEFAULT true,
    "moduleInventory" BOOLEAN NOT NULL DEFAULT true,
    "moduleGSTReports" BOOLEAN NOT NULL DEFAULT true,
    "modulePurchaseOrders" BOOLEAN NOT NULL DEFAULT false,
    "moduleAccounting" BOOLEAN NOT NULL DEFAULT false,
    "moduleExpense" BOOLEAN NOT NULL DEFAULT false,
    "modulePayroll" BOOLEAN NOT NULL DEFAULT false,
    "invoicePrefix" TEXT NOT NULL DEFAULT 'INV',
    "invoiceStartNumber" INTEGER NOT NULL DEFAULT 1001,
    "invoiceNumberFormat" TEXT NOT NULL DEFAULT 'PREFIX-YEAR-NUMBER',
    "invoiceResetYearly" BOOLEAN NOT NULL DEFAULT true,
    "invoiceTemplate" TEXT NOT NULL DEFAULT 'standard',
    "showCompanyLogo" BOOLEAN NOT NULL DEFAULT true,
    "showSignature" BOOLEAN NOT NULL DEFAULT true,
    "showBankDetails" BOOLEAN NOT NULL DEFAULT true,
    "showHSNCode" BOOLEAN NOT NULL DEFAULT true,
    "showQRCode" BOOLEAN NOT NULL DEFAULT true,
    "showTerms" BOOLEAN NOT NULL DEFAULT true,
    "defaultPaymentTerms" TEXT NOT NULL DEFAULT 'Net 30',
    "enableLateFee" BOOLEAN NOT NULL DEFAULT false,
    "lateFeePercentage" DECIMAL(65,30) NOT NULL DEFAULT 2,
    "gracePeriodDays" INTEGER NOT NULL DEFAULT 5,
    "defaultGSTRate" DECIMAL(65,30) NOT NULL DEFAULT 18,
    "enableCGST" BOOLEAN NOT NULL DEFAULT true,
    "enableSGST" BOOLEAN NOT NULL DEFAULT true,
    "enableIGST" BOOLEAN NOT NULL DEFAULT true,
    "enableCess" BOOLEAN NOT NULL DEFAULT false,
    "requireHSNCode" BOOLEAN NOT NULL DEFAULT true,
    "enableEmailNotifications" BOOLEAN NOT NULL DEFAULT false,
    "enableSMSNotifications" BOOLEAN NOT NULL DEFAULT false,
    "emailInvoiceOnCreation" BOOLEAN NOT NULL DEFAULT false,
    "emailPaymentReminders" BOOLEAN NOT NULL DEFAULT false,
    "reminderDays" JSONB,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "currencySymbol" TEXT NOT NULL DEFAULT '₹',
    "dateFormat" TEXT NOT NULL DEFAULT 'DD-MM-YYYY',
    "timeFormat" TEXT NOT NULL DEFAULT '24h',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "autoBackup" BOOLEAN NOT NULL DEFAULT true,
    "backupFrequency" TEXT NOT NULL DEFAULT 'daily',
    "backupTime" TEXT NOT NULL DEFAULT '02:00',
    "backupRetentionDays" INTEGER NOT NULL DEFAULT 30,
    "sessionTimeout" INTEGER NOT NULL DEFAULT 60,
    "requireTwoFactor" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerGroupConfig" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "discountPercent" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "creditLimit" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "creditDays" INTEGER NOT NULL DEFAULT 0,
    "requiresAdminApproval" BOOLEAN NOT NULL DEFAULT false,
    "canCreateInvoice" BOOLEAN NOT NULL DEFAULT true,
    "alertMessage" TEXT,
    "color" TEXT NOT NULL DEFAULT 'blue',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerGroupConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GSTReport" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "reportType" "GSTReportType" NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "period" TEXT NOT NULL,
    "totalTaxableValue" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalCGST" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalSGST" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalIGST" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalCess" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalTax" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "filingStatus" "FilingStatus" NOT NULL DEFAULT 'PENDING',
    "filedAt" TIMESTAMP(3),
    "filedBy" TEXT,
    "acknowledgementNo" TEXT,
    "reportData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GSTReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "changes" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanySettings_companyId_key" ON "CompanySettings"("companyId");

-- CreateIndex
CREATE INDEX "CompanySettings_companyId_idx" ON "CompanySettings"("companyId");

-- CreateIndex
CREATE INDEX "CustomerGroupConfig_companyId_idx" ON "CustomerGroupConfig"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerGroupConfig_companyId_name_key" ON "CustomerGroupConfig"("companyId", "name");

-- CreateIndex
CREATE INDEX "GSTReport_companyId_idx" ON "GSTReport"("companyId");

-- CreateIndex
CREATE INDEX "GSTReport_reportType_idx" ON "GSTReport"("reportType");

-- CreateIndex
CREATE INDEX "GSTReport_period_idx" ON "GSTReport"("period");

-- CreateIndex
CREATE UNIQUE INDEX "GSTReport_companyId_reportType_period_key" ON "GSTReport"("companyId", "reportType", "period");

-- CreateIndex
CREATE INDEX "AuditLog_companyId_idx" ON "AuditLog"("companyId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_idx" ON "AuditLog"("entityType");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "Customer_group_idx" ON "Customer"("group");

-- CreateIndex
CREATE INDEX "Customer_isBlacklisted_idx" ON "Customer"("isBlacklisted");

-- CreateIndex
CREATE INDEX "Customer_isDefaulter_idx" ON "Customer"("isDefaulter");

-- CreateIndex
CREATE INDEX "Invoice_paymentStatus_idx" ON "Invoice"("paymentStatus");

-- AddForeignKey
ALTER TABLE "CompanySettings" ADD CONSTRAINT "CompanySettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerGroupConfig" ADD CONSTRAINT "CustomerGroupConfig_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
