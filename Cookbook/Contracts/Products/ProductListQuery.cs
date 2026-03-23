using Cookbook.Domain.Enums;

namespace Cookbook.Contracts.Products;

public sealed class ProductListQuery
{
    public ProductCategory? Category { get; set; }

    public CookingType? CookingType { get; set; }

    public FlagFilterOption Vegan { get; set; } = FlagFilterOption.Any;

    public FlagFilterOption GlutenFree { get; set; } = FlagFilterOption.Any;

    public FlagFilterOption SugarFree { get; set; } = FlagFilterOption.Any;

    public string? Search { get; set; }

    public ProductSortField SortBy { get; set; } = ProductSortField.Name;

    public SortDirection SortDirection { get; set; } = SortDirection.Asc;
}
