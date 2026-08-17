const HEX_RE = /^#([0-9a-fA-F]{6})$/;

export interface BrandEmailContext {
  companyName: string;
  tagline?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  logoUrl?: string | null;
  fontFamily?: string;
  footerText?: string;
}

export interface BrandEmailContent {
  title: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  code?: string;
  footer?: string;
}

const FALLBACK_PRIMARY = '#3B82F6';
const FALLBACK_SECONDARY = '#8B5CF6';
const FALLBACK_ACCENT = '#10B981';
const DEFAULT_FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeColor(value: string | undefined, fallback: string): string {
  return value && HEX_RE.test(value) ? value : fallback;
}

function safeFont(value: string | undefined): string {
  if (!value || !value.trim()) return DEFAULT_FONT;
  const family = value.trim().replace(/["']/g, '');
  return `'${family}', ${DEFAULT_FONT}`;
}

function buildLogo(brand: BrandEmailContext): string {
  const name = escapeHtml(brand.companyName || 'Business Copilot');
  const primary = safeColor(brand.primaryColor, FALLBACK_PRIMARY);
  if (brand.logoUrl) {
    return `<img src="${escapeHtml(brand.logoUrl)}" alt="${name}" width="auto" height="40" style="height:40px; max-height:40px; max-width:220px; object-fit:contain; display:block; border:0;" />`;
  }
  const initials = (brand.companyName || 'Business Copilot')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || 'BC';
  return `<span style="display:inline-block; height:40px; line-height:40px; padding:0 16px; border-radius:10px; background:${primary}; color:#ffffff; font-size:16px; font-weight:700; letter-spacing:0.5px;">${escapeHtml(initials)}</span>`;
}

export function renderEmailTemplate(
  brand: BrandEmailContext,
  content: BrandEmailContent,
): string {
  const primary = safeColor(brand.primaryColor, FALLBACK_PRIMARY);
  const secondary = safeColor(brand.secondaryColor, FALLBACK_SECONDARY);
  const accent = safeColor(brand.accentColor, FALLBACK_ACCENT);
  const font = safeFont(brand.fontFamily);
  const companyName = escapeHtml(brand.companyName || 'Business Copilot');
  const tagline = brand.tagline ? escapeHtml(brand.tagline) : '';
  const footerText = brand.footerText ? escapeHtml(brand.footerText) : '';
  const bodyHtml = escapeHtml(content.body).replace(/\n/g, '<br />');

  const cta = content.ctaLabel && content.ctaUrl
    ? `<a href="${escapeHtml(content.ctaUrl)}" target="_blank" style="display:inline-block; margin:24px 0 8px; padding:12px 28px; border-radius:10px; background:${primary}; color:#ffffff; font-size:14px; font-weight:600; text-decoration:none;">${escapeHtml(content.ctaLabel)}</a>`
    : '';

  const codeBlock = content.code
    ? `<div align="center" style="margin:24px 0 8px; padding:16px 24px; border:1px solid #e2e8f0; border-radius:12px; background:#f8fafc;"><span style="font-size:30px; font-weight:700; letter-spacing:8px; color:#0f172a;">${escapeHtml(content.code)}</span></div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(content.title)}</title>
</head>
<body style="margin:0; padding:0; background:#f1f5f9; font-family:${font};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9; padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 8px 24px rgba(15, 23, 42, 0.08);">
          <tr>
            <td style="padding:0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="height:5px; background:${primary};"></td>
                  <td style="height:5px; background:${secondary};"></td>
                  <td style="height:5px; background:${accent};"></td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:28px 32px 8px;">
              <a href="#" style="text-decoration:none;">${buildLogo(brand)}</a>
              ${tagline ? `<p style="margin:8px 0 0; font-size:12px; color:#64748b;">${tagline}</p>` : ''}
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px;">
              <h1 style="margin:0 0 12px; font-size:20px; font-weight:700; color:#0f172a;">${escapeHtml(content.title)}</h1>
              <p style="margin:0; font-size:14px; line-height:1.7; color:#334155;">${bodyHtml}</p>
              ${codeBlock}
              ${cta ? `<div align="center">${cta}</div>` : ''}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 24px; border-top:1px solid #e2e8f0;">
              <p style="margin:0 0 4px; font-size:12px; color:#94a3b8; text-align:center;">${companyName}${content.footer ? ` &middot; ${escapeHtml(content.footer)}` : ''}</p>
              ${footerText ? `<p style="margin:0; font-size:12px; color:#94a3b8; text-align:center;">${footerText}</p>` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
