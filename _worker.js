
function json(data, status = 200, cookies = []) {
  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
  });

  for (const cookie of cookies) {
    headers.append("Set-Cookie", cookie);
  }

  return new Response(JSON.stringify(data), {
    status,
    headers
  });
}

function readCookie(request, name) {
  const cookies = request.headers.get("Cookie") || "";

  for (const item of cookies.split(";")) {
    const parts = item.trim().split("=");
    if (parts.shift() === name) {
      try {
        return decodeURIComponent(parts.join("="));
      } catch {
        return null;
      }
    }
  }

  return null;
}

function sessionCookies(access, refresh) {
  return [
    `maffei_access=${encodeURIComponent(access)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600`,
    `maffei_refresh=${encodeURIComponent(refresh)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`
  ];
}

function clearCookies() {
  return [
    "maffei_access=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0",
    "maffei_refresh=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0"
  ];
}

async function validateToken(token, env) {
  if (!token) return null;

  try {
    const response = await fetch(
      `${env.SUPABASE_URL}/auth/v1/user`,
      {
        headers: {
          apikey: env.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token}`
        }
      }
    );

    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function refreshToken(refresh, env) {
  if (!refresh) return null;

  try {
    const response = await fetch(
      `${env.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
      {
        method: "POST",
        headers: {
          apikey: env.SUPABASE_ANON_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          refresh_token: refresh
        })
      }
    );

    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function getSession(request, env) {
  const access = readCookie(request, "maffei_access");
  const refresh = readCookie(request, "maffei_refresh");

  const user = await validateToken(access, env);

  if (user) {
    return {
      user,
      cookies: []
    };
  }

  const renewed = await refreshToken(refresh, env);

  if (!renewed || !renewed.access_token) {
    return {
      user: null,
      cookies: clearCookies()
    };
  }

  return {
    user: renewed.user || await validateToken(renewed.access_token, env),
    cookies: sessionCookies(
      renewed.access_token,
      renewed.refresh_token
    )
  };
}

function redirect(path) {
  return new Response(null, {
    status: 302,
    headers: {
      Location: path,
      "Cache-Control": "no-store"
    }
  });
}

function withCookies(response, cookies) {
  if (!cookies || cookies.length === 0) return response;

  const headers = new Headers(response.headers);

  for (const cookie of cookies) {
    headers.append("Set-Cookie", cookie);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/api/session" && request.method === "POST") {
      if (request.headers.get("Origin") !== url.origin) {
        return json({ error: "Origem não permitida" }, 403);
      }

      try {
        const body = await request.json();
        const user = await validateToken(body.access_token, env);

        if (!user || !body.refresh_token) {
          return json({ error: "Sessão inválida" }, 401);
        }

        return json(
          { ok: true },
          200,
          sessionCookies(body.access_token, body.refresh_token)
        );
      } catch {
        return json({ error: "Requisição inválida" }, 400);
      }
    }

    if (path === "/api/session" && request.method === "GET") {
      const session = await getSession(request, env);

      if (!session.user) {
        return json(
          { user: null },
          401,
          session.cookies
        );
      }

      return json(
        { user: session.user },
        200,
        session.cookies
      );
    }

    if (path === "/api/logout" && request.method === "POST") {
      if (request.headers.get("Origin") !== url.origin) {
        return json({ error: "Origem não permitida" }, 403);
      }

      return json({ ok: true }, 200, clearCookies());
    }

    if (path === "/favicon.ico") {
      return new Response(null, { status: 204 });
    }

    if (path === "/login.html") {
      return env.ASSETS.fetch(request);
    }

    if (
      path === "/" ||
      path === "/index.html" ||
      path === "/dashboard.html"
    ) {
      const session = await getSession(request, env);

      if (!session.user) {
        return withCookies(
          redirect("/login.html"),
          session.cookies
        );
      }

      if (path !== "/dashboard.html") {
        return withCookies(
          redirect("/dashboard.html"),
          session.cookies
        );
      }

      const response = await env.ASSETS.fetch(request);
      return withCookies(response, session.cookies);
    }

    if (path === "/auth.js" || path === "/supabase.js") {
      return env.ASSETS.fetch(request);
    }

    return new Response("Não encontrado", { status: 404 });
  }
};
