IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Order]') AND name = N'billingName')
BEGIN
  ALTER TABLE [dbo].[Order] ADD [billingName] NVARCHAR(1000);
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Order]') AND name = N'billingPhone')
BEGIN
  ALTER TABLE [dbo].[Order] ADD [billingPhone] NVARCHAR(1000);
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Order]') AND name = N'billingAddressLine')
BEGIN
  ALTER TABLE [dbo].[Order] ADD [billingAddressLine] NVARCHAR(1000);
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Order]') AND name = N'billingFloor')
BEGIN
  ALTER TABLE [dbo].[Order] ADD [billingFloor] NVARCHAR(1000) NOT NULL CONSTRAINT [Order_billingFloor_df] DEFAULT '';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Order]') AND name = N'billingApartment')
BEGIN
  ALTER TABLE [dbo].[Order] ADD [billingApartment] NVARCHAR(1000) NOT NULL CONSTRAINT [Order_billingApartment_df] DEFAULT '';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Order]') AND name = N'billingCity')
BEGIN
  ALTER TABLE [dbo].[Order] ADD [billingCity] NVARCHAR(1000);
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Order]') AND name = N'billingZip')
BEGIN
  ALTER TABLE [dbo].[Order] ADD [billingZip] NVARCHAR(1000);
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Order]') AND name = N'billingProvince')
BEGIN
  ALTER TABLE [dbo].[Order] ADD [billingProvince] NVARCHAR(1000) CONSTRAINT [Order_billingProvince_df] DEFAULT '';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Order]') AND name = N'billingProvinceCode')
BEGIN
  ALTER TABLE [dbo].[Order] ADD [billingProvinceCode] NVARCHAR(1000) CONSTRAINT [Order_billingProvinceCode_df] DEFAULT '';
END
