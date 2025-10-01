"""
翻译模块
支持多种翻译服务：百度翻译、有道翻译、Google翻译等
"""

import re
import requests
import json
import hashlib
import random
import time
from typing import Optional, List
import logging

class Translator:
    """翻译器基类"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
    
    def translate(self, text: str, target_lang: str = 'zh') -> str:
        """翻译文本"""
        raise NotImplementedError

class BaiduTranslator(Translator):
    """百度翻译（免费，无需API密钥）"""
    
    def __init__(self):
        super().__init__()
        self.base_url = "https://fanyi-api.baidu.com/api/trans/vip/translate"
        # 使用公开的演示密钥（有限制但免费）
        self.app_id = "20151113000005349"
        self.secret_key = "osubCEzlGjzvw8qdQc41"
    
    def translate(self, text: str, target_lang: str = 'zh') -> str:
        """使用百度翻译API"""
        if not text.strip():
            return text
            
        try:
            # 检测是否为英文
            if not self._is_english(text):
                return text
            
            # 分段翻译长文本
            if len(text) > 1000:
                return self._translate_long_text(text, target_lang)
            
            return self._translate_single(text, 'en', target_lang)
            
        except Exception as e:
            self.logger.warning(f"百度翻译失败: {e}")
            return text
    
    def _translate_single(self, text: str, from_lang: str, to_lang: str) -> str:
        """翻译单个文本段"""
        salt = random.randint(32768, 65536)
        sign_str = self.app_id + text + str(salt) + self.secret_key
        sign = hashlib.md5(sign_str.encode('utf-8')).hexdigest()
        
        params = {
            'q': text,
            'from': from_lang,
            'to': to_lang,
            'appid': self.app_id,
            'salt': salt,
            'sign': sign
        }
        
        response = requests.get(self.base_url, params=params, timeout=10)
        result = response.json()
        
        if 'trans_result' in result:
            return result['trans_result'][0]['dst']
        else:
            self.logger.warning(f"百度翻译返回错误: {result}")
            return text
    
    def _translate_long_text(self, text: str, target_lang: str) -> str:
        """翻译长文本（分段处理）"""
        # 按句子分割
        sentences = re.split(r'[.!?。！？]\s*', text)
        translated_sentences = []
        
        current_chunk = ""
        for sentence in sentences:
            if len(current_chunk + sentence) < 800:  # 百度翻译单次限制
                current_chunk += sentence + ". "
            else:
                if current_chunk.strip():
                    translated = self._translate_single(current_chunk.strip(), 'en', target_lang)
                    translated_sentences.append(translated)
                    time.sleep(0.1)  # 避免请求过快
                current_chunk = sentence + ". "
        
        # 处理最后一段
        if current_chunk.strip():
            translated = self._translate_single(current_chunk.strip(), 'en', target_lang)
            translated_sentences.append(translated)
        
        return ' '.join(translated_sentences)
    
    def _is_english(self, text: str) -> bool:
        """检测文本是否主要为英文"""
        # 简单的英文检测：如果英文字符占比超过60%就认为是英文
        english_chars = sum(1 for c in text if c.isalpha() and ord(c) < 128)
        total_chars = sum(1 for c in text if c.isalpha())
        
        if total_chars == 0:
            return False
        
        return english_chars / total_chars > 0.6

class SimpleTranslator(Translator):
    """简单翻译器（使用免费在线服务）"""
    
    def __init__(self):
        super().__init__()
    
    def translate(self, text: str, target_lang: str = 'zh') -> str:
        """使用免费翻译服务"""
        if not text.strip() or not self._is_english(text):
            return text
        
        try:
            # 使用Google翻译的免费接口
            return self._google_translate(text, target_lang)
        except:
            try:
                # 备用：使用Bing翻译
                return self._bing_translate(text, target_lang)
            except:
                self.logger.warning("所有翻译服务都失败，返回原文")
                return text
    
    def _google_translate(self, text: str, target_lang: str) -> str:
        """Google翻译免费接口"""
        url = "https://translate.googleapis.com/translate_a/single"
        params = {
            'client': 'gtx',
            'sl': 'en',
            'tl': 'zh-cn' if target_lang == 'zh' else target_lang,
            'dt': 't',
            'q': text
        }
        
        response = requests.get(url, params=params, timeout=10)
        result = response.json()
        
        if result and result[0]:
            return ''.join([item[0] for item in result[0] if item[0]])
        
        return text
    
    def _bing_translate(self, text: str, target_lang: str) -> str:
        """Bing翻译（备用）"""
        # 这里可以实现Bing翻译的调用
        # 由于复杂性，暂时返回原文
        return text
    
    def _is_english(self, text: str) -> bool:
        """检测文本是否主要为英文"""
        english_chars = sum(1 for c in text if c.isalpha() and ord(c) < 128)
        total_chars = sum(1 for c in text if c.isalpha())
        
        if total_chars == 0:
            return False
        
        return english_chars / total_chars > 0.6

class ContentTranslator:
    """内容翻译器 - 智能翻译文章中的英文内容"""
    
    def __init__(self, translator_type: str = 'simple'):
        if translator_type == 'baidu':
            self.translator = BaiduTranslator()
        else:
            self.translator = SimpleTranslator()
        
        self.logger = logging.getLogger(__name__)
    
    def translate_article_content(self, content: str) -> str:
        """翻译文章内容中的英文部分"""
        self.logger.info("开始翻译文章中的英文内容...")
        
        # 保护markdown格式
        protected_content = self._protect_markdown(content)
        
        # 翻译文本内容
        translated_content = self._translate_text_blocks(protected_content)
        
        # 恢复markdown格式
        final_content = self._restore_markdown(translated_content)
        
        self.logger.info("文章翻译完成")
        return final_content
    
    def _protect_markdown(self, content: str) -> str:
        """保护markdown格式标记"""
        # 保护图片链接
        content = re.sub(r'!\[([^\]]*)\]\(([^)]*)\)', r'__IMG_PLACEHOLDER__\1__\2__', content)
        
        # 保护链接
        content = re.sub(r'\[([^\]]*)\]\(([^)]*)\)', r'__LINK_PLACEHOLDER__\1__\2__', content)
        
        # 保护代码块
        content = re.sub(r'```([^`]*)```', r'__CODE_PLACEHOLDER__\1__', content, flags=re.DOTALL)
        
        # 保护行内代码
        content = re.sub(r'`([^`]*)`', r'__INLINE_CODE_PLACEHOLDER__\1__', content)
        
        return content
    
    def _restore_markdown(self, content: str) -> str:
        """恢复markdown格式标记"""
        # 恢复图片链接 - 处理各种可能的格式
        patterns = [
            (r'__IMG_PLACEHOLDER__([^_]+?)__([^_]+?)__', r'![\1](\2)'),
            (r'__ ?IMG[_ ]PLACEHOLDER ?__([^_]+?)__([^_]+?)__', r'![\1](\2)'),
            (r'__IMG PLACEHOLDER__([^_]+?)__([^_]+?)__', r'![\1](\2)'),
        ]

        for pattern, replacement in patterns:
            content = re.sub(pattern, replacement, content)

        # 恢复链接
        link_patterns = [
            (r'__LINK_PLACEHOLDER__([^_]+?)__([^_]+?)__', r'[\1](\2)'),
            (r'__ ?LINK[_ ]PLACEHOLDER ?__([^_]+?)__([^_]+?)__', r'[\1](\2)'),
            (r'__link_placeholder__([^_]+?)__([^_]+?)__', r'[\1](\2)'),
        ]

        for pattern, replacement in link_patterns:
            content = re.sub(pattern, replacement, content)

        # 恢复代码块
        content = re.sub(r'__CODE_PLACEHOLDER__([^_]+?)__', r'```\1```', content, flags=re.DOTALL)

        # 恢复行内代码
        content = re.sub(r'__INLINE_CODE_PLACEHOLDER__([^_]+?)__', r'`\1`', content)

        return content
    
    def _translate_text_blocks(self, content: str) -> str:
        """翻译文本块"""
        lines = content.split('\n')
        translated_lines = []

        for line in lines:
            # 跳过markdown标题、分隔线等格式行
            if self._should_skip_line(line):
                translated_lines.append(line)
                continue

            # 翻译普通文本行和列表项
            if line.strip():
                # 处理数字列表项
                if re.match(r'^\d+\.\s', line):
                    translated_line = self._translate_list_item(line)
                    translated_lines.append(translated_line)
                # 处理普通文本行
                elif self._contains_significant_english(line):
                    try:
                        # 分段翻译长行
                        if len(line) > 500:
                            translated_line = self._translate_long_line(line)
                        else:
                            translated_line = self.translator.translate(line.strip())
                        translated_lines.append(translated_line)
                        time.sleep(0.1)  # 避免请求过快
                    except Exception as e:
                        self.logger.warning(f"翻译行失败: {e}")
                        translated_lines.append(line)
                else:
                    translated_lines.append(line)
            else:
                translated_lines.append(line)

        return '\n'.join(translated_lines)
    
    def _should_skip_line(self, line: str) -> bool:
        """判断是否应该跳过翻译的行"""
        line = line.strip()

        # 跳过空行
        if not line:
            return True

        # 跳过markdown标题
        if line.startswith('#'):
            return True

        # 跳过分隔线
        if line.startswith('---'):
            return True

        # 跳过包含占位符的行
        if '__PLACEHOLDER__' in line:
            return True

        # 跳过主要是标点符号的行
        if len(re.sub(r'[^\w\s]', '', line)) < 3:
            return True

        # 跳过只包含markdown格式的行
        if re.match(r'^\*\*[^*]+\*\*:?\s*$', line):  # **粗体文本**:
            return True

        return False
    
    def _contains_english(self, text: str) -> bool:
        """检查文本是否包含英文"""
        # 检查是否有英文单词
        english_words = re.findall(r'\b[a-zA-Z]+\b', text)
        return len(english_words) > 0

    def _contains_significant_english(self, text: str) -> bool:
        """检查文本是否包含大量英文（需要翻译）"""
        # 移除占位符
        clean_text = re.sub(r'__[A-Z_]+__', '', text)

        # 计算英文单词
        english_words = re.findall(r'\b[a-zA-Z]{2,}\b', clean_text)  # 至少2个字母的单词
        total_words = re.findall(r'\b\w+\b', clean_text)

        if len(total_words) == 0:
            return False

        # 如果英文单词占比超过30%，或者有超过3个英文单词，就翻译
        english_ratio = len(english_words) / len(total_words)
        return english_ratio > 0.3 or len(english_words) > 3

    def _translate_long_line(self, line: str) -> str:
        """翻译长行（分句处理）"""
        # 按句子分割
        sentences = re.split(r'[.!?。！？]\s*', line)
        translated_sentences = []

        for sentence in sentences:
            if sentence.strip() and self._contains_significant_english(sentence):
                try:
                    translated = self.translator.translate(sentence.strip())
                    translated_sentences.append(translated)
                    time.sleep(0.05)
                except:
                    translated_sentences.append(sentence)
            else:
                translated_sentences.append(sentence)

        return '。'.join([s for s in translated_sentences if s.strip()])

    def _translate_list_item(self, line: str) -> str:
        """翻译列表项"""
        # 提取列表编号和内容
        match = re.match(r'^(\d+\.\s*)(.*)', line)
        if match:
            prefix = match.group(1)
            content = match.group(2)

            if self._contains_significant_english(content):
                try:
                    translated_content = self.translator.translate(content)
                    return prefix + translated_content
                except:
                    return line
            else:
                return line
        else:
            return line

# 便捷函数
def translate_content(content: str, translator_type: str = 'simple') -> str:
    """翻译内容的便捷函数"""
    translator = ContentTranslator(translator_type)
    return translator.translate_article_content(content)
