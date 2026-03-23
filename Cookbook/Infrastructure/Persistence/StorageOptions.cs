namespace Cookbook.Infrastructure.Persistence;

public sealed class StorageOptions
{
    public const string SectionName = "Storage";

    public string FilePath { get; set; } = "App_Data/cookbook-data.json";
}
