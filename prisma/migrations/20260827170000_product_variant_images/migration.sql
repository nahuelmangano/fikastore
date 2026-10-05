BEGIN TRY

BEGIN TRAN;

CREATE TABLE [dbo].[ProductVariantImage] (
    [variantId] NVARCHAR(1000) NOT NULL,
    [imageId] NVARCHAR(1000) NOT NULL,
    [sortOrder] INT NOT NULL CONSTRAINT [ProductVariantImage_sortOrder_df] DEFAULT 0,
    CONSTRAINT [ProductVariantImage_pkey] PRIMARY KEY CLUSTERED ([variantId], [imageId])
);

CREATE NONCLUSTERED INDEX [ProductVariantImage_imageId_idx] ON [dbo].[ProductVariantImage]([imageId]);
CREATE NONCLUSTERED INDEX [ProductVariantImage_variantId_sortOrder_idx] ON [dbo].[ProductVariantImage]([variantId], [sortOrder]);

ALTER TABLE [dbo].[ProductVariantImage]
ADD CONSTRAINT [ProductVariantImage_variantId_fkey]
FOREIGN KEY ([variantId]) REFERENCES [dbo].[ProductVariant]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE [dbo].[ProductVariantImage]
ADD CONSTRAINT [ProductVariantImage_imageId_fkey]
FOREIGN KEY ([imageId]) REFERENCES [dbo].[ProductImage]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
