(function () {
  function initPricingTool(root) {
    if (!root) {
      return null;
    }

    if (root.__toolApi) {
      return root.__toolApi;
    }

    const COLORS = ["#1a1a1a", "#2d5a8e", "#5a2d8e"];
    const STORAGE_KEY = "pf_h";
    const DEFAULTS = {
      total: 10000,
      growth: 5,
      churn: 3,
      plans: {
        a: { name: "Free", price: 0, conv: 70 },
        b: { name: "Pro", price: 29, conv: 22 },
        c: { name: "Enterprise", price: 99, conv: 8 },
      },
    };

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
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value)} €`;
    }

    function formatNumber(value) {
      return new Intl.NumberFormat("fr-FR").format(Math.round(value));
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

    function getPlans() {
      return ["a", "b", "c"].map((key) => ({
        key,
        name: $(`name-${key}`).value || key.toUpperCase(),
        price: Number.parseFloat($(`price-${key}`).value) || 0,
        conv: Number.parseFloat($(`conv-${key}`).value) || 0,
      }));
    }

    function calc() {
      const total = Number.parseFloat($("total").value) || 0;
      const growth = (Number.parseFloat($("growth").value) || 0) / 100;
      const churn = (Number.parseFloat($("churn").value) || 0) / 100;
      const plans = getPlans();
      const convSum = plans.reduce((sum, plan) => sum + plan.conv, 0) || 1;

      plans.forEach((plan) => {
        plan.users = Math.round(total * (plan.conv / convSum));
        plan.mrr = plan.users * plan.price;
        plan.arr = plan.mrr * 12;
      });

      const totalMrr = plans.reduce((sum, plan) => sum + plan.mrr, 0);
      const totalArr = totalMrr * 12;
      const paying = plans.filter((plan) => plan.price > 0).reduce((sum, plan) => sum + plan.users, 0);
      const arpu = paying > 0 ? totalMrr / paying : 0;

      plans.forEach((plan) => {
        $(`rn-${plan.key}`).textContent = plan.name;
        $(`ru-${plan.key}`).textContent = formatNumber(plan.users);
        $(`rm-${plan.key}`).textContent = formatEuro(plan.mrr);
        $(`ra-${plan.key}`).textContent = formatEuro(plan.arr);
      });

      $("t-mrr").textContent = formatEuro(totalMrr);
      $("t-arr").textContent = formatEuro(totalArr);
      $("t-pay").textContent = formatNumber(paying);
      $("t-arpu").textContent = formatEuro(arpu);

      lastResult = {
        plans: clone(plans),
        totalMrr,
        totalArr,
        paying,
        arpu,
        total,
        growth,
        churn,
        date: formatDate(),
      };

      renderBars(plans);
      renderLine(totalMrr, growth, churn);
      renderCompare();
      scheduleHeight();
    }

    function renderBars(plans) {
      const canvas = $("chart-bars");
      const width = canvas.parentElement.clientWidth || 760;
      const height = 160;
      const ctx = setupCanvas(canvas, width, height);
      const maxMrr = Math.max(...plans.map((plan) => plan.mrr), 1);
      const barWidth = 70;
      const gap = 60;
      const groupWidth = plans.length * barWidth + (plans.length - 1) * gap;
      const startX = (width - groupWidth) / 2;
      const chartHeight = height - 48;
      const topPadding = 16;

      plans.forEach((plan, index) => {
        const x = startX + index * (barWidth + gap);
        const barHeight = Math.max((plan.mrr / maxMrr) * chartHeight, 2);
        const y = topPadding + chartHeight - barHeight;

        ctx.fillStyle = COLORS[index];
        ctx.fillRect(x, y, barWidth, barHeight);
        ctx.fillStyle = "#333333";
        ctx.font = '500 9px "IBM Plex Mono"';
        ctx.textAlign = "center";
        ctx.fillText(formatEuro(plan.mrr), x + barWidth / 2, y - 5);
        ctx.fillStyle = "#8e8a82";
        ctx.font = '400 9px "IBM Plex Sans"';
        ctx.fillText(plan.name, x + barWidth / 2, height - 8);
      });
    }

    function renderLine(mrr, growth, churn) {
      const canvas = $("chart-line");
      const width = canvas.parentElement.clientWidth || 760;
      const height = 160;
      const ctx = setupCanvas(canvas, width, height);
      const netGrowth = growth - churn;
      const points = [];
      let value = mrr;

      for (let month = 0; month <= 12; month += 1) {
        points.push(value);
        value *= 1 + netGrowth;
      }

      const maxValue = Math.max(...points, 1);
      const padding = { left: 60, right: 20, top: 16, bottom: 30 };
      const chartWidth = width - padding.left - padding.right;
      const chartHeight = height - padding.top - padding.bottom;

      ctx.strokeStyle = "#ece7de";
      ctx.lineWidth = 1;
      [0, 0.25, 0.5, 0.75, 1].forEach((ratio) => {
        const y = padding.top + chartHeight * (1 - ratio);
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + chartWidth, y);
        ctx.stroke();
        ctx.fillStyle = "#8e8a82";
        ctx.font = '400 9px "IBM Plex Mono"';
        ctx.textAlign = "right";
        const labelValue = maxValue * ratio;
        ctx.fillText(labelValue >= 1000 ? `${(labelValue / 1000).toFixed(0)}k` : labelValue.toFixed(0), padding.left - 4, y + 3);
      });

      ctx.strokeStyle = "#1a1a1a";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      points.forEach((point, index) => {
        const x = padding.left + index * (chartWidth / 12);
        const y = padding.top + chartHeight * (1 - point / maxValue);
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();

      points.forEach((point, index) => {
        const x = padding.left + index * (chartWidth / 12);
        const y = padding.top + chartHeight * (1 - point / maxValue);
        ctx.fillStyle = "#1a1a1a";
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.fillStyle = "#8e8a82";
      ctx.font = '400 9px "IBM Plex Sans"';
      ctx.textAlign = "center";
      [0, 3, 6, 9, 12].forEach((month) => {
        const x = padding.left + month * (chartWidth / 12);
        ctx.fillText(`M${month}`, x, height - 8);
      });
    }

    function setRef() {
      if (!lastResult) {
        window.alert("Calculez d'abord un scenario.");
        return;
      }

      ref = clone(lastResult);
      renderCompare();
    }

    function renderCompare() {
      const renderColumn = (payload, targetName, isRef) => {
        const target = $(targetName);
        if (!payload) {
          target.innerHTML = `<p class="muted-note">${isRef ? 'Cliquez sur "Definir".' : "Renseignez les parametres."}</p>`;
          return;
        }

        const rows = [
          { label: "Utilisateurs", value: formatNumber(payload.total), raw: payload.total, previous: ref?.total, lowerIsBetter: false },
          { label: "MRR total", value: formatEuro(payload.totalMrr), raw: payload.totalMrr, previous: ref?.totalMrr, lowerIsBetter: false },
          { label: "ARR total", value: formatEuro(payload.totalArr), raw: payload.totalArr, previous: ref?.totalArr, lowerIsBetter: false },
          { label: "Payants", value: formatNumber(payload.paying), raw: payload.paying, previous: ref?.paying, lowerIsBetter: false },
          { label: "ARPU", value: formatEuro(payload.arpu), raw: payload.arpu, previous: ref?.arpu, lowerIsBetter: false },
        ];

        target.innerHTML = rows
          .map((row) => {
            let badge = "";

            if (!isRef && row.previous != null) {
              const delta = row.raw - row.previous;
              const percentage = row.previous ? Math.abs((delta / row.previous) * 100).toFixed(1) : "0.0";
              const better = row.lowerIsBetter ? delta < 0 : delta > 0;
              const className = delta === 0 ? "flat" : better ? "up" : "dn";
              const arrow = delta === 0 ? "-" : delta > 0 ? "↑" : "↓";
              badge = `<span class="badge ${className}">${arrow} ${percentage} %</span>`;
            }

            return `
              <div class="crow">
                <span class="crow-label">${row.label}</span>
                <span style="display:flex;align-items:center">
                  <span class="crow-val">${row.value}</span>
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

    function saveHist() {
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
        wrapper.innerHTML = '<p class="hist-empty">Aucun scenario sauvegarde.</p>';
        scheduleHeight();
        return;
      }

      wrapper.innerHTML = `
        <div class="hist-list">
          ${hist
            .map(
              (entry) => `
                <div class="hist-item" data-clickable="true" data-id="${entry.id}">
                  <div class="hist-label">${escapeHtml(entry.date)}</div>
                  <div class="hist-kpis">
                    <div><div class="hist-kpi-label">Utilisateurs</div><div class="hist-kpi-val">${formatNumber(entry.total)}</div></div>
                    <div><div class="hist-kpi-label">MRR</div><div class="hist-kpi-val">${formatEuro(entry.totalMrr)}</div></div>
                    <div><div class="hist-kpi-label">ARR</div><div class="hist-kpi-val">${formatEuro(entry.totalArr)}</div></div>
                    <div><div class="hist-kpi-label">Payants</div><div class="hist-kpi-val">${formatNumber(entry.paying)}</div></div>
                  </div>
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

      $("total").value = entry.total;
      $("growth").value = (entry.growth * 100).toFixed(1);
      $("churn").value = (entry.churn * 100).toFixed(1);

      ["a", "b", "c"].forEach((key, index) => {
        if (!entry.plans[index]) {
          return;
        }

        $(`name-${key}`).value = entry.plans[index].name;
        $(`price-${key}`).value = entry.plans[index].price;
        $(`conv-${key}`).value = entry.plans[index].conv;
      });

      calc();
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

      const rows = [["Plan", "Prix/mois", "Conversion %", "Utilisateurs", "MRR", "ARR"]];
      lastResult.plans.forEach((plan) => {
        rows.push([plan.name, plan.price, plan.conv, Math.round(plan.users), Math.round(plan.mrr), Math.round(plan.arr)]);
      });
      rows.push(["TOTAL", "", "", lastResult.total, Math.round(lastResult.totalMrr), Math.round(lastResult.totalArr)]);

      window.sharedLayout.downloadCsv(rows, `pricing_${Date.now()}.csv`);
    }

    function exportHistCSV() {
      if (!hist.length) {
        window.alert("Historique vide.");
        return;
      }

      const rows = [["Date", "Utilisateurs", "MRR", "ARR", "Payants", "ARPU"]];
      hist.forEach((entry) => {
        rows.push([entry.date, entry.total, Math.round(entry.totalMrr), Math.round(entry.totalArr), entry.paying, Math.round(entry.arpu)]);
      });

      window.sharedLayout.downloadCsv(rows, `pricing_historique_${Date.now()}.csv`);
    }

    function resetForm() {
      $("total").value = DEFAULTS.total;
      $("growth").value = DEFAULTS.growth;
      $("churn").value = DEFAULTS.churn;

      ["a", "b", "c"].forEach((key) => {
        $(`name-${key}`).value = DEFAULTS.plans[key].name;
        $(`price-${key}`).value = DEFAULTS.plans[key].price;
        $(`conv-${key}`).value = DEFAULTS.plans[key].conv;
      });

      calc();
    }

    function refresh() {
      if (!lastResult) {
        calc();
        return;
      }

      renderBars(lastResult.plans);
      renderLine(lastResult.totalMrr, lastResult.growth, lastResult.churn);
      renderCompare();
      renderHist();
    }

    root.querySelectorAll("input").forEach((input) => {
      input.addEventListener("input", calc);
    });

    $("set-ref-btn").addEventListener("click", setRef);
    $("reset-btn").addEventListener("click", resetForm);
    $("save-btn").addEventListener("click", saveHist);
    $("export-btn").addEventListener("click", exportCSV);
    $("print-btn").addEventListener("click", () => window.print());
    $("clear-hist-btn").addEventListener("click", clearHist);
    $("export-hist-btn").addEventListener("click", exportHistCSV);

    window.addEventListener("resize", () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        refresh();
      }, 100);
    });

    renderHist();
    resetForm();

    root.__toolApi = { refresh };
    return root.__toolApi;
  }

  window.initPricingTool = initPricingTool;
})();
