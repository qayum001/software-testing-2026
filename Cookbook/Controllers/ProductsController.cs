using Cookbook.Application.Exceptions;
using Cookbook.Application.Interfaces;
using Cookbook.Contracts.Products;
using Microsoft.AspNetCore.Mvc;

namespace Cookbook.Controllers;

[ApiController]
[Route("api/products")]
public sealed class ProductsController(
    IProductService service,
    IPhotoStorageService photoStorageService) : ControllerBase
{
    [HttpPost]
    [Consumes("multipart/form-data")]
    [ProducesResponseType<ProductResponse>(StatusCodes.Status201Created)]
    public async Task<ActionResult<ProductResponse>> Create(
        [FromForm] ProductUpsertFormRequest request,
        CancellationToken cancellationToken)
    {
        var uploadedPaths = await SavePhotoFilesAsync(request.PhotoFiles, cancellationToken);

        try
        {
            var created = await service.CreateAsync(MapRequest(request, uploadedPaths), cancellationToken);
            return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
        }
        catch
        {
            await DeleteUploadedPhotosAsync(uploadedPaths, cancellationToken);
            throw;
        }
    }

    [HttpGet]
    [ProducesResponseType<IReadOnlyList<ProductResponse>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<ProductResponse>>> GetAll(
        [FromQuery] ProductListQuery query,
        CancellationToken cancellationToken)
    {
        var products = await service.GetAllAsync(query, cancellationToken);
        return Ok(products);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType<ProductResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ProductResponse>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var product = await service.GetByIdAsync(id, cancellationToken);
        return Ok(product);
    }

    [HttpPut("{id:guid}")]
    [Consumes("multipart/form-data")]
    [ProducesResponseType<ProductResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ProductResponse>> Update(
        Guid id,
        [FromForm] ProductUpsertFormRequest request,
        CancellationToken cancellationToken)
    {
        var existing = await service.GetByIdAsync(id, cancellationToken);
        var uploadedPaths = await SavePhotoFilesAsync(request.PhotoFiles, cancellationToken);
        var targetPhotos = MergePhotos(request.Photos, uploadedPaths);
        var removedManagedPhotos = GetRemovedManagedPhotos(existing.Photos, targetPhotos);

        try
        {
            var updated = await service.UpdateAsync(id, MapUpdateRequest(request, uploadedPaths), cancellationToken);
            await DeleteUploadedPhotosAsync(removedManagedPhotos, cancellationToken);
            return Ok(updated);
        }
        catch
        {
            await DeleteUploadedPhotosAsync(uploadedPaths, cancellationToken);
            throw;
        }
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var existing = await service.GetByIdAsync(id, cancellationToken);
        await service.DeleteAsync(id, cancellationToken);
        await DeleteUploadedPhotosAsync(existing.Photos.Where(IsManagedUploadPath), cancellationToken);
        return NoContent();
    }

    private CreateProductRequest MapRequest(ProductUpsertFormRequest request, IReadOnlyCollection<string> uploadedPaths)
    {
        return new CreateProductRequest
        {
            Name = request.Name,
            Photos = MergePhotos(request.Photos, uploadedPaths),
            Calories = request.Calories,
            Proteins = request.Proteins,
            Fats = request.Fats,
            Carbs = request.Carbs,
            Composition = request.Composition,
            Category = request.Category,
            CookingType = request.CookingType,
            Flags = request.Flags
        };
    }

    private UpdateProductRequest MapUpdateRequest(ProductUpsertFormRequest request, IReadOnlyCollection<string> uploadedPaths)
    {
        return new UpdateProductRequest
        {
            Name = request.Name,
            Photos = MergePhotos(request.Photos, uploadedPaths),
            Calories = request.Calories,
            Proteins = request.Proteins,
            Fats = request.Fats,
            Carbs = request.Carbs,
            Composition = request.Composition,
            Category = request.Category,
            CookingType = request.CookingType,
            Flags = request.Flags
        };
    }

    private async Task<List<string>> SavePhotoFilesAsync(List<IFormFile>? photoFiles, CancellationToken cancellationToken)
    {
        if (photoFiles is null || photoFiles.Count == 0)
        {
            return [];
        }

        var uploadedPaths = new List<string>(photoFiles.Count);
        try
        {
            foreach (var file in photoFiles)
            {
                uploadedPaths.Add(await photoStorageService.SaveProductPhotoAsync(file, cancellationToken));
            }
        }
        catch
        {
            await DeleteUploadedPhotosAsync(uploadedPaths, cancellationToken);
            throw;
        }

        return uploadedPaths;
    }

    private async Task DeleteUploadedPhotosAsync(IEnumerable<string> paths, CancellationToken cancellationToken)
    {
        foreach (var path in paths.Distinct(StringComparer.OrdinalIgnoreCase))
        {
            try
            {
                await photoStorageService.DeleteAsync(path, cancellationToken);
            }
            catch (EntityNotFoundException)
            {
            }
        }
    }

    private static List<string> MergePhotos(IEnumerable<string>? requestPhotos, IEnumerable<string> uploadedPaths)
    {
        return (requestPhotos ?? [])
            .Concat(uploadedPaths)
            .Where(path => !string.IsNullOrWhiteSpace(path))
            .Select(path => path.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private static IEnumerable<string> GetRemovedManagedPhotos(IEnumerable<string> existingPhotos, IEnumerable<string> targetPhotos)
    {
        var target = targetPhotos.ToHashSet(StringComparer.OrdinalIgnoreCase);
        return existingPhotos
            .Where(IsManagedUploadPath)
            .Where(path => !target.Contains(path));
    }

    private static bool IsManagedUploadPath(string path)
    {
        return !string.IsNullOrWhiteSpace(path) &&
               path.Replace('\\', '/').StartsWith("/uploads/", StringComparison.OrdinalIgnoreCase);
    }
}
