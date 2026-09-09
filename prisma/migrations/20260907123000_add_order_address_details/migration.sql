ALTER TABLE [dbo].[Order] ADD [shippingFloor] NVARCHAR(1000) NOT NULL CONSTRAINT [Order_shippingFloor_df] DEFAULT '';

ALTER TABLE [dbo].[Order] ADD [shippingApartment] NVARCHAR(1000) NOT NULL CONSTRAINT [Order_shippingApartment_df] DEFAULT '';
