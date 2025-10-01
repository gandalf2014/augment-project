# 🎵 汉语拼音学习游戏

一个专为3-6岁幼儿设计的汉语拼音学习游戏，包含声母和韵母学习模块，支持标准普通话发音。

## ✨ 功能特点

- 🔤 **完整拼音覆盖**：包含23个声母和24个韵母
- 🔊 **标准发音**：支持预录制音频文件和TTS备用方案
- 🎨 **儿童友好界面**：鲜艳色彩、大字体、动画效果
- 📱 **响应式设计**：适配手机、平板、桌面设备
- 🎯 **交互学习**：点击卡片听发音，查看示例词汇

## 📁 文件结构

```
pinyin/
├── pinyin-game.html          # 主游戏文件
├── download-audio.html       # 音频下载助手
├── README.md                # 说明文档
└── audio/                   # 音频文件夹（需要创建）
    ├── 声母音频文件/
    │   ├── b.mp3
    │   ├── p.mp3
    │   ├── m.mp3
    │   └── ... (共23个)
    └── 韵母音频文件/
        ├── a.mp3
        ├── o.mp3
        ├── e.mp3
        └── ... (共24个)
```

## 🚀 快速开始

### 1. 基础使用
直接打开 `pinyin-game.html` 即可开始使用，游戏会使用浏览器内置的TTS功能。

### 2. 最佳体验（推荐）
为获得标准的拼音发音，请按以下步骤设置：

1. **创建音频文件夹**
   ```bash
   mkdir audio
   ```

2. **准备音频文件**
   - 打开 `download-audio.html` 查看详细的音频文件列表
   - 需要47个MP3文件（23个声母 + 24个韵母）
   - 文件命名必须与拼音完全一致

3. **音频文件要求**
   - 格式：MP3
   - 时长：1-3秒
   - 音质：清晰无杂音
   - 语速：适中，适合儿童

## 🎯 音频文件获取方法

### 方法一：自动下载（推荐）⭐
我们提供了多种自动下载方案，可以直接从优质音频源获取标准拼音发音：

#### 🐍 Python脚本下载（最稳定）
```bash
# 1. 双击运行批处理文件（Windows）
下载拼音音频.bat

# 2. 或手动运行Python脚本
pip install requests
python download_pinyin_audio.py
```

#### 🌐 浏览器下载
```bash
# 打开下载助手页面
download-audio.html
# 点击"开始下载所有拼音音频"按钮
```

**音频来源**: `du.hanyupinyin.cn` - 提供标准普通话发音，音质清晰

### 方法二：在线TTS工具
- [百度语音合成](https://tts.baidu.com/)
- [讯飞语音合成](https://www.xfyun.cn/services/online_tts)
- [微软语音服务](https://azure.microsoft.com/zh-cn/services/cognitive-services/text-to-speech/)

### 方法三：录制音频
使用录音设备录制标准普通话发音

### 方法四：教育资源
从教育网站或拼音学习资源中获取

## 📋 所需音频文件清单

### 声母 (23个)
```
b.mp3, p.mp3, m.mp3, f.mp3, d.mp3, t.mp3, n.mp3, l.mp3,
g.mp3, k.mp3, h.mp3, j.mp3, q.mp3, x.mp3, zh.mp3, ch.mp3,
sh.mp3, r.mp3, z.mp3, c.mp3, s.mp3, y.mp3, w.mp3
```

### 韵母 (24个)
```
a.mp3, o.mp3, e.mp3, i.mp3, u.mp3, ü.mp3, ai.mp3, ei.mp3,
ui.mp3, ao.mp3, ou.mp3, iu.mp3, ie.mp3, üe.mp3, er.mp3,
an.mp3, en.mp3, in.mp3, un.mp3, ün.mp3, ang.mp3, eng.mp3,
ing.mp3, ong.mp3
```

## 🛠 技术实现

- **前端技术**：纯HTML5 + CSS3 + JavaScript
- **音频播放**：HTML5 Audio API
- **备用方案**：Web Speech API
- **响应式布局**：CSS Grid + Flexbox
- **兼容性**：支持现代浏览器

## 🎮 使用说明

1. **切换学习模块**：点击顶部的"声母学习"或"韵母学习"按钮
2. **学习发音**：点击任意拼音卡片听标准发音
3. **查看示例**：每个卡片都包含相应的示例词汇
4. **视觉反馈**：卡片具有悬停和点击动画效果

## 🔧 故障排除

### 音频无法播放
1. 检查 `audio` 文件夹是否存在
2. 确认音频文件名称正确
3. 验证音频文件格式为MP3
4. 检查浏览器是否支持音频播放

### TTS发音不准确
1. 建议使用预录制音频文件
2. 确保浏览器支持中文语音合成
3. 尝试更新浏览器到最新版本

## 📱 设备兼容性

- ✅ Chrome 60+
- ✅ Firefox 55+
- ✅ Safari 12+
- ✅ Edge 79+
- ✅ iOS Safari 12+
- ✅ Android Chrome 60+

## 🤝 贡献

欢迎提交问题和改进建议！

## 📄 许可证

本项目采用 MIT 许可证。

---

**享受学习拼音的乐趣！** 🎉
