using System;
using System.Collections.Generic;
using MegaCrit.Sts2.Core.Commands;
using MegaCrit.Sts2.Core.Entities.Cards;
using MegaCrit.Sts2.Core.Entities.Creatures;
using MegaCrit.Sts2.Core.GameActions.Multiplayer;
using MegaCrit.Sts2.Core.Models;
using MegaCrit.Sts2.Core.ValueProps;
using SpireForge.Api;

namespace SpireForge.Runtime;

/// <summary>
/// 伤害的编排执行（打出与钩子共用）。原版语义：**打出**走 DamageCmd.Attack fluent 编排
/// （攻击者前摇动画 + 打击特效/音效 WithHitFx + 攻击者侧特效 WithAttackerFx + 多段 WithHitCount，
/// 与 Bash 等攻击卡同款）；**钩子触发**与原版 Tingsha 同款走 CreatureCmd.Damage 直结，
/// 仅当效果显式请求特效/多段时才编排（被动力不该带出手前摇）。
/// AttackCommand 只支持 Move/Unpowered（Unblockable 等不可表达）；打击特效只吃官方
/// res://scenes/ 内路径（mod 特效场景直结后用 SfVfx.PlayOnCreature 补演出）。
/// 编排异常时回落直结，保证伤害不丢。
/// </summary>
internal static class SfAttacks
{
    /// <summary>钩子/无 play 上下文：逐目标直结（或显式请求特效时逐目标编排）。</summary>
    public static async Task RunTargetsAttack(
        CardModel card, IReadOnlyList<Creature> targets, decimal amount, SfEffect e, PlayerChoiceContext? ctx)
    {
        foreach (var t in targets)
        {
            await RunCardAttack(card, [t], amount, e, ctx, play: null, visualTarget: t);
        }
    }

    /// <summary>单目标执行。play != null = 打出（默认编排，原版演出）；play == null = 钩子（默认直结）。</summary>
    public static async Task RunCardAttack(
        CardModel card, List<Creature> targets, decimal amount, SfEffect e,
        PlayerChoiceContext? ctx, CardPlay? play, Creature visualTarget)
    {
        var props = SfEffectEngine.ParseProps(e.Props);
        var vfx = e.StringParam("vfx");
        var sfx = e.StringParam("sfx");
        var attackerVfx = e.StringParam("attacker_vfx");
        var hitCount = Math.Max(1, (int)(e.DecimalParam("hit_count") ?? 1));
        var wantFx = !string.IsNullOrWhiteSpace(vfx) || !string.IsNullOrWhiteSpace(sfx)
            || !string.IsNullOrWhiteSpace(attackerVfx) || hitCount > 1;

        // 打出 = 原版同款编排；钩子 = Tingsha 同款直结，显式要特效/多段才编排
        var choreograph = play != null || wantFx;

        // 编排表达不了的情况：非 Move/Unpowered 的 props（Unblockable 等），
        // 或 mod 特效场景（WithHitFx 只吃 res://scenes/ 内路径）——直结 + 手动补演出
        var plainProps = props == ValueProp.Move || props == (ValueProp.Move | ValueProp.Unpowered);
        var officialVfx = string.IsNullOrWhiteSpace(vfx) || SfVfx.Resolve(vfx)?.StartsWith("res://scenes/", StringComparison.Ordinal) == true;
        var officialAttacker = string.IsNullOrWhiteSpace(attackerVfx)
            || SfVfx.Resolve(attackerVfx)?.StartsWith("res://scenes/", StringComparison.Ordinal) == true;
        if (!choreograph || !plainProps || !officialVfx || !officialAttacker)
        {
            await CreatureCmd.Damage(ctx!, targets, amount, props, card.Owner.Creature, card, play);
            if (!string.IsNullOrWhiteSpace(vfx))
            {
                foreach (var t in targets)
                {
                    SfVfx.PlayOnCreature(t, vfx);
                }
            }
            return;
        }

        try
        {
            var cmd = DamageCmd.Attack(amount)
                .FromCard(card, play)
                .Targeting(targets[0]);
            if (props.HasFlag(ValueProp.Unpowered))
            {
                cmd = cmd.Unpowered();
            }
            if (hitCount > 1)
            {
                cmd = cmd.WithHitCount(hitCount);
            }
            if (!string.IsNullOrWhiteSpace(vfx) || !string.IsNullOrWhiteSpace(sfx))
            {
                var fmod = FmodEventOf(sfx);
                var tmp = fmod == null ? EmptyToNull(sfx) : null;
                var vfxInner = string.IsNullOrWhiteSpace(vfx) ? null : InnerOf(SfVfx.Resolve(vfx));
                cmd = cmd.WithHitFx(vfxInner, fmod, tmp);
            }
            if (!string.IsNullOrWhiteSpace(attackerVfx))
            {
                cmd = cmd.WithAttackerFx(InnerOf(SfVfx.Resolve(attackerVfx)));
            }
            await cmd.Execute(ctx);
            return;
        }
        catch (Exception ex)
        {
            SfLog.Warn("attack choreography failed, falling back to direct damage: " + ex.Message);
        }
        await CreatureCmd.Damage(ctx!, targets, amount, props, card.Owner.Creature, card, play);
    }

    private static string? EmptyToNull(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    /// <summary>res://scenes/vfx/x.tscn → vfx/x（AttackCommand.WithHitFx 的官方入参形态）。</summary>
    private static string? InnerOf(string? resPath)
    {
        if (string.IsNullOrWhiteSpace(resPath))
        {
            return null;
        }
        const string prefix = "res://scenes/";
        var inner = resPath.StartsWith(prefix, StringComparison.Ordinal) ? resPath[prefix.Length..] : resPath;
        return inner.EndsWith(".tscn", StringComparison.Ordinal) ? inner[..^5] : inner;
    }

    /// <summary>"event:/sfx/…" → FMOD 事件路径；其余（blunt_attack.mp3 等音频文件）→ 临时音效。</summary>
    private static string? FmodEventOf(string? sfx)
    {
        var s = (sfx ?? "").Trim();
        return s.StartsWith("event:", StringComparison.Ordinal) ? s : null;
    }
}
