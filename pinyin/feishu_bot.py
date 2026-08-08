#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
飞书机器人服务端示例 - 接收消息并回复
"""

import json
import hmac
import hashlib
import base64
import requests
from flask import Flask, request, jsonify
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend

app = Flask(__name__)

# ==================== 配置区域 ====================
APP_ID = "cli_xxxxxxxxxx"           # 替换为你的 App ID
APP_SECRET = "xxxxxxxxxxxxxxxx"      # 替换为你的 App Secret
ENCRYPT_KEY = "xxxxxxxx"             # 替换为你的 Encrypt Key（可选）
VERIFICATION_TOKEN = "xxxxxxxx"      # 替换为你的 Verification Token
# =================================================

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
    
    def send_text_message(self, chat_id, text):
        """发送文本消息"""
        if not self.tenant_access_token:
            self.get_tenant_access_token()
            
        url = "https://open.feishu.cn/open-apis/im/v1/messages"
        headers = {
            "Authorization": f"Bearer {self.tenant_access_token}",
            "Content-Type": "application/json"
        }
        params = {"receive_id_type": "chat_id"}
        data = {
            "receive_id": chat_id,
            "msg_type": "text",
            "content": json.dumps({"text": text})
        }
        
        response = requests.post(url, headers=headers, params=params, json=data)
        return response.json()
    
    def reply_message(self, message_id, text):
        """回复指定消息"""
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

# 初始化机器人
bot = FeishuBot(APP_ID, APP_SECRET)

def decrypt_data(encrypt_key, encrypt_data):
    """解密飞书加密消息"""
    if not encrypt_data:
        return None
        
    # 对 encrypt_key 进行 MD5 哈希，取前 16 字节作为 AES 密钥
    key = hashlib.md5(encrypt_key.encode()).digest()[:16]
    
    # Base64 解码
    ciphertext = base64.b64decode(encrypt_data)
    
    # AES-256-CBC 解密
    cipher = Cipher(algorithms.AES(key), modes.CBC(b'\x00' * 16), backend=default_backend())
    decryptor = cipher.decryptor()
    plaintext = decryptor.update(ciphertext) + decryptor.finalize()
    
    # 去除填充
    padding_length = plaintext[-1]
    plaintext = plaintext[:-padding_length]
    
    return plaintext.decode('utf-8')

@app.route('/webhook', methods=['POST'])
def webhook():
    """接收飞书事件推送"""
    data = request.get_json()
    
    # 1. 处理 URL 验证（首次配置时需要）
    if data.get("type") == "url_verification":
        challenge = data.get("challenge")
        return jsonify({"challenge": challenge})
    
    # 2. 解密消息（如果启用了加密）
    encrypt_data = data.get("encrypt")
    if encrypt_data and ENCRYPT_KEY:
        decrypted = decrypt_data(ENCRYPT_KEY, encrypt_data)
        data = json.loads(decrypted)
    
    # 3. 处理回调事件
    event = data.get("event", {})
    event_type = event.get("type")
    
    if event_type == "im.message.receive_v1":
        # 接收到了消息
        message = event.get("message", {})
        sender = event.get("sender", {})
        
        message_id = message.get("message_id")
        chat_id = message.get("chat_id")
        chat_type = message.get("chat_type")  # p2p: 单聊, group: 群聊
        msg_type = message.get("message_type")
        content = json.loads(message.get("content", "{}"))
        
        # 获取消息文本
        if msg_type == "text":
            user_text = content.get("text", "")
        else:
            user_text = "[非文本消息]"
        
        print(f"收到消息 [{chat_type}]: {user_text}")
        
        # TODO: 在这里调用你的 AI 处理逻辑
        # ai_response = your_ai_function(user_text)
        ai_response = f"你好！你发送了：{user_text}"
        
        # 回复消息（使用 reply_message 会@用户，使用 send_text_message 不会@）
        if chat_type == "p2p":
            # 单聊直接发送消息
            bot.send_text_message(chat_id, ai_response)
        else:
            # 群聊回复原消息
            bot.reply_message(message_id, ai_response)
    
    # 返回成功响应
    return jsonify({"code": 0, "msg": "success"})

if __name__ == "__main__":
    # 生产环境请使用 gunicorn 或 uWSGI
    app.run(host="0.0.0.0", port=8080, debug=True)
