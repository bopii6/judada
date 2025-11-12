const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 开始准备 Vercel 部署...');

// 1. 构建项目
console.log('📦 构建项目...');
try {
  execSync('pnpm build', { stdio: 'inherit' });
  console.log('✅ 构建成功');
} catch (error) {
  console.error('❌ 构建失败:', error.message);
  process.exit(1);
}

// 2. 创建 Vercel 需要的目录结构
console.log('📁 创建部署目录...');
if (!fs.existsSync('.vercel')) {
  fs.mkdirSync('.vercel');
}

if (!fs.existsSync('.vercel/output')) {
  fs.mkdirSync('.vercel/output');
}

// 3. 复制构建文件
console.log('📋 复制构建文件...');
const copyDir = (src, dest) => {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const files = fs.readdirSync(src);
  files.forEach(file => {
    const srcPath = path.join(src, file);
    const destPath = path.join(dest, file);

    if (fs.statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  });
};

// 复制前端文件
if (fs.existsSync('apps/web/dist')) {
  copyDir('apps/web/dist', '.vercel/output');
}

// 复制后端文件
if (fs.existsSync('apps/server/dist')) {
  copyDir('apps/server/dist', '.vercel/output/api');
}

console.log('✅ 部署准备完成！');
console.log('\n🎯 下一步操作：');
console.log('1. 安装 Vercel CLI: npm i -g vercel');
console.log('2. 登录 Vercel: vercel login');
console.log('3. 部署: vercel');
console.log('4. 在 Vercel 控制台配置环境变量');