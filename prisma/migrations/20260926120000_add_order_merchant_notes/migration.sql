IF NOT EXISTS (
  SELECT 1
  FROM sys.columns
  WHERE object_id = OBJECT_ID(N'[dbo].[Order]')
    AND name = N'merchantNotes'
)
BEGIN
  ALTER TABLE [dbo].[Order] ADD [merchantNotes] NVARCHAR(max);
END
