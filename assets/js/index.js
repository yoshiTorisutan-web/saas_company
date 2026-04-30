document.addEventListener("DOMContentLoaded", () => {
  const summaryKicker = document.getElementById("portal-summary-kicker");
  const summaryTitle = document.getElementById("portal-summary-title");
  const summaryText = document.getElementById("portal-summary-text");
  const tabs = Array.from(document.querySelectorAll("[data-tool-tab]"));
  const primaryTabs = Array.from(document.querySelectorAll(".portal-tab"));
  const panels = new Map(
    Array.from(document.querySelectorAll("[data-tool-panel]")).map((panel) => [panel.dataset.toolPanel, panel])
  );

  const metadata = new Map(
    primaryTabs.map((tab) => [
      tab.dataset.toolTab,
      {
        kicker: tab.dataset.kicker || "",
        title: tab.dataset.title || "",
        summary: tab.dataset.summary || "",
      },
    ])
  );

  const toolApis = {
    benchmark: window.initBenchmarkTool?.(document.querySelector('[data-tool-root="benchmark"]')),
    pricing: window.initPricingTool?.(document.querySelector('[data-tool-root="pricing"]')),
    roi: window.initRoiTool?.(document.querySelector('[data-tool-root="roi"]')),
  };

  function setActiveTab(toolKey) {
    tabs.forEach((tab) => {
      const isActive = tab.dataset.toolTab === toolKey;
      tab.classList.toggle("is-active", isActive);
      tab.classList.toggle("active", isActive);
      tab.setAttribute("aria-selected", String(isActive));
      tab.setAttribute("aria-current", isActive ? "page" : "false");
      tab.tabIndex = isActive ? 0 : -1;
    });

    panels.forEach((panel, key) => {
      panel.hidden = key !== toolKey;
    });

    const data = metadata.get(toolKey);
    if (data) {
      summaryKicker.textContent = data.kicker;
      summaryTitle.textContent = data.title;
      summaryText.textContent = data.summary;
    }

    window.history.replaceState(null, "", `#${toolKey}`);

    window.requestAnimationFrame(() => {
      toolApis[toolKey]?.refresh?.();
    });
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      setActiveTab(tab.dataset.toolTab);
    });
  });

  const hashTool = window.location.hash.replace("#", "");
  setActiveTab(panels.has(hashTool) ? hashTool : "benchmark");
});
