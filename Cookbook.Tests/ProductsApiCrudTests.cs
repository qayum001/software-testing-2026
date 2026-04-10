using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Cookbook.Contracts.Products;
using Cookbook.Domain.Enums;
using Cookbook.Domain.Models;
using Cookbook.Tests.Support;
using Xunit;

namespace Cookbook.Tests;

public sealed class ProductsApiCrudTests : IAsyncLifetime
{
    private CookbookApiFactory _factory = null!;
    private HttpClient _client = null!;
    private Guid _usedProductId;
    private Guid _unusedProductId;
    private Guid _dishId;

    public Task InitializeAsync()
    {
        _usedProductId = Guid.NewGuid();
        _unusedProductId = Guid.NewGuid();
        _dishId = Guid.NewGuid();

        var usedProduct = new Product
        {
            Id = _usedProductId,
            Name = "Milk",
            Calories = 60f,
            Proteins = 3f,
            Fats = 3f,
            Carbs = 5f,
            Category = ProductCategory.Liquid,
            CookingType = CookingType.ReadyToEat,
            Flags = [DietaryFlag.GlutenFree]
        };

        var unusedProduct = new Product
        {
            Id = _unusedProductId,
            Name = "Buckwheat",
            Calories = 343f,
            Proteins = 13.3f,
            Fats = 3.4f,
            Carbs = 71.5f,
            Category = ProductCategory.Grains,
            CookingType = CookingType.RequiresCooking,
            Flags = [DietaryFlag.Vegan]
        };

        var dish = new Dish
        {
            Id = _dishId,
            Name = "Milk soup",
            Calories = 60f,
            Proteins = 3f,
            Fats = 3f,
            Carbs = 5f,
            PortionSize = 100f,
            Category = DishCategory.Soup,
            Products =
            [
                new DishProduct
                {
                    ProductId = _usedProductId,
                    Amount = 100f
                }
            ]
        };

        _factory = new CookbookApiFactory([usedProduct, unusedProduct], [dish]);
        _client = _factory.CreateClient();
        return Task.CompletedTask;
    }

    public Task DisposeAsync()
    {
        _client.Dispose();
        _factory.Dispose();
        return Task.CompletedTask;
    }

    [Fact]
    public async Task CreateProduct_PersistsAndReturnsCreatedEntity()
    {
        using var content = BuildProductRequest(
            name: "Apple",
            calories: 52f,
            proteins: 0.3f,
            fats: 0.2f,
            carbs: 14f,
            composition: "Fresh fruit",
            category: ProductCategory.Sweets,
            cookingType: CookingType.ReadyToEat,
            photos: ["/images/apple.jpg"],
            flags: [DietaryFlag.Vegan, DietaryFlag.GlutenFree]);

        var response = await _client.PostAsync("/api/products", content);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<ProductResponse>();
        Assert.NotNull(created);
        Assert.Equal("Apple", created!.Name);
        Assert.Equal(52f, created.Calories, 2);
        Assert.Equal("Fresh fruit", created.Composition);
        Assert.Contains("/images/apple.jpg", created.Photos);
        Assert.Contains(DietaryFlag.Vegan, created.Flags);
        Assert.Contains(DietaryFlag.GlutenFree, created.Flags);
        Assert.NotEqual(Guid.Empty, created.Id);
        Assert.NotEqual(default, created.CreatedAt);

        var persisted = await _client.GetFromJsonAsync<ProductResponse>($"/api/products/{created.Id}");
        Assert.NotNull(persisted);
        Assert.Equal(created.Id, persisted!.Id);
        Assert.Equal("Apple", persisted.Name);
    }
    
    [Fact]
    public async Task GetProductById_ReturnsSeededProduct()
    {
        var response = await _client.GetAsync($"/api/products/{_unusedProductId}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var product = await response.Content.ReadFromJsonAsync<ProductResponse>();
        Assert.NotNull(product);
        Assert.Equal(_unusedProductId, product!.Id);
        Assert.Equal("Buckwheat", product.Name);
        Assert.Equal(ProductCategory.Grains, product.Category);
    }

    [Fact]
    public async Task UpdateProduct_ChangesPersistedFields()
    {
        var created = await CreateProductAsync(
            name: "Pumpkin",
            calories: 26f,
            proteins: 1f,
            fats: 0.1f,
            carbs: 6.5f,
            composition: "Initial",
            category: ProductCategory.Vegetables,
            cookingType: CookingType.ReadyToEat,
            photos: ["/images/pumpkin.jpg"],
            flags: [DietaryFlag.Vegan]);

        using var content = BuildProductRequest(
            name: "Baked pumpkin",
            calories: 40f,
            proteins: 1.2f,
            fats: 0.3f,
            carbs: 9.8f,
            composition: "Updated",
            category: ProductCategory.Vegetables,
            cookingType: CookingType.RequiresCooking,
            photos: ["/images/pumpkin-updated.jpg"],
            flags: [DietaryFlag.GlutenFree]);

        var response = await _client.PutAsync($"/api/products/{created.Id}", content);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = await response.Content.ReadFromJsonAsync<ProductResponse>();
        Assert.NotNull(updated);
        Assert.Equal(created.Id, updated!.Id);
        Assert.Equal("Baked pumpkin", updated.Name);
        Assert.Equal(40f, updated.Calories, 2);
        Assert.Equal("Updated", updated.Composition);
        Assert.Equal(CookingType.RequiresCooking, updated.CookingType);
        Assert.Equal(["/images/pumpkin-updated.jpg"], updated.Photos);
        Assert.Contains(DietaryFlag.GlutenFree, updated.Flags);
        Assert.DoesNotContain(DietaryFlag.Vegan, updated.Flags);
        Assert.NotNull(updated.UpdatedAt);

        var persisted = await _client.GetFromJsonAsync<ProductResponse>($"/api/products/{created.Id}");
        Assert.NotNull(persisted);
        Assert.Equal("Baked pumpkin", persisted!.Name);
        Assert.Equal("Updated", persisted.Composition);
        Assert.Equal(CookingType.RequiresCooking, persisted.CookingType);
    }

    [Fact]
    public async Task DeleteProduct_RemovesEntity()
    {
        var created = await CreateProductAsync(
            name: "Pear",
            calories: 57f,
            proteins: 0.4f,
            fats: 0.1f,
            carbs: 15f,
            composition: "Juicy",
            category: ProductCategory.Sweets,
            cookingType: CookingType.ReadyToEat,
            photos: ["/images/pear.jpg"],
            flags: [DietaryFlag.Vegan]);

        var deleteResponse = await _client.DeleteAsync($"/api/products/{created.Id}");

        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var getResponse = await _client.GetAsync($"/api/products/{created.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getResponse.StatusCode);

        var products = await _client.GetFromJsonAsync<List<ProductResponse>>("/api/products");
        Assert.NotNull(products);
        Assert.DoesNotContain(products!, product => product.Id == created.Id);
    }

    [Fact]
    public async Task DeleteProduct_ReturnsConflict_WhenProductIsUsedInDish()
    {
        var response = await _client.DeleteAsync($"/api/products/{_usedProductId}");

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);

        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var root = document.RootElement;
        Assert.Equal("Conflict", root.GetProperty("title").GetString());
        Assert.Equal("Cannot delete product because it is used in dishes.", root.GetProperty("detail").GetString());

        var details = root.GetProperty("details");
        Assert.Equal("Cannot delete product because it is used in dishes.", details.GetProperty("message").GetString());

        var dishes = details.GetProperty("dishes").EnumerateArray().ToList();
        Assert.Single(dishes);
        Assert.Equal(_dishId, dishes[0].GetProperty("id").GetGuid());
        Assert.Equal("Milk soup", dishes[0].GetProperty("name").GetString());

        var product = await _client.GetFromJsonAsync<ProductResponse>($"/api/products/{_usedProductId}");
        Assert.NotNull(product);
    }

    private async Task<ProductResponse> CreateProductAsync(
        string name,
        float calories,
        float proteins,
        float fats,
        float carbs,
        string? composition,
        ProductCategory category,
        CookingType cookingType,
        IReadOnlyList<string>? photos = null,
        IReadOnlyList<DietaryFlag>? flags = null)
    {
        using var content = BuildProductRequest(
            name,
            calories,
            proteins,
            fats,
            carbs,
            composition,
            category,
            cookingType,
            photos,
            flags);

        var response = await _client.PostAsync("/api/products", content);
        response.EnsureSuccessStatusCode();
        var created = await response.Content.ReadFromJsonAsync<ProductResponse>();
        Assert.NotNull(created);
        return created!;
    }

    private static MultipartFormDataContent BuildProductRequest(
        string name,
        float calories,
        float proteins,
        float fats,
        float carbs,
        string? composition,
        ProductCategory category,
        CookingType cookingType,
        IReadOnlyList<string>? photos = null,
        IReadOnlyList<DietaryFlag>? flags = null)
    {
        var content = new MultipartFormDataContent
        {
            { CreateString(name), "Name" },
            { CreateString(calories), "Calories" },
            { CreateString(proteins), "Proteins" },
            { CreateString(fats), "Fats" },
            { CreateString(carbs), "Carbs" },
            { CreateString((int)category), "Category" },
            { CreateString((int)cookingType), "CookingType" }
        };

        if (!string.IsNullOrWhiteSpace(composition))
        {
            content.Add(CreateString(composition), "Composition");
        }

        if (photos is not null)
        {
            for (var index = 0; index < photos.Count; index++)
            {
                content.Add(CreateString(photos[index]), $"Photos[{index}]");
            }
        }

        if (flags is not null)
        {
            for (var index = 0; index < flags.Count; index++)
            {
                content.Add(CreateString((int)flags[index]), $"Flags[{index}]");
            }
        }

        return content;
    }

    private static StringContent CreateString(object value)
    {
        var text = value switch
        {
            float number => number.ToString(CultureInfo.InvariantCulture),
            Guid guid => guid.ToString(),
            _ => Convert.ToString(value, CultureInfo.InvariantCulture) ?? string.Empty
        };

        return new StringContent(text);
    }
}
