ALTER TABLE [dbo].[Order] ADD [archivedAt] DATETIME2;

CREATE NONCLUSTERED INDEX [Order_archivedAt_idx] ON [dbo].[Order]([archivedAt]);
