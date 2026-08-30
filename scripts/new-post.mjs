import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const [title, requestedSlug] = process.argv.slice(2);

if (!title) {
  console.error('用法：npm run new-post -- "文章标题" [url-slug]');
  process.exit(1);
}

const slug = (requestedSlug || title)
  .normalize("NFKC")
  .trim()
  .toLowerCase()
  .replace(/\s+/g, "-")
  .replace(/[^\p{Letter}\p{Number}-]/gu, "")
  .replace(/-+/g, "-")
  .replace(/^-|-$/g, "");

if (!slug) {
  console.error("无法从标题生成文件名，请显式提供 url-slug。");
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
const postsDirectory = path.resolve("src/content/posts");
const filePath = path.join(postsDirectory, `${slug}.md`);

if (existsSync(filePath)) {
  console.error(`文件已存在：${filePath}`);
  process.exit(1);
}

const content = `---
title: "${title.replaceAll('"', '\\"')}"
description: "请填写文章摘要"
publishedAt: ${today}
category: "未分类"
tags: ["随笔"]
draft: true
---

从这里开始写正文。完成后把 draft 改成 false，再提交到 GitHub。
`;

await mkdir(postsDirectory, { recursive: true });
await writeFile(filePath, content, "utf8");
console.log(`已创建：${path.relative(process.cwd(), filePath)}`);
