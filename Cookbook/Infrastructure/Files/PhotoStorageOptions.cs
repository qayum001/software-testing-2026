namespace Cookbook.Infrastructure.Files;

public sealed class PhotoStorageOptions
{
    public const string SectionName = "PhotoStorage";

    public string PublicRoot { get; set; } = "/uploads";

    public long MaxFileSizeBytes { get; set; } = 5 * 1024 * 1024;

    public HashSet<string> AllowedExtensions { get; set; } =
    [
        ".jpg",
        ".jpeg",
        ".png",
        ".gif",
        ".webp",
        ".bmp"
    ];
}
