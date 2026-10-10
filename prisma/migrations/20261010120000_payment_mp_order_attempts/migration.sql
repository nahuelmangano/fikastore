IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Payment]') AND name = N'paymentAttemptId')
  ALTER TABLE [dbo].[Payment] ADD [paymentAttemptId] NVARCHAR(120);

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Payment]') AND name = N'mpIdempotencyKey')
  ALTER TABLE [dbo].[Payment] ADD [mpIdempotencyKey] NVARCHAR(120);

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Payment]') AND name = N'mpRequestHash')
  ALTER TABLE [dbo].[Payment] ADD [mpRequestHash] NVARCHAR(64);

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Payment]') AND name = N'mpRequestStatus')
  ALTER TABLE [dbo].[Payment] ADD [mpRequestStatus] NVARCHAR(20);

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Payment]') AND name = N'mpRequestStartedAt')
  ALTER TABLE [dbo].[Payment] ADD [mpRequestStartedAt] DATETIME2;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Payment]') AND name = N'mpRequestFinishedAt')
  ALTER TABLE [dbo].[Payment] ADD [mpRequestFinishedAt] DATETIME2;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Payment]') AND name = N'mpOrderId')
  ALTER TABLE [dbo].[Payment] ADD [mpOrderId] NVARCHAR(120);

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Payment]') AND name = N'mpLastError')
  ALTER TABLE [dbo].[Payment] ADD [mpLastError] NVARCHAR(max);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Payment]') AND name = N'Payment_paymentAttemptId_idx')
  EXEC(N'CREATE NONCLUSTERED INDEX [Payment_paymentAttemptId_idx] ON [dbo].[Payment]([paymentAttemptId])');

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Payment]') AND name = N'Payment_mpIdempotencyKey_idx')
  EXEC(N'CREATE NONCLUSTERED INDEX [Payment_mpIdempotencyKey_idx] ON [dbo].[Payment]([mpIdempotencyKey])');

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Payment]') AND name = N'Payment_mpOrderId_idx')
  EXEC(N'CREATE NONCLUSTERED INDEX [Payment_mpOrderId_idx] ON [dbo].[Payment]([mpOrderId])');

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Payment]') AND name = N'Payment_orderId_paymentAttemptId_unique')
  EXEC(N'CREATE UNIQUE NONCLUSTERED INDEX [Payment_orderId_paymentAttemptId_unique]
  ON [dbo].[Payment]([orderId], [paymentAttemptId])
  WHERE [paymentAttemptId] IS NOT NULL');

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Payment]') AND name = N'Payment_mpIdempotencyKey_unique')
  EXEC(N'CREATE UNIQUE NONCLUSTERED INDEX [Payment_mpIdempotencyKey_unique]
  ON [dbo].[Payment]([mpIdempotencyKey])
  WHERE [mpIdempotencyKey] IS NOT NULL');

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Payment]') AND name = N'Payment_mpOrderId_unique')
  EXEC(N'CREATE UNIQUE NONCLUSTERED INDEX [Payment_mpOrderId_unique]
  ON [dbo].[Payment]([mpOrderId])
  WHERE [mpOrderId] IS NOT NULL');
