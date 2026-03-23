using Cookbook.Domain.Enums;

namespace Cookbook.Contracts.Products;

public sealed class CreateProductRequest
{
    public string Name { get; set; } = string.Empty;

    public List<string>? Photos { get; set; }

    public float Calories { get; set; }

    public float Proteins { get; set; }

    public float Fats { get; set; }

    public float Carbs { get; set; }

    public string? Composition { get; set; }

    public ProductCategory Category { get; set; }

    public CookingType CookingType { get; set; }

    public HashSet<DietaryFlag>? Flags { get; set; }
}
