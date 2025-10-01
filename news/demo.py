"""
演示脚本 - 不需要API密钥的本地测试
"""

import os
import sys
from datetime import datetime
from pathlib import Path

# 添加src目录到Python路径
sys.path.append('src')

from news_fetcher import NewsArticle
from content_rewriter import ContentRewriter

def create_demo_articles():
    """创建演示用的新闻文章"""
    articles = [
        NewsArticle(
            title="OpenAI Announces GPT-5 with Revolutionary Multimodal Capabilities",
            content="""
            OpenAI today unveiled GPT-5, the latest iteration of its groundbreaking language model series, featuring unprecedented multimodal capabilities that can process text, images, audio, and video simultaneously. The new model demonstrates significant improvements in reasoning, creativity, and real-world problem-solving.

            Key features of GPT-5 include:
            - Enhanced reasoning capabilities with 40% better performance on complex tasks
            - Native multimodal processing without separate encoders
            - Reduced hallucination rates by 60% compared to GPT-4
            - Support for real-time conversation with sub-100ms latency
            - Advanced code generation and debugging capabilities

            "This represents a fundamental leap forward in AI capabilities," said Sam Altman, CEO of OpenAI. "GPT-5 brings us closer to artificial general intelligence while maintaining our commitment to safety and alignment."

            The model will be available through OpenAI's API starting next month, with pricing expected to be competitive with current GPT-4 rates. Early access partners include Microsoft, Google, and several Fortune 500 companies who have been testing the model in production environments.

            Industry experts predict that GPT-5 could accelerate AI adoption across various sectors, from healthcare and education to creative industries and scientific research. The model's improved reasoning capabilities make it particularly suitable for complex analytical tasks and decision-making processes.
            """,
            url="https://example.com/openai-gpt5-announcement",
            published_at=datetime.now(),
            source="TechCrunch",
            author="Sarah Johnson",
            description="OpenAI unveils GPT-5 with revolutionary multimodal capabilities and enhanced reasoning.",
            image_url="https://example.com/gpt5-image.jpg"
        ),
        
        NewsArticle(
            title="Tesla's New AI Chip Promises 10x Performance Boost for Autonomous Driving",
            content="""
            Tesla has revealed its latest custom AI chip, designed specifically for autonomous driving applications, promising a 10x performance improvement over the previous generation. The new chip, dubbed "FSD Chip v4," incorporates advanced neural processing units and optimized memory architecture.

            Technical specifications include:
            - 500 TOPS (Tera Operations Per Second) processing power
            - 50% reduction in power consumption
            - Advanced computer vision processing capabilities
            - Real-time sensor fusion from cameras, radar, and lidar
            - On-chip machine learning inference optimization

            Elon Musk demonstrated the chip's capabilities during Tesla's AI Day event, showing real-time processing of complex driving scenarios with unprecedented accuracy. The chip can process data from multiple sensors simultaneously while running advanced neural networks for path planning and obstacle detection.

            "This chip represents the culmination of years of research into specialized AI hardware," Musk explained. "It's designed from the ground up for the specific requirements of autonomous driving, making it far more efficient than general-purpose processors."

            The new chip will be integrated into all Tesla vehicles starting in Q2 2024, with existing vehicles eligible for hardware upgrades. Tesla also announced plans to license the chip technology to other automotive manufacturers, potentially creating a new revenue stream for the company.

            Automotive industry analysts suggest this development could accelerate the timeline for fully autonomous vehicles, with some predicting Level 5 autonomy could be achieved within the next 3-5 years.
            """,
            url="https://example.com/tesla-ai-chip-announcement",
            published_at=datetime.now(),
            source="The Verge",
            author="Alex Chen",
            description="Tesla unveils new AI chip with 10x performance boost for autonomous driving systems.",
            image_url="https://example.com/tesla-chip-image.jpg"
        ),
        
        NewsArticle(
            title="Google's Quantum Computer Achieves Breakthrough in Error Correction",
            content="""
            Google's quantum computing division has announced a major breakthrough in quantum error correction, successfully demonstrating a logical qubit that maintains coherence for over 100 seconds. This achievement brings practical quantum computing significantly closer to reality.

            The breakthrough involves:
            - Novel error correction algorithms that reduce noise by 99.9%
            - Stable logical qubits using 1000+ physical qubits
            - Demonstration of quantum advantage in real-world problems
            - Scalable architecture for larger quantum systems
            - Integration with classical computing infrastructure

            Dr. Hartmut Neven, head of Google's Quantum AI division, described the achievement as "a watershed moment for quantum computing." The team used their Sycamore quantum processor with advanced error correction protocols to maintain quantum states far longer than previously possible.

            The implications are far-reaching. Quantum computers with reliable error correction could revolutionize fields such as:
            - Drug discovery and molecular simulation
            - Financial modeling and risk analysis
            - Cryptography and cybersecurity
            - Climate modeling and optimization problems
            - Artificial intelligence and machine learning

            Google plans to make this quantum computing capability available through its cloud platform by 2025, initially targeting research institutions and enterprise customers. The company is also collaborating with pharmaceutical companies to explore quantum-enhanced drug discovery applications.

            Competitors including IBM, Microsoft, and Amazon are racing to achieve similar milestones, with the quantum computing market expected to reach $65 billion by 2030 according to recent industry reports.
            """,
            url="https://example.com/google-quantum-breakthrough",
            published_at=datetime.now(),
            source="MIT Technology Review",
            author="Dr. Emily Rodriguez",
            description="Google achieves major quantum error correction breakthrough, bringing practical quantum computing closer.",
            image_url="https://example.com/quantum-computer-image.jpg"
        )
    ]
    
    return articles

def run_demo():
    """运行演示"""
    print("🚀 新闻重写系统演示")
    print("=" * 50)
    
    # 创建输出目录
    output_dir = Path("output")
    output_dir.mkdir(exist_ok=True)
    
    # 创建演示文章
    articles = create_demo_articles()
    
    # 初始化重写器
    rewriter = ContentRewriter()
    
    print(f"📰 准备重写 {len(articles)} 篇演示文章...")
    print()
    
    for i, article in enumerate(articles, 1):
        print(f"✍️ 正在重写第 {i} 篇: {article.title[:50]}...")
        
        try:
            # 重写文章
            rewritten = rewriter.rewrite_article(article)
            
            # 生成文件名
            title_slug = rewritten.title.replace(" ", "_").replace("/", "_").replace("\\", "_")
            title_slug = "".join(c for c in title_slug if c.isalnum() or c in "._-")[:50]
            date_str = datetime.now().strftime("%Y%m%d_%H%M")
            filename = f"demo_{date_str}_{i}_{title_slug}.md"
            
            # 保存文章
            filepath = output_dir / filename
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(f"# {rewritten.title}\n\n")
                f.write(rewritten.content)
            
            print(f"✅ 已保存: {filename}")
            print(f"   📊 标签: {', '.join(rewritten.tags[:5])}")
            print(f"   ⏱️ 阅读时间: {rewritten.reading_time}")
            print(f"   🖼️ 图片建议: {len(rewritten.image_suggestions)} 张")
            print()
            
        except Exception as e:
            print(f"❌ 重写失败: {e}")
            continue
    
    print("🎉 演示完成！")
    print(f"📁 文章已保存到: {output_dir.absolute()}")
    print()
    print("💡 提示:")
    print("1. 查看 output/ 目录中的生成文章")
    print("2. 配置真实的API密钥后可获取实时新闻")
    print("3. 运行 'python src/main.py' 开始正式使用")

if __name__ == "__main__":
    run_demo()
