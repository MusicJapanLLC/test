import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function extractName(input: string) {
  return input
    .replace(/[?？!！]/g, "")
    .replace(/(今|現在|結局)?(どうなった|どうなってる|どうなっていますか|の状況|について教えて|を教えて)$/u, "")
    .trim();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!['GET', 'POST'].includes(req.method)) return json({ error: "method_not_allowed" }, 405);

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "missing_authorization" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return json({ error: "server_configuration_error" }, 500);

  let input = "";
  let asOf: string | undefined;
  if (req.method === "GET") {
    const url = new URL(req.url);
    input = url.searchParams.get("q") ?? "";
    asOf = url.searchParams.get("as_of") ?? undefined;
  } else {
    const raw = await req.text();
    if (raw.length > 4096) return json({ error: "request_too_large" }, 413);
    const body = raw ? JSON.parse(raw) : {};
    input = String(body.name ?? body.query ?? body.question ?? "");
    asOf = body.as_of ? String(body.as_of) : undefined;
  }

  if (!input.trim()) return json({ error: "query_required" }, 400);
  const name = extractName(input);
  const headers = {
    apikey: anonKey,
    Authorization: authorization,
    "Content-Type": "application/json",
  };

  const briefResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/cm_person_brief`, {
    method: "POST",
    headers,
    body: JSON.stringify({ p_name: name, ...(asOf ? { p_as_of: asOf } : {}) }),
  });

  if (!briefResponse.ok) {
    return json({ error: "memory_query_failed", detail: await briefResponse.text() }, briefResponse.status);
  }

  const brief = await briefResponse.json();
  if (brief?.status === "not_found") {
    const searchResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/cm_memory_search`, {
      method: "POST",
      headers,
      body: JSON.stringify({ p_query: name, p_limit: 20 }),
    });
    const candidates = searchResponse.ok ? await searchResponse.json() : [];
    return json({ question: input, normalized_query: name, status: "not_found", candidates });
  }

  return json({
    question: input,
    normalized_query: name,
    generated_at: new Date().toISOString(),
    data: brief,
  });
});
