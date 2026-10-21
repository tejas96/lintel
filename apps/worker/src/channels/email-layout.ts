/**
 * The Lintel email frame: "Linen & Cyanotype" colours (copied from
 * @lintel/design-system tokens; a unit test keeps them in step), system-safe
 * fonts, table layout for every mail client, and a dark scheme for clients
 * that honour `prefers-color-scheme`.
 */
export const EMAIL_COLORS = {
  light: {
    canvas: '#F3EFE7',
    surfaceRaised: '#FFFFFF',
    borderSubtle: '#E3DDD1',
    textPrimary: '#1E1C19',
    textSecondary: '#57524A',
    textTertiary: '#6B645A',
    accent: '#2D44B0',
    onAccent: '#FFFFFF',
    blueprint: '#1C2E80',
    onBlueprint: '#F5F3EE',
  },
  dark: {
    canvas: '#141311',
    surfaceRaised: '#23211D',
    borderSubtle: '#2F2B26',
    textPrimary: '#EFEBE3',
    textSecondary: '#B9B2A6',
    textTertiary: '#948D81',
    accent: '#93A3F5',
    onAccent: '#0F1430',
    blueprint: '#17204D',
    onBlueprint: '#EEF0FB',
  },
} as const;

/** System fonts only: close to the app's Newsreader (display) and Geist (UI). */
export const DISPLAY_FONT = "Georgia, 'Iowan Old Style', 'Times New Roman', serif";
export const UI_FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

const ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Every value placed in the HTML goes through this. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ESCAPES[character] ?? character);
}

export interface EmailFrame {
  /** Shown as the document title and read first by screen readers. */
  readonly title: string;
  /** Hidden preview line most inboxes show after the subject. */
  readonly preheader: string;
  /** Already-escaped HTML for the card. */
  readonly contentHtml: string;
  /** Already-escaped footer HTML (why this email arrived, where to change it). */
  readonly footerHtml: string;
}

const c = EMAIL_COLORS;

const DARK_STYLES = `
  @media (prefers-color-scheme: dark) {
    .lt-canvas { background-color: ${c.dark.canvas} !important; }
    .lt-card { background-color: ${c.dark.surfaceRaised} !important; border-color: ${c.dark.borderSubtle} !important; }
    .lt-ink { color: ${c.dark.textPrimary} !important; }
    .lt-muted { color: ${c.dark.textSecondary} !important; }
    .lt-faint { color: ${c.dark.textTertiary} !important; }
    .lt-rule { border-color: ${c.dark.borderSubtle} !important; }
    .lt-band { background-color: ${c.dark.blueprint} !important; color: ${c.dark.onBlueprint} !important; }
    .lt-link { color: ${c.dark.accent} !important; }
    .lt-button { background-color: ${c.dark.accent} !important; color: ${c.dark.onAccent} !important; }
  }`;

/** A full HTML document around the card content. */
export function renderEmailFrame(frame: EmailFrame): string {
  return `<!doctype html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(frame.title)}</title>
<style>${DARK_STYLES}
  a { text-decoration-thickness: 1px; text-underline-offset: 2px; }
</style>
</head>
<body class="lt-canvas" style="margin:0;padding:0;background-color:${c.light.canvas};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(frame.preheader)}</div>
<table role="presentation" class="lt-canvas" width="100%" cellpadding="0" cellspacing="0" style="background-color:${c.light.canvas};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
<tr><td class="lt-band" style="background-color:${c.light.blueprint};color:${c.light.onBlueprint};padding:14px 24px;border-radius:12px 12px 0 0;font-family:${DISPLAY_FONT};font-size:20px;letter-spacing:0.02em;">Lintel</td></tr>
<tr><td class="lt-card" style="background-color:${c.light.surfaceRaised};border:1px solid ${c.light.borderSubtle};border-top:0;border-radius:0 0 12px 12px;padding:28px 24px;font-family:${UI_FONT};">
${frame.contentHtml}
</td></tr>
<tr><td class="lt-faint" style="padding:20px 8px 0;font-family:${UI_FONT};font-size:13px;line-height:1.5;color:${c.light.textTertiary};">
${frame.footerHtml}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/** The one primary action: a bulletproof link styled as a button. */
export function renderButton(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 4px;"><tr><td class="lt-button" style="background-color:${c.light.accent};border-radius:8px;"><a class="lt-button" href="${escapeHtml(href)}" style="display:inline-block;padding:12px 20px;font-family:${UI_FONT};font-size:15px;font-weight:600;line-height:1.2;color:${c.light.onAccent};text-decoration:none;border-radius:8px;">${escapeHtml(label)}</a></td></tr></table>`;
}

export const STYLES = {
  heading: `margin:0 0 12px;font-family:${DISPLAY_FONT};font-size:24px;line-height:1.3;font-weight:normal;color:${c.light.textPrimary};`,
  subheading: `margin:24px 0 8px;padding-top:16px;border-top:1px solid ${c.light.borderSubtle};font-family:${UI_FONT};font-size:13px;line-height:1.4;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${c.light.textSecondary};`,
  body: `margin:0;font-size:16px;line-height:1.55;color:${c.light.textSecondary};`,
  itemTitle: `font-size:16px;line-height:1.45;font-weight:600;color:${c.light.accent};`,
  itemBody: `margin:2px 0 0;font-size:14px;line-height:1.5;color:${c.light.textSecondary};`,
  footerLink: `color:${c.light.textTertiary};`,
} as const;
