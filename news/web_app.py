"""
Web界面 - 新闻重写系统的简单Web界面
"""

import os
import sys
import json
from datetime import datetime
from pathlib import Path
from flask import Flask, render_template, request, jsonify, send_file
import threading
import time

# 添加src目录到Python路径
sys.path.append('src')

from news_fetcher import NewsArticle
from content_rewriter import ContentRewriter

app = Flask(__name__)

class WebNewsRewriter:
    """Web版新闻重写器"""
    
    def __init__(self):
        self.rewriter = ContentRewriter()
        self.output_dir = Path("output")
        self.output_dir.mkdir(exist_ok=True)
        self.processing = False
        self.progress = {"status": "idle", "message": "", "articles": []}
    
    def create_demo_articles(self):
        """创建演示文章"""
        return [
            NewsArticle(
                title="OpenAI发布GPT-5：多模态AI技术实现重大突破",
                content="""
                OpenAI今日正式发布GPT-5，这是其突破性语言模型系列的最新版本，具备前所未有的多模态能力，可以同时处理文本、图像、音频和视频。新模型在推理、创造力和现实世界问题解决方面展现出显著改进。

                GPT-5的主要特性包括：
                - 复杂任务性能提升40%的增强推理能力
                - 无需单独编码器的原生多模态处理
                - 相比GPT-4减少60%的幻觉率
                - 支持低于100毫秒延迟的实时对话
                - 先进的代码生成和调试功能

                OpenAI首席执行官Sam Altman表示："这代表了AI能力的根本性飞跃，让我们更接近通用人工智能，同时保持对安全性和一致性的承诺。"

                该模型将从下个月开始通过OpenAI的API提供，定价预计与当前GPT-4费率相当。早期访问合作伙伴包括微软、谷歌和几家财富500强公司，他们已在生产环境中测试该模型。

                行业专家预测，GPT-5可能会加速AI在各个领域的采用，从医疗保健和教育到创意产业和科学研究。该模型改进的推理能力使其特别适合复杂的分析任务和决策过程。
                """,
                url="https://example.com/openai-gpt5",
                published_at=datetime.now(),
                source="TechCrunch",
                author="Sarah Johnson"
            ),
            NewsArticle(
                title="特斯拉新AI芯片承诺自动驾驶性能提升10倍",
                content="""
                特斯拉披露了其最新的定制AI芯片，专为自动驾驶应用设计，承诺比上一代产品性能提升10倍。这款被称为"FSD芯片v4"的新芯片集成了先进的神经处理单元和优化的内存架构。

                技术规格包括：
                - 500 TOPS（每秒万亿次操作）处理能力
                - 功耗降低50%
                - 先进的计算机视觉处理能力
                - 来自摄像头、雷达和激光雷达的实时传感器融合
                - 片上机器学习推理优化

                埃隆·马斯克在特斯拉AI日活动中演示了该芯片的能力，展示了对复杂驾驶场景的实时处理，准确性前所未有。该芯片可以同时处理来自多个传感器的数据，同时运行用于路径规划和障碍物检测的先进神经网络。

                "这款芯片代表了多年专用AI硬件研究的成果，"马斯克解释道。"它从头开始设计，专门满足自动驾驶的特定要求，使其比通用处理器效率高得多。"

                新芯片将从2024年第二季度开始集成到所有特斯拉车辆中，现有车辆有资格进行硬件升级。特斯拉还宣布计划向其他汽车制造商授权该芯片技术，可能为公司创造新的收入来源。

                汽车行业分析师认为，这一发展可能会加速完全自动驾驶车辆的时间表，一些人预测在未来3-5年内可能实现5级自动驾驶。
                """,
                url="https://example.com/tesla-ai-chip",
                published_at=datetime.now(),
                source="The Verge",
                author="Alex Chen"
            ),
            NewsArticle(
                title="谷歌量子计算机在纠错方面取得突破性进展",
                content="""
                谷歌量子计算部门宣布在量子纠错方面取得重大突破，成功演示了一个保持相干性超过100秒的逻辑量子比特。这一成就使实用量子计算显著接近现实。

                突破包括：
                - 将噪声降低99.9%的新型纠错算法
                - 使用1000+物理量子比特的稳定逻辑量子比特
                - 在现实世界问题中展示量子优势
                - 更大量子系统的可扩展架构
                - 与经典计算基础设施的集成

                谷歌量子AI部门负责人Hartmut Neven博士将这一成就描述为"量子计算的分水岭时刻"。团队使用他们的Sycamore量子处理器和先进的纠错协议，维持量子态的时间远超以往可能。

                影响深远。具有可靠纠错功能的量子计算机可能会革命性地改变以下领域：
                - 药物发现和分子模拟
                - 金融建模和风险分析
                - 密码学和网络安全
                - 气候建模和优化问题
                - 人工智能和机器学习

                谷歌计划到2025年通过其云平台提供这种量子计算能力，最初面向研究机构和企业客户。该公司还与制药公司合作探索量子增强药物发现应用。

                包括IBM、微软和亚马逊在内的竞争对手正在竞相实现类似的里程碑，根据最近的行业报告，量子计算市场预计到2030年将达到650亿美元。
                """,
                url="https://example.com/google-quantum",
                published_at=datetime.now(),
                source="MIT Technology Review",
                author="Dr. Emily Rodriguez"
            )
        ]
    
    def process_articles(self, articles, max_articles=3):
        """处理文章"""
        self.processing = True
        self.progress = {"status": "processing", "message": "开始处理文章...", "articles": []}
        
        try:
            processed_articles = []
            for i, article in enumerate(articles[:max_articles]):
                self.progress["message"] = f"正在重写第 {i+1} 篇文章..."
                
                # 重写文章
                rewritten = self.rewriter.rewrite_article(article)
                
                # 生成文件名
                title_slug = rewritten.title.replace(" ", "_").replace("/", "_").replace("\\", "_")
                title_slug = "".join(c for c in title_slug if c.isalnum() or c in "._-")[:50]
                date_str = datetime.now().strftime("%Y%m%d_%H%M")
                filename = f"web_{date_str}_{i+1}_{title_slug}.md"
                
                # 保存文章
                filepath = self.output_dir / filename
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(f"# {rewritten.title}\n\n")
                    f.write(rewritten.content)
                
                processed_articles.append({
                    "title": rewritten.title,
                    "filename": filename,
                    "tags": rewritten.tags,
                    "reading_time": rewritten.reading_time,
                    "image_count": len(rewritten.image_suggestions),
                    "original_source": article.source
                })
                
                self.progress["articles"] = processed_articles
            
            self.progress["status"] = "completed"
            self.progress["message"] = f"成功处理 {len(processed_articles)} 篇文章"
            
        except Exception as e:
            self.progress["status"] = "error"
            self.progress["message"] = f"处理失败: {str(e)}"
        
        finally:
            self.processing = False

# 全局实例
web_rewriter = WebNewsRewriter()

@app.route('/')
def index():
    """主页"""
    return '''
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>🚀 新闻重写系统</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .button { background: #007cba; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; margin: 5px; }
            .button:hover { background: #005a87; }
            .progress { margin: 20px 0; padding: 15px; background: #f0f0f0; border-radius: 5px; }
            .article-list { margin-top: 20px; }
            .article-item { padding: 10px; border: 1px solid #ddd; margin: 5px 0; border-radius: 5px; }
            .hidden { display: none; }
            .status { padding: 10px; margin: 10px 0; border-radius: 5px; }
            .status.processing { background: #fff3cd; border: 1px solid #ffeaa7; }
            .status.completed { background: #d4edda; border: 1px solid #c3e6cb; }
            .status.error { background: #f8d7da; border: 1px solid #f5c6cb; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🚀 新闻重写系统</h1>
            <p>将科技新闻自动重写为吸引人的自媒体内容</p>
        </div>
        
        <div>
            <button class="button" onclick="startDemo()">🎯 运行演示</button>
            <button class="button" onclick="checkProgress()">📊 查看进度</button>
            <button class="button" onclick="listFiles()">📁 查看文件</button>
        </div>
        
        <div id="status" class="status hidden"></div>
        <div id="progress" class="progress hidden"></div>
        <div id="articles" class="article-list hidden"></div>
        <div id="files" class="article-list hidden"></div>
        
        <script>
            function startDemo() {
                document.getElementById('status').className = 'status processing';
                document.getElementById('status').innerHTML = '🚀 启动演示模式...';
                document.getElementById('status').classList.remove('hidden');
                
                fetch('/start_demo', {method: 'POST'})
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            checkProgress();
                        } else {
                            showError(data.message);
                        }
                    })
                    .catch(error => showError('请求失败: ' + error));
            }
            
            function checkProgress() {
                fetch('/progress')
                    .then(response => response.json())
                    .then(data => {
                        updateProgress(data);
                        if (data.status === 'processing') {
                            setTimeout(checkProgress, 2000);
                        }
                    })
                    .catch(error => showError('获取进度失败: ' + error));
            }
            
            function updateProgress(data) {
                const statusDiv = document.getElementById('status');
                const progressDiv = document.getElementById('progress');
                const articlesDiv = document.getElementById('articles');
                
                statusDiv.classList.remove('hidden');
                statusDiv.className = 'status ' + data.status;
                statusDiv.innerHTML = '📊 ' + data.message;
                
                if (data.articles && data.articles.length > 0) {
                    progressDiv.classList.remove('hidden');
                    articlesDiv.classList.remove('hidden');
                    
                    let html = '<h3>📝 已处理的文章:</h3>';
                    data.articles.forEach((article, index) => {
                        html += `
                            <div class="article-item">
                                <h4>${article.title}</h4>
                                <p><strong>标签:</strong> ${article.tags.join(', ')}</p>
                                <p><strong>阅读时间:</strong> ${article.reading_time} | <strong>图片建议:</strong> ${article.image_count}张</p>
                                <p><strong>原始来源:</strong> ${article.original_source}</p>
                                <button class="button" onclick="downloadFile('${article.filename}')">📥 下载文章</button>
                            </div>
                        `;
                    });
                    articlesDiv.innerHTML = html;
                }
            }
            
            function listFiles() {
                fetch('/list_files')
                    .then(response => response.json())
                    .then(data => {
                        const filesDiv = document.getElementById('files');
                        filesDiv.classList.remove('hidden');
                        
                        let html = '<h3>📁 输出文件列表:</h3>';
                        if (data.files.length === 0) {
                            html += '<p>暂无文件，请先运行演示。</p>';
                        } else {
                            data.files.forEach(file => {
                                html += `
                                    <div class="article-item">
                                        <p><strong>文件名:</strong> ${file}</p>
                                        <button class="button" onclick="downloadFile('${file}')">📥 下载</button>
                                    </div>
                                `;
                            });
                        }
                        filesDiv.innerHTML = html;
                    })
                    .catch(error => showError('获取文件列表失败: ' + error));
            }
            
            function downloadFile(filename) {
                window.open('/download/' + filename, '_blank');
            }
            
            function showError(message) {
                const statusDiv = document.getElementById('status');
                statusDiv.className = 'status error';
                statusDiv.innerHTML = '❌ ' + message;
                statusDiv.classList.remove('hidden');
            }
        </script>
    </body>
    </html>
    '''

@app.route('/start_demo', methods=['POST'])
def start_demo():
    """启动演示"""
    if web_rewriter.processing:
        return jsonify({"success": False, "message": "系统正在处理中，请稍候"})
    
    try:
        # 创建演示文章
        demo_articles = web_rewriter.create_demo_articles()
        
        # 在后台线程中处理
        thread = threading.Thread(target=web_rewriter.process_articles, args=(demo_articles, 3))
        thread.start()
        
        return jsonify({"success": True, "message": "演示已启动"})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})

@app.route('/progress')
def get_progress():
    """获取处理进度"""
    return jsonify(web_rewriter.progress)

@app.route('/list_files')
def list_files():
    """列出输出文件"""
    try:
        files = [f.name for f in web_rewriter.output_dir.glob("*.md")]
        files.sort(reverse=True)  # 按时间倒序
        return jsonify({"files": files})
    except Exception as e:
        return jsonify({"files": [], "error": str(e)})

@app.route('/download/<filename>')
def download_file(filename):
    """下载文件"""
    try:
        filepath = web_rewriter.output_dir / filename
        if filepath.exists():
            return send_file(filepath, as_attachment=True)
        else:
            return "文件不存在", 404
    except Exception as e:
        return f"下载失败: {str(e)}", 500

if __name__ == '__main__':
    print("🚀 启动新闻重写系统Web界面...")
    print("📱 访问地址: http://localhost:5000")
    print("💡 提示: 点击'运行演示'开始体验系统功能")
    app.run(debug=True, host='0.0.0.0', port=5000)
