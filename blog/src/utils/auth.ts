/**
 * 认证相关工具函数
 */

import type { AuthUser } from '../types/database';

// JWT 头部和载荷的接口
interface JWTHeader {
  alg: string;
  typ: string;
}

interface JWTPayload extends AuthUser {
  iat: number;
  exp: number;
}

// Base64URL 编码（支持 UTF-8）
function base64UrlEncode(data: string): string {
  // 使用 TextEncoder 将字符串转换为 UTF-8 字节数组
  const encoder = new TextEncoder();
  const bytes = encoder.encode(data);

  // 将字节数组转换为 base64
  const binaryString = Array.from(bytes, byte => String.fromCharCode(byte)).join('');

  return btoa(binaryString)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Base64URL 解码（支持 UTF-8）
function base64UrlDecode(data: string): string {
  // 补齐 padding
  const padding = '='.repeat((4 - (data.length % 4)) % 4);
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/') + padding;

  // 解码为二进制字符串
  const binary = atob(base64);

  // 转换为字节数组
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  // 解码为 UTF-8 字符串
  const decoder = new TextDecoder();
  return decoder.decode(bytes);
}

// 生成 JWT Token
export async function generateJWT(user: AuthUser, secret: string, expiresIn: number = 24 * 60 * 60): Promise<string> {
  const header: JWTHeader = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const payload: JWTPayload = {
    ...user,
    iat: now,
    exp: now + expiresIn
  };

  // 编码头部和载荷
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));

  // 创建签名
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = await sign(data, secret);

  return `${data}.${signature}`;
}

// 验证 JWT Token
export async function verifyJWT(token: string, secret: string): Promise<AuthUser> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token format');
  }

  const [encodedHeader, encodedPayload, signature] = parts;

  // 验证签名
  const data = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = await sign(data, secret);

  if (signature !== expectedSignature) {
    throw new Error('Invalid token signature');
  }

  // 解码载荷
  const payload: JWTPayload = JSON.parse(base64UrlDecode(encodedPayload));

  // 检查过期时间
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) {
    throw new Error('Token expired');
  }

  // 返回用户信息（去除 JWT 特定字段）
  const { iat, exp, ...user } = payload;
  return user;
}

// HMAC-SHA256 签名
async function sign(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const signatureArray = new Uint8Array(signature);
  
  // 转换为 base64url
  let binary = '';
  for (let i = 0; i < signatureArray.length; i++) {
    binary += String.fromCharCode(signatureArray[i]);
  }
  
  return base64UrlEncode(binary);
}

// 密码哈希（使用 Web Crypto API）
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  
  // 生成随机盐
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  // 使用 PBKDF2 进行哈希
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    data,
    'PBKDF2',
    false,
    ['deriveBits']
  );
  
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  
  const hashArray = new Uint8Array(hashBuffer);
  
  // 组合盐和哈希
  const combined = new Uint8Array(salt.length + hashArray.length);
  combined.set(salt);
  combined.set(hashArray, salt.length);
  
  // 转换为 base64
  let binary = '';
  for (let i = 0; i < combined.length; i++) {
    binary += String.fromCharCode(combined[i]);
  }
  
  return btoa(binary);
}

// 验证密码
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    
    // 解码存储的哈希
    const combined = new Uint8Array(atob(hash).split('').map(c => c.charCodeAt(0)));
    
    // 提取盐和哈希
    const salt = combined.slice(0, 16);
    const storedHash = combined.slice(16);
    
    // 使用相同的盐重新计算哈希
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      data,
      'PBKDF2',
      false,
      ['deriveBits']
    );
    
    const hashBuffer = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      256
    );
    
    const computedHash = new Uint8Array(hashBuffer);
    
    // 比较哈希
    if (computedHash.length !== storedHash.length) {
      return false;
    }
    
    for (let i = 0; i < computedHash.length; i++) {
      if (computedHash[i] !== storedHash[i]) {
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error('Password verification error:', error);
    return false;
  }
}

// 生成随机字符串
export function generateRandomString(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(array, byte => chars[byte % chars.length]).join('');
}
