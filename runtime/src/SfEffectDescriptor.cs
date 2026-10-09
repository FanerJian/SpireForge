namespace SpireForge.Api;

/// <summary>Optional UI/validation contract. Existing Register(string, handler) remains supported.</summary>
public sealed record SfEffectParameter(string Name, string Title, string Type = "string",
    string[]? Options = null, object? Default = null, decimal? Min = null, decimal? Max = null, bool Required = false);
public sealed record SfEffectDescriptor(string ModId, string Name, string Title, string Description,
    SfEffectParameter[] Parameters, string[]? AllowedTriggers = null, string? RequiredCharacter = null);
