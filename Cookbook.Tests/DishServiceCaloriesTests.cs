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
/// Comments in this file mark which tests should be kept for the minimum assignment scope
/// and which ones are extra relative to the current TZ wording.
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
    
    // KEEP: minimal boundary-value test for the lower invalid boundary.
    /// <summary>
    /// Boundary value analysis:
    /// amount of 0 grams is invalid (lower closed boundary).
    /// This test should stay because calorie auto-calculation must reject non-positive ingredient amounts.
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

    // KEEP: minimal boundary-value test for data below the allowed lower boundary.
    /// <summary>
    /// Boundary value analysis:
    /// amount below zero is invalid (outside lower boundary).
    /// This test should stay because it checks the invalid equivalence class before calculation starts.
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

    // KEEP: minimal boundary-value test for the first valid value above zero.
    /// <summary>
    /// Boundary value analysis:
    /// minimum positive amount just above zero is valid.
    /// This test should stay because it proves that auto-calculation works on the valid side of the boundary.
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

    // KEEP: minimal equivalence-partitioning test for ordinary valid inputs.
    /// <summary>
    /// Equivalence partitioning:
    /// representative valid ingredient amounts should produce calories strictly by the formula from the TZ.
    /// This docstring was missing and should be kept because the assignment explicitly asks to document test design.
    /// </summary>
    [Theory]
    [MemberData(nameof(EquivalentValidAmounts))]
    public async Task CreateAsync_AutoCalories_UsesFormula_ForValidInputs(
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
    
    // KEEP: minimal equivalence-partitioning test for a valid zero-calorie product class.
    /// <summary>
    /// Equivalence partitioning:
    /// a product with zero calories is still a valid input class and must contribute 0 to the resulting dish calories.
    /// This docstring was missing and should be kept because it documents why this scenario belongs to the calculation suite.
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
    
    public static IEnumerable<object[]> EquivalentValidAmounts()
    {
        yield return [100f, 100f, 410f];
        yield return [50f, 150f, 265f];
        yield return [80f, 120f, 352f];
    }

    private static DishService CreateServiceWithProducts(params Product[] products)
    {
        var store = new InMemoryCookbookStore(products);
        return new DishService(store);
    }

    private CreateDishRequest CreateDishRequest(float oatsAmount, float milkAmount, float portionSize = 200f)
    {
        return new CreateDishRequest
        {
            Name = "Porridge",
            PortionSize = portionSize,
            Category = DishCategory.SecondCourse,
            Products =
            [
                new DishProductRequest { ProductId = _oats.Id, Amount = oatsAmount },
                new DishProductRequest { ProductId = _milk.Id, Amount = milkAmount }
            ]
        };
    }
}
