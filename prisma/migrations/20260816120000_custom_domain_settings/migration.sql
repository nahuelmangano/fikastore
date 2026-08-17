CREATE TABLE [dbo].[StoreCustomDomain] (
    [id] NVARCHAR(1000) NOT NULL,
    [storeKey] NVARCHAR(1000) NOT NULL CONSTRAINT [StoreCustomDomain_storeKey_df] DEFAULT 'default',
    [customDomain] NVARCHAR(255),
    [domainStatus] NVARCHAR(1000) NOT NULL CONSTRAINT [StoreCustomDomain_domainStatus_df] DEFAULT 'NOT_CONFIGURED',
    [domainVerifiedAt] DATETIME2,
    [domainActivatedAt] DATETIME2,
    [errorMessage] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [StoreCustomDomain_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [StoreCustomDomain_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [StoreCustomDomain_domainStatus_check] CHECK ([domainStatus] IN ('NOT_CONFIGURED', 'PENDING', 'VERIFIED', 'ACTIVE', 'ERROR'))
);

CREATE UNIQUE NONCLUSTERED INDEX [StoreCustomDomain_storeKey_key] ON [dbo].[StoreCustomDomain]([storeKey]);
CREATE UNIQUE NONCLUSTERED INDEX [StoreCustomDomain_customDomain_key] ON [dbo].[StoreCustomDomain]([customDomain]) WHERE [customDomain] IS NOT NULL;
CREATE NONCLUSTERED INDEX [StoreCustomDomain_domainStatus_idx] ON [dbo].[StoreCustomDomain]([domainStatus]);
