using System.Text.Json;
using Cookbook.Application.Exceptions;
using Microsoft.AspNetCore.Mvc;

namespace Cookbook.Middleware;

public sealed class ApiExceptionMiddleware(RequestDelegate next, IHostEnvironment environment)
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task Invoke(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (ValidationException exception)
        {
            var details = new ValidationProblemDetails(exception.Errors)
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "Validation failed",
                Detail = "Check the correctness of the submitted data."
            };

            await WriteProblemAsync(context, details.Status.Value, details);
        }
        catch (EntityNotFoundException exception)
        {
            var details = new ProblemDetails
            {
                Status = StatusCodes.Status404NotFound,
                Title = "Not found",
                Detail = exception.Message
            };

            await WriteProblemAsync(context, details.Status.Value, details);
        }
        catch (BusinessConflictException exception)
        {
            var details = new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "Conflict",
                Detail = exception.Message
            };

            if (exception.Details is not null)
            {
                details.Extensions["details"] = exception.Details;
            }

            await WriteProblemAsync(context, details.Status.Value, details);
        }
        catch (Exception exception)
        {
            var details = new ProblemDetails
            {
                Status = StatusCodes.Status500InternalServerError,
                Title = "Server error",
                Detail = environment.IsDevelopment()
                    ? exception.ToString()
                    : "Internal server error."
            };

            await WriteProblemAsync(context, details.Status.Value, details);
        }
    }

    private static async Task WriteProblemAsync(HttpContext context, int statusCode, ProblemDetails details)
    {
        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/problem+json";
        await JsonSerializer.SerializeAsync(context.Response.Body, details, JsonOptions);
    }
}
