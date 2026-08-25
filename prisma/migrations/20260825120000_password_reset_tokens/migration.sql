CREATE TABLE [dbo].[PasswordResetToken] (
  [id] NVARCHAR(1000) NOT NULL,
  [tokenHash] NVARCHAR(1000) NOT NULL,
  [userId] NVARCHAR(1000) NOT NULL,
  [expiresAt] DATETIME2 NOT NULL,
  [usedAt] DATETIME2,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [PasswordResetToken_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [PasswordResetToken_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [PasswordResetToken_tokenHash_key] UNIQUE NONCLUSTERED ([tokenHash])
);

CREATE NONCLUSTERED INDEX [PasswordResetToken_userId_idx] ON [dbo].[PasswordResetToken]([userId]);
CREATE NONCLUSTERED INDEX [PasswordResetToken_expiresAt_idx] ON [dbo].[PasswordResetToken]([expiresAt]);

ALTER TABLE [dbo].[PasswordResetToken] ADD CONSTRAINT [PasswordResetToken_userId_fkey]
  FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
