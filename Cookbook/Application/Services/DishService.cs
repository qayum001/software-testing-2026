using System.Text.RegularExpressions;
using Cookbook.Application.Exceptions;
using Cookbook.Application.Interfaces;
using Cookbook.Contracts.Dishes;
using Cookbook.Domain.Enums;
using Cookbook.Domain.Models;

namespace Cookbook.Application.Services;

public sealed partial class DishService(ICookbookStore store) : IDishService
{
    private static readonly Dictionary<string, DishCategory> CategoryMacros = new(StringComparer.OrdinalIgnoreCase)
    {
        ["десерт"] = DishCategory.Dessert,
        ["первое"] = DishCategory.FirstCourse,
        ["второе"] = DishCategory.SecondCourse,
        ["напиток"] = DishCategory.Drink,
        ["салат"] = DishCategory.Salad,
        ["суп"] = DishCategory.Soup,
        ["перекус"] = DishCategory.Snack
    };

    public async Task<DishResponse> CreateAsync(CreateDishRequest request, CancellationToken cancellationToken)
    {
        var productsById = (await store.GetProductsAsync(cancellationToken)).ToDictionary(p => p.Id);
        var validationErrors = new Dictionary<string, string[]>();

        var parsedName = ParseNameMacro(request.Name);
        ValidateDishCommonFields(parsedName.CleanName, request.Photos, request.PortionSize, request.Products, validationErrors);
        ValidateComposition(request.Products, productsById, validationErrors);

        var effectiveCategory = request.Category ?? parsedName.MacroCategory;
        var categoryValue = effectiveCategory.GetValueOrDefault();
        if (!effectiveCategory.HasValue)
        {
            validationErrors["category"] = ["Dish category is required when name has no category macro."];
        }

        var normalizedProducts = NormalizeProducts(request.Products);
        var autoNutrition = CalculateNutrition(normalizedProducts, productsById);
        var finalNutrition = ResolveFinalNutrition(
            request.Calories,
            request.Proteins,
            request.Fats,
            request.Carbs,
            autoNutrition,
            request.PortionSize,
            validationErrors);

        if (validationErrors.Count > 0)
        {
            throw new ValidationException(validationErrors);
        }

        var availableFlags = GetAvailableFlags(normalizedProducts, productsById);
        var normalizedFlags = NormalizeDishFlags(request.Flags, availableFlags);
        var now = DateTimeOffset.UtcNow;

        var entity = new Dish
        {
            Id = Guid.NewGuid(),
            Name = parsedName.CleanName,
            Photos = request.Photos ?? [],
            Calories = finalNutrition.Calories,
            Proteins = finalNutrition.Proteins,
            Fats = finalNutrition.Fats,
            Carbs = finalNutrition.Carbs,
            PortionSize = request.PortionSize,
            Category = categoryValue,
            Flags = normalizedFlags,
            Products = normalizedProducts,
            CreatedAt = now,
            UpdatedAt = null
        };

        var created = await store.AddDishAsync(entity, cancellationToken);
        return Map(created, productsById);
    }

    public async Task<IReadOnlyList<DishResponse>> GetAllAsync(DishListQuery query, CancellationToken cancellationToken)
    {
        var dishes = await store.GetDishesAsync(cancellationToken);
        var products = await store.GetProductsAsync(cancellationToken);
        var productsById = products.ToDictionary(p => p.Id);

        var filtered = dishes.AsEnumerable();
        if (query.Category.HasValue)
        {
            filtered = filtered.Where(d => d.Category == query.Category.Value);
        }

        filtered = ApplyFlagFilter(filtered, DietaryFlag.Vegan, query.Vegan);
        filtered = ApplyFlagFilter(filtered, DietaryFlag.GlutenFree, query.GlutenFree);
        filtered = ApplyFlagFilter(filtered, DietaryFlag.SugarFree, query.SugarFree);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim();
            filtered = filtered.Where(d => d.Name.Contains(term, StringComparison.OrdinalIgnoreCase));
        }

        return filtered
            .OrderBy(d => d.Name)
            .Select(d => Map(d, productsById))
            .ToList();
    }

    public async Task<DishResponse> GetByIdAsync(Guid id, CancellationToken cancellationToken)
    {
        var dish = await store.GetDishByIdAsync(id, cancellationToken);
        if (dish is null)
        {
            throw new EntityNotFoundException($"Dish with id '{id}' was not found.");
        }

        var products = await store.GetProductsAsync(cancellationToken);
        var productsById = products.ToDictionary(p => p.Id);
        return Map(dish, productsById);
    }

    public async Task<DishResponse> UpdateAsync(Guid id, UpdateDishRequest request, CancellationToken cancellationToken)
    {
        var existing = await store.GetDishByIdAsync(id, cancellationToken);
        if (existing is null)
        {
            throw new EntityNotFoundException($"Dish with id '{id}' was not found.");
        }

        var productsById = (await store.GetProductsAsync(cancellationToken)).ToDictionary(p => p.Id);
        var validationErrors = new Dictionary<string, string[]>();

        var parsedName = ParseNameMacro(request.Name);
        ValidateDishCommonFields(parsedName.CleanName, request.Photos, request.PortionSize, request.Products, validationErrors);
        ValidateComposition(request.Products, productsById, validationErrors);

        var effectiveCategory = request.Category ?? parsedName.MacroCategory;
        var categoryValue = effectiveCategory.GetValueOrDefault();
        if (!effectiveCategory.HasValue)
        {
            validationErrors["category"] = ["Dish category is required when name has no category macro."];
        }

        var normalizedProducts = NormalizeProducts(request.Products);
        var autoNutrition = CalculateNutrition(normalizedProducts, productsById);
        var finalNutrition = ResolveFinalNutrition(
            request.Calories,
            request.Proteins,
            request.Fats,
            request.Carbs,
            autoNutrition,
            request.PortionSize,
            validationErrors);

        if (validationErrors.Count > 0)
        {
            throw new ValidationException(validationErrors);
        }

        var availableFlags = GetAvailableFlags(normalizedProducts, productsById);
        var normalizedFlags = NormalizeDishFlags(request.Flags, availableFlags);

        existing.Name = parsedName.CleanName;
        existing.Photos = request.Photos ?? [];
        existing.Calories = finalNutrition.Calories;
        existing.Proteins = finalNutrition.Proteins;
        existing.Fats = finalNutrition.Fats;
        existing.Carbs = finalNutrition.Carbs;
        existing.PortionSize = request.PortionSize;
        existing.Category = categoryValue;
        existing.Flags = normalizedFlags;
        existing.Products = normalizedProducts;
        existing.UpdatedAt = DateTimeOffset.UtcNow;

        var updated = await store.UpdateDishAsync(existing, cancellationToken);
        if (updated is null)
        {
            throw new EntityNotFoundException($"Dish with id '{id}' was not found.");
        }

        return Map(updated, productsById);
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        var deleted = await store.DeleteDishAsync(id, cancellationToken);
        if (!deleted)
        {
            throw new EntityNotFoundException($"Dish with id '{id}' was not found.");
        }
    }

    private static ParsedName ParseNameMacro(string? name)
    {
        var source = name ?? string.Empty;
        var match = MacroRegex().Match(source);
        if (!match.Success)
        {
            return new ParsedName(source.Trim(), null);
        }

        var macroToken = match.Groups[1].Value;
        var cleanedName = source.Remove(match.Index, match.Length);
        cleanedName = ExtraSpacesRegex().Replace(cleanedName, " ").Trim();

        return CategoryMacros.TryGetValue(macroToken, out var category)
            ? new ParsedName(cleanedName, category)
            : new ParsedName(cleanedName, null);
    }

    private static void ValidateDishCommonFields(
        string cleanName,
        List<string>? photos,
        float portionSize,
        List<DishProductRequest>? products,
        Dictionary<string, string[]> errors)
    {
        if ((cleanName ?? string.Empty).Trim().Length < 2)
        {
            errors["name"] = ["Dish name must contain at least 2 characters."];
        }

        if (photos is { Count: > 5 })
        {
            errors["photos"] = ["Photos count cannot be greater than 5."];
        }

        if (!float.IsFinite(portionSize))
        {
            errors["portionSize"] = ["Portion size must be a finite number."];
        }
        else if (portionSize <= 0)
        {
            errors["portionSize"] = ["Portion size must be greater than 0."];
        }

        if (products is null || products.Count == 0)
        {
            errors["products"] = ["Dish must contain at least 1 product."];
        }
    }

    private static void ValidateComposition(
        List<DishProductRequest>? products,
        IReadOnlyDictionary<Guid, Product> productsById,
        Dictionary<string, string[]> errors)
    {
        if (products is null || products.Count == 0)
        {
            return;
        }

        if (products.Any(item => !float.IsFinite(item.Amount) || item.Amount <= 0))
        {
            errors["products.amount"] = ["Each product amount must be a finite number greater than 0 grams."];
        }

        var missingProducts = products
            .Select(item => item.ProductId)
            .Distinct()
            .Where(id => !productsById.ContainsKey(id))
            .ToList();

        if (missingProducts.Count > 0)
        {
            errors["products.productId"] = [$"Missing products: {string.Join(", ", missingProducts)}."];
        }
    }

    private static List<DishProduct> NormalizeProducts(IEnumerable<DishProductRequest> source)
    {
        return source
            .GroupBy(item => item.ProductId)
            .Select(group => new DishProduct
            {
                ProductId = group.Key,
                Amount = MathF.Round(group.Sum(item => item.Amount), 3)
            })
            .ToList();
    }

    private static NutritionValues ResolveFinalNutrition(
        float? calories,
        float? proteins,
        float? fats,
        float? carbs,
        NutritionValues autoNutrition,
        float portionSize,
        Dictionary<string, string[]> errors)
    {
        var result = new NutritionValues
        {
            Calories = autoNutrition.Calories,
            Proteins = autoNutrition.Proteins,
            Fats = autoNutrition.Fats,
            Carbs = autoNutrition.Carbs
        };

        if (calories.HasValue)
        {
            result.Calories = MathF.Round(calories.Value, 2);
        }

        if (proteins.HasValue)
        {
            result.Proteins = MathF.Round(proteins.Value, 2);
        }

        if (fats.HasValue)
        {
            result.Fats = MathF.Round(fats.Value, 2);
        }

        if (carbs.HasValue)
        {
            result.Carbs = MathF.Round(carbs.Value, 2);
        }

        ValidateFinalNutrition(result, portionSize, errors);
        return result;
    }

    private static void ValidateFinalNutrition(
        NutritionValues nutrition,
        float portionSize,
        Dictionary<string, string[]> errors)
    {
        ValidateCalories(errors, nutrition.Calories);
        ValidateMacronutrient(errors, "proteins", "Proteins", nutrition.Proteins);
        ValidateMacronutrient(errors, "fats", "Fats", nutrition.Fats);
        ValidateMacronutrient(errors, "carbs", "Carbs", nutrition.Carbs);

        if (float.IsFinite(portionSize) &&
            portionSize > 0 &&
            float.IsFinite(nutrition.Proteins) &&
            float.IsFinite(nutrition.Fats) &&
            float.IsFinite(nutrition.Carbs) &&
            (nutrition.Proteins + nutrition.Fats + nutrition.Carbs) / portionSize * 100f > 100f)
        {
            errors["nutrition"] = ["The sum of proteins, fats, and carbs per 100 g cannot exceed 100."];
        }
    }

    private static void ValidateCalories(Dictionary<string, string[]> errors, float calories)
    {
        if (!float.IsFinite(calories))
        {
            errors["calories"] = ["Calories must be a finite number."];
            return;
        }

        if (calories < 0)
        {
            errors["calories"] = ["Calories cannot be negative."];
        }
    }

    private static void ValidateMacronutrient(
        Dictionary<string, string[]> errors,
        string key,
        string displayName,
        float value)
    {
        if (!float.IsFinite(value))
        {
            errors[key] = [$"{displayName} must be a finite number."];
            return;
        }

        if (value < 0)
        {
            errors[key] = [$"{displayName} cannot be negative."];
            return;
        }

        if (value > 100f)
        {
            errors[key] = [$"{displayName} cannot exceed 100 per portion."];
        }
    }

    private static NutritionValues CalculateNutrition(
        IEnumerable<DishProduct> dishProducts,
        IReadOnlyDictionary<Guid, Product> productsById)
    {
        float calories = 0;
        float proteins = 0;
        float fats = 0;
        float carbs = 0;

        foreach (var dishProduct in dishProducts)
        {
            if (!productsById.TryGetValue(dishProduct.ProductId, out var product))
            {
                continue;
            }

            var factor = dishProduct.Amount / 100f;
            calories += product.Calories * factor;
            proteins += product.Proteins * factor;
            fats += product.Fats * factor;
            carbs += product.Carbs * factor;
        }

        return new NutritionValues
        {
            Calories = MathF.Round(calories, 2),
            Proteins = MathF.Round(proteins, 2),
            Fats = MathF.Round(fats, 2),
            Carbs = MathF.Round(carbs, 2)
        };
    }

    private static HashSet<DietaryFlag> GetAvailableFlags(
        IReadOnlyCollection<DishProduct> dishProducts,
        IReadOnlyDictionary<Guid, Product> productsById)
    {
        if (dishProducts.Count == 0)
        {
            return [];
        }

        HashSet<DietaryFlag>? intersection = null;
        foreach (var dishProduct in dishProducts)
        {
            if (!productsById.TryGetValue(dishProduct.ProductId, out var product))
            {
                return [];
            }

            if (intersection is null)
            {
                intersection = product.Flags.ToHashSet();
                continue;
            }

            intersection.IntersectWith(product.Flags);
        }

        return intersection ?? [];
    }

    private static HashSet<DietaryFlag> NormalizeDishFlags(
        HashSet<DietaryFlag>? requestedFlags,
        HashSet<DietaryFlag> availableFlags)
    {
        if (requestedFlags is null || requestedFlags.Count == 0)
        {
            return [];
        }

        requestedFlags.IntersectWith(availableFlags);
        return requestedFlags;
    }

    private static IEnumerable<Dish> ApplyFlagFilter(
        IEnumerable<Dish> dishes,
        DietaryFlag flag,
        FlagFilterOption filter)
    {
        return filter switch
        {
            FlagFilterOption.Yes => dishes.Where(d => d.Flags.Contains(flag)),
            FlagFilterOption.No => dishes.Where(d => !d.Flags.Contains(flag)),
            _ => dishes
        };
    }

    private static DishResponse Map(Dish dish, IReadOnlyDictionary<Guid, Product> productsById)
    {
        var autoNutrition = CalculateNutrition(dish.Products, productsById);
        var availableFlags = GetAvailableFlags(dish.Products, productsById);
        var normalizedFlags = dish.Flags.Intersect(availableFlags).ToHashSet();

        return new DishResponse
        {
            Id = dish.Id,
            Name = dish.Name,
            Photos = dish.Photos.ToList(),
            Calories = dish.Calories,
            Proteins = dish.Proteins,
            Fats = dish.Fats,
            Carbs = dish.Carbs,
            AutoCalculatedNutrition = new NutritionResponse
            {
                Calories = autoNutrition.Calories,
                Proteins = autoNutrition.Proteins,
                Fats = autoNutrition.Fats,
                Carbs = autoNutrition.Carbs
            },
            PortionSize = dish.PortionSize,
            Category = dish.Category,
            Flags = normalizedFlags,
            AvailableFlags = availableFlags,
            Products = dish.Products.Select(item => new DishProductResponse
            {
                ProductId = item.ProductId,
                ProductName = productsById.TryGetValue(item.ProductId, out var product)
                    ? product.Name
                    : "[unknown]",
                Amount = item.Amount
            }).ToList(),
            CreatedAt = dish.CreatedAt,
            UpdatedAt = dish.UpdatedAt
        };
    }

    [GeneratedRegex(@"!(десерт|первое|второе|напиток|салат|суп|перекус)", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex MacroRegex();

    [GeneratedRegex(@"\s{2,}")]
    private static partial Regex ExtraSpacesRegex();

    private sealed record ParsedName(string CleanName, DishCategory? MacroCategory);
}
