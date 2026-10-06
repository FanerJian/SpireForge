// 卡牌 Entry 派生规则（与游戏 StringHelper.Slugify 一致；Rust publish.rs / C# 同规则三侧镜像）。

/** id 派生规则（与游戏 StringHelper.Slugify 一致）。
 *  游戏实现：CamelCase 正则 `([A-Za-z0-9]|\G(?!^))([A-Z])` → "$1_$2"，
 *  再大写、空白→下划线、剔除 [^A-Z0-9_]。
 *  JS 无 \G，用等价收敛循环（反复替换重叠大写对直至稳定）。 */
export function slugify(txt: string): string {
  let s = txt.trim();
  for (;;) {
    const next = s.replace(/([A-Za-z0-9])([A-Z])/g, '$1_$2');
    if (next === s) break;
    s = next;
  }
  const upper = s.toUpperCase();
  const spaced = upper.replace(/\s+/g, '_');
  return spaced.replace(/[^A-Z0-9_]/g, '');
}

export function pascal(s: string): string {
  return s
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join('');
}

/** 卡牌完整 Entry：SNAKE(Pascal(packId) + Pascal(cardId)) */
export function cardEntry(packId: string, cardId: string): string {
  return slugify(pascal(packId) + pascal(cardId));
}

/** 「添加至卡组」登记用的 Entry。覆盖卡（vanilla_id）在 Runtime 是就地修补原版模板，
 *  ModelDb 里只有原版 Entry——按包内派生 Entry 登记会查无此卡，必须用原版 Entry。
 *  规范化与 Rust 端 publish.rs 一致：大写 + 只留字母数字下划线。 */
export function grantEntry(card: { id: string; vanilla_id?: string | null }, packId: string): string {
  const v = card.vanilla_id?.trim();
  if (v) return v.toUpperCase().replace(/[^A-Z0-9_]/g, '');
  return cardEntry(packId, card.id);
}

/** 兼容旧名 */
export const pascalToSnake = slugify;
