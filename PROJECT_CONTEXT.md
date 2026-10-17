# AI 职业导航系统 — 项目上下文文档

> 更新日期：2026-10-17 ｜ 仓库：`https://github.com/kakarotzander/career-nav` ｜ 分支：`master`
> 线上地址：`https://kakarotzander.github.io/career-nav/` ｜ 数据看板：`/career-nav/dashboard.html`

---

## 一、项目概述

面向中国大学生的 AI 职业导航工具。纯静态单页应用——**整个站点就是根目录的 `index.html` 一个文件**（约 801KB，CSS 与 JS 全部内嵌，没有构建步骤、没有框架），托管在 GitHub Pages。

用户走完 6 步后得到：能力画像 → 30 个岗位推荐 → 目标岗位的技能测试 → 差距分析 + 两阶段成长计划。

**岗位库**：`CAREERS` 共 **438 个岗位**，每个含技能要求（16 维中的若干项）、学历门槛 `edu`、现实条件旗标 `realityFlags`、10 维工作环境 `env`、薪资区间、趋势/需求描述、晋升路径、行动建议、三阶段生命周期。

---

## 二、部署与外部依赖

| 项 | 值 |
|------|-----|
| 托管 | GitHub Pages，从 `master` 分支根目录自动发布（推送后 1–3 分钟生效） |
| 前端 AI 调用 | `POST https://lhaikwphpwfotqagwqat.supabase.co/functions/v1/chat`，请求头带 `x-api-key: <API_SECRET>` |
| 本地开发 | `localhost` / `127.0.0.1` 时改调 `/api/chat`（由 `server.py` 代理） |
| Edge Function 源码 | `supabase/functions/chat/index.ts`（Deno） |
| 模型 | `deepseek-chat`，`max_tokens` 默认 512 |
| 密钥存放 | DeepSeek 真 key 只在 Supabase 的 `DEEPSEEK_API_KEY` 环境变量里；Edge Function 另外用 `API_SECRET` 校验前端传来的 `x-api-key` |
| 访问统计 | Supabase REST `.../rest/v1/events`，`trackEvent()` 写入 `page_view` / `step_reached` 等漏斗事件 |
| 保活 | `.github/workflows/keepalive.yml` —— 每 3 天用错误 key 打一次 Edge Function 期望 401。Supabase 免费版 7 天无活动会暂停，暂停后 AI 全线不可用 |
| 看板 | `dashboard.html`：核心指标 / 步骤漏斗 / AI 与交互 / 热门目标岗位 |

> **安全**：前端只放 `API_SECRET`（共享口令，已公开在页面里），**绝不要把 DeepSeek 的 `sk-...` key 写进本仓库任何文件**。历史版本曾把 key 写进过本文档，那把 key 应视为已泄漏，需要在 DeepSeek 控制台吊销后重新签发。

---

## 三、六步流程

| 步 | 容器 | 标题 | 内容 |
|---|---|---|---|
| 1 | `#step1` | 📋 基本信息 | 学校、学科门类 + 专业（选「其他」时可手填）、学历（全日制/非全日制 × 专科/本科 + 硕士/博士）、年级、所在城市 |
| 2 | `#step2` | 🎯 专业兴趣与方向 | 对当前专业的态度；8 个兴趣方向卡片**按点击顺序排序**，最多 3 个，第 1 个为首选、决定第 3 步按哪个方向出题 |
| 3 | `#step3` | 📝 情景测评 | 首选方向的 5 道情景题，每题 3 个选项；选项携带技能映射，用于 AI 失败时兜底评分 |
| 4 | `#step4` | 💰 经济与学业规划 | 期望薪资倾向、家庭经济情况、可接受最低起薪、是否需补贴家用、学业规划 |
| 5 | `#step5` | 🏢 工作环境要求 | 10 个维度各选 A/B/C/D + 8 项现实条件（选中表示排斥）+ 行业偏好（可多选） |
| 6 | `#step6` | 🧠 AI 深度访谈 | 5 轮对话 → `performAnalysis()` 出 16 维能力分 + 8 个方向的 `directionFit` → 自动展示排名结果 → 目标岗位技能测试 → 差距分析 + 成长计划 |

---

## 四、评分链路

权重集中在 `SCORE_W`，改比例只需改这一处：

```
major    0.15   ① 学历 + 专业对口
interest 0.08   ② 兴趣方向（前 3 名按 1.0 / 0.7 / 0.45 加权）
ability  0.20   ③ 专业知识（只算真正被测到的维度）
economy  0.05   ④ 经济压力（家庭经济 × 薪资 × 起薪底线 × 补贴家用 × 学业规划）
workEnv  0.12   ⑤ 工作环境（10 维环境占 70% + 行业偏好占 30%）
ai       0.40   ⑥ AI 综合分（方向级）
```

**① 学历 + 专业对口**（`matchCareers()` 开头）
学历门槛优先判定：岗位 `edu` 不含用户当前学历 → `eduGate=false`，此时专业再对口也只给 35 分（对口 100、相关 75、学历达标但专业不符 50、都不满足 15/25）。
另外，岗位 `note` 里显式写了「博士起步 / 硕博学历」而 `edu` 仍列了本科的，以 `note` 为准按硕士门槛处理（全库 7 处）。

**③ 能力**：`level = (uv-1)/4*100`；`meet = uv≥req ? 1 : 0.5+0.5*uv/req`；按 `req` 加权平均。未被测到的维度不进分母。

**⑥ AI 综合分**：AI 在访谈后对 **8 个方向**各给 0–100 分（`aiDirectionScores`），岗位按所属行业映射到方向取分（`aiScoreOf`）。**注意这是"方向级"分数——同一行业的所有岗位取同一个分，在同一行业内部没有任何区分度。** AI 失败时走 `deriveDirectionFitFromQuiz()`：按兴趣排序给基础分（85/70/55/40），再按情景题作答的技能达成度加减。

**市场前景**：`marketFinal` 仍然计算（趋势/需求/薪资/排斥条件），但**不计入总分**——2026-09-26 的决定是改由 AI 综合判断。实测把它按 10% 计入会把「概念热」岗位往上抬、且对区分度几乎无改善，所以没有采用。

结果集：按分数降序，阈值从 60 起逐级降到 50、40（避免结果页空白），最多展示 30 个。

---

## 五、代码结构（单文件 `index.html`）

| 区块 | 说明 |
|---|---|
| `<style>` | 全部样式，含步骤卡片、方向卡片、情景题、聊天界面、结果卡片 |
| `#step1`–`#step6` | 六个步骤容器，靠 `.active` 切换显示 |
| `trackEvent()` | 漏斗埋点，写 Supabase `events` |
| `DIRECTION_DATA` | 8 个方向：图标、描述、关联技能 |
| `DIRECTION_QUESTIONS` | 8 方向 × 5 题，选项带技能映射 |
| `CAREERS` | 438 个岗位 |
| `SCORE_W` | 评分权重 |
| `goStep()` / `validateStep1()` | 导航与校验 |
| `matchCareers()` | 六项加权 + 学历门槛 + 排序 |
| `interestWeightOf()` / `aiScoreOf()` / `deriveDirectionFitFromQuiz()` | 打分辅助 |
| `startInterview()` / `sendChatMessage()` / `performAnalysis()` | AI 访谈与分析 |
| `computeQuizFallback()` | AI 失败时的兜底评分 |
| `showResults()` / `generateResult()` | 结果卡片、技能测试、差距分析、成长计划 |

其他文件：`dashboard.html`（数据看板）、`server.py`（本地开发服务器 + `/api/chat` 代理）、`supabase/functions/chat/index.ts`（Edge Function）、`.github/workflows/keepalive.yml`（保活）、`大学生职业规划Prompt库.md`（提示词素材）。

---

## 六、已知问题（按影响排序）

1. **分数区分度不足**。典型画像（本科·计算机·技术研发）下，前 30 名跨度只有 16 分、只有 9 个不同的分数值。根因不是权重：同行业内「专业对口 15% + 兴趣 8% + AI 40%」这 63% 的权重是常数，逐岗信号只有能力、环境、经济三项。**实测换权重（能力/市场/AI 多种组合）排名几乎不动**，要真正拉开需要给岗位加逐岗字段（如入门可行性、专业细分度）。
2. **AI 综合分是方向级的**。同行业所有岗位同分，因此 40% 的权重在行业内部不起区分作用。
3. **岗位库混有偏高阶的角色**。如「云架构师」「网络安全红队专家」「AI伦理师」「Web3工程师」会排进本科生前列。数据里 `note` / `demand` 对这类岗位偏乐观（例如 `顶尖人才极度稀缺` 被当成正向需求），需要逐条做产品判断。
4. **部分岗位数据是模板复制的**。多个 AI 相关岗位的技能映射完全一致，导致能力分并列。
5. **AI 输出非确定性**：同一用户两次分析可能得到略有差异的 `directionFit`，推荐结果不完全一致。这是 40% 权重带来的固有特性。

---

## 七、最近一次修复（2026-10-17）

**症状**：线上点「下一步：情景测评 →」抛 `Uncaught ReferenceError: renderStep3Questions is not defined`，用户永远停在 Step 2。

**根因**：2026-09-26 的提交 `2b7b7ae33`（"兴趣方向由单选改为排序多选"）重构方向选择器时删掉了 `renderStep3Questions` 的定义，却留下了 `goStep(3)` 里的调用。

**修复**（三处，+36/−8）：补回 `renderStep3Questions`；删除从未定义的 `toggleDegreeCustom` 的 `onchange`；`startInterview()` 首次失败自动重试一次、仍失败则放开输入框。

**另修的排名缺陷**（+18/−6，2026-10-17）：学历门槛此前被专业对口短路——只要专业命中就直接给 100 分，本科生因此能拿到「硕士/博士」岗位的专业满分。现在学历是硬门槛，并尊重 `note` 里标注的硕博要求。

---

## 八、本地开发

```bash
# 无构建步骤，改完 index.html 直接发布即可
# 本地预览（需要 python；没有 python 时可用任意静态服务器）
python server.py          # http://localhost:3006，同时把 /api/chat 代理到 DeepSeek
```

- 必须用 `http://localhost` 打开，**不能双击 `file://`**——`fetch()` 会因跨域失败。
- `server.py` 需要环境变量 `DEEPSEEK_API_KEY`；不设也能预览界面，只是 AI 相关功能不可用。
- 发布：把改好的 `index.html` 提交到 `master`，GitHub Pages 自动发布。

---

## 九、关键链接

- 线上：`https://kakarotzander.github.io/career-nav/`
- 仓库：`https://github.com/kakarotzander/career-nav`
- Supabase 控制台：`https://supabase.com/dashboard/project/lhaikwphpwfotqagwqat`
- DeepSeek 平台：`https://platform.deepseek.com`
