"""
翻译功能测试脚本
"""

import sys
sys.path.append('src')

from translator import ContentTranslator

def test_translation():
    """测试翻译功能"""
    print("🔄 测试翻译功能...")
    
    # 创建翻译器
    translator = ContentTranslator('simple')
    
    # 测试文本
    test_content = """
# 🚀 AI技术突破

![封面图](image.jpg)

This is a breakthrough in artificial intelligence technology. The new model demonstrates significant improvements in reasoning and creativity.

## 核心内容

OpenAI today unveiled GPT-5, the latest iteration of its groundbreaking language model series. The model features unprecedented multimodal capabilities.

Key features include:
- Enhanced reasoning capabilities with 40% better performance
- Native multimodal processing without separate encoders
- Reduced hallucination rates by 60% compared to GPT-4

这是一个重要的技术进步。

## Technical Details

The new architecture incorporates advanced neural processing units and optimized memory systems. This represents a fundamental leap forward in AI capabilities.

---
**标签：** #AI #Technology
"""
    
    print("原始内容：")
    print("=" * 50)
    print(test_content)
    print("=" * 50)
    
    # 翻译内容
    print("\n🔄 正在翻译...")
    translated_content = translator.translate_article_content(test_content)
    
    print("\n翻译后内容：")
    print("=" * 50)
    print(translated_content)
    print("=" * 50)
    
    print("\n✅ 翻译测试完成！")

if __name__ == "__main__":
    test_translation()
