using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Cookbook.Contracts.Dishes;
using Cookbook.Domain.Enums;
using Cookbook.Domain.Models;
using Cookbook.Tests.Support;
using Xunit;

namespace Cookbook.Tests;

public sealed class DishesApiCaloriesTests : IAsyncLifetime
{
    private CookbookApiFactory _factory = null!;
    private HttpClient _client = null!;
    private Guid _oatsId;
    private Guid _milkId;
    private Guid _waterId;

    public Task InitializeAsync()
    {
        _oatsId = Guid.NewGuid();
        _milkId = Guid.NewGuid();
        _waterId = Guid.NewGuid();

        var oats = new Product
        {
            Id = _oatsId,
            Name = "Oats",
            Calories = 350f,
            Proteins = 12f,
            Fats = 7f,
            Carbs = 60f,
            Category = ProductCategory.Grains,
            CookingType = CookingType.RequiresCooking
        };

        var milk = new Product
        {
            Id = _milkId,
            Name = "Milk",
            Calories = 60f,
            Proteins = 3f,
            Fats = 3f,
            Carbs = 5f,
            Category = ProductCategory.Liquid,
            CookingType = CookingType.ReadyToEat
        };

        var water = new Product
        {
            Id = _waterId,
            Name = "Water",
            Calories = 0f,
            Proteins = 0f,
            Fats = 0f,
            Carbs = 0f,
            Category = ProductCategory.Liquid,
            CookingType = CookingType.ReadyToEat
        };

        _factory = new CookbookApiFactory([oats, milk, water]);
        _client = _factory.CreateClient();
        return Task.CompletedTask;
    }

    public Task DisposeAsync()
    {
        _client.Dispose();
        _factory.Dispose();
        return Task.CompletedTask;
    }

    /// <summary>
    /// Boundary value analysis:
    /// amount of 0 grams is invalid (lower closed boundary).
    /// </summary>
    [Fact]
    public async Task CreateDish_AutoCalories_ReturnsBadRequest_WhenAmountIsZero()
    {
        using var content = BuildDishRequest([(_oatsId, 0f), (_milkId, 100f)]);

        var response = await _client.PostAsync("/api/dishes", content);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var errorKeys = await ReadValidationErrorKeysAsync(response);
        Assert.Contains("products.amount", errorKeys);
    }

    /// <summary>
    /// Boundary value analysis:
    /// amount below zero is invalid (outside lower boundary).
    /// </summary>
    [Fact]
    public async Task CreateDish_AutoCalories_ReturnsBadRequest_WhenAmountIsNegative()
    {
        using var content = BuildDishRequest([(_oatsId, -0.01f), (_milkId, 100f)]);

        var response = await _client.PostAsync("/api/dishes", content);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var errorKeys = await ReadValidationErrorKeysAsync(response);
        Assert.Contains("products.amount", errorKeys);
    }

    /// <summary>
    /// Boundary value analysis:
    /// minimum positive amount just above zero is valid.
    /// </summary>
    [Fact]
    public async Task CreateDish_AutoCalories_Calculates_WhenAmountIsMinimumPositive()
    {
        using var content = BuildDishRequest([(_oatsId, 0.01f), (_milkId, 100f)]);

        var response = await _client.PostAsync("/api/dishes", content);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<DishResponse>();
        Assert.NotNull(body);

        var expected = MathF.Round(350f * 0.01f / 100f + 60f * 100f / 100f, 2);
        Assert.Equal(expected, body!.Calories, 2);
        Assert.Equal(expected, body.AutoCalculatedNutrition.Calories, 2);
    }

    /// <summary>
    /// Equivalence partitioning:
    /// representative valid ingredient amounts should produce calories strictly by the formula from the requirements.
    /// </summary>
    [Theory]
    [MemberData(nameof(EquivalentValidAmounts))]
    public async Task CreateDish_AutoCalories_UsesFormula_ForValidInputs(
        float oatsAmount,
        float milkAmount,
        float expectedCalories)
    {
        using var content = BuildDishRequest([(_oatsId, oatsAmount), (_milkId, milkAmount)]);

        var response = await _client.PostAsync("/api/dishes", content);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<DishResponse>();
        Assert.NotNull(body);
        Assert.Equal(expectedCalories, body!.Calories, 2);
        Assert.Equal(expectedCalories, body.AutoCalculatedNutrition.Calories, 2);
    }

    /// <summary>
    /// Equivalence partitioning:
    /// extremely large but finite amounts are accepted as input values, yet violate nutrition constraints
    /// or overflow intermediate auto-calculations and therefore return validation errors.
    /// </summary>
    [Theory]
    [MemberData(nameof(EquivalentAmountsWithPositiveInfinities))]
    public async Task CreateDish_AutoCalories_ReturnsBadRequest_ForMaxValueInputs(
        float oatsAmount,
        float milkAmount)
    {
        using var content = BuildDishRequest([(_oatsId, oatsAmount), (_milkId, milkAmount)]);

        var response = await _client.PostAsync("/api/dishes", content);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    /// <summary>
    /// Equivalence partitioning:
    /// a product with zero calories is still a valid input class and must contribute 0 to resulting dish calories.
    /// </summary>
    [Fact]
    public async Task CreateDish_AutoCalories_HandlesZeroCaloriesProduct()
    {
        using var content = BuildDishRequest(
            [(_waterId, 200f)],
            portionSize: 200f,
            category: DishCategory.Drink,
            name: "Water dish");

        var response = await _client.PostAsync("/api/dishes", content);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<DishResponse>();
        Assert.NotNull(body);
        Assert.Equal(0f, body!.Calories, 2);
        Assert.Equal(0f, body.AutoCalculatedNutrition.Calories, 2);
    }
    
    public static IEnumerable<object[]> EquivalentValidAmounts()
    {
        yield return [100f, 100f, 410f];
        yield return [50f, 150f, 265f];
        yield return [80f, 120f, 352f];
    }

    public static IEnumerable<object[]> EquivalentAmountsWithPositiveInfinities()
    {
        yield return [float.PositiveInfinity, 100f];
        yield return [50f, float.PositiveInfinity];
        yield return [float.PositiveInfinity, float.PositiveInfinity];
    }

    private static MultipartFormDataContent BuildDishRequest(
        IReadOnlyList<(Guid ProductId, float Amount)> products,
        float portionSize = 200f,
        DishCategory? category = DishCategory.SecondCourse,
        string name = "Porridge")
    {
        var content = new MultipartFormDataContent
        {
            { CreateString(name), "Name" },
            { CreateString(portionSize), "PortionSize" }
        };

        if (category.HasValue)
        {
            content.Add(CreateString((int)category.Value), "Category");
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

    private static async Task<IReadOnlySet<string>> ReadValidationErrorKeysAsync(HttpResponseMessage response)
    {
        var payload = await response.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(payload);
        if (!document.RootElement.TryGetProperty("errors", out var errorsNode))
        {
            return new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        }

        return errorsNode
            .EnumerateObject()
            .Select(x => x.Name)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
    }
}
