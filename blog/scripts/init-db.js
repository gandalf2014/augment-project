#!/usr/bin/env node

/**
 * 数据库初始化脚本
 * 用于创建 D1 数据库并初始化表结构和数据
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DB_NAME = 'blog-db-prod';

async function main() {
  console.log('🚀 开始初始化博客数据库...');

  try {
    // 1. 创建 D1 数据库
    console.log('📦 创建 D1 数据库...');
    try {
      const createResult = execSync(`npx wrangler d1 create ${DB_NAME}`, { 
        encoding: 'utf8',
        stdio: 'pipe'
      });
      console.log(createResult);
      
      // 提取数据库 ID
      const dbIdMatch = createResult.match(/database_id = "([^"]+)"/);
      if (dbIdMatch) {
        const databaseId = dbIdMatch[1];
        console.log(`✅ 数据库创建成功，ID: ${databaseId}`);
        
        // 更新 wrangler.jsonc 中的 database_id
        updateWranglerConfig(databaseId);
      }
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('📦 数据库已存在，跳过创建步骤');
      } else {
        throw error;
      }
    }

    // 2. 执行 schema.sql
    console.log('🏗️  创建数据库表结构...');
    const schemaPath = path.join(__dirname, '../database/schema.sql');
    execSync(`npx wrangler d1 execute ${DB_NAME} --local --file=${schemaPath}`, {
      stdio: 'inherit'
    });
    console.log('✅ 表结构创建完成');

    // 3. 执行 seed.sql
    console.log('🌱 插入初始化数据...');
    const seedPath = path.join(__dirname, '../database/seed.sql');
    execSync(`npx wrangler d1 execute ${DB_NAME} --local --file=${seedPath}`, {
      stdio: 'inherit'
    });
    console.log('✅ 初始化数据插入完成');

    console.log('\n🎉 数据库初始化完成！');
    console.log('\n📋 接下来的步骤：');
    console.log('1. 运行 npm run dev 启动开发服务器');
    console.log('2. 访问 http://localhost:8787 查看博客');
    console.log('3. 使用 admin@example.com / password 登录管理后台');
    console.log('\n⚠️  注意：请记得修改默认密码和配置！');

  } catch (error) {
    console.error('❌ 数据库初始化失败:', error.message);
    process.exit(1);
  }
}

function updateWranglerConfig(databaseId) {
  const configPath = path.join(__dirname, '../wrangler.jsonc');
  let config = fs.readFileSync(configPath, 'utf8');
  
  // 替换 database_id
  config = config.replace(
    /"database_id": "blog-db"/,
    `"database_id": "${databaseId}"`
  );
  
  fs.writeFileSync(configPath, config);
  console.log('✅ wrangler.jsonc 配置已更新');
}

// 如果直接运行此脚本
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };
