using Cookbook.Application.Interfaces;
using Cookbook.Domain.Models;

namespace Cookbook.Tests.Support;

internal sealed class InMemoryCookbookStore : ICookbookStore
{
    private readonly List<Product> _products = [];
    private readonly List<Dish> _dishes = [];

    public InMemoryCookbookStore(IEnumerable<Product>? products = null, IEnumerable<Dish>? dishes = null)
    {
        if (products is not null)
        {
            _products.AddRange(products.Select(CloneProduct));
        }

        if (dishes is not null)
        {
            _dishes.AddRange(dishes.Select(CloneDish));
        }
    }

    public Task<IReadOnlyList<Product>> GetProductsAsync(CancellationToken cancellationToken)
        => Task.FromResult<IReadOnlyList<Product>>(_products.Select(CloneProduct).ToList());

    public Task<Product?> GetProductByIdAsync(Guid id, CancellationToken cancellationToken)
        => Task.FromResult(_products.Where(p => p.Id == id).Select(CloneProduct).SingleOrDefault());

    public Task<Product> AddProductAsync(Product product, CancellationToken cancellationToken)
    {
        var copy = CloneProduct(product);
        _products.Add(copy);
        return Task.FromResult(CloneProduct(copy));
    }

    public Task<Product?> UpdateProductAsync(Product product, CancellationToken cancellationToken)
    {
        var index = _products.FindIndex(p => p.Id == product.Id);
        if (index < 0)
        {
            return Task.FromResult<Product?>(null);
        }

        var copy = CloneProduct(product);
        _products[index] = copy;
        return Task.FromResult<Product?>(CloneProduct(copy));
    }

    public Task<bool> DeleteProductAsync(Guid id, CancellationToken cancellationToken)
    {
        var removed = _products.RemoveAll(p => p.Id == id) > 0;
        return Task.FromResult(removed);
    }

    public Task<IReadOnlyList<Dish>> GetDishesAsync(CancellationToken cancellationToken)
        => Task.FromResult<IReadOnlyList<Dish>>(_dishes.Select(CloneDish).ToList());

    public Task<Dish?> GetDishByIdAsync(Guid id, CancellationToken cancellationToken)
        => Task.FromResult(_dishes.Where(d => d.Id == id).Select(CloneDish).SingleOrDefault());

    public Task<Dish> AddDishAsync(Dish dish, CancellationToken cancellationToken)
    {
        var copy = CloneDish(dish);
        _dishes.Add(copy);
        return Task.FromResult(CloneDish(copy));
    }

    public Task<Dish?> UpdateDishAsync(Dish dish, CancellationToken cancellationToken)
    {
        var index = _dishes.FindIndex(d => d.Id == dish.Id);
        if (index < 0)
        {
            return Task.FromResult<Dish?>(null);
        }

        var copy = CloneDish(dish);
        _dishes[index] = copy;
        return Task.FromResult<Dish?>(CloneDish(copy));
    }

    public Task<bool> DeleteDishAsync(Guid id, CancellationToken cancellationToken)
    {
        var removed = _dishes.RemoveAll(d => d.Id == id) > 0;
        return Task.FromResult(removed);
    }

    public Task<IReadOnlyList<Dish>> GetDishesByProductIdAsync(Guid productId, CancellationToken cancellationToken)
    {
        var result = _dishes
            .Where(d => d.Products.Any(p => p.ProductId == productId))
            .Select(CloneDish)
            .ToList();

        return Task.FromResult<IReadOnlyList<Dish>>(result);
    }

    private static Product CloneProduct(Product source)
    {
        return new Product
        {
            Id = source.Id,
            Name = source.Name,
            Photos = source.Photos.ToList(),
            Calories = source.Calories,
            Proteins = source.Proteins,
            Fats = source.Fats,
            Carbs = source.Carbs,
            Composition = source.Composition,
            Category = source.Category,
            CookingType = source.CookingType,
            Flags = source.Flags.ToHashSet(),
            CreatedAt = source.CreatedAt,
            UpdatedAt = source.UpdatedAt
        };
    }

    private static Dish CloneDish(Dish source)
    {
        return new Dish
        {
            Id = source.Id,
            Name = source.Name,
            Photos = source.Photos.ToList(),
            Calories = source.Calories,
            Proteins = source.Proteins,
            Fats = source.Fats,
            Carbs = source.Carbs,
            PortionSize = source.PortionSize,
            Category = source.Category,
            Flags = source.Flags.ToHashSet(),
            Products = source.Products
                .Select(x => new DishProduct { ProductId = x.ProductId, Amount = x.Amount })
                .ToList(),
            CreatedAt = source.CreatedAt,
            UpdatedAt = source.UpdatedAt
        };
    }
}
