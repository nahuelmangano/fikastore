BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[CorreoShipment] (
    [id] NVARCHAR(1000) NOT NULL,
    [orderId] NVARCHAR(1000) NOT NULL,
    [shippingId] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [CorreoShipment_status_df] DEFAULT 'IMPORTED',
    [lastPayloadJson] NVARCHAR(max),
    [lastResponseJson] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [CorreoShipment_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [CorreoShipment_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [CorreoShipment_orderId_key] UNIQUE NONCLUSTERED ([orderId])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CorreoShipment_shippingId_idx] ON [dbo].[CorreoShipment]([shippingId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CorreoShipment_status_idx] ON [dbo].[CorreoShipment]([status]);

-- AddForeignKey
ALTER TABLE [dbo].[CorreoShipment] ADD CONSTRAINT [CorreoShipment_orderId_fkey] FOREIGN KEY ([orderId]) REFERENCES [dbo].[Order]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
