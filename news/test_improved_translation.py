"""
改进后的翻译功能测试
"""

import sys
sys.path.append('src')

from translator import ContentTranslator

def test_improved_translation():
    """测试改进后的翻译功能"""
    print("🔄 测试改进后的翻译功能...")
    
    # 创建翻译器
    translator = ContentTranslator('simple')
    
    # 测试包含大量英文的内容
    test_content = """
# 🚀 AI技术突破

![封面图：科技新闻配图](cover_image_placeholder)

人工智能领域又有重大突破！

## 📰 事件回顾

**核心要点：**
1. OpenAI today unveiled GPT-5, the latest iteration of its groundbreaking language model series, featuring unprecedented multimodal capabilities that can process text, images, audio, and video simultaneously.
2. The new model demonstrates significant improvements in reasoning, creativity, and real-world problem-solving with enhanced performance metrics.
3. Key features include enhanced reasoning capabilities with 40% better performance on complex tasks, native multimodal processing without separate encoders, and reduced hallucination rates by 60% compared to GPT-4.

This represents a fundamental leap forward in AI capabilities, said Sam Altman, CEO of OpenAI. The company believes this technology will accelerate AI adoption across various sectors, from healthcare and education to creative industries and scientific research.

The model will be available through OpenAI's API starting next month, with pricing expected to be competitive with current GPT-4 rates. Early access partners include Microsoft, Google, and several Fortune 500 companies who have been testing the model in production environments.

Industry experts predict that GPT-5 could revolutionize how we interact with artificial intelligence systems. The improved reasoning capabilities make it particularly suitable for complex analytical tasks and decision-making processes that require nuanced understanding.

![相关配图：技术示意图](content_image_placeholder)

## 🔍 深度分析

这项技术突破的意义重大。

## 🚀 未来展望

The future of artificial intelligence looks incredibly promising with these advancements. As technology continues to mature, we can expect AI to play an increasingly important role in various aspects of human society, bringing greater value and efficiency to our daily lives.

**思考：** 你认为这项技术对我们的日常生活会产生什么影响？

![总结配图：未来科技趋势](summary_image_placeholder)

---
**标签：** #AI #Technology
**原文来源：** [TechCrunch](https://example.com/news)
"""
    
    print("原始内容：")
    print("=" * 80)
    print(test_content)
    print("=" * 80)
    
    # 翻译内容
    print("\n🔄 正在翻译...")
    translated_content = translator.translate_article_content(test_content)
    
    print("\n翻译后内容：")
    print("=" * 80)
    print(translated_content)
    print("=" * 80)
    
    # 检查是否还有英文
    import re
    english_words = re.findall(r'\b[a-zA-Z]{3,}\b', translated_content)
    english_words = [w for w in english_words if w not in ['AI', 'GPT', 'API', 'CEO', 'URL', 'img', 'src']]  # 排除常见缩写
    
    print(f"\n📊 翻译质量检查：")
    print(f"剩余英文单词数量: {len(english_words)}")
    if english_words:
        print(f"剩余英文单词: {english_words[:10]}...")  # 显示前10个
    else:
        print("✅ 所有英文内容已成功翻译！")
    
    print("\n✅ 翻译测试完成！")

if __name__ == "__main__":
    test_improved_translation()
