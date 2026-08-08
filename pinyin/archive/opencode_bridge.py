#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OpenCode 飞书桥接服务器
接收飞书消息，调用本地 OpenCode CLI 获取回复
"""

import json
import subprocess
import requests
import os
from flask import Flask, request, jsonify

app = Flask(__name__)

# ==================== 配置 ====================
# 飞书应用凭证
APP_ID = "cli_xxxxxxxxxx"           # 替换为你的 App ID
APP_SECRET = "xxxxxxxxxxxxxxxx"      # 替换为你的 App Secret

# OpenCode 配置
OPENCODE_PATH = "opencode"  # 或完整路径如 "/usr/local/bin/opencode"
# =============================================

class FeishuBot:
    def __init__(self, app_id, app_secret):
        self.app_id = app_id
        self.app_secret = app_secret
        self.tenant_access_token = None
        
    def get_tenant_access_token(self):
        """获取 Tenant Access Token"""
        url = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal"
        headers = {"Content-Type": "application/json"}
        data = {
            "app_id": self.app_id,
            "app_secret": self.app_secret
        }
        
        response = requests.post(url, headers=headers, json=data)
        result = response.json()
        
        if result.get("code") == 0:
            self.tenant_access_token = result["tenant_access_token"]
            return self.tenant_access_token
        else:
            raise Exception(f"获取 token 失败: {result}")
    
    def reply_message(self, message_id, text):
        """回复消息"""
        if not self.tenant_access_token:
            self.get_tenant_access_token()
            
        url = f"https://open.feishu.cn/open-apis/im/v1/messages/{message_id}/reply"
        headers = {
            "Authorization": f"Bearer {self.tenant_access_token}",
            "Content-Type": "application/json"
        }
        data = {
            "content": json.dumps({"text": text}),
            "msg_type": "text"
        }
        
        response = requests.post(url, headers=headers, json=data)
        return response.json()

# 初始化飞书机器人
bot = FeishuBot(APP_ID, APP_SECRET)

def call_opencode(prompt):
    """
    调用本地 OpenCode CLI 获取回复
    
    注意：这个实现方式有限制：
    1. OpenCode CLI 是交互式工具，不能简单通过命令行调用
    2. 需要等待 OpenCode 支持 headless 模式或 API
    """
    try:
        # 方式1：尝试使用 echo + opencode（可能无法正常工作）
        # 因为 opencode 是交互式的，会等待用户输入，不会自动退出
        
        # 方式2：写入文件，然后调用 opencode（也不可行）
        
        # 临时方案：记录请求，提示用户
        print(f"[OpenCode Bridge] 收到请求: {prompt}")
        return "⚠️ 提示：OpenCode CLI 目前不支持程序调用。\n\n请直接在命令行输入你的问题。\n\n如果你想通过飞书使用 AI，建议：\n1. 使用 OpenAI API\n2. 使用 Claude API\n3. 使用其他提供 HTTP API 的本地模型（如 Ollama）"
        
    except Exception as e:
        return f"调用 OpenCode 出错: {str(e)}"

@app.route('/webhook', methods=['POST'])
def webhook():
    """接收飞书事件推送"""
    data = request.get_json()
    
    # 1. URL 验证
    if data.get("type") == "url_verification":
        return jsonify({"challenge": data.get("challenge")})
    
    # 2. 处理消息
    event = data.get("event", {})
    event_type = event.get("type")
    
    if event_type == "im.message.receive_v1":
        message = event.get("message", {})
        message_id = message.get("message_id")
        chat_type = message.get("chat_type")
        msg_type = message.get("message_type")
        content = json.loads(message.get("content", "{}"))
        
        if msg_type == "text":
            user_text = content.get("text", "")
            print(f"[飞书] 收到消息 [{chat_type}]: {user_text}")
            
            # 调用 OpenCode（实际是提示信息）
            response_text = call_opencode(user_text)
            
            # 回复飞书
            if chat_type == "p2p":
                # 单聊回复
                bot.reply_message(message_id, response_text)
            else:
                # 群聊回复
                bot.reply_message(message_id, response_text)
    
    return jsonify({"code": 0, "msg": "success"})

@app.route('/health', methods=['GET'])
def health():
    """健康检查"""
    return jsonify({"status": "ok"})

if __name__ == "__main__":
    print("=" * 50)
    print("OpenCode 飞书桥接服务器")
    print("=" * 50)
    print("注意：OpenCode CLI 不支持程序调用！")
    print("如需飞书接入 AI，请使用 OpenAI/Claude API")
    print("=" * 50)
    app.run(host="0.0.0.0", port=8080, debug=True)
