using Cookbook.Contracts.Dishes;

namespace Cookbook.Application.Interfaces;

public interface IDishService
{
    Task<DishResponse> CreateAsync(CreateDishRequest request, CancellationToken cancellationToken);

    Task<IReadOnlyList<DishResponse>> GetAllAsync(DishListQuery query, CancellationToken cancellationToken);

    Task<DishResponse> GetByIdAsync(Guid id, CancellationToken cancellationToken);

    Task<DishResponse> UpdateAsync(Guid id, UpdateDishRequest request, CancellationToken cancellationToken);

    Task DeleteAsync(Guid id, CancellationToken cancellationToken);
}
