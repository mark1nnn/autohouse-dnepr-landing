const RESEND_ENDPOINT = "https://api.resend.com/emails";
const CONTACT_SUBJECT = "Нова заявка з сайту AutoHouse.Dnepr";

const FIELD_LIMITS = {
  name: 80,
  phone: 40,
  service: 120,
  message: 1000
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.hostname === "www.autohouse.dp.ua") {
      url.hostname = "autohouse.dp.ua";
      return Response.redirect(url.toString(), 301);
    }

    if (url.pathname === "/api/contact") {
      return handleContactRequest(request, env);
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Not found", { status: 404 });
  }
};

async function handleContactRequest(request, env) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(request, env)
    });
  }

  if (request.method !== "POST") {
    return jsonResponse(
      { success: false },
      405,
      request,
      env,
      { Allow: "POST, OPTIONS" }
    );
  }

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return jsonResponse({ success: false }, 415, request, env);
  }

  const payload = await parseJson(request);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return jsonResponse({ success: false }, 400, request, env);
  }

  const fields = normalizePayload(payload);

  if (fields.website) {
    return jsonResponse({ success: true }, 200, request, env);
  }

  if (!isValidSubmission(fields)) {
    return jsonResponse({ success: false }, 400, request, env);
  }

  if (!env.RESEND_API_KEY || !env.CONTACT_EMAIL || !env.FROM_EMAIL) {
    console.error("Missing contact form environment variables.");
    return jsonResponse({ success: false }, 500, request, env);
  }

  const sentAt = new Date().toISOString();
  const emailPayload = {
    from: env.FROM_EMAIL,
    to: env.CONTACT_EMAIL,
    subject: CONTACT_SUBJECT,
    html: buildEmailHtml(fields, sentAt),
    text: buildEmailText(fields, sentAt)
  };

  try {
    const resendResponse = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(emailPayload)
    });

    if (!resendResponse.ok) {
      const errorBody = await resendResponse.text().catch(() => "");
      console.error("Resend API error", {
        status: resendResponse.status,
        body: errorBody.slice(0, 1000)
      });
      return jsonResponse({ success: false }, 502, request, env);
    }
  } catch (error) {
    console.error("Resend request failed", error);
    return jsonResponse({ success: false }, 502, request, env);
  }

  return jsonResponse({ success: true }, 200, request, env);
}

async function parseJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function normalizePayload(payload) {
  return {
    name: toText(payload.name),
    phone: toText(payload.phone),
    service: toText(payload.service),
    message: toText(payload.message),
    website: toText(payload.website),
    language: normalizeLanguage(payload.language),
    page: toText(payload.page).slice(0, 500)
  };
}

function normalizeLanguage(value) {
  const lang = toText(value).toLowerCase();
  return lang === "ru" ? "ru" : "uk";
}

function isValidSubmission(fields) {
  if (!fields.name || fields.name.length > FIELD_LIMITS.name) return false;
  if (!fields.phone || fields.phone.length < 7 || fields.phone.length > FIELD_LIMITS.phone) return false;
  if (!fields.service || fields.service.length > FIELD_LIMITS.service) return false;
  if (fields.message.length > FIELD_LIMITS.message) return false;
  return true;
}

function buildEmailText(fields, sentAt) {
  return [
    CONTACT_SUBJECT,
    "",
    `Ім’я: ${fields.name}`,
    `Телефон: ${fields.phone}`,
    `Послуга: ${fields.service}`,
    `Повідомлення: ${fields.message || "—"}`,
    "",
    `Мова сторінки: ${fields.language}`,
    `Сторінка: ${fields.page || "—"}`,
    `Дата: ${sentAt}`
  ].join("\n");
}

function buildEmailHtml(fields, sentAt) {
  const rows = [
    ["Ім’я", fields.name],
    ["Телефон", fields.phone],
    ["Послуга", fields.service],
    ["Повідомлення", fields.message || "—"],
    ["Мова сторінки", fields.language],
    ["Сторінка", fields.page || "—"],
    ["Дата", sentAt]
  ];

  return `<!doctype html>
<html lang="uk">
  <body style="margin:0;padding:24px;background:#f5f6f8;color:#17191d;font-family:Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #d9dde4;border-radius:12px;overflow:hidden;">
      <tr>
        <td style="padding:22px 24px;background:#17191d;color:#ffffff;">
          <h1 style="margin:0;font-size:22px;line-height:1.25;">${escapeHtml(CONTACT_SUBJECT)}</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:0;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            ${rows.map(([label, value]) => buildTableRow(label, value)).join("")}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildTableRow(label, value) {
  return `<tr>
    <th align="left" style="width:190px;padding:14px 18px;border-top:1px solid #d9dde4;background:#eef1f5;color:#626976;font-size:14px;line-height:1.4;">${escapeHtml(label)}</th>
    <td style="padding:14px 18px;border-top:1px solid #d9dde4;color:#17191d;font-size:15px;line-height:1.5;">${escapeHtml(value).replace(/\n/g, "<br>")}</td>
  </tr>`;
}

function jsonResponse(body, status, request, env, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...getCorsHeaders(request, env),
      ...extraHeaders
    }
  });
}

function getCorsHeaders(request, env) {
  const allowedOrigin = toText(env.ALLOWED_ORIGIN);
  const origin = allowedOrigin || request.headers.get("Origin") || "*";

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin"
  };
}

function toText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
