using System.Reflection;
using System.Reflection.Emit;
using MegaCrit.Sts2.Core.Entities.Cards;
using SpireForge.Runtime;

namespace SpireForge.Runtime.Emit;

/// <summary>
/// 为每张数据驱动卡牌生成一个空壳类型（SfCardBase 的子类）。
/// ModelDb 以类型名为 ModelId 来源，因此"一卡一类型"是硬性要求；
/// 构造器用 IL 向基类传 cost/type/rarity/target 常量，与原版卡的编译模式等价。
/// 动态程序集不会被 ReflectionHelper 扫描（GetLoadedMods 只扫 mod DLL），
/// 因此生成后必须走 ModelDb.Inject 注册。
/// </summary>
public static class EmitCardFactory
{
    private static readonly object Gate = new();

    /// <summary>宿主 mod id，由 RuntimeEntry.Load 设置；用于把动态程序集关联到 mod（多人类型排序需要）。</summary>
    public static string? ModId { get; set; }

    /// <summary>已创建并关联的动态程序集构建器（诊断用）</summary>
    public static Assembly? CurrentAssembly => _assembly;

    /// <summary>
    /// 动态程序集的"运行时程序集"对象。
    /// 注意：AssemblyBuilder（构建器）与 type.Assembly（运行时程序集）在 .NET 中是
    /// 两个不同引用——ContentSorter 用后者查 ModMap，因此必须把后者也注册进去。
    /// 通过定义一个标记类型再读它的 Assembly 获得。
    /// </summary>
    public static Assembly? RuntimeAssembly => _markerType?.Assembly;

    /// <summary>
    /// 提前创建并关联动态程序集（必须在 AssemblyInfo.Init 之前调用）。
    /// 必须在 Load 阶段调用：AssemblyInfo.Init 在 ExecuteEssential 早期运行，
    /// 若程序集晚于它创建，ContentSorter 会把它当作"未关联 mod"并影响多人排序。
    /// 类型定义（Emit）可稍后再做——ModMap 是程序集级映射，与类型定义时序无关。
    /// </summary>
    public static void EnsureAssembly()
    {
        lock (Gate)
        {
            _ = GetSharedAssembly();
        }
    }

    public static Type Emit(string typeName, int cost, CardType type, CardRarity rarity, TargetType target)
    {
        lock (Gate)
        {
            AssemblyBuilder assembly = GetSharedAssembly();
            ModuleBuilder module = GetSharedModule(assembly);
            TypeBuilder tb = module.DefineType(
                typeName,
                TypeAttributes.Public | TypeAttributes.Class | TypeAttributes.Sealed,
                typeof(SfCardBase));

            ConstructorBuilder ctor = tb.DefineConstructor(
                MethodAttributes.Public, CallingConventions.Standard, Type.EmptyTypes);
            ILGenerator il = ctor.GetILGenerator();
            il.Emit(OpCodes.Ldarg_0);
            il.Emit(OpCodes.Ldc_I4, cost);
            il.Emit(OpCodes.Ldc_I4, (int)type);
            il.Emit(OpCodes.Ldc_I4, (int)rarity);
            il.Emit(OpCodes.Ldc_I4, (int)target);
            il.Emit(OpCodes.Call, BaseCtor);
            il.Emit(OpCodes.Ret);

            return tb.CreateType();
        }
    }

    private static readonly ConstructorInfo BaseCtor = typeof(SfCardBase)
        .GetConstructor(
            BindingFlags.NonPublic | BindingFlags.Instance,
            binder: null,
            new[] { typeof(int), typeof(CardType), typeof(CardRarity), typeof(TargetType) },
            modifiers: null)
        ?? throw new System.InvalidOperationException("SfCardBase protected ctor not found");

    private static ModuleBuilder? _module;
    private static Type? _markerType;

    private static AssemblyBuilder GetSharedAssembly()
    {
        if (_assembly != null)
        {
            return _assembly;
        }
        // Run（非可收集）：类型被 ModelDb 终身持有，程序集必须同样存活
        AssemblyBuilder ab = AssemblyBuilder.DefineDynamicAssembly(
            new AssemblyName("SpireForge.Dynamic"), AssemblyBuilderAccess.Run);
        if (ModId != null)
        {
            // 官方机制：动态程序集必须关联到 mod，否则多人模式类型排序报错
            MegaCrit.Sts2.Core.Modding.ModManager.AssociateAssemblyWithMod(ModId, ab);
        }
        _assembly = ab;
        // 捕获运行时程序集对象（与 AssemblyBuilder 引用不同），供 ModMap 注册
        ModuleBuilder mb = ab.DefineDynamicModule("SpireForge.Dynamic");
        _markerType = mb.DefineType("SpireForgeMarker", TypeAttributes.Public).CreateType();
        _module = mb;
        return ab;
    }

    private static ModuleBuilder GetSharedModule(AssemblyBuilder assembly)
    {
        if (_module != null)
        {
            return _module;
        }
        _module = assembly.DefineDynamicModule("SpireForge.Dynamic");
        return _module;
    }

    private static AssemblyBuilder? _assembly;
}
