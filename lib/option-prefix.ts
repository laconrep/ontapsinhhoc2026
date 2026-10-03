const PREFIX_RE = /^[A-Da-d][.)]\s*/

export function stripOptionPrefix(s: string): string {
  return s.replace(PREFIX_RE, "")
}

export function stripOptionPrefixHtml(html: string): string {
  return html.replace(/^(<p>)?[A-Da-d][.)]\s*/, (_, p: string | undefined) => p ?? "")
}
