namespace Cookbook.Application.Exceptions;

public sealed class BusinessConflictException(string message, object? details = null) : Exception(message)
{
    public object? Details { get; } = details;
}
