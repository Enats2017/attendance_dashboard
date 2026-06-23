/**
 * AttendanceView - Handles UI rendering and DOM updates
 */
class AttendanceView {
  constructor() {
    this.app = document.getElementById("app");
    this.app.addEventListener("click", (e) =>
      this._handleDeptAccordionClick(e),
    );
    this.app.addEventListener("mousemove", (e) =>
      this._handleDeptAccordionHover(e),
    );
    this.app.addEventListener("mouseleave", () => this._hideDeptAccTooltip());
    this.TABS = [
      { id: "feature", label: "Dashboard", icon: "ph-house" },
      { id: "all", label: "Attendance Logs", icon: "ph-list-dashes" },
      { id: "age", label: "Age Analysis", icon: "ph-user-circle" },
      { id: "company", label: "Company Stats", icon: "ph-buildings" },
      { id: "dept", label: "Department Stats", icon: "ph-briefcase" },
      { id: "gender", label: "Gender Split", icon: "ph-gender-intersex" },
      { id: "late", label: "Late/Early", icon: "ph-clock" },
      { id: "latein", label: "Late In", icon: "ph-clock-afternoon" },
      { id: "earlyout", label: "Early Out", icon: "ph-sign-out" },
      { id: "night", label: "Night Shift", icon: "ph-moon" },
      {
        id: "designation",
        label: "Designation Stats",
        icon: "ph-identification-badge",
      },
      { id: "shift", label: "Shift Stats", icon: "ph-clock-clockwise" },
      { id: "staff", label: "Staff", icon: "ph-identification-badge" },
      { id: "worker", label: "Workmen", icon: "ph-hard-hat" },
      { id: "special", label: "Critical Alerts", icon: "ph-warning-circle" },
      {
        id: "designation_order",
        label: "Designations Order",
        icon: "ph-sliders",
      },
    ];
    this._lastData = {};
    this._renderToken = 0;
  }

  render(state, model) {
    this._renderToken++;
    const myToken = this._renderToken;

    if (window.Charts && typeof Charts.destroyAll === "function") {
      Charts.destroyAll();
    }

    let stats = model.getSummaryStats();

    if (state.activeTab === "night") {
      stats = state.nightShiftStats || stats;
    }

    const { logs, emps, empMap } = model.getFilteredData();
    const filterOpts = model.getFilterOptions();

    this._staffWorkerStats = state.staffWorkerStats || {};

    this.app.innerHTML = `
			<div class="dashboard-layout">
				${this._renderSidebar(state.activeTab)}
				<div class="main-content">
					${this._renderTopbar(state)}
					<div class="content-body">
						${this._renderFilters(state.filters, filterOpts)}
						${this._renderSummaryCards(stats)}
						<div id="stat-card-drilldown" class="stat-drilldown-panel" style="display:none;"></div>
						<div class="tab-pane-container">
							${this._renderTabContent(state.activeTab, logs, emps, empMap, state.filters, state.data.counts, model)}
						</div>
					</div>
				</div>
			</div>
			<div id="drilldown-overlay" class="overlay hidden"></div>
		`;

    this._restoreFilterValues(state.filters);
    this._initChartRendering(
      state.activeTab,
      logs,
      emps,
      empMap,
      state.filters,
      state.data.counts,
      model,
      myToken,
    );
  }

  _handleDeptAccordionClick(e) {
    const seg = e.target.closest(".dept-acc-seg");
    if (seg) {
      e.stopPropagation();
      const data = this._currentDeptData;
      if (!data) {
        return;
      }
      const status = seg.dataset.status;
      const { dateFrom, dateTo } = data.model.state.filters;

      const row = seg.closest(".dept-acc-row");
      const header = row ? row.querySelector(".dept-acc-header") : null;
      const dept = header ? header.dataset.dept : null;
      const subRow = seg.closest(".dept-acc-sub-row");

      let scopedEmps;
      let title;

      if (subRow) {
        const designation = subRow.dataset.designation;
        scopedEmps = data.emps.filter(
          (emp) =>
            emp.dept === dept && (emp.designation || "Staff") === designation,
        );
        title = `Dept: ${dept} - ${designation} - ${status}`;
      } else {
        scopedEmps = data.emps.filter((emp) => emp.dept === dept);
        title = `Dept: ${dept} - ${status}`;
      }

      const dayLogs = this._buildEmployeeDayLogs(
        scopedEmps,
        data.logs,
        dateFrom,
        dateTo,
      );

      const filteredLogs = dayLogs.filter((l) =>
        this._matchesStatus(l, status),
      );

      this._renderDrillDown(filteredLogs, title, data.empMap);
      return;
    }

    const header = e.target.closest(".dept-acc-header");
    if (header) {
      const row = header.closest(".dept-acc-row");
      const expandEl = row ? row.querySelector(".dept-acc-expand") : null;
      if (!expandEl) {
        return;
      }
      const dept = header.dataset.dept;
      const data = this._currentDeptData;
      if (!data) {
        return;
      }
      this._toggleDeptAccordionEl(
        expandEl,
        dept,
        data.emps,
        data.logs,
        data.model,
      );
    }
  }

  _handleDeptAccordionHover(e) {
    const header = e.target.closest(".dept-acc-header");
    const subRow = e.target.closest(".dept-acc-sub-row");
    const target = header || subRow;

    if (!target) {
      this._hideDeptAccTooltip();
      return;
    }

    const stats = {
      present: target.dataset.present || 0,
      half: target.dataset.half || 0,
      weeklyOff: target.dataset.weeklyoff || 0,
      absent: target.dataset.absent || 0,
      total: target.dataset.total || 0,
    };
    const label = header ? header.dataset.dept : subRow.dataset.designation;

    this._showDeptAccTooltip(e, label, stats);
  }

  _showDeptAccTooltip(e, label, stats) {
    let tip = document.getElementById("dept-acc-tooltip");
    if (!tip) {
      tip = document.createElement("div");
      tip.id = "dept-acc-tooltip";
      tip.style.position = "fixed";
      tip.style.zIndex = "9999";
      tip.style.pointerEvents = "none";
      tip.style.background = "#0f172a";
      tip.style.color = "#fff";
      tip.style.borderRadius = "10px";
      tip.style.padding = "12px 16px";
      tip.style.fontFamily =
        "'Plus Jakarta Sans','Inter','Segoe UI',sans-serif";
      tip.style.fontSize = "12px";
      tip.style.boxShadow = "0 8px 24px rgba(0,0,0,0.25)";
      tip.style.minWidth = "160px";
      document.body.appendChild(tip);
    }

    tip.innerHTML = `
			<div style="font-weight:700;margin-bottom:8px;">
				${label}
			</div>
			<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
				<span style="width:8px;height:8px;border-radius:50%;background:#10b981;display:inline-block;"></span> Present: 
				<b style="margin-left:auto;">${stats.present}</b>
			</div>
			<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
				<span style="width:8px;height:8px;border-radius:50%;background:#f59e0b;display:inline-block;"></span> Half Present: 
				<b style="margin-left:auto;">${stats.half}</b>
			</div>
			<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
				<span style="width:8px;height:8px;border-radius:50%;background:#3b82f6;display:inline-block;"></span> Weekly Off: 
				<b style="margin-left:auto;">${stats.weeklyOff}</b>
			</div>
			<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
				<span style="width:8px;height:8px;border-radius:50%;background:#f43f5e;display:inline-block;"></span> Absent: 
				<b style="margin-left:auto;">${stats.absent}</b>
			</div>
			<div style="display:flex;align-items:center;gap:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.15);">
				<span style="width:8px;height:8px;border-radius:50%;background:#94a3b8;display:inline-block;"></span> Total: 
				<b style="margin-left:auto;">${stats.total}</b>
			</div>
		`;

    tip.style.display = "block";
    tip.style.left = e.clientX + 16 + "px";
    tip.style.top = e.clientY + 16 + "px";
  }

  _hideDeptAccTooltip() {
    const tip = document.getElementById("dept-acc-tooltip");
    if (tip) {
      tip.style.display = "none";
    }
  }

  _renderSidebar(activeTab) {
    return `
			<aside class="sidebar">
				<div class="sidebar-header">
					<div class="logo-box">
						<i class="ph-fill ph-buildings"></i>
					</div>
					<div class="logo-text">
						<span>HRMS</span>
						<small>Attendance</small>
					</div>
				</div>
				<nav class="sidebar-nav">
					${this.TABS.map(
            (tab) => `
						<button class="nav-item ${activeTab === tab.id ? "active" : ""}" data-tab="${tab.id}">
							<i class="ph ${tab.icon}"></i>
							<span>${tab.label}</span>
						</button>
					`,
          ).join("")}
					<button class="nav-item" onclick="window.open('/attendance-dashboard/login/#/dept-attendance', '_blank')">
						<i class="ph ph-table"></i>
						<span>Unit HC Report</span>
					</button>
				</nav>
				<div class="sidebar-footer">
					<button class="btn-logout-alt" onclick="doLogout()">
						<i class="ph ph-sign-out"></i>
						<span>Logout System</span>
					</button>
				</div>
			</aside>
		`;
  }

  _renderTopbar(state) {
    const user = window.HRMS_USER || {};
    const displayName = user.name || user.username || "Admin User";
    const initials = displayName
      .split(" ")
      .map((w) => w[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();

    return `
			<header class="topbar">
				<div class="topbar-left">
					<h1 class="page-title">${this.TABS.find((t) => t.id === state.activeTab).label}</h1>
					<span class="breadcrumb">Home / ${state.activeTab}</span>
				</div>
				<div class="topbar-right">
					<div class="sync-status">
						<i class="ph ph-clock"></i>
						<span>Sync: ${state.lastUpdated || "Never"}</span>
					</div>
					<div class="user-profile">
						<div class="user-info">
							<span class="user-name">${displayName}</span>
							<span class="user-role">${user.role}</span>
						</div>
						<div class="user-avatar">${initials}</div>
					</div>
				</div>
			</header>
		`;
  }

  _renderFilters(filters, opts) {
    const selectOpts = (arr) => {
      return (
        '<option value="All">All</option>' +
        arr.map((v) => `<option value="${v}">${v}</option>`).join("")
      );
    };

    return `
			<div class="filter-panel">
				<div class="filter-grid">
					<div class="filter-field">
						<label>Start Date</label>
						<input type="date" id="f-from" value="${filters.dateFrom}">
					</div>
					<div class="filter-field">
						<label>End Date</label>
						<input type="date" id="f-to" value="${filters.dateTo}">
					</div>
					<div class="filter-field">
						<label>Company</label>
						<select id="f-company">${selectOpts(opts.companies)}</select>
					</div>
					<div class="filter-field">
						<label>Department</label>
						<select id="f-dept">${selectOpts(opts.depts)}</select>
					</div>
					<div class="filter-field">
						<label>Shift</label>
						<select id="f-shift">${selectOpts(opts.shifts || [])}</select>
					</div>
				</div>
				<div class="filter-actions">
					<button class="btn btn-primary" id="btn-apply-filters">
						<i class="ph ph-funnel"></i> Apply
					</button>
					<button class="btn btn-ghost" id="btn-refresh-data">
						<i class="ph ph-arrows-clockwise"></i> Refresh
					</button>
					<button class="btn btn-ghost-danger" id="btn-reset-filters">
						<i class="ph ph-arrow-counter-clockwise"></i>
					</button>
				</div>
			</div>
		`;
  }

  _renderSummaryCards(stats) {
    const staffWorkerStats = this._staffWorkerStats || {};

    const cards = [
      {
        key: "present",
        label: "Present",
        val: stats.present,
        icon: "ph-check-circle",
        cls: "success",
      },
      {
        key: "absent",
        label: "Absent",
        val: stats.absent,
        icon: "ph-x-circle",
        cls: "danger",
      },
      {
        key: "resigned",
        label: "Resigned",
        val: stats.resigned || 0,
        icon: "ph-user-minus",
        cls: "danger",
      },
      {
        key: "newJoined",
        label: "New Join",
        val: stats.newJoined || 0,
        icon: "ph-user-plus",
        cls: "success",
      },
      {
        key: "singlePunch",
        label: "Single Punch",
        val: stats.singlePunch,
        icon: "ph-lightning",
        cls: "warning",
      },
      {
        key: "lateIn",
        label: "Late In",
        val: stats.lateIn,
        icon: "ph-clock-afternoon",
        cls: "info",
      },
      {
        key: "earlyOut",
        label: "Early Out",
        val: stats.earlyOut,
        icon: "ph-sign-out",
        cls: "accent",
      },
      {
        key: null,
        label: "Avg Hours",
        val: stats.avgHours + "h",
        icon: "ph-timer",
        cls: "",
      },
      {
        key: null,
        label: "Total Staff",
        val: stats.total,
        icon: "ph-users",
        cls: "",
      },
      {
        key: "staffList",
        label: "Staff",
        val: staffWorkerStats.staffTotal || 0,
        icon: "ph-identification-badge",
        cls: "info",
      },
      {
        key: "workerList",
        label: "Workmen",
        val: staffWorkerStats.workerTotal || 0,
        icon: "ph-hard-hat",
        cls: "warning",
      },
    ];

    return `
			<div class="summary-grid">
				${cards
          .map(
            (c) => `
					<div class="stat-card ${c.cls} ${c.key ? "stat-card-clickable" : ""}"
						${c.key ? `data-card-key="${c.key}"` : ""}>
						<div class="stat-icon"><i class="ph ${c.icon}"></i></div>
						<div class="stat-content">
							<span class="stat-label">${c.label}</span>
							<span class="stat-value">${c.val}</span>
							${c.key ? '<span class="stat-card-hint">↓ click to view</span>' : ""}
						</div>
					</div>
				`,
          )
          .join("")}
			</div>
		`;
  }

  _renderTabContent(tabId, logs, emps, empMap, filters, counts, model) {
    let content;
    const stats = model.getSummaryStats();
    switch (tabId) {
      case "feature":
        const featureCounts = { in: stats.filteredIn, out: stats.filteredOut };
        content = this._renderFeature(featureCounts);
        break;
      case "all":
        content = this._renderAll(logs, emps, empMap, filters);
        break;
      case "age":
        content = this._renderAgeWise(logs, emps, empMap, model);
        break;
      case "company":
        content = this._renderCompanyWise(logs, emps, empMap, model);
        break;
      case "dept":
        content = this._renderDeptWise(logs, emps, empMap, model);
        break;
      case "gender":
        content = this._renderGenderWise(logs, emps, empMap, model);
        break;
      case "late":
        content = this._renderLateEarly(logs, emps, empMap);
        break;
      case "latein":
        content = this._renderLateIn(logs, emps, empMap, model);
        break;
      case "earlyout":
        content = this._renderEarlyOut(logs, emps, empMap, model);
        break;
      case "night":
        const nightData = model.getNightShiftData();
        content = this._renderNightShift(
          nightData.logs,
          nightData.emps,
          nightData.empMap,
        );
        break;
      case "designation":
        content = this._renderDesignationWise(logs, emps, empMap, model);
        break;
      case "shift":
        content = this._renderShiftWise(logs, emps, empMap, model);
        break;
      case "staff":
        content = this._renderStaff(logs, emps, empMap, model);
        break;
      case "worker":
        content = this._renderWorker(logs, emps, empMap, model);
        break;
      case "special":
        content = this._renderSpecial(logs, emps, empMap, filters, model);
        break;
      case "designation_order":
        content = {
          html: `
						<div class="designation-order-container">
							<h2 class="section-title"><i class="ph-fill ph-sliders"></i> Designations Order Settings</h2>
							<div id="designation-order-content">
								<div style="display:flex; align-items:center; gap:12px; padding:32px; color:#64748b;">
									<div class="auth-spinner" style="width:24px; height:24px; border-width:2px; border-top-color:#6366f1;"></div>
									<span>Loading designations data...</span>
								</div>
							</div>
						</div>
					`,
        };
        break;
      default:
        content = { html: "<p>Tab not found</p>" };
    }

    this._lastTabContent = content;
    return typeof content === "object" ? content.html : content;
  }

  _initChartRendering(
    tabId,
    logs,
    emps,
    empMap,
    filters,
    counts,
    model,
    renderToken,
  ) {
    if (tabId === "designation_order") {
      this._initDesignationOrderTab(model);
      return;
    }

    const content = this._lastTabContent;

    if (content && typeof content.renderCharts === "function") {
      this._waitForLayout(renderToken, () => {
        console.log("Rendering Tab:", tabId);
        try {
          content.renderCharts();
        } catch (e) {
          console.error("Chart Error:", e);
        }
      });
    }
  }

  _waitForLayout(renderToken, callback, attempts = 0) {
    if (renderToken !== this._renderToken) {
      return;
    }

    const card = this.app.querySelector(".tab-pane-container .chart-card");

    if (!card) {
      requestAnimationFrame(callback);
      return;
    }

    const ready = card.offsetWidth > 0 && card.offsetHeight > 0;

    if (ready || attempts > 30) {
      requestAnimationFrame(() => requestAnimationFrame(callback));
      return;
    }

    setTimeout(() => {
      this._waitForLayout(renderToken, callback, attempts + 1);
    }, 30);
  }

  _restoreFilterValues(filters) {
    const fields = ["company", "dept", "shift"];
    fields.forEach((f) => {
      const el = document.getElementById("f-" + f);
      if (el) {
        el.value = filters[f];
      }
    });
  }

  bindSwitchTab(handler) {
    if (this._tabClickHandler) {
      this.app.removeEventListener("click", this._tabClickHandler);
    }
    this._tabClickHandler = (event) => {
      const navItem = event.target.closest(".nav-item");
      if (navItem && navItem.dataset.tab) {
        handler(navItem.dataset.tab);
      }
    };
    this.app.addEventListener("click", this._tabClickHandler);
  }

  bindApplyFilters(handler) {
    if (this._applyFilterHandler) {
      this.app.removeEventListener("click", this._applyFilterHandler);
    }
    this._applyFilterHandler = (event) => {
      if (event.target.closest("#btn-apply-filters")) {
        handler({
          dateFrom: document.getElementById("f-from").value,
          dateTo: document.getElementById("f-to").value,
          company: document.getElementById("f-company").value,
          dept: document.getElementById("f-dept").value,
          shift: document.getElementById("f-shift").value,
        });
      }
    };
    this.app.addEventListener("click", this._applyFilterHandler);
  }

  bindRefreshData(handler) {
    if (this._refreshHandler) {
      this.app.removeEventListener("click", this._refreshHandler);
    }
    this._refreshHandler = (event) => {
      if (event.target.closest("#btn-refresh-data")) {
        handler();
      }
    };
    this.app.addEventListener("click", this._refreshHandler);
  }

  bindResetFilters(handler) {
    if (this._resetHandler) {
      this.app.removeEventListener("click", this._resetHandler);
    }
    this._resetHandler = (event) => {
      if (event.target.closest("#btn-reset-filters")) {
        handler();
      }
    };
    this.app.addEventListener("click", this._resetHandler);
  }

  showOverlay(message) {
    const overlay = document.getElementById("auth-check-overlay");
    if (overlay) {
      overlay.style.display = "flex";
      overlay.classList.remove("hidden");
      overlay.querySelector("p").innerText = message;
    }
  }

  hideOverlay() {
    const overlay = document.getElementById("auth-check-overlay");
    if (overlay) {
      overlay.classList.add("hidden");
      setTimeout(() => {
        overlay.style.display = "none";
      }, 400);
    }
  }

  exportExcel(data, filename) {
    console.log("FINAL EXCEL DATA:", data);
    console.table(data);
    if (!window.XLSX) {
      return console.error("SheetJS not loaded");
    }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `${filename}.xlsx`);
  }

  closeDrillDown() {
    const d = document.getElementById("drilldown-table");
    if (d) {
      d.innerHTML = "";
    }
    const m = document.getElementById("main-table-wrap");
    if (m) {
      m.style.display = "";
    }
  }

  _countBy(arr, keyFn) {
    const out = {};
    arr.forEach((x) => {
      const k = keyFn(x);
      out[k] = (out[k] || 0) + 1;
    });
    return out;
  }

  _getDateRange(dateFrom, dateTo) {
    const dates = [];
    const [fy, fm, fd] = dateFrom.split("-").map(Number);
    const [ty, tm, td] = dateTo.split("-").map(Number);

    let cur = new Date(Date.UTC(fy, fm - 1, fd));
    const end = new Date(Date.UTC(ty, tm - 1, td));

    while (cur <= end) {
      dates.push(cur.toISOString().slice(0, 10));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return dates;
  }

  _buildEmployeeDayLogs(emps, logs, dateFrom, dateTo) {
    const logMap = {};
    logs.forEach((l) => {
      const key = l.empId + "_" + l.date;
      const existing = logMap[key];
      if (!existing || parseFloat(l.present) > parseFloat(existing.present)) {
        logMap[key] = l;
      }
    });

    const dates = this._getDateRange(dateFrom, dateTo);
    const result = [];

    emps.forEach((e) => {
      dates.forEach((date) => {
        const log = logMap[e.id + "_" + date];
        if (log) {
          result.push(log);
        } else {
          result.push({
            empId: e.id,
            date: date,
            inTime: null,
            outTime: null,
            status: "Absent",
            present: 0,
            weeklyOff: 0,
            holiday: 0,
            isOnLeave: 0,
            hoursWorked: 0,
            lateIn: false,
            earlyOut: false,
          });
        }
      });
    });

    return result;
  }

  _computeGroupedDayStats(emps, logs, dateFrom, dateTo, groupKeyFn) {
    const dayLogs = this._buildEmployeeDayLogs(emps, logs, dateFrom, dateTo);
    const empGroupMap = {};
    emps.forEach((e) => {
      empGroupMap[e.id] = groupKeyFn(e);
    });

    const groups = {};
    emps.forEach((e) => {
      const g = groupKeyFn(e);
      if (!groups[g]) {
        groups[g] = {
          total: 0,
          present: 0,
          halfPresent: 0,
          weeklyOff: 0,
          holiday: 0,
          leave: 0,
          absent: 0,
        };
      }
    });

    dayLogs.forEach((log) => {
      const g = empGroupMap[log.empId];
      if (g === undefined) {
        return;
      }
      groups[g].total++;

      const present = parseFloat(log.present);
      const hasIn =
        log.inTime && log.inTime !== "00:00" && log.inTime !== "00:00:00";
      const hasOut =
        log.outTime && log.outTime !== "00:00" && log.outTime !== "00:00:00";

      if (log.weeklyOff == 1 && present === 0 && !hasIn && !hasOut) {
        groups[g].weeklyOff++;
      } else if (present === 0.5) {
        groups[g].halfPresent++;
      } else if (present >= 1 || hasIn || hasOut) {
        groups[g].present++;
      } else {
        groups[g].absent++;
      }
    });

    return groups;
  }

  _chartCard(id, icon, iconClass, title, hint) {
    return `
			<div class="chart-card">
				<div class="chart-card-header">
					<div class="chart-card-title">
						<div class="chart-card-icon ${iconClass || "violet"}">${icon}</div>
						<h3>${title}</h3>
					</div>
					${hint ? `<span class="chart-card-drill">🖱 ${hint}</span>` : ""}
				</div>
				<div class="chart-body"><div id="${id}"></div></div>
			</div>
		`;
  }

  _tableHTML(id, headers, rows, exportName) {
    const ths =
      `<th class="sr-col">Sr No</th>` +
      headers.map((h) => `<th>${h}</th>`).join("");

    const trs = rows
      .map(
        (r, index) =>
          `<tr>
				<td class="sr-col">${index + 1}</td>
				${r.map((c) => `<td>${c}</td>`).join("")}
			</tr>`,
      )
      .join("");

    return `
				<div id="main-table-wrap">
					<div class="table-wrap">
						<div class="table-header">
							<h3>📄 Detail Records</h3>
							<div class="table-actions">
								<button class="btn-tbl btn-tbl-excel"
									onclick="AppController.view.exportExcel(AppController.view._lastData['${exportName}'], '${exportName}')">
									↓ Excel
								</button>
								<button class="btn-tbl btn-tbl-pdf"
									onclick="AppController.view.exportPDF('${id}', '${exportName}')">
									↓ PDF
								</button>
							</div>
						</div>
						<div style="overflow-x:auto">
							<table class="data-table" id="${id}">
								<thead><tr>${ths}</tr></thead>
								<tbody>${trs}</tbody>
							</table>
						</div>
					</div>
				</div>
			`;
  }

  _renderFeature(counts) {
    return {
      html: `
				<h2 class="section-title"><i class="ph-fill ph-chart-bar"></i> Employee Entry/Exit Overview</h2>
				<div class="summary-cards" style="margin-bottom:24px; display:flex; gap:16px;">
					<div class="stat-card info" style="flex:1">
						<div class="stat-icon"><i class="ph ph-sign-in"></i></div>
						<div class="stat-content">
							<span class="stat-label">Total In Punches</span>
							<span class="stat-value">${counts.in || 0}</span>
						</div>
					</div>
					<div class="stat-card accent" style="flex:1">
						<div class="stat-icon"><i class="ph ph-sign-out"></i></div>
						<div class="stat-content">
							<span class="stat-label">Total Out Punches</span>
							<span class="stat-value">${counts.out || 0}</span>
						</div>
					</div>
				</div>
				<div class="charts-grid">
					${this._chartCard("ch-feat-io", '<i class="ph-fill ph-chart-pie-slice"></i>', "sky", "In vs Out Distribution")}
				</div>
			`,

      // ← This was missing entirely
      renderCharts: () => {
        Charts.donut(
          "ch-feat-io",
          ["In Punches", "Out Punches"],
          [counts.in || 0, counts.out || 0],
          "In vs Out",
        );
      },
    };
  }

  _renderAll(logs, emps, empMap, filters, page = 1) {
    this._currentAllLogs = logs;
    this._currentAllEmpMap = empMap;

    const pageSize = 25;
    const currentPage = page;
    const totalPages = Math.ceil(logs.length / pageSize);
    const pageLogs = logs.slice(
      (currentPage - 1) * pageSize,
      currentPage * pageSize,
    );

    const rows = pageLogs.map((l) => {
      const e = empMap[l.empId] || {};
      return [
        e.code || "",
        e.name || "",
        e.dept || "",
        e.company || "",
        l.date,
        l.inTime || "-",
        l.outTime || "-",
        l.hoursWorked || 0,
        l.lateIn ? '<span class="badge badge-warning">Yes</span>' : "No",
        l.earlyOut ? '<span class="badge badge-warning">Yes</span>' : "No",
        `<span class="badge ${l.status === "Present" ? "badge-success" : "badge-danger"}">${l.status}</span>`,
      ];
    });

    this._lastData["all-attendance"] = logs.map((l) => {
      const e = empMap[l.empId] || {};
      return {
        Code: e.code,
        Name: e.name,
        Dept: e.dept,
        Company: e.company,
        Date: l.date,
        In: l.inTime,
        Out: l.outTime,
        Hours: l.hoursWorked,
        LateIn: l.lateIn,
        EarlyOut: l.earlyOut,
        Status: l.status,
      };
    });

    const byDate = this._countBy(logs, (l) => l.date);
    const dates = Object.keys(byDate).sort();
    const counts = dates.map((d) => byDate[d]);
    const byDept = this._countBy(
      logs,
      (l) => (empMap[l.empId] || {}).dept || "Unknown",
    );

    let pageButtons = "";
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    for (let i = startPage; i <= endPage; i++) {
      pageButtons += `
				<button class="btn-page ${i === currentPage ? "btn-page-active" : ""}"
					onclick="AppController.view._reRenderAllPage(${i})"
				>
					${i}
				</button>
			`;
    }

    return {
      html: `
	            <h2 class="section-title"><i class="ph-fill ph-stack"></i> All Attendance Records</h2>
	            <div class="charts-grid">
	                ${this._chartCard("ch-all-trend", '<i class="ph ph-trend-up"></i>', "violet", "Daily Attendance Trend", "Click for detail")}
	                ${this._chartCard("ch-all-dept", '<i class="ph ph-briefcase"></i>', "teal", "By Department (Punches)", "Click for detail")}
	            </div>
	            ${this._tableHTML("tbl-all", ["Code", "Name", "Dept", "Company", "Date", "In", "Out", "Hours", "Late In", "Early Out", "Status"], rows, "all-attendance")}
	            <div class="pagination-bar">
	                <div class="pagination-text">
	                    Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, logs.length)} of ${logs.length} records &nbsp;·&nbsp; Page ${currentPage} of ${totalPages}
	                </div>
	                <div class="pagination-buttons">
	                    <button class="btn-page" ${currentPage === 1 ? "disabled" : ""} onclick="AppController.view._reRenderAllPage(1)">«</button>
	                    <button class="btn-page" ${currentPage === 1 ? "disabled" : ""} onclick="AppController.view._reRenderAllPage(${currentPage - 1})">‹</button>
	                    ${pageButtons}
	                    <button class="btn-page" ${currentPage === totalPages ? "disabled" : ""} onclick="AppController.view._reRenderAllPage(${currentPage + 1})">›</button>
	                    <button class="btn-page" ${currentPage === totalPages ? "disabled" : ""} onclick="AppController.view._reRenderAllPage(${totalPages})">»</button>
	                </div>
	            </div>
	            <div id="drilldown-table" style="margin-top:16px"></div>
			`,

      renderCharts: () => {
        Charts.line(
          "ch-all-trend",
          dates,
          [{ name: "Total Punches", data: counts }],
          "Daily Attendance",
          (date) =>
            this._renderDrillDown(
              logs.filter((l) => l.date === date),
              `Date: ${date}`,
              empMap,
            ),
        );
        Charts.donut(
          "ch-all-dept",
          Object.keys(byDept),
          Object.values(byDept),
          "Dept Distribution",
          (dept) =>
            this._renderDrillDown(
              logs.filter((l) => (empMap[l.empId] || {}).dept === dept),
              `Department: ${dept}`,
              empMap,
            ),
        );
      },
    };
  }

  _reRenderAllPage(page) {
    const content = this._renderAll(
      this._currentAllLogs,
      null,
      this._currentAllEmpMap,
      null,
      page,
    );
    document.querySelector(".tab-pane-container").innerHTML = content.html;
    content.renderCharts();
  }

  _renderDrillDown(logs, title, empMap, page = 1) {
    this._currentDrillLogs = logs;
    this._currentDrillTitle = title;
    this._currentDrillEmpMap = empMap;

    const container = document.getElementById("drilldown-table");
    if (!container) {
      return;
    }

    const mainWrap = document.getElementById("main-table-wrap");
    if (mainWrap) {
      mainWrap.style.display = "none";
    }

    if (!logs || logs.length === 0) {
      container.innerHTML = `
				<div class="drilldown-box">
					<div class="drilldown-header">
						<span class="drilldown-title">🔍 ${title}</span>
						<div class="drilldown-btn-group">
							<button class="btn-drill btn-drill-back" onclick="AppController.view.closeDrillDown()">
								← Back
							</button>
						</div>
					</div>
					<p style="padding:32px; color:#6b7280;">No records found.</p>
				</div>
			`;
      return;
    }

    const pageSize = 25;
    const currentPage = page;
    const totalPages = Math.ceil(logs.length / pageSize);
    const pageLogs = logs.slice(
      (currentPage - 1) * pageSize,
      currentPage * pageSize,
    );

    const rows = pageLogs
      .map((l, index) => {
        const e = empMap[l.empId] || {};
        return `
					<tr>
						<td>${(currentPage - 1) * pageSize + index + 1}</td>
						<td><b>${e.code || "–"}</b></td>
						<td>${e.name || "–"}</td>
						<td>${e.dept || "–"}</td>
						<td>${e.company || "–"}</td>
						<td>${e.shift || "–"}</td>
						<td>${l.shiftStart || "–"}</td>
						<td>${l.shiftEnd || "–"}</td>
						<td>${l.date}</td>
						<td>${l.inTime || "–"}</td>
						<td>${l.outTime || "–"}</td>
						<td><b>${l.hoursWorked || 0}h</b></td>
						<td>${(l.lateBy || 0) > 0 ? "Yes" : "No"}</td>
						<td>${(l.lateBy || 0) > 0 ? this._fmtMins(l.lateBy) : "-"}</td>
						<td>${(l.earlyBy || 0) > 0 ? "Yes" : "No"}</td>
						<td>${(l.earlyBy || 0) > 0 ? this._fmtMins(l.earlyBy) : "-"}</td>
						<td>${l.status}</td>
					</tr>`;
      })
      .join("");

    this._drillData = logs.map((l) => {
      const e = empMap[l.empId] || {};
      return {
        Code: e.code,
        Name: e.name,
        Dept: e.dept,
        Company: e.company,
        Shift: e.shift,
        ShiftStart: l.shiftStart || "",
        ShiftEnd: l.shiftEnd || "",
        Date: l.date,
        In: l.inTime,
        Out: l.outTime,
        Hours: l.hoursWorked,
        Late: (l.lateBy || 0) > 0 ? "Yes" : "No",
        Early: (l.earlyBy || 0) > 0 ? "Yes" : "No",
        Status: l.status,
      };
    });

    let pageButtons = "";
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    for (let i = startPage; i <= endPage; i++) {
      pageButtons += `
				<button class="btn-page ${i === currentPage ? "btn-page-active" : ""}"
					onclick="AppController.view._renderDrillDown(
						AppController.view._currentDrillLogs,
						AppController.view._currentDrillTitle,
						AppController.view._currentDrillEmpMap,
						${i})">
					${i}
				</button>
			`;
    }

    container.innerHTML = `
	        <div class="drilldown-box">

	            <div class="drilldown-header">
	                <div class="drilldown-title">
	                    🔍 ${title}
	                    <small>${logs.length} records</small>
	                </div>
	                <div class="drilldown-btn-group">
	                    <button class="btn-drill btn-drill-excel"
	                        onclick="AppController.view.exportExcel(AppController.view._drillData, 'drilldown')">
	                        ↓ Excel
	                    </button>
	                    <button class="btn-drill btn-drill-back"
	                        onclick="AppController.view.closeDrillDown()">
	                        ← Back
	                    </button>
	                </div>
	            </div>

	            <div style="overflow-x:auto;">
	                <table class="data-table">
	                    <thead>
	                        <tr>
	                            <th>Sr.No</th>
								<th>Code</th>
								<th>Name</th>
								<th>Dept</th>
	                            <th>Company</th>
								<th>Shift</th>
								<th>Shift Start</th>
								<th>Shift End</th>
								<th>Date</th>
								<th>In</th>
	                            <th>Out</th>
								<th>Hours</th>
								<th>Late</th>
								<th>Late By</th>
								<th>Early</th>
								<th>Early By</th>
								<th>Status</th>
	                        </tr>
	                    </thead>
	                    <tbody>${rows}</tbody>
	                </table>
	            </div>

	            <div class="pagination-bar">
	                <div class="pagination-text">
	                    Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, logs.length)} of ${logs.length} records &nbsp;·&nbsp; Page ${currentPage} of ${totalPages}
	                </div>
	                <div class="pagination-buttons">
	                    <button class="btn-page" ${currentPage === 1 ? "disabled" : ""}
	                        onclick="AppController.view._renderDrillDown(AppController.view._currentDrillLogs,AppController.view._currentDrillTitle,AppController.view._currentDrillEmpMap,1)">
	                        «
	                    </button>
	                    <button class="btn-page" ${currentPage === 1 ? "disabled" : ""}
	                        onclick="AppController.view._renderDrillDown(AppController.view._currentDrillLogs,AppController.view._currentDrillTitle,AppController.view._currentDrillEmpMap,${currentPage - 1})">
	                        ‹
	                    </button>
	                    ${pageButtons}
	                    <button class="btn-page" ${currentPage === totalPages ? "disabled" : ""}
	                        onclick="AppController.view._renderDrillDown(AppController.view._currentDrillLogs,AppController.view._currentDrillTitle,AppController.view._currentDrillEmpMap,${currentPage + 1})">
	                        ›
	                    </button>
	                    <button class="btn-page" ${currentPage === totalPages ? "disabled" : ""}
	                        onclick="AppController.view._renderDrillDown(AppController.view._currentDrillLogs,AppController.view._currentDrillTitle,AppController.view._currentDrillEmpMap,${totalPages})">
	                        »
	                    </button>
	                </div>
	            </div>

	        </div>
		`;

    container.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  _escapeAttr(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  _computeNiceAxis(maxValue, tickCount = 4) {
    if (maxValue <= 0) {
      return { ticks: [0, 1], niceMax: 1 };
    }

    const rawStep = maxValue / tickCount;
    const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const norm = rawStep / mag;

    let niceNorm;
    if (norm <= 1) {
      niceNorm = 1;
    } else if (norm <= 2) {
      niceNorm = 2;
    } else if (norm <= 5) {
      niceNorm = 5;
    } else {
      niceNorm = 10;
    }

    const step = niceNorm * mag;
    const niceMax = Math.ceil(maxValue / step) * step;

    const ticks = [];
    for (let v = 0; v <= niceMax + 1e-9; v += step) {
      ticks.push(Math.round(v));
    }

    return { ticks, niceMax: niceMax || 1 };
  }

  _renderDeptAccordionChart(depts, rows) {
    const maxTotal = Math.max(1, ...rows.map((r) => r[1]));
    const { ticks, niceMax } = this._computeNiceAxis(maxTotal);
    const tickPercents = [0, 25, 50, 75, 100];
    const tickValues = tickPercents.map((p) => Math.round((p / 100) * niceMax));

    const rowsHtml = depts
      .map((d, i) => {
        const r = rows[i];
        const total = r[1] || 1;
        const present = r[2],
          half = r[3],
          wo = r[4],
          absent = r[5];
        const scale = (r[1] / niceMax) * 100;
        const pPct = (present / total) * 100;
        const hPct = (half / total) * 100;
        const wPct = (wo / total) * 100;
        const aPct = (absent / total) * 100;

        return `
				<div class="dept-acc-row">
					<div class="dept-acc-header" data-dept="${this._escapeAttr(d)}" data-present="${present}" data-half="${half}" data-weeklyoff="${wo}" data-absent="${absent}" data-total="${total}">
						<div class="dept-acc-label">${d}</div>
						<div class="dept-acc-track">
							${ticks.map((t) => `<div class="dept-acc-gridline" style="left:${(t / niceMax) * 100}%"></div>`).join("")}
							<div class="dept-acc-bar-wrap" style="width:${scale.toFixed(2)}%">
								<div class="dept-acc-bar">
									${present > 0 ? `<div class="dept-acc-seg present" data-status="Present" style="width:${pPct}%">${present}</div>` : ""}
									${half > 0 ? `<div class="dept-acc-seg half" data-status="Half Present" style="width:${hPct}%">${half}</div>` : ""}
									${wo > 0 ? `<div class="dept-acc-seg weeklyoff" data-status="Weekly Off" style="width:${wPct}%">${wo}</div>` : ""}
									${absent > 0 ? `<div class="dept-acc-seg absent" data-status="Absent" style="width:${aPct}%">${absent}</div>` : ""}
								</div>
							</div>
						</div>
						<i class="ph ph-caret-down dept-acc-caret"></i>
					</div>
					<div class="dept-acc-expand" id="dept-acc-expand-${i}" style="display:none;"></div>
				</div>
				`;
      })
      .join("");

    return `
			<div class="dept-accordion">
				<style>
					.dept-accordion { width:100%; }
					.dept-acc-legend { display:flex; gap:16px; font-size:12px; font-weight:600; color:#64748b; margin-bottom:14px; }
					.dept-acc-legend .dot { width:9px; height:9px; border-radius:50%; display:inline-block; margin-right:5px; }
					.dept-acc-legend .dot.present { background:#10b981; }
					.dept-acc-legend .dot.half { background:#f59e0b; }
					.dept-acc-legend .dot.weeklyoff { background:#3b82f6; }
					.dept-acc-legend .dot.absent { background:#f43f5e; }
					.dept-acc-row { border-bottom: 1px solid #f1f5f9; }
					.dept-acc-header { display:flex; align-items:center; gap:12px; padding:10px 0; cursor:pointer; }
					.dept-acc-label { width:160px; flex-shrink:0; font-size:12px; font-weight:700; color:#475569; }
					.dept-acc-track { position:relative; flex:1; }
					.dept-acc-gridline { position:absolute; top:-4px; bottom:-4px; width:1px; background:rgba(99,102,241,0.10); }
					.dept-acc-bar-wrap { position:relative; z-index:1; max-width: 100%; }
					.dept-acc-bar { display:flex; height:30px; border-radius:6px; overflow:hidden; background:#f8fafc; }
					.dept-acc-bar.small { height:24px; }
					.dept-acc-seg { display:flex; align-items:center; justify-content:center; color:#fff; font-size:11px; font-weight:700; min-width: 18px; cursor:pointer; }
					.dept-acc-seg.present { background:#10b981; }
					.dept-acc-seg.half { background:#f59e0b; }
					.dept-acc-seg.weeklyoff { background:#3b82f6; }
					.dept-acc-seg.absent { background:#f43f5e; }
					.dept-acc-caret { color:#94a3b8; font-size:14px; flex-shrink:0; }
					.dept-acc-expand { padding: 6px 0 14px 172px; }
					.dept-acc-sub-title { font-size:12px; font-weight:700; color:#7c3aed; margin-bottom:10px; }
					.dept-acc-sub-row { display:flex; align-items:center; gap:12px; margin-bottom:8px; }
					.dept-acc-sub-label { width:140px; flex-shrink:0; font-size:11px; font-weight:600; color:#64748b; }
					.dept-acc-axis { display:flex; justify-content:space-between; font-size:10px; font-weight:700; color:#94a3b8; margin-left:172px; margin-top:6px; padding-top:8px; border-top:1px solid #f1f5f9; }
					.dept-acc-sub-axis { display:flex; justify-content:space-between; font-size:10px; font-weight:700; color:#94a3b8; margin-left:152px; margin-top:4px; }
					.dept-acc-legend span { cursor: pointer; }
					.dept-accordion.dimmed .dept-acc-seg { opacity: 0.15; }
					.dept-accordion.dimmed .dept-acc-seg.active-highlight { opacity: 1; }
				</style>
				<div class="dept-acc-legend">
					<span data-legend="present"><i class="dot present"></i>Present</span>
					<span data-legend="half"><i class="dot half"></i>Half Present</span>
					<span data-legend="weeklyoff"><i class="dot weeklyoff"></i>Weekly Off</span>
					<span data-legend="absent"><i class="dot absent"></i>Absent</span>
				</div>
				${rowsHtml}
				<div class="dept-acc-axis">
					${ticks.map((t) => `<span>${t}</span>`).join("")}
				</div>
			</div>
		`;
  }

  _toggleDeptAccordionEl(expandEl, dept, emps, logs, model) {
    if (expandEl.style.display !== "none" && expandEl.innerHTML !== "") {
      expandEl.style.display = "none";
      expandEl.innerHTML = "";
      return;
    }

    document.querySelectorAll(".dept-acc-expand").forEach((el) => {
      el.style.display = "none";
      el.innerHTML = "";
    });

    const deptEmps = emps.filter((e) => e.dept === dept);
    const { dateFrom, dateTo } = model.state.filters;
    const groups = this._computeGroupedDayStats(
      deptEmps,
      logs,
      dateFrom,
      dateTo,
      (e) => e.designation || "Staff",
    );
    const desigOrderMap = {};
    deptEmps.forEach((e) => {
      desigOrderMap[e.designation || "Staff"] = e.designationSortOrder || 0;
    });
    const desigs = Object.keys(groups).sort((a, b) => {
      const orderA = desigOrderMap[a] || 0;
      const orderB = desigOrderMap[b] || 0;
      if (orderA !== orderB) return orderA - orderB;
      return a.localeCompare(b);
    });
    const maxTotal = Math.max(1, ...desigs.map((d) => groups[d].total));
    const { ticks, niceMax } = this._computeNiceAxis(maxTotal);
    const tickPercents = [0, 25, 50, 75, 100];
    const tickValues = tickPercents.map((p) => Math.round((p / 100) * niceMax));

    const rowsHtml = desigs
      .map((d) => {
        const g = groups[d];
        const total = g.total || 1;
        const scale = (g.total / niceMax) * 100;
        const pPct = (g.present / total) * 100;
        const hPct = (g.halfPresent / total) * 100;
        const wPct = (g.weeklyOff / total) * 100;
        const aPct = (g.absent / total) * 100;
        return `
			<div class="dept-acc-sub-row" data-designation="${this._escapeAttr(d)}" data-present="${g.present}" data-half="${g.halfPresent}" data-weeklyoff="${g.weeklyOff}" data-absent="${g.absent}" data-total="${g.total}">
			<div class="dept-acc-sub-label">${d}</div>
			<div class="dept-acc-track">
				${ticks.map((t) => `<div class="dept-acc-gridline" style="left:${(t / niceMax) * 100}%"></div>`).join("")}
				<div class="dept-acc-bar-wrap" style="width:${scale.toFixed(2)}%">
				<div class="dept-acc-bar small">
					${g.present > 0 ? `<div class="dept-acc-seg present" data-status="Present" style="width:${pPct}%">${g.present}</div>` : ""}
					${g.halfPresent > 0 ? `<div class="dept-acc-seg half" data-status="Half Present" style="width:${hPct}%">${g.halfPresent}</div>` : ""}
					${g.weeklyOff > 0 ? `<div class="dept-acc-seg weeklyoff" data-status="Weekly Off" style="width:${wPct}%">${g.weeklyOff}</div>` : ""}
					${g.absent > 0 ? `<div class="dept-acc-seg absent" data-status="Absent" style="width:${aPct}%">${g.absent}</div>` : ""}
				</div>
				</div>
			</div>
			</div>`;
      })
      .join("");

    expandEl.innerHTML = `
			<div class="dept-acc-sub-title">🔍 ${dept} — Designation Breakdown</div>
			${rowsHtml}
			<div class="dept-acc-sub-axis">
				${ticks.map((t) => `<span>${t}</span>`).join("")}
			</div>
		`;
    expandEl.style.display = "block";
  }

  _renderAgeWise(logs, emps, empMap, model) {
    const groups = ["Under 25", "25–34", "35–44", "45–54", "55+"];

    const gTotal = {};
    const gPresent = {};
    const gHalfPresent = {};
    const gWeeklyOff = {};
    const gAbsent = {};

    groups.forEach((g) => {
      gTotal[g] = 0;
      gPresent[g] = 0;
      gHalfPresent[g] = 0;
      gWeeklyOff[g] = 0;
      gAbsent[g] = 0;
    });

    const isSingleDay =
      model.state.filters.dateFrom === model.state.filters.dateTo;

    emps.forEach((e) => {
      const g = model.getAgeGroup(e.dob);
      gTotal[g]++;
    });

    const { dateFrom, dateTo } = model.state.filters;
    const dayLogs = this._buildEmployeeDayLogs(emps, logs, dateFrom, dateTo);

    dayLogs.forEach((l) => {
      const e = empMap[l.empId];
      if (!e) return;
      const g = model.getAgeGroup(e.dob);

      const lPresent = parseFloat(l.present);
      const lHasIn =
        l.inTime && l.inTime !== "00:00" && l.inTime !== "00:00:00";
      const lHasOut =
        l.outTime && l.outTime !== "00:00" && l.outTime !== "00:00:00";

      if (l.weeklyOff == 1 && lPresent === 0 && !lHasIn && !lHasOut) {
        gWeeklyOff[g]++;
      } else if (lPresent === 0.5) {
        gHalfPresent[g]++;
      } else if (lPresent >= 1 || lHasIn || lHasOut) {
        gPresent[g]++;
      } else {
        gAbsent[g]++;
      }
    });

    const rows = groups.map((g) => {
      const attendancePercent = gTotal[g] ? (gPresent[g] / gTotal[g]) * 100 : 0;
      return [
        g,
        gTotal[g],
        gPresent[g],
        gHalfPresent[g],
        gWeeklyOff[g],
        gAbsent[g],
        attendancePercent.toFixed(2) + "%",
      ];
    });

    this._lastData["age-wise"] = rows.map((r) => ({
      AgeGroup: r[0],
      Total: r[1],
      Present: r[2],
      HalfPresent: r[3],
      WeeklyOff: r[4],
      Absent: r[5],
      Rate: r[6],
    }));

    return {
      html: `
				<h2 class="section-title">
					<i class="ph-fill ph-users-three"></i>
					Age-Wise Analysis
				</h2>

				<div class="charts-grid">
					${this._chartCard(
            "ch-age-bar",
            '<i class="ph-fill ph-chart-bar"></i>',
            "amber",
            "Attendance by Age Group",
          )}
				</div>

				${this._tableHTML(
          "tbl-age",
          [
            "Age Group",
            "Total Emp",
            "Present",
            "Half Present",
            "Weekly Off",
            "Absent",
            "Attendance %",
          ],
          rows,
          "age-wise",
        )}

				<div id="drilldown-table" style="margin-top:16px"></div>
			`,

      renderCharts: () => {
        Charts.stacked(
          "ch-age-bar",
          groups,
          [
            { name: "Present", data: groups.map((g) => gPresent[g]) },
            { name: "Half Present", data: groups.map((g) => gHalfPresent[g]) },
            { name: "Weekly Off", data: groups.map((g) => gWeeklyOff[g]) },
            { name: "Absent", data: groups.map((g) => gAbsent[g]) },
          ],
          "Age-wise",
          (g, index, seriesIndex, seriesName) => {
            const filteredLogs = logs.filter((l) => {
              const e = empMap[l.empId];
              if (!e) return false;
              if (model.getAgeGroup(e.dob) !== g) return false;
              return this._matchesStatus(l, seriesName);
            });

            this._renderDrillDown(
              filteredLogs,
              `Age: ${g} - ${seriesName}`,
              empMap,
            );
          },
        );
      },
    };
  }

  _matchesStatus(log, seriesName) {
    const present = parseFloat(log.present);
    const hasIn =
      log.inTime && log.inTime !== "00:00" && log.inTime !== "00:00:00";
    const hasOut =
      log.outTime && log.outTime !== "00:00" && log.outTime !== "00:00:00";

    if (present === 0.5) {
      return seriesName === "Half Present";
    } else if (present >= 1 || hasIn || hasOut) {
      return seriesName === "Present";
    } else if (log.weeklyOff == 1 && present === 0 && !hasIn && !hasOut) {
      return seriesName === "Weekly Off";
    } else {
      return seriesName === "Absent";
    }
  }

  _renderCompanyWise(logs, emps, empMap, model) {
    const comps = [...new Set(emps.map((e) => e.company))].sort();
    const { dateFrom, dateTo } = model.state.filters;
    const groups = this._computeGroupedDayStats(
      emps,
      logs,
      dateFrom,
      dateTo,
      (e) => e.company,
    );

    const rows = comps.map((c) => {
      const g = groups[c] || {
        total: 0,
        present: 0,
        halfPresent: 0,
        weeklyOff: 0,
        absent: 0,
      };
      const rate = g.total
        ? Math.round((g.present / g.total) * 100) + "%"
        : "0%";
      return [
        c,
        g.total,
        g.present,
        g.halfPresent,
        g.weeklyOff,
        g.absent,
        rate,
      ];
    });

    this._lastData["company-wise"] = rows.map((r) => ({
      Company: r[0],
      Total: r[1],
      Present: r[2],
      HalfPresent: r[3],
      WeeklyOff: r[4],
      Absent: r[5],
      Rate: r[6],
    }));

    return {
      html: `
				<h2 class="section-title"><i class="ph-fill ph-buildings"></i> Company Statistics</h2>
				<div class="charts-grid">
					${this._chartCard("ch-comp-bar", '<i class="ph-fill ph-chart-bar"></i>', "violet", "Company Breakdown")}
				</div>
				${this._tableHTML("tbl-comp", ["Company", "Total", "Present", "Half Present", "Weekly Off", "Absent", "Rate"], rows, "company-wise")}
				<div id="drilldown-table" style="margin-top:16px"></div>
			`,
      renderCharts: () => {
        Charts.stacked(
          "ch-comp-bar",
          comps,
          [
            { name: "Present", data: rows.map((r) => r[2]) },
            { name: "Half Present", data: rows.map((r) => r[3]) },
            { name: "Weekly Off", data: rows.map((r) => r[4]) },
            { name: "Absent", data: rows.map((r) => r[5]) },
          ],
          "Company Attendance",
          (company, index, seriesIndex, seriesName) => {
            const filteredLogs = logs.filter((l) => {
              const e = empMap[l.empId];
              if (!e || e.company !== company) return false;
              return this._matchesStatus(l, seriesName);
            });
            this._renderDrillDown(
              filteredLogs,
              `Company: ${company} - ${seriesName}`,
              empMap,
            );
          },
        );
      },
    };
  }

  _renderDeptWise(logs, emps, empMap, model) {
    this._currentDeptData = { emps, logs, empMap, model }; // ← yeh add karo
    const depts = [...new Set(emps.map((e) => e.dept))].sort();
    const { dateFrom, dateTo } = model.state.filters;
    const groups = this._computeGroupedDayStats(
      emps,
      logs,
      dateFrom,
      dateTo,
      (e) => e.dept,
    );

    const lBD = model.groupBy(logs, (l) => (empMap[l.empId] || {}).dept);

    const rows = depts.map((d) => {
      const g = groups[d] || {
        total: 0,
        present: 0,
        halfPresent: 0,
        weeklyOff: 0,
        absent: 0,
      };
      const ls = lBD[d] || [];
      const avg = ls.length
        ? (
            ls.reduce((s, l) => s + (l.hoursWorked || 0), 0) / ls.length
          ).toFixed(1)
        : 0;
      const rate = g.total
        ? Math.round((g.present / g.total) * 100) + "%"
        : "0%";
      return [
        d,
        g.total,
        g.present,
        g.halfPresent,
        g.weeklyOff,
        g.absent,
        avg,
        rate,
      ];
    });

    this._lastData["dept-wise"] = rows.map((r) => ({
      Dept: r[0],
      Total: r[1],
      Present: r[2],
      HalfPresent: r[3],
      WeeklyOff: r[4],
      Absent: r[5],
      AvgHours: r[6],
      Rate: r[7],
    }));

    return {
      html: `
					<h2 class="section-title">
						<i class="ph-fill ph-briefcase-metal"></i> Department Statistics
					</h2>
					<div class="charts-grid">
						<div class="chart-card">
							<div class="chart-card-header">
								<div class="chart-card-title">
									<div class="chart-card-icon violet"><i class="ph-fill ph-chart-bar"></i></div>
									<h3>Present by Dept</h3>
								</div>
								<span class="chart-card-drill">🖱 Naam pe click = Designation breakdown · Bar pe click = Detail</span>
							</div>
							<div class="chart-body">
								${this._renderDeptAccordionChart(depts, rows)}
							</div>
						</div>
					</div>
					${this._tableHTML("tbl-dept", ["Dept", "Total", "Present", "Half Present", "Weekly Off", "Absent", "Avg Hours", "Rate"], rows, "dept-wise")}
					<div id="drilldown-table" style="margin-top:16px"></div>
				`,

      renderCharts: () => {
        const legendItems = document.querySelectorAll(
          ".dept-accordion .dept-acc-legend span",
        );
        const accordion = document.querySelector(".dept-accordion");

        legendItems.forEach((item) => {
          item.addEventListener("mouseenter", () => {
            const status = item.dataset.legend;
            accordion.classList.add("dimmed");
            document
              .querySelectorAll(".dept-acc-seg." + status)
              .forEach((seg) => {
                seg.classList.add("active-highlight");
              });
          });

          item.addEventListener("mouseleave", () => {
            accordion.classList.remove("dimmed");
            document.querySelectorAll(".dept-acc-seg").forEach((seg) => {
              seg.classList.remove("active-highlight");
            });
          });
        });
      },
    };
  }

  _renderDeptDesignationDrilldown(dept, emps, logs, model, anchorEl) {
    const deptEmps = emps.filter((e) => e.dept === dept);
    const { dateFrom, dateTo } = model.state.filters;
    const groups = this._computeGroupedDayStats(
      deptEmps,
      logs,
      dateFrom,
      dateTo,
      (e) => e.designation || "Staff",
    );
    const desigs = Object.keys(groups).sort();

    const old = document.getElementById("dept-desig-popover");
    if (old) {
      old.remove();
    }

    const chartEl = document.getElementById("ch-dept-bar");
    const chartCard = chartEl ? chartEl.closest(".chart-card") : null;
    if (!chartCard) {
      return;
    }
    chartCard.style.position = "relative";

    const cardRect = chartCard.getBoundingClientRect();
    const anchorRect = anchorEl.getBoundingClientRect();
    const topOffset = anchorRect.bottom - cardRect.top + 6;

    const popover = document.createElement("div");
    popover.id = "dept-desig-popover";
    popover.style.position = "absolute";
    popover.style.left = "60px";
    popover.style.right = "12px";
    popover.style.top = topOffset + "px";
    popover.style.background = "#fff";
    popover.style.border = "1px solid #e2e8f0";
    popover.style.borderRadius = "12px";
    popover.style.boxShadow = "0 12px 32px rgba(0,0,0,0.18)";
    popover.style.padding = "16px";
    popover.style.zIndex = "50";

    popover.innerHTML = `
			<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
				<strong>🔍 Dept: ${dept} - Designation Breakdown</strong>
				<button class="btn-drill btn-drill-back" id="dept-desig-popover-close">✕ Close</button>
			</div>
			<div id="ch-dept-desig-drill" style="min-height:200px;"></div>
		`;

    chartCard.appendChild(popover);

    document
      .getElementById("dept-desig-popover-close")
      .addEventListener("click", () => popover.remove());

    setTimeout(() => {
      Charts.stacked(
        "ch-dept-desig-drill",
        desigs,
        [
          { name: "Present", data: desigs.map((d) => groups[d].present) },
          {
            name: "Half Present",
            data: desigs.map((d) => groups[d].halfPresent),
          },
          { name: "Weekly Off", data: desigs.map((d) => groups[d].weeklyOff) },
          { name: "Absent", data: desigs.map((d) => groups[d].absent) },
        ],
        `${dept} - Designation Attendance`,
        null,
        true,
      );
    }, 50);
  }


  _renderGenderWise(logs, emps, empMap, model) {
    const genders = ["Male", "Female"];
    const { dateFrom, dateTo } = model.state.filters;

    // Compute proper day-level stats (same logic as other tabs)
    const groups = this._computeGroupedDayStats(
      emps,
      logs,
      dateFrom,
      dateTo,
      (e) => e.gender,
    );

    const rows = genders.map((g) => {
      const grp = groups[g] || {
        total: 0,
        present: 0,
        halfPresent: 0,
        weeklyOff: 0,
        absent: 0,
      };
      const rate = grp.total
        ? Math.round((grp.present / grp.total) * 100) + "%"
        : "0%";
      return [
        g,
        grp.total,
        grp.present,
        grp.halfPresent,
        grp.weeklyOff,
        grp.absent,
        rate,
      ];
    });

    this._lastData["gender-wise"] = rows.map((r) => ({
      Gender: r[0],
      Total: r[1],
      Present: r[2],
      HalfPresent: r[3],
      WeeklyOff: r[4],
      Absent: r[5],
      Rate: r[6],
    }));

    return {
      html: `
            <h2 class="section-title">
                <i class="ph-fill ph-gender-intersex"></i> Gender Split
            </h2>

            <div class="charts-grid">
                ${this._chartCard(
                  "ch-gender-bar",
                  '<i class="ph-fill ph-chart-bar"></i>',
                  "violet",
                  "Attendance by Gender",
                  "Click bar for detail",
                )}
            </div>

            ${this._tableHTML(
              "tbl-gen",
              [
                "Gender",
                "Total",
                "Present",
                "Half Present",
                "Weekly Off",
                "Absent",
                "Rate",
              ],
              rows,
              "gender-wise",
            )}
            <div id="drilldown-table" style="margin-top:16px"></div>
        `,

      renderCharts: () => {
        Charts.stacked(
          "ch-gender-bar",
          genders,
          [
            {
              name: "Present",
              data: genders.map((g) => (groups[g] || {}).present || 0),
            },
            {
              name: "Half Present",
              data: genders.map((g) => (groups[g] || {}).halfPresent || 0),
            },
            {
              name: "Weekly Off",
              data: genders.map((g) => (groups[g] || {}).weeklyOff || 0),
            },
            {
              name: "Absent",
              data: genders.map((g) => (groups[g] || {}).absent || 0),
            },
          ],
          "Gender Attendance",
          (gender, index, seriesIndex, seriesName) => {
            const filteredLogs = logs.filter((l) => {
              const e = empMap[l.empId];
              if (!e || e.gender !== gender) return false;
              return this._matchesStatus(l, seriesName);
            });
            this._renderDrillDown(
              filteredLogs,
              `Gender: ${gender} - ${seriesName}`,
              empMap,
            );
          },
        );
      },
    };
  }

  _renderLateEarly(logs, emps, empMap) {
    const filtered = logs.filter((l) => l.lateIn || l.earlyOut);
    const rows = filtered.slice(0, 100).map((l) => {
      const e = empMap[l.empId] || {};
      return [
        e.name,
        e.dept,
        l.date,
        l.inTime,
        l.outTime,
        l.lateIn ? "Yes" : "-",
        l.earlyOut ? "Yes" : "-",
      ];
    });
    return {
      html: `
				<h2 class="section-title"><i class="ph-fill ph-clock">
					</i> Late/Early
				</h2>
				${this._tableHTML("tbl-le", ["Name", "Dept", "Date", "In", "Out", "Late", "Early"], rows, "late-early")}
			`,
      renderCharts: () => {},
    };
  }

  _fmtMins(mins) {
    const m = parseInt(mins) || 0;
    if (m <= 0) {
      return "-";
    }
    if (m < 60) {
      return `${m}m`;
    }
    return `${Math.floor(m / 60)}h ${m % 60}m`;
  }

  _renderLateIn(logs, emps, empMap, model, page = 1) {
    const items = model ? model.getLateInEmployees() : this._currentLateInItems;
    this._currentLateInItems = items;
    this._currentLateInEmpMap = empMap || this._currentLateInEmpMap;

    const pageSize = 25;
    const currentPage = page;
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
    const pageItems = items.slice(
      (currentPage - 1) * pageSize,
      currentPage * pageSize,
    );

    const rows = pageItems.map(({ log, emp, date }) => [
      emp.code || "-",
      emp.name || "-",
      emp.dept || "-",
      emp.company || "-",
      emp.shift || "-",
      log?.shiftStart || "-",
      log?.shiftEnd || "-",
      date,
      log?.inTime || "-",
      log?.outTime || "-",
      log?.hoursWorked || 0,
      this._fmtMins(log?.lateBy),
    ]);

    this._lastData["late-in"] = items.map(({ log, emp, date }) => ({
      Code: emp.code,
      Name: emp.name,
      Dept: emp.dept,
      Company: emp.company,
      Shift: emp.shift,
      Date: date,
      In: log?.inTime,
      Out: log?.outTime,
      Hours: log?.hoursWorked,
      LateByMins: log?.lateBy,
    }));

    const byShift = this._countBy(items, (it) => it.emp.shift || "No Shift");
    const shifts = Object.keys(byShift);

    let pageButtons = "";
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    for (let i = startPage; i <= endPage; i++) {
      pageButtons += `
				<button class="btn-page ${i === currentPage ? "btn-page-active" : ""}"
					onclick="AppController.view._reRenderLateInPage(${i})">
					${i}
				</button>
			`;
    }

    return {
      html: `
				<h2 class="section-title"><i class="ph-fill ph-clock-afternoon"></i> Late In Records</h2>
				<div class="charts-grid">
					${this._chartCard("ch-latein-shift", '<i class="ph ph-clock-clockwise"></i>', "amber", "Late-In Count by Shift", "Click for detail")}
				</div>
				${this._tableHTML("tbl-latein", ["Code", "Name", "Dept", "Company", "Shift", "Shift Start", "Shift End", "Date", "In", "Out", "Hours", "Late By"], rows, "late-in")}
				<div class="pagination-bar">
					<div class="pagination-text">
						Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, items.length)} of ${items.length} records &nbsp;·&nbsp; Page ${currentPage} of ${totalPages}
					</div>
					<div class="pagination-buttons">
						<button class="btn-page" ${currentPage === 1 ? "disabled" : ""} onclick="AppController.view._reRenderLateInPage(1)">«</button>
						<button class="btn-page" ${currentPage === 1 ? "disabled" : ""} onclick="AppController.view._reRenderLateInPage(${currentPage - 1})">‹</button>
						${pageButtons}
						<button class="btn-page" ${currentPage === totalPages ? "disabled" : ""} onclick="AppController.view._reRenderLateInPage(${currentPage + 1})">›</button>
						<button class="btn-page" ${currentPage === totalPages ? "disabled" : ""} onclick="AppController.view._reRenderLateInPage(${totalPages})">»</button>
					</div>
				</div>
				<div id="drilldown-table" style="margin-top:16px"></div>
			`,
      renderCharts: () => {
        Charts.stacked(
          "ch-latein-shift",
          shifts,
          [{ name: "Late In Count", data: shifts.map((s) => byShift[s]) }],
          "Late-In by Shift",
          (shiftName) => {
            const shiftLogs = items
              .filter((it) => (it.emp.shift || "No Shift") === shiftName)
              .map((it) => it.log);
            this._renderDrillDown(
              shiftLogs,
              `Late In - Shift: ${shiftName}`,
              empMap || this._currentLateInEmpMap,
            );
          },
        );
      },
    };
  }

  _reRenderLateInPage(page) {
    const content = this._renderLateIn(
      null,
      null,
      this._currentLateInEmpMap,
      null,
      page,
    );
    document.querySelector(".tab-pane-container").innerHTML = content.html;
    content.renderCharts();
  }

  _renderEarlyOut(logs, emps, empMap, model, page = 1) {
    const items = model
      ? model.getEarlyOutEmployees()
      : this._currentEarlyOutItems;
    this._currentEarlyOutItems = items;
    this._currentEarlyOutEmpMap = empMap || this._currentEarlyOutEmpMap;

    const pageSize = 25;
    const currentPage = page;
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
    const pageItems = items.slice(
      (currentPage - 1) * pageSize,
      currentPage * pageSize,
    );

    const rows = pageItems.map(({ log, emp, date }) => [
      emp.code || "-",
      emp.name || "-",
      emp.dept || "-",
      emp.company || "-",
      emp.shift || "-",
      log?.shiftStart || "-",
      log?.shiftEnd || "-",
      date,
      log?.inTime || "-",
      log?.outTime || "-",
      log?.hoursWorked || 0,
      this._fmtMins(log?.earlyBy),
    ]);

    this._lastData["early-out"] = items.map(({ log, emp, date }) => ({
      Code: emp.code,
      Name: emp.name,
      Dept: emp.dept,
      Company: emp.company,
      Shift: emp.shift,
      ShiftStart: log?.shiftStart,
      ShiftEnd: log?.shiftEnd,
      Date: date,
      In: log?.inTime,
      Out: log?.outTime,
      Hours: log?.hoursWorked,
      EarlyByMins: log?.earlyBy,
    }));

    const byShift = this._countBy(items, (it) => it.emp.shift || "No Shift");
    const shifts = Object.keys(byShift);

    let pageButtons = "";
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    for (let i = startPage; i <= endPage; i++) {
      pageButtons += `
				<button class="btn-page ${i === currentPage ? "btn-page-active" : ""}"
					onclick="AppController.view._reRenderEarlyOutPage(${i})">
					${i}
				</button>
			`;
    }

    return {
      html: `
				<h2 class="section-title"><i class="ph-fill ph-sign-out"></i> Early Out Records</h2>
				<div class="charts-grid">
					${this._chartCard("ch-earlyout-shift", '<i class="ph ph-clock-clockwise"></i>', "sky", "Early-Out Count by Shift", "Click for detail")}
				</div>
				${this._tableHTML("tbl-earlyout", ["Code", "Name", "Dept", "Company", "Shift", "Shift Start", "Shift End", "Date", "In", "Out", "Hours", "Early By"], rows, "early-out")}
				<div class="pagination-bar">
					<div class="pagination-text">
						Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, items.length)} of ${items.length} records &nbsp;·&nbsp; Page ${currentPage} of ${totalPages}
					</div>
					<div class="pagination-buttons">
						<button class="btn-page" ${currentPage === 1 ? "disabled" : ""} onclick="AppController.view._reRenderEarlyOutPage(1)">«</button>
						<button class="btn-page" ${currentPage === 1 ? "disabled" : ""} onclick="AppController.view._reRenderEarlyOutPage(${currentPage - 1})">‹</button>
						${pageButtons}
						<button class="btn-page" ${currentPage === totalPages ? "disabled" : ""} onclick="AppController.view._reRenderEarlyOutPage(${currentPage + 1})">›</button>
						<button class="btn-page" ${currentPage === totalPages ? "disabled" : ""} onclick="AppController.view._reRenderEarlyOutPage(${totalPages})">»</button>
					</div>
				</div>
				<div id="drilldown-table" style="margin-top:16px"></div>
			`,
      renderCharts: () => {
        Charts.stacked(
          "ch-earlyout-shift",
          shifts,
          [{ name: "Early Out Count", data: shifts.map((s) => byShift[s]) }],
          "Early-Out by Shift",
          (shiftName) => {
            const shiftLogs = items
              .filter((it) => (it.emp.shift || "No Shift") === shiftName)
              .map((it) => it.log);
            this._renderDrillDown(
              shiftLogs,
              `Early Out - Shift: ${shiftName}`,
              empMap || this._currentEarlyOutEmpMap,
            );
          },
        );
      },
    };
  }

  _reRenderEarlyOutPage(page) {
    const content = this._renderEarlyOut(
      null,
      null,
      this._currentEarlyOutEmpMap,
      null,
      page,
    );
    document.querySelector(".tab-pane-container").innerHTML = content.html;
    content.renderCharts();
  }

  _renderNightShift(logs, emps, empMap) {
    const filtered = logs;
    const rows = filtered.slice(0, 100).map((l) => {
      const e = empMap[l.empId] || {};
      return [
        e.name,
        e.dept,
        l.date,
        l.inTime,
        l.outTime,
        l.hoursWorked,
        l.status,
      ];
    });
    return {
      html: `
				<h2 class="section-title"><i class="ph-fill ph-moon">
					</i> Night Shift
				</h2>
				${this._tableHTML("tbl-ns", ["Name", "Dept", "Date", "In", "Out", "Hours", "Status"], rows, "night-shift")}
			`,
      renderCharts: () => {},
    };
  }

  _renderDesignationWise(logs, emps, empMap, model) {
    const desigMap = {};
    emps.forEach((e) => {
      const name = e.designation || "Staff";
      const order = e.designationSortOrder || 0;
      if (!desigMap[name] || order < desigMap[name].order) {
        desigMap[name] = { name, order };
      }
    });
    const desigs = Object.values(desigMap)
      .sort((a, b) => {
        if (a.order !== b.order) {
          return a.order - b.order;
        }
        return a.name.localeCompare(b.name);
      })
      .map((d) => d.name);
    const eBD = model.groupBy(emps, (e) => e.designation || "Staff");
    const lBD = model.groupBy(
      logs,
      (l) => (empMap[l.empId] || {}).designation || "Staff",
    );
    const rows = desigs.map((d) => {
      const t = (eBD[d] || []).length;
      const ls = lBD[d] || [];
      const p = new Set(ls.filter((l) => l.present === 1).map((l) => l.empId))
        .size;
      return [d, t, p, t - p, t ? Math.round((p / t) * 100) + "%" : "0%"];
    });
    this._lastData["designation-wise"] = rows.map((r) => ({
      Designation: r[0],
      Total: r[1],
      Present: r[2],
      Absent: r[3],
      Rate: r[4],
    }));
    return {
      html: `
				<h2 class="section-title"><i class="ph-fill ph-identification-badge">
					</i> Designation Statistics
				</h2>
				<div class="charts-grid">
					${this._chartCard("ch-desig-bar", '<i class="ph-fill ph-chart-bar"></i>', "teal", "Present by Designation", "Click for detail")}
				</div>
				${this._tableHTML("tbl-desig", ["Designation", "Total", "Present", "Absent", "Rate"], rows, "designation-wise")}
				<div id="drilldown-table" style="margin-top:16px"></div>
			`,

      renderCharts: () => {
        Charts.bar(
          "ch-desig-bar",
          desigs,
          rows.map((r) => r[2]),
          "Designation Attendance",
          true,
          (d) => {
            this._renderDrillDown(
              logs.filter((l) => (empMap[l.empId] || {}).designation === d),
              `Designation: ${d}`,
              empMap,
            );
          },
        );
      },
    };
  }

  _renderShiftWise(logs, emps, empMap, model) {
    const shiftStats = model.state.data.shiftStats || [];
    const { dateFrom, dateTo } = model.state.filters;

    const rows = shiftStats.map((s) => [
      s.shiftName,
      s.total,
      s.present,
      s.halfPresent,
      s.weeklyOff,
      s.absent,
      s.rate + "%",
    ]);

    this._lastData["shift-wise"] = rows.map((r) => ({
      Shift: r[0],
      Total: r[1],
      Present: r[2],
      HalfPresent: r[3],
      WeeklyOff: r[4],
      Absent: r[5],
      Rate: r[6],
    }));

    const fullLogs = this._buildEmployeeDayLogs(emps, logs, dateFrom, dateTo);

    return {
      html: `
				<h2 class="section-title">
					<i class="ph-fill ph-clock-clockwise"></i>
					Shift Statistics
				</h2>
				<div class="charts-grid">
					${this._chartCard(
            "ch-shift-bar",
            '<i class="ph-fill ph-chart-bar"></i>',
            "amber",
            "Present by Shift",
            "Click to view records",
          )}
				</div>
				${this._tableHTML(
          "tbl-shift",
          [
            "Shift",
            "Total",
            "Present",
            "Half Present",
            "Weekly Off",
            "Absent",
            "Rate",
          ],
          rows,
          "shift-wise",
        )}
				<div id="drilldown-table" style="margin-top:16px"></div>
			`,

      renderCharts: () => {
        Charts.stacked(
          "ch-shift-bar",
          shiftStats.map((s) => s.shiftName),
          [
            { name: "Present", data: shiftStats.map((s) => s.present) },
            {
              name: "Half Present",
              data: shiftStats.map((s) => s.halfPresent),
            },
            { name: "Weekly Off", data: shiftStats.map((s) => s.weeklyOff) },
            { name: "Absent", data: shiftStats.map((s) => s.absent) },
          ],
          "Shift Attendance",
          (shiftName, index, seriesIndex, seriesName) => {
            const filteredLogs = fullLogs.filter((l) => {
              const e = empMap[l.empId];
              if (!e) {
                return false;
              }
              if (e.shift !== shiftName) {
                return false;
              }

              return this._matchesStatus(l, seriesName);
            });

            this._renderDrillDown(
              filteredLogs,
              `Shift: ${shiftName} - ${seriesName}`,
              empMap,
            );
          },
        );
      },
    };
  }

  _buildPaginatedTable(rows, headers, page, pageSize, tableId, reRenderFnName) {
    const currentPage = page;
    const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
    const pageRows = rows.slice(
      (currentPage - 1) * pageSize,
      currentPage * pageSize,
    );
    const colCount = headers.length;

    const trs =
      pageRows
        .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`)
        .join("") || `<tr><td colspan="${colCount}">None</td></tr>`;

    let pageButtons = "";
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    for (let i = startPage; i <= endPage; i++) {
      pageButtons += `
				<button class="btn-page ${i === currentPage ? "btn-page-active" : ""}"
					onclick="AppController.view.${reRenderFnName}(${i})">
					${i}
				</button>
			`;
    }

    return `
			<table class="data-table" id="${tableId}">
				<thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
				<tbody>${trs}</tbody>
			</table>
			<div class="pagination-bar">
				<div class="pagination-text">
					Showing ${rows.length ? (currentPage - 1) * pageSize + 1 : 0}–${Math.min(currentPage * pageSize, rows.length)} of ${rows.length} records &nbsp;·&nbsp; Page ${currentPage} of ${totalPages}
				</div>
				<div class="pagination-buttons">
					<button class="btn-page" ${currentPage === 1 ? "disabled" : ""} onclick="AppController.view.${reRenderFnName}(1)">«</button>
					<button class="btn-page" ${currentPage === 1 ? "disabled" : ""} onclick="AppController.view.${reRenderFnName}(${currentPage - 1})">‹</button>
					${pageButtons}
					<button class="btn-page" ${currentPage === totalPages ? "disabled" : ""} onclick="AppController.view.${reRenderFnName}(${currentPage + 1})">›</button>
					<button class="btn-page" ${currentPage === totalPages ? "disabled" : ""} onclick="AppController.view.${reRenderFnName}(${totalPages})">»</button>
				</div>
			</div>
		`;
  }

  _renderSpecial(logs, emps, empMap, filters, model, npPage = 1, spPage = 1) {
    const noPunch = model.findNoPunchEmployees();
    const singlePunchItems = model.getSinglePunchEmployees();

    const npRows = noPunch.map((x) => [
      x.emp.code || "-",
      x.emp.name || "-",
      x.emp.dept || "-",
      x.emp.designation || "-",
      x.emp.shift || "-",
      x.emp.company || "-",
      x.maxGap,
      x.gapStart,
    ]);

    const spRows = singlePunchItems.map(({ log, emp, date }) => [
      emp.code || "-",
      emp.name || "-",
      emp.dept || "-",
      emp.designation || "-",
      emp.shift || "-",
      emp.company || "-",
      date,
      log?.inTime || log?.outTime || "-",
    ]);

    this._currentNoPunchRows = npRows;
    this._currentSinglePunchRows = spRows;

    const npHeaders = [
      "Code",
      "Name",
      "Dept",
      "Designation",
      "Shift",
      "Company",
      "Gap",
      "Start",
    ];
    const spHeaders = [
      "Code",
      "Name",
      "Dept",
      "Designation",
      "Shift",
      "Company",
      "Date",
      "Time",
    ];
    const pageSize = 10;

    return {
      html: `
				<h2 class="section-title"><i class="ph-fill ph-warning-circle"></i> Critical Alerts</h2>
				<div class="table-wrap" style="margin-bottom:20px">
					<div class="table-header"><h3>🚩 No Punch ≥ 5 Days</h3></div>
					<div id="special-np-table-wrap" style="overflow-x:auto">
						${this._buildPaginatedTable(npRows, npHeaders, npPage, pageSize, "tbl-np", "_reRenderNoPunchPage")}
					</div>
				</div>
				<div class="table-wrap">
					<div class="table-header"><h3>⚡ Single Punch</h3></div>
					<div id="special-sp-table-wrap" style="overflow-x:auto">
						${this._buildPaginatedTable(spRows, spHeaders, spPage, pageSize, "tbl-sp", "_reRenderSinglePunchPage")}
					</div>
				</div>
			`,
      renderCharts: () => {},
    };
  }

  _reRenderNoPunchPage(page) {
    const rows = this._currentNoPunchRows || [];
    const headers = [
      "Code",
      "Name",
      "Dept",
      "Designation",
      "Shift",
      "Company",
      "Gap",
      "Start",
    ];
    const wrap = document.getElementById("special-np-table-wrap");
    if (wrap) {
      wrap.innerHTML = this._buildPaginatedTable(
        rows,
        headers,
        page,
        10,
        "tbl-np",
        "_reRenderNoPunchPage",
      );
    }
  }

  _reRenderSinglePunchPage(page) {
    const rows = this._currentSinglePunchRows || [];
    const headers = [
      "Code",
      "Name",
      "Dept",
      "Designation",
      "Shift",
      "Company",
      "Date",
      "Time",
    ];
    const wrap = document.getElementById("special-sp-table-wrap");
    if (wrap) {
      wrap.innerHTML = this._buildPaginatedTable(
        rows,
        headers,
        page,
        10,
        "tbl-sp",
        "_reRenderSinglePunchPage",
      );
    }
  }

  exportPDF(tableId, filename) {
    const el = document.getElementById(tableId);
    if (!el || !window.html2canvas) return;
    html2canvas(el).then((canvas) => {
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jspdf.jsPDF({ orientation: "landscape" });
      const w = pdf.internal.pageSize.getWidth();
      const h = (canvas.height * w) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, w, h);
      pdf.save(`${filename}.pdf`);
    });
  }

  bindStatCardClick(handler) {
    this.app.addEventListener("click", (event) => {
      const card = event.target.closest(".stat-card-clickable");
      if (!card) {
        return;
      }
      const key = card.dataset.cardKey;
      if (!key) {
        return;
      }

      const wasActive = card.classList.contains("active");

      document
        .querySelectorAll(".stat-card-clickable")
        .forEach((c) => c.classList.remove("active"));

      if (wasActive) {
        this._closeStatCardDrilldown();
      } else {
        card.classList.add("active");
        handler(key);
      }
    });
  }

  _renderStatCardDrilldown(key, items, page = 1) {
    this._statCardKey = key;
    this._statCardItems = items;

    const panel = document.getElementById("stat-card-drilldown");
    if (!panel) {
      return;
    }

    const titleMap = {
      present: "✅ Present Employees",
      absent: "❌ Absent Employees",
      resigned: "👤 Resigned Employees",
      newJoined: "🆕 New Joined Employees",
      singlePunch: "⚡ Single Punch Employees",
      lateIn: "🕐 Late In Employees",
      earlyOut: "🚪 Early Out Employees",
      staffList: "👔 Staff Employees",
      workerList: "🔧 Workmen Employees",
    };

    const isResignedOnly = key === "resigned";
    const isNewJoinedOnly = key === "newJoined";
    const isStaffList = key === "staffList";
    const isWorkerList = key === "workerList";
    const pageSize = 10;
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
    const currentPage = Math.min(page, totalPages);
    const pageItems = items.slice(
      (currentPage - 1) * pageSize,
      currentPage * pageSize,
    );

    let headers, ths;
    if (isResignedOnly) {
      headers = [
        "Sr.No",
        "Code",
        "Name",
        "Dept",
        "Company",
        "DOJ",
        "DOR",
        "Status",
      ];
    } else if (isNewJoinedOnly) {
      headers = ["Sr.No", "Code", "Name", "Dept", "Company", "DOJ", "Status"];
    } else if (isStaffList || isWorkerList) {
      headers = [
        "Sr.No",
        "Code",
        "Name",
        "Dept",
        "Company",
        "Designation",
        "Shift",
        "Location",
      ];
    } else if (key === "lateIn") {
      headers = [
        "Sr.No",
        "Code",
        "Name",
        "Dept",
        "Company",
        "Shift",
        "Shift Start",
        "Shift End",
        "Date",
        "In",
        "Out",
        "Hours",
        "Late By",
      ];
    } else if (key === "earlyOut") {
      headers = [
        "Sr.No",
        "Code",
        "Name",
        "Dept",
        "Company",
        "Shift",
        "Shift Start",
        "Shift End",
        "Date",
        "In",
        "Out",
        "Hours",
        "Early By",
      ];
    } else {
      headers = [
        "Sr.No",
        "Code",
        "Name",
        "Dept",
        "Company",
        "Shift",
        "Shift Start",
        "Shift End",
        "Date",
        "In",
        "Out",
        "Hours",
        "Status",
      ];
    }
    ths = headers.map((h) => `<th>${h}</th>`).join("");

    const trs = pageItems
      .map(({ log, emp, date }, i) => {
        if (!emp) {
          return "";
        }
        const sr = (currentPage - 1) * pageSize + i + 1;

        if (isStaffList || isWorkerList) {
          return `
				<tr>
					<td>${sr}</td>
					<td><b>${emp.code || "–"}</b></td>
					<td>${emp.name || "–"}</td>
					<td>${emp.dept || "–"}</td>
					<td>${emp.company || "–"}</td>
					<td>${emp.designation || "–"}</td>
					<td>${emp.shift || "–"}</td>
					<td>${emp.location || "–"}</td>
				</tr>`;
        }

        if (isResignedOnly) {
          return `
				<tr>
					<td>${sr}</td>
					<td><b>${emp.code || "–"}</b></td>
					<td>${emp.name || "–"}</td>
					<td>${emp.dept || "–"}</td>
					<td>${emp.company || "–"}</td>
					<td>${emp.doj || "–"}</td>
					<td>${emp.dor || "–"}</td>
					<td><span class="badge badge-danger">${emp.status || "Resigned"}</span></td>
				</tr>`;
        }
        if (isNewJoinedOnly) {
          const badgeClass =
            emp.status === "Resigned" ? "badge-danger" : "badge-success";
          return `
				<tr>
					<td>${sr}</td>
					<td><b>${emp.code || "–"}</b></td>
					<td>${emp.name || "–"}</td>
					<td>${emp.dept || "–"}</td>
					<td>${emp.company || "–"}</td>
					<td>${emp.doj || "–"}</td>
					<td><span class="badge ${badgeClass}">${emp.status || "Working"}</span></td>
				</tr>`;
        }

        const lastCol =
          key === "lateIn"
            ? `<td>${this._fmtMins(log?.lateBy)}</td>`
            : key === "earlyOut"
              ? `<td>${this._fmtMins(log?.earlyBy)}</td>`
              : `<td>${log?.status ?? ""}</td>`;

        return `
				<tr>
					<td>${sr}</td>
					<td><b>${emp.code || "–"}</b></td>
					<td>${emp.name || "–"}</td>
					<td>${emp.dept || "–"}</td>
					<td>${emp.company || "–"}</td>
					<td>${emp.shift || "–"}</td>
					<td>${log?.shiftStart || "–"}</td>
					<td>${log?.shiftEnd || "–"}</td>
					<td>${date || log?.date || ""}</td>
					<td>${log?.inTime ?? ""}</td>
					<td>${log?.outTime ?? ""}</td>
					<td>${log?.hoursWorked ?? ""}</td>
					${lastCol}
				</tr>
			`;
      })
      .join("");

    let pageButtons = "";
    const startP = Math.max(1, currentPage - 2);
    const endP = Math.min(totalPages, currentPage + 2);
    for (let i = startP; i <= endP; i++) {
      pageButtons += `
			<button class="btn-page ${i === currentPage ? "btn-page-active" : ""}"
				onclick="AppController.view._renderStatCardDrilldown(AppController.view._statCardKey, AppController.view._statCardItems, ${i})">
				${i}
			</button>`;
    }

    this._statCardExportData = items.map(({ log, emp, date }) => {
      if (key === "resigned") {
        return {
          Code: emp?.code,
          Name: emp?.name,
          Dept: emp?.dept,
          Company: emp?.company,
          DOJ: emp?.doj,
          DOR: emp?.dor,
          Status: emp?.status,
        };
      }
      if (key === "newJoined") {
        return {
          Code: emp?.code,
          Name: emp?.name,
          Dept: emp?.dept,
          Company: emp?.company,
          DOJ: emp?.doj,
          Status: emp?.status,
        };
      }

      if (key === "staffList" || key === "workerList") {
        return {
          Code: emp?.code,
          Name: emp?.name,
          Dept: emp?.dept,
          Company: emp?.company,
          Designation: emp?.designation,
          Shift: emp?.shift,
          Location: emp?.location,
        };
      }

      return {
        Code: emp?.code,
        Name: emp?.name,
        Dept: emp?.dept,
        Company: emp?.company,
        Shift: emp?.shift,
        Date: date || log?.date,
        In: log?.inTime,
        Out: log?.outTime,
        Hours: log?.hoursWorked,
        LateBy: log?.lateBy,
        EarlyBy: log?.earlyBy,
        Status: log?.status,
      };
    });

    panel.style.display = "block";
    panel.innerHTML = `
			<div class="drilldown-box">
				<div class="drilldown-header">
					<div class="drilldown-title">
						${titleMap[key] || key}
						<small>${items.length} records</small>
					</div>
					<div class="drilldown-btn-group">
						<button class="btn-drill btn-drill-excel"
							onclick="AppController.view.exportExcel(AppController.view._statCardExportData, '${key}-employees')">
							↓ Excel
						</button>
						<button class="btn-drill btn-drill-back"
							onclick="AppController.view._closeStatCardDrilldown()">
							✕ Close
						</button>
					</div>
				</div>

				<div style="overflow-x:auto;">
					<table class="data-table">
						<thead><tr>${ths}</tr></thead>
						<tbody>
							${trs || `<tr><td colspan="${headers.length}" style="text-align:center;padding:32px;color:#94a3b8;">No records found</td></tr>`}
						</tbody>
					</table>
				</div>

				<div class="pagination-bar">
					<div class="pagination-text">
						Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, items.length)}
						of ${items.length} &nbsp;·&nbsp; Page ${currentPage} of ${totalPages}
					</div>
					<div class="pagination-buttons">
						<button class="btn-page" ${currentPage === 1 ? "disabled" : ""}
							onclick="AppController.view._renderStatCardDrilldown(AppController.view._statCardKey, AppController.view._statCardItems, 1)">«</button>
						<button class="btn-page" ${currentPage === 1 ? "disabled" : ""}
							onclick="AppController.view._renderStatCardDrilldown(AppController.view._statCardKey, AppController.view._statCardItems, ${currentPage - 1})">‹</button>
						${pageButtons}
						<button class="btn-page" ${currentPage === totalPages ? "disabled" : ""}
							onclick="AppController.view._renderStatCardDrilldown(AppController.view._statCardKey, AppController.view._statCardItems, ${currentPage + 1})">›</button>
						<button class="btn-page" ${currentPage === totalPages ? "disabled" : ""}
							onclick="AppController.view._renderStatCardDrilldown(AppController.view._statCardKey, AppController.view._statCardItems, ${totalPages})">»</button>
					</div>
				</div>
			</div>
		`;
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  _closeStatCardDrilldown() {
    const panel = document.getElementById("stat-card-drilldown");
    if (panel) {
      panel.style.display = "none";
      panel.innerHTML = "";
    }
    document
      .querySelectorAll(".stat-card-clickable")
      .forEach((c) => c.classList.remove("active"));
  }

  async _initDesignationOrderTab(model) {
    const contentEl = document.getElementById("designation-order-content");
    if (!contentEl) return;

    const response = await model.fetchDesignationsOrder();
    if (!response || !response.success) {
      contentEl.innerHTML = `
				<div class="alert-error-panel" style="padding: 24px; background: rgba(244,63,94,0.05); border: 1px solid rgba(244,63,94,0.2); color: #f43f5e; border-radius: var(--radius-md); display: flex; align-items: center; gap: 12px; font-weight: 500;">
					<i class="ph-fill ph-warning-circle" style="font-size: 24px;"></i>
					<span><strong>Error loading designations:</strong> ${response ? response.message : "Unknown error"}</span>
				</div>
			`;
      return;
    }

    const departments = response.data;
    if (!departments || departments.length === 0) {
      contentEl.innerHTML = `
				<div class="empty-state-panel" style="padding: 48px; text-align: center; color: var(--text-muted); background: var(--white); border-radius: var(--radius-md); box-shadow: var(--shadow-sm);">
					<i class="ph ph-mask-sad" style="font-size: 48px; color: #cbd5e1; margin-bottom: 12px; display: block;"></i>
					<span>No departments or designations found.</span>
				</div>
			`;
      return;
    }

    let html = `
			<style>
				.designation-order-header {
					display: flex;
					justify-content: space-between;
					align-items: center;
					margin-bottom: 24px;
					background: var(--white);
					padding: 20px 24px;
					border-radius: var(--radius-md);
					box-shadow: var(--shadow-sm);
					border: 1px solid var(--border-color);
					gap: 16px;
					flex-wrap: wrap;
				}
				.designation-order-header-text h3 {
					font-size: 16px;
					font-weight: 700;
					color: var(--text-main);
					margin-bottom: 4px;
				}
				.designation-order-header-text p {
					font-size: 13px;
					color: var(--text-muted);
				}
				.designation-order-controls {
					display: flex;
					align-items: center;
					gap: 12px;
				}
				.select-order-dept {
					min-width: 240px;
					padding: 10px 16px;
					border: 1px solid var(--border-color);
					border-radius: 10px;
					font-weight: 500;
					font-size: 14px;
					outline: none;
					background: var(--white);
					color: var(--text-main);
					cursor: pointer;
					transition: border-color 0.2s, box-shadow 0.2s;
				}
				.select-order-dept:focus {
					border-color: var(--primary);
					box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
				}
				.order-card-container {
					max-width: 600px;
					margin: 0 auto 32px auto;
				}
				.dept-order-card {
					background: var(--white);
					border: 1px solid var(--border-color);
					border-radius: var(--radius-md);
					box-shadow: var(--shadow-sm);
					padding: 28px;
					display: flex;
					flex-direction: column;
					gap: 20px;
					animation: fadeIn 0.25s ease-out;
				}
				@keyframes fadeIn {
					from { opacity: 0; transform: translateY(8px); }
					to { opacity: 1; transform: translateY(0); }
				}
				.dept-order-title {
					font-size: 17px;
					font-weight: 700;
					color: var(--text-main);
					display: flex;
					align-items: center;
					justify-content: space-between;
					border-bottom: 1px solid var(--border-color);
					padding-bottom: 16px;
				}
				.dept-order-title-left {
					display: flex;
					align-items: center;
					gap: 12px;
				}
				.dept-order-title-left i {
					font-size: 22px;
					color: var(--primary);
					background: rgba(99, 102, 241, 0.1);
					width: 42px;
					height: 42px;
					border-radius: 10px;
					display: flex;
					align-items: center;
					justify-content: center;
				}
				.dept-order-badge {
					font-size: 12px;
					font-weight: 600;
					background: #f1f5f9;
					color: #475569;
					padding: 4px 10px;
					border-radius: 9999px;
				}
				.desig-order-list {
					display: flex;
					flex-direction: column;
					gap: 12px;
				}
				.desig-order-item {
					display: flex;
					align-items: center;
					justify-content: space-between;
					padding: 12px 16px;
					background: #f8fafc;
					border: 1px solid #f1f5f9;
					border-radius: 10px;
					font-size: 14px;
					transition: border-color 0.2s, background-color 0.2s;
				}
				.desig-order-item:hover {
					background: #f1f5f9;
					border-color: #e2e8f0;
				}
				.desig-order-name-wrap {
					display: flex;
					align-items: center;
					gap: 10px;
				}
				.desig-order-drag-handle {
					color: #94a3b8;
					font-size: 18px;
				}
				.desig-order-name {
					font-weight: 600;
					color: #334155;
				}
				.desig-order-control-wrap {
					display: flex;
					align-items: center;
					background: var(--white);
					border: 1px solid #cbd5e1;
					border-radius: 8px;
					overflow: hidden;
					box-shadow: 0 1px 2px rgba(0,0,0,0.05);
				}
				.desig-order-btn {
					background: none;
					border: none;
					width: 32px;
					height: 32px;
					display: flex;
					align-items: center;
					justify-content: center;
					color: #64748b;
					cursor: pointer;
					transition: background-color 0.15s, color 0.15s;
					font-size: 14px;
				}
				.desig-order-btn:hover {
					background: #f1f5f9;
					color: var(--primary);
				}
				.desig-order-btn:active {
					background: #e2e8f0;
				}
				.desig-order-input {
					width: 44px;
					border: none;
					border-left: 1px solid #cbd5e1;
					border-right: 1px solid #cbd5e1;
					text-align: center;
					font-size: 14px;
					font-weight: 700;
					color: #0f172a;
					padding: 4px 0;
					outline: none;
					-moz-appearance: textfield;
				}
				.desig-order-input::-webkit-outer-spin-button,
				.desig-order-input::-webkit-inner-spin-button {
					-webkit-appearance: none;
					margin: 0;
				}
				.btn-order-save {
					background: var(--primary);
					color: var(--white);
					border: none;
					padding: 10px 20px;
					border-radius: 10px;
					font-size: 14px;
					font-weight: 600;
					cursor: pointer;
					display: flex;
					align-items: center;
					gap: 8px;
					box-shadow: 0 4px 14px rgba(99, 102, 241, 0.3);
					transition: background-color 0.2s, transform 0.1s, box-shadow 0.2s;
				}
				.btn-order-save:hover {
					background: var(--primary-hover);
					box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
				}
				.btn-order-save:active {
					transform: scale(0.97);
				}
			</style>
			<div class="designation-order-header">
				<div class="designation-order-header-text">
					<h3>Designations Sorting Order</h3>
					<p>Set custom sorting priority for designations grouped under each department. Lower numbers show first.</p>
				</div>
				<div class="designation-order-controls">
					<select class="select-order-dept" id="select-order-dept">
						<option value="">-- Choose Department --</option>
						${departments.map((d) => `<option value="${d.id}">${d.name}</option>`).join("")}
					</select>
					<button class="btn-order-save" id="btn-save-designation-order" style="display: none;">
						<i class="ph-bold ph-floppy-disk"></i>
						Save Changes
					</button>
				</div>
			</div>
			<div id="designation-order-details-container">
				<div class="empty-state-panel" style="padding: 64px 32px; text-align: center; color: var(--text-muted); background: var(--white); border-radius: var(--radius-md); box-shadow: var(--shadow-sm); border: 1px solid var(--border-color);">
					<i class="ph ph-hand-pointing" style="font-size: 48px; color: var(--primary); opacity: 0.7; margin-bottom: 16px; display: block; margin-left: auto; margin-right: auto;"></i>
					<h4 style="font-size: 15px; font-weight: 600; color: var(--text-main); margin-bottom: 4px;">Choose a Department</h4>
					<p style="font-size: 13px;">Select a department from the dropdown menu above to manage its designation priority.</p>
				</div>
			</div>
		`;

    contentEl.innerHTML = html;

    const deptSelect = document.getElementById("select-order-dept");
    const detailsContainer = document.getElementById(
      "designation-order-details-container",
    );
    const saveBtn = document.getElementById("btn-save-designation-order");

    deptSelect.addEventListener("change", () => {
      const deptId = deptSelect.value;
      if (!deptId) {
        saveBtn.style.display = "none";
        detailsContainer.innerHTML = `
					<div class="empty-state-panel" style="padding: 64px 32px; text-align: center; color: var(--text-muted); background: var(--white); border-radius: var(--radius-md); box-shadow: var(--shadow-sm); border: 1px solid var(--border-color);">
						<i class="ph ph-hand-pointing" style="font-size: 48px; color: var(--primary); opacity: 0.7; margin-bottom: 16px; display: block; margin-left: auto; margin-right: auto;"></i>
						<h4 style="font-size: 15px; font-weight: 600; color: var(--text-main); margin-bottom: 4px;">Choose a Department</h4>
						<p style="font-size: 13px;">Select a department from the dropdown menu above to manage its designation priority.</p>
					</div>
				`;
        return;
      }

      saveBtn.style.display = "flex";

      const dept = departments.find((d) => String(d.id) === String(deptId));
      if (!dept) return;

      let cardHtml = `
				<div class="order-card-container">
					<div class="dept-order-card">
						<div class="dept-order-title">
							<div class="dept-order-title-left">
								<i class="ph ph-briefcase"></i>
								<span>${dept.name}</span>
							</div>
							<span class="dept-order-badge">${dept.designations.length} designations</span>
						</div>
						<div class="desig-order-list">
			`;

      dept.designations.forEach((desig) => {
        cardHtml += `
					<div class="desig-order-item">
						<div class="desig-order-name-wrap">
							<i class="ph ph-dots-six-vertical desig-order-drag-handle"></i>
							<span class="desig-order-name">${desig.name}</span>
						</div>
						<div class="desig-order-control-wrap">
							<button class="desig-order-btn btn-dec" type="button"><i class="ph ph-minus"></i></button>
							<input type="number" class="desig-order-input" data-desig-id="${desig.id}" data-dept-id="${dept.id}" value="${desig.sortOrder}">
							<button class="desig-order-btn btn-inc" type="button"><i class="ph ph-plus"></i></button>
						</div>
					</div>
				`;
      });

      cardHtml += `
						</div>
					</div>
				</div>
			`;

      detailsContainer.innerHTML = cardHtml;

      detailsContainer.querySelectorAll(".desig-order-item").forEach((item) => {
        const decBtn = item.querySelector(".btn-dec");
        const incBtn = item.querySelector(".btn-inc");
        const input = item.querySelector(".desig-order-input");

        decBtn.addEventListener("click", () => {
          let val = parseInt(input.value) || 0;
          input.value = Math.max(0, val - 1);
        });

        incBtn.addEventListener("click", () => {
          let val = parseInt(input.value) || 0;
          input.value = val + 1;
        });
      });
    });

    saveBtn.addEventListener("click", async () => {
      const inputs = detailsContainer.querySelectorAll(".desig-order-input");
      const items = [];
      inputs.forEach((input) => {
        items.push({
          id: parseInt(input.dataset.desigId),
          deptId: parseInt(input.dataset.deptId),
          sortOrder: parseInt(input.value) || 0,
        });
      });

      this.showOverlay("Saving designation order...");
      const saveRes = await model.saveDesignationsOrder(items);
      this.hideOverlay();

      if (saveRes && saveRes.success) {
        alert("Designation orders saved successfully!");
        this.showOverlay("Refreshing data...");
        await model.fetchData();
        this.hideOverlay();
      } else {
        alert(
          "Failed to save designation orders: " +
            (saveRes ? saveRes.message : "Unknown error"),
        );
      }
    });
  }

  _renderStaff(logs, emps, empMap, model) {
    const staffCategoryIds = [58];
    const { dateFrom, dateTo } = model.state.filters;

    const staffEmps = emps.filter((e) =>
      staffCategoryIds.includes(e.categoryId),
    );
    const staffGroups = this._computeGroupedDayStats(
      staffEmps,
      logs,
      dateFrom,
      dateTo,
      (e) => e.dept,
    );
    const staffDepts = [...new Set(staffEmps.map((e) => e.dept))].sort();

    const staffRows = staffDepts.map((d) => {
      const g = staffGroups[d] || {};
      return [
        d,
        g.total || 0,
        g.present || 0,
        g.halfPresent || 0,
        g.weeklyOff || 0,
        g.absent || 0,
        g.total ? Math.round((g.present / g.total) * 100) + "%" : "0%",
      ];
    });

    this._lastData["staff-wise"] = staffRows.map((r) => ({
      Dept: r[0],
      Total: r[1],
      Present: r[2],
      Half: r[3],
      WeeklyOff: r[4],
      Absent: r[5],
      Rate: r[6],
    }));

    return {
      html: `
				<h2 class="section-title">
					<i class="ph-fill ph-identification-badge"></i> Staff Statistics
				</h2>
				<div class="charts-grid">
					${this._chartCard("ch-staff-dept", '<i class="ph-fill ph-chart-bar"></i>', "violet", "Staff Attendance by Department", "Click bar for detail")}
				</div>
				${this._tableHTML("tbl-staff", ["Dept", "Total", "Present", "Half Present", "Weekly Off", "Absent", "Rate"], staffRows, "staff-wise")}
				<div id="drilldown-table" style="margin-top:16px"></div>
			`,
      renderCharts: () => {
        Charts.stacked(
          "ch-staff-dept",
          staffDepts,
          [
            { name: "Present", data: staffRows.map((r) => r[2]) },
            { name: "Half Present", data: staffRows.map((r) => r[3]) },
            { name: "Weekly Off", data: staffRows.map((r) => r[4]) },
            { name: "Absent", data: staffRows.map((r) => r[5]) },
          ],
          "Staff by Department",
          (dept, index, seriesIndex, seriesName) => {
            const filtered = logs.filter((l) => {
              const e = empMap[l.empId];
              if (!e || e.dept !== dept) {
                return false;
              }
              if (!staffCategoryIds.includes(e.categoryId)) {
                return false;
              }
              return this._matchesStatus(l, seriesName);
            });
            this._renderDrillDown(
              filtered,
              `Staff – ${dept} – ${seriesName}`,
              empMap,
            );
          },
        );
      },
    };
  }

  _renderWorker(logs, emps, empMap, model) {
    const workerCategoryIds = [51, 59, 60];
    const { dateFrom, dateTo } = model.state.filters;

    const workerEmps = emps.filter((e) =>
      workerCategoryIds.includes(e.categoryId),
    );
    const workerGroups = this._computeGroupedDayStats(
      workerEmps,
      logs,
      dateFrom,
      dateTo,
      (e) => e.dept,
    );
    const workerDepts = [...new Set(workerEmps.map((e) => e.dept))].sort();

    const workerRows = workerDepts.map((d) => {
      const g = workerGroups[d] || {};
      return [
        d,
        g.total || 0,
        g.present || 0,
        g.halfPresent || 0,
        g.weeklyOff || 0,
        g.absent || 0,
        g.total ? Math.round((g.present / g.total) * 100) + "%" : "0%",
      ];
    });

    this._lastData["worker-wise"] = workerRows.map((r) => ({
      Dept: r[0],
      Total: r[1],
      Present: r[2],
      Half: r[3],
      WeeklyOff: r[4],
      Absent: r[5],
      Rate: r[6],
    }));

    return {
      html: `
				<h2 class="section-title">
					<i class="ph-fill ph-hard-hat"></i> Workmen Statistics
				</h2>
				<div class="charts-grid">
					${this._chartCard("ch-worker-dept", '<i class="ph-fill ph-chart-bar"></i>', "amber", "Workmen Attendance by Department", "Click bar for detail")}
				</div>
				${this._tableHTML("tbl-worker", ["Dept", "Total", "Present", "Half Present", "Weekly Off", "Absent", "Rate"], workerRows, "worker-wise")}
				<div id="drilldown-table" style="margin-top:16px"></div>
			`,
      renderCharts: () => {
        Charts.stacked(
          "ch-worker-dept",
          workerDepts,
          [
            { name: "Present", data: workerRows.map((r) => r[2]) },
            { name: "Half Present", data: workerRows.map((r) => r[3]) },
            { name: "Weekly Off", data: workerRows.map((r) => r[4]) },
            { name: "Absent", data: workerRows.map((r) => r[5]) },
          ],
          "Workmen by Department",
          (dept, index, seriesIndex, seriesName) => {
            const filtered = logs.filter((l) => {
              const e = empMap[l.empId];
              if (!e || e.dept !== dept) {
                return false;
              }
              if (!workerCategoryIds.includes(e.categoryId)) {
                return false;
              }
              return this._matchesStatus(l, seriesName);
            });
            this._renderDrillDown(
              filtered,
              `Workmen – ${dept} – ${seriesName}`,
              empMap,
            );
          },
        );
      },
    };
  }
}

window.AttendanceView = AttendanceView;
