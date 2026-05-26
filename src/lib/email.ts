import { Resend } from "resend";
import { getServerEnv } from "./env";
import type { Event } from "./supabase";

const X_PROFILE = "https://x.com/fahad_developer";
const FONT_STACK = `Outfit, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;

let cached: Resend | null = null;
function getResend(): Resend {
  if (cached) return cached;
  cached = new Resend(getServerEnv().RESEND_API_KEY);
  return cached;
}

/**
 * Resolve a *publicly reachable* origin for assets referenced inside emails.
 * Localhost is treated as "no public URL" — Gmail can't reach localhost.
 */
function getPublicAppUrl(): string | null {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit && !/^https?:\/\/(localhost|127\.)/i.test(explicit)) {
    return explicit.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return null;
}

type SendCreditArgs = {
  to: string;
  name?: string | null;
  creditUrl: string;
  event: Pick<Event, "name" | "host" | "organizer" | "event_date">;
};

export async function sendCreditEmail({
  to,
  name,
  creditUrl,
  event,
}: SendCreditArgs) {
  const env = getServerEnv();
  const subject = `Free Cursor Credits from ${event.name} | Thank you for Attending`;
  const greetingName = name?.trim() ? name.trim().split(" ")[0] : "there";

  const html = renderHtml({ greetingName, creditUrl, event });
  const text = renderText({ greetingName, creditUrl, event });

  const { data, error } = await getResend().emails.send({
    from: env.RESEND_FROM_EMAIL,
    to,
    subject,
    html,
    text,
    replyTo: env.RESEND_REPLY_TO || undefined,
    headers: {
      "X-Entity-Ref-ID": `chyd-${Date.now()}`,
    },
  });

  if (error) throw new Error(`Resend error: ${error.message ?? "unknown"}`);
  return data?.id ?? null;
}

function renderText({
  greetingName,
  creditUrl,
  event,
}: {
  greetingName: string;
  creditUrl: string;
  event: SendCreditArgs["event"];
}) {
  return [
    `Hi ${greetingName},`,
    "",
    `Thanks for attending ${event.name}.`,
    "",
    "Your unique Cursor credits link:",
    creditUrl,
    "",
    "Important:",
    "• Redeem while logged into the correct Cursor account.",
    "• Credits work only for individual accounts, not Team plans.",
    "",
    `Questions / issues? Reach out: ${X_PROFILE}`,
    "",
    event.organizer ? `Presented by ${event.organizer}` : "",
    event.host ? `Hosted by ${event.host} — ${X_PROFILE}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Render the brand mark. Uses the real Cursor cube PNG if we have a public URL
 * for it (post-deploy), otherwise falls back to a clean white-on-black wordmark
 * so we never render a broken-image icon in localhost / before-deploy tests.
 */
function renderLogoBlock(): string {
  const publicUrl = getPublicAppUrl();
  if (publicUrl) {
    const src = `${publicUrl}/CUBE_2D_DARK.png`;
    return `<img src="${escapeAttr(src)}" alt="Cursor" width="44" height="44"
      style="display:block;margin:0 auto;width:44px;height:44px;border:0;outline:none;text-decoration:none;" />`;
  }
  // Text wordmark fallback — Outfit font, large, tight letter-spacing
  return `<div style="font-family:${FONT_STACK};font-weight:700;font-size:22px;line-height:1;letter-spacing:-0.025em;color:#ffffff;text-align:center;">
    Cursor
  </div>`;
}

function renderHtml({
  greetingName,
  creditUrl,
  event,
}: {
  greetingName: string;
  creditUrl: string;
  event: SendCreditArgs["event"];
}) {
  const dateLine = event.event_date
    ? `${escapeHtml(event.name)} &middot; ${escapeHtml(formatDate(event.event_date))}`
    : escapeHtml(event.name);

  const hostHtml = event.host
    ? `<span style="color:#a8a8a8;font-family:${FONT_STACK};">Hosted by </span><a href="${X_PROFILE}" style="color:#ffffff;text-decoration:underline;text-underline-offset:2px;font-family:${FONT_STACK};"><span style="color:#ffffff;">${escapeHtml(event.host)}</span></a>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="dark only" />
    <meta name="supported-color-schemes" content="dark only" />
    <title>Your Cursor credits</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap');
      body, table, td, div, p, h1, span, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
      body { margin:0 !important; padding:0 !important; background:#000000 !important; }
      a[x-apple-data-detectors] { color:inherit !important; text-decoration:none !important; }
      /* Gmail / generic dark-mode hint */
      :root { color-scheme: dark; supported-color-schemes: dark; }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#000000;font-family:${FONT_STACK};-webkit-font-smoothing:antialiased;">
    <!-- Preheader (hidden, shows as inbox preview) -->
    <div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#000000;opacity:0;">
      Your free Cursor credits from ${escapeHtml(event.name)} are inside. Tap to claim.
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#000000" style="background-color:#000000;">
      <tr>
        <td align="center" bgcolor="#000000" style="background-color:#000000;padding:40px 16px;">

          <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" bgcolor="#0a0a0a"
            style="max-width:560px;width:100%;background-color:#0a0a0a;border:1px solid #1f1f1f;border-radius:18px;">

            <!-- LOGO + TITLE -->
            <tr>
              <td align="center" style="padding:36px 36px 8px 36px;text-align:center;background-color:#0a0a0a;">
                ${renderLogoBlock()}
                <div style="font-family:${FONT_STACK};font-weight:600;font-size:22px;line-height:1.3;margin:22px 0 6px 0;color:#ffffff;letter-spacing:-0.01em;">
                  Your Cursor credits are ready
                </div>
                <div style="font-family:${FONT_STACK};margin:0;color:#8a8a8a;font-size:13.5px;letter-spacing:0.01em;">
                  ${dateLine}
                </div>
              </td>
            </tr>

            <!-- BODY -->
            <tr>
              <td style="padding:28px 36px 6px 36px;background-color:#0a0a0a;">
                <p style="margin:0 0 14px 0;color:#f0f0f0;font-family:${FONT_STACK};font-size:15px;line-height:1.65;">
                  <span style="color:#f0f0f0;">Hi ${escapeHtml(greetingName)},</span>
                </p>
                <p style="margin:0 0 18px 0;color:#f0f0f0;font-family:${FONT_STACK};font-size:15px;line-height:1.65;">
                  <span style="color:#f0f0f0;">Thanks for attending </span><strong style="color:#ffffff;font-weight:600;">${escapeHtml(event.name)}</strong><span style="color:#f0f0f0;">. Tap the button below to claim your Cursor credits.</span>
                </p>
              </td>
            </tr>

            <!-- CTA BUTTON (bulletproof pattern) -->
            <tr>
              <td align="center" style="padding:6px 36px 22px 36px;background-color:#0a0a0a;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center">
                  <tr>
                    <td align="center" bgcolor="#ffffff" style="background-color:#ffffff;border-radius:10px;mso-padding-alt:14px 26px;">
                      <a href="${escapeAttr(creditUrl)}"
                        style="display:inline-block;padding:14px 26px;color:#000000;background-color:#ffffff;text-decoration:none;font-family:${FONT_STACK};font-weight:600;font-size:15px;letter-spacing:-0.005em;border-radius:10px;">
                        <span style="color:#000000;text-decoration:none;">Claim my Cursor credits</span>
                      </a>
                    </td>
                  </tr>
                </table>

                <div style="margin-top:16px;font-family:${FONT_STACK};font-size:11.5px;color:#7a7a7a;line-height:1.5;text-align:center;">
                  <span style="color:#7a7a7a;">Or paste this link:</span><br/>
                  <a href="${escapeAttr(creditUrl)}" style="color:#bdbdbd;text-decoration:none;word-break:break-all;font-family:${FONT_STACK};">
                    <span style="color:#bdbdbd;">${escapeHtml(creditUrl)}</span>
                  </a>
                </div>
              </td>
            </tr>

            <!-- IMPORTANT -->
            <tr>
              <td style="padding:0 36px 22px 36px;background-color:#0a0a0a;">
                <div style="border-top:1px solid #1f1f1f;padding-top:20px;color:#bdbdbd;font-family:${FONT_STACK};font-size:13px;line-height:1.7;">
                  <strong style="color:#ffffff;font-weight:600;font-family:${FONT_STACK};">Important</strong>
                </div>
                <div style="color:#bdbdbd;font-family:${FONT_STACK};font-size:13px;line-height:1.7;margin-top:4px;">
                  <span style="color:#bdbdbd;">&bull; Redeem while logged into the correct Cursor account.</span><br/>
                  <span style="color:#bdbdbd;">&bull; Credits work for </span><em style="color:#ffffff;font-style:italic;">individual</em><span style="color:#bdbdbd;"> accounts, not Team plans.</span>
                </div>
              </td>
            </tr>

            <!-- CONTACT -->
            <tr>
              <td style="padding:0 36px 26px 36px;background-color:#0a0a0a;">
                <div style="color:#8a8a8a;font-family:${FONT_STACK};font-size:12.5px;line-height:1.6;">
                  <span style="color:#8a8a8a;">Questions / issues? Reach out </span><a href="${X_PROFILE}" style="color:#ffffff;text-decoration:underline;text-underline-offset:2px;font-family:${FONT_STACK};"><span style="color:#ffffff;">here</span></a><span style="color:#8a8a8a;">.</span>
                </div>
              </td>
            </tr>

            <!-- FOOTER -->
            <tr>
              <td align="center" style="padding:20px 36px 30px 36px;border-top:1px solid #1f1f1f;text-align:center;background-color:#0a0a0a;">
                ${
                  event.organizer
                    ? `<div style="color:#a8a8a8;font-family:${FONT_STACK};font-size:12px;line-height:1.7;">
                         <span style="color:#a8a8a8;">Presented by </span><strong style="color:#ffffff;font-weight:600;font-family:${FONT_STACK};">${escapeHtml(event.organizer)}</strong>
                       </div>`
                    : ""
                }
                ${
                  hostHtml
                    ? `<div style="color:#a8a8a8;font-family:${FONT_STACK};font-size:12px;line-height:1.7;margin-top:2px;">${hostHtml}</div>`
                    : ""
                }
              </td>
            </tr>
          </table>

          <div style="color:#5a5a5a;font-family:${FONT_STACK};font-size:11px;margin-top:18px;line-height:1.5;text-align:center;">
            <span style="color:#5a5a5a;">You received this because you attended ${escapeHtml(event.name)}.</span>
          </div>

        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function escapeAttr(s: string) {
  return escapeHtml(s);
}
