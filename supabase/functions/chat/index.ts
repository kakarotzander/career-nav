// Supabase Edge Function — DeepSeek API 代理
const DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions";

Deno.serve(async (req: Request) => {
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

  const key = Deno.env.get("DEEPSEEK_API_KEY");
  if (!key) {
    return Response.json({ error: "Server not configured" }, { status: 500 });
  }

  try {
    const { messages, temperature, max_tokens } = await req.json();
    const resp = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "deepseek-v4-flash",
        messages: messages || [],
        temperature: temperature ?? 0.8,
        // V4 Flash 是推理模型，需要足够 token 给 reasoning + content
        max_tokens: max_tokens || 2048,
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return Response.json(
        { error: `DeepSeek ${resp.status}: ${text.slice(0, 300)}` },
        { status: resp.status, headers: { "Access-Control-Allow-Origin": "*" } },
      );
    }

    const data = await resp.json();
    const reply = data.choices?.[0]?.message?.content;
    return Response.json(
      { reply: reply ?? "" },
      { headers: { "Access-Control-Allow-Origin": "*" } },
    );
  } catch (e: unknown) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } },
    );
  }
});
