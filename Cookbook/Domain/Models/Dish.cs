using Cookbook.Domain.Enums;

namespace Cookbook.Domain.Models;

public sealed class Dish
{
    public Guid Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public List<string> Photos { get; set; } = [];

    public float Calories { get; set; }

    public float Proteins { get; set; }

    public float Fats { get; set; }

    public float Carbs { get; set; }

    public float PortionSize { get; set; }

    public DishCategory Category { get; set; }

    public HashSet<DietaryFlag> Flags { get; set; } = [];

    public List<DishProduct> Products { get; set; } = [];

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset? UpdatedAt { get; set; }
}
