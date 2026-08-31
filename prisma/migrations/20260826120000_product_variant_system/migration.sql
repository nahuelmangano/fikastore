BEGIN TRY

BEGIN TRAN;

ALTER TABLE [dbo].[Product]
ADD [hasVariants] BIT NOT NULL CONSTRAINT [Product_hasVariants_df] DEFAULT 0;

ALTER TABLE [dbo].[OrderItem]
ADD [productVariantId] NVARCHAR(1000),
    [variantSnapshot] NVARCHAR(1000),
    [skuSnapshot] NVARCHAR(1000);

CREATE TABLE [dbo].[ProductOption] (
    [id] NVARCHAR(1000) NOT NULL,
    [productId] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [position] INT NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ProductOption_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [ProductOption_pkey] PRIMARY KEY CLUSTERED ([id])
);

CREATE TABLE [dbo].[ProductOptionValue] (
    [id] NVARCHAR(1000) NOT NULL,
    [optionId] NVARCHAR(1000) NOT NULL,
    [value] NVARCHAR(1000) NOT NULL,
    [position] INT NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ProductOptionValue_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [ProductOptionValue_pkey] PRIMARY KEY CLUSTERED ([id])
);

CREATE TABLE [dbo].[ProductVariant] (
    [id] NVARCHAR(1000) NOT NULL,
    [productId] NVARCHAR(1000) NOT NULL,
    [combinationKey] NVARCHAR(1000) NOT NULL,
    [label] NVARCHAR(1000) NOT NULL,
    [sku] NVARCHAR(255),
    [stock] INT NOT NULL CONSTRAINT [ProductVariant_stock_df] DEFAULT 0,
    [priceOverride] DECIMAL(18,2),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ProductVariant_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [ProductVariant_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ProductVariant_productId_combinationKey_key] UNIQUE NONCLUSTERED ([productId], [combinationKey])
);

CREATE TABLE [dbo].[ProductVariantValue] (
    [variantId] NVARCHAR(1000) NOT NULL,
    [optionValueId] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [ProductVariantValue_pkey] PRIMARY KEY CLUSTERED ([variantId], [optionValueId])
);

CREATE NONCLUSTERED INDEX [OrderItem_productVariantId_idx] ON [dbo].[OrderItem]([productVariantId]);
CREATE NONCLUSTERED INDEX [ProductOption_productId_position_idx] ON [dbo].[ProductOption]([productId], [position]);
CREATE NONCLUSTERED INDEX [ProductOptionValue_optionId_position_idx] ON [dbo].[ProductOptionValue]([optionId], [position]);
CREATE NONCLUSTERED INDEX [ProductVariant_productId_idx] ON [dbo].[ProductVariant]([productId]);
CREATE NONCLUSTERED INDEX [ProductVariantValue_optionValueId_idx] ON [dbo].[ProductVariantValue]([optionValueId]);

ALTER TABLE [dbo].[ProductOption]
ADD CONSTRAINT [ProductOption_productId_fkey]
FOREIGN KEY ([productId]) REFERENCES [dbo].[Product]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE [dbo].[ProductOptionValue]
ADD CONSTRAINT [ProductOptionValue_optionId_fkey]
FOREIGN KEY ([optionId]) REFERENCES [dbo].[ProductOption]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE [dbo].[ProductVariant]
ADD CONSTRAINT [ProductVariant_productId_fkey]
FOREIGN KEY ([productId]) REFERENCES [dbo].[Product]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE [dbo].[ProductVariantValue]
ADD CONSTRAINT [ProductVariantValue_variantId_fkey]
FOREIGN KEY ([variantId]) REFERENCES [dbo].[ProductVariant]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE [dbo].[ProductVariantValue]
ADD CONSTRAINT [ProductVariantValue_optionValueId_fkey]
FOREIGN KEY ([optionValueId]) REFERENCES [dbo].[ProductOptionValue]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE [dbo].[OrderItem]
ADD CONSTRAINT [OrderItem_productVariantId_fkey]
FOREIGN KEY ([productVariantId]) REFERENCES [dbo].[ProductVariant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
