// Supabase Edge Function — DeepSeek API 代理
// Key 存在 Supabase Secret，浏览器不可见
// 调用：POST /functions/v1/chat → api.deepseek.com

const DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions";
const DEEPSEEK_KEY = Deno.env.get("DEEPSEEK_API_KEY") || "";

// 每个 IP 每分钟最多 20 次
const rateMap = new Map<string, { count: number; reset: number }>();

function checkRate(ip: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now > entry.reset) {
    rateMap.set(ip, { count: 1, reset: now + 60_000 });
    return true;
  }
  if (entry.count >= 20) return false;
  entry.count++;
  return true;
}

Deno.serve(async (req: Request) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const ip = req.headers.get("x-forwarded-for") || "unknown";
  if (!checkRate(ip)) {
    return Response.json({ error: "请求太频繁，请稍后重试" }, { status: 429 });
  }

  if (!DEEPSEEK_KEY) {
    return Response.json({ error: "Server not configured" }, { status: 500 });
  }

  try {
    const { messages, temperature, max_tokens } = await req.json();
    const resp = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${DEEPSEEK_KEY}` },
      body: JSON.stringify({
        model: "deepseek-v4-flash",
        messages,
        temperature: temperature ?? 0.8,
        max_tokens: max_tokens ?? 1024,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      return Response.json(
        { error: `DeepSeek API error: ${resp.status} ${errText.slice(0, 200)}` },
        { status: resp.status },
      );
    }

    const data = await resp.json();
    return Response.json(
      { reply: data.choices[0].message.content },
      { headers: { "Access-Control-Allow-Origin": "*" } },
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
});
