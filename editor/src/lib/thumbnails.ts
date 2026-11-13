/** 项目路径和图片修订共同组成缓存键；异步读取必须固定到请求时的项目。 */
export function thumbnailKey(projectRoot: string, portrait: string, revision: number): string {
  return JSON.stringify([projectRoot, portrait, revision]);
}

export function createThumbnailCache(loader: (projectRoot: string, portrait: string) => Promise<string>, limit = 300) {
  const cache = new Map<string, Promise<string>>();
  return {
    load(projectRoot: string, portrait: string, revision: number): Promise<string> {
      const key = thumbnailKey(projectRoot, portrait, revision);
      const hit = cache.get(key);
      if (hit) {
        // 保留正在使用的缩略图，按最近访问顺序淘汰。
        cache.delete(key);
        cache.set(key, hit);
        return hit;
      }
      const task = loader(projectRoot, portrait).catch((e: unknown) => {
        // 已淘汰的旧请求可能晚于同键的新请求失败。
        if (cache.get(key) === task) cache.delete(key);
        throw e;
      });
      cache.set(key, task);
      while (cache.size > limit) cache.delete(cache.keys().next().value!);
      return task;
    },
  };
}
