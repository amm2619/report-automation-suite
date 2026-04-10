/* Sprint Velocity Tracker
 * A lightweight single-page app for tracking sprint velocity across
 * three projects in a software development program.
 */

const STORAGE_KEY = "svt.state.v1";

const DEFAULT_PROJECTS = [
  {
    id: "atlas",
    name: "Project Atlas",
    description: "Customer-facing web platform",
    sprints: [],
  },
  {
    id: "nova",
    name: "Project Nova",
    description: "Internal analytics & reporting",
    sprints: [],
  },
  {
    id: "orion",
    name: "Project Orion",
    description: "Mobile application",
    sprints: [],
  },
];

let state = loadState();
let activeProjectId = state.projects[0].id;
let editingSprintId = null;

// ---------- Persistence ----------

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { projects: clone(DEFAULT_PROJECTS) };
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.projects) || parsed.projects.length !== 3) {
      return { projects: clone(DEFAULT_PROJECTS) };
    }
    return parsed;
  } catch (e) {
    console.warn("Failed to load state, using defaults", e);
    return { projects: clone(DEFAULT_PROJECTS) };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ---------- Helpers ----------

function getProject(id) {
  return state.projects.find((p) => p.id === id);
}

function sortedSprints(project) {
  return [...project.sprints].sort(
    (a, b) => new Date(a.startDate) - new Date(b.startDate)
  );
}

function average(nums) {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function round(n, digits = 1) {
  const f = Math.pow(10, digits);
  return Math.round(n * f) / f;
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function computeStats(project) {
  const sprints = sortedSprints(project);
  const completedVals = sprints.map((s) => s.completed);
  const committedVals = sprints.map((s) => s.committed);
  const avgVelocity = average(completedVals);
  const recentVelocity = average(completedVals.slice(-3));
  const totalCommitted = committedVals.reduce((a, b) => a + b, 0);
  const totalCompleted = completedVals.reduce((a, b) => a + b, 0);
  const completionRate = totalCommitted > 0 ? (totalCompleted / totalCommitted) * 100 : 0;
  return {
    avgVelocity: round(avgVelocity),
    recentVelocity: round(recentVelocity),
    completionRate: round(completionRate, 0),
    sprintCount: sprints.length,
    totalCommitted,
    totalCompleted,
  };
}

function completionClass(pct) {
  if (pct >= 90) return "good";
  if (pct >= 70) return "warn";
  return "bad";
}

// ---------- Rendering ----------

function render() {
  renderProgramSummary();
  renderTabs();
  renderProjectPanel();
}

function renderProgramSummary() {
  const container = document.getElementById("summaryCards");
  container.innerHTML = "";

  const programCard = document.createElement("div");
  programCard.className = "summary-card";
  const totalSprints = state.projects.reduce((s, p) => s + p.sprints.length, 0);
  const totalCompleted = state.projects.reduce(
    (s, p) => s + p.sprints.reduce((x, sp) => x + sp.completed, 0),
    0
  );
  const programVelocity = state.projects
    .map((p) => computeStats(p).recentVelocity)
    .reduce((a, b) => a + b, 0);

  programCard.innerHTML = `
    <h4>Program Velocity</h4>
    <div class="value">${round(programVelocity)}</div>
    <div class="sub">Sum of last-3 velocities across ${state.projects.length} projects</div>
  `;
  container.appendChild(programCard);

  const sprintsCard = document.createElement("div");
  sprintsCard.className = "summary-card";
  sprintsCard.innerHTML = `
    <h4>Total Sprints</h4>
    <div class="value">${totalSprints}</div>
    <div class="sub">${totalCompleted} points delivered</div>
  `;
  container.appendChild(sprintsCard);

  state.projects.forEach((p) => {
    const stats = computeStats(p);
    const card = document.createElement("div");
    card.className = "summary-card";
    card.innerHTML = `
      <h4>${escapeHtml(p.name)}</h4>
      <div class="value">${stats.recentVelocity}</div>
      <div class="sub">Avg ${stats.avgVelocity} · ${stats.sprintCount} sprint${stats.sprintCount === 1 ? "" : "s"}</div>
    `;
    card.style.cursor = "pointer";
    card.addEventListener("click", () => {
      activeProjectId = p.id;
      render();
      document.getElementById("projectPanel").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    container.appendChild(card);
  });
}

function renderTabs() {
  const tabBar = document.getElementById("projectTabs");
  tabBar.innerHTML = "";
  state.projects.forEach((p) => {
    const btn = document.createElement("button");
    btn.className = "tab" + (p.id === activeProjectId ? " active" : "");
    btn.textContent = p.name;
    btn.setAttribute("role", "tab");
    btn.addEventListener("click", () => {
      activeProjectId = p.id;
      cancelEdit();
      render();
    });
    tabBar.appendChild(btn);
  });
}

function renderProjectPanel() {
  const project = getProject(activeProjectId);
  const stats = computeStats(project);

  document.getElementById("projectName").textContent = project.name;
  document.getElementById("projectMeta").textContent = project.description;

  document.getElementById("kpiAvg").textContent = stats.avgVelocity;
  document.getElementById("kpiRecent").textContent = stats.recentVelocity;
  document.getElementById("kpiCompletion").textContent = stats.completionRate + "%";
  document.getElementById("kpiCount").textContent = stats.sprintCount;

  renderChart(project);
  renderTable(project);
}

function renderChart(project) {
  const chart = document.getElementById("chart");
  chart.innerHTML = "";
  const sprints = sortedSprints(project);

  if (!sprints.length) {
    const empty = document.createElement("div");
    empty.className = "chart-empty";
    empty.textContent = "No sprint data yet. Add a sprint to see the velocity chart.";
    chart.appendChild(empty);
    return;
  }

  const maxVal = Math.max(
    ...sprints.map((s) => Math.max(s.committed, s.completed)),
    1
  );

  // Build rolling trend (3-sprint rolling avg of completed)
  const trend = sprints.map((_, i) => {
    const window = sprints.slice(Math.max(0, i - 2), i + 1);
    return average(window.map((s) => s.completed));
  });

  sprints.forEach((s, i) => {
    const group = document.createElement("div");
    group.className = "bar-group";

    const bars = document.createElement("div");
    bars.className = "bars";

    const committedBar = document.createElement("div");
    committedBar.className = "bar committed";
    committedBar.style.height = (s.committed / maxVal) * 90 + "%";
    committedBar.title = `Committed: ${s.committed}`;
    const cv = document.createElement("span");
    cv.className = "bar-value";
    cv.textContent = s.committed;
    committedBar.appendChild(cv);

    const completedBar = document.createElement("div");
    completedBar.className = "bar completed";
    completedBar.style.height = (s.completed / maxVal) * 90 + "%";
    completedBar.title = `Completed: ${s.completed}`;
    const cv2 = document.createElement("span");
    cv2.className = "bar-value";
    cv2.textContent = s.completed;
    completedBar.appendChild(cv2);

    bars.appendChild(committedBar);
    bars.appendChild(completedBar);

    const label = document.createElement("div");
    label.className = "bar-label";
    label.textContent = s.name;
    label.title = s.name;

    group.appendChild(bars);
    group.appendChild(label);
    chart.appendChild(group);
  });

  // Overlay trend line using an SVG positioned absolutely
  requestAnimationFrame(() => drawTrendLine(chart, sprints, trend, maxVal));
}

function drawTrendLine(chart, sprints, trend, maxVal) {
  const existing = chart.querySelector("svg.trend");
  if (existing) existing.remove();

  const rect = chart.getBoundingClientRect();
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "trend");
  svg.setAttribute("width", chart.scrollWidth);
  svg.setAttribute("height", rect.height);
  svg.style.position = "absolute";
  svg.style.top = "0";
  svg.style.left = "0";
  svg.style.pointerEvents = "none";

  const groups = chart.querySelectorAll(".bar-group");
  if (!groups.length) return;

  const points = [];
  groups.forEach((g, i) => {
    const gRect = g.getBoundingClientRect();
    const x = gRect.left - rect.left + gRect.width / 2;
    const barsTop = rect.height - 12;
    const y = barsTop - (trend[i] / maxVal) * (barsTop * 0.9);
    points.push([x, y]);
  });

  const pathD = points
    .map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`))
    .join(" ");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", pathD);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "#fbbf24");
  path.setAttribute("stroke-width", "2.5");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  svg.appendChild(path);

  points.forEach(([x, y]) => {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", x);
    circle.setAttribute("cy", y);
    circle.setAttribute("r", "3.5");
    circle.setAttribute("fill", "#fbbf24");
    svg.appendChild(circle);
  });

  chart.appendChild(svg);
}

function renderTable(project) {
  const tbody = document.getElementById("sprintTableBody");
  const empty = document.getElementById("emptyState");
  tbody.innerHTML = "";

  const sprints = sortedSprints(project);
  if (!sprints.length) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  sprints.forEach((s) => {
    const pct = s.committed > 0 ? Math.round((s.completed / s.committed) * 100) : 0;
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(s.name)}</td>
      <td>${formatDate(s.startDate)} – ${formatDate(s.endDate)}</td>
      <td>${s.committed}</td>
      <td>${s.completed}</td>
      <td class="completion ${completionClass(pct)}">${pct}%</td>
      <td>
        <div class="row-actions">
          <button class="btn ghost small" data-action="edit" data-id="${s.id}">Edit</button>
          <button class="btn ghost small" data-action="delete" data-id="${s.id}">Delete</button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });

  tbody.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = btn.getAttribute("data-id");
      const action = btn.getAttribute("data-action");
      if (action === "edit") startEdit(id);
      if (action === "delete") deleteSprint(id);
    });
  });
}

// ---------- CRUD ----------

function handleSubmit(e) {
  e.preventDefault();
  const project = getProject(activeProjectId);
  const sprint = {
    id: editingSprintId || cryptoId(),
    name: document.getElementById("sprintName").value.trim(),
    startDate: document.getElementById("startDate").value,
    endDate: document.getElementById("endDate").value,
    committed: parseInt(document.getElementById("committed").value, 10) || 0,
    completed: parseInt(document.getElementById("completed").value, 10) || 0,
  };

  if (new Date(sprint.endDate) < new Date(sprint.startDate)) {
    alert("End date must be on or after the start date.");
    return;
  }

  if (editingSprintId) {
    const idx = project.sprints.findIndex((s) => s.id === editingSprintId);
    if (idx >= 0) project.sprints[idx] = sprint;
  } else {
    project.sprints.push(sprint);
  }

  saveState();
  cancelEdit();
  render();
}

function startEdit(id) {
  const project = getProject(activeProjectId);
  const sprint = project.sprints.find((s) => s.id === id);
  if (!sprint) return;
  editingSprintId = id;

  document.getElementById("sprintId").value = sprint.id;
  document.getElementById("sprintName").value = sprint.name;
  document.getElementById("startDate").value = sprint.startDate;
  document.getElementById("endDate").value = sprint.endDate;
  document.getElementById("committed").value = sprint.committed;
  document.getElementById("completed").value = sprint.completed;

  document.getElementById("formTitle").textContent = "Edit Sprint";
  document.getElementById("submitBtn").textContent = "Save Changes";
  document.getElementById("cancelBtn").hidden = false;

  document.getElementById("formTitle").scrollIntoView({ behavior: "smooth", block: "center" });
}

function cancelEdit() {
  editingSprintId = null;
  document.getElementById("sprintForm").reset();
  document.getElementById("sprintId").value = "";
  document.getElementById("formTitle").textContent = "Add Sprint";
  document.getElementById("submitBtn").textContent = "Add Sprint";
  document.getElementById("cancelBtn").hidden = true;
}

function deleteSprint(id) {
  if (!confirm("Delete this sprint? This cannot be undone.")) return;
  const project = getProject(activeProjectId);
  project.sprints = project.sprints.filter((s) => s.id !== id);
  saveState();
  if (editingSprintId === id) cancelEdit();
  render();
}

function resetProject() {
  const project = getProject(activeProjectId);
  if (!confirm(`Remove all sprints from ${project.name}?`)) return;
  project.sprints = [];
  saveState();
  cancelEdit();
  render();
}

function cryptoId() {
  if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
  return "id-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

// ---------- Init ----------

document.getElementById("sprintForm").addEventListener("submit", handleSubmit);
document.getElementById("cancelBtn").addEventListener("click", cancelEdit);
document.getElementById("resetProjectBtn").addEventListener("click", resetProject);
window.addEventListener("resize", () => renderProjectPanel());

render();
