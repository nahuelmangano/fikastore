ALTER TABLE [dbo].[User] ADD [birthDate] DATETIME2;
ALTER TABLE [dbo].[Order] ADD [deliveredAt] DATETIME2;

CREATE TABLE [dbo].[EmailTemplate] (
  [id] NVARCHAR(1000) NOT NULL,
  [key] NVARCHAR(1000) NOT NULL,
  [name] NVARCHAR(1000) NOT NULL,
  [category] NVARCHAR(1000) NOT NULL,
  [subject] NVARCHAR(1000) NOT NULL,
  [html] NVARCHAR(max) NOT NULL,
  [text] NVARCHAR(max) NOT NULL,
  [enabled] BIT NOT NULL CONSTRAINT [EmailTemplate_enabled_df] DEFAULT 1,
  [variablesJson] NVARCHAR(max) NOT NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [EmailTemplate_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  [updatedAt] DATETIME2 NOT NULL,
  CONSTRAINT [EmailTemplate_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [EmailTemplate_key_key] UNIQUE NONCLUSTERED ([key])
);

CREATE TABLE [dbo].[EmailNotification] (
  [id] NVARCHAR(1000) NOT NULL,
  [templateKey] NVARCHAR(1000) NOT NULL,
  [recipientEmail] NVARCHAR(1000) NOT NULL,
  [recipientUserId] NVARCHAR(1000),
  [orderId] NVARCHAR(1000),
  [paymentId] NVARCHAR(1000),
  [productId] NVARCHAR(1000),
  [returnRequestId] NVARCHAR(1000),
  [refundId] NVARCHAR(1000),
  [idempotencyKey] NVARCHAR(1000) NOT NULL,
  [status] NVARCHAR(1000) NOT NULL CONSTRAINT [EmailNotification_status_df] DEFAULT 'pending',
  [payloadJson] NVARCHAR(max) NOT NULL,
  [isTest] BIT NOT NULL CONSTRAINT [EmailNotification_isTest_df] DEFAULT 0,
  [attemptCount] INT NOT NULL CONSTRAINT [EmailNotification_attemptCount_df] DEFAULT 0,
  [lastAttemptAt] DATETIME2,
  [sentAt] DATETIME2,
  [errorMessage] NVARCHAR(max),
  [lockedAt] DATETIME2,
  [lockedBy] NVARCHAR(1000),
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [EmailNotification_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  [updatedAt] DATETIME2 NOT NULL,
  CONSTRAINT [EmailNotification_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [EmailNotification_idempotencyKey_key] UNIQUE NONCLUSTERED ([idempotencyKey])
);

CREATE TABLE [dbo].[EmailNotificationAttempt] (
  [id] NVARCHAR(1000) NOT NULL,
  [notificationId] NVARCHAR(1000) NOT NULL,
  [status] NVARCHAR(1000) NOT NULL,
  [errorMessage] NVARCHAR(max),
  [durationMs] INT,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [EmailNotificationAttempt_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [EmailNotificationAttempt_pkey] PRIMARY KEY CLUSTERED ([id])
);

CREATE TABLE [dbo].[ScheduledEmailJob] (
  [id] NVARCHAR(1000) NOT NULL,
  [type] NVARCHAR(1000) NOT NULL,
  [runAt] DATETIME2 NOT NULL,
  [status] NVARCHAR(1000) NOT NULL CONSTRAINT [ScheduledEmailJob_status_df] DEFAULT 'pending',
  [idempotencyKey] NVARCHAR(1000) NOT NULL,
  [payloadJson] NVARCHAR(max) NOT NULL,
  [orderId] NVARCHAR(1000),
  [paymentId] NVARCHAR(1000),
  [lockedAt] DATETIME2,
  [lockedBy] NVARCHAR(1000),
  [attemptCount] INT NOT NULL CONSTRAINT [ScheduledEmailJob_attemptCount_df] DEFAULT 0,
  [lastAttemptAt] DATETIME2,
  [errorMessage] NVARCHAR(max),
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [ScheduledEmailJob_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  [updatedAt] DATETIME2 NOT NULL,
  CONSTRAINT [ScheduledEmailJob_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [ScheduledEmailJob_idempotencyKey_key] UNIQUE NONCLUSTERED ([idempotencyKey])
);

CREATE TABLE [dbo].[ReturnRequest] (
  [id] NVARCHAR(1000) NOT NULL,
  [code] NVARCHAR(1000) NOT NULL,
  [orderId] NVARCHAR(1000) NOT NULL,
  [userId] NVARCHAR(1000) NOT NULL,
  [status] NVARCHAR(1000) NOT NULL CONSTRAINT [ReturnRequest_status_df] DEFAULT 'REQUESTED',
  [reason] NVARCHAR(1000),
  [comments] NVARCHAR(max),
  [requestedAt] DATETIME2 NOT NULL CONSTRAINT [ReturnRequest_requestedAt_df] DEFAULT CURRENT_TIMESTAMP,
  [approvedAt] DATETIME2,
  [receivedAt] DATETIME2,
  [estimatedAmount] DECIMAL(18,2),
  [resolutionMethod] NVARCHAR(1000),
  [returnInstructions] NVARCHAR(max),
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [ReturnRequest_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  [updatedAt] DATETIME2 NOT NULL,
  CONSTRAINT [ReturnRequest_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [ReturnRequest_code_key] UNIQUE NONCLUSTERED ([code])
);

CREATE TABLE [dbo].[ReturnItem] (
  [id] NVARCHAR(1000) NOT NULL,
  [returnRequestId] NVARCHAR(1000) NOT NULL,
  [productId] NVARCHAR(1000) NOT NULL,
  [quantity] INT NOT NULL,
  [reason] NVARCHAR(1000),
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [ReturnItem_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [ReturnItem_pkey] PRIMARY KEY CLUSTERED ([id])
);

CREATE TABLE [dbo].[Refund] (
  [id] NVARCHAR(1000) NOT NULL,
  [orderId] NVARCHAR(1000) NOT NULL,
  [paymentId] NVARCHAR(1000),
  [returnRequestId] NVARCHAR(1000),
  [provider] NVARCHAR(1000) NOT NULL CONSTRAINT [Refund_provider_df] DEFAULT 'mercadopago',
  [providerRefundId] NVARCHAR(1000),
  [status] NVARCHAR(1000) NOT NULL CONSTRAINT [Refund_status_df] DEFAULT 'pending',
  [amount] DECIMAL(18,2) NOT NULL,
  [type] NVARCHAR(1000) NOT NULL CONSTRAINT [Refund_type_df] DEFAULT 'partial',
  [processedAt] DATETIME2,
  [rawJson] NVARCHAR(max),
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [Refund_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  [updatedAt] DATETIME2 NOT NULL,
  CONSTRAINT [Refund_pkey] PRIMARY KEY CLUSTERED ([id])
);

CREATE TABLE [dbo].[BirthdayCoupon] (
  [id] NVARCHAR(1000) NOT NULL,
  [userId] NVARCHAR(1000) NOT NULL,
  [year] INT NOT NULL,
  [code] NVARCHAR(1000) NOT NULL,
  [discountType] NVARCHAR(1000) NOT NULL CONSTRAINT [BirthdayCoupon_discountType_df] DEFAULT 'percent',
  [discountValue] DECIMAL(18,2) NOT NULL,
  [minPurchaseAmount] DECIMAL(18,2),
  [maxUses] INT NOT NULL CONSTRAINT [BirthdayCoupon_maxUses_df] DEFAULT 1,
  [usedCount] INT NOT NULL CONSTRAINT [BirthdayCoupon_usedCount_df] DEFAULT 0,
  [startsAt] DATETIME2 NOT NULL,
  [expiresAt] DATETIME2 NOT NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [BirthdayCoupon_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  [updatedAt] DATETIME2 NOT NULL,
  CONSTRAINT [BirthdayCoupon_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [BirthdayCoupon_code_key] UNIQUE NONCLUSTERED ([code]),
  CONSTRAINT [BirthdayCoupon_userId_year_key] UNIQUE NONCLUSTERED ([userId], [year])
);

CREATE TABLE [dbo].[ProductReviewToken] (
  [id] NVARCHAR(1000) NOT NULL,
  [tokenHash] NVARCHAR(1000) NOT NULL,
  [userId] NVARCHAR(1000) NOT NULL,
  [orderId] NVARCHAR(1000) NOT NULL,
  [productId] NVARCHAR(1000) NOT NULL,
  [expiresAt] DATETIME2 NOT NULL,
  [usedAt] DATETIME2,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [ProductReviewToken_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [ProductReviewToken_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [ProductReviewToken_tokenHash_key] UNIQUE NONCLUSTERED ([tokenHash]),
  CONSTRAINT [ProductReviewToken_userId_orderId_productId_key] UNIQUE NONCLUSTERED ([userId], [orderId], [productId])
);

CREATE NONCLUSTERED INDEX [Order_deliveredAt_idx] ON [dbo].[Order]([deliveredAt]);
CREATE NONCLUSTERED INDEX [EmailTemplate_category_idx] ON [dbo].[EmailTemplate]([category]);
CREATE NONCLUSTERED INDEX [EmailTemplate_enabled_idx] ON [dbo].[EmailTemplate]([enabled]);
CREATE NONCLUSTERED INDEX [EmailNotification_templateKey_idx] ON [dbo].[EmailNotification]([templateKey]);
CREATE NONCLUSTERED INDEX [EmailNotification_recipientUserId_idx] ON [dbo].[EmailNotification]([recipientUserId]);
CREATE NONCLUSTERED INDEX [EmailNotification_orderId_idx] ON [dbo].[EmailNotification]([orderId]);
CREATE NONCLUSTERED INDEX [EmailNotification_paymentId_idx] ON [dbo].[EmailNotification]([paymentId]);
CREATE NONCLUSTERED INDEX [EmailNotification_returnRequestId_idx] ON [dbo].[EmailNotification]([returnRequestId]);
CREATE NONCLUSTERED INDEX [EmailNotification_refundId_idx] ON [dbo].[EmailNotification]([refundId]);
CREATE NONCLUSTERED INDEX [EmailNotification_status_createdAt_idx] ON [dbo].[EmailNotification]([status], [createdAt]);
CREATE NONCLUSTERED INDEX [EmailNotification_lockedAt_idx] ON [dbo].[EmailNotification]([lockedAt]);
CREATE NONCLUSTERED INDEX [EmailNotificationAttempt_notificationId_idx] ON [dbo].[EmailNotificationAttempt]([notificationId]);
CREATE NONCLUSTERED INDEX [EmailNotificationAttempt_status_idx] ON [dbo].[EmailNotificationAttempt]([status]);
CREATE NONCLUSTERED INDEX [EmailNotificationAttempt_createdAt_idx] ON [dbo].[EmailNotificationAttempt]([createdAt]);
CREATE NONCLUSTERED INDEX [ScheduledEmailJob_type_idx] ON [dbo].[ScheduledEmailJob]([type]);
CREATE NONCLUSTERED INDEX [ScheduledEmailJob_status_runAt_idx] ON [dbo].[ScheduledEmailJob]([status], [runAt]);
CREATE NONCLUSTERED INDEX [ScheduledEmailJob_orderId_idx] ON [dbo].[ScheduledEmailJob]([orderId]);
CREATE NONCLUSTERED INDEX [ScheduledEmailJob_paymentId_idx] ON [dbo].[ScheduledEmailJob]([paymentId]);
CREATE NONCLUSTERED INDEX [ScheduledEmailJob_lockedAt_idx] ON [dbo].[ScheduledEmailJob]([lockedAt]);
CREATE NONCLUSTERED INDEX [ReturnRequest_orderId_idx] ON [dbo].[ReturnRequest]([orderId]);
CREATE NONCLUSTERED INDEX [ReturnRequest_userId_idx] ON [dbo].[ReturnRequest]([userId]);
CREATE NONCLUSTERED INDEX [ReturnRequest_status_idx] ON [dbo].[ReturnRequest]([status]);
CREATE NONCLUSTERED INDEX [ReturnRequest_requestedAt_idx] ON [dbo].[ReturnRequest]([requestedAt]);
CREATE NONCLUSTERED INDEX [ReturnItem_returnRequestId_idx] ON [dbo].[ReturnItem]([returnRequestId]);
CREATE NONCLUSTERED INDEX [ReturnItem_productId_idx] ON [dbo].[ReturnItem]([productId]);
CREATE NONCLUSTERED INDEX [Refund_provider_providerRefundId_idx] ON [dbo].[Refund]([provider], [providerRefundId]);
CREATE NONCLUSTERED INDEX [Refund_orderId_idx] ON [dbo].[Refund]([orderId]);
CREATE NONCLUSTERED INDEX [Refund_paymentId_idx] ON [dbo].[Refund]([paymentId]);
CREATE NONCLUSTERED INDEX [Refund_returnRequestId_idx] ON [dbo].[Refund]([returnRequestId]);
CREATE NONCLUSTERED INDEX [Refund_status_idx] ON [dbo].[Refund]([status]);
CREATE NONCLUSTERED INDEX [Refund_processedAt_idx] ON [dbo].[Refund]([processedAt]);
CREATE NONCLUSTERED INDEX [BirthdayCoupon_code_idx] ON [dbo].[BirthdayCoupon]([code]);
CREATE NONCLUSTERED INDEX [BirthdayCoupon_startsAt_expiresAt_idx] ON [dbo].[BirthdayCoupon]([startsAt], [expiresAt]);
CREATE NONCLUSTERED INDEX [ProductReviewToken_orderId_idx] ON [dbo].[ProductReviewToken]([orderId]);
CREATE NONCLUSTERED INDEX [ProductReviewToken_productId_idx] ON [dbo].[ProductReviewToken]([productId]);
CREATE NONCLUSTERED INDEX [ProductReviewToken_expiresAt_idx] ON [dbo].[ProductReviewToken]([expiresAt]);

ALTER TABLE [dbo].[EmailNotification] ADD CONSTRAINT [EmailNotification_templateKey_fkey] FOREIGN KEY ([templateKey]) REFERENCES [dbo].[EmailTemplate]([key]) ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE [dbo].[EmailNotification] ADD CONSTRAINT [EmailNotification_recipientUserId_fkey] FOREIGN KEY ([recipientUserId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[EmailNotification] ADD CONSTRAINT [EmailNotification_orderId_fkey] FOREIGN KEY ([orderId]) REFERENCES [dbo].[Order]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[EmailNotification] ADD CONSTRAINT [EmailNotification_paymentId_fkey] FOREIGN KEY ([paymentId]) REFERENCES [dbo].[Payment]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[EmailNotification] ADD CONSTRAINT [EmailNotification_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[Product]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[EmailNotificationAttempt] ADD CONSTRAINT [EmailNotificationAttempt_notificationId_fkey] FOREIGN KEY ([notificationId]) REFERENCES [dbo].[EmailNotification]([id]) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE [dbo].[ScheduledEmailJob] ADD CONSTRAINT [ScheduledEmailJob_orderId_fkey] FOREIGN KEY ([orderId]) REFERENCES [dbo].[Order]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[ScheduledEmailJob] ADD CONSTRAINT [ScheduledEmailJob_paymentId_fkey] FOREIGN KEY ([paymentId]) REFERENCES [dbo].[Payment]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[ReturnRequest] ADD CONSTRAINT [ReturnRequest_orderId_fkey] FOREIGN KEY ([orderId]) REFERENCES [dbo].[Order]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[ReturnRequest] ADD CONSTRAINT [ReturnRequest_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[ReturnItem] ADD CONSTRAINT [ReturnItem_returnRequestId_fkey] FOREIGN KEY ([returnRequestId]) REFERENCES [dbo].[ReturnRequest]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[ReturnItem] ADD CONSTRAINT [ReturnItem_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[Product]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Refund] ADD CONSTRAINT [Refund_orderId_fkey] FOREIGN KEY ([orderId]) REFERENCES [dbo].[Order]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Refund] ADD CONSTRAINT [Refund_paymentId_fkey] FOREIGN KEY ([paymentId]) REFERENCES [dbo].[Payment]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Refund] ADD CONSTRAINT [Refund_returnRequestId_fkey] FOREIGN KEY ([returnRequestId]) REFERENCES [dbo].[ReturnRequest]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[EmailNotification] ADD CONSTRAINT [EmailNotification_returnRequestId_fkey] FOREIGN KEY ([returnRequestId]) REFERENCES [dbo].[ReturnRequest]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[EmailNotification] ADD CONSTRAINT [EmailNotification_refundId_fkey] FOREIGN KEY ([refundId]) REFERENCES [dbo].[Refund]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[BirthdayCoupon] ADD CONSTRAINT [BirthdayCoupon_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[ProductReviewToken] ADD CONSTRAINT [ProductReviewToken_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[ProductReviewToken] ADD CONSTRAINT [ProductReviewToken_orderId_fkey] FOREIGN KEY ([orderId]) REFERENCES [dbo].[Order]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[ProductReviewToken] ADD CONSTRAINT [ProductReviewToken_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[Product]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
