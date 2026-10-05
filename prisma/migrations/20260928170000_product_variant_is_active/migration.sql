BEGIN TRY

BEGIN TRAN;

ALTER TABLE [dbo].[ProductVariant]
ADD [isActive] BIT NOT NULL CONSTRAINT [ProductVariant_isActive_df] DEFAULT 1;

CREATE NONCLUSTERED INDEX [ProductVariant_isActive_idx] ON [dbo].[ProductVariant]([isActive]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
