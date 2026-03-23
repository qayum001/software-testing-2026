using Cookbook.Domain.Enums;

namespace Cookbook.Contracts.Dishes;

public sealed class DishResponse
{
    public Guid Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public List<string> Photos { get; set; } = [];

    public float Calories { get; set; }

    public float Proteins { get; set; }

    public float Fats { get; set; }

    public float Carbs { get; set; }

    public NutritionResponse AutoCalculatedNutrition { get; set; } = new();

    public float PortionSize { get; set; }

    public DishCategory Category { get; set; }

    public HashSet<DietaryFlag> Flags { get; set; } = [];

    public HashSet<DietaryFlag> AvailableFlags { get; set; } = [];

    public List<DishProductResponse> Products { get; set; } = [];

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset? UpdatedAt { get; set; }
}
