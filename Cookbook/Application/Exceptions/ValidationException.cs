namespace Cookbook.Application.Exceptions;

public sealed class ValidationException : Exception
{
    public ValidationException(Dictionary<string, string[]> errors)
        : base("Validation failed")
    {
        Errors = errors;
    }

    public Dictionary<string, string[]> Errors { get; }
}
