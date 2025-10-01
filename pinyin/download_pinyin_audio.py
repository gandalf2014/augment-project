#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
拼音音频文件批量下载脚本
从 du.hanyupinyin.cn 网站下载标准拼音发音文件

使用方法:
1. 确保已安装 requests 库: pip install requests
2. 运行脚本: python download_pinyin_audio.py
3. 音频文件将保存到 audio 文件夹中
"""

import os
import requests
import time
from urllib.parse import quote

# 拼音列表
PINYIN_LIST = [
    # 声母 (23个)
    'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 
    'zh', 'ch', 'sh', 'r', 'z', 'c', 's', 'y', 'w',
    
    # 韵母 (24个)
    'a', 'o', 'e', 'i', 'u', 'ü', 'ai', 'ei', 'ui', 'ao', 'ou', 'iu', 
    'ie', 'üe', 'er', 'an', 'en', 'in', 'un', 'ün', 'ang', 'eng', 'ing', 'ong'
]

# 基础URL
BASE_URL = "http://du.hanyupinyin.cn/du/pinyin/"

def create_audio_folder():
    """创建audio文件夹"""
    if not os.path.exists('audio'):
        os.makedirs('audio')
        print("✅ 已创建 audio 文件夹")
    else:
        print("📁 audio 文件夹已存在")

def download_audio_file(pinyin):
    """下载单个拼音音频文件"""
    try:
        # 处理特殊字符ü，网站使用v代替
        url_pinyin = pinyin.replace('ü', 'v')
        url = f"{BASE_URL}{url_pinyin}.mp3"
        filename = f"audio/{pinyin}.mp3"
        
        # 检查文件是否已存在
        if os.path.exists(filename):
            print(f"⏭️  {pinyin}.mp3 已存在，跳过下载")
            return True
        
        # 发送请求
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        # 保存文件
        with open(filename, 'wb') as f:
            f.write(response.content)
        
        print(f"✅ 成功下载: {pinyin}.mp3")
        return True
        
    except requests.exceptions.RequestException as e:
        print(f"❌ 下载失败: {pinyin}.mp3 - {str(e)}")
        return False
    except Exception as e:
        print(f"❌ 保存失败: {pinyin}.mp3 - {str(e)}")
        return False

def main():
    """主函数"""
    print("🎵 拼音音频文件批量下载工具")
    print("=" * 50)
    print(f"📍 音频来源: {BASE_URL}")
    print(f"📊 总计需要下载: {len(PINYIN_LIST)} 个文件")
    print("=" * 50)
    
    # 创建audio文件夹
    create_audio_folder()
    
    # 统计变量
    success_count = 0
    fail_count = 0
    total_count = len(PINYIN_LIST)
    
    print("\n🚀 开始下载...")
    
    # 下载每个拼音音频
    for i, pinyin in enumerate(PINYIN_LIST, 1):
        print(f"\n[{i}/{total_count}] 正在下载: {pinyin}.mp3")
        
        if download_audio_file(pinyin):
            success_count += 1
        else:
            fail_count += 1
        
        # 显示进度
        progress = (i / total_count) * 100
        print(f"📈 进度: {progress:.1f}% (成功: {success_count}, 失败: {fail_count})")
        
        # 添加延迟避免请求过快
        time.sleep(0.5)
    
    # 显示最终结果
    print("\n" + "=" * 50)
    print("📊 下载完成统计:")
    print(f"✅ 成功下载: {success_count} 个文件")
    print(f"❌ 下载失败: {fail_count} 个文件")
    print(f"📁 文件保存位置: ./audio/ 文件夹")
    
    if fail_count > 0:
        print(f"\n⚠️  有 {fail_count} 个文件下载失败，可能的原因:")
        print("   - 网络连接问题")
        print("   - 服务器暂时不可用")
        print("   - 文件不存在")
        print("   建议稍后重新运行脚本")
    
    if success_count > 0:
        print(f"\n🎉 恭喜！成功下载了 {success_count} 个拼音音频文件")
        print("现在可以在拼音学习游戏中享受标准发音了！")
    
    print("\n按 Enter 键退出...")
    input()

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⏹️  用户取消下载")
    except Exception as e:
        print(f"\n❌ 程序出错: {str(e)}")
        print("请检查网络连接或联系开发者")
        input("按 Enter 键退出...")
