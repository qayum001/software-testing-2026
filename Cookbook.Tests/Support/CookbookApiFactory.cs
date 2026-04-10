using Cookbook.Application.Interfaces;
using Cookbook.Domain.Models;
using Cookbook.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Cookbook.Tests.Support;

internal sealed class CookbookApiFactory : WebApplicationFactory<Program>
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        Converters = { new JsonStringEnumConverter() }
    };

    private readonly string _storageDirectoryPath = Path.Combine(
        Path.GetTempPath(),
        "cookbook-api-tests",
        Guid.NewGuid().ToString("N"));

    private readonly string _storageFilePath;

    public CookbookApiFactory(IEnumerable<Product>? products = null, IEnumerable<Dish>? dishes = null)
    {
        _storageFilePath = Path.Combine(_storageDirectoryPath, "cookbook-data.json");
        SeedStore(products, dishes);
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.ConfigureAppConfiguration((_, configurationBuilder) =>
        {
            configurationBuilder.AddInMemoryCollection(new Dictionary<string, string?>
            {
                [($"{StorageOptions.SectionName}:{nameof(StorageOptions.FilePath)}")] = _storageFilePath
            });
        });

        builder.ConfigureServices(services =>
        {
            services.RemoveAll<IPhotoStorageService>();
            services.AddSingleton<IPhotoStorageService, TestPhotoStorageService>();
        });
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);

        if (!disposing || !Directory.Exists(_storageDirectoryPath))
        {
            return;
        }

        Directory.Delete(_storageDirectoryPath, recursive: true);
    }

    private void SeedStore(IEnumerable<Product>? products, IEnumerable<Dish>? dishes)
    {
        Directory.CreateDirectory(_storageDirectoryPath);

        var data = new CookbookDataFile
        {
            Products = products?.Select(CloneProduct).ToList() ?? [],
            Dishes = dishes?.Select(CloneDish).ToList() ?? []
        };

        var json = JsonSerializer.Serialize(data, JsonOptions);
        File.WriteAllText(_storageFilePath, json);
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

internal sealed class TestPhotoStorageService : IPhotoStorageService
{
    public Task<string> SaveProductPhotoAsync(IFormFile file, CancellationToken cancellationToken)
        => Task.FromResult($"/uploads/products/{Guid.NewGuid():N}.jpg");

    public Task<string> SaveDishPhotoAsync(IFormFile file, CancellationToken cancellationToken)
        => Task.FromResult($"/uploads/dishes/{Guid.NewGuid():N}.jpg");

    public Task DeleteAsync(string path, CancellationToken cancellationToken)
        => Task.CompletedTask;
}
