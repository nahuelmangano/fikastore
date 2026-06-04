BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[Promotion] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [type] NVARCHAR(1000) NOT NULL,
    [percent] INT NOT NULL,
    [code] NVARCHAR(1000),
    [isActive] BIT NOT NULL CONSTRAINT [Promotion_isActive_df] DEFAULT 1,
    [startsAt] DATETIME2,
    [endsAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Promotion_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Promotion_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[PromotionProduct] (
    [promotionId] NVARCHAR(1000) NOT NULL,
    [productId] NVARCHAR(1000) NOT NULL,

    CONSTRAINT [PromotionProduct_pkey] PRIMARY KEY CLUSTERED ([promotionId],[productId])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Promotion_type_idx] ON [dbo].[Promotion]([type]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Promotion_isActive_idx] ON [dbo].[Promotion]([isActive]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Promotion_code_idx] ON [dbo].[Promotion]([code]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PromotionProduct_productId_idx] ON [dbo].[PromotionProduct]([productId]);

-- AddForeignKey
ALTER TABLE [dbo].[PromotionProduct] ADD CONSTRAINT [PromotionProduct_promotionId_fkey] FOREIGN KEY ([promotionId]) REFERENCES [dbo].[Promotion]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[PromotionProduct] ADD CONSTRAINT [PromotionProduct_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[Product]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
