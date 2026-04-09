# MedicalEnglish

医学英语课程构词法学习网站，当前已完成第一单元，第二到第八单元已预留结构。

## 本地预览

```bash
python3 -m http.server 8000
```

然后访问 [http://localhost:8000](http://localhost:8000)。

## 项目结构

- `index.html`：首页，展示课程简介与单元入口
- `unit.html`：单元总览页
- `morpheme.html`：词根/词缀详情页
- `flashcards.html`：抽认卡练习页
- `assets/css/styles.css`：设计系统与页面样式
- `assets/js/site.js`：多页面渲染、抽认卡与发音播放逻辑
- `assets/data/course-data.js`：课程内容数据源
- `assets/audio/terms/`：可选的术语音频目录，后续如果有自备录音可直接接入

## 如何补充新单元

1. 在 `assets/data/course-data.js` 中找到对应单元。
2. 按第一单元的数据结构继续补充 `roots` 和 `affixes`。

## 说明

- 页面默认使用浏览器原生语音能力进行点击发音播放。
- 如果后续你有更高质量的录音文件，也可以按术语名放入 `assets/audio/terms/` 再扩展播放逻辑。
- 页面为纯静态站点，适合直接部署到 GitHub Pages、Netlify 或任意静态托管平台。
