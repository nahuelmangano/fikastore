IF OBJECT_ID(N'[dbo].[RegretRequest]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[RegretRequest] (
    [id] NVARCHAR(1000) NOT NULL,
    [orderId] NVARCHAR(1000),
    [orderNumber] INT,
    [name] NVARCHAR(1000) NOT NULL,
    [email] NVARCHAR(1000) NOT NULL,
    [phone] NVARCHAR(1000) NOT NULL,
    [comments] NVARCHAR(max) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [RegretRequest_status_df] DEFAULT N'PENDING',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [RegretRequest_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [RegretRequest_pkey] PRIMARY KEY CLUSTERED ([id])
  );
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE [name] = N'RegretRequest_orderId_idx'
    AND [object_id] = OBJECT_ID(N'dbo.RegretRequest')
)
BEGIN
  CREATE NONCLUSTERED INDEX [RegretRequest_orderId_idx] ON [dbo].[RegretRequest]([orderId]);
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE [name] = N'RegretRequest_orderNumber_idx'
    AND [object_id] = OBJECT_ID(N'dbo.RegretRequest')
)
BEGIN
  CREATE NONCLUSTERED INDEX [RegretRequest_orderNumber_idx] ON [dbo].[RegretRequest]([orderNumber]);
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE [name] = N'RegretRequest_email_idx'
    AND [object_id] = OBJECT_ID(N'dbo.RegretRequest')
)
BEGIN
  CREATE NONCLUSTERED INDEX [RegretRequest_email_idx] ON [dbo].[RegretRequest]([email]);
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE [name] = N'RegretRequest_status_idx'
    AND [object_id] = OBJECT_ID(N'dbo.RegretRequest')
)
BEGIN
  CREATE NONCLUSTERED INDEX [RegretRequest_status_idx] ON [dbo].[RegretRequest]([status]);
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE [name] = N'RegretRequest_createdAt_idx'
    AND [object_id] = OBJECT_ID(N'dbo.RegretRequest')
)
BEGIN
  CREATE NONCLUSTERED INDEX [RegretRequest_createdAt_idx] ON [dbo].[RegretRequest]([createdAt]);
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.foreign_keys
  WHERE [name] = N'RegretRequest_orderId_fkey'
    AND [parent_object_id] = OBJECT_ID(N'dbo.RegretRequest')
)
BEGIN
  ALTER TABLE [dbo].[RegretRequest]
  ADD CONSTRAINT [RegretRequest_orderId_fkey]
  FOREIGN KEY ([orderId]) REFERENCES [dbo].[Order]([id])
  ON DELETE SET NULL ON UPDATE NO ACTION;
END;
