using Cookbook.Contracts.Products;

namespace Cookbook.Application.Interfaces;

public interface IProductService
{
    Task<ProductResponse> CreateAsync(CreateProductRequest request, CancellationToken cancellationToken);

    Task<IReadOnlyList<ProductResponse>> GetAllAsync(ProductListQuery query, CancellationToken cancellationToken);

    Task<ProductResponse> GetByIdAsync(Guid id, CancellationToken cancellationToken);

    Task<ProductResponse> UpdateAsync(Guid id, UpdateProductRequest request, CancellationToken cancellationToken);

    Task DeleteAsync(Guid id, CancellationToken cancellationToken);
}
