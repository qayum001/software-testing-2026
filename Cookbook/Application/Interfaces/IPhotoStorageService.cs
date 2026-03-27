namespace Cookbook.Application.Interfaces;

public interface IPhotoStorageService
{
    Task<string> SaveProductPhotoAsync(IFormFile file, CancellationToken cancellationToken);

    Task<string> SaveDishPhotoAsync(IFormFile file, CancellationToken cancellationToken);

    Task DeleteAsync(string path, CancellationToken cancellationToken);
}
