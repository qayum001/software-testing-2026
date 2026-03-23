namespace Cookbook.Contracts.Dishes;

public sealed class DishProductResponse
{
    public Guid ProductId { get; set; }

    public string ProductName { get; set; } = string.Empty;

    public float Amount { get; set; }
}
