BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[StockNotification] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [productId] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [StockNotification_status_df] DEFAULT 'pending',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [StockNotification_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [notifiedAt] DATETIME2,
    CONSTRAINT [StockNotification_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [StockNotification_userId_productId_key] UNIQUE NONCLUSTERED ([userId], [productId])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [StockNotification_productId_status_idx] ON [dbo].[StockNotification]([productId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [StockNotification_userId_idx] ON [dbo].[StockNotification]([userId]);

-- AddForeignKey
ALTER TABLE [dbo].[StockNotification] ADD CONSTRAINT [StockNotification_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[StockNotification] ADD CONSTRAINT [StockNotification_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[Product]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
