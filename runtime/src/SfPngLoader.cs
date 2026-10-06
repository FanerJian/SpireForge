using System.Collections.Generic;
using Godot;

namespace SpireForge.Runtime;

/// <summary>
/// 原始 PNG 资源加载器：导出版 Godot 没有 .png 的 ResourceLoader（mod 用 Godot 编辑器
/// 导出的 PCK 里是 .ctex 导入格式），而 SpireForge 卡包直接装原始 PNG。
/// 本加载器拦截 .png 路径，读字节 → Image → ImageTexture，立绘因此无需任何导入工具链。
/// 接口签名对照游戏自带 AtlasResourceLoader（同版本引擎的权威实现）。
/// </summary>
public sealed partial class SfPngLoader : ResourceFormatLoader
{
    /// <summary>静态引用防止托管对象被 GC（引擎持有原生引用，但保险起见）。</summary>
    public static SfPngLoader? Instance;

    /// <summary>额外放行的包命名空间。原版覆盖包可能只有覆盖卡——覆盖定义不进
    /// PackLoader.PackOf，命名空间不登记的话立绘 PNG 会被本加载器拒认
    /// （ResourceLoader.Exists=false → 立绘空白，日志实锤）。PackLoader 扫到
    /// 覆盖定义时把 modId 登记进来。</summary>
    private static readonly HashSet<string> ExtraNamespaces = new();

    /// <summary>放行一个包命名空间（幂等）。</summary>
    public static void AllowNamespace(string modId) => ExtraNamespaces.Add(modId);

    /// <summary>重扫卡包前清空（ScanAllMods 入口调用，保持与扫描结果一致）。</summary>
    public static void ResetNamespaces() => ExtraNamespaces.Clear();

    private static readonly StringName TypeTexture2D = new("Texture2D");
    private static readonly StringName TypeResource = new("Resource");

    public override string[] _GetRecognizedExtensions()
    {
        return ["png"];
    }

    public override bool _HandlesType(StringName type)
    {
        return type == TypeTexture2D || type == TypeResource;
    }

    public override string _GetResourceType(string path)
    {
        return IsOurPng(path) ? "Texture2D" : "";
    }

    public override bool _RecognizePath(string path, StringName type)
    {
        // 只认领 SpireForge 卡包命名空间内的 PNG（res://<packId>/...）。
        // 不能用 _HandlesType 过滤——Exists(path) 等调用传入的类型提示是空串。
        // 必须限定命名空间，否则会拦截游戏自身的 res://images/... 图集路径。
        return IsOurPng(path);
    }

    public override bool _Exists(string path)
    {
        return IsOurPng(path) && Godot.FileAccess.FileExists(path);
    }

    /// <summary>路径属于某个已扫描到的 SpireForge 卡包：PackLoader.PackOf 的 modId 集合
    /// （普通卡包）+ 覆盖定义登记的 ExtraNamespaces（纯覆盖卡包）。</summary>
    private static bool IsOurPng(string path)
    {
        if (!path.EndsWith(".png", System.StringComparison.OrdinalIgnoreCase)
            || !path.StartsWith("res://", System.StringComparison.Ordinal))
        {
            return false;
        }
        int slash = path.IndexOf('/', 6);
        if (slash < 0)
        {
            return false;
        }
        string ns = path.Substring(6, slash - 6);
        if (ExtraNamespaces.Contains(ns))
        {
            return true;
        }
        foreach (var packId in PackLoader.PackOf.Values)
        {
            if (ns == packId)
            {
                return true;
            }
        }
        return false;
    }

    public override Variant _Load(string path, string originalPath, bool useSubThreads, int cacheMode)
    {
        if (!IsOurPng(path))
        {
            return default;
        }
        using var f = Godot.FileAccess.Open(originalPath, Godot.FileAccess.ModeFlags.Read);
        if (f == null)
        {
            GD.PushError($"SfPngLoader: cannot open {originalPath}");
            return default;
        }
        var bytes = f.GetBuffer((long)f.GetLength());
        var image = new Image();
        var err = DecodeByMagic(bytes, image);
        if (err != Error.Ok)
        {
            GD.PushError($"SfPngLoader: image decode failed for {originalPath}: {err}");
            return default;
        }
        var tex = ImageTexture.CreateFromImage(image);
        return Variant.From(tex);
    }

    /// <summary>按魔数嗅探格式（编辑器允许上传 PNG/JPG/WebP，不信任文件扩展名）。</summary>
    private static Error DecodeByMagic(byte[] b, Image image)
    {
        if (b.Length >= 8 && b[0] == 0x89 && b[1] == 0x50 && b[2] == 0x4E && b[3] == 0x47)
        {
            return image.LoadPngFromBuffer(b);
        }
        if (b.Length >= 3 && b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF)
        {
            return image.LoadJpgFromBuffer(b);
        }
        if (b.Length >= 12 && b[0] == (byte)'R' && b[1] == (byte)'I' && b[2] == (byte)'F' && b[3] == (byte)'F'
            && b[8] == (byte)'W' && b[9] == (byte)'E' && b[10] == (byte)'B' && b[11] == (byte)'P')
        {
            return image.LoadWebpFromBuffer(b);
        }
        return Error.FileUnrecognized;
    }

    public override string[] _GetDependencies(string path, bool addTypes)
    {
        return [];
    }
}
