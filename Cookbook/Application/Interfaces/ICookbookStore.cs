using Cookbook.Domain.Models;

namespace Cookbook.Application.Interfaces;

public interface ICookbookStore
{
    Task<IReadOnlyList<Product>> GetProductsAsync(CancellationToken cancellationToken);

    Task<Product?> GetProductByIdAsync(Guid id, CancellationToken cancellationToken);

    Task<Product> AddProductAsync(Product product, CancellationToken cancellationToken);

    Task<Product?> UpdateProductAsync(Product product, CancellationToken cancellationToken);

    Task<bool> DeleteProductAsync(Guid id, CancellationToken cancellationToken);

    Task<IReadOnlyList<Dish>> GetDishesAsync(CancellationToken cancellationToken);

    Task<Dish?> GetDishByIdAsync(Guid id, CancellationToken cancellationToken);

    Task<Dish> AddDishAsync(Dish dish, CancellationToken cancellationToken);

    Task<Dish?> UpdateDishAsync(Dish dish, CancellationToken cancellationToken);

    Task<bool> DeleteDishAsync(Guid id, CancellationToken cancellationToken);

    Task<IReadOnlyList<Dish>> GetDishesByProductIdAsync(Guid productId, CancellationToken cancellationToken);
}
