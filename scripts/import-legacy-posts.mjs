import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

const sourceRoot = process.argv[2] ? resolve(process.argv[2]) : null;

if (!sourceRoot) {
  console.error("Usage: node scripts/import-legacy-posts.mjs /path/to/old-blog");
  process.exit(1);
}

const posts = [
  {
    source: "container/inside-container.md",
    target: "src/content/posts/container-technology-principles.md",
    title: "容器技术原理",
    description: "从 Namespace、Cgroups 与镜像分层出发，理解 Linux 容器为什么本质上是一个受隔离和限制的进程。",
    publishedAt: "2022-09-12",
    tags: ["容器", "Linux", "Docker"],
    readingMinutes: 18,
  },
  {
    source: "mq/rocketmq-store.md",
    target: "src/content/posts/rocketmq-storage-structure.md",
    title: "RocketMQ 存储结构解析",
    description: "梳理 RocketMQ Broker 的 CommitLog、ConsumeQueue 与 Index File，以及刷盘、索引和查询机制。",
    publishedAt: "2022-08-04",
    tags: ["RocketMQ", "消息队列", "存储"],
    readingMinutes: 10,
  },
];

const hintLabels = {
  warning: "注意",
  success: "要点",
  info: "补充",
};

function quoteHint(style, body) {
  const label = hintLabels[style] ?? "说明";
  const quotedBody = body
    .trim()
    .split("\n")
    .map((line) => (line ? `> ${line}` : ">"))
    .join("\n");

  return `> **${label}**\n>\n${quotedBody}`;
}

function normalizeMarkdown(markdown) {
  return markdown
    .replace(/^# .+\n+/, "")
    .replace(
      /\{% hint style="([^"]+)" %\}\n([\s\S]*?)\n\{% endhint %\}/g,
      (_, style, body) => quoteHint(style, body),
    )
    .replace(
      /<figure><img src="\.\.\/\.gitbook\/assets\/([^"]+)" alt=""><figcaption><\/figcaption><\/figure>/g,
      (_, filename) => `![文章示意图](/images/legacy/${filename})`,
    )
    .replaceAll("&#x20;", "")
    .replace(
      /\*\*([^*\n]+?)([：:])\s*\*\*(?=\S)/g,
      (_, label, punctuation) => `**${label.trimEnd()}**${punctuation}`,
    )
    .trim();
}

function frontmatter(post) {
  return [
    "---",
    `title: ${JSON.stringify(post.title)}`,
    `description: ${JSON.stringify(post.description)}`,
    `publishedAt: ${post.publishedAt}`,
    'category: "技术现场"',
    `tags: ${JSON.stringify(post.tags)}`,
    `readingMinutes: ${post.readingMinutes}`,
    "draft: false",
    "---",
    "",
  ].join("\n");
}

await mkdir(resolve("src/content/posts"), { recursive: true });
await mkdir(resolve("public/images/legacy"), { recursive: true });

for (const post of posts) {
  const sourcePath = resolve(sourceRoot, post.source);
  const targetPath = resolve(post.target);
  const markdown = await readFile(sourcePath, "utf8");
  await writeFile(targetPath, `${frontmatter(post)}${normalizeMarkdown(markdown)}\n`);
  console.log(`Imported ${post.source} -> ${post.target}`);
}

for (const filename of [
  "virtualization-vs-containers_transparent.png",
  "9bff1040-96a6-4fef-a691-5a9518d2a339.png",
  "c7c5b5f1-4892-4255-9eda-ae3080898f86.png",
]) {
  const sourcePath = resolve(sourceRoot, ".gitbook/assets", filename);
  const targetPath = resolve("public/images/legacy", basename(filename));
  await copyFile(sourcePath, targetPath);
  console.log(`Copied ${filename}`);
}
