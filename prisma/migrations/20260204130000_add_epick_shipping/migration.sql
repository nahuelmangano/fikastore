BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[EPickShipment] (
    [id] NVARCHAR(1000) NOT NULL,
    [orderId] NVARCHAR(1000) NOT NULL,
    [epickOrderId] NVARCHAR(1000) NOT NULL,
    [senderCode] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [EPickShipment_status_df] DEFAULT 'PENDING',
    [mpUrl] NVARCHAR(1000),
    [choUrl] NVARCHAR(1000),
    [preferenceId] NVARCHAR(1000),
    [qrImage] NVARCHAR(max),
    [lastPayloadJson] NVARCHAR(max),
    [lastTrackingJson] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [EPickShipment_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [EPickShipment_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[EPickWebhookEvent] (
    [id] NVARCHAR(1000) NOT NULL,
    [epickShipmentId] NVARCHAR(1000) NOT NULL,
    [payloadJson] NVARCHAR(max) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [EPickWebhookEvent_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [EPickWebhookEvent_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE UNIQUE NONCLUSTERED INDEX [EPickShipment_orderId_key] ON [dbo].[EPickShipment]([orderId]);
CREATE NONCLUSTERED INDEX [EPickShipment_epickOrderId_idx] ON [dbo].[EPickShipment]([epickOrderId]);
CREATE NONCLUSTERED INDEX [EPickShipment_status_idx] ON [dbo].[EPickShipment]([status]);
CREATE NONCLUSTERED INDEX [EPickWebhookEvent_createdAt_idx] ON [dbo].[EPickWebhookEvent]([createdAt]);

-- AddForeignKey
ALTER TABLE [dbo].[EPickShipment] ADD CONSTRAINT [EPickShipment_orderId_fkey] FOREIGN KEY ([orderId]) REFERENCES [dbo].[Order]([id]) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE [dbo].[EPickWebhookEvent] ADD CONSTRAINT [EPickWebhookEvent_epickShipmentId_fkey] FOREIGN KEY ([epickShipmentId]) REFERENCES [dbo].[EPickShipment]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
