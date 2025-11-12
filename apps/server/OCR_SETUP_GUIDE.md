# 阿里云OCR服务配置指南

## 🚨 问题诊断

您遇到的 `ocrServiceNotOpen` 错误，原因是：
- AccessKey `LTAI5tRXPzCAkGmVrEqB8bDR` 属于主账号
- 主账号需要确保OCR服务在API层面已完全开通

## 🔧 解决方案

### 方案1：确保主账号OCR服务完全开通

1. **检查服务开通状态**
   - 访问：https://ocr.console.aliyun.com/
   - 确认显示"已开通"状态
   - 如果显示"未开通"，点击"立即开通"

2. **检查区域服务**
   - 确保在**华东1（杭州）**区域服务已开通
   - 有时需要为每个区域单独开通

3. **检查账户状态**
   - 确保账户余额充足（>100元）
   - 确保没有欠费记录
   - 确保账户状态正常

### 方案2：创建专用RAM用户（推荐）

1. **创建RAM用户**
   ```
   访问控制 → 人员管理 → 用户 → 创建用户
   - 用户名：ocr-service-user
   - 登录名称：ocr-service-user@your-company.onaliyun.com
   - 访问方式：OpenAPI调用
   ```

2. **创建AccessKey**
   - 创建用户后立即创建AccessKey
   - **保存好AccessKey ID和Secret**

3. **授权OCR权限**
   ```
   权限管理 → 新增授权
   - 搜索：AliyunOCRFullAccess
   - 选择该权限并确定
   ```

4. **更新项目配置**
   ```bash
   # 更新 .env 文件
   ALIYUN_OCR_ACCESS_KEY_ID=新的AccessKey ID
   ALIYUN_OCR_ACCESS_KEY_SECRET=新的AccessKey Secret
   ```

## 🧪 测试验证

配置完成后，运行测试：
```bash
cd "E:\julebucoding\apps\server"
node test-ocr.js
```

## 🆘 如果仍然失败

1. **联系阿里云技术支持**
   - 电话：95187
   - 在线工单：https://selfservice.console.aliyun.com/

2. **提供以下信息**
   - 错误代码：ocrServiceNotOpen
   - 请求ID：64480B89-AD4F-5597-B2D7-83E5CEB21549
   - AccessKey ID：LTAI5tRXPzCAkGmVrEqB8bDR
   - 区域：cn-hangzhou

3. **说明情况**
   - 控制台可以正常使用OCR
   - 但API调用返回服务未开通
   - 请求检查主账号的OCR API服务状态

## 📋 快速检查清单

- [ ] 主账号已开通OCR服务
- [ ] 华东1（杭州）区域服务已开通
- [ ] 账户余额充足（>100元）
- [ ] 账户无欠费记录
- [ ] AccessKey状态正常（未禁用）
- [ ] 网络连接正常（能访问阿里云API）