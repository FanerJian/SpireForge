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
      if (hit) return hit;
      const task = loader(projectRoot, portrait).catch((e: unknown) => { cache.delete(key); throw e; });
      cache.set(key, task);
      while (cache.size > limit) cache.delete(cache.keys().next().value!);
      return task;
    },
  };
}
