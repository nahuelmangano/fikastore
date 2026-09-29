BEGIN TRY

BEGIN TRAN;

ALTER TABLE [dbo].[ProductVariant]
ADD [position] INT NOT NULL CONSTRAINT [ProductVariant_position_df] DEFAULT 0;

CREATE NONCLUSTERED INDEX [ProductVariant_productId_position_idx] ON [dbo].[ProductVariant]([productId], [position]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
