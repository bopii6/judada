# ChatGPT CSV 生成提示词模板

## 使用说明

1. 将教材 PDF 上传到 ChatGPT
2. 复制下方提示词发送给 ChatGPT
3. 下载生成的 CSV 文件
4. 在管理后台的课程详情页点击"上传 CSV"按钮导入

---

## 提示词模板

```
请根据这本英语教材PDF，为我生成一个CSV格式的闯关句子表。

要求：
- 共4个单元，每个单元4轮，每轮16个句子
- 总计：4 × 4 × 16 = 256 个句子
- 每一轮需要有一个语法/话题主题名称（如"动作进行（现在进行时）类"、"地点方位类"等）
- 句子要有质量，选取教材中的核心句型和重点句子
- 每个句子必须包含准确的中文翻译
- 不要选择标题、页眉页脚等非句子内容

CSV格式要求（第一行为表头）：
unit,unit_title,round,round_title,en,cn,page

列说明：
- unit: 单元序号（1-4）
- unit_title: 单元标题（如 "Unit 1 Going to Beijing"）
- round: 轮次序号（1-4）
- round_title: 轮次话题/语法主题（如 "动作进行（现在进行时）类"、"地点方位类"）
- en: 英文句子
- cn: 中文翻译
- page: 来源页码（可选，填数字即可）

请直接输出CSV内容，不要添加其他说明。确保CSV格式正确，字段中如有逗号请用双引号包裹。
```

---

## CSV 示例

```csv
unit,unit_title,round,round_title,en,cn,page
1,Unit 1 Going to Beijing,1,问候与自我介绍类,What is your name?,你叫什么名字？,4
1,Unit 1 Going to Beijing,1,问候与自我介绍类,My name is Li Ming.,我叫李明。,4
1,Unit 1 Going to Beijing,1,问候与自我介绍类,Nice to meet you.,很高兴见到你。,4
1,Unit 1 Going to Beijing,2,动作进行（现在进行时）类,Jenny is looking out of the window.,珍妮正向窗外看。,8
1,Unit 1 Going to Beijing,2,动作进行（现在进行时）类,Li Ming is reading a book.,李明正在读书。,8
1,Unit 1 Going to Beijing,2,动作进行（现在进行时）类,Jenny is drawing a picture now.,珍妮正在画画。,8
1,Unit 1 Going to Beijing,3,地点方位类,Where is the school?,学校在哪里？,12
1,Unit 1 Going to Beijing,3,地点方位类,It is near the park.,它在公园附近。,12
1,Unit 1 Going to Beijing,4,交通出行类,How do you go to school?,你怎么去学校？,16
1,Unit 1 Going to Beijing,4,交通出行类,I go to school by bus.,我坐公交车去学校。,16
2,Unit 2 What Time Is It?,1,时间表达类,What time is it?,现在几点了？,20
2,Unit 2 What Time Is It?,1,时间表达类,It is seven o'clock.,现在七点了。,20
```

---

## 注意事项

1. **单元数量可调整**：如果教材只有3个单元，可以修改提示词中的"共4个单元"为"共3个单元"
2. **轮次数量可调整**：每个单元的轮次数量可以根据需要调整（1-8轮）
3. **句子数量可调整**：每轮的句子数量可以根据需要调整
4. **轮次话题很重要**：每一轮的 round_title 应该描述该轮句子的语法点或话题类型
5. **中文翻译很重要**：确保每个句子都有准确的中文翻译
6. **特殊字符处理**：如果句子中包含逗号，ChatGPT 应该用双引号包裹整个字段

## 常见的轮次话题示例

- 问候与自我介绍类
- 动作进行（现在进行时）类
- 地点方位类
- 时间表达类
- 交通出行类
- 数量与价格类
- 天气与季节类
- 日常活动类
- 情感与感受类
- 请求与建议类

