ALTER TABLE [dbo].[Order]
ADD [paidAt] DATETIME2,
    [metaPurchaseSentAt] DATETIME2,
    [metaPurchaseLockId] NVARCHAR(255),
    [metaPurchaseLockedAt] DATETIME2,
    [metaFbp] NVARCHAR(255),
    [metaFbc] NVARCHAR(255),
    [metaClientIpAddress] NVARCHAR(255),
    [metaClientUserAgent] NVARCHAR(1024);

CREATE INDEX [Order_metaPurchaseSentAt_idx] ON [dbo].[Order]([metaPurchaseSentAt]);
