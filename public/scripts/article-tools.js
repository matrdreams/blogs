(() => {
  const article = document.querySelector("[data-article-body]");
  if (!article) return;

  const copyText = async (value) => {
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
    await navigator.clipboard.writeText(value);
  };

  const showCopiedState = (button, copiedText, idleText) => {
    button.textContent = copiedText;
    button.dataset.copied = "true";
    window.setTimeout(() => {
      button.textContent = idleText;
      delete button.dataset.copied;
    }, 1800);
  };

  for (const heading of article.querySelectorAll("h2[id], h3[id], h4[id]")) {
    const tools = document.createElement("span");
    tools.className = "heading-tools";

    const anchor = document.createElement("a");
    anchor.className = "heading-anchor";
    anchor.href = `#${heading.id}`;
    anchor.textContent = "#";
    anchor.setAttribute("aria-label", `定位到“${heading.textContent?.trim() ?? "本节"}”`);

    const copyButton = document.createElement("button");
    copyButton.className = "heading-copy-button";
    copyButton.type = "button";
    copyButton.textContent = "复制";
    copyButton.setAttribute("aria-label", `复制“${heading.textContent?.trim() ?? "本节"}”的链接`);
    copyButton.addEventListener("click", async () => {
      const url = new URL(window.location.href);
      url.hash = heading.id;
      try {
        await copyText(url.href);
        showCopiedState(copyButton, "已复制", "复制");
      } catch {
        copyButton.textContent = "复制失败";
      }
    });

    tools.append(anchor, copyButton);
    heading.append(tools);
  }

  for (const pre of article.querySelectorAll("pre")) {
    const wrapper = document.createElement("div");
    wrapper.className = "code-block";
    pre.before(wrapper);
    wrapper.append(pre);

    const toolbar = document.createElement("div");
    toolbar.className = "code-block-toolbar";
    const language = document.createElement("span");
    language.className = "code-language";
    const sourceLanguage = pre.dataset.language ?? "text";
    language.textContent = sourceLanguage === "plaintext" ? "TEXT" : sourceLanguage.toUpperCase();
    pre.setAttribute("aria-label", `${language.textContent} 代码块，可横向滚动`);

    const button = document.createElement("button");
    button.className = "code-copy-button";
    button.type = "button";
    button.textContent = "复制代码";
    button.setAttribute("aria-label", "复制代码块内容");
    button.addEventListener("click", async () => {
      const code = pre.querySelector("code")?.textContent ?? pre.textContent ?? "";
      try {
        await copyText(code);
        showCopiedState(button, "已复制", "复制代码");
      } catch {
        button.textContent = "复制失败";
      }
    });

    toolbar.append(language, button);
    wrapper.prepend(toolbar);
  }

  for (const table of article.querySelectorAll("table")) {
    const wrapper = document.createElement("div");
    wrapper.className = "table-scroll";
    wrapper.tabIndex = 0;
    wrapper.setAttribute("role", "region");
    wrapper.setAttribute("aria-label", table.caption?.textContent?.trim() || "文章表格，可横向滚动");
    table.before(wrapper);
    wrapper.append(table);
  }

  const headings = [...article.querySelectorAll("h2[id], h3[id]")];
  const tocLinks = [...document.querySelectorAll(".article-toc a")];
  const updateCurrentSection = () => {
    const current = headings.filter((heading) => heading.getBoundingClientRect().top <= window.innerHeight * 0.3).at(-1) ?? headings[0];
    for (const link of tocLinks) {
      if (current && link.getAttribute("href") === `#${current.id}`) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    }
  };
  if (headings.length && tocLinks.length && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver(updateCurrentSection, { rootMargin: "0px 0px -70% 0px" });
    headings.forEach((heading) => observer.observe(heading));
    updateCurrentSection();
    window.addEventListener("hashchange", updateCurrentSection);
  }
})();
