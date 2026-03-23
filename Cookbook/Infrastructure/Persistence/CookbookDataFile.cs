using Cookbook.Domain.Models;

namespace Cookbook.Infrastructure.Persistence;

public sealed class CookbookDataFile
{
    public List<Product> Products { get; set; } = [];

    public List<Dish> Dishes { get; set; } = [];
}
