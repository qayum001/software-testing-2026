using Cookbook.Domain.Enums;

namespace Cookbook.Contracts.Dishes;

public sealed class DishListQuery
{
    public DishCategory? Category { get; set; }

    public FlagFilterOption Vegan { get; set; } = FlagFilterOption.Any;

    public FlagFilterOption GlutenFree { get; set; } = FlagFilterOption.Any;

    public FlagFilterOption SugarFree { get; set; } = FlagFilterOption.Any;

    public string? Search { get; set; }
}
