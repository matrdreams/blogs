# Kun 的博客

一个面向 Cloudflare Pages 的静态个人博客。文章保存在 GitHub 仓库的 Markdown 文件中；每次推送后，Cloudflare Pages 会重新构建站点，首页、文章页、分类、标签和每周更新记录都会自动更新。

生产站点使用 `https://matrdreams.com`。站点 canonical 和 Open Graph 地址均在构建时固定到该域名。

## 本地运行

需要 Node.js 22.12 或更高版本。仓库中的 `.node-version` 固定为 Cloudflare Pages v3 构建环境支持的 `22.16.0`。

```bash
npm install
npm run dev
```

完整检查与生产构建：

```bash
npm run build
```

静态输出位于 `dist/`。

## 发布一篇文章

文章目录：`src/content/posts/`

可以复制 `templates/post.md`，也可以运行：

```bash
npm run new-post -- "文章标题" article-url-slug
```

文章使用以下 frontmatter：

```yaml
---
title: "文章标题"
description: "显示在首页的摘要"
publishedAt: 2026-08-23
updatedAt: 2026-08-24 # 可选
category: "产品与设计"
tags: ["产品", "思考"]
readingMinutes: 8
draft: false
---
```

- 文件名决定文章地址，例如 `my-first-post.md` 会生成 `/posts/my-first-post/`。
- `draft: true` 不会生成页面，也不会出现在首页。
- `draft: false` 的文章会自动按 `publishedAt` 倒序出现在首页和归档。
- 一篇文章可以拥有多个 `tags`，构建时会自动生成对应的标签页面。
- `category` 会自动加入分类页。
- `publishedAt` 与 `updatedAt` 会自动聚合到首页过去 52 周的更新记录；同一篇文章在同一周只计一次。

完成文章后提交并推送：

```bash
git add src/content/posts/
git commit -m "publish: 文章标题"
git push
```

Cloudflare Pages 会监听你在项目设置中选定的生产分支，并在部署前校验文章元数据、完成生产构建；无论仓库使用 `main` 还是 `master`，都不需要手工修改首页。

## 连接 Cloudflare Pages

这是一次性设置：

1. 将本项目推送到 GitHub。
2. 进入 Cloudflare Dashboard → **Workers & Pages** → **Create application** → **Pages**。
3. 选择 **Import an existing Git repository**，授权并选择此仓库。
4. 选择仓库的默认分支作为生产分支（新仓库建议使用 `main`）。
5. Build command 填写 `npm run build`。
6. Build output directory 填写 `dist`。
7. 保存并执行第一次部署。

完成连接后，每次推送到生产分支，Cloudflare Pages 都会自动安装依赖、执行构建并发布。Pull Request 和非生产分支可以使用 Pages 的预览部署。

官方说明：

- [Cloudflare Pages 部署 Astro](https://developers.cloudflare.com/pages/framework-guides/deploy-an-astro-site/)
- [Cloudflare Pages Git 集成](https://developers.cloudflare.com/pages/configuration/git-integration/)
- [Astro Markdown 内容](https://docs.astro.build/en/guides/markdown-content/)

## 修改个人信息

站点名称、简介、邮箱和所在地集中在 `src/config.ts`。样式位于 `src/styles/global.css`。

## 内容如何自动进入首页

`src/content.config.ts` 会校验每篇 Markdown 的元数据。构建时，`src/lib/posts.ts` 读取全部非草稿文章并按发布时间排序；首页、归档、分类与标签页面共享同一份结果。因此不需要手工修改首页，也不存在首页和文章目录不同步的问题。

仓库原有的《容器技术原理》和《RocketMQ 存储结构解析》已经迁入内容集合。它们的 `publishedAt` 分别来自旧 Git 历史中的首次创作提交日期 `2022-09-12` 与 `2022-08-04`，不是迁移日期。
