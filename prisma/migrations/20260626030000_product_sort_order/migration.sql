ALTER TABLE [dbo].[Product]
ADD [sortOrder] INT NOT NULL CONSTRAINT [Product_sortOrder_df] DEFAULT 0;

EXEC(N'
WITH OrderedProducts AS (
  SELECT
    [id],
    ROW_NUMBER() OVER (
      ORDER BY [createdAt] DESC, [id] ASC
    ) - 1 AS [nextSortOrder]
  FROM [dbo].[Product]
)
UPDATE p
SET [sortOrder] = op.[nextSortOrder]
FROM [dbo].[Product] p
INNER JOIN OrderedProducts op ON op.[id] = p.[id];
');

EXEC(N'CREATE INDEX [Product_sortOrder_idx] ON [dbo].[Product]([sortOrder]);');
