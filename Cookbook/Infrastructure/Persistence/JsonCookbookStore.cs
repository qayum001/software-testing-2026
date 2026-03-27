using System.Text.Json;
using System.Text.Json.Serialization;
using Cookbook.Application.Interfaces;
using Cookbook.Domain.Models;
using Microsoft.Extensions.Options;

namespace Cookbook.Infrastructure.Persistence;

public sealed class JsonCookbookStore : ICookbookStore
{
    private readonly SemaphoreSlim _mutex = new(1, 1);
    private readonly JsonSerializerOptions _jsonOptions;
    private readonly string _filePath;

    public JsonCookbookStore(IOptions<StorageOptions> storageOptions, IWebHostEnvironment environment)
    {
        var configuredPath = storageOptions.Value.FilePath;
        _filePath = Path.IsPathRooted(configuredPath)
            ? configuredPath
            : Path.Combine(environment.ContentRootPath, configuredPath);

        _jsonOptions = new JsonSerializerOptions
        {
            WriteIndented = true,
            Converters = { new JsonStringEnumConverter() }
        };
    }

    public async Task<IReadOnlyList<Product>> GetProductsAsync(CancellationToken cancellationToken)
    {
        await _mutex.WaitAsync(cancellationToken);
        try
        {
            var data = await LoadAsync(cancellationToken);
            return data.Products.Select(CloneProduct).ToList();
        }
        finally
        {
            _mutex.Release();
        }
    }

    public async Task<Product?> GetProductByIdAsync(Guid id, CancellationToken cancellationToken)
    {
        await _mutex.WaitAsync(cancellationToken);
        try
        {
            var data = await LoadAsync(cancellationToken);
            return data.Products.Where(p => p.Id == id).Select(CloneProduct).SingleOrDefault();
        }
        finally
        {
            _mutex.Release();
        }
    }

    public async Task<Product> AddProductAsync(Product product, CancellationToken cancellationToken)
    {
        await _mutex.WaitAsync(cancellationToken);
        try
        {
            var data = await LoadAsync(cancellationToken);
            var clone = CloneProduct(product);
            data.Products.Add(clone);
            await SaveAsync(data, cancellationToken);
            return CloneProduct(clone);
        }
        finally
        {
            _mutex.Release();
        }
    }

    public async Task<Product?> UpdateProductAsync(Product product, CancellationToken cancellationToken)
    {
        await _mutex.WaitAsync(cancellationToken);
        try
        {
            var data = await LoadAsync(cancellationToken);
            var index = data.Products.FindIndex(item => item.Id == product.Id);
            if (index < 0)
            {
                return null;
            }

            var clone = CloneProduct(product);
            data.Products[index] = clone;
            await SaveAsync(data, cancellationToken);
            return CloneProduct(clone);
        }
        finally
        {
            _mutex.Release();
        }
    }

    public async Task<bool> DeleteProductAsync(Guid id, CancellationToken cancellationToken)
    {
        await _mutex.WaitAsync(cancellationToken);
        try
        {
            var data = await LoadAsync(cancellationToken);
            var removed = data.Products.RemoveAll(item => item.Id == id) > 0;
            if (!removed)
            {
                return false;
            }

            await SaveAsync(data, cancellationToken);
            return true;
        }
        finally
        {
            _mutex.Release();
        }
    }

    public async Task<IReadOnlyList<Dish>> GetDishesAsync(CancellationToken cancellationToken)
    {
        await _mutex.WaitAsync(cancellationToken);
        try
        {
            var data = await LoadAsync(cancellationToken);
            return data.Dishes.Select(CloneDish).ToList();
        }
        finally
        {
            _mutex.Release();
        }
    }

    public async Task<Dish?> GetDishByIdAsync(Guid id, CancellationToken cancellationToken)
    {
        await _mutex.WaitAsync(cancellationToken);
        try
        {
            var data = await LoadAsync(cancellationToken);
            return data.Dishes.Where(d => d.Id == id).Select(CloneDish).SingleOrDefault();
        }
        finally
        {
            _mutex.Release();
        }
    }

    public async Task<Dish> AddDishAsync(Dish dish, CancellationToken cancellationToken)
    {
        await _mutex.WaitAsync(cancellationToken);
        try
        {
            var data = await LoadAsync(cancellationToken);
            var clone = CloneDish(dish);
            data.Dishes.Add(clone);
            await SaveAsync(data, cancellationToken);
            return CloneDish(clone);
        }
        finally
        {
            _mutex.Release();
        }
    }

    public async Task<Dish?> UpdateDishAsync(Dish dish, CancellationToken cancellationToken)
    {
        await _mutex.WaitAsync(cancellationToken);
        try
        {
            var data = await LoadAsync(cancellationToken);
            var index = data.Dishes.FindIndex(item => item.Id == dish.Id);
            if (index < 0)
            {
                return null;
            }

            var clone = CloneDish(dish);
            data.Dishes[index] = clone;
            await SaveAsync(data, cancellationToken);
            return CloneDish(clone);
        }
        finally
        {
            _mutex.Release();
        }
    }

    public async Task<bool> DeleteDishAsync(Guid id, CancellationToken cancellationToken)
    {
        await _mutex.WaitAsync(cancellationToken);
        try
        {
            var data = await LoadAsync(cancellationToken);
            var removed = data.Dishes.RemoveAll(item => item.Id == id) > 0;
            if (!removed)
            {
                return false;
            }

            await SaveAsync(data, cancellationToken);
            return true;
        }
        finally
        {
            _mutex.Release();
        }
    }

    public async Task<IReadOnlyList<Dish>> GetDishesByProductIdAsync(Guid productId, CancellationToken cancellationToken)
    {
        await _mutex.WaitAsync(cancellationToken);
        try
        {
            var data = await LoadAsync(cancellationToken);
            return data.Dishes
                .Where(dish => dish.Products.Any(product => product.ProductId == productId))
                .Select(CloneDish)
                .ToList();
        }
        finally
        {
            _mutex.Release();
        }
    }

    private async Task<CookbookDataFile> LoadAsync(CancellationToken cancellationToken)
    {
        if (!File.Exists(_filePath))
        {
            return new CookbookDataFile();
        }

        await using var stream = File.Open(_filePath, FileMode.Open, FileAccess.Read, FileShare.Read);
        if (stream.Length == 0)
        {
            return new CookbookDataFile();
        }

        var data = await JsonSerializer.DeserializeAsync<CookbookDataFile>(stream, _jsonOptions, cancellationToken)
                   ?? new CookbookDataFile();

        Normalize(data);
        return data;
    }

    private async Task SaveAsync(CookbookDataFile data, CancellationToken cancellationToken)
    {
        Normalize(data);

        var directory = Path.GetDirectoryName(_filePath);
        if (!string.IsNullOrWhiteSpace(directory))
        {
            Directory.CreateDirectory(directory);
        }

        await using var stream = File.Open(_filePath, FileMode.Create, FileAccess.Write, FileShare.None);
        await JsonSerializer.SerializeAsync(stream, data, _jsonOptions, cancellationToken);
    }

    private static void Normalize(CookbookDataFile data)
    {
        data.Products ??= [];
        data.Dishes ??= [];

        foreach (var product in data.Products)
        {
            product.Photos = NormalizePhotos(product.Photos);
            product.Flags ??= [];
        }

        foreach (var dish in data.Dishes)
        {
            dish.Photos = NormalizePhotos(dish.Photos);
            dish.Flags ??= [];
            dish.Products ??= [];
        }
    }

    private static List<string> NormalizePhotos(List<string>? photos)
    {
        if (photos is null)
        {
            return [];
        }

        return photos
            .Where(path => !string.IsNullOrWhiteSpace(path))
            .Select(NormalizePhotoPath)
            .ToList();
    }

    private static string NormalizePhotoPath(string path)
    {
        var trimmed = path.Trim().Replace('\\', '/');
        if (trimmed.Length == 0)
        {
            return trimmed;
        }

        if (Uri.TryCreate(trimmed, UriKind.Absolute, out _))
        {
            return trimmed;
        }

        return trimmed.StartsWith('/') ? trimmed : $"/{trimmed}";
    }

    private static Product CloneProduct(Product source)
    {
        return new Product
        {
            Id = source.Id,
            Name = source.Name,
            Photos = source.Photos.ToList(),
            Calories = source.Calories,
            Proteins = source.Proteins,
            Fats = source.Fats,
            Carbs = source.Carbs,
            Composition = source.Composition,
            Category = source.Category,
            CookingType = source.CookingType,
            Flags = source.Flags.ToHashSet(),
            CreatedAt = source.CreatedAt,
            UpdatedAt = source.UpdatedAt
        };
    }

    private static Dish CloneDish(Dish source)
    {
        return new Dish
        {
            Id = source.Id,
            Name = source.Name,
            Photos = source.Photos.ToList(),
            Calories = source.Calories,
            Proteins = source.Proteins,
            Fats = source.Fats,
            Carbs = source.Carbs,
            PortionSize = source.PortionSize,
            Category = source.Category,
            Flags = source.Flags.ToHashSet(),
            Products = source.Products
                .Select(item => new DishProduct { ProductId = item.ProductId, Amount = item.Amount })
                .ToList(),
            CreatedAt = source.CreatedAt,
            UpdatedAt = source.UpdatedAt
        };
    }
}
