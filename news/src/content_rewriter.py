"""
内容重写模块
将新闻内容重写为吸引人的自媒体文章
"""

import re
import yaml
import logging
from typing import List, Dict, Optional
from dataclasses import dataclass
from datetime import datetime
import sys
import os

# 添加src目录到Python路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from news_fetcher import NewsArticle
from translator import ContentTranslator

@dataclass
class RewrittenArticle:
    """重写后的文章"""
    original_article: NewsArticle
    title: str
    content: str
    tags: List[str]
    image_suggestions: List[Dict[str, str]]
    reading_time: str
    created_at: datetime

class ContentRewriter:
    """内容重写器"""
    
    def __init__(self, config_path: str = "config/config.yaml", enable_translation: bool = True):
        self.config = self._load_config(config_path)
        self.logger = logging.getLogger(__name__)
        self.enable_translation = enable_translation

        # 初始化翻译器
        if enable_translation:
            self.translator = ContentTranslator('simple')  # 使用免费翻译服务
            self.logger.info("翻译功能已启用")
        
    def _load_config(self, config_path: str) -> dict:
        """加载配置文件"""
        with open(config_path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)
    
    def rewrite_article(self, article: NewsArticle) -> RewrittenArticle:
        """重写单篇文章"""
        self.logger.info(f"开始重写文章: {article.title}")
        
        # 分析原文
        analysis = self._analyze_content(article)
        
        # 生成新标题
        new_title = self._generate_title(article, analysis)
        
        # 重写内容
        new_content = self._rewrite_content(article, analysis)

        # 翻译英文内容
        if self.enable_translation:
            self.logger.info("正在翻译文章中的英文内容...")
            new_content = self.translator.translate_article_content(new_content)

        # 生成标签
        tags = self._generate_tags(article, analysis)
        
        # 生成图片建议
        image_suggestions = self._generate_image_suggestions(article, analysis)
        
        # 计算阅读时间
        reading_time = self._calculate_reading_time(new_content)
        
        return RewrittenArticle(
            original_article=article,
            title=new_title,
            content=new_content,
            tags=tags,
            image_suggestions=image_suggestions,
            reading_time=reading_time,
            created_at=datetime.now()
        )
    
    def _analyze_content(self, article: NewsArticle) -> Dict:
        """分析文章内容"""
        content = article.title + ' ' + article.content
        
        # 关键词提取
        keywords = self._extract_keywords(content)
        
        # 主题分类
        topic = self._classify_topic(content)
        
        # 情感分析
        sentiment = self._analyze_sentiment(content)
        
        # 核心要点提取
        key_points = self._extract_key_points(article.content)
        
        return {
            'keywords': keywords,
            'topic': topic,
            'sentiment': sentiment,
            'key_points': key_points,
            'word_count': len(content.split()),
            'has_data': self._has_data_or_numbers(content),
            'companies_mentioned': self._extract_companies(content),
            'tech_terms': self._extract_tech_terms(content)
        }
    
    def _extract_keywords(self, content: str) -> List[str]:
        """提取关键词"""
        # 简单的关键词提取（实际项目中可以使用更复杂的NLP库）
        tech_keywords = [
            'AI', '人工智能', 'ChatGPT', 'OpenAI', 'Google', 'Microsoft', 
            'Apple', 'Meta', 'Tesla', '机器学习', '深度学习', '神经网络',
            '自动驾驶', '云计算', '大数据', '区块链', '元宇宙', 'VR', 'AR',
            '5G', '物联网', 'IoT', '芯片', '半导体', '量子计算'
        ]
        
        found_keywords = []
        content_lower = content.lower()
        
        for keyword in tech_keywords:
            if keyword.lower() in content_lower:
                found_keywords.append(keyword)
                
        return found_keywords[:10]  # 最多返回10个关键词
    
    def _classify_topic(self, content: str) -> str:
        """分类主题"""
        content_lower = content.lower()
        
        topics = {
            'AI': ['ai', 'artificial intelligence', '人工智能', 'chatgpt', 'openai', '机器学习'],
            '科技公司': ['google', 'microsoft', 'apple', 'meta', 'tesla', 'amazon'],
            '移动技术': ['iphone', 'android', '5g', '手机', 'mobile'],
            '云计算': ['cloud', '云计算', 'aws', 'azure', '云服务'],
            '自动驾驶': ['autonomous', 'self-driving', '自动驾驶', 'tesla'],
            '芯片半导体': ['chip', 'semiconductor', '芯片', '半导体', 'nvidia'],
            '元宇宙': ['metaverse', 'vr', 'ar', '元宇宙', '虚拟现实'],
            '区块链': ['blockchain', 'crypto', 'bitcoin', '区块链', '加密货币']
        }
        
        for topic, keywords in topics.items():
            if any(keyword in content_lower for keyword in keywords):
                return topic
                
        return '科技'
    
    def _analyze_sentiment(self, content: str) -> str:
        """分析情感倾向"""
        positive_words = ['breakthrough', 'innovation', 'success', 'growth', 'improve', '突破', '创新', '成功']
        negative_words = ['problem', 'issue', 'decline', 'fail', 'concern', '问题', '下降', '失败']
        
        content_lower = content.lower()
        positive_count = sum(1 for word in positive_words if word in content_lower)
        negative_count = sum(1 for word in negative_words if word in content_lower)
        
        if positive_count > negative_count:
            return 'positive'
        elif negative_count > positive_count:
            return 'negative'
        else:
            return 'neutral'
    
    def _extract_key_points(self, content: str) -> List[str]:
        """提取核心要点"""
        # 简单的要点提取：找到包含关键信息的句子
        sentences = re.split(r'[.!?。！？]', content)
        key_sentences = []
        
        important_patterns = [
            r'\d+%',  # 百分比
            r'\$\d+',  # 金额
            r'\d+\s*(million|billion|万|亿)',  # 大数字
            r'(announced|released|launched|发布|宣布)',  # 发布动词
            r'(first|new|latest|最新|首个|新的)',  # 新颖性
        ]
        
        for sentence in sentences:
            sentence = sentence.strip()
            if len(sentence) > 20 and any(re.search(pattern, sentence, re.IGNORECASE) for pattern in important_patterns):
                key_sentences.append(sentence)
                
        return key_sentences[:5]  # 最多5个要点
    
    def _has_data_or_numbers(self, content: str) -> bool:
        """检查是否包含数据或数字"""
        number_patterns = [r'\d+%', r'\$\d+', r'\d+\s*(million|billion|万|亿)', r'\d{4}年']
        return any(re.search(pattern, content) for pattern in number_patterns)
    
    def _extract_companies(self, content: str) -> List[str]:
        """提取提到的公司"""
        companies = [
            'Google', 'Microsoft', 'Apple', 'Meta', 'Tesla', 'Amazon', 
            'OpenAI', 'NVIDIA', 'Intel', 'AMD', 'Samsung', 'Huawei',
            '谷歌', '微软', '苹果', '特斯拉', '亚马逊', '英伟达'
        ]
        
        found_companies = []
        content_lower = content.lower()
        
        for company in companies:
            if company.lower() in content_lower:
                found_companies.append(company)
                
        return found_companies
    
    def _extract_tech_terms(self, content: str) -> List[str]:
        """提取技术术语"""
        tech_terms = [
            'machine learning', 'deep learning', 'neural network', 'algorithm',
            'cloud computing', 'big data', 'blockchain', 'quantum computing',
            '机器学习', '深度学习', '神经网络', '算法', '云计算', '大数据'
        ]
        
        found_terms = []
        content_lower = content.lower()
        
        for term in tech_terms:
            if term.lower() in content_lower:
                found_terms.append(term)
                
        return found_terms
    
    def _generate_title(self, article: NewsArticle, analysis: Dict) -> str:
        """生成吸引人的标题"""
        original_title = article.title
        topic = analysis['topic']
        sentiment = analysis['sentiment']
        companies = analysis['companies_mentioned']
        
        # 标题模板
        templates = {
            'AI': [
                "🚀 AI再次突破！{company}最新{tech}技术震撼发布",
                "💡 {tech}新突破：这项AI技术将改变{industry}",
                "🔥 {company}AI大动作：{tech}技术引发行业震动",
                "⚡ AI界重磅消息：{tech}技术实现重大突破"
            ],
            '科技公司': [
                "📱 {company}重磅发布：{product}功能让人惊艳",
                "💰 {company}最新财报：{data}背后的商业逻辑",
                "🎯 {company}战略大调整：{strategy}意味着什么？",
                "🌟 {company}新动向：{innovation}将如何影响市场？"
            ],
            'default': [
                "🔥 科技圈重磅消息：{topic}领域迎来重大变革",
                "💡 行业震动：{topic}技术突破带来新机遇",
                "⚡ {topic}新突破：这项技术将改变游戏规则",
                "🚀 {topic}重大进展：未来已来？"
            ]
        }
        
        # 选择合适的模板
        topic_templates = templates.get(topic, templates['default'])
        
        # 填充模板变量
        company = companies[0] if companies else "科技巨头"
        tech = analysis['tech_terms'][0] if analysis['tech_terms'] else "新技术"
        
        # 简化版：直接优化原标题
        if len(original_title) > 30:
            # 标题太长，提取核心
            core_words = analysis['keywords'][:2]
            if core_words:
                return f"🔥 {' '.join(core_words)}重大突破：行业迎来新变革"
        
        # 添加emoji和吸引力词汇
        emoji_map = {
            'positive': '🚀',
            'negative': '⚠️',
            'neutral': '📊'
        }
        
        emoji = emoji_map.get(sentiment, '🔥')
        return f"{emoji} {original_title}"
    
    def _rewrite_content(self, article: NewsArticle, analysis: Dict) -> str:
        """重写文章内容"""
        # 构建markdown内容
        content_parts = []
        
        # 封面图建议
        content_parts.append("![封面图：科技新闻配图](cover_image_placeholder)")
        content_parts.append("")
        
        # 引言段落（Hook）
        hook = self._generate_hook(article, analysis)
        content_parts.append(hook)
        content_parts.append("")
        
        # 核心内容
        content_parts.append("## 📰 事件回顾")
        content_parts.append("")
        
        # 重写主要内容
        main_content = self._rewrite_main_content(article, analysis)
        content_parts.append(main_content)
        content_parts.append("")
        
        # 添加配图
        content_parts.append("![相关配图：技术示意图](content_image_placeholder)")
        content_parts.append("")
        
        # 行业分析
        content_parts.append("## 🔍 深度分析")
        content_parts.append("")
        
        industry_analysis = self._generate_industry_analysis(article, analysis)
        content_parts.append(industry_analysis)
        content_parts.append("")
        
        # 未来展望
        content_parts.append("## 🚀 未来展望")
        content_parts.append("")
        
        future_outlook = self._generate_future_outlook(article, analysis)
        content_parts.append(future_outlook)
        content_parts.append("")
        
        # 总结配图
        content_parts.append("![总结配图：未来科技趋势](summary_image_placeholder)")
        content_parts.append("")
        
        # 标签和来源
        tags_str = " ".join([f"#{tag}" for tag in analysis['keywords'][:5]])
        content_parts.append("---")
        content_parts.append(f"**标签：** {tags_str}")
        content_parts.append(f"**原文来源：** [{article.source}]({article.url})")
        
        return "\n".join(content_parts)
    
    def _generate_hook(self, article: NewsArticle, analysis: Dict) -> str:
        """生成引言Hook"""
        topic = analysis['topic']
        companies = analysis['companies_mentioned']
        
        hooks = {
            'AI': f"人工智能领域又有重大突破！{companies[0] if companies else '科技巨头'}最新发布的技术让整个行业为之震动。这项创新不仅展示了AI技术的最新进展，更预示着未来科技发展的新方向。",
            '科技公司': f"科技圈再次迎来重磅消息！{companies[0] if companies else '知名科技公司'}的最新动向引发了业界广泛关注。这背后究竟隐藏着怎样的商业逻辑和技术革新？",
            'default': "科技世界从不缺少惊喜！最新的行业动态再次证明，技术创新的步伐永远不会停歇。让我们一起来看看这次又有什么令人兴奋的发现。"
        }
        
        return hooks.get(topic, hooks['default'])
    
    def _rewrite_main_content(self, article: NewsArticle, analysis: Dict) -> str:
        """重写主要内容"""
        # 提取关键信息
        key_points = analysis['key_points']
        
        # 重新组织内容
        content_parts = []
        
        if key_points:
            content_parts.append("**核心要点：**")
            for i, point in enumerate(key_points[:3], 1):
                content_parts.append(f"{i}. {point}")
            content_parts.append("")
        
        # 简化和重写原文内容
        original_content = article.content
        if len(original_content) > 500:
            # 提取前几段作为主要内容
            paragraphs = original_content.split('\n')
            main_paragraphs = [p.strip() for p in paragraphs if len(p.strip()) > 50][:3]
            simplified_content = '\n\n'.join(main_paragraphs)
        else:
            simplified_content = original_content
        
        content_parts.append(simplified_content)
        
        return '\n'.join(content_parts)
    
    def _generate_industry_analysis(self, article: NewsArticle, analysis: Dict) -> str:
        """生成行业分析"""
        topic = analysis['topic']
        sentiment = analysis['sentiment']
        
        analysis_templates = {
            'AI': "这项AI技术的突破意义重大。从技术角度来看，它代表了人工智能在实际应用中的又一次重要进步。对于整个行业而言，这种创新将推动相关领域的快速发展，同时也为其他科技公司树立了新的标杆。",
            '科技公司': "从商业角度分析，这一动向反映了科技公司在激烈竞争中的战略布局。无论是技术创新还是市场扩张，都体现了企业对未来趋势的深度思考和前瞻性布局。",
            'default': "这一发展趋势值得我们深入思考。技术进步不仅改变了行业格局，也为普通用户带来了更多可能性。从长远来看，这种创新将推动整个科技生态的持续演进。"
        }
        
        base_analysis = analysis_templates.get(topic, analysis_templates['default'])
        
        # 根据情感倾向调整分析
        if sentiment == 'positive':
            base_analysis += "\n\n**个人观点：** 这是一个非常积极的信号，预示着该领域将迎来新一轮的快速发展期。"
        elif sentiment == 'negative':
            base_analysis += "\n\n**个人观点：** 虽然面临一些挑战，但这也为行业提供了反思和改进的机会。"
        
        return base_analysis
    
    def _generate_future_outlook(self, article: NewsArticle, analysis: Dict) -> str:
        """生成未来展望"""
        topic = analysis['topic']
        
        outlooks = {
            'AI': "人工智能的发展永远充满想象空间。随着技术的不断成熟，我们有理由相信，AI将在更多领域发挥重要作用，为人类社会带来更大价值。",
            '科技公司': "科技公司的每一次创新都在推动行业边界的扩展。未来，我们期待看到更多突破性的产品和服务，为用户创造更好的体验。",
            'default': "技术发展的脚步从未停歇。展望未来，这一领域还将涌现出更多令人惊喜的创新，值得我们持续关注。"
        }
        
        base_outlook = outlooks.get(topic, outlooks['default'])
        
        # 添加思考问题
        base_outlook += "\n\n**思考：** 你认为这项技术/发展对我们的日常生活会产生什么影响？欢迎在评论区分享你的看法！"
        
        return base_outlook
    
    def _generate_tags(self, article: NewsArticle, analysis: Dict) -> List[str]:
        """生成标签"""
        tags = ['科技']
        
        # 添加主题标签
        if analysis['topic']:
            tags.append(analysis['topic'])
        
        # 添加关键词标签
        tags.extend(analysis['keywords'][:3])
        
        # 添加公司标签
        tags.extend(analysis['companies_mentioned'][:2])
        
        # 去重并限制数量
        unique_tags = list(dict.fromkeys(tags))  # 保持顺序的去重
        return unique_tags[:8]
    
    def _generate_image_suggestions(self, article: NewsArticle, analysis: Dict) -> List[Dict[str, str]]:
        """生成图片建议"""
        suggestions = []
        
        # 封面图
        suggestions.append({
            "type": "封面图",
            "description": f"科技新闻封面图，主题：{analysis['topic']}，风格：现代科技感，包含相关元素如电路板、数据流、未来感设计",
            "placeholder": "cover_image_placeholder"
        })
        
        # 内容配图
        if analysis['companies_mentioned']:
            suggestions.append({
                "type": "公司logo配图",
                "description": f"{analysis['companies_mentioned'][0]}公司logo或产品图片，高清，官方风格",
                "placeholder": "company_image_placeholder"
            })
        
        # 技术示意图
        if analysis['tech_terms']:
            suggestions.append({
                "type": "技术示意图",
                "description": f"{analysis['tech_terms'][0]}技术原理图或示意图，清晰易懂，配有标注说明",
                "placeholder": "tech_diagram_placeholder"
            })
        
        # 数据图表
        if analysis['has_data']:
            suggestions.append({
                "type": "数据图表",
                "description": "相关数据的可视化图表，柱状图或折线图，清晰的数据展示",
                "placeholder": "data_chart_placeholder"
            })
        
        # 总结配图
        suggestions.append({
            "type": "总结配图",
            "description": "未来科技趋势概念图，包含多种科技元素，体现创新和发展方向",
            "placeholder": "summary_image_placeholder"
        })
        
        return suggestions
    
    def _calculate_reading_time(self, content: str) -> str:
        """计算阅读时间"""
        word_count = len(content.split())
        # 假设每分钟阅读200个单词
        minutes = max(1, round(word_count / 200))
        return f"{minutes}分钟"
