export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // GET /api/posts?mountain_id=...
  if (request.method === "GET") {
    const mountainId = url.searchParams.get("mountain_id");
    const limit = Math.min(Number(url.searchParams.get("limit") || 50), 100);

    let stmt;
    if (mountainId) {
      stmt = env.DB
        .prepare(
          `select id, mountain_id, mountain_name, author, body, created_at
           from posts
           where approved = 1 and mountain_id = ?
           order by id desc
           limit ?`
        )
        .bind(mountainId, limit);
    } else {
      stmt = env.DB
        .prepare(
          `select id, mountain_id, mountain_name, author, body, created_at
           from posts
           where approved = 1
           order by id desc
           limit ?`
        )
        .bind(limit);
    }

    const { results } = await stmt.all();
    return json({ ok: true, results });
  }

  // POST /api/posts
  if (request.method === "POST") {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return json({ ok: false, error: "JSON only" }, 400);
    }

    const body = await request.json();

    // Turnstile 検証
    const token = body.turnstileToken;
    const ip = request.headers.get("CF-Connecting-IP") || "";
    const secret = env.TURNSTILE_SECRET_KEY;

    if (!token || !secret) {
      return json({ ok: false, error: "Turnstile missing" }, 400);
    }

    const form = new URLSearchParams();
    form.append("secret", secret);
    form.append("response", token);
    if (ip) form.append("remoteip", ip);

    const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form,
    });
    const verifyJson = await verifyRes.json();
    if (!verifyJson.success) {
      return json({ ok: false, error: "Turnstile failed", detail: verifyJson }, 403);
    }

    const mountain_id = String(body.mountain_id || "").trim();
    const mountain_name = String(body.mountain_name || "").trim();
    const author = String(body.author || "").trim();
    const text = String(body.body || "").trim();

    if (!mountain_id || !mountain_name) return json({ ok: false, error: "mountain required" }, 400);
    if (!text) return json({ ok: false, error: "body required" }, 400);
    if (text.length > 500) return json({ ok: false, error: "body too long (max 500)" }, 400);
    if (author.length > 40) return json({ ok: false, error: "author too long (max 40)" }, 400);

    await env.DB.prepare(
      `insert into posts (mountain_id, mountain_name, author, body, approved)
       values (?, ?, ?, ?, 1)`
    ).bind(mountain_id, mountain_name, author || null, text).run();

    return json({ ok: true });
  }

  return json({ ok: false, error: "Method not allowed" }, 405);
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
