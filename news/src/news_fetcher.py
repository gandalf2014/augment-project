"""
新闻获取模块
支持多个新闻源：NewsAPI、HackerNews、RSS源
"""

import requests
import yaml
import os
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from dataclasses import dataclass
import logging

try:
    import feedparser
    FEEDPARSER_AVAILABLE = True
except ImportError:
    FEEDPARSER_AVAILABLE = False
    print("Warning: feedparser not available, RSS功能将被禁用")

@dataclass
class NewsArticle:
    """新闻文章数据结构"""
    title: str
    content: str
    url: str
    published_at: datetime
    source: str
    author: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None

class NewsFetcher:
    """新闻获取器"""
    
    def __init__(self, config_path: str = "config/config.yaml"):
        self.config = self._load_config(config_path)
        self.logger = logging.getLogger(__name__)
        
    def _load_config(self, config_path: str) -> dict:
        """加载配置文件"""
        with open(config_path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)
    
    def fetch_from_newsapi(self) -> List[NewsArticle]:
        """从NewsAPI获取新闻"""
        articles = []
        config = self.config['news_apis']['newsapi']
        
        # 从环境变量获取API密钥
        api_key = os.getenv('NEWSAPI_KEY')
        if not api_key:
            self.logger.warning("NewsAPI密钥未设置，跳过NewsAPI获取")
            return articles
            
        headers = {'X-API-Key': api_key}
        params = config['params'].copy()
        
        # 设置时间范围（最近24小时）
        from_date = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
        params['from'] = from_date
        
        try:
            response = requests.get(config['url'], headers=headers, params=params)
            response.raise_for_status()
            data = response.json()
            
            for item in data.get('articles', []):
                if item.get('content') and len(item['content']) > 100:
                    # 处理时区问题
                    published_str = item['publishedAt']
                    if published_str.endswith('Z'):
                        published_str = published_str[:-1] + '+00:00'

                    try:
                        published_at = datetime.fromisoformat(published_str)
                        # 转换为naive datetime（移除时区信息）
                        if published_at.tzinfo is not None:
                            published_at = published_at.replace(tzinfo=None)
                    except:
                        published_at = datetime.now()

                    article = NewsArticle(
                        title=item['title'],
                        content=item['content'],
                        url=item['url'],
                        published_at=published_at,
                        source=f"NewsAPI - {item['source']['name']}",
                        author=item.get('author'),
                        description=item.get('description'),
                        image_url=item.get('urlToImage')
                    )
                    articles.append(article)
                    
        except Exception as e:
            self.logger.error(f"NewsAPI获取失败: {e}")
            
        return articles
    
    def fetch_from_hackernews(self) -> List[NewsArticle]:
        """从HackerNews获取新闻"""
        articles = []
        config = self.config['news_apis']['hackernews']
        
        try:
            # 获取热门故事ID
            top_stories_url = config['url'] + config['top_stories']
            response = requests.get(top_stories_url)
            response.raise_for_status()
            story_ids = response.json()[:config['max_stories']]
            
            for story_id in story_ids:
                item_url = config['url'] + config['item'].format(story_id)
                item_response = requests.get(item_url)
                item_response.raise_for_status()
                item_data = item_response.json()
                
                if item_data and item_data.get('type') == 'story' and item_data.get('url'):
                    # 尝试获取文章内容
                    content = self._fetch_article_content(item_data['url'])
                    if content and len(content) > 200:
                        article = NewsArticle(
                            title=item_data['title'],
                            content=content,
                            url=item_data['url'],
                            published_at=datetime.fromtimestamp(item_data['time']),
                            source="HackerNews",
                            author=item_data.get('by'),
                            description=item_data.get('text', '')[:200] + '...' if item_data.get('text') else None
                        )
                        articles.append(article)
                        
        except Exception as e:
            self.logger.error(f"HackerNews获取失败: {e}")
            
        return articles
    
    def fetch_from_rss(self) -> List[NewsArticle]:
        """从RSS源获取新闻"""
        articles = []

        if not FEEDPARSER_AVAILABLE:
            self.logger.warning("feedparser不可用，跳过RSS获取")
            return articles

        for feed_config in self.config['rss_feeds']:
            try:
                feed = feedparser.parse(feed_config['url'])

                for entry in feed.entries[:5]:  # 每个源最多5篇
                    # 获取文章内容
                    content = self._fetch_article_content(entry.link)
                    if content and len(content) > 200:
                        published_at = datetime.now()
                        if hasattr(entry, 'published_parsed') and entry.published_parsed:
                            published_at = datetime(*entry.published_parsed[:6])

                        article = NewsArticle(
                            title=entry.title,
                            content=content,
                            url=entry.link,
                            published_at=published_at,
                            source=f"RSS - {feed_config['name']}",
                            author=entry.get('author'),
                            description=entry.get('summary', '')[:200] + '...' if entry.get('summary') else None
                        )
                        articles.append(article)

            except Exception as e:
                self.logger.error(f"RSS源 {feed_config['name']} 获取失败: {e}")

        return articles
    
    def _fetch_article_content(self, url: str) -> Optional[str]:
        """获取文章完整内容"""
        try:
            from bs4 import BeautifulSoup
            
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # 移除脚本和样式
            for script in soup(["script", "style"]):
                script.decompose()
            
            # 尝试找到主要内容
            content_selectors = [
                'article', '.article-content', '.post-content', 
                '.entry-content', '.content', 'main', '.main-content'
            ]
            
            content = ""
            for selector in content_selectors:
                elements = soup.select(selector)
                if elements:
                    content = elements[0].get_text(strip=True)
                    break
            
            if not content:
                # 如果没找到特定容器，获取所有段落
                paragraphs = soup.find_all('p')
                content = ' '.join([p.get_text(strip=True) for p in paragraphs])
            
            return content if len(content) > 100 else None
            
        except Exception as e:
            self.logger.debug(f"获取文章内容失败 {url}: {e}")
            return None
    
    def fetch_all_news(self) -> List[NewsArticle]:
        """获取所有源的新闻"""
        all_articles = []
        
        self.logger.info("开始获取新闻...")
        
        # 从各个源获取新闻
        all_articles.extend(self.fetch_from_newsapi())
        all_articles.extend(self.fetch_from_hackernews())
        all_articles.extend(self.fetch_from_rss())
        
        # 去重和过滤
        filtered_articles = self._filter_articles(all_articles)
        
        self.logger.info(f"共获取到 {len(filtered_articles)} 篇有效新闻")
        return filtered_articles
    
    def _filter_articles(self, articles: List[NewsArticle]) -> List[NewsArticle]:
        """过滤和去重文章"""
        # 去重（基于标题相似度）
        unique_articles = []
        seen_titles = set()
        
        for article in articles:
            title_key = article.title.lower().strip()
            if title_key not in seen_titles:
                seen_titles.add(title_key)
                
                # 内容质量过滤
                if self._is_quality_article(article):
                    unique_articles.append(article)
        
        # 按发布时间排序
        unique_articles.sort(key=lambda x: x.published_at, reverse=True)
        
        return unique_articles
    
    def _is_quality_article(self, article: NewsArticle) -> bool:
        """判断文章质量"""
        config = self.config['filters']
        
        # 长度检查
        if len(article.content) < 200:
            return False
        
        # 关键词包含检查
        title_content = (article.title + ' ' + article.content).lower()
        
        has_include_keyword = any(
            keyword.lower() in title_content 
            for keyword in config['keywords_include']
        )
        
        has_exclude_keyword = any(
            keyword.lower() in title_content 
            for keyword in config['keywords_exclude']
        )
        
        return has_include_keyword and not has_exclude_keyword
