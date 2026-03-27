using Cookbook.Domain.Enums;
namespace Cookbook.Contracts.Dishes;

public sealed class DishUpsertFormRequest
{
    public string Name { get; set; } = string.Empty;

    public List<string>? Photos { get; set; }

    public List<IFormFile>? PhotoFiles { get; set; }

    public float? Calories { get; set; }

    public float? Proteins { get; set; }

    public float? Fats { get; set; }

    public float? Carbs { get; set; }

    public List<DishProductRequest> Products { get; set; } = [];

    public float PortionSize { get; set; }

    public DishCategory? Category { get; set; }

    public HashSet<DietaryFlag>? Flags { get; set; }
}
