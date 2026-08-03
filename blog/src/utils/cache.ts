/**
 * 缓存服务
 * 支持 KV 存储和内存缓存
 */

export interface CacheOptions {
  ttl?: number;           // 缓存时间（秒）
  prefix?: string;        // 键前缀
  forceRefresh?: boolean; // 强制刷新
}

export class CacheService {
  private memoryCache: Map<string, { data: any; expires: number }> = new Map();
  private kv: KVNamespace | null;
  private defaultTTL: number;

  constructor(kv?: KVNamespace, defaultTTL: number = 3600) {
    this.kv = kv || null;
    this.defaultTTL = defaultTTL;
  }

  /**
   * 获取缓存
   */
  async get<T>(key: string): Promise<T | null> {
    const fullKey = key;

    // 先检查内存缓存
    const memCached = this.memoryCache.get(fullKey);
    if (memCached && memCached.expires > Date.now()) {
      return memCached.data as T;
    }

    // 检查 KV 缓存
    if (this.kv) {
      try {
        const kvData = await this.kv.get(fullKey, 'json');
        if (kvData) {
          // 更新内存缓存
          this.memoryCache.set(fullKey, {
            data: kvData,
            expires: Date.now() + 60000 // 内存缓存 1 分钟
          });
          return kvData as T;
        }
      } catch (error) {
        console.error('KV get error:', error);
      }
    }

    return null;
  }

  /**
   * 设置缓存
   */
  async set(key: string, data: any, ttl?: number): Promise<void> {
    const cacheTTL = ttl || this.defaultTTL;
    const fullKey = key;

    // 更新内存缓存
    this.memoryCache.set(fullKey, {
      data,
      expires: Date.now() + Math.min(cacheTTL * 1000, 60000) // 内存缓存最多 1 分钟
    });

    // 更新 KV 缓存
    if (this.kv) {
      try {
        await this.kv.put(fullKey, JSON.stringify(data), {
          expirationTtl: cacheTTL
        });
      } catch (error) {
        console.error('KV set error:', error);
      }
    }
  }

  /**
   * 删除缓存
   */
  async delete(key: string): Promise<void> {
    const fullKey = key;

    // 删除内存缓存
    this.memoryCache.delete(fullKey);

    // 删除 KV 缓存
    if (this.kv) {
      try {
        await this.kv.delete(fullKey);
      } catch (error) {
        console.error('KV delete error:', error);
      }
    }
  }

  /**
   * 删除匹配前缀的所有缓存
   */
  async deleteByPrefix(prefix: string): Promise<void> {
    // 删除内存缓存
    for (const key of this.memoryCache.keys()) {
      if (key.startsWith(prefix)) {
        this.memoryCache.delete(key);
      }
    }

    // KV 不支持批量删除，需要单独处理
    if (this.kv) {
      try {
        const list = await this.kv.list({ prefix });
        for (const key of list.keys) {
          await this.kv.delete(key.name);
        }
      } catch (error) {
        console.error('KV deleteByPrefix error:', error);
      }
    }
  }

  /**
   * 获取或设置缓存（常用模式）
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const { ttl, forceRefresh } = options;

    // 强制刷新或获取缓存
    if (!forceRefresh) {
      const cached = await this.get<T>(key);
      if (cached !== null) {
        return cached;
      }
    }

    // 获取新数据
    const data = await fetcher();

    // 设置缓存
    await this.set(key, data, ttl);

    return data;
  }

  /**
   * 清理过期的内存缓存
   */
  cleanupMemoryCache(): void {
    const now = Date.now();
    for (const [key, value] of this.memoryCache.entries()) {
      if (value.expires <= now) {
        this.memoryCache.delete(key);
      }
    }
  }
}

// 缓存键生成器
export const CacheKeys = {
  post: (id: number) => `post:${id}`,
  postBySlug: (slug: string) => `post:slug:${slug}`,
  postsList: (params: any) => `posts:list:${JSON.stringify(params)}`,
  category: (id: number) => `category:${id}`,
  categoryBySlug: (slug: string) => `category:slug:${slug}`,
  categories: () => 'categories:all',
  tag: (id: number) => `tag:${id}`,
  tagBySlug: (slug: string) => `tag:slug:${slug}`,
  tags: () => 'tags:all',
  popularTags: (limit: number) => `tags:popular:${limit}`,
  comments: (postId: number) => `comments:post:${postId}`,
  settings: () => 'settings:all',
  page: (slug: string) => `page:${slug}`,
};

// 单例缓存实例
let cacheInstance: CacheService | null = null;

export function getCache(kv?: KVNamespace): CacheService {
  if (!cacheInstance) {
    cacheInstance = new CacheService(kv);
  }
  return cacheInstance;
}