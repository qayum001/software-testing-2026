namespace Cookbook.Contracts.Products;

public sealed class ProductDeletionBlockedResponse
{
    public string Message { get; set; } = string.Empty;

    public List<UsedInDishResponse> Dishes { get; set; } = [];
}

public sealed class UsedInDishResponse
{
    public Guid Id { get; set; }

    public string Name { get; set; } = string.Empty;
}
