# Reality Splitter 信息操控知识库

这是《反信息操控手册》的 AI 检索层。目标不是训练模型“看见关键词就定罪”，而是让模型检索候选模式、绑定可观察证据、主动考虑合理反例，再给出低成本核查动作。

## 文件

- `information-manipulation-patterns.jsonl`：一行一张模式卡，适合流式读取、向量化、人工 diff 和增量更新。
- `pattern.schema.json`：单张模式卡的 JSON Schema。
- `source-catalog.json`：模式卡中的 `refs` 对应的研究和权威资料。
- `runtime-policy.json`：状态词、风险规则、禁止输出与高风险升级条件。
- `eval-seed.jsonl`：首批正例、模糊例与合理反例，可转入现有 Eval Studio。
- 人类可读总手册：`../docs/ANTI_INFORMATION_MANIPULATION_HANDBOOK.md`。

## 设计原则

1. `indicators` 只是可观察线索，不是充分条件。
2. `guard` 是必填的防误判说明；输出模式名称时必须同时读取。
3. `intentPolicy` 固定为“不从单条内容推断蓄意”。
4. `risk` 根据行动后果评估，不代表发布者恶意程度。
5. `observability` 限制模型能作出的判断：
   - `single_item`：单条内容可初步观察；
   - `cross_source`：需要离开当前材料追溯；
   - `cross_account`：需要账号、时间或传播网络数据；
   - `forensic`：需要文件级或专业取证；
   - `professional_only`：普通产品不应独立下结论。

## 推荐 RAG 流程

```text
输入材料
→ 抽取最小主张、证据片段、行动号召与媒介类型
→ 用“片段 + modality + layer + stake”检索 8—12 张卡
→ 交叉编码后保留 3—5 个候选
→ 对每个候选检查 indicators、checks 和 guard
→ 输出 observed / possible / not_observed / not_assessable
→ 单独输出证据状态、意图归因、风险等级与下一步
```

不要把整个知识库一次性塞进 Prompt。先检索，再将少量候选卡连同原始材料交给模型，能减少标签堆叠和上下文稀释。

## 最低输出要求

每个被报告的模式必须包含：

- `patternId`；
- 原文或传播数据中的 `evidenceSpan`；
- 为什么匹配；
- 为什么可能误判；
- 一个验证动作；
- `observed` 或 `possible` 等状态，而不是操控百分比。

## 更新协议

新增模式时：

1. 使用稳定 ID，不复用被废弃 ID；
2. 提供正例、模糊例、合理反例和组合例后再进入生产；
3. 至少一名领域审阅者检查 `guard`；
4. 运行 JSONL 解析、Schema 校验和 Eval；
5. 变更版本并记录来源、日期和适用平台。

`eval-seed.jsonl` 中的案例均为教学用虚构材料。`expectedSignals` 不是完整答案，只是最低应识别信号；`mustNotClaim` 用于检查意图归因、事实核查和人格诊断越界。

本库是分析工具，不是黑名单、事实裁判、心理诊断系统或自动执法系统。
