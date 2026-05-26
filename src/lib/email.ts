import { promises as fs } from "fs";
import path from "path";
import { Resend } from "resend";
import { getServerEnv } from "./env";
import type { Event } from "./supabase";

const X_PROFILE = "https://x.com/fahad_developer";

// System-font stack only. We intentionally do NOT load Outfit / any web font
// inside the email — Gmail strips <style> blocks that contain @import, which
// kills every other rule (dark mode overrides, media queries, etc).
// "Outfit" stays in the stack so that if the recipient happens to have it
// installed locally it still applies.
const FONT_STACK = `'Outfit','Inter','Helvetica Neue',Helvetica,Arial,sans-serif`;

// Slightly off pure values. Gmail Android dark mode is more predictable when
// you avoid #000 / #fff exactly — dark colors (<=#181818) are left alone, but
// pure black sometimes triggers weird repainting.
const COLORS = {
  pageBg: "#000000",         // outer body — Gmail leaves dark BGs alone
  cardBg: "#0a0a0a",         // card surface
  divider: "#1f1f1f",
  textPrimary: "#fafafa",
  textBody: "#e6e6e6",
  textMuted: "#a8a8a8",
  textFaint: "#7a7a7a",
  link: "#ffffff",
  ctaBg: "#ffffff",
  ctaText: "#000000",
} as const;

let cached: Resend | null = null;
function getResend(): Resend {
  if (cached) return cached;
  cached = new Resend(getServerEnv().RESEND_API_KEY);
  return cached;
}

// --- LOGO LOADING ----------------------------------------------------------
// Read the Cursor cube once, keep as Buffer in module memory. We try a few
// candidate paths because Vercel's serverless bundling sometimes places the
// /public folder at .next/server/app/<route>/public depending on the route.
let logoBufferPromise: Promise<Buffer | null> | null = null;
function loadLogoBuffer(): Promise<Buffer | null> {
  if (logoBufferPromise) return logoBufferPromise;
  logoBufferPromise = (async () => {
    const candidates = [
      path.join(process.cwd(), "public", "CUBE_2D_DARK.png"),
      path.join(process.cwd(), ".next", "server", "public", "CUBE_2D_DARK.png"),
      // Fallback: walk up from this file's location (works inside bundled fns)
      path.resolve(__dirname, "..", "..", "..", "public", "CUBE_2D_DARK.png"),
    ];
    for (const p of candidates) {
      try {
        const buf = await fs.readFile(p);
        if (buf?.length) return buf;
      } catch {
        // try next
      }
    }
    // Last resort: fetch from the public URL (Resend will receive the URL
    // and embed it itself, but we resolve here so we still get a Buffer).
    const publicUrl = getPublicAppUrl();
    if (publicUrl) {
      try {
        const res = await fetch(`${publicUrl}/CUBE_2D_DARK.png`, {
          cache: "no-store",
        });
        if (res.ok) {
          const ab = await res.arrayBuffer();
          return Buffer.from(ab);
        }
      } catch (err) {
        console.error("[email] logo url fetch failed", err);
      }
    }
    console.error("[email] could not load logo from any source");
    return null;
  })();
  return logoBufferPromise;
}

function getPublicAppUrl(): string | null {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit && !/^https?:\/\/(localhost|127\.)/i.test(explicit)) {
    return explicit.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return null;
}

const LOGO_CID = "cursor-cube-logo";

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

  const logoBuf = await loadLogoBuffer();
  const hasLogo = !!logoBuf;

  const html = renderHtml({ greetingName, creditUrl, event, hasLogo });
  const text = renderText({ greetingName, creditUrl, event });

  const attachments = hasLogo
    ? [
        {
          filename: "cursor.png",
          content: logoBuf!,
          contentId: LOGO_CID,
          contentType: "image/png",
        },
      ]
    : undefined;

  const { data, error } = await getResend().emails.send({
    from: env.RESEND_FROM_EMAIL,
    to,
    subject,
    html,
    text,
    replyTo: env.RESEND_REPLY_TO || undefined,
    attachments,
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

function renderLogoBlock(hasLogo: boolean): string {
  if (hasLogo) {
    return `<img src="cid:${LOGO_CID}" alt="Cursor" width="44" height="44" style="display:block;margin:0 auto;width:44px;height:44px;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;" />`;
  }
  // Wordmark fallback — only shown if we somehow couldn't read the PNG file
  return `<div style="font-family:${FONT_STACK};font-weight:700;font-size:22px;line-height:1;letter-spacing:-0.025em;color:${COLORS.textPrimary};text-align:center;mso-line-height-rule:exactly;">Cursor</div>`;
}

function renderHtml({
  greetingName,
  creditUrl,
  event,
  hasLogo,
}: {
  greetingName: string;
  creditUrl: string;
  event: SendCreditArgs["event"];
  hasLogo: boolean;
}) {
  const dateLine = event.event_date
    ? `${escapeHtml(event.name)} &middot; ${escapeHtml(formatDate(event.event_date))}`
    : escapeHtml(event.name);

  const hostHtml = event.host
    ? `<span style="color:${COLORS.textMuted};">Hosted by </span><a href="${X_PROFILE}" style="color:${COLORS.link};text-decoration:underline;text-underline-offset:2px;"><span style="color:${COLORS.link};">${escapeHtml(event.host)}</span></a>`
    : "";

  // CSS block is small + uses only safe properties so Gmail keeps it.
  // No @import, no Google Fonts, no @font-face — Gmail strips the whole
  // <style> block if it sees any of those.
  const css = `
    /* Apple Mail / iOS / Outlook macOS dark mode hint */
    :root { color-scheme: dark; supported-color-schemes: dark; }
    /* Reset some quirks */
    body { margin:0 !important; padding:0 !important; width:100% !important; background:${COLORS.pageBg} !important; }
    table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; border-collapse:collapse; }
    img { -ms-interpolation-mode:bicubic; border:0; outline:none; text-decoration:none; }
    /* Disable iOS auto-link styling on phone numbers / addresses */
    a[x-apple-data-detectors] { color:inherit !important; text-decoration:none !important; }
    /* Apple Mail dark mode — pin colors explicitly */
    @media (prefers-color-scheme: dark) {
      .bg-page  { background-color:${COLORS.pageBg} !important; }
      .bg-card  { background-color:${COLORS.cardBg} !important; }
      .t-primary{ color:${COLORS.textPrimary} !important; }
      .t-body   { color:${COLORS.textBody} !important; }
      .t-muted  { color:${COLORS.textMuted} !important; }
      .t-faint  { color:${COLORS.textFaint} !important; }
      .cta-bg   { background-color:${COLORS.ctaBg} !important; }
      .cta-text { color:${COLORS.ctaText} !important; }
    }
    /* Outlook.com dark mode overrides */
    [data-ogsc] .bg-page  { background-color:${COLORS.pageBg} !important; }
    [data-ogsb] .bg-card  { background-color:${COLORS.cardBg} !important; }
    [data-ogsc] .t-primary{ color:${COLORS.textPrimary} !important; }
    [data-ogsc] .t-body   { color:${COLORS.textBody} !important; }
    [data-ogsc] .t-muted  { color:${COLORS.textMuted} !important; }
    [data-ogsc] .t-faint  { color:${COLORS.textFaint} !important; }
    [data-ogsb] .cta-bg   { background-color:${COLORS.ctaBg} !important; }
    [data-ogsc] .cta-text { color:${COLORS.ctaText} !important; }
    /* Mobile tweaks */
    @media only screen and (max-width:600px) {
      .card { width:100% !important; border-radius:0 !important; border-left:0 !important; border-right:0 !important; }
      .pad-x { padding-left:22px !important; padding-right:22px !important; }
    }
  `.trim();

  return `<!doctype html>
<html lang="en" dir="ltr" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no" />
    <meta name="color-scheme" content="dark" />
    <meta name="supported-color-schemes" content="dark" />
    <title>Your Cursor credits</title>
    <!--[if mso]>
      <xml>
        <o:OfficeDocumentSettings>
          <o:AllowPNG/>
          <o:PixelsPerInch>96</o:PixelsPerInch>
        </o:OfficeDocumentSettings>
      </xml>
    <![endif]-->
    <style type="text/css">${css}</style>
  </head>
  <body class="bg-page" style="margin:0;padding:0;background-color:${COLORS.pageBg};font-family:${FONT_STACK};-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;">
    <!-- Hidden preheader -->
    <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${COLORS.pageBg};opacity:0;">
      Your free Cursor credits from ${escapeHtml(event.name)} are inside. Tap to claim.
      &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
    </div>

    <table role="presentation" class="bg-page" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLORS.pageBg}" style="background-color:${COLORS.pageBg};">
      <tr>
        <td align="center" bgcolor="${COLORS.pageBg}" style="background-color:${COLORS.pageBg};padding:40px 16px;">

          <table role="presentation" class="card bg-card" width="560" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLORS.cardBg}" style="max-width:560px;width:100%;background-color:${COLORS.cardBg};border:1px solid ${COLORS.divider};border-radius:18px;">

            <!-- LOGO + TITLE -->
            <tr>
              <td align="center" class="bg-card pad-x" bgcolor="${COLORS.cardBg}" style="background-color:${COLORS.cardBg};padding:36px 36px 8px 36px;text-align:center;">
                ${renderLogoBlock(hasLogo)}
                <div class="t-primary" style="font-family:${FONT_STACK};font-weight:600;font-size:22px;line-height:1.3;margin:22px 0 6px 0;color:${COLORS.textPrimary};letter-spacing:-0.01em;mso-line-height-rule:exactly;">
                  Your Cursor credits are ready
                </div>
                <div class="t-muted" style="font-family:${FONT_STACK};margin:0;color:${COLORS.textMuted};font-size:13.5px;letter-spacing:0.01em;mso-line-height-rule:exactly;">
                  ${dateLine}
                </div>
              </td>
            </tr>

            <!-- BODY -->
            <tr>
              <td class="bg-card pad-x" bgcolor="${COLORS.cardBg}" style="padding:28px 36px 6px 36px;background-color:${COLORS.cardBg};">
                <p class="t-body" style="margin:0 0 14px 0;color:${COLORS.textBody};font-family:${FONT_STACK};font-size:15px;line-height:1.65;mso-line-height-rule:exactly;">
                  <span style="color:${COLORS.textBody};">Hi ${escapeHtml(greetingName)},</span>
                </p>
                <p class="t-body" style="margin:0 0 18px 0;color:${COLORS.textBody};font-family:${FONT_STACK};font-size:15px;line-height:1.65;mso-line-height-rule:exactly;">
                  <span style="color:${COLORS.textBody};">Thanks for attending </span><strong class="t-primary" style="color:${COLORS.textPrimary};font-weight:600;">${escapeHtml(event.name)}</strong><span style="color:${COLORS.textBody};">. Tap the button below to claim your Cursor credits.</span>
                </p>
              </td>
            </tr>

            <!-- CTA BUTTON (bulletproof, with VML for Outlook) -->
            <tr>
              <td align="center" class="bg-card pad-x" bgcolor="${COLORS.cardBg}" style="padding:6px 36px 22px 36px;background-color:${COLORS.cardBg};">
                <!--[if mso]>
                <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${escapeAttr(creditUrl)}" style="height:46px;v-text-anchor:middle;width:240px;" arcsize="22%" strokecolor="${COLORS.ctaBg}" fillcolor="${COLORS.ctaBg}">
                  <w:anchorlock/>
                  <center style="color:${COLORS.ctaText};font-family:Arial,sans-serif;font-size:15px;font-weight:600;">Claim my Cursor credits</center>
                </v:roundrect>
                <![endif]-->
                <!--[if !mso]><!-- -->
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center">
                  <tr>
                    <td align="center" class="cta-bg" bgcolor="${COLORS.ctaBg}" style="background-color:${COLORS.ctaBg};border-radius:10px;mso-padding-alt:14px 26px;">
                      <a href="${escapeAttr(creditUrl)}"
                        class="cta-text"
                        style="display:inline-block;padding:14px 26px;color:${COLORS.ctaText};background-color:${COLORS.ctaBg};text-decoration:none;font-family:${FONT_STACK};font-weight:600;font-size:15px;letter-spacing:-0.005em;border-radius:10px;">
                        <span class="cta-text" style="color:${COLORS.ctaText};text-decoration:none;">Claim my Cursor credits</span>
                      </a>
                    </td>
                  </tr>
                </table>
                <!--<![endif]-->

                <div class="t-faint" style="margin-top:16px;font-family:${FONT_STACK};font-size:11.5px;color:${COLORS.textFaint};line-height:1.5;text-align:center;mso-line-height-rule:exactly;">
                  <span style="color:${COLORS.textFaint};">Or paste this link:</span><br/>
                  <a href="${escapeAttr(creditUrl)}" style="color:#bdbdbd;text-decoration:none;word-break:break-all;font-family:${FONT_STACK};">
                    <span style="color:#bdbdbd;">${escapeHtml(creditUrl)}</span>
                  </a>
                </div>
              </td>
            </tr>

            <!-- IMPORTANT -->
            <tr>
              <td class="bg-card pad-x" bgcolor="${COLORS.cardBg}" style="padding:0 36px 22px 36px;background-color:${COLORS.cardBg};">
                <div style="border-top:1px solid ${COLORS.divider};padding-top:20px;">
                  <strong class="t-primary" style="color:${COLORS.textPrimary};font-weight:600;font-family:${FONT_STACK};font-size:13px;">Important</strong>
                </div>
                <div class="t-body" style="color:${COLORS.textBody};font-family:${FONT_STACK};font-size:13px;line-height:1.7;margin-top:4px;mso-line-height-rule:exactly;">
                  <span style="color:${COLORS.textBody};">&bull; Redeem while logged into the correct Cursor account.</span><br/>
                  <span style="color:${COLORS.textBody};">&bull; Credits work for </span><em class="t-primary" style="color:${COLORS.textPrimary};font-style:italic;">individual</em><span style="color:${COLORS.textBody};"> accounts, not Team plans.</span>
                </div>
              </td>
            </tr>

            <!-- CONTACT -->
            <tr>
              <td class="bg-card pad-x" bgcolor="${COLORS.cardBg}" style="padding:0 36px 26px 36px;background-color:${COLORS.cardBg};">
                <div class="t-muted" style="color:${COLORS.textMuted};font-family:${FONT_STACK};font-size:12.5px;line-height:1.6;mso-line-height-rule:exactly;">
                  <span style="color:${COLORS.textMuted};">Questions / issues? Reach out </span><a href="${X_PROFILE}" style="color:${COLORS.link};text-decoration:underline;text-underline-offset:2px;font-family:${FONT_STACK};"><span style="color:${COLORS.link};">here</span></a><span style="color:${COLORS.textMuted};">.</span>
                </div>
              </td>
            </tr>

            <!-- FOOTER -->
            <tr>
              <td align="center" class="bg-card pad-x" bgcolor="${COLORS.cardBg}" style="padding:20px 36px 30px 36px;border-top:1px solid ${COLORS.divider};text-align:center;background-color:${COLORS.cardBg};">
                ${
                  event.organizer
                    ? `<div class="t-muted" style="color:${COLORS.textMuted};font-family:${FONT_STACK};font-size:12px;line-height:1.7;mso-line-height-rule:exactly;">
                         <span style="color:${COLORS.textMuted};">Presented by </span><strong class="t-primary" style="color:${COLORS.textPrimary};font-weight:600;">${escapeHtml(event.organizer)}</strong>
                       </div>`
                    : ""
                }
                ${
                  hostHtml
                    ? `<div class="t-muted" style="color:${COLORS.textMuted};font-family:${FONT_STACK};font-size:12px;line-height:1.7;margin-top:2px;mso-line-height-rule:exactly;">${hostHtml}</div>`
                    : ""
                }
              </td>
            </tr>
          </table>

          <div class="t-faint" style="color:${COLORS.textFaint};font-family:${FONT_STACK};font-size:11px;margin-top:18px;line-height:1.5;text-align:center;mso-line-height-rule:exactly;">
            <span style="color:${COLORS.textFaint};">You received this because you attended ${escapeHtml(event.name)}.</span>
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
