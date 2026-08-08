/**
 * 飞书机器人 - Cloudflare Workers 版本
 * 
 * 部署步骤：
 * 1. 在 Cloudflare Dashboard 创建 Workers 项目
 * 2. 在 Workers 设置中添加环境变量：
 *    - APP_ID: 你的飞书 App ID
 *    - APP_SECRET: 你的飞书 App Secret
 *    - ENCRYPT_KEY: 你的加密密钥（可选，如果没有启用加密则不需要）
 *    - VERIFICATION_TOKEN: 验证令牌（可选）
 * 3. 复制此代码到 Workers 编辑器或部署
 * 4. 获取 Workers URL，配置到飞书事件订阅中
 */

export default {
  async fetch(request, env, ctx) {
    // 获取环境变量
    const APP_ID = env.APP_ID;
    const APP_SECRET = env.APP_SECRET;
    const ENCRYPT_KEY = env.ENCRYPT_KEY || '';
    
    // 只处理 POST 请求
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    try {
      const data = await request.json();
      
      // 1. 处理 URL 验证（首次配置回调地址时需要）
      if (data.type === 'url_verification') {
        return new Response(
          JSON.stringify({ challenge: data.challenge }),
          { 
            headers: { 'Content-Type': 'application/json' },
            status: 200 
          }
        );
      }
      
      // 2. 解密消息（如果启用了加密）
      let eventData = data;
      if (data.encrypt && ENCRYPT_KEY) {
        const decrypted = await decryptData(ENCRYPT_KEY, data.encrypt);
        eventData = JSON.parse(decrypted);
      }
      
      // 3. 处理回调事件
      const event = eventData.event || {};
      const eventType = event.type;
      
      if (eventType === 'im.message.receive_v1') {
        const message = event.message || {};
        const chatId = message.chat_id;
        const chatType = message.chat_type; // p2p: 单聊, group: 群聊
        const messageId = message.message_id;
        const msgType = message.message_type;
        const content = JSON.parse(message.content || '{}');
        
        // 获取消息文本
        let userText = '[非文本消息]';
        if (msgType === 'text') {
          userText = content.text || '';
        }
        
        console.log(`收到消息 [${chatType}]: ${userText}`);
        
        // TODO: 在这里调用你的 AI 处理逻辑
        // 示例：你可以调用 OpenAI API 或其他 AI 服务
        const aiResponse = await processAIRequest(userText, env);
        
        // 发送回复
        if (chatType === 'p2p') {
          await sendTextMessage(chatId, aiResponse, APP_ID, APP_SECRET);
        } else {
          await replyMessage(messageId, aiResponse, APP_ID, APP_SECRET);
        }
      }
      
      // 返回成功响应
      return new Response(
        JSON.stringify({ code: 0, msg: 'success' }),
        { 
          headers: { 'Content-Type': 'application/json' },
          status: 200 
        }
      );
      
    } catch (error) {
      console.error('处理请求出错:', error);
      return new Response(
        JSON.stringify({ code: 500, msg: error.message }),
        { 
          headers: { 'Content-Type': 'application/json' },
          status: 500 
        }
      );
    }
  }
};

/**
 * 处理 AI 请求
 * 这里可以替换为你自己的 AI 逻辑
 */
async function processAIRequest(userText, env) {
  // 示例 1：简单回复（测试用）
  // return `你好！你发送了：${userText}`;
  
  // 示例 2：调用 OpenAI API
  if (env.OPENAI_API_KEY) {
    return await callOpenAI(userText, env.OPENAI_API_KEY);
  }
  
  // 示例 3：调用 Claude API
  if (env.CLAUDE_API_KEY) {
    return await callClaude(userText, env.CLAUDE_API_KEY);
  }
  
  return `你好！你发送了：${userText}`;
}

/**
 * 调用 OpenAI API
 */
async function callOpenAI(prompt, apiKey) {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000
      })
    });
    
    const data = await response.json();
    if (data.choices && data.choices[0]) {
      return data.choices[0].message.content;
    }
    return '抱歉，AI 处理出现问题';
  } catch (error) {
    console.error('OpenAI API 错误:', error);
    return '抱歉，AI 服务暂时不可用';
  }
}

/**
 * 调用 Claude API
 */
async function callClaude(prompt, apiKey) {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    
    const data = await response.json();
    if (data.content && data.content[0]) {
      return data.content[0].text;
    }
    return '抱歉，AI 处理出现问题';
  } catch (error) {
    console.error('Claude API 错误:', error);
    return '抱歉，AI 服务暂时不可用';
  }
}

/**
 * 获取 Tenant Access Token
 */
async function getTenantAccessToken(appId, appSecret) {
  const url = 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal';
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: appId,
      app_secret: appSecret
    })
  });
  
  const data = await response.json();
  
  if (data.code === 0) {
    return data.tenant_access_token;
  } else {
    throw new Error(`获取 token 失败: ${JSON.stringify(data)}`);
  }
}

/**
 * 发送文本消息
 */
async function sendTextMessage(chatId, text, appId, appSecret) {
  const token = await getTenantAccessToken(appId, appSecret);
  const url = 'https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id';
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      receive_id: chatId,
      msg_type: 'text',
      content: JSON.stringify({ text: text })
    })
  });
  
  return await response.json();
}

/**
 * 回复指定消息
 */
async function replyMessage(messageId, text, appId, appSecret) {
  const token = await getTenantAccessToken(appId, appSecret);
  const url = `https://open.feishu.cn/open-apis/im/v1/messages/${messageId}/reply`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      content: JSON.stringify({ text: text }),
      msg_type: 'text'
    })
  });
  
  return await response.json();
}

/**
 * 解密飞书加密消息
 * 使用 Web Crypto API 实现 AES-256-CBC 解密
 */
async function decryptData(encryptKey, encryptData) {
  if (!encryptData || !encryptKey) {
    return null;
  }
  
  try {
    // 1. 计算 MD5 哈希（取前 16 字节作为密钥）
    const keyBuffer = await crypto.subtle.digest(
      'MD5',
      new TextEncoder().encode(encryptKey)
    );
    const key = keyBuffer.slice(0, 16);
    
    // 2. Base64 解码密文
    const ciphertext = base64ToUint8Array(encryptData);
    
    // 3. 提取 IV（前 16 字节）和实际密文
    const iv = new Uint8Array(16); // 使用 16 个零作为 IV
    const encrypted = ciphertext;
    
    // 4. 使用 AES-CBC 解密
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'AES-CBC' },
      false,
      ['decrypt']
    );
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-CBC', iv: iv },
      cryptoKey,
      encrypted
    );
    
    // 5. 去除 PKCS7 填充
    const decryptedArray = new Uint8Array(decrypted);
    const paddingLength = decryptedArray[decryptedArray.length - 1];
    const unpadded = decryptedArray.slice(0, decryptedArray.length - paddingLength);
    
    return new TextDecoder().decode(unpadded);
  } catch (error) {
    console.error('解密失败:', error);
    throw error;
  }
}

/**
 * Base64 解码为 Uint8Array
 */
function base64ToUint8Array(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
