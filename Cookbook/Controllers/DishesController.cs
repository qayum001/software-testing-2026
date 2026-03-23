using Cookbook.Application.Interfaces;
using Cookbook.Contracts.Dishes;
using Microsoft.AspNetCore.Mvc;

namespace Cookbook.Controllers;

[ApiController]
[Route("api/dishes")]
public sealed class DishesController(IDishService service) : ControllerBase
{
    [HttpPost]
    [ProducesResponseType<DishResponse>(StatusCodes.Status201Created)]
    public async Task<ActionResult<DishResponse>> Create(
        [FromBody] CreateDishRequest request,
        CancellationToken cancellationToken)
    {
        var created = await service.CreateAsync(request, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
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
    [ProducesResponseType<DishResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<DishResponse>> Update(
        Guid id,
        [FromBody] UpdateDishRequest request,
        CancellationToken cancellationToken)
    {
        var updated = await service.UpdateAsync(id, request, cancellationToken);
        return Ok(updated);
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        await service.DeleteAsync(id, cancellationToken);
        return NoContent();
    }
}
