#!/usr/bin/env node

/**
 * 密码哈希生成脚本
 */

// 简化版的密码哈希函数（与 auth.ts 中的实现一致）
async function hashPassword(password) {
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

async function main() {
  const password = process.argv[2] || 'password';
  console.log('Generating hash for password:', password);
  
  try {
    const hash = await hashPassword(password);
    console.log('Password hash:', hash);
  } catch (error) {
    console.error('Error generating hash:', error);
  }
}

if (require.main === module) {
  main();
}
