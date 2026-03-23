namespace Cookbook.Contracts.Dishes;

public sealed class DishProductRequest
{
    public Guid ProductId { get; set; }

    public float Amount { get; set; }
}
