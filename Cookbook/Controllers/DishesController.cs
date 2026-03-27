using Cookbook.Application.Exceptions;
using Cookbook.Application.Interfaces;
using Cookbook.Contracts.Dishes;
using Microsoft.AspNetCore.Mvc;

namespace Cookbook.Controllers;

[ApiController]
[Route("api/dishes")]
public sealed class DishesController(
    IDishService service,
    IPhotoStorageService photoStorageService) : ControllerBase
{
    [HttpPost]
    [Consumes("multipart/form-data")]
    [ProducesResponseType<DishResponse>(StatusCodes.Status201Created)]
    public async Task<ActionResult<DishResponse>> Create(
        [FromForm] DishUpsertFormRequest request,
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
    [ProducesResponseType<IReadOnlyList<DishResponse>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<DishResponse>>> GetAll(
        [FromQuery] DishListQuery query,
        CancellationToken cancellationToken)
    {
        var dishes = await service.GetAllAsync(query, cancellationToken);
        return Ok(dishes);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType<DishResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<DishResponse>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var dish = await service.GetByIdAsync(id, cancellationToken);
        return Ok(dish);
    }

    [HttpPut("{id:guid}")]
    [Consumes("multipart/form-data")]
    [ProducesResponseType<DishResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<DishResponse>> Update(
        Guid id,
        [FromForm] DishUpsertFormRequest request,
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
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var existing = await service.GetByIdAsync(id, cancellationToken);
        await service.DeleteAsync(id, cancellationToken);
        await DeleteUploadedPhotosAsync(existing.Photos.Where(IsManagedUploadPath), cancellationToken);
        return NoContent();
    }

    private CreateDishRequest MapRequest(DishUpsertFormRequest request, IReadOnlyCollection<string> uploadedPaths)
    {
        return new CreateDishRequest
        {
            Name = request.Name,
            Photos = MergePhotos(request.Photos, uploadedPaths),
            Calories = request.Calories,
            Proteins = request.Proteins,
            Fats = request.Fats,
            Carbs = request.Carbs,
            Products = request.Products,
            PortionSize = request.PortionSize,
            Category = request.Category,
            Flags = request.Flags
        };
    }

    private UpdateDishRequest MapUpdateRequest(DishUpsertFormRequest request, IReadOnlyCollection<string> uploadedPaths)
    {
        return new UpdateDishRequest
        {
            Name = request.Name,
            Photos = MergePhotos(request.Photos, uploadedPaths),
            Calories = request.Calories,
            Proteins = request.Proteins,
            Fats = request.Fats,
            Carbs = request.Carbs,
            Products = request.Products,
            PortionSize = request.PortionSize,
            Category = request.Category,
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
                uploadedPaths.Add(await photoStorageService.SaveDishPhotoAsync(file, cancellationToken));
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
