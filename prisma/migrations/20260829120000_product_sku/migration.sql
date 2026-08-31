ALTER TABLE [dbo].[Product]
ADD [sku] NVARCHAR(255);

CREATE INDEX [Product_sku_idx] ON [dbo].[Product]([sku]);
