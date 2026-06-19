BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[ShippingCarrier] (
    [id] NVARCHAR(1000) NOT NULL,
    [key] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [enabled] BIT NOT NULL CONSTRAINT [ShippingCarrier_enabled_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ShippingCarrier_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [ShippingCarrier_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ShippingCarrier_key_key] UNIQUE NONCLUSTERED ([key])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ShippingCarrier_enabled_idx] ON [dbo].[ShippingCarrier]([enabled]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
