# 可视化规则契约 v1

本轮实现四项能力：规则组合、动态数值与计数器、自定义状态、选牌和牌堆操作。现有卡牌效果继续使用原契约。新规则由 `custom` 效果承载，handler 固定为 `sf_rules`，params 为规则程序。

## 程序与表达式

程序：`{ rules_version: 1, nodes: RuleNode[], statuses: RuleStatus[] }`。
项目 `project.json.rule_statuses` 是共享状态定义；卡牌程序 `statuses` 保留可移植快照。保存/导出/打包时项目定义按 id 覆盖快照，导入卡牌自带定义仍可执行。所有规则卡使用格式版本 3。
项目 `rule_templates` 保存 `{id,name,program}` 组合模板，最多100项；模板只属于编辑项目，插入后成为卡牌规则。

数值 Value：数值字面量，或 `{ source, key?, scope?, subject?, factor?, offset?, min?, max?, rounding? }`。
计算顺序：读取来源 × factor（默认1）+ offset（默认0），rounding（floor/ceil/round，默认floor），最后限定 min/max。
source：self_hp、self_max_hp、self_missing_hp、self_block、hand_count、draw_count、discard_count、exhaust_count、enemy_count、x、upgrade、counter、status_stacks、power_stacks。
scope：turn/combat（counter 默认combat）；subject：self/target（状态/力量读取默认self）。key 为计数器、状态 id 或力量引用。
多目标规则执行一次，默认伤害/状态动作继承目标集合，抽牌和计数器仍执行一次。`subject:target` 读取当前目标集合的合计层数；显式动作目标可覆盖该集合，状态触发使用状态拥有者单一目标。
counter 按当前战斗、玩家与卡包命名空间隔离；turn 在回合变化后从0读取；战斗结束后自然释放。

条件：`{ left: Value, op: 'eq'|'ne'|'gt'|'gte'|'lt'|'lte', right: Value }`。

## RuleNode

- action：`{ type:'action', effect:EffectDef, amount?:Value }`，动态 amount 覆盖基础效果 amount，通过现有嵌套效果入口执行。
  动作内部组合使用规则节点；`action.effect` 内再次嵌入 `sf_rules` 会由校验器提示调整结构。普通第三方 custom 处理器继续保留其参数。
- if：`{ type:'if', match:'all'|'any', conditions:Condition[], then:RuleNode[], else:RuleNode[] }`。
- repeat：`{ type:'repeat', count:Value, nodes:RuleNode[] }`。
- random：`{ type:'random', count:Value, nodes:RuleNode[] }`，使用游戏随机源，抽取条目互异。
- counter：`{ type:'counter', key:string, scope:'turn'|'combat', operation:'set'|'add', value:Value }`。
- status：`{ type:'status', id:string, operation:'apply'|'remove', target:'self'|'target'|'all_enemies', stacks:Value }`，remove 减去指定层数，到0移除。
- select：`{ type:'select', from:'hand'|'draw'|'discard'|'exhaust', mode:'choose'|'random'|'all', card_type?:string, count:Value, operations:CardOperation[] }`。
- 所有节点可带 `enabled:boolean`（默认true）；false 跳过执行，数据保留。

CardOperation：`{type:'move'|'copy',pile:'hand'|'draw'|'discard'}` / `{type:'exhaust'|'upgrade'}` / `{type:'cost',amount:Value,duration:'turn'|'combat'}`。费用 amount 为增减量。选择结果按 operations 顺序处理。

## 自定义状态

RuleStatus：`{ id, name:LocText, description:LocText, icon:string, stacking:'add'|'replace'|'max', max_stacks:number, decay:number, trigger:'turn_start'|'turn_end'|'after_play'|'after_attack', max_triggers_per_turn:number, nodes:RuleNode[] }`。
状态身份为卡包命名空间+id，同一生物上的相同身份共享层数；不同卡可共同施加和消耗。icon 使用现有游戏力量名，沿用游戏图标。decay 为拥有者回合结束时减少的层数；触发规则先执行，随后衰减。触发规则沿用施加卡来源，目标为状态拥有者，防重入且限制每回合次数。
状态持续当前战斗。实例元数据随实例生命周期管理，卡包定义始终为纯数据。

## 边界与验证

嵌套深度上限8、单程序节点上限256、每次展开重复上限100、单次执行动作预算512。表达式字面量、乘数、偏移和上下限均为[-1e9,1e9]内有限数值，计算使用带溢出检查的十进制数。非法结构在保存/打包前返回可定位问题；Runtime 同步执行边界校验。重复数计算结果向下取整并限于0–100，越界写入诊断日志。
现有基础效果的资源和外部内容依赖，在新节点及状态节点内递归处理。规则描述从程序生成中英文文本。
编辑器以递归规则块呈现，提供增加、删除、复制、上下移动、启用开关和组合模板；动态值通过字段选择配置。

## 模块分工

- `editor/src/lib/rules.ts`：前端类型、默认值、目录、描述与纯函数。
- `editor/src/components/pp/RulesEditor.tsx`：规则、表达式和共享状态的编辑界面。
- `editor/src-tauri/src/rules.rs`：契约校验、状态绑定和递归打包辅助。
- `runtime/src/SfRules*.cs`：规则执行、数值与计数器、选择操作和状态实例。
- 独立回归覆盖序列化往返、分支与嵌套、动态数值、预算、状态及选牌命令边界。

## 描述生成

普通效果与规则动作共用 `effectText.ts` 的句式；`rules.ts` 负责规则结构与动态表达式，`description.ts` 组合卡牌触发时机。目标文案按打出、钩子和延迟上下文生成。规则数值在动作开始时读取，多段攻击沿用同一次读取值；重复节点每轮重新执行动作。

选牌操作按顺序作用于所选原牌。复制操作将副本加入指定牌堆，后续消耗、升级和费用操作继续作用于原牌。描述明确标出这一关系。修改效果后使用“生成描述”更新卡面，已有文字沿用确认与撤销流程。
