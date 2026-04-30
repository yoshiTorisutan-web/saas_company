(function () {
  function initRoiTool(root) {
    if (!root) {
      return null;
    }

    if (root.__toolApi) {
      return root.__toolApi;
    }

    const STORAGE_KEY = "roi_h";
    const BENCHMARKS = {
      "Google Ads": 2,
      "Facebook / Instagram": 3,
      LinkedIn: 4,
      Email: 8,
      Autre: 3,
    };

    let canal = "Google Ads";
    let ref = null;
    let lastResult = null;
    let hist = readJson(STORAGE_KEY, []);
    let resizeTimer = 0;

    const $ = (name) => root.querySelector(`[data-el="${name}"]`);

    function readJson(key, fallback) {
      try {
        return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
      } catch (error) {
        return JSON.parse(JSON.stringify(fallback));
      }
    }

    function clone(value) {
      return JSON.parse(JSON.stringify(value));
    }

    function escapeHtml(value) {
      return String(value ?? "").replace(/[&<>"']/g, (char) => {
        const map = {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        };
        return map[char];
      });
    }

    function formatEuro(value) {
      return `${new Intl.NumberFormat("fr-FR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value)} €`;
    }

    function formatPercent(value) {
      return `${new Intl.NumberFormat("fr-FR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(value)} %`;
    }

    function formatMultiple(value) {
      return `x ${value.toFixed(2)}`;
    }

    function formatDate() {
      return new Date().toLocaleDateString("fr-FR");
    }

    function scheduleHeight() {
      window.sharedLayout?.scheduleParentHeightSync();
    }

    function setupCanvas(canvas, width, height) {
      const dpr = window.devicePixelRatio || 1;
      const context = canvas.getContext("2d");

      canvas.width = Math.max(Math.floor(width * dpr), 1);
      canvas.height = Math.max(Math.floor(height * dpr), 1);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);

      return context;
    }

    function setCanal(nextCanal) {
      canal = nextCanal;
      root.querySelectorAll("[data-canal]").forEach((button) => {
        button.classList.toggle("active", button.dataset.canal === nextCanal);
      });
      calc();
    }

    function setKpi(name, value, className = "") {
      const element = $(name);
      element.textContent = value;
      element.className = `kpi-value${className ? ` ${className}` : ""}`;
    }

    function setDelta(name, current, previous, lowerIsBetter) {
      const element = $(name);
      if (previous == null || current == null || previous === 0) {
        element.textContent = "";
        element.className = "kpi-delta";
        return;
      }

      const delta = current - previous;
      const percentage = Math.abs((delta / previous) * 100);
      const better = lowerIsBetter ? delta < 0 : delta > 0;
      const className = delta === 0 ? "flat" : better ? "up" : "dn";
      const arrow = delta === 0 ? "-" : delta > 0 ? "↑" : "↓";

      element.textContent = `${arrow} ${percentage.toFixed(1)} %`;
      element.className = `kpi-delta ${className}`;
    }

    function calc() {
      const budget = Number.parseFloat($("budget").value);
      const revenus = Number.parseFloat($("revenus").value);
      const leads = Number.parseFloat($("leads").value);
      const clics = Number.parseFloat($("clics").value);

      if (Number.isNaN(budget) || Number.isNaN(revenus) || budget <= 0 || revenus <= 0) {
        ["r-roi", "r-roas", "r-cpl", "r-conv"].forEach((name) => setKpi(name, "-"));
        ["d-roi", "d-roas", "d-cpl", "d-conv"].forEach((name) => {
          $(name).textContent = "";
          $(name).className = "kpi-delta";
        });
        $("score-fill").style.width = "0%";
        $("score-num").textContent = "-";
        $("score-num").className = "score-num";
        $("analyse").className = "analyse";
        $("analyse").innerHTML = '<span class="analyse-icon">-</span><span>Renseignez votre budget et vos revenus.</span>';
        lastResult = null;
        renderCompare();
        renderChart(null);
        scheduleHeight();
        return;
      }

      const roi = ((revenus - budget) / budget) * 100;
      const roas = revenus / budget;
      const cpl = !Number.isNaN(leads) && leads > 0 ? budget / leads : null;
      const conv = !Number.isNaN(leads) && !Number.isNaN(clics) && clics > 0 ? (leads / clics) * 100 : null;

      lastResult = {
        canal,
        budget,
        revenus,
        leads: Number.isNaN(leads) ? null : leads,
        clics: Number.isNaN(clics) ? null : clics,
        roi,
        roas,
        cpl,
        conv,
        date: formatDate(),
      };

      const roiClass = roi < 0 ? "bad" : roi < 50 ? "warn" : "good";
      setKpi("r-roi", formatPercent(roi), roiClass);
      setKpi("r-roas", formatMultiple(roas), roas < 1 ? "bad" : roas < 2 ? "warn" : "good");
      setKpi("r-cpl", cpl !== null ? formatEuro(cpl) : "N/A");
      setKpi("r-conv", conv !== null ? formatPercent(conv) : "N/A");

      if (ref) {
        setDelta("d-roi", roi, ref.roi, false);
        setDelta("d-roas", roas, ref.roas, false);
        setDelta("d-cpl", cpl, ref.cpl, true);
        setDelta("d-conv", conv, ref.conv, false);
      } else {
        ["d-roi", "d-roas", "d-cpl", "d-conv"].forEach((name) => {
          $(name).textContent = "";
          $(name).className = "kpi-delta";
        });
      }

      let score = 0;
      if (roas >= 1) score += 20;
      if (roas >= 2) score += 20;
      if (roas >= 4) score += 20;
      if (roi >= 50) score += 20;
      if (roi >= 100) score += 20;

      const scoreClass = score < 40 ? "bad" : score < 70 ? "warn" : "good";
      $("score-num").textContent = `${score} / 100`;
      $("score-num").className = `score-num ${scoreClass}`;
      $("score-fill").style.width = `${score}%`;
      $("score-fill").style.background = score < 40 ? "#8b1c1c" : score < 70 ? "#b07d00" : "#1d6b3e";

      const benchmark = BENCHMARKS[canal] || 3;
      let icon;
      let message;

      if (roas < 1) {
        icon = "↓";
        message = `Campagne deficitaire. Minimum requis : <strong>${formatEuro(budget)}</strong> de revenus pour atteindre un ROAS de 1.`;
      } else if (roas < benchmark) {
        icon = "~";
        message = `ROAS ${formatMultiple(roas)} : en dessous du benchmark ${canal} (x ${benchmark}). Cible recommandee : <strong>${formatEuro(budget * benchmark)}</strong> de revenus.`;
      } else if (roi < 100) {
        icon = "✓";
        message = `Campagne rentable avec un ROI de ${formatPercent(roi)}. Benefice net actuel : <strong>${formatEuro(revenus - budget)}</strong>.`;
      } else {
        icon = "*";
        message = `Excellente performance avec un ROI de ${formatPercent(roi)}. A budget double, le potentiel de benefice pourrait atteindre <strong>${formatEuro((revenus - budget) * 2)}</strong>.`;
      }

      $("analyse").className = `analyse ${roiClass}`;
      $("analyse").innerHTML = `<span class="analyse-icon">${icon}</span><span>${message}</span>`;

      renderCompare();
      renderChart(lastResult);
      scheduleHeight();
    }

    function renderChart(result) {
      const canvas = $("chart-main");
      const width = canvas.parentElement.clientWidth || 680;
      const height = 170;
      const ctx = setupCanvas(canvas, width, height);

      if (!result) {
        return;
      }

      const bars = [
        { label: "Budget", value: result.budget, color: "#c5c2bb" },
        { label: "Revenus", value: result.revenus, color: result.roi >= 0 ? "#1d6b3e" : "#8b1c1c" },
        { label: "Benefice", value: Math.max(result.revenus - result.budget, 0), color: result.roi >= 50 ? "#2a9e60" : "#b07d00" },
      ];

      const maxValue = Math.max(...bars.map((bar) => bar.value), 1);
      const barWidth = 56;
      const gap = 48;
      const totalWidth = bars.length * barWidth + (bars.length - 1) * gap;
      const startX = (width - totalWidth) / 2;
      const chartHeight = height - 48;
      const topPadding = 16;

      bars.forEach((bar, index) => {
        const x = startX + index * (barWidth + gap);
        const barHeight = Math.max((bar.value / maxValue) * chartHeight, 2);
        const y = topPadding + chartHeight - barHeight;

        ctx.fillStyle = bar.color;
        ctx.fillRect(x, y, barWidth, barHeight);
        ctx.fillStyle = "#333333";
        ctx.font = '500 9px "IBM Plex Mono"';
        ctx.textAlign = "center";
        const valueLabel = bar.value >= 1000 ? `${(bar.value / 1000).toFixed(1)}k €` : `${bar.value.toFixed(0)} €`;
        ctx.fillText(valueLabel, x + barWidth / 2, y - 5);
        ctx.fillStyle = "#8e8a82";
        ctx.font = '400 9px "IBM Plex Sans"';
        ctx.fillText(bar.label, x + barWidth / 2, height - 8);
      });
    }

    function setRef() {
      if (!lastResult) {
        window.alert("Calculez d'abord une campagne.");
        return;
      }

      ref = clone(lastResult);
      renderCompare();
      calc();
    }

    function renderCompare() {
      const renderColumn = (payload, targetName, isRef) => {
        const target = $(targetName);
        if (!payload) {
          target.innerHTML = `<p class="muted-note">${isRef ? 'Cliquez sur "Definir".' : "Renseignez les parametres."}</p>`;
          return;
        }

        const rows = [
          { label: "Canal", value: payload.canal, raw: null },
          { label: "Budget", value: formatEuro(payload.budget), raw: payload.budget, previous: ref?.budget, lowerIsBetter: false },
          { label: "Revenus", value: formatEuro(payload.revenus), raw: payload.revenus, previous: ref?.revenus, lowerIsBetter: false },
          { label: "ROI", value: formatPercent(payload.roi), raw: payload.roi, previous: ref?.roi, lowerIsBetter: false },
          { label: "ROAS", value: formatMultiple(payload.roas), raw: payload.roas, previous: ref?.roas, lowerIsBetter: false },
          { label: "Cout / lead", value: payload.cpl != null ? formatEuro(payload.cpl) : "N/A", raw: payload.cpl, previous: ref?.cpl, lowerIsBetter: true },
        ];

        target.innerHTML = rows
          .map((row) => {
            let badge = "";

            if (!isRef && row.raw != null && row.previous != null) {
              const delta = row.raw - row.previous;
              const percentage = row.previous !== 0 ? Math.abs((delta / row.previous) * 100).toFixed(1) : "0.0";
              const better = row.lowerIsBetter ? delta < 0 : delta > 0;
              const className = delta === 0 ? "flat" : better ? "up" : "dn";
              const arrow = delta === 0 ? "-" : delta > 0 ? "↑" : "↓";
              badge = `<span class="badge ${className}">${arrow} ${percentage} %</span>`;
            }

            return `
              <div class="compare-row">
                <span class="compare-row-label">${escapeHtml(row.label)}</span>
                <span style="display:flex;align-items:center">
                  <span class="compare-row-val">${escapeHtml(row.value)}</span>
                  ${badge}
                </span>
              </div>
            `;
          })
          .join("");
      };

      renderColumn(ref, "ref-body", true);
      renderColumn(lastResult, "cur-body", false);
      scheduleHeight();
    }

    function saveHistory() {
      if (!lastResult) {
        window.alert("Aucun resultat a sauvegarder.");
        return;
      }

      hist.unshift({
        ...clone(lastResult),
        id: Date.now(),
      });

      if (hist.length > 20) {
        hist = hist.slice(0, 20);
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(hist));
      renderHist();
    }

    function renderHist() {
      const wrapper = $("hist-wrap");

      if (!hist.length) {
        wrapper.innerHTML = '<p class="hist-empty">Aucune campagne sauvegardee.</p>';
        scheduleHeight();
        return;
      }

      wrapper.innerHTML = `
        <div class="hist-list">
          ${hist
            .map(
              (entry) => `
                <div class="hist-item" data-clickable="true" data-id="${entry.id}">
                  <div class="hist-canal">${escapeHtml(entry.canal)}</div>
                  <div class="hist-kpis">
                    <div><div class="hist-kpi-label">Budget</div><div class="hist-kpi-val">${formatEuro(entry.budget)}</div></div>
                    <div><div class="hist-kpi-label">Revenus</div><div class="hist-kpi-val">${formatEuro(entry.revenus)}</div></div>
                    <div><div class="hist-kpi-label">ROI</div><div class="hist-kpi-val">${formatPercent(entry.roi)}</div></div>
                    <div><div class="hist-kpi-label">ROAS</div><div class="hist-kpi-val">${formatMultiple(entry.roas)}</div></div>
                  </div>
                  <div class="hist-date">${escapeHtml(entry.date)}</div>
                  <button class="hist-del" type="button" data-delete-id="${entry.id}" aria-label="Supprimer">x</button>
                </div>
              `
            )
            .join("")}
        </div>
      `;

      wrapper.querySelectorAll("[data-clickable='true']").forEach((item) => {
        item.addEventListener("click", () => {
          loadHist(Number.parseInt(item.dataset.id, 10));
        });
      });

      wrapper.querySelectorAll("[data-delete-id]").forEach((button) => {
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          delHist(Number.parseInt(button.dataset.deleteId, 10));
        });
      });

      scheduleHeight();
    }

    function loadHist(id) {
      const entry = hist.find((item) => item.id === id);
      if (!entry) {
        return;
      }

      $("budget").value = entry.budget;
      $("revenus").value = entry.revenus;
      $("leads").value = entry.leads ?? "";
      $("clics").value = entry.clics ?? "";
      setCanal(entry.canal);
    }

    function delHist(id) {
      hist = hist.filter((item) => item.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(hist));
      renderHist();
    }

    function clearHist() {
      if (!window.confirm("Vider l'historique ?")) {
        return;
      }

      hist = [];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(hist));
      renderHist();
    }

    function exportCSV() {
      if (!lastResult) {
        window.alert("Aucun resultat a exporter.");
        return;
      }

      window.sharedLayout.downloadCsv(
        [
          ["Parametre", "Valeur"],
          ["Canal", lastResult.canal],
          ["Date", lastResult.date],
          ["Budget (€)", lastResult.budget],
          ["Revenus (€)", lastResult.revenus],
          ["Leads", lastResult.leads ?? ""],
          ["Clics", lastResult.clics ?? ""],
          ["ROI (%)", lastResult.roi.toFixed(2)],
          ["ROAS", lastResult.roas.toFixed(2)],
          ["Cout / lead (€)", lastResult.cpl != null ? lastResult.cpl.toFixed(2) : ""],
          ["Taux conv. (%)", lastResult.conv != null ? lastResult.conv.toFixed(2) : ""],
        ],
        `roi_${Date.now()}.csv`
      );
    }

    function exportHistCSV() {
      if (!hist.length) {
        window.alert("Historique vide.");
        return;
      }

      const rows = [["Date", "Canal", "Budget", "Revenus", "ROI %", "ROAS", "Leads", "Cout / lead"]];
      hist.forEach((entry) => {
        rows.push([
          entry.date,
          entry.canal,
          entry.budget,
          entry.revenus,
          entry.roi.toFixed(2),
          entry.roas.toFixed(2),
          entry.leads ?? "",
          entry.cpl != null ? entry.cpl.toFixed(2) : "",
        ]);
      });

      window.sharedLayout.downloadCsv(rows, `roi_historique_${Date.now()}.csv`);
    }

    function resetForm() {
      ["budget", "revenus", "leads", "clics"].forEach((name) => {
        $(name).value = "";
      });
      setCanal("Google Ads");
    }

    function refresh() {
      if (!lastResult) {
        calc();
        return;
      }

      renderChart(lastResult);
      renderCompare();
      renderHist();
    }

    root.querySelectorAll("[data-canal]").forEach((button) => {
      button.addEventListener("click", () => {
        setCanal(button.dataset.canal);
      });
    });

    root.querySelectorAll("input").forEach((input) => {
      input.addEventListener("input", calc);
    });

    $("set-ref-btn").addEventListener("click", setRef);
    $("reset-btn").addEventListener("click", resetForm);
    $("save-btn").addEventListener("click", saveHistory);
    $("export-btn").addEventListener("click", exportCSV);
    $("print-btn").addEventListener("click", () => window.print());
    $("clear-hist-btn").addEventListener("click", clearHist);
    $("export-hist-btn").addEventListener("click", exportHistCSV);

    window.addEventListener("resize", () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => refresh(), 100);
    });

    renderHist();
    resetForm();

    root.__toolApi = { refresh };
    return root.__toolApi;
  }

  window.initRoiTool = initRoiTool;
})();
