"""
主程序入口
新闻获取和重写系统的命令行界面
"""

import os
import sys
import logging
import click
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv
from rich.console import Console
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn

# 添加src目录到Python路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from news_fetcher import NewsFetcher
from content_rewriter import ContentRewriter

# 加载环境变量
load_dotenv()

# 设置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

console = Console()

class NewsRewriterApp:
    """新闻重写应用"""

    def __init__(self, enable_translation: bool = True):
        # 获取项目根目录
        project_root = Path(__file__).parent.parent
        config_path = project_root / "config" / "config.yaml"

        self.fetcher = NewsFetcher(str(config_path))
        self.rewriter = ContentRewriter(str(config_path), enable_translation)
        self.output_dir = project_root / "output"
        self.output_dir.mkdir(exist_ok=True)
    
    def run(self, max_articles: int = 5, topic_filter: str = None):
        """运行新闻获取和重写流程"""
        console.print("🚀 [bold blue]新闻重写系统启动[/bold blue]")
        console.print()
        
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:
            
            # 获取新闻
            task1 = progress.add_task("📰 获取最新新闻...", total=None)
            articles = self.fetcher.fetch_all_news()
            progress.update(task1, completed=True)
            
            if not articles:
                console.print("❌ [red]未获取到任何新闻，请检查API配置[/red]")
                return
            
            console.print(f"✅ 成功获取 {len(articles)} 篇新闻")
            
            # 过滤主题
            if topic_filter:
                articles = [a for a in articles if topic_filter.lower() in a.title.lower() or topic_filter.lower() in a.content.lower()]
                console.print(f"🔍 主题过滤后剩余 {len(articles)} 篇新闻")
            
            # 限制数量
            articles = articles[:max_articles]
            
            # 显示新闻列表
            self._display_articles_table(articles)
            
            # 重写文章
            task2 = progress.add_task("✍️ 重写文章内容...", total=len(articles))
            
            rewritten_articles = []
            for i, article in enumerate(articles):
                try:
                    rewritten = self.rewriter.rewrite_article(article)
                    rewritten_articles.append(rewritten)
                    
                    # 保存文章
                    self._save_article(rewritten)
                    
                    progress.update(task2, advance=1)
                    
                except Exception as e:
                    console.print(f"❌ 重写文章失败: {article.title[:50]}... - {e}")
                    progress.update(task2, advance=1)
                    continue
            
            progress.update(task2, completed=True)
        
        console.print()
        console.print(f"🎉 [bold green]完成！成功重写 {len(rewritten_articles)} 篇文章[/bold green]")
        console.print(f"📁 文章已保存到: {self.output_dir.absolute()}")
        
        # 显示重写结果
        self._display_results_table(rewritten_articles)
    
    def _display_articles_table(self, articles):
        """显示新闻列表"""
        table = Table(title="📰 获取到的新闻")
        table.add_column("序号", style="cyan", no_wrap=True)
        table.add_column("标题", style="magenta")
        table.add_column("来源", style="green")
        table.add_column("发布时间", style="yellow")
        
        for i, article in enumerate(articles, 1):
            title = article.title[:50] + "..." if len(article.title) > 50 else article.title
            published = article.published_at.strftime("%m-%d %H:%M")
            table.add_row(str(i), title, article.source, published)
        
        console.print(table)
        console.print()
    
    def _display_results_table(self, rewritten_articles):
        """显示重写结果"""
        table = Table(title="✍️ 重写结果")
        table.add_column("文章", style="cyan")
        table.add_column("新标题", style="magenta")
        table.add_column("标签", style="green")
        table.add_column("阅读时间", style="yellow")
        table.add_column("文件名", style="blue")
        
        for article in rewritten_articles:
            title = article.title[:40] + "..." if len(article.title) > 40 else article.title
            tags = ", ".join(article.tags[:3])
            filename = self._generate_filename(article)
            
            table.add_row(
                article.original_article.source.split(" - ")[0],
                title,
                tags,
                article.reading_time,
                filename
            )
        
        console.print(table)
    
    def _save_article(self, article):
        """保存重写后的文章"""
        filename = self._generate_filename(article)
        filepath = self.output_dir / filename
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(f"# {article.title}\n\n")
            f.write(article.content)
        
        console.print(f"💾 已保存: {filename}")
    
    def _generate_filename(self, article):
        """生成文件名"""
        # 清理标题作为文件名
        title_slug = article.title.replace(" ", "_").replace("/", "_").replace("\\", "_")
        # 移除特殊字符
        title_slug = "".join(c for c in title_slug if c.isalnum() or c in "._-")
        # 限制长度
        title_slug = title_slug[:50]
        
        date_str = article.created_at.strftime("%Y%m%d_%H%M")
        return f"{date_str}_{title_slug}.md"

@click.command()
@click.option('--max-articles', '-n', default=5, help='最大文章数量')
@click.option('--topic', '-t', help='主题过滤关键词')
@click.option('--config', '-c', default='config/config.yaml', help='配置文件路径')
@click.option('--no-translate', is_flag=True, help='禁用自动翻译功能')
def main(max_articles, topic, config, no_translate):
    """
    新闻重写系统 - 自动获取科技新闻并重写为自媒体内容

    示例:
    python main.py -n 3 -t AI
    python main.py --max-articles 10 --topic "人工智能"
    python main.py -n 5 --no-translate  # 禁用翻译
    """
    try:
        enable_translation = not no_translate
        app = NewsRewriterApp(enable_translation)
        app.run(max_articles=max_articles, topic_filter=topic)
    except KeyboardInterrupt:
        console.print("\n👋 用户取消操作")
    except Exception as e:
        console.print(f"❌ [red]程序运行出错: {e}[/red]")
        logging.exception("程序异常")

if __name__ == "__main__":
    main()
