# sage-cli

极简静态博客 CLI 工具。

## 安装

```bash
# 全局安装
npm install -g sage-cli

# 或在博客项目中作为依赖
npm install sage-cli --save
```

## 命令

在博客项目根目录（包含 `site.config.js`）下运行：

```bash
sage new "文章标题"       # 创建新文章模板
sage build                # 构建静态站点
sage preview 8080         # 本地预览
sage publish "发布消息"    # Git 提交并推送
sage status               # 查看站点状态
sage migrate              # 从旧格式迁移
```

## 博客项目结构

一个 sage 博客项目需要包含：

```
├── site.config.js     # 站点配置
├── build.js           # 构建脚本
├── content/           # Markdown 文章
├── templates/          # HTML 模板
└── assets/             # 静态资源
```

## site.config.js

```js
module.exports = {
  name: '我的博客',
  description: '博客描述',
  url: 'https://example.com',
  author: '博主',
  lang: 'zh-CN',
  perPage: 10,
  tagSlugMap: {
    '技术': 'tech',
    '前端': 'frontend',
    // 更多中文→slug映射...
  },
  legacyPostsDir: '../posts',  // 迁移时的旧文章目录（相对）
}
```

## 许可

MIT