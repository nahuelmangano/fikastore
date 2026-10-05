CREATE TABLE [dbo].[AnonymousCartSnapshot] (
    [id] NVARCHAR(1000) NOT NULL,
    [anonymousId] NVARCHAR(1000) NOT NULL,
    [itemsJson] NVARCHAR(max) NOT NULL,
    [itemCount] INT NOT NULL CONSTRAINT [AnonymousCartSnapshot_itemCount_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [AnonymousCartSnapshot_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [AnonymousCartSnapshot_pkey] PRIMARY KEY CLUSTERED ([id])
);

CREATE UNIQUE NONCLUSTERED INDEX [AnonymousCartSnapshot_anonymousId_key] ON [dbo].[AnonymousCartSnapshot]([anonymousId]);
CREATE NONCLUSTERED INDEX [AnonymousCartSnapshot_updatedAt_idx] ON [dbo].[AnonymousCartSnapshot]([updatedAt]);
