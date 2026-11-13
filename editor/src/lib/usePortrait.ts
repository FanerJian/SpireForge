import { useEffect, useState } from 'react';
import { api } from './tauri';
import { bytesToDataUrl, extOf } from './img';
import { thumbnailKey } from './thumbnails';

/** 图片只随路径/文件修订读取，字段输入保持当前预览；请求始终绑定发起时的项目。 */
export function usePortrait(projectRoot: string | null, portrait: string | null | undefined, revision: number): string | null {
  const key = thumbnailKey(projectRoot ?? '', portrait ?? '', revision);
  const [image, setImage] = useState<{ key: string; url: string } | null>(null);
  useEffect(() => {
    if (!projectRoot || !portrait) return;
    let cancelled = false;
    api.readPortrait(portrait, projectRoot).then(bytes => {
      if (!cancelled) setImage({ key, url: bytesToDataUrl(new Uint8Array(bytes), extOf(portrait)) });
    }).catch(() => { if (!cancelled) setImage(null); });
    return () => { cancelled = true; };
  }, [key, projectRoot, portrait]);
  return image?.key === key ? image.url : null;
}
