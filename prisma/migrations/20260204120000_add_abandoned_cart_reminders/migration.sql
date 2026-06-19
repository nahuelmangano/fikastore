BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[Payment] ADD [pendingAt] DATETIME2;
ALTER TABLE [dbo].[Payment] ADD [pendingReminderSentAt] DATETIME2;

-- CreateTable
CREATE TABLE [dbo].[CartSnapshot] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [itemsJson] NVARCHAR(max) NOT NULL,
    [itemCount] INT NOT NULL CONSTRAINT [CartSnapshot_itemCount_df] DEFAULT 0,
    [reminderSentAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [CartSnapshot_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [CartSnapshot_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE UNIQUE NONCLUSTERED INDEX [CartSnapshot_userId_key] ON [dbo].[CartSnapshot]([userId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CartSnapshot_updatedAt_idx] ON [dbo].[CartSnapshot]([updatedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CartSnapshot_reminderSentAt_idx] ON [dbo].[CartSnapshot]([reminderSentAt]);

-- AddForeignKey
ALTER TABLE [dbo].[CartSnapshot] ADD CONSTRAINT [CartSnapshot_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
