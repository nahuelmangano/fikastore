/*
  Warnings:

  - You are about to alter the column `value` on the `ShippingProviderSetting` table. The data in that column could be lost. The data in that column will be cast from `NVarChar(Max)` to `NVarChar(1000)`.

*/
BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[ShippingProviderSetting] ALTER COLUMN [value] NVARCHAR(1000) NOT NULL;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
