using Cookbook.Application.Exceptions;
using Cookbook.Application.Interfaces;
using Microsoft.Extensions.Options;

namespace Cookbook.Infrastructure.Files;

public sealed class PhotoStorageService(
    IWebHostEnvironment environment,
    IOptions<PhotoStorageOptions> options) : IPhotoStorageService
{
    private static readonly HashSet<string> AllowedBuckets = ["products", "dishes"];

    private readonly PhotoStorageOptions _options = options.Value;
    private readonly string _webRootPath = environment.WebRootPath ?? Path.Combine(environment.ContentRootPath, "wwwroot");

    public Task<string> SaveProductPhotoAsync(IFormFile file, CancellationToken cancellationToken)
        => SaveAsync("products", file, cancellationToken);

    public Task<string> SaveDishPhotoAsync(IFormFile file, CancellationToken cancellationToken)
        => SaveAsync("dishes", file, cancellationToken);

    public async Task DeleteAsync(string path, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(path))
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["path"] = ["Photo path is required."]
            });
        }

        var normalized = NormalizePublicPath(path);
        if (!normalized.StartsWith($"{NormalizePublicRoot()}/", StringComparison.OrdinalIgnoreCase))
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["path"] = ["Only uploaded photos from /uploads can be deleted."]
            });
        }

        var relativePath = normalized.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
        var fullPath = Path.GetFullPath(Path.Combine(_webRootPath, relativePath));
        var uploadsRoot = Path.GetFullPath(Path.Combine(_webRootPath, NormalizePublicRoot().TrimStart('/').Replace('/', Path.DirectorySeparatorChar)));

        if (!fullPath.StartsWith(uploadsRoot, StringComparison.OrdinalIgnoreCase))
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["path"] = ["Photo path points outside of the uploads directory."]
            });
        }

        if (!File.Exists(fullPath))
        {
            throw new EntityNotFoundException($"Photo '{normalized}' was not found.");
        }

        File.Delete(fullPath);
        await Task.CompletedTask;
    }

    private async Task<string> SaveAsync(string bucket, IFormFile? file, CancellationToken cancellationToken)
    {
        if (!AllowedBuckets.Contains(bucket))
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["bucket"] = ["Unknown photo bucket."]
            });
        }

        ValidateFile(file);

        var extension = Path.GetExtension(file!.FileName).ToLowerInvariant();
        var fileName = $"{Guid.NewGuid():N}{extension}";
        var targetDirectory = Path.Combine(_webRootPath, NormalizePublicRoot().TrimStart('/'), bucket);
        Directory.CreateDirectory(targetDirectory);

        var filePath = Path.Combine(targetDirectory, fileName);
        await using var stream = File.Create(filePath);
        await file.CopyToAsync(stream, cancellationToken);

        return $"{NormalizePublicRoot()}/{bucket}/{fileName}";
    }

    private void ValidateFile(IFormFile? file)
    {
        if (file is null)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["file"] = ["Photo file is required."]
            });
        }

        if (file.Length <= 0)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["file"] = ["Photo file cannot be empty."]
            });
        }

        if (file.Length > _options.MaxFileSizeBytes)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["file"] = [$"Photo file cannot be larger than {_options.MaxFileSizeBytes} bytes."]
            });
        }

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(extension) || !_options.AllowedExtensions.Contains(extension))
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["file"] = ["Unsupported photo file extension."]
            });
        }

        if (string.IsNullOrWhiteSpace(file.ContentType) ||
            !file.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["file"] = ["Uploaded file must be an image."]
            });
        }
    }

    private string NormalizePublicPath(string path)
    {
        var normalized = path.Trim().Replace('\\', '/');
        return normalized.StartsWith('/') ? normalized : $"/{normalized}";
    }

    private string NormalizePublicRoot()
    {
        var normalized = (_options.PublicRoot ?? "/uploads").Trim().Replace('\\', '/').TrimEnd('/');
        return normalized.StartsWith('/') ? normalized : $"/{normalized}";
    }
}
