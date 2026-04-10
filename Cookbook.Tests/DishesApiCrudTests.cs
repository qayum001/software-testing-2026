using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using Cookbook.Contracts.Dishes;
using Cookbook.Domain.Enums;
using Cookbook.Domain.Models;
using Cookbook.Tests.Support;
using Xunit;

namespace Cookbook.Tests;

public sealed class DishesApiCrudTests : IAsyncLifetime
{
    private CookbookApiFactory _factory = null!;
    private HttpClient _client = null!;
    private Guid _riceId;
    private Guid _tofuId;
    private Guid _seedDishId;

    public Task InitializeAsync()
    {
        _riceId = Guid.NewGuid();
        _tofuId = Guid.NewGuid();
        _seedDishId = Guid.NewGuid();

        var rice = new Product
        {
            Id = _riceId,
            Name = "Rice",
            Calories = 360f,
            Proteins = 7f,
            Fats = 1f,
            Carbs = 79f,
            Category = ProductCategory.Grains,
            CookingType = CookingType.RequiresCooking,
            Flags = [DietaryFlag.Vegan, DietaryFlag.GlutenFree]
        };

        var tofu = new Product
        {
            Id = _tofuId,
            Name = "Tofu",
            Calories = 76f,
            Proteins = 8f,
            Fats = 4.8f,
            Carbs = 1.9f,
            Category = ProductCategory.Meat,
            CookingType = CookingType.ReadyToEat,
            Flags = [DietaryFlag.Vegan, DietaryFlag.GlutenFree]
        };

        var seedDish = new Dish
        {
            Id = _seedDishId,
            Name = "Rice bowl",
            Calories = 218f,
            Proteins = 11f,
            Fats = 5.8f,
            Carbs = 40.45f,
            PortionSize = 200f,
            Category = DishCategory.SecondCourse,
            Flags = [DietaryFlag.Vegan],
            Products =
            [
                new DishProduct { ProductId = _riceId, Amount = 50f },
                new DishProduct { ProductId = _tofuId, Amount = 50f }
            ]
        };

        _factory = new CookbookApiFactory([rice, tofu], [seedDish]);
        _client = _factory.CreateClient();
        return Task.CompletedTask;
    }

    public Task DisposeAsync()
    {
        _client.Dispose();
        _factory.Dispose();
        return Task.CompletedTask;
    }
    // TODO: добавить summary
    [Fact]
    public async Task CreateDish_PersistsAndReturnsCreatedEntity()
    {
        using var content = BuildDishRequest(
            name: "Tofu pilaf",
            products: [(_riceId, 100f), (_tofuId, 50f)],
            portionSize: 250f,
            category: DishCategory.SecondCourse,
            photos: ["/images/pilaf.jpg"],
            flags: [DietaryFlag.Vegan]);

        var response = await _client.PostAsync("/api/dishes", content);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<DishResponse>();
        Assert.NotNull(created);
        Assert.Equal("Tofu pilaf", created!.Name);
        Assert.Equal(250f, created.PortionSize, 2);
        
        var persisted = await _client.GetFromJsonAsync<DishResponse>($"/api/dishes/{created.Id}");
        Assert.NotNull(persisted);
        Assert.Equal(created.Id, persisted!.Id);
        Assert.Equal(2, persisted.Products.Count);
    }
    
    [Fact]
    public async Task GetDishById_ReturnsExistingDish()
    {
        var response = await _client.GetAsync($"/api/dishes/{_seedDishId}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var dish = await response.Content.ReadFromJsonAsync<DishResponse>();
        Assert.NotNull(dish);
        Assert.Equal(_seedDishId, dish!.Id);
        Assert.Equal("Rice bowl", dish.Name);
    }

    [Fact]
    public async Task UpdateDish_ChangesPersistedFields()
    {
        var created = await CreateDishAsync(
            name: "Plain rice",
            products: [(_riceId, 80f)],
            portionSize: 180f,
            category: DishCategory.SecondCourse,
            photos: ["/images/plain-rice.jpg"]);

        using var content = BuildDishRequest(
            name: "Rice with tofu",
            products: [(_riceId, 120f), (_tofuId, 80f)],
            portionSize: 260f,
            category: DishCategory.Snack,
            photos: ["/images/rice-tofu.jpg"],
            flags: [DietaryFlag.Vegan, DietaryFlag.GlutenFree]);

        var response = await _client.PutAsync($"/api/dishes/{created.Id}", content);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = await response.Content.ReadFromJsonAsync<DishResponse>();
        Assert.NotNull(updated);
        Assert.Equal(created.Id, updated!.Id);
        Assert.Equal("Rice with tofu", updated.Name);

        var persisted = await _client.GetFromJsonAsync<DishResponse>($"/api/dishes/{created.Id}");
        Assert.NotNull(persisted);
        Assert.Equal("Rice with tofu", persisted!.Name);
        Assert.Equal(2, persisted.Products.Count);
    }

    [Fact]
    public async Task DeleteDish_RemovesEntity()
    {
        var created = await CreateDishAsync(
            name: "Rice snack",
            products: [(_riceId, 60f)],
            portionSize: 120f,
            category: DishCategory.Snack,
            photos: ["/images/rice-snack.jpg"]);

        var deleteResponse = await _client.DeleteAsync($"/api/dishes/{created.Id}");

        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var getResponse = await _client.GetAsync($"/api/dishes/{created.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getResponse.StatusCode);

        var dishes = await _client.GetFromJsonAsync<List<DishResponse>>("/api/dishes");
        Assert.NotNull(dishes);
        Assert.DoesNotContain(dishes!, dish => dish.Id == created.Id);
    }

    private async Task<DishResponse> CreateDishAsync(
        string name,
        IReadOnlyList<(Guid ProductId, float Amount)> products,
        float portionSize,
        DishCategory category,
        IReadOnlyList<string>? photos = null,
        IReadOnlyList<DietaryFlag>? flags = null)
    {
        using var content = BuildDishRequest(name, products, portionSize, category, photos, flags);

        var response = await _client.PostAsync("/api/dishes", content);
        response.EnsureSuccessStatusCode();
        var created = await response.Content.ReadFromJsonAsync<DishResponse>();
        Assert.NotNull(created);
        return created!;
    }

    private static MultipartFormDataContent BuildDishRequest(
        string name,
        IReadOnlyList<(Guid ProductId, float Amount)> products,
        float portionSize,
        DishCategory category,
        IReadOnlyList<string>? photos = null,
        IReadOnlyList<DietaryFlag>? flags = null)
    {
        var content = new MultipartFormDataContent
        {
            { CreateString(name), "Name" },
            { CreateString(portionSize), "PortionSize" },
            { CreateString((int)category), "Category" }
        };

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

        for (var index = 0; index < products.Count; index++)
        {
            content.Add(CreateString(products[index].ProductId), $"Products[{index}].ProductId");
            content.Add(CreateString(products[index].Amount), $"Products[{index}].Amount");
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
