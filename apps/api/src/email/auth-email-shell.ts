/**
 * Shared HTML wrapper for the three auth emails (magic link, password
 * reset, bookkeeper invite) — docs/design's "Auth emails" section: mark +
 * wordmark, one card, one button, a footer with the sending identity and a
 * "didn't request this?" line. Colors are hardcoded rather than referencing
 * apps/web's theme tokens on purpose — email HTML has no access to CSS
 * custom properties (most clients strip <style> variables), and this file
 * is outside apps/web/src so the token-discipline check doesn't apply here.
 */
export interface AuthEmailContent {
  preheaderSubject: string;
  heading: string;
  bodyHtml: string;
  ctaLabel: string;
  ctaUrl: string;
  afterCtaHtml?: string;
  footerHtml: string;
}

export function renderAuthEmailHtml(content: AuthEmailContent): string {
  return `<div style="background:#F6F3EB;padding:28px;font-family:'Inter',system-ui,sans-serif">
<div style="background:#fff;border:1px solid #E7E0D4;border-radius:12px;padding:32px;max-width:460px;box-sizing:border-box;margin:0 auto">
<div style="display:flex;align-items:center;gap:8px;margin-bottom:24px"><span style="display:inline-block;width:18px;height:18px;background:#C24E12;border-radius:0 100% 0 0"></span><span style="font-size:14px;font-weight:600;color:#1F1B16">kwartaal</span></div>
<h1 style="margin:0 0 12px;font-size:19px;font-weight:600;letter-spacing:-0.01em;color:#1F1B16">${content.heading}</h1>
${content.bodyHtml}
<a href="${content.ctaUrl}" style="display:inline-block;background:#C24E12;color:#fff;border-radius:8px;padding:12px 22px;font-size:14px;font-weight:600;text-decoration:none">${content.ctaLabel}</a>
${content.afterCtaHtml ?? ""}
<div style="margin-top:24px;padding-top:16px;border-top:1px solid #F0EDE5;font-size:11.5px;line-height:1.6;color:#A39A8B">${content.footerHtml}</div>
</div>
</div>`;
}
