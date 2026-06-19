BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[ShippingProviderSetting] (
    [id] NVARCHAR(1000) NOT NULL,
    [provider] NVARCHAR(1000) NOT NULL,
    [key] NVARCHAR(1000) NOT NULL,
    [value] NVARCHAR(max) NOT NULL,
    [isSecret] BIT NOT NULL CONSTRAINT [ShippingProviderSetting_isSecret_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ShippingProviderSetting_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [ShippingProviderSetting_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE UNIQUE NONCLUSTERED INDEX [ShippingProviderSetting_provider_key_key] ON [dbo].[ShippingProviderSetting]([provider], [key]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ShippingProviderSetting_provider_idx] ON [dbo].[ShippingProviderSetting]([provider]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
