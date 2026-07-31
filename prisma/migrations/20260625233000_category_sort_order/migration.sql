ALTER TABLE [dbo].[Category]
ADD [sortOrder] INT NOT NULL CONSTRAINT [Category_sortOrder_df] DEFAULT 0;

EXEC(N'
WITH OrderedCategories AS (
  SELECT
    [id],
    ROW_NUMBER() OVER (
      PARTITION BY COALESCE([parentId], '''')
      ORDER BY [name] ASC, [id] ASC
    ) - 1 AS [nextSortOrder]
  FROM [dbo].[Category]
)
UPDATE c
SET [sortOrder] = oc.[nextSortOrder]
FROM [dbo].[Category] c
INNER JOIN OrderedCategories oc ON oc.[id] = c.[id];
');

EXEC(N'CREATE INDEX [Category_parentId_sortOrder_idx] ON [dbo].[Category]([parentId], [sortOrder]);');
