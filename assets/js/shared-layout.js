(function () {
  let resizeFrameId = 0;

  function downloadCsv(rows, fileName) {
    const csv = rows
      .map((row) =>
        row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(";")
      )
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function scheduleParentHeightSync() {
    if (window.parent === window) {
      return;
    }

    window.cancelAnimationFrame(resizeFrameId);
    resizeFrameId = window.requestAnimationFrame(() => {
      const height = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.offsetHeight
      );

      window.parent.postMessage(
        {
          type: "tool-height",
          page: window.location.pathname.split("/").pop(),
          height,
        },
        "*"
      );
    });
  }

  window.sharedLayout = {
    downloadCsv,
    scheduleParentHeightSync,
  };

  window.addEventListener("load", scheduleParentHeightSync);
  window.addEventListener("resize", scheduleParentHeightSync);
})();
