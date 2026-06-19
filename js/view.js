/**
 * AttendanceView - Handles UI rendering and DOM updates
 */
class AttendanceView {
  constructor() {
    this.app = document.getElementById("app");
    this.TABS = [
      { id: "feature", label: "Dashboard", icon: "ph-house" },
      { id: "all", label: "Attendance Logs", icon: "ph-list-dashes" },
      { id: "age", label: "Age Analysis", icon: "ph-user-circle" },
      { id: "company", label: "Company Stats", icon: "ph-buildings" },
      { id: "dept", label: "Department Stats", icon: "ph-briefcase" },
      { id: "gender", label: "Gender Split", icon: "ph-gender-intersex" },
      { id: "late", label: "Late/Early", icon: "ph-clock" },
      { id: "night", label: "Night Shift", icon: "ph-moon" },
      {
        id: "designation",
        label: "Designation Stats",
        icon: "ph-identification-badge",
      },
      { id: "shift", label: "Shift Stats", icon: "ph-clock-clockwise" },
      { id: "special", label: "Critical Alerts", icon: "ph-warning-circle" },
    ];
    this._lastData = {};
  }

  render(state, model) {
    let stats = model.getSummaryStats();

    if (state.activeTab === "night") {
      stats = state.nightShiftStats || stats;
    }

    const { logs, emps, empMap } = model.getFilteredData();
    const filterOpts = model.getFilterOptions();

    this.app.innerHTML = `
			<div class="dashboard-layout">
				${this._renderSidebar(state.activeTab)}
				<div class="main-content">
					${this._renderTopbar(state)}
					<div class="content-body">
						${this._renderFilters(state.filters, filterOpts)}
						${this._renderSummaryCards(stats)}
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
    );
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
    const cards = [
      {
        label: "Present",
        val: stats.present,
        icon: "ph-check-circle",
        cls: "success",
      },
      {
        label: "Absent",
        val: stats.absent,
        icon: "ph-x-circle",
        cls: "danger",
      },
      {
        label: "Single Punch",
        val: stats.singlePunch,
        icon: "ph-lightning",
        cls: "warning",
      },
      {
        label: "Late In",
        val: stats.lateIn,
        icon: "ph-clock-afternoon",
        cls: "info",
      },
      {
        label: "Early Out",
        val: stats.earlyOut,
        icon: "ph-sign-out",
        cls: "accent",
      },
      {
        label: "Avg Hours",
        val: stats.avgHours + "h",
        icon: "ph-timer",
        cls: "",
      },
      { label: "Total Staff", val: stats.total, icon: "ph-users", cls: "" },
    ];

    return `
			<div class="summary-grid">
				${cards
          .map(
            (c) => `
					<div class="stat-card ${c.cls}">
						<div class="stat-icon"><i class="ph ${c.icon}"></i></div>
						<div class="stat-content">
							<span class="stat-label">${c.label}</span>
							<span class="stat-value">${c.val}</span>
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
      case "special":
        content = this._renderSpecial(logs, emps, empMap, filters, model);
        break;
      default:
        content = { html: "<p>Tab not found</p>" };
    }
    return typeof content === "object" ? content.html : content;
  }

  _initChartRendering(tabId, logs, emps, empMap, filters, counts, model) {
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
      case "special":
        content = this._renderSpecial(logs, emps, empMap, filters, model);
        break;
    }

    if (content && typeof content.renderCharts === "function") {
      try {
        setTimeout(() => {
          console.log("Rendering Tab:", tabId);
          content.renderCharts();
        }, 50);
      } catch (e) {
        console.error("Chart Error:", e);
      }
    }
  }

  _restoreFilterValues(filters) {
    const fields = ["company", "dept", "shift"];
    fields.forEach((f) => {
      const el = document.getElementById("f-" + f);
      if (el) el.value = filters[f];
    });
  }

  bindSwitchTab(handler) {
    this.app.addEventListener("click", (event) => {
      const navItem = event.target.closest(".nav-item");
      if (navItem) {
        const tabId = navItem.dataset.tab;
        handler(tabId);
      }
    });
  }

  bindApplyFilters(handler) {
    this.app.addEventListener("click", (event) => {
      if (event.target.closest("#btn-apply-filters")) {
        const filters = {
          dateFrom: document.getElementById("f-from").value,
          dateTo: document.getElementById("f-to").value,
          company: document.getElementById("f-company").value,
          dept: document.getElementById("f-dept").value,
          shift: document.getElementById("f-shift").value,
        };
        handler(filters);
      }
    });
  }

  bindRefreshData(handler) {
    this.app.addEventListener("click", (event) => {
      if (event.target.closest("#btn-refresh-data")) {
        handler();
      }
    });
  }

  bindResetFilters(handler) {
    this.app.addEventListener("click", (event) => {
      if (event.target.closest("#btn-reset-filters")) {
        handler();
      }
    });
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
    if (d) d.innerHTML = "";
    const m = document.getElementById("main-table-wrap");
    if (m) m.style.display = "";
  }

  _countBy(arr, keyFn) {
    const out = {};
    arr.forEach((x) => {
      const k = keyFn(x);
      out[k] = (out[k] || 0) + 1;
    });
    return out;
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
				</div>`;
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
	        </div>`;
  }

  _renderFeature(counts) {
    return {
      html: `
					<h2 class="section-title"><i class="ph-fill ph-chart-bar"></i> Employee Entry/Exit Overview</h2>
					<div class="summary-cards" style="margin-bottom:24px; display:flex; gap:16px;">
						<div class="stat-card info" style="flex:1">
							<div class="stat-icon">
								<i class="ph ph-sign-in"></i>
							</div>
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
					</div>`,

      renderCharts: () => {
        const inCount = counts.in || 0;
        const outCount = counts.out || 0;
        if (inCount === 0 && outCount === 0) {
          const el = document.getElementById("ch-feat-io");
          if (el)
            el.innerHTML =
              '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#94a3b8;font-size:14px;font-weight:600;">No data available</div>';
        } else {
          Charts.donut(
            "ch-feat-io",
            ["in", "out"],
            [inCount, outCount],
            "In vs Out Punches",
          );
        }
      },
    };
  }

  _renderAll(logs, emps, empMap, filters) {
    console.log("RAW LOGS:", logs);
    console.log("RAW EMPS:", emps);
    const rows = logs.slice(0, 200).map((l) => {
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

    return {
      html: `
					<h2 class="section-title"><i class="ph-fill ph-stack"></i> All Attendance Records</h2>
					<div class="charts-grid">
						${this._chartCard("ch-all-trend", '<i class="ph ph-trend-up"></i>', "violet", "Daily Attendance Trend", "Click for detail")}
						${this._chartCard("ch-all-dept", '<i class="ph ph-briefcase"></i>', "teal", "By Department (Punches)", "Click for detail")}
					</div>
					${this._tableHTML("tbl-all", ["Code", "Name", "Dept", "Company", "Date", "In", "Out", "Hours", "Late In", "Early Out", "Status"], rows, "all-attendance")}
					<div id="drilldown-table" style="margin-top:16px"></div>`,

      renderCharts: () => {
        Charts.line(
          "ch-all-trend",
          dates,
          [{ name: "Total Punches", data: counts }],
          "Daily Attendance",
          (date) => {
            this._renderDrillDown(
              logs.filter((l) => l.date === date),
              `Date: ${date}`,
              empMap,
            );
          },
        );
        Charts.donut(
          "ch-all-dept",
          Object.keys(byDept),
          Object.values(byDept),
          "Dept Distribution",
          (dept) => {
            this._renderDrillDown(
              logs.filter((l) => (empMap[l.empId] || {}).dept === dept),
              `Department: ${dept}`,
              empMap,
            );
          },
        );
      },
    };
  }

  _renderDrillDown(logs, title, empMap, page = 1) {
    this._currentDrillLogs = logs;
    this._currentDrillTitle = title;
    this._currentDrillEmpMap = empMap;

    const container = document.getElementById("drilldown-table");
    if (!container) return;

    const mainWrap = document.getElementById("main-table-wrap");
    if (mainWrap) mainWrap.style.display = "none";

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
	            </div>`;
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
	                <td>${l.date}</td>
	                <td>${l.inTime || "–"}</td>
	                <td>${l.outTime || "–"}</td>
	                <td><b>${l.hoursWorked || 0}h</b></td>
	                <td>${l.lateIn ? "Yes" : "No"}</td>
	                <td>${l.earlyOut ? "Yes" : "No"}</td>
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
        Date: l.date,
        In: l.inTime,
        Out: l.outTime,
        Hours: l.hoursWorked,
        Late: l.lateIn,
        Early: l.earlyOut,
        Status: l.status,
      };
    });

    // Page number buttons (show current ± 2)
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
	            </button>`;
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
	                            <th>Sr.No</th><th>Code</th><th>Name</th><th>Dept</th>
	                            <th>Company</th><th>Shift</th><th>Date</th><th>In</th>
	                            <th>Out</th><th>Hours</th><th>Late</th><th>Early</th><th>Status</th>
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

	        </div>`;

    container.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  _renderAgeWise(logs, emps, empMap, model) {
    const groups = ["Under 25", "25–34", "35–44", "45–54", "55+"];

    const gTotal = {};
    const gPresent = {};
    const gHalfPresent = {};
    const gWeeklyOff = {};
    const gHoliday = {};
    const gLeave = {};
    const gAbsent = {};

    groups.forEach((g) => {
      gTotal[g] = 0;
      gPresent[g] = 0;
      gHalfPresent[g] = 0;
      gWeeklyOff[g] = 0;
      gHoliday[g] = 0;
      gLeave[g] = 0;
      gAbsent[g] = 0;
    });

    const isSingleDay =
      model.state.filters.dateFrom === model.state.filters.dateTo;

    emps.forEach((e) => {
      const g = model.getAgeGroup(e.dob);
      gTotal[g]++;
    });

    if (isSingleDay) {
      const empStatusMap = {};

      logs.forEach((l) => {
        empStatusMap[l.empId] = l;
      });

      console.log(logs.slice(0, 20));

      Object.values(empStatusMap).forEach((l) => {
        const e = empMap[l.empId];

        if (!e) {
          return;
        }

        const g = model.getAgeGroup(e.dob);

        if (l.weeklyOff == 1 && l.present == 0) {
          gWeeklyOff[g]++;
        } else if (l.holiday == 1) {
          gHoliday[g]++;
        } else if (l.isOnLeave == 1) {
          gLeave[g]++;
        } else if (parseFloat(l.present) === 1) {
          gPresent[g]++;
        } else if (parseFloat(l.present) === 0.5) {
          gHalfPresent[g]++;
        } else {
          gAbsent[g]++;
        }
      });
    } else {
      logs.forEach((l) => {
        const e = empMap[l.empId];

        if (!e) return;

        const g = model.getAgeGroup(e.dob);

        if (parseFloat(l.present) === 1) {
          gPresent[g]++;
        } else {
          gAbsent[g]++;
        }
      });
    }

    const rows = groups.map((g) => {
      const attendancePercent = isSingleDay
        ? gTotal[g]
          ? (gPresent[g] / gTotal[g]) * 100
          : 0
        : gPresent[g] + gAbsent[g]
          ? (gPresent[g] / (gPresent[g] + gAbsent[g])) * 100
          : 0;

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
            {
              name: "Present",
              data: groups.map((g) => gPresent[g]),
            },
            {
              name: "Half Present",
              data: groups.map((g) => gHalfPresent[g]),
            },
            {
              name: "Weekly Off",
              data: groups.map((g) => gWeeklyOff[g]),
            },
            {
              name: "Absent",
              data: groups.map((g) => gAbsent[g]),
            },
          ],
          "Age-wise",
          (g, index, seriesIndex, seriesName) => {
            const filteredLogs = logs.filter((l) => {
              const e = empMap[l.empId];

              if (!e) {
                return false;
              }

              if (model.getAgeGroup(e.dob) !== g) {
                return false;
              }

              switch (seriesName) {
                case "Present":
                  return (
                    l.status === "Present" ||
                    l.status === "Present On WeeklyOff"
                  );

                case "Half Present":
                  return (
                    l.status === "1/2Present" ||
                    l.status === "1/2Present On WeeklyOff"
                  );

                case "Weekly Off":
                  return l.status === "On WeeklyOff";

                case "Absent":
                  return l.status === "Absent";

                default:
                  return false;
              }
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

  // _renderCompanyWise(logs, emps, empMap, model) {
  //     const comps = [...new Set(emps.map(e => e.company))].sort();
  //     const eBC = model.groupBy(emps, e => e.company);
  //     const lBC = model.groupBy(logs, l => (empMap[l.empId] || {}).company);
  //     const rows = comps.map(c => {
  //         const t = (eBC[c] || []).length, ls = lBC[c] || [];
  //         const p = new Set(ls.map(l => l.empId)).size;
  //         return [c, t, p, t - p, t ? Math.round(p / t * 100) + '%' : '0%'];
  //     });
  //     this._lastData['company-wise'] = rows.map(r => ({ Company: r[0], Total: r[1], Present: r[2], Absent: r[3], Rate: r[4] }));
  //     return {
  //         html: `<h2 class="section-title"><i class="ph-fill ph-buildings"></i> Company Statistics</h2><div class="charts-grid">${this._chartCard('ch-comp-bar', '<i class="ph-fill ph-chart-bar"></i>', 'violet', 'Company Breakdown')}</div>${this._tableHTML('tbl-comp', ['Company', 'Total', 'Present', 'Absent', 'Rate'], rows, 'company-wise')}<div id="drilldown-table" style="margin-top:16px"></div>`,
  //         renderCharts: () => {
  //             Charts.bar('ch-comp-bar', comps, rows.map(r => r[2]), 'Attendance', false, c => {
  //                 this._renderDrillDown(logs.filter(l => (empMap[l.empId] || {}).company === c), `Company: ${c}`, empMap);
  //             });
  //         }
  //     };
  // }

  //   _renderCompanyWise(logs, emps, empMap, model) {
  //     const comps = [...new Set(emps.map((e) => e.company))].sort();
  //     const eBC = model.groupBy(emps, (e) => e.company);
  //     const lBC = model.groupBy(logs, (l) => (empMap[l.empId] || {}).company);

  //     const rows = comps.map((c) => {
  //       const t = (eBC[c] || []).length;
  //       const ls = lBC[c] || [];

  //       // Har employee ka ek record — present value check karo
  //       // Ek hi din ka data ho tab: empId → present value map
  //       const empPresentMap = {};
  //       ls.forEach((l) => {
  //         const pval = parseFloat(l.present);
  //         const existing = empPresentMap[l.empId];
  //         // Present=1 ko priority do, phir 0.5, phir 0
  //         if (existing === undefined || pval > existing) {
  //           empPresentMap[l.empId] = pval;
  //         }
  //       });

  //       const empIds = Object.keys(empPresentMap);
  //       const p = empIds.filter((id) => empPresentMap[id] === 1).length;
  //       const hp = empIds.filter((id) => empPresentMap[id] === 0.5).length;
  //       const ab = empIds.filter((id) => empPresentMap[id] === 0).length;

  //       return [c, t, p, hp, ab, t ? Math.round((p / t) * 100) + "%" : "0%"];
  //     });

  //     this._lastData["company-wise"] = rows.map((r) => ({
  //       Company: r[0],
  //       Total: r[1],
  //       Present: r[2],
  //       HalfPresent: r[3],
  //       Absent: r[4],
  //       Rate: r[5],
  //     }));

  //     return {
  //       html: `<h2 class="section-title"><i class="ph-fill ph-buildings"></i> Company Statistics</h2>
  //       <div class="charts-grid">
  //         ${this._chartCard("ch-comp-bar", '<i class="ph-fill ph-chart-bar"></i>', "violet", "Company Breakdown")}
  //       </div>
  //       ${this._tableHTML("tbl-comp", ["Company", "Total", "Present", "Half Present", "Absent", "Rate"], rows, "company-wise")}
  //       <div id="drilldown-table" style="margin-top:16px"></div>`,
  //       renderCharts: () => {
  //         Charts.stacked(
  //           "ch-comp-bar",
  //           comps,
  //           [
  //             // Present + Half Present ek saath green mein dikhao
  //             { name: "Present", data: rows.map((r) => r[2] + r[3]) }, // 53 + 2 = 55
  //             { name: "Absent", data: rows.map((r) => r[4]) }, // 19
  //           ],
  //           "Company Attendance",
  //           (c) => {
  //             this._renderDrillDown(
  //               logs.filter((l) => (empMap[l.empId] || {}).company === c),
  //               `Company: ${c}`,
  //               empMap,
  //             );
  //           },
  //         );
  //       },
  //     };
  //   }

  _renderCompanyWise(logs, emps, empMap, model) {
    const comps = [...new Set(emps.map((e) => e.company))].sort();
    const eBC = model.groupBy(emps, (e) => e.company);
    const lBC = model.groupBy(logs, (l) => (empMap[l.empId] || {}).company);

    const rows = comps.map((c) => {
      const compEmps = eBC[c] || [];
      const t = compEmps.length; // Total = Employees table se
      const ls = lBC[c] || [];

      const empPresentMap = {};
      ls.forEach((l) => {
        const pval = parseFloat(l.present);
        const existing = empPresentMap[l.empId];
        if (existing === undefined || pval > existing) {
          empPresentMap[l.empId] = pval;
        }
      });

      const p = Object.keys(empPresentMap).filter(
        (id) => empPresentMap[id] === 1,
      ).length;

      const hp = Object.keys(empPresentMap).filter(
        (id) => empPresentMap[id] === 0.5,
      ).length;

      const loggedAbsent = Object.keys(empPresentMap).filter(
        (id) => empPresentMap[id] === 0,
      ).length;

      const noLogEmps = compEmps.filter(
        (e) => empPresentMap[e.id] === undefined,
      ).length;

      const wo = ls.filter(
        (l) => l.weeklyOff == 1 && parseFloat(l.present) === 0,
      ).length;

      const ab = loggedAbsent + noLogEmps;

      return [c, t, p, hp, wo, ab, t ? Math.round((p / t) * 100) + "%" : "0%"];
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
			<h2 class="section-title">
				<i class="ph-fill ph-buildings"></i> Company Statistics
			</h2>
		  	<div class="charts-grid">
		    	${this._chartCard("ch-comp-bar", '<i class="ph-fill ph-chart-bar"></i>', "violet", "Company Breakdown")}
			</div>
			${this._tableHTML("tbl-comp", ["Company", "Total", "Present", "Half Present", "Weekly Off", "Absent", "Rate"], rows, "company-wise")}
			<div id="drilldown-table" style="margin-top:16px"></div>`,
      renderCharts: () => {
        Charts.stacked(
          "ch-comp-bar",
          comps,
          [
            {
              name: "Present",
              data: rows.map((r) => r[2]),
            },
            {
              name: "Half Present",
              data: rows.map((r) => r[3]),
            },
            {
              name: "Weekly Off",
              data: rows.map((r) => r[4]),
            },
            {
              name: "Absent",
              data: rows.map((r) => r[5]),
            },
          ],
          "Company Attendance",
          (company, index, seriesIndex, seriesName) => {
            const filteredLogs = logs.filter((l) => {
              const e = empMap[l.empId];

              if (!e) {
                return false;
              }

              if (e.company !== company) {
                return false;
              }

              switch (seriesName) {
                case "Present":
                  return (
                    l.status === "Present" ||
                    l.status === "Present On WeeklyOff"
                  );

                case "Half Present":
                  return (
                    l.status === "1/2Present" ||
                    l.status === "1/2Present On WeeklyOff"
                  );

                case "Weekly Off":
                  return l.status === "On WeeklyOff";

                case "Absent":
                  return l.status === "Absent";

                default:
                  return false;
              }
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
    const depts = [...new Set(emps.map((e) => e.dept))].sort();
    const eBD = model.groupBy(emps, (e) => e.dept);
    const lBD = model.groupBy(logs, (l) => (empMap[l.empId] || {}).dept);

    const rows = depts.map((d) => {
      const compEmps = eBD[d] || [];
      const t = compEmps.length;
      const ls = lBD[d] || [];

      const empPresentMap = {};
      ls.forEach((l) => {
        const pval = parseFloat(l.present);
        const existing = empPresentMap[l.empId];
        if (existing === undefined || pval > existing) {
          empPresentMap[l.empId] = pval;
        }
      });

      const p = Object.keys(empPresentMap).filter(
        (id) => empPresentMap[id] === 1,
      ).length;
      const hp = Object.keys(empPresentMap).filter(
        (id) => empPresentMap[id] === 0.5,
      ).length;
      const loggedAbsent = Object.keys(empPresentMap).filter(
        (id) => empPresentMap[id] === 0,
      ).length;
      const noLogEmps = compEmps.filter(
        (e) => empPresentMap[e.id] === undefined,
      ).length;

      const wo = ls.filter(
        (l) => l.weeklyOff == 1 && parseFloat(l.present) === 0,
      ).length;
      const ab = loggedAbsent + noLogEmps;

      const avg = ls.length
        ? (
            ls.reduce((s, l) => s + (l.hoursWorked || 0), 0) / ls.length
          ).toFixed(1)
        : 0;

      // ORDER: [dept, total, present, halfPresent, weeklyOff, absent, avgHours, rate]
      return [
        d,
        t,
        p,
        hp,
        wo,
        ab,
        avg,
        t ? Math.round((p / t) * 100) + "%" : "0%",
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
      html: `<h2 class="section-title"><i class="ph-fill ph-briefcase-metal"></i> Department Statistics</h2>
        <div class="charts-grid">${this._chartCard("ch-dept-bar", '<i class="ph-fill ph-chart-bar"></i>', "violet", "Present by Dept")}</div>
        ${this._tableHTML("tbl-dept", ["Dept", "Total", "Present", "Half Present", "Weekly Off", "Absent", "Avg Hours", "Rate"], rows, "dept-wise")}
        <div id="drilldown-table" style="margin-top:16px"></div>`,
      renderCharts: () => {
        Charts.stacked(
          "ch-dept-bar",
          depts,
          [
            { name: "Present", data: rows.map((r) => r[2]) },
            { name: "Half Present", data: rows.map((r) => r[3]) },
            { name: "Weekly Off", data: rows.map((r) => r[4]) },
            { name: "Absent", data: rows.map((r) => r[5]) },
          ],
          "Dept Attendance",
          (dept, index, seriesIndex, seriesName) => {
            const filteredLogs = logs.filter((l) => {
              const e = empMap[l.empId];
              if (!e) return false;
              if (e.dept !== dept) return false;

              switch (seriesName) {
                case "Present":
                  return (
                    l.status === "Present" ||
                    l.status === "Present On WeeklyOff"
                  );
                case "Half Present":
                  return (
                    l.status === "1/2Present" ||
                    l.status === "1/2Present On WeeklyOff"
                  );
                case "Weekly Off":
                  return l.status === "On WeeklyOff";
                case "Absent":
                  return l.status === "Absent";
                default:
                  return false;
              }
            });

            this._renderDrillDown(
              filteredLogs,
              `Dept: ${dept} - ${seriesName}`,
              empMap,
            );
          },
          true, // 👈 horizontal = true
        );
      },
    };
  }

  _renderGenderWise(logs, emps, empMap, model) {
    const genders = ["Male", "Female"];
    const eBG = model.groupBy(emps, (e) => e.gender);
    const rows = genders.map((g) => {
      const t = (eBG[g] || []).length,
        ls = logs.filter((l) => (empMap[l.empId] || {}).gender === g);
      const p = new Set(ls.filter((l) => l.present === 1).map((l) => l.empId))
        .size;
      return [g, t, p, t - p, t ? Math.round((p / t) * 100) + "%" : "0%"];
    });
    return {
      html: `<h2 class="section-title"><i class="ph-fill ph-gender-intersex"></i> Gender Split</h2>${this._tableHTML("tbl-gen", ["Gender", "Total", "Present", "Absent", "Rate"], rows, "gender-wise")}`,
      renderCharts: () => {},
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
      html: `<h2 class="section-title"><i class="ph-fill ph-clock"></i> Late/Early</h2>${this._tableHTML("tbl-le", ["Name", "Dept", "Date", "In", "Out", "Late", "Early"], rows, "late-early")}`,
      renderCharts: () => {},
    };
  }

  _renderNightShift(logs, emps, empMap) {
    // const filtered = logs.filter(l => (empMap[l.empId] || {}).shift === 'Night');
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
      html: `<h2 class="section-title"><i class="ph-fill ph-moon"></i> Night Shift</h2>${this._tableHTML("tbl-ns", ["Name", "Dept", "Date", "In", "Out", "Hours", "Status"], rows, "night-shift")}`,
      renderCharts: () => {},
    };
  }

  _renderDesignationWise(logs, emps, empMap, model) {
    const desigs = [
      ...new Set(emps.map((e) => e.designation || "Staff")),
    ].sort();
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
      html: `<h2 class="section-title"><i class="ph-fill ph-identification-badge"></i> Designation Statistics</h2>
					<div class="charts-grid">
						${this._chartCard("ch-desig-bar", '<i class="ph-fill ph-chart-bar"></i>', "teal", "Present by Designation", "Click for detail")}
					</div>
					${this._tableHTML("tbl-desig", ["Designation", "Total", "Present", "Absent", "Rate"], rows, "designation-wise")}
					<div id="drilldown-table" style="margin-top:16px"></div>`,

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
            const filteredLogs = logs.filter((l) => {
              const e = empMap[l.empId];
              if (!e) {
                return false;
              }
              if (e.shift !== shiftName) {
                return false;
              }

              switch (seriesName) {
                case "Present":
                  return (
                    l.status === "Present" ||
                    l.status === "Present On WeeklyOff"
                  );

                case "Half Present":
                  return (
                    l.status === "1/2Present" ||
                    l.status === "1/2Present On WeeklyOff"
                  );

                case "Weekly Off":
                  return l.status === "On WeeklyOff";

                case "Absent":
                  return l.status === "Absent";

                default:
                  return false;
              }
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

  _renderSpecial(logs, emps, empMap, filters, model) {
    const noPunch = model.findNoPunchEmployees();
    const singlePunch = logs.filter((l) => l.status === "Single Punch");
    const npRows = noPunch.map((x) => [
      x.emp.name,
      x.emp.dept,
      x.maxGap,
      x.gapStart,
    ]);
    const spRows = singlePunch.slice(0, 100).map((l) => {
      const e = empMap[l.empId] || {};
      return [e.name, e.dept, l.date, l.inTime];
    });
    return {
      html: `<h2 class="section-title"><i class="ph-fill ph-warning-circle"></i> Critical Alerts</h2><div class="table-wrap" style="margin-bottom:20px"><div class="table-header"><h3>🚩 No Punch ≥ 5 Days</h3></div><table class="data-table"><thead><tr><th>Name</th><th>Dept</th><th>Gap</th><th>Start</th></tr></thead><tbody>${npRows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("") || '<tr><td colspan="4">None</td></tr>'}</tbody></table></div><div class="table-wrap"><div class="table-header"><h3>⚡ Single Punch</h3></div><table class="data-table"><thead><tr><th>Name</th><th>Dept</th><th>Date</th><th>Time</th></tr></thead><tbody>${spRows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("") || '<tr><td colspan="4">None</td></tr>'}</tbody></table></div>`,
      renderCharts: () => {},
    };
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
}

window.AttendanceView = AttendanceView;
