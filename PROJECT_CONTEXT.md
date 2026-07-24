# AI 职业导航系统 — 项目上下文文档

> 生成日期：2026-07-23 | 仓库：`https://github.com/kakarotzander/career-nav` | 分支：`master`
> 在线地址：`https://kakarotzander.github.io/career-nav/`

---

## 一、项目概述

一个面向中国大学生的 AI 职业导航工具，运行在 GitHub Pages 上（纯静态 HTML + JS 单页应用，约 736KB / 3638 行）。用户填写基本信息 → AI 访谈评估能力 → 选择职场期望 → 设置现实条件过滤器 → 获得岗位推荐及成长计划。

**核心架构**：浏览器直接调用 DeepSeek API（`api.deepseek.com`），无后端代理。API key 暴露在前端（用户已知晓并接受风险）。

---

## 二、部署信息

| 项目 | 值 |
|------|-----|
| 托管平台 | GitHub Pages（master 分支根目录） |
| 仓库 | `https://github.com/kakarotzander/career-nav` |
| 推送方式 | `git push origin master`（GitHub Actions 自动部署 Pages） |
| 唯一入口 | `/index.html`（单文件，无构建步骤） |
| 已推但未使用的文件 | `career.html`（旧版备份，可忽略）、`_fix2.js`（调试脚本，可忽略） |
| 前端 API 调用 | 直连 `https://api.deepseek.com/v1/chat/completions` |
| API Key | `sk-2843d8b826104c1e905a065e0907a544`（硬编码在 JS 中，也可在 localStorage 中设置 `deepseek_api_key` 覆盖） |
| 模型 | `deepseek-chat`（DeepSeek V4 Flash） |
| 分析统计 | Supabase `https://lhaikwphpwfotqagwqat.supabase.co`（public anon key 内嵌） |

---

## 三、功能流程

### Step 1 — 基本信息（`#step1`）
- 字段：学校、学科门类+专业、学历（6 个选项含全日制/非全日制）、年级、所在城市
- 验证：所有字段必填
- 数据：`userData = { school, major, degree, year, city }`

### Step 2 — AI 能力访谈（`#step2`）⭐ 核心
分三个阶段：

**Phase 1 — 方向选择**（`#directionPicker`）
- 8 个兴趣方向卡片：技术研发、数据分析、设计创意、商业运营、内容创作、金融财务、教育咨询、工程实践
- 每个方向关联 3 个技能标签（定义于 `DIRECTION_DATA`）

**Phase 2 — 情景选择题**（`#directionQuestions`）
- 每个方向 5 道情景题，每题 3 个选项（定义于 `DIRECTION_QUESTIONS`）
- 每个选项携带技能评分映射（如 `["编程开发",5,"逻辑分析",5]`），用于兜底评分
- 选择结果记录在 `directionAnswers` 和 `directionAnswerIndices`

**Phase 3 — AI 深度访谈 + 分析**（`#interviewPhase`）
- 聊天界面（`#chatMessages` + `#chatInput` + 发送按钮）
- 调用 DeepSeek API，`INTERVIEW_SYSTEM` 提示词驱动 3-5 轮对话
- 达到 5 轮后自动触发 `performAnalysis()`
- 分析流程：
  1. `callAnalysis()` — 对话转纯文本，独立 API 请求，temperature 0.1，要求输出 JSON
  2. 失败则 `computeQuizFallback()` — 基于情景题选项的 skill mapping 计算平均分（精准兜底）
- 结果：`userData.skillScores`（16 维能力评分 1-5）+ `suggestedCareers` + `summary`

### Step 3 — 职场期望（`#step3`）
- 10 个偏好维度（公司文化、管理风格、加班文化、发展速度、工作生活平衡等）
- 每维度 A/B/C/D 四个等级
- 权重 35%

### Step 4 — 现实条件过滤（`#step4`）
- 8 个条件（经常出差、高压工作、高频社交、持续学习等）
- 选中表示排斥，匹配时排除含这些 flag 的岗位
- 权重 20%

### Step 5 — 推荐结果（`#step5`）
- 评分公式：`学历匹配(10%) + 能力匹配(35%) + 职场期望(35%) + 市场环境(20%)`
- 前 15 名岗位展示，含倒序排除列表
- 每个岗位卡片：能力差距分析 + 技能测试 + 2 阶段成长计划（1 个月 + 6 个月）
- 成就徽章系统、职业类型标签、满意度评价

---

## 四、代码结构（`index.html` 单文件）

### HTML 结构（约 1256 行）
```
<head>           → CSS (~800 行)
  #step1         → 基本信息表单 (~50 行)
  #step2         → AI 访谈（方向选择 + 情景题 + 聊天 + 分析结果）(~60 行)
  #step3         → 职场期望 (~50 行)
  #step4         → 现实条件 (~70 行)
  #step5         → 推荐结果卡片 (~120 行 + 结果卡片模板 ~130 行)
```

### JavaScript 结构（约 2400 行）

| 行号 | 模块 | 说明 |
|------|------|------|
| 1260-1284 | Supabase 分析统计 | `trackEvent()` 发送事件到 Supabase |
| 1285-1337 | EXPECTATIONS | 10 个职场期望维度定义 |
| 1338-2006 | CAREERS | **451 个岗位**的完整数据（id, title, industry, desc, skills, majors, salary, trend, lifecycle 等） |
| 2007-2036 | MAJORS + SCHOOLS | 专业分类 + 学校列表 |
| 2030-2076 | 初始化代码 | `initApp()` — 渲染学校下拉、期望选项、条件等 |
| 2093-2149 | 导航 + 验证 | `goStep()` `validateStep1/2()` `computeSkillScores()` |
| 2150-2275 | 匹配引擎 | `matchCareers()` — 四维加权评分 + 反向排除 |
| 2280-2562 | 结果展示 | `showResults()` `generateResult()` → 渲染卡片、技能测试、差距分析、成长计划 |
| 2563-2700 | 游戏化 | 职业类型标签 + 成就徽章系统 |
| 2700-2900 | 技能测试 | `generateSkillTest()` `submitSkillTest()` |
| 2900-3004 | 差距分析 + 成长计划 | `renderGapAnalysis()` `generateTwoPhasePlan()` |
| 3007-3017 | AI 访谈状态变量 | `selectedDirection` `directionAnswers` `directionAnswerIndices` |
| 3018-3137 | 题库数据 | `DIRECTION_DATA`（8 方向）+ `DIRECTION_QUESTIONS`（8×5=40 题） |
| 3335-3576 | **AI 访谈核心** | `callDeepSeek()` → `startInterview()` → `sendChatMessage()` → `performAnalysis()` → `displayAnalysisResult()` |
| 3569-3576 | `restartInterview()` | 重置访谈状态 |

### 其他文件
- `src/worker.js` — Cloudflare Worker 代理（**不再使用**，保留参考）
- `wrangler.toml` — Worker 配置（**不再使用**）
- `大学生职业规划Prompt库.md` — 外部 Prompt 素材库（771 行，非代码，纯文本工具）
- `_fix2.js` — 临时修复脚本（可删除）

---

## 五、关键设计决策

| 决策 | 选择 | 原因 |
|------|------|------|
| API 调用方式 | 浏览器直调 DeepSeek API | workers.dev 在国内被屏蔽，用户无自有域名，无法注册国内云服务器 |
| API Key 位置 | 前端硬编码 + localStorage 覆盖 | 用户接受安全风险（已在 GitHub secret scanning 中白名单） |
| 分析兜底策略 | 情景题选项 skill mapping 平均分 | AI 多次拒绝输出纯 JSON，兜底方案确保永不报错 |
| 单页面架构 | 所有 CSS/JS 内嵌于 index.html | GitHub Pages 限制（无后端），部署即推送 |
| 岗位数据量 | 451 个岗位 | 覆盖主流行业，每个岗位含技能要求、学历门槛、市场趋势 |
| 评分权重 | 学历10%+能力35%+期望35%+市场20% | 侧重用户主观偏好（70% = 能力+期望），市场牵引为辅 |
| 学历区分 | 全日制/非全日制分开 | 中国教育体系特点，某些行业对全日制有硬性要求 |

---

## 六、当前状态（2026-07-23）

### ✅ 已完成并验证
- [x] 岗位数据库：451 个岗位含完整技能/学历/市场数据
- [x] 8 方向 × 5 题情景题库
- [x] AI 深度访谈（3-5 轮对话）
- [x] AI 分析失败时的情景题兜底评分
- [x] 四维匹配算法（学历+能力+期望+市场）
- [x] 职场期望（10 维度 A/B/C/D）
- [x] 现实条件过滤（8 条件排除）
- [x] 结果卡片：能力差距分析 + 技能测试 + 2 阶段成长计划
- [x] 游戏化：职业类型标签 + 成就徽章系统
- [x] Supabase 分析统计
- [x] 满意度评价

### 🐛 最近修复的历史 Bug
1. **`method: POST` 缺引号**（line 3512）→ `ReferenceError: POST is not defined`，AI 对话完全无法启动
2. **缺失 `addBotMessage()` 函数** → AI API 调用成功但回复不渲染
3. **`</style>` 闭合标签缺失** → 页面空白
4. **Analysis JSON 解析** ×3 轮迭代（AI 混入对话文本、输出无 `{}`、完全对话模式）→ 最终用对话转文本独立请求 + 兜底解决

### ⚠️ 已知问题
1. **DeepSeek API Key 暴露在前端** — 用户接受风险，但建议未来换成后端代理
2. **`src/worker.js` 中的 Cloudflare Worker 已废弃** — 但文件仍保留，可在有域名后重新启用
3. **无 CORS 问题至今** — DeepSeek API 支持浏览器直接跨域调用
4. **`_fix2.js`** — 临时脚本，应在接手后清理

---

## 七、下一步待办任务

### 高优先级
- [ ] **端到端全流程测试** — 在部署后的 GitHub Pages 上走通 Step 1 → 5 全流程，确保 AI 访谈、分析、推荐全部正常
- [ ] **清理无用文件** — 删除 `_fix2.js`、`career.html`（旧备份）、`src/worker.js` + `wrangler.toml`（已废弃的 Worker）
- [ ] **优化分析阶段 JSON 提取** — 虽然已有兜底，但 AI 分析成功时有时输出不干净，可以加强正则提取

### 中优先级
- [ ] **添加 API Key 设置界面** — 当前硬编码 + localStorage，建议在页面加一个设置入口，用户可自行填入自己的 key
- [ ] **无 API key 时的降级方案** — 如果 key 失效或被限额，允许用户仅靠情景题评分走完流程
- [ ] **移动端聊天 UI 优化** — 聊天区域在手机上高度偏小，可适当调整

### 低优先级 / 新功能方向
- [ ] **Worker 代理恢复** — 如果在国内买到云服务器或域名，可重新部署 Worker 隐藏 API key
- [ ] **多语言能力访谈** — `INTERVIEW_SYSTEM` 可添加英语模式
- [ ] **访谈记录持久化** — 当前不保存访谈历史（localStorage 可考虑）
- [ ] **Prompt 库集成** — `大学生职业规划Prompt库.md` 中的素材可作为访谈提示词的补充来源

---

## 八、环境配置

```bash
# 项目路径
cd E:/高校学生ai

# 无构建步骤，直接修改 index.html 后推送即可
git add index.html
git commit -m "描述更改"
git push origin master
# GitHub Pages 会自动部署（通常 1-3 分钟生效）
```

### 用于预览的 dev server
项目已配置 `preview_start` 启动本地服务器（需创建 `.claude/launch.json` 或在本地用任意 HTTP server 打开 `index.html` 即可）。

> **注意**：本地直接打开 `file://` 会导致 `fetch()` 调用失败（CORS/跨域限制），必须通过 HTTP server 访问。

---

## 九、关键联系人

- **用户/需求方**：`kakarotzander`（GitHub 用户）
- **API 提供方**：DeepSeek（`https://platform.deepseek.com`）— 中国可访问，需注册获取 API key
- **Supabase 项目**：`https://supabase.com/dashboard/project/lhaikwphpwfotqagwqat`（分析统计用）

---

## 十、最近 Git 历史

```
d63e34c fix: 添加缺失的addBotMessage函数，AI回复无法显示在聊天区域
69d1376 fix: 修复callDeepSeek中method:POST未加引号导致JS报错，AI对话无法启动
ca2222b fix: 重写分析逻辑 - 对话转文本独立请求，兜底用情景题评分
5bcdfef fix: 修复分析阶段JSON模板使用合法默认值3替代1-5
144def3 fix: 分析JSON解析失败时自动重试，双重保障
fd357f7 fix: 增强分析阶段JSON提取，处理AI回复中混入对话文本
ed3e7b4 feat: 浏览器直调 DeepSeek API，添加频率限制
1d1781b fix: 浏览器直调 DeepSeek API 替代 Cloudflare Worker
51af61f Step 2 增加方向选择 + 情景题前置环节
7aefb9c fix: 添加缺失的 </style> 闭合标签，修复页面空白
73baaa7 测评模式改为AI深度访谈模式
75eb9ae 初始部署：AI职业导航系统
```
