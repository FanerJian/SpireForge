/** bytes → data URL。用 data: 而非 blob:（部分 WebView 的 CSP 会拦 blob: 子资源），
 *  且免去 object URL 的 revoke 生命周期管理。 */
export function bytesToDataUrl(bytes: Uint8Array, ext: string): string {
  const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
    : ext === 'webp' ? 'image/webp' : 'image/png';
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:${mime};base64,${btoa(bin)}`;
}

/** 从相对路径取小写扩展名（无点回落 png） */
export function extOf(rel: string): string {
  return rel.includes('.') ? rel.split('.').pop()!.toLowerCase() : 'png';
}
