# 腾讯云OCR配置指南

## 🎯 恭喜！腾讯云OCR已集成完成

您的系统已成功切换到腾讯云OCR，去除了阿里云和OpenAI方案。

## 📋 配置步骤

### 1. 获取腾讯云SecretId和SecretKey

1. **访问腾讯云控制台**：https://console.cloud.tencent.com/
2. **点击右上角头像** → "访问管理"
3. **左侧菜单** → "访问密钥" → "API密钥管理"
4. **点击"新建密钥"** 或使用现有密钥
5. **复制SecretId和SecretKey**

### 2. 开通OCR服务

1. **在控制台搜索**："文字识别OCR"
2. **点击"立即使用"**开通服务
3. **选择免费套餐**或按需付费
   - 免费额度：每月1000次
4. **确认开通**即可使用

### 3. 配置环境变量

在项目根目录的 `.env` 文件中设置：

```bash
# 腾讯云OCR配置
TENCENT_SECRET_ID=your-actual-secret-id-here
TENCENT_SECRET_KEY=your-actual-secret-key-here
```

### 4. 测试配置

运行测试脚本验证配置：

```bash
cd "E:\julebucoding\apps\server"
node test-tencent-ocr.js
```

## 🔧 常见问题解决

### 问题1：下载失败 (FailedOperation.DownLoadError)

**原因**：腾讯云OCR无法下载图片
**解决方案**：
1. 确保图片URL可以公开访问
2. 检查网络连接
3. 尝试使用不同的图片URL

### 问题2：权限不足 (UnauthorizedOperation)

**原因**：OCR服务未开通或权限不足
**解决方案**：
1. 确认已开通OCR服务
2. 检查SecretId和SecretKey是否正确
3. 确认账户余额充足

### 问题3：网络连接问题

**原因**：网络环境限制
**解决方案**：
1. 检查防火墙设置
2. 确保可以访问腾讯云API
3. 尝试使用代理

## 🎉 功能特点

### ✅ 已实现功能
- [x] 完全替换为腾讯云OCR
- [x] 自动错误处理和日志记录
- [x] 与原系统格式兼容
- [x] 支持中英文识别
- [x] 文档识别优化

### 🔧 技术架构
- **OCR服务**：腾讯云文字识别 OCR
- **SDK版本**：tencentcloud-sdk-nodejs 4.1.136
- **识别类型**：通用文字识别 (GeneralBasicOCR)
- **支持格式**：JPG, PNG, BMP等常见图片格式

## 📞 技术支持

如遇到问题：
1. **腾讯云文档**：https://cloud.tencent.com/document/product/866
2. **腾讯云工单**：控制台 → 工单 → 提交工单
3. **腾讯云客服**：95716

## 🚀 下一步

配置完成后，您的OCR服务将：
- 自动处理图片文字识别
- 与现有系统无缝集成
- 提供稳定的文字识别服务