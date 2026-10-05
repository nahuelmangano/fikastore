IF COL_LENGTH('dbo.ShippingCarrier', 'visibleToMerchant') IS NULL
BEGIN
  ALTER TABLE [dbo].[ShippingCarrier]
  ADD [visibleToMerchant] BIT NOT NULL CONSTRAINT [ShippingCarrier_visibleToMerchant_df] DEFAULT 1;
END;

EXEC(N'
UPDATE [dbo].[ShippingCarrier]
SET [visibleToMerchant] = 0,
    [enabled] = 0
WHERE [key] = N''andreani'';
');

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE [name] = N'ShippingCarrier_visibleToMerchant_idx'
    AND [object_id] = OBJECT_ID(N'dbo.ShippingCarrier')
)
BEGIN
  EXEC(N'CREATE NONCLUSTERED INDEX [ShippingCarrier_visibleToMerchant_idx] ON [dbo].[ShippingCarrier]([visibleToMerchant]);');
END;
