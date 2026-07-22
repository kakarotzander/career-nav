// ─── Cloudflare Worker: AI Career Interview Proxy ───
// Routes: POST /chat  → DeepSeek for interview follow-up
//         POST /analyze → DeepSeek for skill extraction

const DEEPSEEK_API = 'https://api.deepseek.com/v1/chat/completions';

// ─── System Prompts ───

const INTERVIEW_SYSTEM = `你是一位大学生职业规划访谈助手。你的任务是：

1. 先问候学生，说明这是一个简短的能力访谈（3-5轮对话）
2. 请学生分享一个他/她最有成就感或最有收获的经历（可以是项目、比赛、实习、课程设计、社团活动等）
3. 根据学生的回答，追问具体细节：你在其中扮演什么角色？用了哪些能力？最喜欢哪个环节？遇到困难怎么解决的？
4. 像你收到的用户提问一样探索用户的决策模式，而不是给选项。例如：
   "如果给你两个工作机会：一个工资稳定但成长慢；一个风险更高但成长空间大。你会怎么选择？为什么？"
5. 根据对话的深入程度，适时转向下一个话题

始终保持对话式、鼓励性的语气。每次回复1-2个问题，不要一次问太多。
注意：你的回答应该简洁、自然、像真人面试官一样交流。`;

const ANALYSIS_SYSTEM = `你是一位职业能力分析专家。请基于以下完整的面试对话，分析该学生的能力画像和潜在职业方向。

请严格按以下JSON格式输出（不要包含markdown代码块标记，仅输出纯JSON）：
{
  "skillScores": {
    "编程开发": <1-5>,
    "数据分析": <1-5>,
    "算法与AI": <1-5>,
    "设计创意": <1-5>,
    "写作内容": <1-5>,
    "英语能力": <1-5>,
    "沟通表达": <1-5>,
    "项目管理": <1-5>,
    "市场营销": <1-5>,
    "财务金融": <1-5>,
    "运营管理": <1-5>,
    "工程技术": <1-5>,
    "数学统计": <1-5>,
    "产品策划": <1-5>,
    "领导力": <1-5>,
    "逻辑分析": <1-5>
  },
  "suggestedCareers": ["职业名称1", "职业名称2", "职业名称3"],
  "reasoning": "简要说明为什么给出这些评分",
  "summary": "一段简洁的学生能力描述（50字以内）"
}

评分标准：
1 = 完全未体现 / 明确回避
2 = 有所涉及但基础薄弱
3 = 具备基本能力
4 = 较为突出，能独立运用
5 = 非常出色，有领导或创新表现

请注意：评估必须基于对话证据，不要凭空猜测。如果某个技能在对话中完全没有涉及，给予默认值2。`;

// ─── Request Handler ───

async function callDeepSeek(messages, systemPrompt, temperature, env) {
  const apiKey = env?.DEEPSEEK_API_KEY;
  const body = {
    model: (env?.DEEPSEEK_MODEL) || 'deepseek-chat',
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages
    ],
    temperature: temperature,
    max_tokens: 1024,
  };

  const response = await fetch(DEEPSEEK_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error('DeepSeek API error: ' + response.status + ' ' + errText.substring(0, 200));
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function handleChat(request, env) {
  try {
    const { messages } = await request.json();
    const reply = await callDeepSeek(
      messages || [],
      INTERVIEW_SYSTEM,
      0.8,
      env
    );
    return new Response(JSON.stringify({ reply }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}

async function handleAnalyze(request, env) {
  try {
    const { messages } = await request.json();
    const text = await callDeepSeek(
      messages || [],
      ANALYSIS_SYSTEM,
      0.3,
      env
    );

    // Parse JSON from response (handle potential markdown wrapping)
    let jsonStr = text.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```(?:json)?\n?/g, '').trim();
    }

    const result = JSON.parse(jsonStr);
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}

// ─── Router ───

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method;

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' },
      });
    }

    if (method === 'POST') {
      if (url.pathname === '/chat') {
        return handleChat(request, env);
      }
      if (url.pathname === '/analyze') {
        return handleAnalyze(request, env);
      }
    }

    return new Response('Not found', { status: 404 });
  },
};
