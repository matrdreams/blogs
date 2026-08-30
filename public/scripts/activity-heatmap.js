(() => {
  for (const activity of document.querySelectorAll("[data-weekly-activity]")) {
    const detail = activity.querySelector("[data-week-detail]");
    const cells = activity.querySelectorAll("[data-week-cell]");

    const selectWeek = (selectedCell) => {
      for (const cell of cells) cell.setAttribute("aria-pressed", "false");
      selectedCell.setAttribute("aria-pressed", "true");
      if (detail) detail.textContent = selectedCell.dataset.detail ?? "";
    };

    for (const cell of cells) {
      cell.addEventListener("mouseenter", () => selectWeek(cell));
      cell.addEventListener("focus", () => selectWeek(cell));
      cell.addEventListener("click", () => selectWeek(cell));
    }

  }
})();
