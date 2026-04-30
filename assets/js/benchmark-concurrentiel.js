(function () {
  function initBenchmarkTool(root) {
    if (!root) {
      return null;
    }

    if (root.__toolApi) {
      return root.__toolApi;
    }

    const COLORS = ["#1a1a1a", "#2d5a8e", "#5a2d8e", "#8e2d5a", "#2d8e5a", "#8e6b2d"];
    const STORAGE_KEY = "bm_h";
    const DEFAULT_COMPS = [
      { id: 0, name: "Vous" },
      { id: 1, name: "Concurrent A" },
      { id: 2, name: "Concurrent B" },
    ];
    const DEFAULT_CRITS = [
      { id: 0, name: "Prix", w: 30 },
      { id: 1, name: "Qualite", w: 25 },
      { id: 2, name: "Service client", w: 20 },
      { id: 3, name: "Notoriete", w: 15 },
      { id: 4, name: "Innovation", w: 10 },
    ];

    let comps = clone(DEFAULT_COMPS);
    let crits = clone(DEFAULT_CRITS);
    let scores = {};
    let nextCid = 3;
    let nextKid = 5;
    let ref = null;
    let lastScores = null;
    let hist = readJson(STORAGE_KEY, []);
    let resizeTimer = 0;

    const $ = (name) => root.querySelector(`[data-el="${name}"]`);

    function clone(value) {
      return JSON.parse(JSON.stringify(value));
    }

    function readJson(key, fallback) {
      try {
        return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
      } catch (error) {
        return clone(fallback);
      }
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

    function formatDate() {
      return new Date().toLocaleDateString("fr-FR");
    }

    function getScore(criterionId, competitorId) {
      return (scores[criterionId] && scores[criterionId][competitorId]) || 0;
    }

    function setScore(criterionId, competitorId, value) {
      if (!scores[criterionId]) {
        scores[criterionId] = {};
      }

      scores[criterionId][competitorId] = value;
      renderMatrix();
      renderResults();
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

    function renderComps() {
      const row = $("comp-row");
      row.innerHTML = "";

      comps.forEach((comp, index) => {
        const wrapper = document.createElement("div");
        wrapper.className = "comp-tag";
        wrapper.innerHTML = `
          <div class="dot" style="background:${COLORS[index % COLORS.length]}"></div>
          <input type="text" value="${escapeHtml(comp.name)}" placeholder="Nom" />
          ${index > 0 ? '<button class="rm-btn" type="button" aria-label="Supprimer">x</button>' : ""}
        `;

        wrapper.querySelector("input").addEventListener("input", (event) => {
          comp.name = event.target.value;
          renderMatrix();
          renderResults();
        });

        const removeButton = wrapper.querySelector(".rm-btn");
        if (removeButton) {
          removeButton.addEventListener("click", () => {
            comps = comps.filter((item) => item.id !== comp.id);
            renderAll();
          });
        }

        row.appendChild(wrapper);
      });
    }

    function addComp() {
      if (comps.length >= 6) {
        return;
      }

      comps.push({
        id: nextCid++,
        name: `Concurrent ${String.fromCharCode(64 + comps.length)}`,
      });

      renderAll();
    }

    function renderCrits() {
      const list = $("crit-list");
      list.innerHTML = "";

      crits.forEach((criterion) => {
        const row = document.createElement("div");
        row.className = "crit-row";
        row.innerHTML = `
          <input class="crit-name" type="text" value="${escapeHtml(criterion.name)}" placeholder="Critere..." />
          <div class="w-wrap">
            <span class="w-label">Poids</span>
            <input class="w-input" type="number" min="0" max="100" value="${criterion.w}" />
            <span class="w-label">%</span>
          </div>
          <button class="rm-btn" type="button" title="Supprimer">x</button>
        `;

        row.querySelector(".crit-name").addEventListener("input", (event) => {
          criterion.name = event.target.value;
          renderMatrix();
          renderResults();
        });

        row.querySelector(".w-input").addEventListener("input", (event) => {
          criterion.w = Number.parseFloat(event.target.value) || 0;
          renderMatrix();
          renderResults();
        });

        row.querySelector(".rm-btn").addEventListener("click", () => {
          crits = crits.filter((item) => item.id !== criterion.id);
          renderAll();
        });

        list.appendChild(row);
      });
    }

    function addCrit() {
      crits.push({
        id: nextKid++,
        name: `Critere ${crits.length + 1}`,
        w: 10,
      });

      renderAll();
    }

    function renderMatrix() {
      const head = $("mthead");
      const body = $("mtbody");
      let headHtml = "<tr><th>Critere</th>";

      comps.forEach((comp, index) => {
        headHtml += `<th style="background:${COLORS[index % COLORS.length]}">${escapeHtml(comp.name)}</th>`;
      });

      head.innerHTML = `${headHtml}</tr>`;
      body.innerHTML = "";

      if (!crits.length) {
        body.innerHTML = `<tr><td class="empty-table" colspan="${comps.length + 1}">Ajoutez au moins un critere pour commencer l'evaluation.</td></tr>`;
        return;
      }

      crits.forEach((criterion) => {
        const tr = document.createElement("tr");
        let html = `<td>${escapeHtml(criterion.name)} <span style="font-size:10px;color:var(--ink-light)">(${criterion.w}%)</span></td>`;

        comps.forEach((comp) => {
          const current = getScore(criterion.id, comp.id);
          let stars = "";

          for (let value = 1; value <= 5; value += 1) {
            stars += `<span class="star ${value <= current ? "on" : ""}" data-k="${criterion.id}" data-c="${comp.id}" data-v="${value}">*</span>`;
          }

          html += `<td style="text-align:center"><div class="star-group">${stars}</div></td>`;
        });

        tr.innerHTML = html;
        tr.querySelectorAll(".star").forEach((star) => {
          star.addEventListener("click", () => {
            setScore(
              Number.parseInt(star.dataset.k, 10),
              Number.parseInt(star.dataset.c, 10),
              Number.parseInt(star.dataset.v, 10)
            );
          });
        });
        body.appendChild(tr);
      });
    }

    function computeScores() {
      const totalWeight = crits.reduce((sum, criterion) => sum + criterion.w, 0) || 1;

      return comps.map((comp, index) => {
        let weightedScore = 0;

        crits.forEach((criterion) => {
          weightedScore += getScore(criterion.id, comp.id) * (criterion.w / totalWeight);
        });

        return {
          comp,
          score: weightedScore * 20,
          color: COLORS[index % COLORS.length],
        };
      });
    }

    function renderResults() {
      const computed = computeScores();
      const sorted = [...computed].sort((a, b) => b.score - a.score);

      $("hbar-list").innerHTML = computed
        .map(
          (item) => `
            <div class="hbar-row">
              <div class="hbar-name" style="color:${item.color};font-weight:${item.comp.id === 0 ? 600 : 400}">
                ${escapeHtml(item.comp.name)}
              </div>
              <div class="hbar-track">
                <div class="hbar-fill" style="width:${Math.max(item.score, 0)}%;background:${item.color}"></div>
              </div>
              <div class="hbar-val">${Math.round(item.score)}</div>
            </div>
          `
        )
        .join("");

      renderRadar(computed);
      renderCritChart(computed);

      const insight = $("insight");
      const you = computed.find((item) => item.comp.id === 0);
      const best = sorted[0];

      if (!crits.length || !you || !best || computed.every((item) => item.score === 0)) {
        insight.textContent = "Evaluez vos concurrents pour visualiser votre positionnement.";
      } else {
        const rank = sorted.findIndex((item) => item.comp.id === 0) + 1;
        const gap = best.score - you.score;

        if (rank === 1) {
          insight.textContent = `Vous etes en tete avec ${Math.round(you.score)}/100. Identifiez les criteres ou l'ecart est le plus faible pour consolider votre avance.`;
        } else if (rank === 2) {
          insight.textContent = `Vous etes 2e avec ${Math.round(you.score)}/100, a ${Math.round(gap)} points de ${best.comp.name}. Analysez les criteres les plus ponderes ou vous etes en retrait.`;
        } else {
          insight.textContent = `Vous etes ${rank}e avec ${Math.round(you.score)}/100. L'ecart avec le leader (${best.comp.name}) est de ${Math.round(gap)} points. Priorisez vos criteres forts poids en dessous de 3 etoiles.`;
        }
      }

      lastScores = computed.map((item) => ({
        name: item.comp.name,
        score: item.score,
      }));

      renderCompare();
      scheduleHeight();
    }

    function renderRadar(computed) {
      const canvas = $("chart-radar");
      const size = Math.min(canvas.parentElement.clientWidth || 320, 320);
      const ctx = setupCanvas(canvas, size, size);

      if (!crits.length || size <= 0) {
        return;
      }

      const cx = size / 2;
      const cy = size / 2;
      const radius = size / 2 - 30;
      const angleFor = (index) => -Math.PI / 2 + (2 * Math.PI * index) / crits.length;

      for (let ring = 1; ring <= 5; ring += 1) {
        ctx.beginPath();
        crits.forEach((criterion, index) => {
          const angle = angleFor(index);
          const x = cx + (radius * ring * Math.cos(angle)) / 5;
          const y = cy + (radius * ring * Math.sin(angle)) / 5;
          if (index === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });
        ctx.closePath();
        ctx.strokeStyle = "#ece7de";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      crits.forEach((criterion, index) => {
        const angle = angleFor(index);
        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle);
        const labelX = cx + (radius + 14) * Math.cos(angle);
        const labelY = cy + (radius + 14) * Math.sin(angle);

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(x, y);
        ctx.strokeStyle = "#dfd9cf";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = "#8e8a82";
        ctx.font = '400 8px "IBM Plex Sans"';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const label = criterion.name.length > 10 ? `${criterion.name.slice(0, 10)}...` : criterion.name;
        ctx.fillText(label, labelX, labelY);
      });

      computed.forEach((item) => {
        ctx.beginPath();
        crits.forEach((criterion, index) => {
          const ratio = getScore(criterion.id, item.comp.id) / 5;
          const angle = angleFor(index);
          const x = cx + radius * ratio * Math.cos(angle);
          const y = cy + radius * ratio * Math.sin(angle);
          if (index === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });
        ctx.closePath();
        ctx.save();
        ctx.globalAlpha = 0.08;
        ctx.fillStyle = item.color;
        ctx.fill();
        ctx.restore();
        ctx.strokeStyle = item.color;
        ctx.lineWidth = 1.6;
        ctx.stroke();
      });
    }

    function renderCritChart(computed) {
      const canvas = $("chart-crit");
      const width = canvas.parentElement.clientWidth || 360;
      const height = 220;
      const ctx = setupCanvas(canvas, width, height);

      if (!crits.length || width <= 0) {
        return;
      }

      const padding = { left: 10, right: 10, top: 18, bottom: 34 };
      const chartWidth = width - padding.left - padding.right;
      const chartHeight = height - padding.top - padding.bottom;
      const groupWidth = chartWidth / crits.length;
      const barWidth = Math.min(14, groupWidth / Math.max(computed.length + 1, 2));

      crits.forEach((criterion, criterionIndex) => {
        const startX = padding.left + criterionIndex * groupWidth + groupWidth / 2 - (computed.length * barWidth) / 2;

        computed.forEach((item, itemIndex) => {
          const ratio = getScore(criterion.id, item.comp.id) / 5;
          const barHeight = Math.max(ratio * chartHeight, 2);
          const x = startX + itemIndex * barWidth;
          const y = padding.top + chartHeight - barHeight;

          ctx.fillStyle = item.color;
          ctx.fillRect(x, y, Math.max(barWidth - 2, 6), barHeight);
        });

        ctx.fillStyle = "#8e8a82";
        ctx.font = '400 8px "IBM Plex Sans"';
        ctx.textAlign = "center";
        const label = criterion.name.length > 9 ? `${criterion.name.slice(0, 9)}...` : criterion.name;
        ctx.fillText(label, padding.left + criterionIndex * groupWidth + groupWidth / 2, height - 10);
      });
    }

    function setRef() {
      if (!lastScores) {
        window.alert("Evaluez d'abord les concurrents.");
        return;
      }

      ref = {
        scores: clone(lastScores),
        date: formatDate(),
      };

      renderCompare();
    }

    function renderCompare() {
      const refBody = $("ref-body");
      const curBody = $("cur-body");

      const renderColumn = (payload, target, isRef) => {
        if (!payload) {
          target.innerHTML = `<p class="muted-note">${isRef ? 'Cliquez sur "Capturer".' : "Renseignez les notations."}</p>`;
          return;
        }

        const previousMap = {};
        if (!isRef && ref) {
          ref.scores.forEach((item) => {
            previousMap[item.name] = item.score;
          });
        }

        target.innerHTML = payload.scores
          .map((item) => {
            let badge = "";

            if (!isRef && previousMap[item.name] != null) {
              const delta = item.score - previousMap[item.name];
              const percentage = previousMap[item.name]
                ? Math.abs((delta / previousMap[item.name]) * 100).toFixed(1)
                : "0.0";
              const className = delta === 0 ? "flat" : delta > 0 ? "up" : "dn";
              const arrow = delta === 0 ? "-" : delta > 0 ? "↑" : "↓";
              badge = `<span class="badge ${className}">${arrow} ${percentage} %</span>`;
            }

            return `
              <div class="crow">
                <span class="crow-label">${escapeHtml(item.name)}</span>
                <span style="display:flex;align-items:center">
                  <span class="crow-val">${Math.round(item.score)} / 100</span>
                  ${badge}
                </span>
              </div>
            `;
          })
          .join("");
      };

      renderColumn(ref ? { scores: ref.scores } : null, refBody, true);
      renderColumn(lastScores ? { scores: lastScores } : null, curBody, false);
      scheduleHeight();
    }

    function saveHist() {
      if (!lastScores) {
        window.alert("Aucun resultat a sauvegarder.");
        return;
      }

      hist.unshift({
        id: Date.now(),
        date: formatDate(),
        scores: clone(lastScores),
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
        wrapper.innerHTML = '<p class="hist-empty">Aucun snapshot sauvegarde.</p>';
        scheduleHeight();
        return;
      }

      wrapper.innerHTML = `
        <div class="hist-list">
          ${hist
            .map(
              (snapshot) => `
                <div class="hist-item">
                  <div class="hist-date">${escapeHtml(snapshot.date)}</div>
                  <div class="hist-kpis">
                    ${snapshot.scores
                      .slice(0, 4)
                      .map(
                        (item) => `
                          <div>
                            <div class="hist-kpi-label">${escapeHtml(item.name)}</div>
                            <div class="hist-kpi-val">${Math.round(item.score)}</div>
                          </div>
                        `
                      )
                      .join("")}
                  </div>
                  <button class="hist-del" type="button" data-id="${snapshot.id}" aria-label="Supprimer">x</button>
                </div>
              `
            )
            .join("")}
        </div>
      `;

      wrapper.querySelectorAll(".hist-del").forEach((button) => {
        button.addEventListener("click", () => {
          delHist(Number.parseInt(button.dataset.id, 10));
        });
      });

      scheduleHeight();
    }

    function delHist(id) {
      hist = hist.filter((snapshot) => snapshot.id !== id);
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
      if (!lastScores) {
        window.alert("Aucun resultat a exporter.");
        return;
      }

      const rows = [["Concurrent", ...crits.map((criterion) => `${criterion.name} (${criterion.w}%)`), "Score global"]];
      comps.forEach((comp) => {
        rows.push([
          comp.name,
          ...crits.map((criterion) => getScore(criterion.id, comp.id)),
          Math.round(lastScores.find((item) => item.name === comp.name)?.score || 0),
        ]);
      });

      window.sharedLayout.downloadCsv(rows, `benchmark_${Date.now()}.csv`);
    }

    function exportHistCSV() {
      if (!hist.length) {
        window.alert("Historique vide.");
        return;
      }

      const header = ["Date", ...(hist[0].scores || []).map((item) => item.name)];
      const rows = [header];
      hist.forEach((snapshot) => {
        rows.push([
          snapshot.date,
          ...snapshot.scores.map((item) => Math.round(item.score)),
        ]);
      });

      window.sharedLayout.downloadCsv(rows, `benchmark_historique_${Date.now()}.csv`);
    }

    function renderAll() {
      renderComps();
      renderCrits();
      renderMatrix();
      renderResults();
      scheduleHeight();
    }

    function resetAll() {
      comps = clone(DEFAULT_COMPS);
      crits = clone(DEFAULT_CRITS);
      scores = {};
      nextCid = 3;
      nextKid = 5;
      ref = null;
      lastScores = null;
      renderAll();
      renderCompare();
    }

    function refresh() {
      renderResults();
      renderCompare();
      renderHist();
    }

    $("add-comp-btn").addEventListener("click", addComp);
    $("add-crit-btn").addEventListener("click", addCrit);
    $("set-ref-btn").addEventListener("click", setRef);
    $("reset-btn").addEventListener("click", resetAll);
    $("save-btn").addEventListener("click", saveHist);
    $("export-btn").addEventListener("click", exportCSV);
    $("print-btn").addEventListener("click", () => window.print());
    $("clear-hist-btn").addEventListener("click", clearHist);
    $("export-hist-btn").addEventListener("click", exportHistCSV);

    window.addEventListener("resize", () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => refresh(), 100);
    });

    renderAll();
    renderHist();

    root.__toolApi = { refresh };
    return root.__toolApi;
  }

  window.initBenchmarkTool = initBenchmarkTool;
})();
