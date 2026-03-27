using Cookbook.Application.Exceptions;
using Cookbook.Application.Interfaces;
using Cookbook.Contracts.Products;
using Cookbook.Domain.Enums;
using Cookbook.Domain.Models;

namespace Cookbook.Application.Services;

public sealed class ProductService(ICookbookStore store) : IProductService
{
    public async Task<ProductResponse> CreateAsync(CreateProductRequest request, CancellationToken cancellationToken)
    {
        var trimmedName = ValidateRequest(
            request.Name,
            request.Photos,
            request.Calories,
            request.Proteins,
            request.Fats,
            request.Carbs);

        var now = DateTimeOffset.UtcNow;
        var entity = new Product
        {
            Id = Guid.NewGuid(),
            Name = trimmedName,
            Photos = request.Photos ?? [],
            Calories = request.Calories,
            Proteins = request.Proteins,
            Fats = request.Fats,
            Carbs = request.Carbs,
            Composition = NormalizeOptionalText(request.Composition),
            Category = request.Category,
            CookingType = request.CookingType,
            Flags = request.Flags ?? [],
            CreatedAt = now,
            UpdatedAt = null
        };

        var created = await store.AddProductAsync(entity, cancellationToken);
        return Map(created);
    }

    public async Task<IReadOnlyList<ProductResponse>> GetAllAsync(ProductListQuery query, CancellationToken cancellationToken)
    {
        var products = await store.GetProductsAsync(cancellationToken);
        var filtered = ApplyFilters(products, query);
        var sorted = ApplySort(filtered, query.SortBy, query.SortDirection);
        return sorted.Select(Map).ToList();
    }

    public async Task<ProductResponse> GetByIdAsync(Guid id, CancellationToken cancellationToken)
    {
        var product = await store.GetProductByIdAsync(id, cancellationToken);
        if (product is null)
        {
            throw new EntityNotFoundException($"Product with id '{id}' was not found.");
        }

        return Map(product);
    }

    public async Task<ProductResponse> UpdateAsync(Guid id, UpdateProductRequest request, CancellationToken cancellationToken)
    {
        var trimmedName = ValidateRequest(
            request.Name,
            request.Photos,
            request.Calories,
            request.Proteins,
            request.Fats,
            request.Carbs);

        var existing = await store.GetProductByIdAsync(id, cancellationToken);
        if (existing is null)
        {
            throw new EntityNotFoundException($"Product with id '{id}' was not found.");
        }

        existing.Name = trimmedName;
        existing.Photos = request.Photos ?? [];
        existing.Calories = request.Calories;
        existing.Proteins = request.Proteins;
        existing.Fats = request.Fats;
        existing.Carbs = request.Carbs;
        existing.Composition = NormalizeOptionalText(request.Composition);
        existing.Category = request.Category;
        existing.CookingType = request.CookingType;
        existing.Flags = request.Flags ?? [];
        existing.UpdatedAt = DateTimeOffset.UtcNow;

        var updated = await store.UpdateProductAsync(existing, cancellationToken);
        if (updated is null)
        {
            throw new EntityNotFoundException($"Product with id '{id}' was not found.");
        }

        return Map(updated);
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        var product = await store.GetProductByIdAsync(id, cancellationToken);
        if (product is null)
        {
            throw new EntityNotFoundException($"Product with id '{id}' was not found.");
        }

        var usedInDishes = await store.GetDishesByProductIdAsync(id, cancellationToken);
        if (usedInDishes.Count > 0)
        {
            var response = new ProductDeletionBlockedResponse
            {
                Message = "Cannot delete product because it is used in dishes.",
                Dishes = usedInDishes.Select(d => new UsedInDishResponse { Id = d.Id, Name = d.Name }).ToList()
            };

            throw new BusinessConflictException(response.Message, response);
        }

        var deleted = await store.DeleteProductAsync(id, cancellationToken);
        if (!deleted)
        {
            throw new EntityNotFoundException($"Product with id '{id}' was not found.");
        }
    }

    private static IEnumerable<Product> ApplyFilters(IEnumerable<Product> products, ProductListQuery query)
    {
        var result = products;

        if (query.Category.HasValue)
        {
            result = result.Where(p => p.Category == query.Category.Value);
        }

        if (query.CookingType.HasValue)
        {
            result = result.Where(p => p.CookingType == query.CookingType.Value);
        }

        result = ApplyFlagFilter(result, DietaryFlag.Vegan, query.Vegan);
        result = ApplyFlagFilter(result, DietaryFlag.GlutenFree, query.GlutenFree);
        result = ApplyFlagFilter(result, DietaryFlag.SugarFree, query.SugarFree);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim();
            result = result.Where(p => p.Name.Contains(term, StringComparison.OrdinalIgnoreCase));
        }

        return result;
    }

    private static IEnumerable<Product> ApplySort(
        IEnumerable<Product> products,
        ProductSortField field,
        SortDirection direction)
    {
        return (field, direction) switch
        {
            (ProductSortField.Calories, SortDirection.Desc) => products.OrderByDescending(p => p.Calories).ThenBy(p => p.Name),
            (ProductSortField.Proteins, SortDirection.Desc) => products.OrderByDescending(p => p.Proteins).ThenBy(p => p.Name),
            (ProductSortField.Fats, SortDirection.Desc) => products.OrderByDescending(p => p.Fats).ThenBy(p => p.Name),
            (ProductSortField.Carbs, SortDirection.Desc) => products.OrderByDescending(p => p.Carbs).ThenBy(p => p.Name),
            (ProductSortField.Calories, _) => products.OrderBy(p => p.Calories).ThenBy(p => p.Name),
            (ProductSortField.Proteins, _) => products.OrderBy(p => p.Proteins).ThenBy(p => p.Name),
            (ProductSortField.Fats, _) => products.OrderBy(p => p.Fats).ThenBy(p => p.Name),
            (ProductSortField.Carbs, _) => products.OrderBy(p => p.Carbs).ThenBy(p => p.Name),
            (_, SortDirection.Desc) => products.OrderByDescending(p => p.Name),
            _ => products.OrderBy(p => p.Name)
        };
    }

    private static IEnumerable<Product> ApplyFlagFilter(
        IEnumerable<Product> products,
        DietaryFlag flag,
        FlagFilterOption filter)
    {
        return filter switch
        {
            FlagFilterOption.Yes => products.Where(p => p.Flags.Contains(flag)),
            FlagFilterOption.No => products.Where(p => !p.Flags.Contains(flag)),
            _ => products
        };
    }

    private static ProductResponse Map(Product product)
    {
        return new ProductResponse
        {
            Id = product.Id,
            Name = product.Name,
            Photos = product.Photos.ToList(),
            Calories = product.Calories,
            Proteins = product.Proteins,
            Fats = product.Fats,
            Carbs = product.Carbs,
            Composition = product.Composition,
            Category = product.Category,
            CookingType = product.CookingType,
            Flags = product.Flags.ToHashSet(),
            CreatedAt = product.CreatedAt,
            UpdatedAt = product.UpdatedAt
        };
    }

    private static string ValidateRequest(
        string? name,
        List<string>? photos,
        float calories,
        float proteins,
        float fats,
        float carbs)
    {
        var errors = new Dictionary<string, string[]>();
        var trimmedName = name?.Trim() ?? string.Empty;

        if (trimmedName.Length < 2)
        {
            errors["name"] = ["Product name must contain at least 2 characters."];
        }

        if (photos is { Count: > 5 })
        {
            errors["photos"] = ["The number of photos cannot be greater than 5."];
        }

        ValidateNutrition(errors, calories, proteins, fats, carbs);

        if (errors.Count > 0)
        {
            throw new ValidationException(errors);
        }

        return trimmedName;
    }

    private static void ValidateNutrition(Dictionary<string, string[]> errors, float calories, float proteins, float fats, float carbs)
    {
        ValidateCalories(errors, calories);
        ValidateMacronutrient(errors, "proteins", "Proteins", proteins);
        ValidateMacronutrient(errors, "fats", "Fats", fats);
        ValidateMacronutrient(errors, "carbs", "Carbs", carbs);

        if (float.IsFinite(proteins) &&
            float.IsFinite(fats) &&
            float.IsFinite(carbs) &&
            proteins + fats + carbs > 100f)
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
            errors[key] = [$"{displayName} cannot exceed 100 per 100 g."];
        }
    }

    private static string? NormalizeOptionalText(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        return value.Trim();
    }
}
