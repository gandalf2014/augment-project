/**
 * 设置服务
 */

import type { Setting } from '../types/database';

export class SettingService {
  constructor(private db: D1Database) {}

  // 获取所有设置
  async getSettings(): Promise<Record<string, any>> {
    const result = await this.db.prepare(
      'SELECT key, value, type FROM settings'
    ).all<Setting>();
    
    const settings: Record<string, any> = {};
    
    for (const setting of result.results || []) {
      let value: any = setting.value;
      
      // 根据类型转换值
      switch (setting.type) {
        case 'number':
          value = setting.value ? parseFloat(setting.value) : 0;
          break;
        case 'boolean':
          value = setting.value === 'true';
          break;
        case 'json':
          try {
            value = setting.value ? JSON.parse(setting.value) : null;
          } catch {
            value = null;
          }
          break;
        default:
          value = setting.value || '';
      }
      
      settings[setting.key] = value;
    }
    
    return settings;
  }

  // 获取单个设置
  async getSetting(key: string): Promise<any> {
    const result = await this.db.prepare(
      'SELECT value, type FROM settings WHERE key = ?'
    ).bind(key).first<Pick<Setting, 'value' | 'type'>>();
    
    if (!result) return null;
    
    let value: any = result.value;
    
    // 根据类型转换值
    switch (result.type) {
      case 'number':
        value = result.value ? parseFloat(result.value) : 0;
        break;
      case 'boolean':
        value = result.value === 'true';
        break;
      case 'json':
        try {
          value = result.value ? JSON.parse(result.value) : null;
        } catch {
          value = null;
        }
        break;
      default:
        value = result.value || '';
    }
    
    return value;
  }

  // 设置单个配置
  async setSetting(key: string, value: any, type: 'string' | 'number' | 'boolean' | 'json' = 'string'): Promise<void> {
    let stringValue: string;
    
    // 根据类型转换为字符串
    switch (type) {
      case 'number':
        stringValue = value.toString();
        break;
      case 'boolean':
        stringValue = value ? 'true' : 'false';
        break;
      case 'json':
        stringValue = JSON.stringify(value);
        break;
      default:
        stringValue = value.toString();
    }
    
    await this.db.prepare(`
      INSERT OR REPLACE INTO settings (key, value, type)
      VALUES (?, ?, ?)
    `).bind(key, stringValue, type).run();
  }

  // 批量设置
  async setSettings(settings: Record<string, { value: any; type?: 'string' | 'number' | 'boolean' | 'json' }>): Promise<void> {
    for (const [key, config] of Object.entries(settings)) {
      await this.setSetting(key, config.value, config.type || 'string');
    }
  }

  // 删除设置
  async deleteSetting(key: string): Promise<void> {
    await this.db.prepare('DELETE FROM settings WHERE key = ?').bind(key).run();
  }

  // 获取默认设置
  getDefaultSettings(): Record<string, { value: any; type: 'string' | 'number' | 'boolean' | 'json'; description: string }> {
    return {
      site_title: {
        value: '我的个人博客',
        type: 'string',
        description: '网站标题'
      },
      site_description: {
        value: '分享技术、记录生活的个人博客',
        type: 'string',
        description: '网站描述'
      },
      site_keywords: {
        value: '博客,技术,编程,生活',
        type: 'string',
        description: '网站关键词'
      },
      site_author: {
        value: '博客管理员',
        type: 'string',
        description: '网站作者'
      },
      posts_per_page: {
        value: 10,
        type: 'number',
        description: '每页文章数量'
      },
      allow_comments: {
        value: true,
        type: 'boolean',
        description: '是否允许评论'
      },
      comment_moderation: {
        value: true,
        type: 'boolean',
        description: '评论是否需要审核'
      },
      site_logo: {
        value: '',
        type: 'string',
        description: '网站Logo URL'
      },
      site_favicon: {
        value: '',
        type: 'string',
        description: '网站Favicon URL'
      },
      analytics_code: {
        value: '',
        type: 'string',
        description: '统计代码'
      },
      social_github: {
        value: '',
        type: 'string',
        description: 'GitHub 链接'
      },
      social_twitter: {
        value: '',
        type: 'string',
        description: 'Twitter 链接'
      },
      social_email: {
        value: 'admin@example.com',
        type: 'string',
        description: '联系邮箱'
      }
    };
  }

  // 初始化默认设置
  async initializeDefaultSettings(): Promise<void> {
    const defaultSettings = this.getDefaultSettings();
    
    for (const [key, config] of Object.entries(defaultSettings)) {
      // 检查设置是否已存在
      const existing = await this.getSetting(key);
      if (existing === null) {
        await this.setSetting(key, config.value, config.type);
      }
    }
  }
}
