using Cookbook.Application.Exceptions;
using Cookbook.Application.Services;
using Cookbook.Contracts.Dishes;
using Cookbook.Domain.Enums;
using Cookbook.Domain.Models;
using Cookbook.Tests.Support;
using Xunit;

namespace Cookbook.Tests;

/// <summary>
/// Unit-tests for automatic dish calories calculation.
/// Test data is generated via equivalence partitioning and boundary value analysis.
/// </summary>
public sealed class DishServiceCaloriesTests
{
    private readonly Product _oats = new()
    {
        Id = Guid.NewGuid(),
        Name = "Oats",
        Calories = 350f,
        Proteins = 12f,
        Fats = 7f,
        Carbs = 60f,
        Category = ProductCategory.Grains,
        CookingType = CookingType.RequiresCooking
    };
    private readonly Product _milk = new()
    {
        Id = Guid.NewGuid(),
        Name = "Milk",
        Calories = 60f,
        Proteins = 3f,
        Fats = 3f,
        Carbs = 5f,
        Category = ProductCategory.Liquid,
        CookingType = CookingType.ReadyToEat
    };

    /// <summary>
    /// Equivalence partitioning:
    /// valid positive gram amounts should always produce formula-based calories.
    /// </summary>
    [Theory]
    [MemberData(nameof(EquivalentValidAmounts))]
    public async Task CreateAsync_AutoCalories_UsesFormula_ForEquivalentValidInputs(
        float oatsAmount,
        float milkAmount,
        float expectedCalories)
    {
        var service = CreateServiceWithProducts(_oats, _milk);
        var request = CreateDishRequest(oatsAmount, milkAmount);

        var dish = await service.CreateAsync(request, CancellationToken.None);

        Assert.Equal(expectedCalories, dish.Calories, 2);
        Assert.Equal(expectedCalories, dish.AutoCalculatedNutrition.Calories, 2);
    }

    /// <summary>
    /// Boundary value analysis:
    /// amount of 0 grams is invalid (lower closed boundary).
    /// </summary>
    [Fact]
    public async Task CreateAsync_AutoCalories_ThrowsValidation_WhenAmountIsZero()
    {
        var service = CreateServiceWithProducts(_oats, _milk);
        var request = CreateDishRequest(0f, 100f);

        var exception = await Assert.ThrowsAsync<ValidationException>(() => 
            service.CreateAsync(request, CancellationToken.None));

        Assert.Contains("products.amount", exception.Errors.Keys);
    }

    /// <summary>
    /// Boundary value analysis:
    /// amount below zero is invalid (outside lower boundary).
    /// </summary>
    [Fact]
    public async Task CreateAsync_AutoCalories_ThrowsValidation_WhenAmountIsNegative()
    {
        var service = CreateServiceWithProducts(_oats, _milk);
        var request = CreateDishRequest(-0.01f, 100f);

        var exception = await Assert.ThrowsAsync<ValidationException>(() => 
            service.CreateAsync(request, CancellationToken.None));

        Assert.Contains("products.amount", exception.Errors.Keys);
    }

    /// <summary>
    /// Boundary value analysis:
    /// minimum positive amount just above zero is valid.
    /// </summary>
    [Fact]
    public async Task CreateAsync_AutoCalories_Calculates_WhenAmountIsMinimumPositive()
    {
        var service = CreateServiceWithProducts(_oats, _milk);
        var request = CreateDishRequest(0.01f, 100f);

        var dish = await service.CreateAsync(request, CancellationToken.None);

        var expected = MathF.Round(350f * 0.01f / 100f + 60f * 100f / 100f, 2);
        Assert.Equal(expected, dish.Calories, 2);
    }

    /// <summary>
    /// Boundary value analysis:
    /// product with 0 calories should not contribute to resulting calories.
    /// </summary>
    [Fact]
    public async Task CreateAsync_AutoCalories_HandlesZeroCaloriesProduct()
    {
        var zeroCaloriesProduct = new Product
        {
            Id = Guid.NewGuid(),
            Name = "Water",
            Calories = 0f,
            Proteins = 0f,
            Fats = 0f,
            Carbs = 0f,
            Category = ProductCategory.Liquid,
            CookingType = CookingType.ReadyToEat
        };

        var service = CreateServiceWithProducts(zeroCaloriesProduct);
        var request = new CreateDishRequest
        {
            Name = "Water dish",
            PortionSize = 200f,
            Category = DishCategory.Drink,
            Products =
            [
                new DishProductRequest { ProductId = zeroCaloriesProduct.Id, Amount = 200f }
            ]
        };

        var dish = await service.CreateAsync(request, CancellationToken.None);

        Assert.Equal(0f, dish.Calories, 2);
    }

    /// <summary>
    /// Boundary value analysis:
    /// at least one product is required.
    /// </summary>
    [Fact]
    public async Task CreateAsync_AutoCalories_ThrowsValidation_WhenNoProductsProvided()
    {
        var service = CreateServiceWithProducts(_oats);
        var request = new CreateDishRequest
        {
            Name = "Empty dish",
            PortionSize = 250f,
            Category = DishCategory.SecondCourse,
            Products = []
        };

        var exception = await Assert.ThrowsAsync<ValidationException>(() =>
            service.CreateAsync(request, CancellationToken.None));

        Assert.Contains("products", exception.Errors.Keys);
    }

    public static IEnumerable<object[]> EquivalentValidAmounts()
    {
        yield return [100f, 100f, 410f];
        yield return [50f, 150f, 265f];
        yield return [200f, 50f, 730f];
    }

    private static DishService CreateServiceWithProducts(params Product[] products)
    {
        var store = new InMemoryCookbookStore(products);
        return new DishService(store);
    }

    private CreateDishRequest CreateDishRequest(float oatsAmount, float milkAmount)
    {
        return new CreateDishRequest
        {
            Name = "Porridge",
            PortionSize = 200f,
            Category = DishCategory.SecondCourse,
            Products =
            [
                new DishProductRequest { ProductId = _oats.Id, Amount = oatsAmount },
                new DishProductRequest { ProductId = _milk.Id, Amount = milkAmount }
            ]
        };
    }
}
