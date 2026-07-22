class AttendanceView {
    constructor() {
        this.app = document.getElementById("app");
        this.app.addEventListener("click", (e) => this._handleDeptAccordionClick(e),);
        this.app.addEventListener("mousemove", (e) => this._handleDeptAccordionHover(e),);
        this.app.addEventListener("mouseleave", () => this._hideDeptAccTooltip(),);
        this.TABS = [
            { id: "feature", label: "Dashboard", icon: "ph-house" },
            { id: "all", label: "Attendance Logs", icon: "ph-list-dashes" },
            { id: "age", label: "Age Analysis", icon: "ph-user-circle" },
            { id: "company", label: "Company Stats", icon: "ph-buildings" },
            { id: "dept", label: "Department Stats", icon: "ph-briefcase" },
            { id: "gender", label: "Gender Split", icon: "ph-gender-intersex" },
            { id: "latein", label: "Late In", icon: "ph-clock-afternoon" },
            { id: "earlyout", label: "Early Out", icon: "ph-sign-out" },
            { id: "night", label: "Night Shift", icon: "ph-moon" },
            { id: "designation", label: "Designation Stats", icon: "ph-identification-badge", },
            { id: "shift", label: "Shift Stats", icon: "ph-clock-clockwise" },
            { id: "manual_punch", label: "Manual Punches", icon: "ph-pencil-simple" },
            { id: "staff", label: "Staff", icon: "ph-identification-badge" },
            { id: "worker", label: "Workmen", icon: "ph-hard-hat" },
            { id: "resigned", label: "Resigned Employees", icon: "ph-user-minus", },
            { id: "newjoined", label: "New Joined", icon: "ph-user-plus" },
            { id: "overtime", label: "Overtime", icon: "ph-hourglass-high" },
            { id: "special", label: "Critical Alerts", icon: "ph-warning-circle", },
            { id: "data_quality", label: "Employee Data Alerts", icon: "ph-database", },
            { id: "designation_order", label: "Designations Order", icon: "ph-sliders", },
            { id: "designation_families", label: "Designation Families", icon: "ph-cards", },
            { id: "sort_order", label: "Sort Order Settings", icon: "ph-sort-ascending", },
        ];

        this._lastData = {};
        this._renderToken = 0;
        this.LATE_THRESHOLD = 3;
    }


    render(state, model) {
        this._renderToken++;
        const myToken = this._renderToken;

        if (window.Charts && typeof Charts.destroyAll === "function") {
            Charts.destroyAll();
        }

        let stats = model.getSummaryStats();

        if (state.activeTab === "night") {
            stats = model.getNightShiftStats();
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
						${state.activeTab !== "feature" ? this._renderFilters(state.filters, filterOpts) : ""}
                        ${
                            state.activeTab === "designation"
                                ? this._renderDesignationFamilySummaryCards(emps, stats, model, logs, empMap) : state.activeTab === "age"
                                ? this._renderAgeSummaryCards(emps, stats, model, logs, empMap) : state.activeTab === "company"
                                ? this._renderCompanySummaryCards(emps, stats, model, logs, empMap) : state.activeTab === "dept"
                                ? this._renderDeptSummaryCards(emps, stats, model, logs, empMap) : state.activeTab === "gender"
                                ? this._renderGenderSummaryCards(emps, stats, model, logs, empMap) : state.activeTab === "latein"
                                ? this._renderLateInSummaryCards(emps, stats, model, logs, empMap) : state.activeTab === "earlyout"
                                ? this._renderEarlyOutSummaryCards(emps, stats, model, logs, empMap) : state.activeTab === "shift"
                                ? this._renderShiftSummaryCards(emps, stats, model, logs, empMap) : state.activeTab === "manual_punch"
                                ? this._renderManualPunchSummaryCards(emps, stats, model, logs, empMap) : state.activeTab === "night"
                                ? this._renderNightSummaryCards(emps, stats, model, logs, empMap) : state.activeTab === "staff"
                                ? this._renderStaffSummaryCards(emps, stats, model, logs, empMap) : state.activeTab === "worker"
                                ? this._renderWorkerSummaryCards(emps, stats, model, logs, empMap) : state.activeTab === "resigned"
                                ? this._renderResignedSummaryCards(emps, stats, model, logs, empMap) : state.activeTab === "newjoined"
                                ? this._renderNewJoinedSummaryCards(emps, stats, model, logs, empMap) : state.activeTab === "special"
                                ? "" : state.activeTab === "data_quality"
                                ? "" : state.activeTab === "designation_order"
                                ? "" : state.activeTab === "sort_order"
                                ? "" : state.activeTab === "designation_families"
                                ? "" : state.activeTab === "overtime"
                                ? "" : state.activeTab === "feature"
                                ? this._renderDashboardSummaryCards(emps, stats, model, logs, empMap) : this._renderSummaryCards(stats, emps, logs, empMap, model)
                        }
						
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
        this._initChartRendering(state.activeTab, logs, emps, empMap, state.filters, state.data.counts, model, myToken);
        this._scrollActiveSidebarItem();
    }


    _handleDeptAccordionClick(e) {
        const seg = e.target.closest(".dept-acc-seg");
        if (seg) {
            e.stopPropagation();
            const data = this._currentDeptData;
            if (!data) return;
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
                scopedEmps = data.emps.filter((emp) => emp.dept === dept && (emp.designation || "Staff") === designation);
                title = `Dept: ${dept} - ${designation} - ${status}`;
            } else {
                scopedEmps = data.emps.filter((emp) => emp.dept === dept);
                title = `Dept: ${dept} - ${status}`;
            }

            const dayLogs = this._buildEmployeeDayLogs(scopedEmps, data.logs, dateFrom, dateTo);
            const filteredLogs = dayLogs.filter((l) => this._matchesStatus(l, status));
            this._renderDrillDown(filteredLogs, title, data.empMap);
            return;
        }

        const header = e.target.closest(".dept-acc-header");
        if (header) {
            const row = header.closest(".dept-acc-row");
            const expandEl = row ? row.querySelector(".dept-acc-expand") : null;
            if (!expandEl) return;
            const dept = header.dataset.dept;
            const data = this._currentDeptData;
            if (!data) return;
            this._toggleDeptAccordionEl(expandEl, dept, data.emps, data.logs, data.model);
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
            woPresent: target.dataset.wopresent || 0,
            woHalfPresent: target.dataset.wohalfpresent || 0,
            weeklyOff: target.dataset.weeklyoff || 0,
            singlePunch: target.dataset.single || 0,
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
            tip.style.fontFamily = "'Plus Jakarta Sans','Inter','Segoe UI',sans-serif";
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
				<span style="width:8px;height:8px;border-radius:50%;background:#8b5cf6;display:inline-block;"></span> WO Present: 
				<b style="margin-left:auto;">${stats.woPresent}</b>
			</div>
			
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
				<span style="width:8px;height:8px;border-radius:50%;background:#eab308;display:inline-block;"></span> WO Half Present: 
				<b style="margin-left:auto;">${stats.woHalfPresent}</b>
			</div>
			
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                <span style="width:8px;height:8px;border-radius:50%;background:#3b82f6;display:inline-block;"></span> Weekly Off: 
                <b style="margin-left:auto;">${stats.weeklyOff}</b>
            </div>
            
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                <span style="width:8px;height:8px;border-radius:50%;background:#8B4513;display:inline-block;"></span> Single Punch: 
                <b style="margin-left:auto;">${stats.singlePunch}</b>
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
        if (tip) tip.style.display = "none";
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
					${this.TABS.map((tab) => `
						<button class="nav-item ${activeTab === tab.id ? "active" : ""}" data-tab="${tab.id}">
							<i class="ph ${tab.icon}"></i>
							<span>${tab.label}</span>
						</button>
					`,).join("")}
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
    

    _scrollActiveSidebarItem() {
        const activeItem = document.querySelector(".sidebar-nav .nav-item.active");
        if (!activeItem) return;
        activeItem.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }

    
    _renderTopbar(state) {
        const user = window.HRMS_USER || {};
        const displayName = user.name || user.username || "Admin User";
        const initials = displayName.split(" ").map((w) => w[0]).join("").substring(0, 2).toUpperCase();

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
            return ('<option value="All">All</option>' + arr.map((v) => `<option value="${v}">${v}</option>`).join(""));
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
                    <div class="filter-field">
                        <label>Location</label>
                        <select id="f-location">${selectOpts(opts.locations || [])}</select>
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


    _renderSummaryCards(stats, emps, logs, empMap, model) {
        const staffWorkerStats = this._staffWorkerStats || {};
        let totalPresentHalf = stats.total;

        if (emps && logs && empMap && model) {
            const { dateFrom, dateTo } = model.state.filters;
            const dayLogs = this._buildEmployeeDayLogs(emps, logs, dateFrom, dateTo);
            const staffTeamId = model.state.teamConfig?.staffTeamId ?? 7;
            const workerTeamId = model.state.teamConfig?.workerTeamId ?? 6;
            const staffEmps = emps.filter((e) => e.team === staffTeamId);
            const workerEmps = emps.filter((e) => e.team === workerTeamId);

            this._currentStaffSummaryData = { emps: staffEmps, model, dayLogs, empMap, isDashboard: false, };
            this._currentWorkerSummaryData = { emps: workerEmps, model, dayLogs, empMap, isDashboard: false, };

            let staffPresent = 0, staffHalf = 0, workerPresent = 0, workerHalf = 0; totalPresentHalf = 0;

            dayLogs.forEach((l) => {
                const e = empMap[l.empId];
                if (!e) return;
                const isPresent = this._matchesStatus(l, "Present") || this._matchesStatus(l, "WO Present");
                const isHalf = this._matchesStatus(l, "Half Present") || this._matchesStatus(l, "WO Half Present");

                if (e.team === staffTeamId) {
                    if (isPresent) staffPresent++;
                    if (isHalf) staffHalf++;
                }
                if (e.team === workerTeamId) {
                    if (isPresent) workerPresent++;
                    if (isHalf) workerHalf++;
                }
            });

            staffWorkerStats.staffPresent = staffPresent;
            staffWorkerStats.staffHalfPresent = staffHalf;
            staffWorkerStats.workerPresent = workerPresent;
            staffWorkerStats.workerHalfPresent = workerHalf;
        }

        const cards = [
            { key: "totalHeadcount", label: "TotalHeadcount", val: emps.length, icon: "ph-users", cls: "", },
            { key: "present", label: "Present", val: stats.present, icon: "ph-check-circle", cls: "success", },
            { key: "halfPresent", label: "Half Day", val: stats.halfPresent ?? 0, icon: "ph-circle-half", cls: "warning", },
            { key: "absent", label: "Absent", val: stats.absent, icon: "ph-x-circle", cls: "danger", },
            { key: "weeklyOff", label: "Weekly Off", val: stats.weeklyOff ?? 0, icon: "ph-calendar-x", cls: "info", },
            { key: "weeklyOffPresent", label: "WO Present", val: stats.weeklyOffPresent ?? 0, icon: "ph-calendar-check", cls: "success", },
            { key: "weeklyOffHalfPresent", label: "WO Half Present", val: stats.weeklyOffHalfPresent ?? 0, icon: "ph-calendar-check", cls: "warning", },
            { key: "singlePunch", label: "Single Punch", val: stats.singlePunch, icon: "ph-lightning", cls: "warning", },
            { key: "manualPunch", label: "Manual Punch", val: model.getManualPunchEmployees().length, icon: "ph-pencil-simple", cls: "warning", },
            { key: "lateIn", label: "Late In", val: stats.lateIn, icon: "ph-clock-afternoon", cls: "info", },
            { key: "earlyOut", label: "Early Out", val: stats.earlyOut, icon: "ph-sign-out", cls: "accent", },
            { key: null, label: "Avg Hours", val: stats.avgHours + "h", icon: "ph-timer", cls: "", },
            { key: "staffList", label: "Staff Present", val: (staffWorkerStats.staffPresent || 0) + (staffWorkerStats.staffHalfPresent || 0) + (staffWorkerStats.staffWeeklyOffPresent || 0) + (staffWorkerStats.staffWeeklyOffHalfPresent || 0), icon: "ph-identification-badge", cls: "info", },
            { key: "workerList", label: "Workmen Present", val: (staffWorkerStats.workerPresent || 0) + (staffWorkerStats.workerHalfPresent || 0) + (staffWorkerStats.workerWeeklyOffPresent || 0) + (staffWorkerStats.workerWeeklyOffHalfPresent || 0), icon: "ph-hard-hat", cls: "warning", },
            { key: "newJoined", label: "New Join", val: stats.newJoined || 0, icon: "ph-user-plus", cls: "success", },
            { key: "resigned", label: "Resigned", val: stats.resigned || 0, icon: "ph-user-minus", cls: "danger", },
        ];

        return `
            <div class="summary-grid">
                ${cards.map((c) => `
                    <div class="stat-card ${c.cls} ${c.key ? "stat-card-clickable" : ""}"
                        ${c.key ? `data-card-key="${c.key}"` : ""}>
                        <div class="stat-icon"><i class="ph ${c.icon}"></i></div>
                        <div class="stat-content">
                            <span class="stat-label">${c.label}</span>
                            <span class="stat-value">${c.val}</span>
                            ${c.key ? '<span class="stat-card-hint">↓ click to view</span>' : ""}
                        </div>
                    </div>
                `,).join("")}
            </div>
        `;
    }


    _renderDashboardSummaryCards(emps, stats, model, logs, empMap) {
        const { dateFrom, dateTo } = model.state.filters;
        const dayLogs = this._buildEmployeeDayLogs(emps, logs, dateFrom, dateTo);
        const staffWorkerStats = this._staffWorkerStats || {};
        const staffTeamId = model.state.teamConfig?.staffTeamId ?? 7;
        const workerTeamId = model.state.teamConfig?.workerTeamId ?? 6;

        const sectionLabel = (text) => `
            <div style="
                font-size:13px;font-weight:600;text-transform:uppercase;
                letter-spacing:0.06em;color:#334155;margin:24px 0 12px;
                display:flex;align-items:center;gap:8px;
            ">
                ${text}
                <span style="
                    flex:1;
                    height:1px;
                    background:#64748b;
                    display:block;
                    border-radius:2px;
                "></span>
            </div>
        `;

        this._currentStaffSummaryData = {
            emps: emps.filter((e) => e.team === staffTeamId),
            model,
            dayLogs,
            empMap,
            isDashboard: true,
        };
        this._currentWorkerSummaryData = {
            emps: emps.filter((e) => e.team === workerTeamId),
            model,
            dayLogs,
            empMap,
            isDashboard: true,
        };
        this._currentUnassignedSummaryData = {
            emps: emps.filter(e => e.team !== staffTeamId && e.team !== workerTeamId),
            model,
            dayLogs,
            empMap,
            isDashboard: true,
        };

        // --- Designation Family cards (headcount-based, not attendance-based) ---
        const dashFamilies = model.state.data.designationFamilies || [];
        const dashFamMap = model.state.data.designationToFamilyMap || {};

        this._currentDashboardFamilyData = {
            emps,
            model,
            empMap,
            famMap: dashFamMap,
            families: dashFamilies,
            isDashboard: true,
        };

        const famColorCls = ["info", "success", "warning", "accent", "danger"];
        const famCounts = {};
        dashFamilies.forEach((f) => (famCounts[f.id] = 0));
        emps.forEach((e) => {
            const famInfo = dashFamMap[e.designationId];
            if (famInfo && famCounts[famInfo.familyId] !== undefined) {
                famCounts[famInfo.familyId]++;
            }
        });

        const familyCardsHtml = dashFamilies.map((f, i) => `
            <div class="stat-card ${famColorCls[i % famColorCls.length]} stat-card-clickable"
                data-dashboard-family-id="${f.id}"
                onclick="AppController.view._showDashboardFamilyDrilldown(${f.id})">
                <div class="stat-icon"><i class="ph ph-cards"></i></div>
                <div class="stat-content">
                    <span class="stat-label">${this._escapeAttr(f.name)}</span>
                    <span class="stat-value">${famCounts[f.id]}</span>
                    <span class="stat-card-hint">↓ click to view</span>
                </div>
            </div>
        `).join("");

        // --- Headcount: Required / Available / Gap ---
        const requiredCount = model.getRequiredHeadcount();
        const availableCount = stats.total;
        const gapCount = model.getGapHeadcount();

        const headcountCard = `
            <div class="stat-card info stat-card-clickable"
                data-headcount="required"
                onclick="AppController.view._showHeadcountBreakdownDrilldown('required')">
                <div class="stat-icon"><i class="ph ph-target"></i></div>
                <div class="stat-content">
                    <span class="stat-label">Required</span>
                    <span class="stat-value">${requiredCount}</span>
                    <span class="stat-card-hint">↓ click to view</span>
                </div>
            </div>
            <div class="stat-card success stat-card-clickable" data-card-key="totalHeadcount">
                <div class="stat-icon"><i class="ph ph-users"></i></div>
                <div class="stat-content">
                    <span class="stat-label">Available</span>
                    <span class="stat-value">${availableCount}</span>
                    <span class="stat-card-hint">↓ click to view</span>
                </div>
            </div>
            <div class="stat-card ${gapCount > 0 ? "danger" : "success"} stat-card-clickable"
                data-headcount="gap"
                onclick="AppController.view._showHeadcountBreakdownDrilldown('gap')">
                <div class="stat-icon"><i class="ph ${gapCount > 0 ? "ph-warning" : "ph-check-circle"}"></i></div>
                <div class="stat-content">
                    <span class="stat-label">Gap</span>
                    <span class="stat-value">${gapCount}</span>
                    <span class="stat-card-hint">↓ click to view</span>
                </div>
            </div>
        `;

        this._currentCompanyData = { emps, model, dayLogs, empMap, isDashboard: true, };

        const categoryOrder = ["ON-ROLL", "CC", "CONTRACTOR"];
        const categoryLabels = {
            "ON-ROLL": "ON-ROLL",
            "CC": "COMPANY CONTRACT (CC)",
            "CONTRACTOR": "CONTRACTOR",
        };
        const compColorCls = ["info", "success", "warning", "accent", "danger"];

        const mergeCat = (rawCat) => {
            const c = rawCat || "OTHER";
            return (c === "OUTSOURCE" || c === "OTHER") ? "CONTRACTOR" : c;
        };

        const companiesByCategory = {};
        emps.forEach((e) => {
            const cat = mergeCat(e.companyCategory);
            if (!companiesByCategory[cat]) companiesByCategory[cat] = {};
            if (!companiesByCategory[cat][e.company]) companiesByCategory[cat][e.company] = 0;
            companiesByCategory[cat][e.company]++;
        });

        const catCardsHtml = categoryOrder.map((cat, i) => {
            const companiesInCat = companiesByCategory[cat] || {};
            const companyNames = Object.keys(companiesInCat);
            const totalCount = companyNames.reduce((sum, c) => sum + companiesInCat[c], 0);
            const catLabel = categoryLabels[cat] || cat;

            const topLabel = `
                <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.05em;color:#475569;margin-bottom:8px;">
                    ${catLabel}
                </div>
            `;

            if (companyNames.length === 0) {
                return `
                    <div class="stat-card ${compColorCls[i % compColorCls.length]}">
                        ${topLabel}
                        <div class="stat-icon"><i class="ph ph-buildings"></i></div>
                        <div class="stat-content">
                            <span class="stat-label">Total Companies</span>
                            <span class="stat-value">0</span>
                        </div>
                    </div>
                `;
            }

            return `
                <div class="stat-card ${compColorCls[i % compColorCls.length]} stat-card-clickable"
                    data-company-category="${cat}"
                    onclick="AppController.view._showCompanyCategoryDrilldown('${cat}')">
                    ${topLabel}
                    <div class="stat-icon"><i class="ph ph-buildings"></i></div>
                    <div class="stat-content">
                        ${companyNames.length === 1
                            ? `<span class="stat-label">${this._escapeAttr(companyNames[0])}</span><span class="stat-value">${totalCount}</span>`
                            : `<span class="stat-label">Total Headcount</span><span class="stat-value">${totalCount}</span><span class="stat-card-sub">(${companyNames.length} Companies)</span>`
                        }
                    </div>
                </div>
            `;
        }).join("");

        const companySectionsHtml = `
            <div class="summary-grid" style="grid-template-columns: repeat(3, minmax(0,1fr));">
                ${catCardsHtml}
            </div>
        `;

        // --- Gender ---
        this._currentGenderSummaryData = { emps, model, dayLogs, empMap, isDashboard: true, };
        const genderCounts = { Male: 0, Female: 0 };
        emps.forEach((e) => {
            if (genderCounts[e.gender] !== undefined) genderCounts[e.gender]++;
        });

        const genderCards = `
            <div class="stat-card info stat-card-clickable"
                data-gender="Male"
                onclick="AppController.view._showGenderSummaryDrilldown('Male')">
                <div class="stat-icon"><i class="ph ph-gender-male"></i></div>
                <div class="stat-content">
                    <span class="stat-label">Male</span>
                    <span class="stat-value">${genderCounts.Male}</span>
                    <span class="stat-card-hint">↓ click to view</span>
                </div>
            </div>
            <div class="stat-card accent stat-card-clickable"
                data-gender="Female"
                onclick="AppController.view._showGenderSummaryDrilldown('Female')">
                <div class="stat-icon"><i class="ph ph-gender-female"></i></div>
                <div class="stat-content">
                    <span class="stat-label">Female</span>
                    <span class="stat-value">${genderCounts.Female}</span>
                    <span class="stat-card-hint">↓ click to view</span>
                </div>
            </div>
        `;

        const staffTotal = staffWorkerStats.staffTotal || 0;
        const workerTotal = staffWorkerStats.workerTotal || 0;
        const unassignedTotal = availableCount - staffTotal - workerTotal;

        // --- Staff / Workmen ---
        const swCards = `
            <div class="stat-card info stat-card-clickable" data-card-key="staffList">
                <div class="stat-icon"><i class="ph ph-identification-badge"></i></div>
                <div class="stat-content">
                    <span class="stat-label">Staff</span>
                    <span class="stat-value">${staffWorkerStats.staffTotal || 0}</span>
                    <span class="stat-card-hint">↓ click to view</span>
                </div>
            </div>
            <div class="stat-card warning stat-card-clickable" data-card-key="workerList">
                <div class="stat-icon"><i class="ph ph-hard-hat"></i></div>
                <div class="stat-content">
                    <span class="stat-label">Workmen</span>
                    <span class="stat-value">${staffWorkerStats.workerTotal || 0}</span>
                    <span class="stat-card-hint">↓ click to view</span>
                </div>
            </div>
            <div class="stat-card danger stat-card-clickable"
                data-card-key="unassignedList">
                <div class="stat-icon">
                    <i class="ph ph-warning-circle"></i>
                </div>
                <div class="stat-content">
                    <span class="stat-label">Unassigned</span>
                    <span class="stat-value">${unassignedTotal}</span>
                    <span class="stat-card-hint">↓ click to view</span>
                </div>
            </div>
        `;

        // --- Age cards ---
        this._currentAgeData = { emps, model, dayLogs, empMap, isDashboard: true, };
        const ageGroups = ["Under 18", "Under 25", "25–34", "35–44", "45–54", "55–59", "60+"];
        const ageGroupIcons = {
            "Under 18": "child_care",
            "Under 25": "school",
            "25–34": "person",
            "35–44": "badge",
            "45–54": "supervisor_account",
            "55–59": "workspace_premium",
            "60+": "elderly",
        };
        const ageGroupCls = {
            "Under 18": "info",
            "Under 25": "info",
            "25–34": "success",
            "35–44": "warning",
            "45–54": "accent",
            "55–59": "danger",
            "60+": "accent",
        };
        const ageCounts = {};
        ageGroups.forEach((g) => (ageCounts[g] = 0));
        emps.forEach((e) => {
            const g = model.getAgeGroup(e.dob);
            if (ageCounts[g] !== undefined) ageCounts[g]++;
        });
        const ageCards = ageGroups.map((g) => `
            <div class="stat-card ${ageGroupCls[g]} stat-card-clickable"
                data-age-group="${this._escapeAttr(g)}"
                onclick="AppController.view._showAgeGroupDrilldown('${this._escapeAttr(g)}')">
                <div class="stat-icon">
                    <span class="material-symbols-outlined">
                        ${ageGroupIcons[g]}
                    </span>
                </div>
                <div class="stat-content">
                    <span class="stat-label">${g}</span>
                    <span class="stat-value">${ageCounts[g]}</span>
                    <span class="stat-card-hint">↓ click to view</span>
                </div>
            </div>
        `,).join("");

        // --- Department cards ---
        this._currentDashboardDeptData = { emps, model, dayLogs, empMap, isDashboard: true, };
        const dashDepts = [...new Set(emps.map((e) => e.dept))];
        const dashDeptCounts = {};
        dashDepts.forEach((d) => (dashDeptCounts[d] = 0));
        emps.forEach((e) => {
            if (dashDeptCounts[e.dept] !== undefined) dashDeptCounts[e.dept]++;
        });
        const dashDeptColorCls = ["info", "success", "warning", "accent", "danger"];
        const dashDeptCards = dashDepts.map((d, i) => `
            <div class="stat-card ${dashDeptColorCls[i % dashDeptColorCls.length]} stat-card-clickable"
                data-dashboard-dept="${this._escapeAttr(d)}"
                onclick="AppController.view._showDashboardDeptDrilldown('${this._escapeAttr(d)}')">
                <div class="stat-icon"><i class="ph ph-briefcase"></i></div>
                <div class="stat-content">
                    <span class="stat-label">${d}</span>
                    <span class="stat-value">${dashDeptCounts[d]}</span>
                    <span class="stat-card-hint">↓ click to view</span>
                </div>
            </div>
        `,).join("");

        return `
            <div style="margin-bottom:28px;">
                ${sectionLabel("Overview")}
                <div class="summary-grid" style="grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));">
                    ${headcountCard}
                </div>

                ${sectionLabel("By Companies")}
                ${companySectionsHtml}
                <div id="dashboard-company-category-drilldown" style="margin-top:8px;"></div>

                ${sectionLabel("Gender & Workforce Type")}
                <div class="summary-grid" style="grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));">
                    ${genderCards}
                    ${swCards}
                </div>

                ${sectionLabel("By Age Group")}
                <div class="summary-grid" style="grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));">
                    ${ageCards}
                </div>

                ${sectionLabel("By Department")}
                <div class="summary-grid" style="grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));">
                    ${dashDeptCards}
                </div>
                <div id="dashboard-dept-drilldown" style="margin-top:8px;"></div>

                ${dashFamilies.length ? `
                    ${sectionLabel("By Designation Family")}
                    <div class="summary-grid" style="grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));">
                        ${familyCardsHtml}
                    </div>
                ` : ""}
            </div>
        `;
    }


    _renderAgeSummaryCards(emps, stats, model, logs, empMap) {
        const groups = ["Under 18", "Under 25", "25–34", "35–44", "45–54", "55–59", "60+"];
        const ageGroupIcons = {
            "Under 18": "child_care",
            "Under 25": "school",
            "25–34": "person",
            "35–44": "badge",
            "45–54": "supervisor_account",
            "55–59": "workspace_premium",
            "60+": "elderly",
        };
        const groupCls = {
            "Under 18": "info",
            "Under 25": "info",
            "25–34": "success",
            "35–44": "warning",
            "45–54": "accent",
            "55–59": "danger",
            "60+": "accent",
        };

        const { dateFrom, dateTo } = model.state.filters;
        const dayLogs = this._buildEmployeeDayLogs(emps, logs, dateFrom, dateTo);

        console.log("========== AGE DEBUG ==========");
        console.log("Employees :", emps.length);
        console.log("Raw Logs :", logs.length);
        console.log("Day Logs :", dayLogs.length);

        const uniqueEmpDate = new Set(
            dayLogs.map(l => `${l.empId}_${l.date}`)
        );

        console.log("Unique Employee-Date :", uniqueEmpDate.size);
        console.log("Duplicate Employee-Date :", dayLogs.length - uniqueEmpDate.size);

        this._currentAgeData = { emps, model, dayLogs, empMap };

        this._currentTabPresentHeadcountItems = dayLogs.filter((l) =>
            this._matchesStatus(l, "Present") ||
            this._matchesStatus(l, "Half Present") ||
            this._matchesStatus(l, "WO Present") ||
            this._matchesStatus(l, "WO Half Present") ||
            this._matchesStatus(l, "Single Punch")
        ).map((l) => ({
            log: l,
            emp: empMap[l.empId],
            date: l.date
        }));

        const counts = {};
        groups.forEach((g) => (counts[g] = 0));

        const debugStatusCounts = {
            present: 0,
            halfPresent: 0,
            woPresent: 0,
            woHalfPresent: 0,
            weeklyOff: 0,
            absent: 0
        };

        dayLogs.forEach((l) => {
            const e = empMap[l.empId];
            if (!e) return;

            if (this._matchesStatus(l, "Present")) {
                debugStatusCounts.present++;
            } else if (this._matchesStatus(l, "Half Present")) {
                debugStatusCounts.halfPresent++;
            } else if (this._matchesStatus(l, "WO Present")) {
                debugStatusCounts.woPresent++;
            } else if (this._matchesStatus(l, "WO Half Present")) {
                debugStatusCounts.woHalfPresent++;
            } else if (this._matchesStatus(l, "Weekly Off")) {
                debugStatusCounts.weeklyOff++;
            } else {
                debugStatusCounts.absent++;
            }

            const isPresentOrHalf = this._matchesStatus(l, "Present") || this._matchesStatus(l, "Half Present") || this._matchesStatus(l, "WO Present") || this._matchesStatus(l, "WO Half Present") || this._matchesStatus(l, "Single Punch");

            if (!isPresentOrHalf) return;

            const g = model.getAgeGroup(e.dob);

            if (counts[g] !== undefined) counts[g]++;
        });

        console.table(debugStatusCounts);

        console.log(
            "Status Total :",
            debugStatusCounts.present +
            debugStatusCounts.halfPresent +
            debugStatusCounts.woPresent +
            debugStatusCounts.woHalfPresent +
            debugStatusCounts.weeklyOff +
            debugStatusCounts.absent
        );

        const totalPresentHalf = groups.reduce((sum, g) => sum + counts[g], 0);

        const cards = [
            { key: "presentHeadcount", label: "Total Presentcount", val: totalPresentHalf, icon: "ph-users", cls: "", ageGroup: null, },
            ...groups.map((g) => ({ key: "ageGroup", label: g, val: counts[g], icon: ageGroupIcons[g], cls: groupCls[g], ageGroup: g, })),
            { key: null, label: "Avg Hours", val: stats.avgHours + "h", icon: "ph-timer", cls: "", ageGroup: null, },
        ];

        return `
            <div class="summary-grid">
                ${cards.map((c) => `
                    <div class="stat-card ${c.cls} ${c.key ? "stat-card-clickable" : ""}"
                        style="flex-direction:column; align-items:center; text-align:center;"
                        ${c.key === "presentHeadcount" ? `data-card-key="presentHeadcount" onclick="AppController.view._showPresentHeadcountDrilldown()"` : ""}
                        ${c.ageGroup ? `data-age-group="${this._escapeAttr(c.ageGroup)}" onclick="AppController.view._showAgeGroupDrilldown('${this._escapeAttr(c.ageGroup)}')"` : ""}>
                        <div class="stat-icon">
                            ${c.ageGroup ? `<span class="material-symbols-outlined">${c.icon}</span>` : `<i class="ph ${c.icon}"></i>`
            }
                        </div>
                        <div class="stat-content" style="align-items:center; text-align:center;">
                            <span class="stat-label">${c.label}</span>
                            <span class="stat-value">${c.val}</span>
                            ${c.key ? '<span class="stat-card-hint">↓ click to view</span>' : ""}
                        </div>
                    </div>
                `,).join("")}
            </div>
        `;
    }


    _renderDesignationFamilySummaryCards(emps, stats, model, logs, empMap) {
        const families = model.state.data.designationFamilies || [];
        const famMap = model.state.data.designationToFamilyMap || {};

        const { dateFrom, dateTo } = model.state.filters;
        const dayLogs = this._buildEmployeeDayLogs(emps, logs, dateFrom, dateTo);

        this._currentDesigFamilySummaryData = { emps, model, dayLogs, empMap, famMap, families };

        this._currentTabPresentHeadcountItems = dayLogs.filter((l) =>
            this._matchesStatus(l, "Present") ||
            this._matchesStatus(l, "Half Present") ||
            this._matchesStatus(l, "WO Present") ||
            this._matchesStatus(l, "WO Half Present") ||
            this._matchesStatus(l, "Single Punch")
        ).map((l) => ({
            log: l,
            emp: empMap[l.empId],
            date: l.date,
        }));

        const totalPresentHalf = (stats.present || 0) + (stats.halfPresent || 0) + (stats.weeklyOffPresent || 0) + (stats.weeklyOffHalfPresent || 0) + (stats.singlePunch || 0);

        if (!families.length) {
            return `
                <div class="summary-grid">
                    <div class="stat-card stat-card-clickable" data-card-key="presentHeadcount" onclick="AppController.view._showPresentHeadcountDrilldown()">
                        <div class="stat-icon"><i class="ph ph-users"></i></div>
                        <div class="stat-content">
                            <span class="stat-label">Total Presentcount</span>
                            <span class="stat-value">${totalPresentHalf}</span>
                            <span class="stat-card-hint">↓ click to view</span>
                        </div>
                    </div>
                </div>
                <p style="padding:16px;color:#94a3b8;">No designation families created yet. Go to "Designation Families" tab to create some.</p>
            `;
        }

        const colorCls = ["info", "success", "warning", "accent", "danger"];
        const counts = {};
        families.forEach((f) => (counts[f.id] = 0));

        dayLogs.forEach((l) => {
            const e = empMap[l.empId];
            if (!e) return;
            const isPresentOrHalf = this._matchesStatus(l, "Present") || this._matchesStatus(l, "Half Present") || this._matchesStatus(l, "WO Present") || this._matchesStatus(l, "WO Half Present") || this._matchesStatus(l, "Single Punch");
            if (!isPresentOrHalf) return;

            const famInfo = famMap[e.designationId];
            if (famInfo && counts[famInfo.familyId] !== undefined) {
                counts[famInfo.familyId]++;
            }
        });

        const cards = [
            { type: "headcount", label: "Total Presentcount", val: totalPresentHalf, icon: "ph-users", cls: "", },
            ...families.map((f, i) => ({ type: "family", label: f.name, val: counts[f.id], icon: "ph-cards", cls: colorCls[i % colorCls.length], familyId: f.id, })),
            { type: "avgHours", label: "Avg Hours", val: stats.avgHours + "h", icon: "ph-timer", cls: "", },
        ];

        return `
            <div class="summary-grid">
                ${cards.map((c) => {
            if (c.type === "family") {
                return `
                    <div class="stat-card ${c.cls} stat-card-clickable"
                        data-family-id="${c.familyId}"
                        onclick="AppController.view._showDesignationFamilyDrilldown(${c.familyId})">
                        <div class="stat-icon"><i class="ph ${c.icon}"></i></div>
                        <div class="stat-content">
                            <span class="stat-label">${c.label}</span>
                            <span class="stat-value">${c.val}</span>
                            <span class="stat-card-hint">↓ click to view</span>
                        </div>
                    </div>
                `;
            }
            if (c.type === "avgHours") {
                return `
                    <div class="stat-card">
                        <div class="stat-icon"><i class="ph ${c.icon}"></i></div>
                            <div class="stat-content">
                                <span class="stat-label">${c.label}</span>
                                <span class="stat-value">${c.val}</span>
                            </div>
                    </div>
                `;
            }
            return `
                <div class="stat-card ${c.cls} stat-card-clickable" data-card-key="presentHeadcount" onclick="AppController.view._showPresentHeadcountDrilldown()">
                    <div class="stat-icon"><i class="ph ${c.icon}"></i></div>
                        <div class="stat-content">
                            <span class="stat-label">${c.label}</span>
                            <span class="stat-value">${c.val}</span>
                            <span class="stat-card-hint">↓ click to view</span>
                        </div>
                </div>
            `;
        }).join("")}
            </div>
        `;
    }


    _renderCompanySummaryCards(emps, stats, model, logs, empMap) {
        const { dateFrom, dateTo } = model.state.filters;
        const dayLogs = this._buildEmployeeDayLogs(emps, logs, dateFrom, dateTo);
        this._currentCompanyData = { emps, model, dayLogs, empMap };

        const sectionLabel = (text) => `
            <div style="
                font-size:10px;font-weight:700;text-transform:uppercase;
                letter-spacing:0.08em;color:#9ca3af;margin:20px 0 10px;
                display:flex;align-items:center;gap:8px;
            ">
                ${text}
                <span style="flex:1;height:1px;background:#e5e7eb;display:block;"></span>
            </div>
        `;

        const colorCls = ["info", "success", "warning", "accent", "danger"];

        const counts = {};
        emps.forEach((e) => { if (counts[e.company] === undefined) counts[e.company] = 0; });
        dayLogs.forEach((l) => {
            const e = empMap[l.empId];
            if (!e) return;
            const isPresentOrHalf = this._matchesStatus(l, "Present") || this._matchesStatus(l, "Half Present") || this._matchesStatus(l, "WO Present") || this._matchesStatus(l, "WO Half Present") || this._matchesStatus(l, "Single Punch");
            if (!isPresentOrHalf) return;
            if (counts[e.company] !== undefined) counts[e.company]++;
        });

        const totalPresentHalf = (stats.present || 0) + (stats.halfPresent || 0) + (stats.weeklyOffPresent || 0) + (stats.weeklyOffHalfPresent || 0) + (stats.singlePunch || 0);

        this._currentTabPresentHeadcountItems = dayLogs.filter((l) =>
            this._matchesStatus(l, "Present") ||
            this._matchesStatus(l, "Half Present") ||
            this._matchesStatus(l, "WO Present") ||
            this._matchesStatus(l, "WO Half Present") ||
            this._matchesStatus(l, "Single Punch")
        ).map((l) => ({
            log: l,
            emp: empMap[l.empId],
            date: l.date
        }));

        const headcountCardHtml = `
            <div class="stat-card stat-card-clickable" data-card-key="presentHeadcount" onclick="AppController.view._showPresentHeadcountDrilldown()">
                <div class="stat-icon"><i class="ph ph-users"></i></div>
                <div class="stat-content">
                    <span class="stat-label">Total Presentcount</span>
                    <span class="stat-value">${totalPresentHalf}</span>
                    <span class="stat-card-hint">↓ click to view</span>
                </div>
            </div>
        `;

        const avgHoursCardHtml = `
            <div class="stat-card">
                <div class="stat-icon"><i class="ph ph-timer"></i></div>
                <div class="stat-content">
                    <span class="stat-label">Avg Hours</span>
                    <span class="stat-value">${stats.avgHours}h</span>
                </div>
            </div>
        `;

        this._currentCompanyData = { emps, model, dayLogs, empMap };

        const sectionLabelCS = (text) => `
            <div style="
                font-size:10px;font-weight:700;text-transform:uppercase;
                letter-spacing:0.08em;color:#9ca3af;margin:20px 0 10px;
                display:flex;align-items:center;gap:8px;
            ">
                ${text}
                <span style="flex:1;height:1px;background:#e5e7eb;display:block;"></span>
            </div>
        `;

        const categoryOrder = ["ON-ROLL", "CC", "CONTRACTOR"];
        const categoryLabels = {
            "ON-ROLL": "ON-ROLL",
            "CC": "COMPANY CONTRACT (CC)",
            "CONTRACTOR": "CONTRACTOR",
        };

        const mergeCat = (rawCat) => {
            const c = rawCat || "OTHER";
            return (c === "OUTSOURCE" || c === "OTHER") ? "CONTRACTOR" : c;
        };

        const companiesByCategory = {};
        emps.forEach((e) => {
            const cat = mergeCat(e.companyCategory);
            if (!companiesByCategory[cat]) companiesByCategory[cat] = new Set();
            companiesByCategory[cat].add(e.company);
        });

        const catCardsHtml = categoryOrder.map((cat, i) => {
            const companySet = companiesByCategory[cat];
            const companyNames = companySet ? [...companySet] : [];
            const catLabel = categoryLabels[cat] || cat;

            const topLabel = `
                <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#9ca3af;margin-bottom:8px;">
                    ${catLabel}
                </div>
            `;

            if (companyNames.length === 0) {
                return `
                    <div class="stat-card ${colorCls[i % colorCls.length]}">
                        ${topLabel}
                        <div class="stat-icon"><i class="ph ph-buildings"></i></div>
                        <div class="stat-content">
                            <span class="stat-label">Total Companies</span>
                            <span class="stat-value">0</span>
                        </div>
                    </div>
                `;
            }

            const catPresentTotal = companyNames.reduce((sum, c) => sum + (counts[c] || 0), 0);

            return `
                <div class="stat-card ${colorCls[i % colorCls.length]} stat-card-clickable"
                    data-company-category="${cat}"
                    onclick="AppController.view._showCompanyCategoryDrilldown('${cat}')">
                    ${topLabel}
                    <div class="stat-icon"><i class="ph ph-buildings"></i></div>
                    <div class="stat-content">
                        ${companyNames.length === 1
                            ? `<span class="stat-label">${this._escapeAttr(companyNames[0])}</span><span class="stat-value">${counts[companyNames[0]] || 0}</span>`
                            : `<span class="stat-label">Total Present</span><span class="stat-value">${catPresentTotal}</span><span class="stat-card-sub">(${companyNames.length} Companies)</span>`
                        }
                    </div>
                </div>
            `;
        }).join("");

        return `
            <div class="summary-grid" style="grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));">
                ${headcountCardHtml}
                ${catCardsHtml}
                ${avgHoursCardHtml}
            </div>
            <div id="company-category-drilldown" style="margin-top:8px;"></div>
        `;
    }


    _renderDeptSummaryCards(emps, stats, model, logs, empMap) {
        const { dateFrom, dateTo } = model.state.filters;
        const dayLogs = this._buildEmployeeDayLogs(emps, logs, dateFrom, dateTo);
        this._currentDeptSummaryData = { emps, model, dayLogs, empMap };

        const depts = [...new Set(emps.map((e) => e.dept))];
        const colorCls = ["info", "success", "warning", "accent", "danger"];

        const counts = {};
        depts.forEach((d) => (counts[d] = 0));

        dayLogs.forEach((l) => {
            const e = empMap[l.empId];
            if (!e) return;
            const isPresentOrHalf = this._matchesStatus(l, "Present") || this._matchesStatus(l, "Half Present") || this._matchesStatus(l, "WO Present") || this._matchesStatus(l, "WO Half Present") || this._matchesStatus(l, "Single Punch");
            if (!isPresentOrHalf) return;
            if (counts[e.dept] !== undefined) counts[e.dept]++;
        });

        // const totalPresentHalf = depts.reduce((sum, d) => sum + counts[d], 0);
        const totalPresentHalf = (stats.present || 0) + (stats.halfPresent || 0) + (stats.weeklyOffPresent || 0) + (stats.weeklyOffHalfPresent || 0) + (stats.singlePunch || 0);

        this._currentTabPresentHeadcountItems = dayLogs.filter((l) =>
            this._matchesStatus(l, "Present") ||
            this._matchesStatus(l, "Half Present") ||
            this._matchesStatus(l, "WO Present") ||
            this._matchesStatus(l, "WO Half Present") ||
            this._matchesStatus(l, "Single Punch")
        ).map((l) => ({
            log: l,
            emp: empMap[l.empId],
            date: l.date
        }));

        const cards = [
            { type: "headcount", label: "Total Presentcount", val: totalPresentHalf, icon: "ph-users", cls: "", },
            ...depts.map((d, i) => ({ type: "dept", label: d, val: counts[d], icon: "ph-briefcase", cls: colorCls[i % colorCls.length], dept: d, })),
            { type: "avgHours", label: "Avg Hours", val: stats.avgHours + "h", icon: "ph-timer", cls: "", },
        ];

        return `
            <div class="summary-grid">
                ${cards.map((c) => {
            if (c.type === "dept") {
                return `
                    <div class="stat-card ${c.cls} stat-card-clickable"
                        data-dept="${this._escapeAttr(c.dept)}"
                        onclick="AppController.view._showDeptSummaryDrilldown('${this._escapeAttr(c.dept)}')">
                        <div class="stat-icon"><i class="ph ${c.icon}"></i></div>
                        <div class="stat-content">
                            <span class="stat-label">${c.label}</span>
                            <span class="stat-value">${c.val}</span>
                            <span class="stat-card-hint">↓ click to view</span>
                        </div>
                    </div>
                `;
            }
            if (c.type === "avgHours") {
                return `
                    <div class="stat-card">
                        <div class="stat-icon"><i class="ph ${c.icon}"></i></div>
                        <div class="stat-content">
                            <span class="stat-label">${c.label}</span>
                            <span class="stat-value">${c.val}</span>
                        </div>
                    </div>
                `;
            }
            // headcount
            return `
                <div class="stat-card ${c.cls} stat-card-clickable" data-card-key="presentHeadcount" onclick="AppController.view._showPresentHeadcountDrilldown()">
                    <div class="stat-icon"><i class="ph ${c.icon}"></i></div>
                    <div class="stat-content">
                        <span class="stat-label">${c.label}</span>
                        <span class="stat-value">${c.val}</span>
                        <span class="stat-card-hint">↓ click to view</span>
                    </div>
                </div>
            `;
            }).join("")}
        </div>
    `;
}

    _renderGenderSummaryCards(emps, stats, model, logs, empMap) {
        const { dateFrom, dateTo } = model.state.filters;
        const dayLogs = this._buildEmployeeDayLogs(emps, logs, dateFrom, dateTo);
        this._currentGenderSummaryData = { emps, model, dayLogs, empMap, isDashboard: false, };

        const genders = ["Male", "Female"];
        const genderIcons = { Male: "ph-gender-male", Female: "ph-gender-female", };
        const genderCls = { Male: "info", Female: "accent" };

        const counts = {};
        genders.forEach((g) => (counts[g] = 0));
        dayLogs.forEach((l) => {
            const e = empMap[l.empId];
            if (!e) return;
            const isPresentOrHalf = this._matchesStatus(l, "Present") || this._matchesStatus(l, "Half Present") || this._matchesStatus(l, "WO Present") || this._matchesStatus(l, "WO Half Present") || this._matchesStatus(l, "Single Punch");
            if (!isPresentOrHalf) return;
            if (counts[e.gender] !== undefined) counts[e.gender]++;
        });

        this._currentTabPresentHeadcountItems = dayLogs.filter((l) => this._matchesStatus(l, "Present") || this._matchesStatus(l, "Half Present") || this._matchesStatus(l, "WO Present") || this._matchesStatus(l, "WO Half Present") || this._matchesStatus(l, "Single Punch"),).map((l) => ({ log: l, emp: empMap[l.empId], date: l.date }));
        
        const totalPresentHalf = (stats.present || 0) + (stats.halfPresent || 0) + (stats.weeklyOffPresent || 0) + (stats.weeklyOffHalfPresent || 0) + (stats.singlePunch || 0);

        const cards = [
            { type: "headcount", label: "Total Presentcount", val: totalPresentHalf, icon: "ph-users", cls: "", },
            ...genders.map((g) => ({ type: "gender", label: g, val: counts[g], icon: genderIcons[g], cls: genderCls[g], gender: g, })),
            { type: "avgHours", label: "Avg Hours", val: stats.avgHours + "h", icon: "ph-timer", cls: "", },
        ];

        return `
            <div class="summary-grid">
                ${cards.map((c) => {
            if (c.type === "gender") {
                return `
                    <div class="stat-card ${c.cls} stat-card-clickable"
                        data-gender="${this._escapeAttr(c.gender)}"
                        onclick="AppController.view._showGenderSummaryDrilldown('${this._escapeAttr(c.gender)}')">
                        <div class="stat-icon"><i class="ph ${c.icon}"></i></div>
                        <div class="stat-content">
                            <span class="stat-label">${c.label}</span>
                            <span class="stat-value">${c.val}</span>
                            <span class="stat-card-hint">↓ click to view</span>
                        </div>
                    </div>
                `;
            }
            if (c.type === "avgHours") {
                return `
                    <div class="stat-card">
                        <div class="stat-icon"><i class="ph ${c.icon}"></i></div>
                            <div class="stat-content">
                                <span class="stat-label">${c.label}</span>
                                <span class="stat-value">${c.val}</span>
                        </div>
                    </div>
                `;
            }
            return `
                <div class="stat-card ${c.cls} stat-card-clickable" data-card-key="presentHeadcount" onclick="AppController.view._showPresentHeadcountDrilldown()">
                    <div class="stat-icon"><i class="ph ${c.icon}"></i></div>
                        <div class="stat-content">
                            <span class="stat-label">${c.label}</span>
                            <span class="stat-value">${c.val}</span>
                            <span class="stat-card-hint">↓ click to view</span>
                        </div>
                </div>
            `;
        }).join("")}
            </div>
        `;
    }


    _renderLateInSummaryCards(emps, stats, model, logs, empMap) {
        const { dateFrom, dateTo } = model.state.filters;
        const dayLogs = this._buildEmployeeDayLogs(emps, logs, dateFrom, dateTo,);

        this._currentTabPresentHeadcountItems = dayLogs.filter((l) =>
            this._matchesStatus(l, "Present") ||
            this._matchesStatus(l, "Half Present") ||
            this._matchesStatus(l, "WO Present") ||
            this._matchesStatus(l, "WO Half Present") ||
            this._matchesStatus(l, "Single Punch")
        ).map((l) => ({
            log: l,
            emp: empMap[l.empId],
            date: l.date,
        }));

        const totalPresentHalf = this._currentTabPresentHeadcountItems.length;

        const cards = [
            { key: "presentHeadcount", label: "Total Presentcount", val: totalPresentHalf, icon: "ph-users", cls: "", },
            { key: "lateIn", label: "Late In", val: stats.lateIn, icon: "ph-clock-afternoon", cls: "info", },
            { key: null, label: "Avg Hours", val: stats.avgHours + "h", icon: "ph-timer", cls: "", },
        ];

        return `
            <div class="summary-grid">
                ${cards.map((c) => `
                    <div class="stat-card ${c.cls} ${c.key ? "stat-card-clickable" : ""}"
                        ${c.key ? `data-card-key="${c.key}"` : ""}>
                        <div class="stat-icon"><i class="ph ${c.icon}"></i></div>
                        <div class="stat-content">
                            <span class="stat-label">${c.label}</span>
                            <span class="stat-value">${c.val}</span>
                            ${c.key ? '<span class="stat-card-hint">↓ click to view</span>' : ""}
                        </div>
                    </div>
                `,).join("")}
            </div>
        `;
    }


    _renderEarlyOutSummaryCards(emps, stats, model, logs, empMap) {
        const { dateFrom, dateTo } = model.state.filters;
        const dayLogs = this._buildEmployeeDayLogs(emps, logs, dateFrom, dateTo);
        const totalPresentHalf = dayLogs.filter((l) => this._matchesStatus(l, "Present") || this._matchesStatus(l, "Half Present") || this._matchesStatus(l, "WO Present") || this._matchesStatus(l, "WO Half Present")).length;

        const cards = [
            { key: "presentHeadcount", label: "Total Presentcount", val: totalPresentHalf, icon: "ph-users", cls: "", },
            { key: "earlyOut", label: "Early Out", val: stats.earlyOut, icon: "ph-sign-out", cls: "accent", },
            { key: null, label: "Avg Hours", val: stats.avgHours + "h", icon: "ph-timer", cls: "", },
        ];

        return `
            <div class="summary-grid">
                ${cards.map((c) => `
                    <div class="stat-card ${c.cls} ${c.key ? "stat-card-clickable" : ""}"
                        ${c.key ? `data-card-key="${c.key}"` : ""}>
                        <div class="stat-icon"><i class="ph ${c.icon}"></i></div>
                        <div class="stat-content">
                            <span class="stat-label">${c.label}</span>
                            <span class="stat-value">${c.val}</span>
                            ${c.key ? '<span class="stat-card-hint">↓ click to view</span>' : ""}
                        </div>
                    </div>
                `,).join("")}
            </div>
        `;
    }


    _renderResignedSummaryCards(emps, stats, model, logs, empMap) {
        const { dateFrom, dateTo } = model.state.filters;
        const dayLogs = this._buildEmployeeDayLogs(emps, logs, dateFrom, dateTo);
        const totalPresentHalf = dayLogs.filter((l) => this._matchesStatus(l, "Present") || this._matchesStatus(l, "Half Present")).length;

        const cards = [
            { key: "resigned", label: "Resigned", val: stats.resigned || 0, icon: "ph-user-minus", cls: "danger", },
        ];

        const topRow = `
            <div class="summary-grid">
                ${cards.map((c) => `
                    <div class="stat-card ${c.cls} ${c.key ? "stat-card-clickable" : ""}"
                        ${c.key ? `data-card-key="${c.key}"` : ""}>
                        <div class="stat-icon"><i class="ph ${c.icon}"></i></div>
                        <div class="stat-content">
                            <span class="stat-label">${c.label}</span>
                            <span class="stat-value">${c.val}</span>
                            ${c.key ? '<span class="stat-card-hint">↓ click to view</span>' : ""}
                        </div>
                    </div>
                `,).join("")}
            </div>
        `;

        // ---- Resigned employees ka breakdown (Dashboard jaisa) ----
        const resignedItems = model.getResignedEmployees ? model.getResignedEmployees() : [];
        const resEmps = resignedItems.map((it) => it.emp);

        const sectionLabel = (text) => `
            <div style="
                font-size:10px;font-weight:700;text-transform:uppercase;
                letter-spacing:0.08em;color:#9ca3af;margin:20px 0 10px;
                display:flex;align-items:center;gap:8px;
            ">
                ${text}
                <span style="flex:1;height:1px;background:#e5e7eb;display:block;"></span>
            </div>
        `;

        if (resEmps.length === 0) {
            return `
                ${topRow}
                ${sectionLabel("Resigned Breakdown")}
                <p style="padding:16px;color:#94a3b8;">No resigned employees in selected date range.</p>
            `;
        }

        // --- By Company ---
        this._currentResignedBreakdown = { emps: resEmps };
        const companies = [...new Set(resEmps.map((e) => e.company))];
        const compColorCls = ["info", "success", "warning", "accent", "danger"];
        const companyCounts = {};
        companies.forEach((c) => (companyCounts[c] = 0));
        resEmps.forEach((e) => {
            if (companyCounts[e.company] !== undefined) companyCounts[e.company]++;
        });
        const companyCards = companies.map((c, i) => `
            <div class="stat-card ${compColorCls[i % compColorCls.length]} stat-card-clickable"
                data-res-company="${this._escapeAttr(c)}"
                onclick="AppController.view._showResignedBreakdownDrilldown('company', '${this._escapeAttr(c)}')">
                <div class="stat-icon"><i class="ph ph-buildings"></i></div>
                <div class="stat-content">
                    <span class="stat-label">${c}</span>
                    <span class="stat-value">${companyCounts[c]}</span>
                    <span class="stat-card-hint">↓ click to view</span>
                </div>
            </div>
        `,).join("");

        // --- Gender ---
        const genderCounts = { Male: 0, Female: 0 };
        resEmps.forEach((e) => {
            if (genderCounts[e.gender] !== undefined) genderCounts[e.gender]++;
        });
        const genderCards = `
            <div class="stat-card info stat-card-clickable"
                data-res-gender="Male"
                onclick="AppController.view._showResignedBreakdownDrilldown('gender', 'Male')">
                <div class="stat-icon"><i class="ph ph-gender-male"></i></div>
                <div class="stat-content">
                    <span class="stat-label">Male</span>
                    <span class="stat-value">${genderCounts.Male}</span>
                    <span class="stat-card-hint">↓ click to view</span>
                </div>
            </div>
            <div class="stat-card accent stat-card-clickable"
                data-res-gender="Female"
                onclick="AppController.view._showResignedBreakdownDrilldown('gender', 'Female')">
                <div class="stat-icon"><i class="ph ph-gender-female"></i></div>
                <div class="stat-content">
                    <span class="stat-label">Female</span>
                    <span class="stat-value">${genderCounts.Female}</span>
                    <span class="stat-card-hint">↓ click to view</span>
                </div>
            </div>
        `;

        // --- Staff / Workmen ---
        const staffTeamId = model.state.teamConfig?.staffTeamId ?? 7;
        const workerTeamId = model.state.teamConfig?.workerTeamId ?? 6;
        const staffCount = resEmps.filter((e) => e.team === staffTeamId).length;
        const workerCount = resEmps.filter((e) => e.team === workerTeamId).length;

        const swCards = `
            <div class="stat-card info stat-card-clickable"
                data-res-workforce="Staff"
                onclick="AppController.view._showResignedBreakdownDrilldown('workforce', 'Staff')">
                <div class="stat-icon"><i class="ph ph-identification-badge"></i></div>
                <div class="stat-content">
                    <span class="stat-label">Staff</span>
                    <span class="stat-value">${staffCount}</span>
                    <span class="stat-card-hint">↓ click to view</span>
                </div>
            </div>
            <div class="stat-card warning stat-card-clickable"
                data-res-workforce="Workmen"
                onclick="AppController.view._showResignedBreakdownDrilldown('workforce', 'Workmen')">
                <div class="stat-icon"><i class="ph ph-hard-hat"></i></div>
                <div class="stat-content">
                    <span class="stat-label">Workmen</span>
                    <span class="stat-value">${workerCount}</span>
                    <span class="stat-card-hint">↓ click to view</span>
                </div>
            </div>
        `;

        // --- Age Group ---
        const ageGroups = ["Under 18", "Under 25", "25–34", "35–44", "45–54", "55–59", "60+"];
        const ageGroupIcons = {
            "Under 18": "ph-baby",
            "Under 25": "ph-student",
            "25–34": "ph-person-simple",
            "35–44": "ph-user-circle",
            "45–54": "ph-user-circle-gear",
            "55–59": "ph-user-focus",
            "60+": "ph-person-simple-tai-chi",
        };
        const ageGroupCls = {
            "Under 18": "",
            "Under 25": "info",
            "25–34": "success",
            "35–44": "warning",
            "45–54": "accent",
            "55–59": "danger",
            "60+": "accent",
        };
        const ageCounts = {};
        ageGroups.forEach((g) => (ageCounts[g] = 0));
        resEmps.forEach((e) => {
            const g = model.getAgeGroup(e.dob);
            if (ageCounts[g] !== undefined) ageCounts[g]++;
        });
        const ageCards = ageGroups.map((g) => `
            <div class="stat-card ${ageGroupCls[g]} stat-card-clickable"
                data-res-age="${this._escapeAttr(g)}"
                onclick="AppController.view._showResignedBreakdownDrilldown('age', '${this._escapeAttr(g)}')">
                <div class="stat-icon"><i class="ph ${ageGroupIcons[g]}"></i></div>
                <div class="stat-content">
                    <span class="stat-label">${g}</span>
                    <span class="stat-value">${ageCounts[g]}</span>
                    <span class="stat-card-hint">↓ click to view</span>
                </div>
            </div>
        `,).join("");

        // --- By Department (clickable -> designation drilldown) ---
        this._currentResignedDeptData = { resEmps };

        const resDepts = [...new Set(resEmps.map((e) => e.dept))];
        const resDeptColorCls = ["info", "success", "warning", "accent", "danger"];
        const resDeptCounts = {};
        resDepts.forEach((d) => (resDeptCounts[d] = 0));
        resEmps.forEach((e) => {
            if (resDeptCounts[e.dept] !== undefined) resDeptCounts[e.dept]++;
        });
        const resDeptCards = resDepts.map((d, i) => `
            <div class="stat-card ${resDeptColorCls[i % resDeptColorCls.length]} stat-card-clickable"
                data-resigned-dept="${this._escapeAttr(d)}"
                onclick="AppController.view._showResignedDeptDrilldown('${this._escapeAttr(d)}')">
                <div class="stat-icon"><i class="ph ph-briefcase"></i></div>
                <div class="stat-content">
                    <span class="stat-label">${d}</span>
                    <span class="stat-value">${resDeptCounts[d]}</span>
                    <span class="stat-card-hint">↓ click to view</span>
                </div>
            </div>
        `,).join("");

        return `
            ${topRow}
            <div style="margin-top:8px;">
                ${sectionLabel("Resigned — By Company")}
                <div class="summary-grid" style="grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));">
                    ${companyCards}
                </div>

                ${sectionLabel("Resigned — Gender & Workforce Type")}
                <div class="summary-grid" style="grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));">
                    ${genderCards}
                    ${swCards}
                </div>

                ${sectionLabel("Resigned — By Age Group")}
                <div class="summary-grid" style="grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));">
                    ${ageCards}
                </div>

                <div id="resigned-breakdown-drilldown" style="margin-top:8px;"></div>

                ${sectionLabel("Resigned — By Department")}
                <div class="summary-grid" style="grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));">
                    ${resDeptCards}
                </div>
                <div id="resigned-desig-drilldown" style="margin-top:8px;"></div>
            </div>
        `;
    }


    _renderNewJoinedSummaryCards(emps, stats, model, logs, empMap) {
        const { dateFrom, dateTo } = model.state.filters;
        const dayLogs = this._buildEmployeeDayLogs(emps, logs, dateFrom, dateTo);
        const totalPresentHalf = dayLogs.filter((l) => this._matchesStatus(l, "Present") || this._matchesStatus(l, "Half Present"),).length;

        const cards = [
            { key: "newJoined", label: "New Join", val: stats.newJoined || 0, icon: "ph-user-plus", cls: "success", },
        ];

        const topRow = `
            <div class="summary-grid">
                ${cards.map((c) => `
                    <div class="stat-card ${c.cls} ${c.key ? "stat-card-clickable" : ""}"
                        ${c.key ? `data-card-key="${c.key}"` : ""}>
                        <div class="stat-icon"><i class="ph ${c.icon}"></i></div>
                        <div class="stat-content">
                            <span class="stat-label">${c.label}</span>
                            <span class="stat-value">${c.val}</span>
                            ${c.key ? '<span class="stat-card-hint">↓ click to view</span>' : ""}
                        </div>
                    </div>
                `,).join("")}
            </div>
        `;

        // ---- New Joined employees ke breakdown cards (Dashboard jaisa) ----
        const newJoinedItems = model.getNewJoinedEmployees ? model.getNewJoinedEmployees() : [];
        const njEmps = newJoinedItems.map((it) => it.emp);

        const sectionLabel = (text) => `
            <div style="
                font-size:10px;font-weight:700;text-transform:uppercase;
                letter-spacing:0.08em;color:#9ca3af;margin:20px 0 10px;
                display:flex;align-items:center;gap:8px;
            ">
                ${text}
                <span style="flex:1;height:1px;background:#e5e7eb;display:block;"></span>
            </div>
        `;

        if (njEmps.length === 0) {
            return `
                ${topRow}
                ${sectionLabel("New Joined Breakdown")}
                <p style="padding:16px;color:#94a3b8;">No new joined employees in selected date range.</p>
            `;
        }

        this._currentNewJoinedBreakdown = { emps: njEmps };

        // --- By Company ---
        const companies = [...new Set(njEmps.map((e) => e.company))];
        const compColorCls = ["info", "success", "warning", "accent", "danger"];
        const companyCounts = {};
        companies.forEach((c) => (companyCounts[c] = 0));
        njEmps.forEach((e) => {
            if (companyCounts[e.company] !== undefined) companyCounts[e.company]++;
        });
        const companyCards = companies.map((c, i) => `
            <div class="stat-card ${compColorCls[i % compColorCls.length]} stat-card-clickable"
                data-nj-company="${this._escapeAttr(c)}"
                onclick="AppController.view._showNewJoinedBreakdownDrilldown('company', '${this._escapeAttr(c)}')">
                <div class="stat-icon"><i class="ph ph-buildings"></i></div>
                <div class="stat-content">
                    <span class="stat-label">${c}</span>
                    <span class="stat-value">${companyCounts[c]}</span>
                    <span class="stat-card-hint">↓ click to view</span>
                </div>
            </div>
        `,).join("");

        // --- Gender ---
        const genderCounts = { Male: 0, Female: 0 };
        njEmps.forEach((e) => {
            if (genderCounts[e.gender] !== undefined) genderCounts[e.gender]++;
        });
        const genderCards = `
            <div class="stat-card info stat-card-clickable"
                data-nj-gender="Male"
                onclick="AppController.view._showNewJoinedBreakdownDrilldown('gender', 'Male')">
                <div class="stat-icon"><i class="ph ph-gender-male"></i></div>
                <div class="stat-content">
                    <span class="stat-label">Male</span>
                    <span class="stat-value">${genderCounts.Male}</span>
                    <span class="stat-card-hint">↓ click to view</span>
                </div>
            </div>
            <div class="stat-card accent stat-card-clickable"
                data-nj-gender="Female"
                onclick="AppController.view._showNewJoinedBreakdownDrilldown('gender', 'Female')">
                <div class="stat-icon"><i class="ph ph-gender-female"></i></div>
                <div class="stat-content">
                    <span class="stat-label">Female</span>
                    <span class="stat-value">${genderCounts.Female}</span>
                    <span class="stat-card-hint">↓ click to view</span>
                </div>
            </div>
        `;

        // --- Staff / Workmen (Workforce Type) ---
        const staffTeamId = model.state.teamConfig?.staffTeamId ?? 7;
        const workerTeamId = model.state.teamConfig?.workerTeamId ?? 6;
        const staffCount = njEmps.filter((e) => e.team === staffTeamId).length;
        const workerCount = njEmps.filter((e) => e.team === workerTeamId).length;

        const swCards = `
            <div class="stat-card info stat-card-clickable"
                data-nj-workforce="Staff"
                onclick="AppController.view._showNewJoinedBreakdownDrilldown('workforce', 'Staff')">
                <div class="stat-icon"><i class="ph ph-identification-badge"></i></div>
                <div class="stat-content">
                    <span class="stat-label">Staff</span>
                    <span class="stat-value">${staffCount}</span>
                    <span class="stat-card-hint">↓ click to view</span>
                </div>
            </div>
            <div class="stat-card warning stat-card-clickable"
                data-nj-workforce="Workmen"
                onclick="AppController.view._showNewJoinedBreakdownDrilldown('workforce', 'Workmen')">
                <div class="stat-icon"><i class="ph ph-hard-hat"></i></div>
                <div class="stat-content">
                    <span class="stat-label">Workmen</span>
                    <span class="stat-value">${workerCount}</span>
                    <span class="stat-card-hint">↓ click to view</span>
                </div>
            </div>
        `;

        // --- Age Group ---
        const ageGroups = ["Under 18", "Under 25", "25–34", "35–44", "45–54", "55–59", "60+"];
        const ageGroupIcons = {
            "Under 18": "ph-baby",
            "Under 25": "ph-student",
            "25–34": "ph-person-simple",
            "35–44": "ph-user-circle",
            "45–54": "ph-user-circle-gear",
            "55–59": "ph-user-focus",
            "60+": "ph-person-simple-tai-chi",
        };
        const ageGroupCls = {
            "Under 18": "",
            "Under 25": "info",
            "25–34": "success",
            "35–44": "warning",
            "45–54": "accent",
            "55–59": "danger",
            "60+": "accent",
        };
        const ageCounts = {};
        ageGroups.forEach((g) => (ageCounts[g] = 0));
        njEmps.forEach((e) => {
            const g = model.getAgeGroup(e.dob);
            if (ageCounts[g] !== undefined) ageCounts[g]++;
        });
        const ageCards = ageGroups.map((g) => `
            <div class="stat-card ${ageGroupCls[g]} stat-card-clickable"
                data-nj-age="${this._escapeAttr(g)}"
                onclick="AppController.view._showNewJoinedBreakdownDrilldown('age', '${this._escapeAttr(g)}')">
                <div class="stat-icon"><i class="ph ${ageGroupIcons[g]}"></i></div>
                <div class="stat-content">
                    <span class="stat-label">${g}</span>
                    <span class="stat-value">${ageCounts[g]}</span>
                    <span class="stat-card-hint">↓ click to view</span>
                </div>
            </div>
        `,).join("");

        // --- By Department ---
        const njDepts = [...new Set(njEmps.map((e) => e.dept))];
        const njDeptColorCls = ["info", "success", "warning", "accent", "danger"];
        const njDeptCounts = {};
        njDepts.forEach((d) => (njDeptCounts[d] = 0));
        njEmps.forEach((e) => {
            if (njDeptCounts[e.dept] !== undefined) njDeptCounts[e.dept]++;
        });
        this._currentNewJoinedDeptData = { njEmps };

        const njDeptCards = njDepts.map((d, i) => `
            <div class="stat-card ${njDeptColorCls[i % njDeptColorCls.length]} stat-card-clickable"
                data-newjoined-dept="${this._escapeAttr(d)}"
                onclick="AppController.view._showNewJoinedDeptDrilldown('${this._escapeAttr(d)}')">
                <div class="stat-icon"><i class="ph ph-briefcase"></i></div>
                <div class="stat-content">
                    <span class="stat-label">${d}</span>
                    <span class="stat-value">${njDeptCounts[d]}</span>
                    <span class="stat-card-hint">↓ click to view</span>
                </div>
            </div>
        `,).join("");

        return `
            ${topRow}
            <div style="margin-top:8px;">
                ${sectionLabel("New Joined — By Company")}
                <div class="summary-grid" style="grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));">
                    ${companyCards}
                </div>

                ${sectionLabel("New Joined — Gender & Workforce Type")}
                <div class="summary-grid" style="grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));">
                    ${genderCards}
                    ${swCards}
                </div>

                ${sectionLabel("New Joined — By Age Group")}
                <div class="summary-grid" style="grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));">
                    ${ageCards}
                </div>

                <div id="newjoined-breakdown-drilldown" style="margin-top:8px;"></div>

                ${sectionLabel("New Joined — By Department")}
                <div class="summary-grid" style="grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));">
                    ${njDeptCards}
                </div>
                <div id="newjoined-desig-drilldown" style="margin-top:8px;"></div>
            </div>
        `;
    }


    _renderShiftSummaryCards(emps, stats, model, logs, empMap) {
        const { dateFrom, dateTo } = model.state.filters;
        const dayLogs = this._buildShiftStatsLogs(emps, logs, dateFrom, dateTo);
        this._currentShiftSummaryData = { emps, model, dayLogs, empMap };

        const shifts = [...new Set(dayLogs.map((l) => l.shiftName || "No Shift"))];
        const colorCls = ["info", "success", "warning", "accent", "danger"];

        const counts = {};
        shifts.forEach((s) => (counts[s] = 0));

        dayLogs.forEach((l) => {
            const isPresentOrHalf =
                this._matchesStatus(l, "Present") ||
                this._matchesStatus(l, "Half Present") ||
                this._matchesStatus(l, "WO Present") ||
                this._matchesStatus(l, "WO Half Present") ||
                this._matchesStatus(l, "Single Punch");
            if (!isPresentOrHalf) return;
            const s = l.shiftName || "No Shift";
            if (counts[s] !== undefined) counts[s]++;
        });

        this._currentTabPresentHeadcountItems = dayLogs.filter((l) =>
            this._matchesStatus(l, "Present") ||
            this._matchesStatus(l, "Half Present") ||
            this._matchesStatus(l, "WO Present") ||
            this._matchesStatus(l, "WO Half Present") ||
            this._matchesStatus(l, "Single Punch")
        ).map((l) => ({
            log: l,
            emp: empMap[l.empId],
            date: l.date,
        }));

        const totalPresentHalf = this._currentTabPresentHeadcountItems.length;

        const cards = [
            { type: "headcount", label: "Total Presentcount", val: totalPresentHalf, icon: "ph-users", cls: "" },
            ...shifts.map((s, i) => ({
                type: "shift",
                label: s,
                val: counts[s],
                icon: "ph-clock-clockwise",
                cls: colorCls[i % colorCls.length],
                shift: s,
            })),
            { type: "avgHours", label: "Avg Hours", val: stats.avgHours + "h", icon: "ph-timer", cls: "" },
        ];

        return `
            <div class="summary-grid">
                ${cards.map((c) => {
                    if (c.type === "shift") {
                        return `
                            <div class="stat-card ${c.cls} stat-card-clickable"
                                data-shift="${this._escapeAttr(c.shift)}"
                                onclick="AppController.view._showShiftSummaryDrilldown('${this._escapeAttr(c.shift)}')">
                                <div class="stat-icon"><i class="ph ${c.icon}"></i></div>
                                <div class="stat-content">
                                    <span class="stat-label">${c.label}</span>
                                    <span class="stat-value">${c.val}</span>
                                    <span class="stat-card-hint">↓ click to view</span>
                                </div>
                            </div>
                        `;
                    }
                    if (c.type === "avgHours") {
                        return `
                            <div class="stat-card">
                                <div class="stat-icon"><i class="ph ${c.icon}"></i></div>
                                <div class="stat-content">
                                    <span class="stat-label">${c.label}</span>
                                    <span class="stat-value">${c.val}</span>
                                </div>
                            </div>
                        `;
                    }
                    return `
                        <div class="stat-card ${c.cls} stat-card-clickable" data-card-key="presentHeadcount" onclick="AppController.view._showPresentHeadcountDrilldown()">
                            <div class="stat-icon"><i class="ph ${c.icon}"></i></div>
                            <div class="stat-content">
                                <span class="stat-label">${c.label}</span>
                                <span class="stat-value">${c.val}</span>
                                <span class="stat-card-hint">↓ click to view</span>
                            </div>
                        </div>
                    `;
                }).join("")}
            </div>
        `;
    }


    _renderManualPunchSummaryCards(emps, stats, model, logs, empMap) {
        const items = model.getManualPunchEmployees();
        this._currentManualPunchSummaryItems = items;

        const shiftMP = model.getManualPunchByShift();
        const colorCls = ["info", "success", "warning", "accent", "danger"];

        const totalCard = `
            <div class="stat-card warning stat-card-clickable"
                data-mp-total="all"
                onclick="AppController.view._showManualPunchShiftDrilldown(null)">
                <div class="stat-icon"><i class="ph ph-pencil-simple"></i></div>
                <div class="stat-content">
                    <span class="stat-label">Total Manual Punches</span>
                    <span class="stat-value">${items.length}</span>
                    <span class="stat-card-hint">↓ click to view</span>
                </div>
            </div>
        `;

        const shiftCards = shiftMP.map((s, i) => `
            <div class="stat-card ${colorCls[i % colorCls.length]} stat-card-clickable"
                data-mp-shift="${this._escapeAttr(s.shiftName)}"
                onclick="AppController.view._showManualPunchShiftDrilldown('${this._escapeAttr(s.shiftName)}')">
                <div class="stat-icon"><i class="ph ph-clock-clockwise"></i></div>
                <div class="stat-content">
                    <span class="stat-label">${s.shiftName}</span>
                    <span class="stat-value">${s.count}</span>
                    <span class="stat-card-hint">↓ click to view</span>
                </div>
            </div>
        `).join("");

        return `<div class="summary-grid">${totalCard}${shiftCards}</div>`;
    }


    _showManualPunchShiftDrilldown(shiftName) {
        document.querySelectorAll(".stat-card-clickable[data-mp-shift],.stat-card-clickable[data-mp-total]")
            .forEach(c => c.classList.remove("active"));

        const card = shiftName
            ? this.app.querySelector(`.stat-card-clickable[data-mp-shift="${shiftName}"]`)
            : this.app.querySelector(`.stat-card-clickable[data-mp-total]`);
    
        if (card) card.classList.add("active");

        const items = shiftName
            ? (this._currentManualPunchSummaryItems || []).filter(it => (it.log.shiftName || it.emp.shift || "No Shift") === shiftName)
            : (this._currentManualPunchSummaryItems || []);

        this._renderStatCardDrilldown(shiftName ? "manualPunchShift_" + shiftName : "manualPunchAll", items, 1);
    }


    _renderNightSummaryCards(emps, stats, model, logs, empMap) {
        const nightData = model.getNightShiftData();
        const nEmps = nightData.emps;
        const nLogs = nightData.logs;
        const nEmpMap = nightData.empMap;

        const { dateFrom, dateTo } = model.state.filters;
        const dayLogs = this._buildEmployeeDayLogs(nEmps, nLogs, dateFrom, dateTo);
        this._currentNightSummaryData = { emps: nEmps, model, dayLogs, empMap: nEmpMap };

        const shifts = [...new Set(nEmps.map((e) => e.shift || "No Shift"))];
        const colorCls = ["info", "success", "warning", "accent", "danger"];

        const counts = {};
        shifts.forEach((s) => (counts[s] = 0));
        dayLogs.forEach((l) => {
            const e = nEmpMap[l.empId];
            if (!e) return;
            const isPresentOrHalf = this._matchesStatus(l, "Present") || this._matchesStatus(l, "Half Present") || this._matchesStatus(l, "WO Present") || this._matchesStatus(l, "WO Half Present");
            if (!isPresentOrHalf) return;
            const s = e.shift || "No Shift";
            if (counts[s] !== undefined) counts[s]++;
        });

        this._currentTabPresentHeadcountItems = dayLogs.filter((l) =>
            this._matchesStatus(l, "Present") || 
            this._matchesStatus(l, "Half Present") ||
            this._matchesStatus(l, "WO Present") || 
            this._matchesStatus(l, "WO Half Present") ||
            this._matchesStatus(l, "Single Punch")
        ).map((l) => ({ log: l, emp: nEmpMap[l.empId], date: l.date }));

        const totalPresentHalf = this._currentTabPresentHeadcountItems.length;

        const cards = [
            { type: "headcount", label: "Total Presentcount", val: totalPresentHalf, icon: "ph-users", cls: "" },
            ...shifts.map((s, i) => ({ type: "shift", label: s, val: counts[s], icon: "ph-clock-clockwise", cls: colorCls[i % colorCls.length], shift: s })),
            { type: "avgHours", label: "Avg Hours", val: stats.avgHours + "h", icon: "ph-timer", cls: "" },
        ];

        return `
            <div class="summary-grid">
                ${cards.map((c) => {
            if (c.type === "shift") {
                return `
                    <div class="stat-card ${c.cls} stat-card-clickable"
                        data-night-shift="${this._escapeAttr(c.shift)}"
                        onclick="AppController.view._showNightSummaryDrilldown('${this._escapeAttr(c.shift)}')">
                        <div class="stat-icon"><i class="ph ${c.icon}"></i></div>
                        <div class="stat-content">
                            <span class="stat-label">${c.label}</span>
                            <span class="stat-value">${c.val}</span>
                            <span class="stat-card-hint">↓ click to view</span>
                        </div>
                    </div>
                `;
            }
            if (c.type === "avgHours") {
                return `
                    <div class="stat-card">
                        <div class="stat-icon"><i class="ph ${c.icon}"></i></div>
                        <div class="stat-content">
                            <span class="stat-label">${c.label}</span>
                            <span class="stat-value">${c.val}</span>
                        </div>
                    </div>
                `;
            }
            return `
                <div class="stat-card ${c.cls} stat-card-clickable" data-card-key="presentHeadcount" onclick="AppController.view._showPresentHeadcountDrilldown()">
                    <div class="stat-icon"><i class="ph ${c.icon}"></i></div>
                    <div class="stat-content">
                        <span class="stat-label">${c.label}</span>
                        <span class="stat-value">${c.val}</span>
                        <span class="stat-card-hint">↓ click to view</span>
                    </div>
                </div>
            `;
        }).join("")}
            </div>
        `;
    }


    _showNightSummaryDrilldown(shiftName) {
        document.querySelectorAll(".stat-card-clickable").forEach((c) => c.classList.remove("active"));
        const card = this.app.querySelector(`.stat-card-clickable[data-night-shift="${shiftName}"]`);
        if (card) card.classList.add("active");

        const data = this._currentNightSummaryData;
        if (!data) return;
        const { dayLogs, empMap } = data;
        const shiftLogs = dayLogs.filter((l) => {
            const e = empMap[l.empId];
            if (!e || (e.shift || "No Shift") !== shiftName) return false;
            return this._matchesStatus(l, "Present") || this._matchesStatus(l, "Half Present");
        });
        const items = shiftLogs.map((l) => ({ log: l, emp: empMap[l.empId], date: l.date }));
        this._renderStatCardDrilldown("nightSummary_" + shiftName, items, 1);
    }


    _renderStaffSummaryCards(emps, stats, model, logs, empMap) {
        const staffTeamId = model.state.teamConfig?.staffTeamId ?? 7;
        const staffEmps = emps.filter((e) => e.team === staffTeamId);

        const { dateFrom, dateTo } = model.state.filters;
        const dayLogs = this._buildEmployeeDayLogs(staffEmps, logs, dateFrom, dateTo);
        this._currentStaffSummaryData = { emps: staffEmps, model, dayLogs, empMap, };

        const depts = [...new Set(staffEmps.map((e) => e.dept))].sort();
        const colorCls = ["info", "success", "warning", "accent", "danger"];

        const counts = {};
        depts.forEach((d) => (counts[d] = 0));
        dayLogs.forEach((l) => {
            const e = empMap[l.empId];
            if (!e) return;
            const isPresentOrHalf = this._matchesStatus(l, "Present") || this._matchesStatus(l, "Half Present") || this._matchesStatus(l, "WO Present") || this._matchesStatus(l, "WO Half Present") || this._matchesStatus(l, "Single Punch");
            if (!isPresentOrHalf) return;
            if (counts[e.dept] !== undefined) {
                counts[e.dept]++;
            }
        });

        const totalPresentHalf = depts.reduce((sum, d) => sum + counts[d], 0);

        this._currentTabPresentHeadcountItems = dayLogs.filter((l) =>
            this._matchesStatus(l, "Present") ||
            this._matchesStatus(l, "Half Present") ||
            this._matchesStatus(l, "WO Present") ||
            this._matchesStatus(l, "WO Half Present") ||
            this._matchesStatus(l, "Single Punch")
        ).map((l) => ({
            log: l,
            emp: empMap[l.empId],
            date: l.date,
        }));

        const cards = [
            { type: "headcount", label: "Total Presentcount", val: totalPresentHalf, icon: "ph-users", cls: "", },
            ...depts.map((d, i) => ({ type: "dept", label: d, val: counts[d], icon: "ph-briefcase", cls: colorCls[i % colorCls.length], dept: d, })),
            { type: "avgHours", label: "Avg Hours", val: stats.avgHours + "h", icon: "ph-timer", cls: "", },
        ];

        return `
            <div class="summary-grid">
                ${cards.map((c) => {
            if (c.type === "dept") {
                return `
                    <div class="stat-card ${c.cls} stat-card-clickable"
                        data-staff-dept="${this._escapeAttr(c.dept)}"
                        onclick="AppController.view._showStaffSummaryDrilldown('${this._escapeAttr(c.dept)}')">
                        <div class="stat-icon"><i class="ph ${c.icon}"></i></div>
                        <div class="stat-content">
                            <span class="stat-label">${c.label}</span>
                            <span class="stat-value">${c.val}</span>
                            <span class="stat-card-hint">↓ click to view</span>
                        </div>
                    </div>
                `;
            }
            if (c.type === "avgHours") {
                return `
                    <div class="stat-card">
                        <div class="stat-icon"><i class="ph ${c.icon}"></i></div>
                        <div class="stat-content">
                            <span class="stat-label">${c.label}</span>
                            <span class="stat-value">${c.val}</span>
                        </div>
                    </div>
                `;
            }
            return `
                <div class="stat-card ${c.cls} stat-card-clickable" data-card-key="presentHeadcount" onclick="AppController.view._showPresentHeadcountDrilldown()">
                    <div class="stat-icon"><i class="ph ${c.icon}"></i></div>
                    <div class="stat-content">
                        <span class="stat-label">${c.label}</span>
                        <span class="stat-value">${c.val}</span>
                        <span class="stat-card-hint">↓ click to view</span>
                    </div>
                </div>
            `;
        }).join("")}
            </div>
        `;
    }


    _renderWorkerSummaryCards(emps, stats, model, logs, empMap) {
        const workerTeamId = model.state.teamConfig?.workerTeamId ?? 6;
        const workerEmps = emps.filter((e) => e.team === workerTeamId);

        const { dateFrom, dateTo } = model.state.filters;
        const dayLogs = this._buildEmployeeDayLogs(workerEmps, logs, dateFrom, dateTo);
        this._currentWorkerSummaryData = { emps: workerEmps, model, dayLogs, empMap, };

        const depts = [...new Set(workerEmps.map((e) => e.dept))].sort();
        const colorCls = ["info", "success", "warning", "accent", "danger"];

        const counts = {};
        depts.forEach((d) => (counts[d] = 0));
        dayLogs.forEach((l) => {
            const e = empMap[l.empId];
            if (!e) return;
            const isPresentOrHalf = this._matchesStatus(l, "Present") || this._matchesStatus(l, "Half Present") || this._matchesStatus(l, "WO Present") || this._matchesStatus(l, "WO Half Present") || this._matchesStatus(l, "Single Punch");
            if (!isPresentOrHalf) return;
            if (counts[e.dept] !== undefined) {
                counts[e.dept]++;
            }
        });

        this._currentTabPresentHeadcountItems = dayLogs.filter((l) =>
            this._matchesStatus(l, "Present") ||
            this._matchesStatus(l, "Half Present") ||
            this._matchesStatus(l, "WO Present") ||
            this._matchesStatus(l, "WO Half Present") ||
            this._matchesStatus(l, "Single Punch")
        ).map((l) => ({
            log: l,
            emp: empMap[l.empId],
            date: l.date,
        }));

        const totalPresentHalf = this._currentTabPresentHeadcountItems.length;

        const cards = [
            { type: "headcount", label: "Total Presentcount", val: totalPresentHalf, icon: "ph-users", cls: "", },
            ...depts.map((d, i) => ({ type: "dept", label: d, val: counts[d], icon: "ph-briefcase", cls: colorCls[i % colorCls.length], dept: d, })),
            { type: "avgHours", label: "Avg Hours", val: stats.avgHours + "h", icon: "ph-timer", cls: "", },
        ];

        return `
            <div class="summary-grid">
                ${cards.map((c) => {
            if (c.type === "dept") {
                return `
                    <div class="stat-card ${c.cls} stat-card-clickable"
                        data-worker-dept="${this._escapeAttr(c.dept)}"
                        onclick="AppController.view._showWorkerSummaryDrilldown('${this._escapeAttr(c.dept)}')">
                        <div class="stat-icon"><i class="ph ${c.icon}"></i></div>
                        <div class="stat-content">
                            <span class="stat-label">${c.label}</span>
                            <span class="stat-value">${c.val}</span>
                            <span class="stat-card-hint">↓ click to view</span>
                        </div>
                    </div>
                `;
            }
            if (c.type === "avgHours") {
                return `
                    <div class="stat-card">
                        <div class="stat-icon"><i class="ph ${c.icon}"></i></div>
                        <div class="stat-content">
                            <span class="stat-label">${c.label}</span>
                            <span class="stat-value">${c.val}</span>
                        </div>
                    </div>
                `;
            }
            return `
                <div class="stat-card ${c.cls} stat-card-clickable" data-card-key="presentHeadcount" onclick="AppController.view._showPresentHeadcountDrilldown()">
                    <div class="stat-icon"><i class="ph ${c.icon}"></i></div>
                    <div class="stat-content">
                        <span class="stat-label">${c.label}</span>
                        <span class="stat-value">${c.val}</span>
                        <span class="stat-card-hint">↓ click to view</span>
                    </div>
                </div>
            `;
        }).join("")}
            </div>
        `;
    }


    _showWorkerSummaryDrilldown(dept) {
        document.querySelectorAll(".stat-card-clickable").forEach((c) => c.classList.remove("active"));
        const card = this.app.querySelector(`.stat-card-clickable[data-worker-dept="${dept}"]`,);
        if (card) card.classList.add("active");

        const data = this._currentWorkerSummaryData;
        if (!data) return;

        const { emps, dayLogs, empMap } = data;

        let items;
        if (data.isDashboard) {
            items = emps.filter((e) => e.dept === dept).map((emp) => ({ log: null, emp, date: null }));
        } else {
            const deptLogs = dayLogs.filter((l) => {
                const e = empMap[l.empId];
                if (!e || e.dept !== dept) return false;
                return (this._matchesStatus(l, "Present") || this._matchesStatus(l, "Half Present"));
            });
            items = deptLogs.map((l) => ({
                log: l,
                emp: empMap[l.empId],
                date: l.date,
            }));
        }

        this._renderStatCardDrilldown("workerSummary_" + dept, items, 1);
    }


    _showAvgHoursWorkerDrilldown() {
        document.querySelectorAll(".stat-card-clickable").forEach((c) => c.classList.remove("active"));
        const card = this.app.querySelector(`.stat-card-clickable[data-card-key="avgHoursWorker"]`,);
        if (card) {
            card.classList.add("active");
        }

        const data = this._currentWorkerSummaryData;
        if (!data) return;

        const { dayLogs, empMap } = data;
        const items = dayLogs.filter((l) => (l.hoursWorked || 0) > 0).sort((a, b) => (b.hoursWorked || 0) - (a.hoursWorked || 0)).map((l) => ({ log: l, emp: empMap[l.empId], date: l.date }));

        this._renderStatCardDrilldown("avgHoursWorker", items, 1);
    }

    
    _showStaffSummaryDrilldown(dept) {
        document.querySelectorAll(".stat-card-clickable").forEach((c) => c.classList.remove("active"));
        const card = this.app.querySelector(`.stat-card-clickable[data-staff-dept="${dept}"]`,);
        if (card) card.classList.add("active");

        const data = this._currentStaffSummaryData;
        if (!data) return;

        const { emps, dayLogs, empMap } = data;

        let items;
        if (data.isDashboard) {
            items = emps.filter((e) => e.dept === dept).map((emp) => ({ log: null, emp, date: null }));
        } else {
            const deptLogs = dayLogs.filter((l) => {
                const e = empMap[l.empId];
                if (!e || e.dept !== dept) return false;
                return (this._matchesStatus(l, "Present") || this._matchesStatus(l, "Half Present"));
            });
            items = deptLogs.map((l) => ({
                log: l,
                emp: empMap[l.empId],
                date: l.date,
            }));
        }

        this._renderStatCardDrilldown("staffSummary_" + dept, items, 1);
    }

    
    _showAvgHoursStaffDrilldown() {
        document.querySelectorAll(".stat-card-clickable").forEach((c) => c.classList.remove("active"));
        const card = this.app.querySelector(`.stat-card-clickable[data-card-key="avgHoursStaff"]`,);
        if (card) {
            card.classList.add("active");
        }

        const data = this._currentStaffSummaryData;
        if (!data) return;

        const { dayLogs, empMap } = data;
        const items = dayLogs.filter((l) => (l.hoursWorked || 0) > 0).sort((a, b) => (b.hoursWorked || 0) - (a.hoursWorked || 0)).map((l) => ({ log: l, emp: empMap[l.empId], date: l.date }));

        this._renderStatCardDrilldown("avgHoursStaff", items, 1);
    }

    
    _showShiftSummaryDrilldown(shiftName) {
        document.querySelectorAll(".stat-card-clickable").forEach((c) => c.classList.remove("active"));
        const card = this.app.querySelector(`.stat-card-clickable[data-shift="${shiftName}"]`);
        if (card) card.classList.add("active");

        const data = this._currentShiftSummaryData;
        if (!data) return;

        const { dayLogs, empMap } = data;
        const shiftLogs = dayLogs.filter((l) => {
            const e = empMap[l.empId];
            if (!e || (l.shiftName || "No Shift") !== shiftName) return false;
            return this._matchesStatus(l, "Present") ||
                this._matchesStatus(l, "Half Present") ||
                this._matchesStatus(l, "WO Present") ||
                this._matchesStatus(l, "WO Half Present") ||
                this._matchesStatus(l, "Single Punch");
        });

        const items = shiftLogs.map((l) => ({
            log: l,
            emp: empMap[l.empId],
            date: l.date,
        }));

        this._renderStatCardDrilldown("shiftSummary_" + shiftName, items, 1);
    }


    _showAvgHoursShiftDrilldown() {
        document.querySelectorAll(".stat-card-clickable").forEach((c) => c.classList.remove("active"));
        const card = this.app.querySelector(`.stat-card-clickable[data-card-key="avgHoursShift"]`,);
        if (card) card.classList.add("active");

        const data = this._currentShiftSummaryData;
        if (!data) return;

        const { dayLogs, empMap } = data;
        const items = dayLogs.filter((l) => (l.hoursWorked || 0) > 0).sort((a, b) => (b.hoursWorked || 0) - (a.hoursWorked || 0)).map((l) => ({ log: l, emp: empMap[l.empId], date: l.date }));

        this._renderStatCardDrilldown("avgHoursShift", items, 1);
    }


    _showGenderSummaryDrilldown(gender) {
        document.querySelectorAll(".stat-card-clickable").forEach((c) => c.classList.remove("active"));
        const card = this.app.querySelector(`.stat-card-clickable[data-gender="${gender}"]`,);
        if (card) card.classList.add("active");

        const data = this._currentGenderSummaryData;
        if (!data) return;

        let items;
        if (data.isDashboard) {
            items = data.emps.filter((e) => e.gender === gender).map((emp) => ({ log: null, emp, date: null }));
        } else {
            items = data.dayLogs.filter((l) => {
                const e = data.empMap[l.empId];
                if (!e || e.gender !== gender) return false;
                return (this._matchesStatus(l, "Present") ||
                    this._matchesStatus(l, "Half Present"));
            }).map((l) => ({
                log: l,
                emp: data.empMap[l.empId],
                date: l.date,
            }));
        }

        this._renderStatCardDrilldown("genderSummary_" + gender, items, 1);
    }


    _showAvgHoursGenderDrilldown() {
        document.querySelectorAll(".stat-card-clickable").forEach((c) => c.classList.remove("active"));
        const card = this.app.querySelector(`.stat-card-clickable[data-card-key="avgHoursGender"]`,);
        if (card) {
            card.classList.add("active");
        }

        const data = this._currentGenderSummaryData;
        if (!data) return;

        const { dayLogs, empMap } = data;
        const items = dayLogs.filter((l) => (l.hoursWorked || 0) > 0).sort((a, b) => (b.hoursWorked || 0) - (a.hoursWorked || 0)).map((l) => ({ log: l, emp: empMap[l.empId], date: l.date }));

        this._renderStatCardDrilldown("avgHoursGender", items, 1);
    }


    _showDeptSummaryDrilldown(dept) {
        document.querySelectorAll(".stat-card-clickable").forEach((c) => c.classList.remove("active"));
        const card = this.app.querySelector(`.stat-card-clickable[data-dept="${dept}"]`,);
        if (card) {
            card.classList.add("active");
        }

        const data = this._currentDeptSummaryData;
        if (!data) return;

        const { dayLogs, empMap } = data;

        const deptLogs = dayLogs.filter((l) => {
            const e = empMap[l.empId];
            if (!e || e.dept !== dept) return false;
            return (this._matchesStatus(l, "Present") || this._matchesStatus(l, "Half Present") || this._matchesStatus(l, "Single Punch"));
        });

        const items = deptLogs.map((l) => ({
            log: l,
            emp: empMap[l.empId],
            date: l.date,
        }));

        this._renderStatCardDrilldown("deptSummary_" + dept, items, 1);
    }


    _showAvgHoursDeptDrilldown() {
        document.querySelectorAll(".stat-card-clickable").forEach((c) => c.classList.remove("active"));
        const card = this.app.querySelector(`.stat-card-clickable[data-card-key="avgHoursDept"]`,);
        if (card) card.classList.add("active");

        const data = this._currentDeptSummaryData;
        if (!data) return;

        const { dayLogs, empMap } = data;
        const items = dayLogs.filter((l) => (l.hoursWorked || 0) > 0).sort((a, b) => (b.hoursWorked || 0) - (a.hoursWorked || 0)).map((l) => ({ log: l, emp: empMap[l.empId], date: l.date }));

        this._renderStatCardDrilldown("avgHoursDept", items, 1);
    }


    _showDesignationFamilyDrilldown(familyId) {
        document.querySelectorAll(".stat-card-clickable").forEach((c) => c.classList.remove("active"));
        const card = this.app.querySelector(`.stat-card-clickable[data-family-id="${familyId}"]`,);
        if (card) card.classList.add("active");

        const data = this._currentDesigFamilySummaryData;
        if (!data) return;

        const { dayLogs, empMap, famMap } = data;

        const items = dayLogs.filter((l) => {
            const e = empMap[l.empId];
            if (!e) return false;
            const famInfo = famMap[e.designationId];
            if (!famInfo || famInfo.familyId !== familyId) return false;
            return this._matchesStatus(l, "Present") || this._matchesStatus(l, "Half Present") || this._matchesStatus(l, "Single Punch");
        }).map((l) => ({
            log: l,
            emp: empMap[l.empId],
            date: l.date,
        }));

        this._renderStatCardDrilldown("desigFamily_" + familyId, items, 1);
    }


    _showCompanyDrilldown(company) {
        document.querySelectorAll(".stat-card-clickable").forEach((c) => c.classList.remove("active"));
        const card = this.app.querySelector(`.stat-card-clickable[data-company="${company}"]`,);
        if (card) card.classList.add("active");

        const data = this._currentCompanyData;
        if (!data) return;

        let items;
        if (data.isDashboard) {
            items = data.emps.filter((e) => e.company === company).map((emp) => ({ log: null, emp, date: null }));
        } else {
            items = data.dayLogs.filter((l) => {
                const e = data.empMap[l.empId];
                if (!e || e.company !== company) return false;
                return (this._matchesStatus(l, "Present") || this._matchesStatus(l, "Half Present") || this._matchesStatus(l, "Single Punch"));
            }).map((l) => ({
                log: l,
                emp: data.empMap[l.empId],
                date: l.date,
            }));
        }

        this._renderStatCardDrilldown("company_" + company, items, 1);
    }


    _showCompanyCategoryDrilldown(category) {
        document.querySelectorAll(".stat-card-clickable[data-company-category]").forEach((c) => c.classList.remove("active"));
        const card = this.app.querySelector(`.stat-card-clickable[data-company-category="${category}"]`);
        if (card) card.classList.add("active");

        const data = this._currentCompanyData;
        if (!data) return;
        const { emps, dayLogs, empMap, isDashboard } = data;

        const mergeCat = (rawCat) => {
            const c = rawCat || "OTHER";
            return (c === "OUTSOURCE" || c === "OTHER") ? "CONTRACTOR" : c;
        };

        const catEmps = emps.filter((e) => mergeCat(e.companyCategory) === category);
        const companyCounts = {};
        catEmps.forEach((e) => { if (companyCounts[e.company] === undefined) companyCounts[e.company] = 0; });

        if (isDashboard) {
            catEmps.forEach((e) => { companyCounts[e.company]++; });
        } else {
            dayLogs.forEach((l) => {
                const e = empMap[l.empId];
                if (!e || mergeCat(e.companyCategory) !== category) return;
                
                const isPresentOrHalf = this._matchesStatus(l, "Present") || this._matchesStatus(l, "Half Present") || this._matchesStatus(l, "WO Present") || this._matchesStatus(l, "WO Half Present") || this._matchesStatus(l, "Single Punch");
                
                if (!isPresentOrHalf) return;
                if (companyCounts[e.company] !== undefined) companyCounts[e.company]++;
            });
        }
        
        const companies = Object.keys(companyCounts);

        const colorCls = ["info", "success", "warning", "accent", "danger"];

        const panel = document.getElementById("dashboard-company-category-drilldown") || document.getElementById("company-category-drilldown");
        
        if (!panel) return;

        // Sirf 1 company hai category me (subadmin ka ON-ROLL/CC single-company case) -> seedha employee list dikhao
        if (companies.length === 1) {
            panel.innerHTML = "";
            this._showCompanyDrilldown(companies[0]);
            return;
        }

        const cardsHtml = companies.map((c, i) => `
            <div class="stat-card ${colorCls[i % colorCls.length]} stat-card-clickable"
                data-company="${this._escapeAttr(c)}"
                onclick="AppController.view._showCompanyDrilldown('${this._escapeAttr(c)}')">
                <div class="stat-icon"><i class="ph ph-buildings"></i></div>
                <div class="stat-content">
                    <span class="stat-label">${c}</span>
                    <span class="stat-value">${companyCounts[c]}</span>
                    <span class="stat-card-hint">↓ click to view</span>
                </div>
            </div>
        `).join("");

        const categoryLabelsForDrilldown = {
            "ON-ROLL": "ON-ROLL",
            "CC": "COMPANY CONTRACT (CC)",
            "CONTRACTOR": "CONTRACTOR",
        };

        panel.style.display = "block";
        
        panel.innerHTML = `
            <div style="font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#334155;margin:24px 0 12px;display:flex;align-items:center;gap:8px;">
                ${categoryLabelsForDrilldown[category] || category}
                <span style="flex:1;height:1px;background:#64748b;display:block;border-radius:2px;"></span>
            </div>
            <div class="summary-grid" style="grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));">
                ${cardsHtml}
            </div>
        `;

        panel.scrollIntoView({ behavior: "smooth", block: "start" });
    }


    _showAvgHoursDrilldown() {
        document.querySelectorAll(".stat-card-clickable").forEach((c) => c.classList.remove("active"));
        const card = this.app.querySelector(`.stat-card-clickable[data-card-key="avgHours"]`,);
        if (card) card.classList.add("active");

        const data = this._currentCompanyData;
        if (!data) return;

        const { dayLogs, empMap } = data;
        const items = dayLogs.filter((l) => (l.hoursWorked || 0) > 0).sort((a, b) => (b.hoursWorked || 0) - (a.hoursWorked || 0)).map((l) => ({ log: l, emp: empMap[l.empId], date: l.date }));

        this._renderStatCardDrilldown("avgHours", items, 1);
    }


    _showAgeGroupDrilldown(group) {
        document.querySelectorAll(".stat-card-clickable").forEach((c) => c.classList.remove("active"));
        const card = this.app.querySelector(`.stat-card-clickable[data-age-group="${group}"]`,);
        if (card) card.classList.add("active");

        const data = this._currentAgeData;
        if (!data) return;

        let items;
        if (data.isDashboard) {
            items = data.emps.filter((e) => data.model.getAgeGroup(e.dob) === group).map((emp) => ({ log: null, emp, date: null }));
        } else {
            items = data.dayLogs.filter((l) => {
                const e = data.empMap[l.empId];
                if (!e || data.model.getAgeGroup(e.dob) !== group)
                    return false;
                return (this._matchesStatus(l, "Present") || this._matchesStatus(l, "Half Present") || this._matchesStatus(l, "Single Punch"));
            }).map((l) => ({
                log: l,
                emp: data.empMap[l.empId],
                date: l.date,
            }));
        }

        this._renderStatCardDrilldown("ageGroup_" + group, items, 1);
    }


    _showDashboardDeptDrilldown(dept) {
        document.querySelectorAll(".stat-card-clickable").forEach((c) => c.classList.remove("active"));
        const card = this.app.querySelector(`.stat-card-clickable[data-dashboard-dept="${dept}"]`,);
        if (card) card.classList.add("active");

        const data = this._currentDashboardDeptData;
        if (!data) return;
        const { emps, dayLogs, empMap } = data;

        const deptEmps = emps.filter((e) => e.dept === dept);

        const desigMap = {};
        deptEmps.forEach((e) => {
            const name = e.designation || "Staff";
            const order = e.designationSortOrder || 0;
            if (!desigMap[name] || order < desigMap[name].order) {
                desigMap[name] = { name, order };
            }
        });
        const desigs = Object.values(desigMap).sort((a, b) => a.order !== b.order ? a.order - b.order : a.name.localeCompare(b.name),).map((d) => d.name);

        const desigCounts = {};
        desigs.forEach((d) => (desigCounts[d] = 0));
        deptEmps.forEach((e) => {
            const name = e.designation || "Staff";
            if (desigCounts[name] !== undefined) desigCounts[name]++;
        });

        this._currentDashboardDesigData = { dept, deptEmps, empMap };

        const colorCls = ["info", "success", "warning", "accent", "danger"];
        const desigCardsHtml = desigs.map((d, i) => `
            <div class="stat-card ${colorCls[i % colorCls.length]} stat-card-clickable"
                style="flex: 0 1 180px;"
                data-dashboard-desig="${this._escapeAttr(d)}"
                onclick="AppController.view._showDashboardDesigDrilldown('${this._escapeAttr(d)}')">
                <div class="stat-icon"><i class="ph ph-identification-badge"></i></div>
                <div class="stat-content">
                    <span class="stat-label">${d}</span>
                    <span class="stat-value">${desigCounts[d]}</span>
                    <span class="stat-card-hint">↓ click to view</span>
                </div>
            </div>
        `,).join("");

        const panel = document.getElementById("dashboard-dept-drilldown");
        if (!panel) return;
        panel.style.display = "block";
        panel.innerHTML = `
            <div style="
                font-size:13px;font-weight:600;text-transform:uppercase;
                letter-spacing:0.06em;color:#334155;margin:24px 0 12px;
                display:flex;align-items:center;gap:8px;
            ">
                BY ${dept.toUpperCase()} DEPARTMENT DESIGNATIONS
                <span style="flex:1;height:1px;background:#64748b;display:block;border-radius:2px;"></span>
            </div>
            <div class="summary-grid" style="grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));">
                ${desigCardsHtml || '<p style="padding:16px;color:#94a3b8;">No designations found.</p>'}
            </div>
            <div id="dashboard-desig-table-container" style="margin-top:8px;"></div>
        `;
        panel.scrollIntoView({ behavior: "smooth", block: "start" });
    }


    _showDashboardFamilyDrilldown(familyId) {
        document.querySelectorAll(".stat-card-clickable[data-dashboard-family-id]").forEach((c) => c.classList.remove("active"));
        const card = this.app.querySelector(`.stat-card-clickable[data-dashboard-family-id="${familyId}"]`);
        if (card) card.classList.add("active");

        const data = this._currentDashboardFamilyData;
        if (!data) return;

        const { emps, famMap } = data;

        const items = emps.filter((e) => {
            const famInfo = famMap[e.designationId];
            return famInfo && famInfo.familyId === familyId;
        }).map((emp) => ({ log: null, emp, date: null }));

        this._renderStatCardDrilldown("dashboardFamily_" + familyId, items, 1);
    }


    _showDashboardDesigDrilldown(designation) {
        document.querySelectorAll(".stat-card-clickable[data-dashboard-desig]").forEach((c) => c.classList.remove("active"));
        const card = this.app.querySelector(`.stat-card-clickable[data-dashboard-desig="${designation}"]`,);
        if (card) card.classList.add("active");

        const data = this._currentDashboardDesigData;
        if (!data) return;
        const { dept, deptEmps, empMap } = data;

        const items = deptEmps.filter((e) => (e.designation || "Staff") === designation).map((emp) => ({ log: null, emp, date: null }));

        this._renderStatCardDrilldown("dashboardDesig_" + designation, items, 1);
    }


    _showNewJoinedBreakdownDrilldown(type, value) {
        document.querySelectorAll("[data-nj-company],[data-nj-gender],[data-nj-workforce],[data-nj-age]",).forEach((c) => c.classList.remove("active"));

        const attrMap = {
            company: "data-nj-company",
            gender: "data-nj-gender",
            workforce: "data-nj-workforce",
            age: "data-nj-age",
        };
        const card = this.app.querySelector(`[${attrMap[type]}="${value}"]`);
        if (card) card.classList.add("active");

        const data = this._currentNewJoinedBreakdown;
        if (!data) return;
        const { emps } = data;

        let filtered;
        if (type === "company") {
            filtered = emps.filter((e) => e.company === value);
        } else if (type === "gender") {
            filtered = emps.filter((e) => e.gender === value);
        } else if (type === "workforce") {
            const staffTeamId = AppController.model.state.teamConfig?.staffTeamId ?? 7;
            const workerTeamId = AppController.model.state.teamConfig?.workerTeamId ?? 6;
            filtered = value === "Staff" ? emps.filter((e) => e.team === staffTeamId) : emps.filter((e) => e.team === workerTeamId);
        } else if (type === "age") {
            filtered = emps.filter((e) => AppController.model.getAgeGroup(e.dob) === value,);
        }

        const items = filtered.map((emp) => ({ log: null, emp, date: null }));
        this._renderStatCardDrilldown(`njBreakdown_${type}_${value}`, items, 1, "newjoined-breakdown-drilldown", "AppController.view._closeNewJoinedBreakdownDrilldown()");
    }


    _closeNewJoinedBreakdownDrilldown() {
        const c = document.getElementById("newjoined-breakdown-drilldown");
        if (c) c.innerHTML = "";
        document.querySelectorAll("[data-nj-company],[data-nj-gender],[data-nj-workforce],[data-nj-age]",).forEach((el) => el.classList.remove("active"));
    }


    _showNewJoinedDeptDrilldown(dept) {
        document.querySelectorAll(".stat-card-clickable[data-newjoined-dept]").forEach((c) => c.classList.remove("active"));
        const card = this.app.querySelector(`.stat-card-clickable[data-newjoined-dept="${dept}"]`,);
        if (card) card.classList.add("active");

        const data = this._currentNewJoinedDeptData;
        if (!data) return;

        const deptEmps = data.njEmps.filter((e) => e.dept === dept);

        const desigMap = {};
        deptEmps.forEach((e) => {
            const name = e.designation || "Staff";
            const order = e.designationSortOrder || 0;
            if (!desigMap[name] || order < desigMap[name].order) {
                desigMap[name] = { name, order };
            }
        });
        const desigs = Object.values(desigMap).sort((a, b) => a.order !== b.order ? a.order - b.order : a.name.localeCompare(b.name),).map((d) => d.name);

        const desigCounts = {};
        desigs.forEach((d) => (desigCounts[d] = 0));
        deptEmps.forEach((e) => {
            const name = e.designation || "Staff";
            if (desigCounts[name] !== undefined) desigCounts[name]++;
        });

        this._currentNewJoinedDesigData = { dept, deptEmps };

        const colorCls = ["info", "success", "warning", "accent", "danger"];
        const desigCardsHtml = desigs.map((d, i) => `
            <div class="stat-card ${colorCls[i % colorCls.length]} stat-card-clickable"
                style="flex: 0 1 180px;"
                data-newjoined-desig="${this._escapeAttr(d)}"
                onclick="AppController.view._showNewJoinedDesigDrilldown('${this._escapeAttr(d)}')">
                <div class="stat-icon"><i class="ph ph-identification-badge"></i></div>
                <div class="stat-content">
                    <span class="stat-label">${d}</span>
                    <span class="stat-value">${desigCounts[d]}</span>
                    <span class="stat-card-hint">↓ click to view</span>
                </div>
            </div>
        `,).join("");

        const panel = document.getElementById("newjoined-desig-drilldown");
        if (!panel) return;
        panel.innerHTML = `
            <div style="
                font-size:10px;font-weight:700;text-transform:uppercase;
                letter-spacing:0.08em;color:#9ca3af;margin:20px 0 10px;
                display:flex;align-items:center;gap:8px;
            ">
                BY ${dept.toUpperCase()} DEPARTMENT DESIGNATIONS
                <span style="flex:1;height:1px;background:#e5e7eb;display:block;"></span>
            </div>
            <div class="summary-grid" style="grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));">
                ${desigCardsHtml || '<p style="padding:16px;color:#94a3b8;">No designations found.</p>'}
            </div>
            <div id="newjoined-desig-table-container" style="margin-top:8px;"></div>
        `;
        panel.scrollIntoView({ behavior: "smooth", block: "start" });
    }


    _showResignedBreakdownDrilldown(type, value) {
        document.querySelectorAll("[data-res-company],[data-res-gender],[data-res-workforce],[data-res-age]",).forEach((c) => c.classList.remove("active"));

        const attrMap = {
            company: "data-res-company",
            gender: "data-res-gender",
            workforce: "data-res-workforce",
            age: "data-res-age",
        };
        const card = this.app.querySelector(`[${attrMap[type]}="${value}"]`);
        if (card) card.classList.add("active");

        const data = this._currentResignedBreakdown;
        if (!data) return;
        const { emps } = data;

        let filtered;
        if (type === "company") {
            filtered = emps.filter((e) => e.company === value);
        } else if (type === "gender") {
            filtered = emps.filter((e) => e.gender === value);
        } else if (type === "workforce") {
            filtered = value === "Staff" ? emps.filter((e) => [58].includes(e.categoryId)) : emps.filter((e) => [51, 59, 60].includes(e.categoryId));
        } else if (type === "age") {
            filtered = emps.filter((e) => AppController.model.getAgeGroup(e.dob) === value,);
        }

        const items = filtered.map((emp) => ({ log: null, emp, date: null }));
        this._renderStatCardDrilldown(`resBreakdown_${type}_${value}`, items, 1, "resigned-breakdown-drilldown", "AppController.view._closeResignedBreakdownDrilldown()");
    }


    _closeResignedBreakdownDrilldown() {
        const c = document.getElementById("resigned-breakdown-drilldown");
        if (c) c.innerHTML = "";
        document.querySelectorAll("[data-res-company],[data-res-gender],[data-res-workforce],[data-res-age]",).forEach((el) => el.classList.remove("active"));
    }


    _showResignedDeptDrilldown(dept) {
        document.querySelectorAll(".stat-card-clickable[data-resigned-dept]").forEach((c) => c.classList.remove("active"));
        const card = this.app.querySelector(`.stat-card-clickable[data-resigned-dept="${dept}"]`,);
        if (card) card.classList.add("active");

        const data = this._currentResignedDeptData;
        if (!data) return;

        const deptEmps = data.resEmps.filter((e) => e.dept === dept);

        const desigMap = {};
        deptEmps.forEach((e) => {
            const name = e.designation || "Staff";
            const order = e.designationSortOrder || 0;
            if (!desigMap[name] || order < desigMap[name].order) {
                desigMap[name] = { name, order };
            }
        });
        const desigs = Object.values(desigMap).sort((a, b) => a.order !== b.order ? a.order - b.order : a.name.localeCompare(b.name),).map((d) => d.name);

        const desigCounts = {};
        desigs.forEach((d) => (desigCounts[d] = 0));
        deptEmps.forEach((e) => {
            const name = e.designation || "Staff";
            if (desigCounts[name] !== undefined) desigCounts[name]++;
        });

        this._currentResignedDesigData = { dept, deptEmps };

        const colorCls = ["info", "success", "warning", "accent", "danger"];
        const desigCardsHtml = desigs.map((d, i) => `
            <div class="stat-card ${colorCls[i % colorCls.length]} stat-card-clickable"
                style="flex: 0 1 180px;"
                data-resigned-desig="${this._escapeAttr(d)}"
                onclick="AppController.view._showResignedDesigDrilldown('${this._escapeAttr(d)}')">
                <div class="stat-icon"><i class="ph ph-identification-badge"></i></div>
                <div class="stat-content">
                    <span class="stat-label">${d}</span>
                    <span class="stat-value">${desigCounts[d]}</span>
                    <span class="stat-card-hint">↓ click to view</span>
                </div>
            </div>
        `,).join("");

        const panel = document.getElementById("resigned-desig-drilldown");
        if (!panel) return;
        panel.innerHTML = `
            <div style="
                font-size:10px;font-weight:700;text-transform:uppercase;
                letter-spacing:0.08em;color:#9ca3af;margin:20px 0 10px;
                display:flex;align-items:center;gap:8px;
            ">
                BY ${dept.toUpperCase()} DEPARTMENT DESIGNATIONS
                <span style="flex:1;height:1px;background:#e5e7eb;display:block;"></span>
            </div>
            <div class="summary-grid" style="grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));">
                ${desigCardsHtml || '<p style="padding:16px;color:#94a3b8;">No designations found.</p>'}
            </div>
            <div id="resigned-desig-table-container" style="margin-top:8px;"></div>
        `;
        panel.scrollIntoView({ behavior: "smooth", block: "start" });
    }


    _showResignedDesigDrilldown(designation) {
        document.querySelectorAll(".stat-card-clickable[data-resigned-desig]").forEach((c) => c.classList.remove("active"));
        const card = this.app.querySelector(`.stat-card-clickable[data-resigned-desig="${designation}"]`,);
        if (card) card.classList.add("active");

        const data = this._currentResignedDesigData;
        if (!data) return;
        const { deptEmps } = data;

        const items = deptEmps.filter((e) => (e.designation || "Staff") === designation).map((emp) => ({ log: null, emp, date: null }));

        this._renderStatCardDrilldown("resignedDesig_" + designation, items, 1, "resigned-desig-table-container", "AppController.view._closeResignedDesigTable()",);
    }


    _closeResignedDesigTable() {
        const c = document.getElementById("resigned-desig-table-container");
        if (c) c.innerHTML = "";
        document.querySelectorAll(".stat-card-clickable[data-resigned-desig]").forEach((el) => el.classList.remove("active"));
    }


    _showNewJoinedDesigDrilldown(designation) {
        document.querySelectorAll(".stat-card-clickable[data-newjoined-desig]").forEach((c) => c.classList.remove("active"));
        const card = this.app.querySelector(`.stat-card-clickable[data-newjoined-desig="${designation}"]`,);
        if (card) card.classList.add("active");

        const data = this._currentNewJoinedDesigData;
        if (!data) return;
        const { deptEmps } = data;

        const items = deptEmps.filter((e) => (e.designation || "Staff") === designation).map((emp) => ({ log: null, emp, date: null }));

        this._renderStatCardDrilldown("newjoinedDesig_" + designation, items, 1, "newjoined-desig-table-container", "AppController.view._closeNewJoinedDesigTable()",);
    }


    _closeNewJoinedDesigTable() {
        const c = document.getElementById("newjoined-desig-table-container");
        if (c) c.innerHTML = "";
        document.querySelectorAll(".stat-card-clickable[data-newjoined-desig]").forEach((el) => el.classList.remove("active"));
    }


    _closeDashboardDesigTable() {
        const c = document.getElementById("dashboard-desig-table-container");
        if (c) c.innerHTML = "";
        document.querySelectorAll(".stat-card-clickable[data-dashboard-desig]").forEach((el) => el.classList.remove("active"));
    }


    _renderTabContent(tabId, logs, emps, empMap, filters, counts, model) {
        let content;
        const stats = model.getSummaryStats();
        switch (tabId) {
            case "feature":
                content = { html: "" };
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
            case "latein":
                content = this._renderLateIn(logs, emps, empMap, model);
                break;
            case "earlyout":
                content = this._renderEarlyOut(logs, emps, empMap, model);
                break;
            case "night":
                const nightData = model.getNightShiftData();
                content = this._renderNightShift(nightData.logs, nightData.emps, nightData.empMap, model);
                break;
            case "designation":
                content = this._renderDesignationWise(logs, emps, empMap, model);
                break;
            case "shift":
                content = this._renderShiftWise(logs, emps, empMap, model);
                break;
            case "manual_punch":                           
                content = this._renderManualPunchesTab(logs, emps, empMap, model);
                break;
            case "staff":
                content = this._renderStaff(logs, emps, empMap, model);
                break;
            case "worker":
                content = this._renderWorker(logs, emps, empMap, model);
                break;
            case "resigned":
                content = this._renderJoinExitTab(model, "resigned");
                break;
            case "newjoined":
                content = this._renderJoinExitTab(model, "newjoined");
                break;
            case "overtime":
                content = this._renderOvertime(logs, emps, empMap, model);
                break;
            case "special":
                content = this._renderSpecial(logs, emps, empMap, filters, model);
                break;
            case "data_quality":
                content = this._renderDataQuality(logs, emps, empMap, filters, model);
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
            case "sort_order":
                content = {
                    html: `
                        <div class="designation-order-container">
                            <h2 class="section-title"><i class="ph-fill ph-sort-ascending"></i> Company & Department Sort Order</h2>
                            <div id="sort-order-content">
                                <div style="display:flex; align-items:center; gap:12px; padding:32px; color:#64748b;">
                                    <div class="auth-spinner" style="width:24px; height:24px; border-width:2px; border-top-color:#6366f1;"></div>
                                    <span>Loading data...</span>
                                </div>
                            </div>
                        </div>
                    `,
                };
                break;
            case "designation_families":
                content = {
                    html: `
                        <div class="designation-order-container">
                            <h2 class="section-title"><i class="ph-fill ph-cards"></i> Designation Families</h2>
                            <div id="designation-families-content">
                                <div style="display:flex; align-items:center; gap:12px; padding:32px; color:#64748b;">
                                    <div class="auth-spinner" style="width:24px; height:24px; border-width:2px; border-top-color:#6366f1;"></div>
                                    <span>Loading designation families...</span>
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


    _initChartRendering(tabId, logs, emps, empMap, filters, counts, model, renderToken) {
        if (tabId === "designation_order") {
            this._initDesignationOrderTab(model);
            return;
        }
        if (tabId === "sort_order") {
            setTimeout(() => this._initSortOrderTab(model), 50);
            return;
        }
        if (tabId === "designation_families") {
            this._initDesignationFamiliesTab(model);
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
        const fields = ["company", "dept", "shift", "location"];
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
                    location: document.getElementById("f-location").value,
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
        if (!window.XLSX) {
            console.error("SheetJS not loaded");
            return;
        }

        const cleanData = data.map((row) => {
            const cleaned = {};
            Object.keys(row).forEach((key) => {
                let val = row[key];
                if (typeof val === "string") {
                    val = val.replace(/\u00A0/g, "").replace(/\r/g, "").replace(/\n/g, "").replace(/\t/g, "").trim().replace(/\s+/g, " ");
                }
                cleaned[key] = val;
            });
            return cleaned;
        });

        const ws = XLSX.utils.json_to_sheet(cleanData);
        
        const wb = XLSX.utils.book_new();

        wb.Workbook = {
            CalcPr: {
                calcMode: "auto",
                fullCalcOnLoad: true,
                forceFullCalc: true
            }
        };

        XLSX.utils.book_append_sheet(wb, ws, "Report");
        XLSX.writeFile(wb, `${filename}.xlsx`);
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

        const singlePunchKeys = window.AppController && AppController.model ? AppController.model.state.data.singlePunchKeys || new Set() : new Set();
        const singlePunchData = window.AppController && AppController.model ? AppController.model.state.data.singlePunchData || {} : {};

        emps.forEach((e) => {
            dates.forEach((date) => {
                const key = e.id + "_" + date;
                const log = logMap[key];
                if (singlePunchKeys.has(key)) {
                    const punchInfo = singlePunchData[key] || {};
                    result.push({
                        empId: e.id,
                        date: date,
                        inTime: punchInfo.direction === "in" ? punchInfo.time : (log ? log.inTime : null),
                        outTime: punchInfo.direction === "out" ? punchInfo.time : (log ? log.outTime : null),
                        status: "Single Punch",
                        detailedStatus: "Single Punch",
                        detailedStatusCode: "SP",
                        present: 0,
                        absent: 0,
                        weeklyOff: 0,
                        hoursWorked: log ? (log.hoursWorked || 0) : 0,
                        lateBy: 0,
                        earlyBy: 0,
                        shiftId: (log ? log.shiftId : e.shiftId) || null,
                        shiftName: (log && log.shiftName) || e.shift || "No Shift",
                        shiftStart: punchInfo.shiftStart || (log ? log.shiftStart : null),
                        shiftEnd: punchInfo.shiftEnd || (log ? log.shiftEnd : null),
                    });
                } else if (log) {
                    result.push(log);
                } else {
                    result.push({
                        empId: e.id,
                        date: date,
                        inTime: null,
                        outTime: null,
                        status: "Absent",
                        detailedStatus: "Absent",
                        detailedStatusCode: "A",
                        present: 0,
                        absent: 1,
                        weeklyOff: 0,
                        holiday: 0,
                        isOnLeave: 0,
                        hoursWorked: 0,
                        lateBy: 0,
                        earlyBy: 0,
                        missedInPunch: 0,
                        missedOutPunch: 0,
                        shiftStart: e.shiftStart || null,
                        shiftEnd: e.shiftEnd || null,
                        shiftGroupName: e.shiftGroupName || null,
                        shiftName: e.shift || "No Shift",
                    });
                }
            });
        });

        // Check duplicate employee-date records
        const duplicateMap = {};

        result.forEach(r => {
            const key = r.empId + "_" + r.date;
            duplicateMap[key] = (duplicateMap[key] || 0) + 1;
        });

        let duplicateCount = 0;

        Object.keys(duplicateMap).forEach(key => {
            if (duplicateMap[key] > 1) {
                duplicateCount++;
            }
        });

        // Count Present/Half Present records
        const presentRecords = result.filter(r => this._matchesStatus(r, "Present") || this._matchesStatus(r, "Half Present"));


        // ===== ADD FROM HERE =====

        // Count each status separately
        const statusCounts = {};

        presentRecords.forEach(r => {
            const status = r.status || "No Status";
            statusCounts[status] = (statusCounts[status] || 0) + 1;
        });

        return result;
    }


    _buildShiftStatsLogs(emps, logs, dateFrom, dateTo) {
       const logMap = {};
        logs.forEach((l) => {
            const key = `${l.empId}_${l.date}`;
            const existing = logMap[key];

            if (!existing || Number(l.present) > Number(existing.present)) {
                logMap[key] = l;
            }
        });

        const dates = this._getDateRange(dateFrom, dateTo);
        const result = [];

        const singlePunchKeys = window.AppController?.model?.state?.data?.singlePunchKeys || new Set();
        const singlePunchData = window.AppController?.model?.state?.data?.singlePunchData || {};

        emps.forEach((emp) => {
            dates.forEach((date) => {
                const key = `${emp.id}_${date}`;
                const log = logMap[key];

                if (singlePunchKeys.has(key)) {
                    const punch = singlePunchData[key] || {};
                    result.push({
                        empId: emp.id,
                        date,
                        inTime: punch.direction === "in" ? punch.time : log?.inTime || null,
                        outTime: punch.direction === "out" ? punch.time : log?.outTime || null,
                        status: "Single Punch",
                        detailedStatus: "Single Punch",
                        detailedStatusCode: "SP",
                        present: 0,
                        absent: 0,
                        weeklyOff: 0,
                        holiday: 0,
                        isOnLeave: 0,
                        hoursWorked: log?.hoursWorked || 0,
                        lateBy: 0,
                        earlyBy: 0,
                        shiftId: log?.shiftId ?? emp.shiftId ?? null,
                        shiftName: log?.shiftName ?? emp.shift ?? "No Shift",
                        shiftGroupName: log?.shiftGroupName ?? emp.shiftGroupName ?? "",
                        shiftStart: punch.shiftStart ?? log?.shiftStart ?? emp.shiftStart ?? null,
                        shiftEnd: punch.shiftEnd ?? log?.shiftEnd ?? emp.shiftEnd ?? null,
                    });

                    return;
                }

                if (log) {
                    result.push({
                        ...log,
                        shiftId: log.shiftId ?? emp.shiftId ?? null,
                        shiftName: log.shiftName ?? emp.shift ?? "No Shift",
                        shiftGroupName: log.shiftGroupName ?? emp.shiftGroupName ?? "",
                        shiftStart: log.shiftStart ?? emp.shiftStart ?? null,
                        shiftEnd: log.shiftEnd ?? emp.shiftEnd ?? null,
                    });

                    return;
                }

                result.push({
                    empId: emp.id,
                    date,
                    inTime: null,
                    outTime: null,
                    status: "Absent",
                    detailedStatus: "Absent",
                    detailedStatusCode: "A",
                    present: 0,
                    absent: 1,
                    weeklyOff: 0,
                    holiday: 0,
                    isOnLeave: 0,
                    hoursWorked: 0,
                    lateBy: 0,
                    earlyBy: 0,
                    missedInPunch: 0,
                    missedOutPunch: 0,
                    shiftId: emp.shiftId ?? null,
                    shiftName: emp.shift ?? "No Shift",
                    shiftGroupName: emp.shiftGroupName ?? "",
                    shiftStart: emp.shiftStart ?? null,
                    shiftEnd: emp.shiftEnd ?? null,
                });
            });
        });

        const duplicateMap = {};
        result.forEach((r) => {
            const key = `${r.empId}_${r.date}`;
            duplicateMap[key] = (duplicateMap[key] || 0) + 1;
        });

        const duplicateCount = Object.values(duplicateMap).filter(c => c > 1).length;

        console.log("Shift Stats Logs:", result.length);
        console.log("Duplicate Employee-Date:", duplicateCount);

        return result;
    }


    _computeGroupedDayStats(emps, logs, dateFrom, dateTo, groupKeyFn) {
        const dayLogs = this._buildEmployeeDayLogs(emps, logs, dateFrom, dateTo);
        const empGroupMap = {};
        emps.forEach((e) => { empGroupMap[e.id] = groupKeyFn(e); });

        const groups = {};
        emps.forEach((e) => {
            const g = groupKeyFn(e);
            if (!groups[g]) {
                groups[g] = {
                    total: 0, present: 0, halfPresent: 0, weeklyOffPresent: 0,
                    weeklyOffHalfPresent: 0, weeklyOff: 0, holiday: 0, leave: 0,
                    absent: 0, singlePunch: 0   // ← ADD
                };
            }
        });

        dayLogs.forEach((log) => {
            const g = empGroupMap[log.empId];
            if (g === undefined) return;
            groups[g].total++;

            if (log.status === "Single Punch") {
                groups[g].singlePunch++;
                return;
            }

            const code = (log.detailedStatusCode || "").toUpperCase().trim();
            const isWeeklyOff = parseInt(log.weeklyOff ?? 0) === 1;

            switch (code) {
                case "P":
                    groups[g].present++;
                    break;

                case "½PLD":
                case "L_CL":
                case "½PCL":
                case "½PLD(HO)":
                    groups[g].halfPresent++;
                    break;

                case "WO":
                    groups[g].weeklyOff++;
                    break;

                case "WOP":
                    isWeeklyOff ? groups[g].weeklyOffPresent++ : groups[g].present++;
                    break;

                case "½PLD(WO)":
                    isWeeklyOff ? groups[g].weeklyOffHalfPresent++ : groups[g].halfPresent++;
                    break;

                case "A":
                case "ALD":
                case "WOA":
                default:
                    groups[g].absent++;
                    break;
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

    
    _tableHTML(id, headers, rows, exportName, startIndex = 0) {
        const ths = `<th class="sr-col">Sr No</th>` + headers.map((h) => `<th>${h}</th>`).join("");

        const trs = rows.map((r, index) => `
            <tr>
                <td class="sr-col">${startIndex + index + 1}</td>
                ${r.map((c) => `<td>${c}</td>`).join("")}
            </tr>
        `,).join("");

        return `
            <div id="main-table-wrap">
                <div class="table-wrap">
                    <div class="table-header">
                        <h3>📄 Detail Records</h3>
                        <div class="table-actions">
                            <button class="btn-tbl btn-tbl-excel" onclick="AppController.view.exportExcel(AppController.view._lastData['${exportName}'], '${exportName}')">
                                ↓ Excel
                            </button>
                         <button class="btn-tbl btn-tbl-pdf" onclick="AppController.view.exportPDF('${exportName}')">
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
                Charts.donut("ch-feat-io", ["In Punches", "Out Punches"], [counts.in || 0, counts.out || 0], "In vs Out");
            },
        };
    }

    
    _renderAll(logs, emps, empMap, filters, page = 1) {
        this._currentAllLogs = logs;
        this._currentAllEmps = emps;
        this._currentAllEmpMap = empMap;
        this._currentAllFilters = filters;

        const { dateFrom, dateTo } = filters;
        const dayLogs = this._buildEmployeeDayLogs(emps, logs, dateFrom, dateTo);

        const pageSize = 25;
        const currentPage = page;
        const totalPages = Math.ceil(dayLogs.length / pageSize);
        const pageLogs = dayLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize,)

        const rows = pageLogs.map((l) => {
            const e = empMap[l.empId] || {};
            return [
                e.code || "-",
                e.name || "-",
                e.company || "-",
                e.dept || "-",
                e.designation || "-",
                e.shiftGroupName || "-",
                l.shiftName || e.shift || "-",
                l.inTime || "-",
                l.outTime || "-",
                `<span class="badge ${l.status === "Present" ? "badge-success" : "badge-danger"}">${l.status || "-"}</span>`,
                this._actionViewLink(l, e, l.date),
            ];
        });

        this._lastData["all-attendance"] = dayLogs.map((l) => {
            const e = empMap[l.empId] || {};
            return {
                Code: e.code,
                Name: e.name,
                Dept: e.dept,
                Company: e.company,
                Date: this._formatDate(l.date),
                In: l.inTime,
                Out: l.outTime,
                Hours: l.hoursWorked,
                LateIn: Number(l.lateBy) > 0 ? "Yes" : "No",
                EarlyOut: Number(l.earlyBy) > 0 ? "Yes" : "No",
                Status: l.status,
                DetailedStatus: l.detailedStatus,
                DOB: this._formatDate(e.dobRaw),
                Overtime: l.overtime || 0,
            };
        });

        // ── Date-wise status breakdown (Present / Half Present / Weekly Off / Absent) ──
        const dates = [...new Set(logs.map((l) => l.date))].sort();
        const formattedDates = dates.map((d) => this._formatDate(d));

        const presentByDate = {};
        const halfByDate = {};
        const woPresentByDate = {};
        const woHalfPresentByDate = {};
        const woByDate = {};
        const singlePunchByDate = {};
        const absentByDate = {};

        dates.forEach((d) => {
            presentByDate[d] = 0;
            halfByDate[d] = 0;
            woPresentByDate[d] = 0;
            woHalfPresentByDate[d] = 0;
            woByDate[d] = 0;
            singlePunchByDate[d] = 0;
            absentByDate[d] = 0;
        });

        dayLogs.forEach((l) => {
            if (this._matchesStatus(l, "Present"))
                presentByDate[l.date]++;

            else if (this._matchesStatus(l, "Half Present"))
                halfByDate[l.date]++;

            else if (this._matchesStatus(l, "WO Present"))
                woPresentByDate[l.date]++;

            else if (this._matchesStatus(l, "WO Half Present"))
                woHalfPresentByDate[l.date]++;

            else if (this._matchesStatus(l, "Weekly Off"))
                woByDate[l.date]++;

            else if (this._matchesStatus(l, "Single Punch"))
                singlePunchByDate[l.date]++;

            else
                absentByDate[l.date]++;
        });

        const byDept = this._countBy(logs, (l) => (empMap[l.empId] || {}).dept || "Unknown",);

        // ── In vs Out punch counts (moved here from Dashboard tab) ──
        const summaryStats = AppController.model.getSummaryStats();

        const totalIn = summaryStats.filteredIn;
        const totalOut = summaryStats.filteredOut;

        let pageButtons = "";
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, currentPage + 2);
        for (let i = startPage; i <= endPage; i++) {
            pageButtons += `
                <button class="btn-page ${i === currentPage ? "btn-page-active" : ""}" onclick="AppController.view._reRenderAllPage(${i})">
                    ${i}
                </button>
            `;
        }

        return {
            html: `
                <h2 class="section-title"><i class="ph-fill ph-stack"></i> All Attendance Records</h2>
                <div class="charts-grid">
                    ${this._chartCard("ch-all-trend", '<i class="ph ph-trend-up"></i>', "violet", "Daily Attendance Trend", "Click a segment for detail")}
                    ${this._chartCard("ch-all-dept", '<i class="ph ph-briefcase"></i>', "teal", "By Department (Punches)", "Click for detail")}
                </div>

                <h2 class="section-title" style="margin-top:32px;"><i class="ph-fill ph-chart-bar"></i> Employee Entry/Exit Overview</h2>
                <div style="display:flex; gap:24px; margin-bottom:24px; align-items:stretch;">
                    <div style="flex:0 0 280px; display:flex; flex-direction:column; gap:16px;">
                        <div id="card-total-in" class="stat-card info stat-card-clickable" style="flex:1; cursor:pointer;" data-punch-type="in"">
                            <div class="stat-icon"><i class="ph ph-sign-in"></i></div>
                            <div class="stat-content">
                                <span class="stat-label">Total In Punches</span>
                                <span class="stat-value">${totalIn}</span>
                                <span class="stat-card-hint">↓ click to view</span>
                            </div>
                        </div>
                        <div id="card-total-out" class="stat-card accent stat-card-clickable" style="flex:1; cursor:pointer;" data-punch-type="out"">
                            <div class="stat-icon"><i class="ph ph-sign-out"></i></div>
                            <div class="stat-content">
                                <span class="stat-label">Total Out Punches</span>
                                <span class="stat-value">${totalOut}</span>
                                <span class="stat-card-hint">↓ click to view</span>
                            </div>
                        </div>
                        <!-- card-manual-punches removed — already shown in the top summary row -->
                    </div>
                    <div style="flex:1; min-width:0;">
                        ${this._chartCard("ch-all-io", '<i class="ph-fill ph-chart-pie-slice"></i>', "sky", "In vs Out Distribution")}
                    </div>
                </div>

                <div id="main-table-wrap">
                    ${this._tableHTML("tbl-all", ["Code", "Name", "Company", "Department", "Designation", "Shift Group", "Shift", "In Time", "Out Time", "Status", "Action"], rows, "all-attendance", (currentPage - 1) * pageSize)}
                    <div class="pagination-bar">
                        <div class="pagination-text">
                            Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, dayLogs.length)} of ${dayLogs.length} records &nbsp;·&nbsp; Page ${currentPage} of ${totalPages}
                        </div>
                        <div class="pagination-buttons">
                            <button class="btn-page" ${currentPage === 1 ? "disabled" : ""} onclick="AppController.view._reRenderAllPage(1)">«</button>
                            <button class="btn-page" ${currentPage === 1 ? "disabled" : ""} onclick="AppController.view._reRenderAllPage(${currentPage - 1})">‹</button>
                            ${pageButtons}
                            <button class="btn-page" ${currentPage === totalPages ? "disabled" : ""} onclick="AppController.view._reRenderAllPage(${currentPage + 1})">›</button>
                            <button class="btn-page" ${currentPage === totalPages ? "disabled" : ""} onclick="AppController.view._reRenderAllPage(${totalPages})">»</button>
                        </div>
                    </div>
                </div>
                
                <div id="drilldown-table" style="margin-top:16px"></div>
            `,

            renderCharts: () => {
                Charts.stacked(
                    "ch-all-trend",
                    formattedDates,
                    [
                        { name: "Present", data: dates.map((d) => presentByDate[d]) },
                        { name: "Half Present", data: dates.map((d) => halfByDate[d]) },
                        { name: "WO Present", data: dates.map((d) => woPresentByDate[d]) },
                        { name: "WO Half Present", data: dates.map((d) => woHalfPresentByDate[d]) },
                        { name: "Weekly Off", data: dates.map((d) => woByDate[d]) },
                        { name: "Single Punch", data: dates.map((d) => singlePunchByDate[d]) },
                        { name: "Absent", data: dates.map((d) => absentByDate[d]) },
                    ],
                    "Daily Attendance",
                    (category, index, seriesIndex, seriesName) => {
                        const dateVal = dates[index];
                        const filteredLogs = dayLogs.filter((l) => l.date === dateVal && this._matchesStatus(l, seriesName),);
                        this._renderDrillDown(filteredLogs, `Date: ${formattedDates[index]} - ${seriesName}`, empMap);
                    },
                );
                Charts.donut(
                    "ch-all-dept",
                    Object.keys(byDept),
                    Object.values(byDept),
                    "Dept Distribution",
                    (dept) => this._renderDrillDown(logs.filter((l) => (empMap[l.empId] || {}).dept === dept,), `Department: ${dept}`, empMap),
                );
                // In vs Out donut (moved here from Dashboard tab)
                Charts.donut("ch-all-io", ["In Punches", "Out Punches"], [totalIn, totalOut], "In vs Out");

                document.getElementById("card-total-in")?.addEventListener("click", () => {
                    const inPunchLogs = logs.filter(l => (parseFloat(l.present) > 0 || l.missedOutPunch == 1) && l.isManualPunch !== 1);
                    this._renderDrillDown(inPunchLogs, "Total In Punches", empMap);
                });

                document.getElementById("card-total-out")?.addEventListener("click", () => {
                    const outPunchLogs = logs.filter(l => parseFloat(l.present) > 0 && l.missedInPunch != 1 && l.isManualPunch !== 1);
                    this._renderDrillDown(outPunchLogs, "Total Out Punches", empMap);
                });
            },
        };
    }

    
    _reRenderAllPage(page) {
        const content = this._renderAll(
            this._currentAllLogs,
            this._currentAllEmps,
            this._currentAllEmpMap,
            this._currentAllFilters,
            page
        );
        document.querySelector(".tab-pane-container").innerHTML = content.html;
        content.renderCharts();
    }


    _renderDrillDown(logs, title, empMap, page = 1) {
        logs = [...logs].sort((a, b) => {
            const ageA = this._getAgeSortValue((empMap[a.empId] || {}).dobRaw);
            const ageB = this._getAgeSortValue((empMap[b.empId] || {}).dobRaw);
            return ageB - ageA;
        });

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
        const pageLogs = logs.slice((currentPage - 1) * pageSize, currentPage * pageSize,);

        const rows = pageLogs.map((l, index) => {
            const e = empMap[l.empId] || {};
            return `
                <tr>
                    <td>${(currentPage - 1) * pageSize + index + 1}</td>
                    <td><b>${e.code || "–"}</b></td>
                    <td>${e.name || "–"}</td>
                    <td>${e.company || "–"}</td>
                    <td>${e.dept || "–"}</td>
                    <td>${e.designation || "–"}</td>
                    <td>${this._calculateAge(e.dobRaw)}</td>
                    <td>${e.shiftGroupName || "–"}</td>
                    <td>${l.shiftName || e.shift || "–"}</td>
                    <td>${l.inTime || "–"}</td>
                    <td>${l.outTime || "–"}</td>
                    <td>${l.status || "–"}</td>
                    <td>${this._actionViewLink(l, e, l.date)}</td>
                </tr>
            `;
        }).join("");

        this._drillData = logs.map((l) => {
            const e = empMap[l.empId] || {};
            return {
                Code: e.code,
                Name: e.name,
                Dept: e.dept,
                Company: e.company,
                TeamName: e.teamName,
                Shift: e.shift,
                ShiftStart: l.shiftStart || "",
                ShiftEnd: l.shiftEnd || "",
                Date: this._formatDate(l.date),
                In: l.inTime,
                Out: l.outTime,
                Hours: l.hoursWorked,
                Late: (l.lateBy || 0) > 0 ? "Yes" : "No",
                Early: (l.earlyBy || 0) > 0 ? "Yes" : "No",
                Status: l.status,
                DetailedStatus: l.detailedStatus,
                DOB: this._formatDate(e.dobRaw),
                Overtime: l.overtime || 0,
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
								<th>Company</th>
								<th>Department</th>
                                <th>Designation</th>
                                <th>Age</th>
                                <th>Shift Group</th>
                                <th>Shift</th>
								<th>In Time</th>
								<th>Out Time</th>
								<th>Status</th>
								<th>Action</th>
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

    
    closeDrillDown() {
        const d = document.getElementById("drilldown-table");
        if (d) d.innerHTML = "";
        const m = document.getElementById("main-table-wrap");
        if (m) m.style.display = "";
    }


    _renderManualPunchDrilldown(items, title, page = 1) {
        this._manualPunchItems = items;
        this._manualPunchTitle = title;

        const container = document.getElementById("drilldown-table");
        if (!container) return;
        const mainWrap = document.getElementById("main-table-wrap");
        if (mainWrap) mainWrap.style.display = "none";

        if (!items || items.length === 0) {
            container.innerHTML = `
                <div class="drilldown-box">
                    <div class="drilldown-header">
                        <span class="drilldown-title">🔍 ${title}</span>
                        <div class="drilldown-btn-group">
                            <button class="btn-drill btn-drill-back" onclick="AppController.view.closeDrillDown()">← Back</button>
                        </div>
                    </div>
                    <p style="padding:32px; color:#6b7280;">No manual punches found.</p>
                </div>
            `;
            container.scrollIntoView({ behavior: "smooth", block: "start" });
            return;
        }

        const pageSize = 25;
        const currentPage = page;
        const totalPages = Math.ceil(items.length / pageSize);
        const pageItems = items.slice((currentPage - 1) * pageSize, currentPage * pageSize);

        const rows = pageItems.map(({ log, emp, date }, i) => `
            <tr>
                <td>${(currentPage - 1) * pageSize + i + 1}</td>
                <td><b>${emp.code || "–"}</b></td>
                <td>${emp.name || "–"}</td>
                <td>${emp.dept || "–"}</td>
                <td>${emp.company || "–"}</td>
                <td>${this._formatDate(date)}</td>
                <td>${log.inTime || "–"}</td>
                <td>${log.outTime || "–"}</td>
                <td>${log.punchDevicesName || "–"}</td>
                <td>${this._formatDate(emp.dobRaw)}</td>
                <td>${(log.overtime || 0) > 0 ? this._fmtMins(log.overtime) : "–"}</td>
                <td>${this._actionViewLink(log, emp, date)}</td>
            </tr>
        `).join("");

        this._manualPunchExportData = items.map(({ log, emp, date }) => ({
            Code: emp.code,
            Name: emp.name,
            Dept: emp.dept,
            Company: emp.company,
            Date: this._formatDate(date),
            In: log.inTime,
            Out: log.outTime,
            Device: log.punchDevicesName,
            DOB: this._formatDate(emp.dobRaw),
            Overtime: log.overtime || 0,
        }));

        let pageButtons = "";
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, currentPage + 2);
        for (let i = startPage; i <= endPage; i++) {
            pageButtons += `
                <button class="btn-page ${i === currentPage ? "btn-page-active" : ""}"
                    onclick="AppController.view._renderManualPunchDrilldown(AppController.view._manualPunchItems, AppController.view._manualPunchTitle, ${i})">
                    ${i}
                </button>
            `;
        }

        container.innerHTML = `
            <div class="drilldown-box">
                <div class="drilldown-header">
                    <div class="drilldown-title">
                        🔍 ${title}
                        <small>${items.length} records</small>
                    </div>
                    <div class="drilldown-btn-group">
                        <button class="btn-drill btn-drill-excel"
                            onclick="AppController.view.exportExcel(AppController.view._manualPunchExportData, 'manual-punches')">
                            ↓ Excel
                        </button>
                        <button class="btn-drill btn-drill-back" onclick="AppController.view.closeDrillDown()">
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
                                <th>Date</th>
                                <th>In</th>
                                <th>Out</th>
                                <th>Device</th>
                                <th>DOB</th>
                                <th>Overtime</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>

                <div class="pagination-bar">
                    <div class="pagination-text">
                        Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, items.length)} of ${items.length} records &nbsp;·&nbsp; Page ${currentPage} of ${totalPages}
                    </div>
                    <div class="pagination-buttons">
                        <button class="btn-page" ${currentPage === 1 ? "disabled" : ""}
                            onclick="AppController.view._renderManualPunchDrilldown(AppController.view._manualPunchItems, AppController.view._manualPunchTitle, 1)">«</button>
                        <button class="btn-page" ${currentPage === 1 ? "disabled" : ""}
                            onclick="AppController.view._renderManualPunchDrilldown(AppController.view._manualPunchItems, AppController.view._manualPunchTitle, ${currentPage - 1})">‹</button>
                        ${pageButtons}
                        <button class="btn-page" ${currentPage === totalPages ? "disabled" : ""}
                            onclick="AppController.view._renderManualPunchDrilldown(AppController.view._manualPunchItems, AppController.view._manualPunchTitle, ${currentPage + 1})">›</button>
                        <button class="btn-page" ${currentPage === totalPages ? "disabled" : ""}
                            onclick="AppController.view._renderManualPunchDrilldown(AppController.view._manualPunchItems, AppController.view._manualPunchTitle, ${totalPages})">»</button>
                    </div>
                </div>
            </div>
        `;
        container.scrollIntoView({ behavior: "smooth", block: "start" });
    }


    _escapeAttr(str) {
        return String(str).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
        const tickValues = tickPercents.map((p) => Math.round((p / 100) * niceMax),);

        const rowsHtml = depts.map((d, i) => {
            const r = rows[i];
            const total = r[1] || 1;
            const present = r[2], half = r[3], woPresent = r[4], woHalfPresent = r[5], wo = r[6], singlePunch = r[7], absent = r[8];
            const scale = (r[1] / niceMax) * 100;
            const pPct = (present / total) * 100;
            const hPct = (half / total) * 100;
            const wpPct = (woPresent / total) * 100;
            const whPct = (woHalfPresent / total) * 100;
            const wPct = (wo / total) * 100;
            const spPct = (singlePunch / total) * 100;
            const aPct = (absent / total) * 100;

            return `
                <div class="dept-acc-row">
                    <div class="dept-acc-header" data-dept="${this._escapeAttr(d)}" data-present="${present}" data-half="${half}" data-wopresent="${woPresent}" data-wohalfpresent="${woHalfPresent}" data-weeklyoff="${wo}" data-single="${singlePunch}" data-absent="${absent}" data-total="${total}">
                        <div class="dept-acc-label">${d}</div>
                        <div class="dept-acc-track">
                            ${ticks.map((t) => `<div class="dept-acc-gridline" style="left:${(t / niceMax) * 100}%"></div>`).join("")}
                            <div class="dept-acc-bar-wrap" style="width:${scale.toFixed(2)}%">
                                <div class="dept-acc-bar">
                                    ${present > 0 ? `<div class="dept-acc-seg present" data-status="Present" style="width:${pPct}%">${present}</div>` : ""}
                                    ${half > 0 ? `<div class="dept-acc-seg half" data-status="Half Present" style="width:${hPct}%">${half}</div>` : ""}
                                    ${woPresent > 0 ? `<div class="dept-acc-seg wopresent" data-status="WO Present" style="width:${wpPct}%">${woPresent}</div>` : ""}
                                    ${woHalfPresent > 0 ? `<div class="dept-acc-seg wohalfpresent" data-status="WO Half Present" style="width:${whPct}%">${woHalfPresent}</div>` : ""}
                                    ${wo > 0 ? `<div class="dept-acc-seg weeklyoff" data-status="Weekly Off" style="width:${wPct}%">${wo}</div>` : ""}
                                    ${singlePunch > 0 ? `<div class="dept-acc-seg single" data-status="Single Punch" style="width:${spPct}%">${singlePunch}</div>` : ""}
                                    ${absent > 0 ? `<div class="dept-acc-seg absent" data-status="Absent" style="width:${aPct}%">${absent}</div>` : ""}
                                </div>
                            </div>
                        </div>
                        <i class="ph ph-caret-down dept-acc-caret"></i>
                    </div>
                    <div class="dept-acc-expand" id="dept-acc-expand-${i}" style="display:none;"></div>
                </div>
            `;
        }).join("");

        return `
			<div class="dept-accordion">
                <div class="dept-acc-legend">
					<span data-legend="present"><i class="dot present"></i>Present</span>
					<span data-legend="half"><i class="dot half"></i>Half Present</span>
					<span data-legend="wopresent"><i class="dot wopresent"></i>WO Present</span>
					<span data-legend="wohalfpresent"><i class="dot wohalfpresent"></i>WO Half Present</span>
					<span data-legend="weeklyoff"><i class="dot weeklyoff"></i>Weekly Off</span>
                    <span data-legend="single"><i class="dot single"></i>Single Punch</span>
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
        const groups = this._computeGroupedDayStats(deptEmps, logs, dateFrom, dateTo, (e) => e.designation || "Staff");
        const desigOrderMap = {};
        deptEmps.forEach((e) => {
            desigOrderMap[e.designation || "Staff"] = e.designationSortOrder || 0;
        });
        const desigs = Object.keys(groups).sort((a, b) => {
            const orderA = desigOrderMap[a] || 0;
            const orderB = desigOrderMap[b] || 0;
            if (orderA !== orderB) {
                return orderA - orderB;
            }
            return a.localeCompare(b);
        });
        const maxTotal = Math.max(1, ...desigs.map((d) => groups[d].total));
        const { ticks, niceMax } = this._computeNiceAxis(maxTotal);
        const tickPercents = [0, 25, 50, 75, 100];
        const tickValues = tickPercents.map((p) => Math.round((p / 100) * niceMax),);

        const rowsHtml = desigs.map((d) => {
            const g = groups[d];
            const total = g.total || 1;
            const scale = (g.total / niceMax) * 100;
            const pPct = (g.present / total) * 100;
            const hPct = (g.halfPresent / total) * 100;
            const wpPct = (g.weeklyOffPresent / total) * 100;
            const whPct = (g.weeklyOffHalfPresent / total) * 100;
            const wPct = (g.weeklyOff / total) * 100;
            const spPct = (g.singlePunch / total) * 100;
            const aPct = (g.absent / total) * 100;

            return `
                <div class="dept-acc-sub-row" data-designation="${this._escapeAttr(d)}" data-present="${g.present}" data-half="${g.halfPresent}" data-wopresent="${g.weeklyOffPresent}" data-wohalfpresent="${g.weeklyOffHalfPresent}" data-weeklyoff="${g.weeklyOff}" data-single="${g.singlePunch}" data-absent="${g.absent}" data-total="${g.total}">
                    <div class="dept-acc-sub-label">${d}</div>
                    <div class="dept-acc-track">
                        ${ticks.map((t) => `<div class="dept-acc-gridline" style="left:${(t / niceMax) * 100}%"></div>`).join("")}
                        <div class="dept-acc-bar-wrap" style="width:${scale.toFixed(2)}%">
                        <div class="dept-acc-bar small">
                            ${g.present > 0 ? `<div class="dept-acc-seg present" data-status="Present" style="width:${pPct}%">${g.present}</div>` : ""}
                            ${g.halfPresent > 0 ? `<div class="dept-acc-seg half" data-status="Half Present" style="width:${hPct}%">${g.halfPresent}</div>` : ""}
                            ${g.weeklyOffPresent > 0 ? `<div class="dept-acc-seg wopresent" data-status="WO Present" style="width:${wpPct}%">${g.weeklyOffPresent}</div>` : ""}
                            ${g.weeklyOffHalfPresent > 0 ? `<div class="dept-acc-seg wohalfpresent" data-status="WO Half Present" style="width:${whPct}%">${g.weeklyOffHalfPresent}</div>` : ""}
                            ${g.weeklyOff > 0 ? `<div class="dept-acc-seg weeklyoff" data-status="Weekly Off" style="width:${wPct}%">${g.weeklyOff}</div>` : ""}
                            ${g.singlePunch > 0 ? `<div class="dept-acc-seg single" data-status="Single Punch" style="width:${spPct}%">${g.singlePunch}</div>` : ""}
                            ${g.absent > 0 ? `<div class="dept-acc-seg absent" data-status="Absent" style="width:${aPct}%">${g.absent}</div>` : ""}
                        </div>
                        </div>
                    </div>
                </div>
             `;
        }).join("");

        expandEl.innerHTML = `
			<div class="dept-acc-sub-title">🔍 ${dept} — Designation Breakdown</div>
			${rowsHtml}
			<div class="dept-acc-sub-axis">
				${ticks.map((t) => `<span>${t}</span>`).join("")}
			</div>
		`;
        expandEl.style.display = "block";
    }


    _renderAgeWise(logs, emps, empMap, model, page = 1) {
        // cache rakh liya re-pagination ke liye
        this._currentAgeWiseLogs = logs;
        this._currentAgeWiseEmps = emps;
        this._currentAgeWiseEmpMap = empMap;
        this._currentAgeWiseModel = model;
        const groups = ["Under 18", "Under 25", "25–34", "35–44", "45–54", "55–59", "60+"];

        const gTotal = {};
        const gPresent = {};
        const gHalfPresent = {};
        const gWoPresent = {};
        const gWoHalfPresent = {};
        const gWeeklyOff = {};
        const gSinglePunch = {};
        const gAbsent = {};

        groups.forEach((g) => {
            gTotal[g] = 0;
            gPresent[g] = 0;
            gHalfPresent[g] = 0;
            gWoPresent[g] = 0;
            gWoHalfPresent[g] = 0;
            gWeeklyOff[g] = 0;
            gSinglePunch[g] = 0;
            gAbsent[g] = 0;
        });

        const isSingleDay = model.state.filters.dateFrom === model.state.filters.dateTo;

        emps.forEach((e) => { const g = model.getAgeGroup(e.dob); gTotal[g]++; });

        const { dateFrom, dateTo } = model.state.filters;
        const dayLogs = this._buildEmployeeDayLogs(emps, logs, dateFrom, dateTo);

        dayLogs.forEach((l) => {
            const e = empMap[l.empId];
            if (!e) {
                return;
            }
            const g = model.getAgeGroup(e.dob);

            if (this._matchesStatus(l, "Present")) {
                gPresent[g]++;
            } else if (this._matchesStatus(l, "Half Present")) {
                gHalfPresent[g]++;
            } else if (this._matchesStatus(l, "WO Present")) {
                gWoPresent[g]++;
            } else if (this._matchesStatus(l, "WO Half Present")) {
                gWoHalfPresent[g]++;
            } else if (this._matchesStatus(l, "Weekly Off")) {
                gWeeklyOff[g]++;
            } else if (this._matchesStatus(l, "Single Punch")) {
                gSinglePunch[g]++;
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
                gWoPresent[g],
                gWoHalfPresent[g],
                gWeeklyOff[g],
                gSinglePunch[g],
                gAbsent[g],
                attendancePercent.toFixed(2) + "%",
            ];
        });

        this._lastData["age-wise"] = rows.map((r) => ({
            AgeGroup: r[0],
            Total: r[1],
            Present: r[2],
            HalfPresent: r[3],
            WOPresent: r[4],
            WOHalfPresent: r[5],
            WeeklyOff: r[6],
            SinglePunch: r[7],
            Absent: r[8],
            Rate: r[9],
        }));
        // ---- Pagination ----
        const pageSize = 25;
        const currentPage = page;
        const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
        const pageRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

        let pageButtons = "";
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, currentPage + 2);
        for (let i = startPage; i <= endPage; i++) {
            pageButtons += `
        <button class="btn-page ${i === currentPage ? "btn-page-active" : ""}" onclick="AppController.view._reRenderAgeWisePage(${i})">
            ${i}
        </button>
    `;
        }
        return {
            html: `
				<h2 class="section-title">
					<i class="ph-fill ph-users-three"></i>
					Age-Wise Analysis
				</h2>

				<div class="charts-grid">
					${this._chartCard("ch-age-bar", '<i class="ph-fill ph-chart-bar"></i>', "amber", "Attendance by Age Group")}
				</div>

              <div id="main-table-wrap">
                    ${this._tableHTML("tbl-age", ["Age Group", "Total Emp", "Present", "Half Present", "WO Present", "WO Half Present", "Weekly Off", "Single Punch", "Absent", "Attendance %"], pageRows, "age-wise", (currentPage - 1) * pageSize)}
                    <div class="pagination-bar">
                        <div class="pagination-text">
                            Showing ${rows.length ? (currentPage - 1) * pageSize + 1 : 0}–${Math.min(currentPage * pageSize, rows.length)} of ${rows.length} records &nbsp;·&nbsp; Page ${currentPage} of ${totalPages}
                        </div>
                        <div class="pagination-buttons">
                            <button class="btn-page" ${currentPage === 1 ? "disabled" : ""} onclick="AppController.view._reRenderAgeWisePage(1)">«</button>
                            <button class="btn-page" ${currentPage === 1 ? "disabled" : ""} onclick="AppController.view._reRenderAgeWisePage(${currentPage - 1})">‹</button>
                            ${pageButtons}
                            <button class="btn-page" ${currentPage === totalPages ? "disabled" : ""} onclick="AppController.view._reRenderAgeWisePage(${currentPage + 1})">›</button>
                            <button class="btn-page" ${currentPage === totalPages ? "disabled" : ""} onclick="AppController.view._reRenderAgeWisePage(${totalPages})">»</button>
                        </div>
                    </div>
                </div>
                <div id="drilldown-table" style="margin-top:16px"></div>
			`,

            renderCharts: () => {
                Charts.stacked(
                    "ch-age-bar",
                    groups,
                    [
                        { name: "Present", data: groups.map((g) => gPresent[g]), },
                        { name: "Half Present", data: groups.map((g) => gHalfPresent[g]), },
                        { name: "WO Present", data: groups.map((g) => gWoPresent[g]), },
                        { name: "WO Half Present", data: groups.map((g) => gWoHalfPresent[g]), },
                        { name: "Weekly Off", data: groups.map((g) => gWeeklyOff[g]), },
                        { name: "Single Punch", data: groups.map((g) => gSinglePunch[g]), },
                        { name: "Absent", data: groups.map((g) => gAbsent[g]) },
                    ],
                    "Age-wise",
                    (g, index, seriesIndex, seriesName) => {
                        const filteredLogs = dayLogs.filter((l) => {
                            const e = empMap[l.empId];
                            if (!e) {
                                return false;
                            }
                            if (model.getAgeGroup(e.dob) !== g) {
                                return false;
                            }
                            return this._matchesStatus(l, seriesName);
                        });

                        this._renderDrillDown(filteredLogs, `Age: ${g} - ${seriesName}`, empMap,);
                    },
                );
            },
        };
    }
    
    
    _reRenderAgeWisePage(page) {
        const content = this._renderAgeWise(
            this._currentAgeWiseLogs,
            this._currentAgeWiseEmps,
            this._currentAgeWiseEmpMap,
            this._currentAgeWiseModel,
            page
        );
        document.querySelector(".tab-pane-container").innerHTML = content.html;
        content.renderCharts();
    }

    
    _matchesStatus(log, seriesName) {
        if (log.status === "Single Punch") {
            return seriesName === "Single Punch";
        }

        const code = (log.detailedStatusCode || "").toUpperCase().trim();
        const isWeeklyOff = parseInt(log.weeklyOff ?? 0) === 1;
        let bucket;

        switch (code) {
            case "P":
                bucket = "Present";
                break;

            case "½PLD":
            case "L_CL":
            case "½PCL":
            case "½PLD(HO)":
                bucket = "Half Present";
                break;

            case "WO":
                bucket = "Weekly Off";
                break;

            case "WOP":
                bucket = isWeeklyOff ? "WO Present" : "Present";
                break;

            case "½PLD(WO)":
                bucket = isWeeklyOff ? "WO Half Present" : "Half Present";
                break;

            case "A":
            case "ALD":
            case "WOA":
            default:
                bucket = "Absent";
                break;
        }

        return seriesName === bucket;
    }


    _renderCompanyWise(logs, emps, empMap, model, page = 1) {
        this._currentCompanyWiseLogs = logs;
        this._currentCompanyWiseEmps = emps;
        this._currentCompanyWiseEmpMap = empMap;
        this._currentCompanyWiseModel = model;
        const comps = [...new Set(emps.map((e) => e.company))];
        const { dateFrom, dateTo } = model.state.filters;
        const groups = this._computeGroupedDayStats(emps, logs, dateFrom, dateTo, (e) => e.company);
        const dayLogs = this._buildEmployeeDayLogs(emps, logs, dateFrom, dateTo);

        const rows = comps.map((c) => {
            const g = groups[c] || { total: 0, present: 0, halfPresent: 0, weeklyOffPresent: 0, weeklyOffHalfPresent: 0, weeklyOff: 0, absent: 0, singlePunch: 0 };
            const rate = g.total ? Math.round((g.present / g.total) * 100) + "%" : "0%";
            return [c, g.total, g.present, g.halfPresent, g.weeklyOffPresent, g.weeklyOffHalfPresent, g.weeklyOff, g.singlePunch, g.absent, rate]; // ← inserted singlePunch before absent
        });

        this._lastData["company-wise"] = rows.map((r) => ({
            Company: r[0],
            Total: r[1],
            Present: r[2],
            HalfPresent: r[3],
            WOPresent: r[4],
            WOHalfPresent: r[5],
            WeeklyOff: r[6],
            Absent: r[7],
            Rate: r[8],
        }));
        // ---- Pagination ----
        const pageSize = 25;
        const currentPage = page;
        const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
        const pageRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

        let pageButtons = "";
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, currentPage + 2);
        for (let i = startPage; i <= endPage; i++) {
            pageButtons += `
                <button class="btn-page ${i === currentPage ? "btn-page-active" : ""}" onclick="AppController.view._reRenderCompanyWisePage(${i})">
                    ${i}
                </button>
            `;
        }
        return {
            html: `
				<h2 class="section-title"><i class="ph-fill ph-buildings"></i> Company Statistics</h2>
				<div class="charts-grid">
					${this._chartCard("ch-comp-bar", '<i class="ph-fill ph-chart-bar"></i>', "violet", "Company Breakdown")}
				</div>

               <div id="main-table-wrap">
                    ${this._tableHTML("tbl-comp", ["Company", "Total", "Present", "Half Present", "WO Present", "WO Half Present", "Weekly Off", "Single Punch", "Absent", "Rate"], pageRows, "company-wise", (currentPage - 1) * pageSize)}
                    <div class="pagination-bar">
                        <div class="pagination-text">
                            Showing ${rows.length ? (currentPage - 1) * pageSize + 1 : 0}–${Math.min(currentPage * pageSize, rows.length)} of ${rows.length} records &nbsp;·&nbsp; Page ${currentPage} of ${totalPages}
                        </div>
                        <div class="pagination-buttons">
                            <button class="btn-page" ${currentPage === 1 ? "disabled" : ""} onclick="AppController.view._reRenderCompanyWisePage(1)">«</button>
                            <button class="btn-page" ${currentPage === 1 ? "disabled" : ""} onclick="AppController.view._reRenderCompanyWisePage(${currentPage - 1})">‹</button>
                            ${pageButtons}
                            <button class="btn-page" ${currentPage === totalPages ? "disabled" : ""} onclick="AppController.view._reRenderCompanyWisePage(${currentPage + 1})">›</button>
                            <button class="btn-page" ${currentPage === totalPages ? "disabled" : ""} onclick="AppController.view._reRenderCompanyWisePage(${totalPages})">»</button>
                        </div>
                    </div>
                </div>
				
                <div id="drilldown-table" style="margin-top:16px"></div>
			`,

            renderCharts: () => {
                Charts.stacked(
                    "ch-comp-bar",
                    comps,
                    [
                        { name: "Present", data: rows.map((r) => r[2]) },
                        { name: "Half Present", data: rows.map((r) => r[3]) },
                        { name: "WO Present", data: rows.map((r) => r[4]) },
                        { name: "WO Half Present", data: rows.map((r) => r[5]) },
                        { name: "Weekly Off", data: rows.map((r) => r[6]) },
                        { name: "Single Punch", data: rows.map((r) => r[7]) },
                        { name: "Absent", data: rows.map((r) => r[8]) },
                    ],
                    "Company Attendance",
                    (company, index, seriesIndex, seriesName) => {
                        const filteredLogs = dayLogs.filter((l) => {
                            const e = empMap[l.empId];
                            if (!e || e.company !== company) {
                                return false;
                            }
                            return this._matchesStatus(l, seriesName);
                        });
                        this._renderDrillDown(filteredLogs, `Company: ${company} - ${seriesName}`, empMap);
                    },
                );
            },
        };
    }
    
    
    _reRenderCompanyWisePage(page) {
        const content = this._renderCompanyWise(
            this._currentCompanyWiseLogs,
            this._currentCompanyWiseEmps,
            this._currentCompanyWiseEmpMap,
            this._currentCompanyWiseModel,
            page
        );
        document.querySelector(".tab-pane-container").innerHTML = content.html;
        content.renderCharts();
    }

    
    _renderDeptWise(logs, emps, empMap, model, page = 1) {
        this._currentDeptWiseLogs = logs;
        this._currentDeptWiseEmps = emps;
        this._currentDeptWiseEmpMap = empMap;
        this._currentDeptWiseModel = model;
        this._currentDeptData = { emps, logs, empMap, model };
        const depts = [...new Set(emps.map((e) => e.dept))];
        const { dateFrom, dateTo } = model.state.filters;
        const groups = this._computeGroupedDayStats(emps, logs, dateFrom, dateTo, (e) => e.dept);
        const lBD = model.groupBy(logs, (l) => (empMap[l.empId] || {}).dept);

        const rows = depts.map((d) => {
            const g = groups[d] || { total: 0, present: 0, halfPresent: 0, weeklyOffPresent: 0, weeklyOffHalfPresent: 0, weeklyOff: 0, singlePunch: 0, absent: 0, };
            const ls = lBD[d] || [];
            const avg = ls.length ? (ls.reduce((s, l) => s + (l.hoursWorked || 0), 0) / ls.length).toFixed(1) : 0;
            const rate = g.total ? Math.round((g.present / g.total) * 100) + "%" : "0%";
            return [d, g.total, g.present, g.halfPresent, g.weeklyOffPresent, g.weeklyOffHalfPresent, g.weeklyOff, g.singlePunch || 0, g.absent, avg, rate];
        });

        this._lastData["dept-wise"] = rows.map((r) => ({
            Dept: r[0],
            Total: r[1],
            Present: r[2],
            HalfPresent: r[3],
            WOPresent: r[4],
            WOHalfPresent: r[5],
            WeeklyOff: r[6],
            SinglePunch: r[7],
            Absent: r[8],
            AvgHours: r[9],
            Rate: r[10],
        }));
        // ---- Pagination ----
        const pageSize = 25;
        const currentPage = page;
        const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
        const pageRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

        let pageButtons = "";
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, currentPage + 2);
        for (let i = startPage; i <= endPage; i++) {
            pageButtons += `
                <button class="btn-page ${i === currentPage ? "btn-page-active" : ""}" onclick="AppController.view._reRenderDeptWisePage(${i})">
                    ${i}
                </button>
            `;
        }
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

         <div id="main-table-wrap">
                    ${this._tableHTML("tbl-dept", ["Dept", "Total", "Present", "Half Present", "WO Present", "WO Half Present", "Weekly Off", "Single Punch", "Absent", "Avg Hours", "Rate"], pageRows, "dept-wise", (currentPage - 1) * pageSize)}
                    <div class="pagination-bar">
                        <div class="pagination-text">
                            Showing ${rows.length ? (currentPage - 1) * pageSize + 1 : 0}–${Math.min(currentPage * pageSize, rows.length)} of ${rows.length} records &nbsp;·&nbsp; Page ${currentPage} of ${totalPages}
                        </div>
                        <div class="pagination-buttons">
                            <button class="btn-page" ${currentPage === 1 ? "disabled" : ""} onclick="AppController.view._reRenderDeptWisePage(1)">«</button>
                            <button class="btn-page" ${currentPage === 1 ? "disabled" : ""} onclick="AppController.view._reRenderDeptWisePage(${currentPage - 1})">‹</button>
                            ${pageButtons}
                            <button class="btn-page" ${currentPage === totalPages ? "disabled" : ""} onclick="AppController.view._reRenderDeptWisePage(${currentPage + 1})">›</button>
                            <button class="btn-page" ${currentPage === totalPages ? "disabled" : ""} onclick="AppController.view._reRenderDeptWisePage(${totalPages})">»</button>
                        </div>
                    </div>
                </div>
                
                <div id="drilldown-table" style="margin-top:16px"></div>
            `,

            renderCharts: () => {
                const legendItems = document.querySelectorAll(".dept-accordion .dept-acc-legend span",);
                const accordion = document.querySelector(".dept-accordion");

                legendItems.forEach((item) => {
                    item.addEventListener("mouseenter", () => {
                        const status = item.dataset.legend;
                        accordion.classList.add("dimmed");
                        document.querySelectorAll(".dept-acc-seg." + status).forEach((seg) => {
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
    
    
    _reRenderDeptWisePage(page) {
        const content = this._renderDeptWise(
            this._currentDeptWiseLogs,
            this._currentDeptWiseEmps,
            this._currentDeptWiseEmpMap,
            this._currentDeptWiseModel,
            page
        );
        document.querySelector(".tab-pane-container").innerHTML = content.html;
        content.renderCharts();
    }

    
    _renderDeptDesignationDrilldown(dept, emps, logs, model, anchorEl) {
        const deptEmps = emps.filter((e) => e.dept === dept);
        const { dateFrom, dateTo } = model.state.filters;
        const groups = this._computeGroupedDayStats(deptEmps, logs, dateFrom, dateTo, (e) => e.designation || "Staff");
        const desigs = [...new Map(
            deptEmps.map(e => [
                e.designation,
                { name: e.designation || "Staff", sortOrder: e.designationSortOrder ?? 9999 }
            ])
        ).values()].sort((a, b) => {
            if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
            return a.name.localeCompare(b.name);
        }).map(x => x.name);

        const old = document.getElementById("dept-desig-popover");
        if (old) old.remove();


        const chartEl = document.getElementById("ch-dept-bar");
        const chartCard = chartEl ? chartEl.closest(".chart-card") : null;

        if (!chartCard) return;

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
                    { name: "Present", data: desigs.map((d) => groups[d].present), },
                    { name: "Half Present", data: desigs.map((d) => groups[d].halfPresent), },
                    { name: "Weekly Off", data: desigs.map((d) => groups[d].weeklyOff), },
                    { name: "Absent", data: desigs.map((d) => groups[d].absent), },
                ],
                `${dept} - Designation Attendance`,
                null,
                true,
            );
        }, 50);
    }


    _renderGenderWise(logs, emps, empMap, model, page = 1) {
        this._currentGenderWiseLogs = logs;
        this._currentGenderWiseEmps = emps;
        this._currentGenderWiseEmpMap = empMap;
        this._currentGenderWiseModel = model;
        const genders = ["Male", "Female"];
        const { dateFrom, dateTo } = model.state.filters;

        const groups = this._computeGroupedDayStats(emps, logs, dateFrom, dateTo, (e) => e.gender);
        const dayLogs = this._buildEmployeeDayLogs(emps, logs, dateFrom, dateTo);

        const rows = genders.map((g) => {
            const grp = groups[g] || { total: 0, present: 0, halfPresent: 0, weeklyOffPresent: 0, weeklyOffHalfPresent: 0, weeklyOff: 0, singlePunch: 0, absent: 0, };
            const rate = grp.total ? Math.round((grp.present / grp.total) * 100) + "%" : "0%";
            return [g, grp.total, grp.present, grp.halfPresent, grp.weeklyOffPresent, grp.weeklyOffHalfPresent, grp.weeklyOff, grp.singlePunch || 0, grp.absent, rate];
        });

        this._lastData["gender-wise"] = rows.map((r) => ({
            Gender: r[0],
            Total: r[1],
            Present: r[2],
            HalfPresent: r[3],
            WOPresent: r[4],
            WOHalfPresent: r[5],
            WeeklyOff: r[6],
            SinglePunch: r[7],
            Absent: r[8],
            Rate: r[9],
        }));
        // ---- Pagination ----
        const pageSize = 25;
        const currentPage = page;
        const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
        const pageRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

        let pageButtons = "";
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, currentPage + 2);
        for (let i = startPage; i <= endPage; i++) {
            pageButtons += `
                <button class="btn-page ${i === currentPage ? "btn-page-active" : ""}" onclick="AppController.view._reRenderGenderWisePage(${i})">
                    ${i}
                </button>
            `;
        }
        return {
            html: `
                <h2 class="section-title">
                    <i class="ph-fill ph-gender-intersex"></i> Gender Split
                </h2>

                <div class="charts-grid">
                    ${this._chartCard("ch-gender-bar", '<i class="ph-fill ph-chart-bar"></i>', "violet", "Attendance by Gender", "Click bar for detail")}
                </div>

               <div id="main-table-wrap">
                    ${this._tableHTML("tbl-gen", ["Gender", "Total", "Present", "Half Present", "WO Present", "WO Half Present", "Weekly Off", "Single Punch", "Absent", "Rate"], pageRows, "gender-wise", (currentPage - 1) * pageSize)}
                    <div class="pagination-bar">
                        <div class="pagination-text">
                            Showing ${rows.length ? (currentPage - 1) * pageSize + 1 : 0}–${Math.min(currentPage * pageSize, rows.length)} of ${rows.length} records &nbsp;·&nbsp; Page ${currentPage} of ${totalPages}
                        </div>
                        <div class="pagination-buttons">
                            <button class="btn-page" ${currentPage === 1 ? "disabled" : ""} onclick="AppController.view._reRenderGenderWisePage(1)">«</button>
                            <button class="btn-page" ${currentPage === 1 ? "disabled" : ""} onclick="AppController.view._reRenderGenderWisePage(${currentPage - 1})">‹</button>
                            ${pageButtons}
                            <button class="btn-page" ${currentPage === totalPages ? "disabled" : ""} onclick="AppController.view._reRenderGenderWisePage(${currentPage + 1})">›</button>
                            <button class="btn-page" ${currentPage === totalPages ? "disabled" : ""} onclick="AppController.view._reRenderGenderWisePage(${totalPages})">»</button>
                        </div>
                    </div>
                </div>
                
                <div id="drilldown-table" style="margin-top:16px"></div>
            `,

            renderCharts: () => {
                Charts.stacked(
                    "ch-gender-bar",
                    genders,
                    [
                        { name: "Present", data: genders.map((g) => (groups[g] || {}).present || 0), },
                        { name: "Half Present", data: genders.map((g) => (groups[g] || {}).halfPresent || 0), },
                        { name: "WO Present", data: genders.map((g) => (groups[g] || {}).weeklyOffPresent || 0), },
                        { name: "WO Half Present", data: genders.map((g) => (groups[g] || {}).weeklyOffHalfPresent || 0), },
                        { name: "Weekly Off", data: genders.map((g) => (groups[g] || {}).weeklyOff || 0), },
                        { name: "Single Punch", data: genders.map((g) => (groups[g] || {}).singlePunch || 0), },
                        { name: "Absent", data: genders.map((g) => (groups[g] || {}).absent || 0), },
                    ],
                    "Gender Attendance",
                    (gender, index, seriesIndex, seriesName) => {
                        const filteredLogs = dayLogs.filter((l) => {
                            const e = empMap[l.empId];
                            if (!e || e.gender !== gender) {
                                return false;
                            }
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
    
    
    _reRenderGenderWisePage(page) {
        const content = this._renderGenderWise(
            this._currentGenderWiseLogs,
            this._currentGenderWiseEmps,
            this._currentGenderWiseEmpMap,
            this._currentGenderWiseModel,
            page
        );
        document.querySelector(".tab-pane-container").innerHTML = content.html;
        content.renderCharts();
    }

    
    _fmtMins(mins) {
        const m = parseInt(mins) || 0;
        if (m <= 0) return "-";
        if (m < 60) return `${m}m`;

        return `${Math.floor(m / 60)}h ${m % 60}m`;
    }

    
    _formatDate(dateStr) {
        if (!dateStr) return "-";
        try {
            const [year, month, day] = dateStr.split("-");
            const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            const monthIndex = parseInt(month) - 1;
            if (monthIndex < 0 || monthIndex > 11) return dateStr;
            return `${day}-${monthNames[monthIndex]}-${year}`;
        } catch (e) {
            return dateStr;
        }
    }

    
    _calculateAge(dobStr) {                        
        if (!dobStr) return "-";
        const dob = new Date(dobStr);
        if (isNaN(dob.getTime())) return "-";
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        const m = today.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
            age--;
        }
        return age;
    }

    
    _getSeverityStyle(count) {
        if (count < this.LATE_THRESHOLD) return "";
        const intensity = Math.min((count - this.LATE_THRESHOLD + 1) / 8, 1);
        const alpha = (0.12 + intensity * 0.6).toFixed(2);
        return `background: rgba(244,63,94,${alpha});`;
    }

    
    _renderLateIn(logs, emps, empMap, model, page = 1) {
        const groups = model ? model.getLateInEmployeesGrouped() : this._currentLateInGroups;
        this._currentLateInGroups = groups;
        this._currentLateInEmpMap = empMap || this._currentLateInEmpMap;

        const pageSize = 25;
        const currentPage = page;
        const totalPages = Math.max(1, Math.ceil(groups.length / pageSize));
        const pageGroups = groups.slice((currentPage - 1) * pageSize, currentPage * pageSize);

        const rowsHtml = pageGroups.map((g) => {
            const isRepeat = g.count >= this.LATE_THRESHOLD;
            const severityStyle = this._getSeverityStyle(g.count);
            return `
                <tr style="cursor:pointer;${severityStyle}"
                    onclick="AppController.view._showLateInEmployeeDrilldown('${g.emp.id}')">
                    <td><b>${g.emp.code || "-"}</b></td>
                    <td>${g.emp.name || "-"}</td>
                    <td>${g.emp.dept || "-"}</td>
                    <td>${g.emp.company || "-"}</td>
                    <td>${[...new Set(g.logs.map(l => l.shiftName).filter(Boolean))].join(", ") || g.emp.shift || "-"}</td>
                    <td><span class="badge ${isRepeat ? "badge-danger" : "badge-info"}">${g.count} Late Day${g.count > 1 ? "s" : ""}</span></td>
                </tr>
            `;
        }).join("");

        const flatItems = [];
        groups.forEach((g) => g.logs.forEach((log) => flatItems.push({ log, emp: g.emp, date: log.date })));

        this._lastData["late-in"] = flatItems.map(({ log, emp, date }) => ({
            Code: emp.code, Name: emp.name, Dept: emp.dept, Company: emp.company, Shift: log?.shiftName || emp.shift,
            Date: this._formatDate(date), In: log?.inTime, Out: log?.outTime, Hours: log?.hoursWorked,
            LateByMins: log?.lateBy,
        }));

        const byShift = this._countBy(flatItems, (it) => (it.log && it.log.shiftName) || it.emp.shift || "No Shift");
        const shifts = Object.keys(byShift);

        let pageButtons = "";
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, currentPage + 2);
        for (let i = startPage; i <= endPage; i++) {
            pageButtons += `
                <button class="btn-page ${i === currentPage ? "btn-page-active" : ""}" onclick="AppController.view._reRenderLateInPage(${i})">
                    ${i}
                </button>
            `;
        }

        return {
            html: `
                <style>.row-danger td { background: #fef2f2; }</style>
                <h2 class="section-title"><i class="ph-fill ph-clock-afternoon"></i> Late In Records</h2>
                <div class="charts-grid">
                    ${this._chartCard("ch-latein-shift", '<i class="ph ph-clock-clockwise"></i>', "amber", "Late-In Count by Shift", "Click for detail")}
                </div>
                <div id="main-table-wrap">
                    <div class="table-wrap">
                        <div class="table-header">
                            <h3>📄 Employees with Late-In Records (click a row for detail)</h3>
                        </div>
                        <div style="overflow-x:auto">
                            <table class="data-table">
                                <thead>
                                    <tr><th>Code</th><th>Name</th><th>Dept</th><th>Company</th><th>Shift</th><th>Total Late Days</th></tr>
                                </thead>
                                <tbody>${rowsHtml}</tbody>
                            </table>
                        </div>
                    </div>
                    <div class="pagination-bar">
                        <div class="pagination-text">
                            Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, groups.length)} of ${groups.length} employees &nbsp;·&nbsp; Page ${currentPage} of ${totalPages}
                        </div>
                        <div class="pagination-buttons">
                            <button class="btn-page" ${currentPage === 1 ? "disabled" : ""} onclick="AppController.view._reRenderLateInPage(1)">«</button>
                            <button class="btn-page" ${currentPage === 1 ? "disabled" : ""} onclick="AppController.view._reRenderLateInPage(${currentPage - 1})">‹</button>
                            ${pageButtons}
                            <button class="btn-page" ${currentPage === totalPages ? "disabled" : ""} onclick="AppController.view._reRenderLateInPage(${currentPage + 1})">›</button>
                            <button class="btn-page" ${currentPage === totalPages ? "disabled" : ""} onclick="AppController.view._reRenderLateInPage(${totalPages})">»</button>
                        </div>
                    </div>
                </div>
                <div id="drilldown-table" style="margin-top:16px"></div>
            `,
            renderCharts: () => {
                Charts.stacked(
                    "ch-latein-shift", shifts,
                    [{ name: "Late In Count", data: shifts.map((s) => byShift[s]) }],
                    "Late-In by Shift",
                    (shiftName) => {
                        const shiftLogs = flatItems.filter((it) => ((it.log && it.log.shiftName) || it.emp.shift || "No Shift") === shiftName).map((it) => it.log);
                        this._renderDrillDown(shiftLogs, `Late In - Shift: ${shiftName}`, empMap || this._currentLateInEmpMap);
                    },
                );
            },
        };
    }

    
    _showLateInEmployeeDrilldown(empId) {
        const group = (this._currentLateInGroups || []).find((g) => String(g.emp.id) === String(empId));
        if (!group) return;
        this._renderDrillDown(group.logs, `Late In - ${group.emp.name} (${group.emp.code})`, this._currentLateInEmpMap);
    }

    
    _reRenderLateInPage(page) {
        const content = this._renderLateIn(null, null, this._currentLateInEmpMap, null, page);
        document.querySelector(".tab-pane-container").innerHTML = content.html;
        content.renderCharts();
    }

    
    _renderEarlyOut(logs, emps, empMap, model, page = 1) {
        const groups = model ? model.getEarlyOutEmployeesGrouped() : this._currentEarlyOutGroups;
        this._currentEarlyOutGroups = groups;
        this._currentEarlyOutEmpMap = empMap || this._currentEarlyOutEmpMap;

        const pageSize = 25;
        const currentPage = page;
        const totalPages = Math.max(1, Math.ceil(groups.length / pageSize));
        const pageGroups = groups.slice((currentPage - 1) * pageSize, currentPage * pageSize);

        const rowsHtml = pageGroups.map((g) => {
            const isRepeat = g.count >= this.LATE_THRESHOLD;
            const severityStyle = this._getSeverityStyle(g.count);
            return `
                <tr style="cursor:pointer;${severityStyle}"
                    onclick="AppController.view._showEarlyOutEmployeeDrilldown('${g.emp.id}')">
                    <td><b>${g.emp.code || "-"}</b></td>
                    <td>${g.emp.name || "-"}</td>
                    <td>${g.emp.dept || "-"}</td>
                    <td>${g.emp.company || "-"}</td>
                    <td>${[...new Set(g.logs.map(l => l.shiftName).filter(Boolean))].join(", ") || g.emp.shift || "-"}</td>
                    <td><span class="badge ${isRepeat ? "badge-danger" : "badge-info"}">${g.count} Early Day${g.count > 1 ? "s" : ""}</span></td>
                </tr>
            `;
        }).join("");

        const flatItems = [];
        groups.forEach((g) => g.logs.forEach((log) => flatItems.push({ log, emp: g.emp, date: log.date })));

        this._lastData["early-out"] = flatItems.map(({ log, emp, date }) => ({
            Code: emp.code,
            Name: emp.name,
            Dept: emp.dept,
            Company: emp.company,
            Shift: log?.shiftName || emp.shift,
            ShiftStart: log?.shiftStart,
            ShiftEnd: log?.shiftEnd,
            Date: this._formatDate(date),
            In: log?.inTime,
            Out: log?.outTime,
            Hours: log?.hoursWorked,
            EarlyByMins: log?.earlyBy,
        }));

        const byShift = this._countBy(flatItems, (it) => (it.log && it.log.shiftName) || it.emp.shift || "No Shift");
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
                <style>.row-danger td { background: #fef2f2; }</style>
                <h2 class="section-title"><i class="ph-fill ph-sign-out"></i> Early Out Records</h2>
                <div class="charts-grid">
                    ${this._chartCard("ch-earlyout-shift", '<i class="ph ph-clock-clockwise"></i>', "sky", "Early-Out Count by Shift", "Click for detail")}
                </div>
                <div id="main-table-wrap">
                    <div class="table-wrap">
                        <div class="table-header">
                            <h3>📄 Employees with Early-Out Records (click a row for detail)</h3>
                        </div>
                        <div style="overflow-x:auto">
                            <table class="data-table">
                                <thead>
                                    <tr><th>Code</th><th>Name</th><th>Dept</th><th>Company</th><th>Shift</th><th>Total Early Days</th></tr>
                                </thead>
                                <tbody>${rowsHtml}</tbody>
                            </table>
                        </div>
                    </div>
                    <div class="pagination-bar">
                        <div class="pagination-text">
                            Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, groups.length)} of ${groups.length} employees &nbsp;·&nbsp; Page ${currentPage} of ${totalPages}
                        </div>
                        <div class="pagination-buttons">
                            <button class="btn-page" ${currentPage === 1 ? "disabled" : ""} onclick="AppController.view._reRenderEarlyOutPage(1)">«</button>
                            <button class="btn-page" ${currentPage === 1 ? "disabled" : ""} onclick="AppController.view._reRenderEarlyOutPage(${currentPage - 1})">‹</button>
                            ${pageButtons}
                            <button class="btn-page" ${currentPage === totalPages ? "disabled" : ""} onclick="AppController.view._reRenderEarlyOutPage(${currentPage + 1})">›</button>
                            <button class="btn-page" ${currentPage === totalPages ? "disabled" : ""} onclick="AppController.view._reRenderEarlyOutPage(${totalPages})">»</button>
                        </div>
                    </div>
                </div>
                <div id="drilldown-table" style="margin-top:16px"></div>
            `,
            renderCharts: () => {
                Charts.stacked(
                    "ch-earlyout-shift",
                    shifts,
                    [
                        { name: "Early Out Count", data: shifts.map((s) => byShift[s]), },
                    ],
                    "Early-Out by Shift",
                    (shiftName) => {
                        const shiftLogs = flatItems.filter((it) => ((it.log && it.log.shiftName) || it.emp.shift || "No Shift") === shiftName).map((it) => it.log);
                        this._renderDrillDown(shiftLogs, `Early Out - Shift: ${shiftName}`, empMap || this._currentEarlyOutEmpMap);
                    },
                );
            },
        };
    }

    
    _showEarlyOutEmployeeDrilldown(empId) {
        const group = (this._currentEarlyOutGroups || []).find((g) => String(g.emp.id) === String(empId));
        if (!group) return;
        this._renderDrillDown(group.logs, `Early Out - ${group.emp.name} (${group.emp.code})`, this._currentEarlyOutEmpMap);
    }

    
    _reRenderEarlyOutPage(page) {
        const content = this._renderEarlyOut(null, null, this._currentEarlyOutEmpMap, null, page);
        document.querySelector(".tab-pane-container").innerHTML = content.html;
        content.renderCharts();
    }

    
    _renderNightShift(logs, emps, empMap, model, page = 1) {
        this._currentNightShiftLogs = logs;
        this._currentNightShiftEmps = emps;
        this._currentNightShiftEmpMap = empMap;
        this._currentNightShiftModel = model;

        const { dateFrom, dateTo } = model.state.filters;
        const shifts = [...new Set(emps.map((e) => e.shift || "No Shift"))];
        const groups = this._computeGroupedDayStats(emps, logs, dateFrom, dateTo, (e) => e.shift || "No Shift");
        const dayLogs = this._buildEmployeeDayLogs(emps, logs, dateFrom, dateTo);

        const rows = shifts.map((s) => {
            const g = groups[s] || { total: 0, present: 0, halfPresent: 0, weeklyOffPresent: 0, weeklyOffHalfPresent: 0, weeklyOff: 0, singlePunch: 0, absent: 0 };
            const rate = g.total ? Math.round((g.present / g.total) * 100) + "%" : "0%";
            return [s, g.total, g.present, g.halfPresent, g.weeklyOffPresent, g.weeklyOffHalfPresent, g.weeklyOff, g.singlePunch, g.absent, rate];
        });

        this._lastData["night-shift"] = rows.map((r) => ({
            Shift: r[0], Total: r[1], Present: r[2], HalfPresent: r[3],
            WOPresent: r[4], WOHalfPresent: r[5], WeeklyOff: r[6],
            SinglePunch: r[7], Absent: r[8], Rate: r[9],
        }));

        const pageSize = 25;
        const currentPage = page;
        const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
        const pageRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

        let pageButtons = "";
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, currentPage + 2);
        for (let i = startPage; i <= endPage; i++) {
            pageButtons += `
                <button class="btn-page ${i === currentPage ? "btn-page-active" : ""}" onclick="AppController.view._reRenderNightShiftPage(${i})">
                    ${i}
                </button>
            `;
        }

        return {
            html: `
                <h2 class="section-title"><i class="ph-fill ph-moon"></i> Night Shift</h2>
                <div class="charts-grid">
                    ${this._chartCard("ch-night-bar", '<i class="ph-fill ph-chart-bar"></i>', "info", "Present by Shift", "Click a segment for detail")}
                </div>
                <div id="main-table-wrap">
                    ${this._tableHTML("tbl-night", ["Shift", "Total", "Present", "Half Present", "WO Present", "WO Half Present", "Weekly Off", "Single Punch", "Absent", "Rate"], pageRows, "night-shift", (currentPage - 1) * pageSize)}
                    <div class="pagination-bar">
                        <div class="pagination-text">
                            Showing ${rows.length ? (currentPage - 1) * pageSize + 1 : 0}–${Math.min(currentPage * pageSize, rows.length)} of ${rows.length} records &nbsp;·&nbsp; Page ${currentPage} of ${totalPages}
                        </div>
                        <div class="pagination-buttons">
                            <button class="btn-page" ${currentPage === 1 ? "disabled" : ""} onclick="AppController.view._reRenderNightShiftPage(1)">«</button>
                            <button class="btn-page" ${currentPage === 1 ? "disabled" : ""} onclick="AppController.view._reRenderNightShiftPage(${currentPage - 1})">‹</button>
                            ${pageButtons}
                            <button class="btn-page" ${currentPage === totalPages ? "disabled" : ""} onclick="AppController.view._reRenderNightShiftPage(${currentPage + 1})">›</button>
                            <button class="btn-page" ${currentPage === totalPages ? "disabled" : ""} onclick="AppController.view._reRenderNightShiftPage(${totalPages})">»</button>
                        </div>
                    </div>
                </div>
                <div id="drilldown-table" style="margin-top:16px"></div>
            `,
            renderCharts: () => {
                Charts.stacked(
                    "ch-night-bar", shifts,
                    [
                        { name: "Present", data: rows.map((r) => r[2]) },
                        { name: "Half Present", data: rows.map((r) => r[3]) },
                        { name: "WO Present", data: rows.map((r) => r[4]) },
                        { name: "WO Half Present", data: rows.map((r) => r[5]) },
                        { name: "Weekly Off", data: rows.map((r) => r[6]) },
                        { name: "Single Punch", data: rows.map((r) => r[7]) },
                        { name: "Absent", data: rows.map((r) => r[8]) },
                    ],
                    "Night Shift Attendance",
                    (shiftName, index, seriesIndex, seriesName) => {
                        const filteredLogs = dayLogs.filter((l) => {
                            const e = empMap[l.empId];
                            if (!e || (e.shift || "No Shift") !== shiftName) return false;
                            return this._matchesStatus(l, seriesName);
                        });
                        this._renderDrillDown(filteredLogs, `Night Shift: ${shiftName} - ${seriesName}`, empMap);
                    },
                );
            },
        };
    }

    
    _reRenderNightShiftPage(page) {
        const content = this._renderNightShift(
            this._currentNightShiftLogs,
            this._currentNightShiftEmps,
            this._currentNightShiftEmpMap,
            this._currentNightShiftModel,
            page
        );
        document.querySelector(".tab-pane-container").innerHTML = content.html;
        content.renderCharts();
    }


    _renderDesignationWise(logs, emps, empMap, model, page = 1) {
        this._currentDesignationWiseLogs = logs;
        this._currentDesignationWiseEmps = emps;
        this._currentDesignationWiseEmpMap = empMap;
        this._currentDesignationWiseModel = model;
        const desigMap = {};

        emps.forEach((e) => {
            const name = e.designation || "Staff";
            const raw = e.designationGlobalSortOrder;
            const order = (raw === null || raw === undefined || raw === "") ? Infinity : raw;
            if (!desigMap[name] || order < desigMap[name].order) desigMap[name] = { name, order };
        });

        const desigs = Object.values(desigMap).sort((a, b) => {
            if (a.order !== b.order) return a.order - b.order;
            return a.name.localeCompare(b.name);
        }).map((d) => d.name);

        const { dateFrom, dateTo } = model.state.filters;
        const groups = this._computeGroupedDayStats(emps, logs, dateFrom, dateTo, (e) => e.designation || "Staff");
        const dayLogs = this._buildEmployeeDayLogs(emps, logs, dateFrom, dateTo);

        const rows = desigs.map((d) => {
            const g = groups[d] || { total: 0, present: 0, halfPresent: 0, weeklyOffPresent: 0, weeklyOffHalfPresent: 0, weeklyOff: 0, singlePunch: 0, absent: 0 };
            const rate = g.total ? Math.round((g.present / g.total) * 100) + "%" : "0%";
            return [d, g.total, g.present, g.halfPresent, g.weeklyOffPresent, g.weeklyOffHalfPresent, g.weeklyOff, g.singlePunch, g.absent, rate];
        });

        this._lastData["designation-wise"] = rows.map((r) => ({
            Designation: r[0],
            Total: r[1],
            Present: r[2],
            HalfPresent: r[3],
            WOPresent: r[4],
            WOHalfPresent: r[5],
            WeeklyOff: r[6],
            SinglePunch: r[7],
            Absent: r[8],
            Rate: r[9],
        }));
        // ---- Pagination ----
        const pageSize = 25;
        const currentPage = page;
        const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
        const pageRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

        let pageButtons = "";
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, currentPage + 2);
        for (let i = startPage; i <= endPage; i++) {
            pageButtons += `
                <button class="btn-page ${i === currentPage ? "btn-page-active" : ""}" onclick="AppController.view._reRenderDesignationWisePage(${i})">
                    ${i}
                </button>
            `;
        }
        return {
            html: `
                <h2 class="section-title"><i class="ph-fill ph-identification-badge"></i> Designation Statistics</h2>
                <div class="charts-grid">
                    ${this._chartCard("ch-desig-bar", '<i class="ph-fill ph-chart-bar"></i>', "teal", "Present by Designation", "Click a segment for detail")}
                </div>
               <div id="main-table-wrap">
                    ${this._tableHTML("tbl-desig", ["Designation", "Total", "Present", "Half Present", "WO Present", "WO Half Present", "Weekly Off", "Single Punch", "Absent", "Rate"], pageRows, "designation-wise", (currentPage - 1) * pageSize)}
                    <div class="pagination-bar">
                        <div class="pagination-text">
                            Showing ${rows.length ? (currentPage - 1) * pageSize + 1 : 0}–${Math.min(currentPage * pageSize, rows.length)} of ${rows.length} records &nbsp;·&nbsp; Page ${currentPage} of ${totalPages}
                        </div>
                        <div class="pagination-buttons">
                            <button class="btn-page" ${currentPage === 1 ? "disabled" : ""} onclick="AppController.view._reRenderDesignationWisePage(1)">«</button>
                            <button class="btn-page" ${currentPage === 1 ? "disabled" : ""} onclick="AppController.view._reRenderDesignationWisePage(${currentPage - 1})">‹</button>
                            ${pageButtons}
                            <button class="btn-page" ${currentPage === totalPages ? "disabled" : ""} onclick="AppController.view._reRenderDesignationWisePage(${currentPage + 1})">›</button>
                            <button class="btn-page" ${currentPage === totalPages ? "disabled" : ""} onclick="AppController.view._reRenderDesignationWisePage(${totalPages})">»</button>
                        </div>
                    </div>
                </div>
                <div id="drilldown-table" style="margin-top:16px"></div>
            `,

            renderCharts: () => {
                Charts.stacked(
                    "ch-desig-bar",
                    desigs,
                    [
                        { name: "Present", data: rows.map((r) => r[2]) },
                        { name: "Half Present", data: rows.map((r) => r[3]) },
                        { name: "WO Present", data: rows.map((r) => r[4]) },
                        { name: "WO Half Present", data: rows.map((r) => r[5]) },
                        { name: "Weekly Off", data: rows.map((r) => r[6]) },
                        { name: "Single Punch", data: rows.map((r) => r[7]) },
                        { name: "Absent", data: rows.map((r) => r[8]) },
                    ],
                    "Designation Attendance",
                    (designation, index, seriesIndex, seriesName) => {
                        const filteredLogs = dayLogs.filter((l) => {
                            const e = empMap[l.empId];
                            if (!e) return false;
                            if ((e.designation || "Staff") !== designation) return false;
                            return this._matchesStatus(l, seriesName);
                        });
                        this._renderDrillDown(filteredLogs, `Designation: ${designation} - ${seriesName}`, empMap);
                    },
                    true
                );
            },
        };
    }
    
    
    _reRenderDesignationWisePage(page) {
        const content = this._renderDesignationWise(
            this._currentDesignationWiseLogs,
            this._currentDesignationWiseEmps,
            this._currentDesignationWiseEmpMap,
            this._currentDesignationWiseModel,
            page
        );
        document.querySelector(".tab-pane-container").innerHTML = content.html;
        content.renderCharts();
    }

    
    _renderShiftWise(logs, emps, empMap, model, page = 1) {
        this._currentShiftWiseLogs = logs;
        this._currentShiftWiseEmps = emps;
        this._currentShiftWiseEmpMap = empMap;
        this._currentShiftWiseModel = model;
        const shiftStats = model.state.data.shiftStats || [];
        const { dateFrom, dateTo } = model.state.filters;
        const rows = shiftStats.map((s) => [s.shiftName, s.total, s.present, s.halfPresent, s.weeklyOffPresent || 0, s.weeklyOffHalfPresent || 0, s.weeklyOff, s.singlePunch || 0, s.absent, s.rate + "%"]);

        this._lastData["shift-wise"] = rows.map((r) => ({
            Shift: r[0],
            Total: r[1],
            Present: r[2],
            HalfPresent: r[3],
            WOPresent: r[4],
            WOHalfPresent: r[5],
            WeeklyOff: r[6],
            SinglePunch: r[7],
            Absent: r[8],
            Rate: r[9],
        }));
        // ---- Pagination ----
        const pageSize = 25;
        const currentPage = page;
        const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
        const pageRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

        let pageButtons = "";
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, currentPage + 2);
        for (let i = startPage; i <= endPage; i++) {
            pageButtons += `
                <button class="btn-page ${i === currentPage ? "btn-page-active" : ""}" onclick="AppController.view._reRenderShiftWisePage(${i})">
                    ${i}
                </button>
            `;
        }

        const fullLogs = this._buildShiftStatsLogs(emps, logs, dateFrom, dateTo);

        return {
            html: `
				<h2 class="section-title">
					<i class="ph-fill ph-clock-clockwise"></i>
					Shift Statistics
				</h2>
				
                <div class="charts-grid">
					${this._chartCard("ch-shift-bar", '<i class="ph-fill ph-chart-bar"></i>', "amber", "Present by Shift", "Click to view records")}
				</div>
				
               <div id="main-table-wrap">
                    ${this._tableHTML("tbl-shift", ["Shift", "Total", "Present", "Half Present", "WO Present", "WO Half Present", "Weekly Off", "Single Punch", "Absent", "Rate"], pageRows, "shift-wise", (currentPage - 1) * pageSize)}
                    <div class="pagination-bar">
                        <div class="pagination-text">
                            Showing ${rows.length ? (currentPage - 1) * pageSize + 1 : 0}–${Math.min(currentPage * pageSize, rows.length)} of ${rows.length} records &nbsp;·&nbsp; Page ${currentPage} of ${totalPages}
                        </div>
                        <div class="pagination-buttons">
                            <button class="btn-page" ${currentPage === 1 ? "disabled" : ""} onclick="AppController.view._reRenderShiftWisePage(1)">«</button>
                            <button class="btn-page" ${currentPage === 1 ? "disabled" : ""} onclick="AppController.view._reRenderShiftWisePage(${currentPage - 1})">‹</button>
                            ${pageButtons}
                            <button class="btn-page" ${currentPage === totalPages ? "disabled" : ""} onclick="AppController.view._reRenderShiftWisePage(${currentPage + 1})">›</button>
                            <button class="btn-page" ${currentPage === totalPages ? "disabled" : ""} onclick="AppController.view._reRenderShiftWisePage(${totalPages})">»</button>
                        </div>
                    </div>
                </div>

				<div id="drilldown-table" style="margin-top:16px"></div>
			`,

            renderCharts: () => {
                Charts.stacked(
                    "ch-shift-bar",
                    shiftStats.map((s) => s.shiftName),
                    [
                        { name: "Present", data: shiftStats.map((s) => s.present), },
                        { name: "Half Present", data: shiftStats.map((s) => s.halfPresent), },
                        { name: "WO Present", data: shiftStats.map((s) => s.weeklyOffPresent || 0), },
                        { name: "WO Half Present", data: shiftStats.map((s) => s.weeklyOffHalfPresent || 0), },
                        { name: "Weekly Off", data: shiftStats.map((s) => s.weeklyOff), },
                        { name: "Single Punch", data: shiftStats.map((s) => s.singlePunch || 0), },
                        { name: "Absent", data: shiftStats.map((s) => s.absent), },
                    ],
                    "Shift Attendance",
                    (shiftName, index, seriesIndex, seriesName) => {
                        const filteredLogs = fullLogs.filter((l) => {
                            if ((l.shiftName || "No Shift") !== shiftName) { return false; }
                            return this._matchesStatus(l, seriesName);
                        });

                        this._renderDrillDown(filteredLogs, `Shift: ${shiftName} - ${seriesName}`, empMap);
                    },
                );
            },
        };
    }


    _renderOvertime(logs, emps, empMap, model, page = 1) {
        this._currentOvertimeItems = model.getOvertimeEmployees();
        this._currentOvertimeEmpMap = empMap;
        const shiftOT = model.getOvertimeByShift();

        this._lastData["overtime"] = this._currentOvertimeItems.map(({ log, emp, date }) => ({
            Code: emp.code,
            Name: emp.name,
            Dept: emp.dept,
            Company: emp.company,
            Shift: log.shiftName || emp.shift || 'No Shift',
            Date: this._formatDate(date),
            In: log.inTime,
            Out: log.outTime,
            OvertimeMinutes: log.overtime,
            OvertimeHours: (log.overtime / 60).toFixed(2)
        }));

        const rows = shiftOT.map(s => [s.shiftName, s.empCount, s.recordCount, s.totalHours + 'h']);

        return {
            html: `
                <h2 class="section-title"><i class="ph-fill ph-hourglass-high"></i> Overtime</h2>
                <div class="charts-grid">
                    ${this._chartCard("ch-ot-shift", '<i class="ph-fill ph-chart-bar"></i>', "warning", "Overtime Hours by Shift", "Click bar for employee list")}
                </div>
                <div id="main-table-wrap">
                    ${this._tableHTML("tbl-ot", ["Shift", "Employees", "OT Records", "Total OT Hours"], rows, "overtime")}
                </div>
                <div id="drilldown-table" style="margin-top:16px"></div>
            `,
            renderCharts: () => {
                Charts.stacked(
                    "ch-ot-shift",
                    shiftOT.map(s => s.shiftName),
                    [{ name: "OT Hours", data: shiftOT.map(s => s.totalHours) }],
                    "Overtime by Shift",
                    (shiftName) => {
                        const shiftItems = this._currentOvertimeItems.filter(it =>
                            (it.log.shiftName || it.emp.shift || 'No Shift') === shiftName
                        );
                        const shiftLogs = shiftItems.map(it => it.log);
                        this._renderDrillDown(shiftLogs, `Overtime — Shift: ${shiftName}`, empMap);
                    }
                );
            }
        };
    }


    _renderManualPunchesTab(logs, emps, empMap, model) {
        this._currentManualPunchItems = model.getManualPunchEmployees();
        this._currentManualPunchEmpMap = empMap;
        const shiftMP = model.getManualPunchByShift();

        this._lastData["manual-punch"] = this._currentManualPunchItems.map(({ log, emp, date }) => ({
            Code: emp.code,
            Name: emp.name,
            Dept: emp.dept,
            Company: emp.company,
            Shift: log.shiftName || emp.shift || "No Shift",
            Date: this._formatDate(date),
            In: log.inTime,
            Out: log.outTime,
            Device: log.punchDevicesName,
        }));

        const rows = shiftMP.map(s => [s.shiftName, s.empCount, s.count]);

        return {
            html: `
                <h2 class="section-title"><i class="ph-fill ph-pencil-simple"></i> Manual Punches</h2>
                <div class="charts-grid">
                    ${this._chartCard("ch-mp-shift", '<i class="ph-fill ph-chart-bar"></i>', "warning", "Manual Punches by Shift", "Click bar for employee list")}
                </div>
                <div id="main-table-wrap">
                    ${this._tableHTML("tbl-mp", ["Shift", "Employees", "Manual Punch Records"], rows, "manual-punch")}
                </div>
                <div id="drilldown-table" style="margin-top:16px"></div>
            `,
            renderCharts: () => {
                Charts.stacked(
                    "ch-mp-shift",
                    shiftMP.map(s => s.shiftName),
                    [{ name: "Manual Punches", data: shiftMP.map(s => s.count) }],
                    "Manual Punches by Shift",
                    (shiftName) => {
                        const shiftItems = this._currentManualPunchItems.filter(it => (it.log.shiftName || it.emp.shift || "No Shift") === shiftName);
                        this._renderManualPunchDrilldown(shiftItems, `Manual Punches — Shift: ${shiftName}`);
                    }
                );
            },
        };
    }


    _reRenderShiftWisePage(page) {
        const content = this._renderShiftWise(
            this._currentShiftWiseLogs,
            this._currentShiftWiseEmps,
            this._currentShiftWiseEmpMap,
            this._currentShiftWiseModel,
            page
        );
        document.querySelector(".tab-pane-container").innerHTML = content.html;
        content.renderCharts();
    }

    
    _buildPaginatedTable(rows, headers, page, pageSize, tableId, reRenderFnName) {
        const currentPage = page;
        const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
        const pageRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize,);
        const colCount = headers.length;

        const trs = pageRows.map((r) => `
            <tr>${r.map((c) =>
            `<td>${c}</td>`,).join("")}
            </tr>`,).join("") || `
            <tr>
                <td colspan="${colCount}">None</td>
            </tr>
        `;

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
            this._formatDate(x.gapStart),
        ]);

        const spRows = singlePunchItems.map(({ log, emp, date }) => [
            emp.code || "-",
            emp.name || "-",
            emp.dept || "-",
            emp.designation || "-",
            emp.shift || "-",
            emp.company || "-",
            this._formatDate(date),
            log?.inTime || log?.outTime || "-",
        ]);

        this._currentNoPunchRows = npRows;
        this._currentSinglePunchRows = spRows;

        const npHeaders = ["Code", "Name", "Dept", "Designation", "Shift", "Company", "Gap", "Start"];
        const spHeaders = ["Code", "Name", "Dept", "Designation", "Shift", "Company", "Date", "Time"];
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
            renderCharts: () => { },
        };
    }

    
    _reRenderNoPunchPage(page) {
        const rows = this._currentNoPunchRows || [];
        const headers = ["Code", "Name", "Dept", "Designation", "Shift", "Company", "Gap", "Start"];
        const wrap = document.getElementById("special-np-table-wrap");
        if (wrap) {
            wrap.innerHTML = this._buildPaginatedTable(rows, headers, page, 10, "tbl-np", "_reRenderNoPunchPage");
        }
    }

    
    _reRenderSinglePunchPage(page) {
        const rows = this._currentSinglePunchRows || [];
        const headers = ["Code", "Name", "Dept", "Designation", "Shift", "Company", "Date", "Time"];
        const wrap = document.getElementById("special-sp-table-wrap");
        if (wrap) {
            wrap.innerHTML = this._buildPaginatedTable(rows, headers, page, 10, "tbl-sp", "_reRenderSinglePunchPage");
        }
    }


    _renderDataQuality(logs, emps, empMap, filters, model, dqPage = 1) {
        const missingDataItems = model.findMissingDataEmployees();

        const severityClass = (count) => {
            if (count >= 4) return 'dq-severity-high';
            if (count >= 2) return 'dq-severity-med';
            return 'dq-severity-low';
        };

        const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
            { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
        ));

        const renderIssueBadges = (issues) => issues.map(iss => {
            const hasVal = iss.rawValue !== null && iss.rawValue !== undefined && iss.rawValue !== '';
            const tooltip = hasVal
                ? `${iss.field}: ${iss.reason} (value: ${iss.rawValue})`
                : `${iss.field}: ${iss.reason}`;
            return `<span class="dq-badge" title="${esc(tooltip)}">${esc(iss.field)}</span>`;
        }).join(' ');

        const flagCell = (issues, fieldName, displayValue) => {
            const hit = issues.find(i => i.field === fieldName);
            if (!hit) return esc(displayValue || '-');
            const hasVal = hit.rawValue !== null && hit.rawValue !== undefined && hit.rawValue !== '';
            const tooltip = hasVal ? `${hit.reason} (value: ${hit.rawValue})` : hit.reason;
            return `<span class="dq-badge" title="${esc(tooltip)}">${esc(displayValue || 'Not set')}</span>`;
        };

        const dqRows = missingDataItems.map((x) => [
            x.emp.code || "-",
            x.emp.name || "-",
            x.emp.dept || "-",
            x.emp.company || "-",
            x.emp.designation || "-",
            flagCell(x.issues, 'Team', x.emp.teamName),
            flagCell(x.issues, 'Shift Group', x.emp.shiftGroupName),
            `<span class="dq-count ${severityClass(x.issues.length)}">${x.issues.length}</span>`,
            renderIssueBadges(x.issues),
        ]);

        this._currentDataQualityRows = dqRows;

        const dqHeaders = ["Code", "Name", "Dept", "Company", "Designation", "Team", "Shift Group", "Issues", "Missing / Invalid Fields"];
        const pageSize = 10;

        return {
            html: `
                <h2 class="section-title"><i class="ph-fill ph-database"></i> Data Quality Alerts</h2>
                <div class="table-wrap">
                    <div class="table-header">
                        <h3>⚠️ Employees with Missing Critical Data (${missingDataItems.length})</h3>
                    </div>
                    <div id="dq-table-wrap" style="overflow-x:auto">
                        ${this._buildPaginatedTable(dqRows, dqHeaders, dqPage, pageSize, "tbl-dq", "_reRenderDataQualityPage")}
                    </div>
                </div>
                <style>
                    .dq-badge{display:inline-block;padding:2px 8px;margin:2px;border-radius:12px;
                        background:#fdecea;color:#c0392b;font-size:11px;white-space:nowrap;cursor:help;}
                    .dq-count{display:inline-block;min-width:22px;padding:2px 6px;border-radius:10px;
                        text-align:center;font-weight:600;color:#fff;}
                    .dq-severity-low{background:#f0ad4e;}
                    .dq-severity-med{background:#e67e22;}
                    .dq-severity-high{background:#c0392b;}
                </style>
            `,
            renderCharts: () => { },
        };
    }


    _reRenderDataQualityPage(page) {
        const rows = this._currentDataQualityRows || [];
        const headers = ["Code", "Name", "Dept", "Company", "Designation", "Missing Fields"];
        const wrap = document.getElementById("dq-table-wrap");
        if (wrap) {
            wrap.innerHTML = this._buildPaginatedTable(rows, headers, page, 10, "tbl-dq", "_reRenderDataQualityPage");
        }
    }


    exportPDF(exportName) {
        const data = this._lastData[exportName];
        if (!data || !data.length) { alert("No data found"); return; }
        const pdf = new jspdf.jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
        const headers = ["Sr No", ...Object.keys(data[0])];
        const rows = data.map((row, index) => [
            index + 1,
            ...Object.values(row).map(value => {
                if (value === null || value === undefined)
                    return "";
                return String(value)
                    .replace(/<[^>]*>/g, "")
                    .replace(/&nbsp;/g, " ");
            })
        ]);
        pdf.autoTable({
            head: [headers], body: rows, startY: 15,
            styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
            headStyles: { fillColor: [52, 73, 94], textColor: 255 },
            theme: "grid",
            margin: { left: 5, right: 5 }
        });
        pdf.save(`${exportName}.pdf`);
    }


    bindStatCardClick(handler) {
        this.app.addEventListener("click", (event) => {
            const card = event.target.closest(".stat-card-clickable");
            if (!card) return;
            const key = card.dataset.cardKey;
            if (!key) return;

            if (key === "presentHeadcount") return;

            const wasActive = card.classList.contains("active");
            document.querySelectorAll(".stat-card-clickable").forEach((c) => c.classList.remove("active"));
            if (wasActive) {
                this._closeStatCardDrilldown();
            } else {
                card.classList.add("active");
                handler(key);
            }
        });
    }

    
    _renderStatCardDrilldown(key, items, page = 1, containerId = "stat-card-drilldown", closeHandler = "AppController.view._closeStatCardDrilldown()") {
        this._statCardKey = key;
        this._statCardItems = items;

        const panel = document.getElementById(containerId);

        if (!panel) return;

        const titleMap = {
            totalHeadcount: "👥 All Employees",
            present: "✅ Present Employees",
            halfPresent: "½ Half Day Employees",
            weeklyOff: "📅 Weekly Off Employees",
            absent: "❌ Absent Employees",
            resigned: "👤 Resigned Employees",
            newJoined: "🆕 New Joined Employees",
            singlePunch: "⚡ Single Punch Employees",
            lateIn: "🕐 Late In Employees",
            earlyOut: "🚪 Early Out Employees",
            staffList: "👔 Staff Employees",
            workerList: "🔧 Workmen Employees",
            avgHours: "⏱️ Avg Hours Records",
            avgHoursDept: "⏱️ Avg Hours Records",
            avgHoursGender: "⏱️ Avg Hours Records",
            avgHoursShift: "⏱️ Avg Hours Records",
            avgHoursStaff: "⏱️ Avg Hours Records",
            avgHoursWorker: "⏱️ Avg Hours Records",
            presentHeadcount: "✅ Present + Half Present Employees",
            weeklyOffPresent: "📅✅ Weekly Off Present Employees",
            weeklyOffHalfPresent: "📅½ Weekly Off Half Present Employees",
        };

        const isResignedOnly = key === "resigned";
        const isAgeGroup = key.startsWith("ageGroup_");
        const isCompany = key.startsWith("company_");
        const isDeptSummary = key.startsWith("deptSummary_");
        const isGenderSummary = key.startsWith("genderSummary_");
        const isShiftSummary = key.startsWith("shiftSummary_");
        const isStaffSummary = key.startsWith("staffSummary_");
        const isWorkerSummary = key.startsWith("workerSummary_");
        const isDashboardDesig = key.startsWith("dashboardDesig_");
        const isNewJoinedOnly = key === "newJoined";
        const isNewJoinedRelated = key === "newJoined" || key.startsWith("njBreakdown_") || key.startsWith("newjoinedDesig_");
        const isResignedRelated = key.startsWith("resBreakdown_") || key.startsWith("resignedDesig_");
        const isJoinExitRelated = isNewJoinedRelated || isResignedRelated;
        const isStaffList = key === "staffList";
        const isWorkerList = key === "workerList";
        const isTotalHeadcount = key === "totalHeadcount";
        const isHalfPresent = key === "halfPresent";
        const isWeeklyOff = key === "weeklyOff";
        const isDashboardMode = items.length > 0 && items[0].log === null && !isResignedOnly && !isNewJoinedOnly;

        if (isDashboardMode || isAgeGroup) {
            items = [...items].sort((a, b) => {
                const ageA = this._getAgeSortValue(a.emp?.dobRaw);
                const ageB = this._getAgeSortValue(b.emp?.dobRaw);
                return ageB - ageA;
            });

            this._statCardItems = items; 
        }

        const pageSize = 10;
        const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
        const currentPage = Math.min(page, totalPages);
        const pageItems = items.slice((currentPage - 1) * pageSize, currentPage * pageSize,);

        let headers, ths;

        if (isDashboardMode) {
            headers = ["Sr.No", "Code", "Name", "Dept", "Company", "Designation", "Team", "Shift Group", "DOB", "Age", "Location"];
        } else {
            headers = ["Sr.No", "Code", "Name", "Dept", "Company", "Designation", "Shift", "In Time", "Out Time", "Status", "Action"];
            if (isAgeGroup) {
                headers = ["Sr.No", "Code", "Name", "Dept", "Company", "Designation", "Age", "Shift", "In Time", "Out Time", "Status", "Action"];
            }
        }

        ths = headers.map((h) => `<th>${h}</th>`).join("");

        const trs = pageItems.map(({ log, emp, date }, i) => {
            if (!emp) return "";

            const sr = (currentPage - 1) * pageSize + i + 1;

            if (isDashboardMode) {
                return `
                    <tr>
                        <td>${sr}</td>
                        <td><b>${emp.code || "–"}</b></td>
                        <td>${emp.name || "–"}</td>
                        <td>${emp.dept || "–"}</td>
                        <td>${emp.company || "–"}</td>
                        <td>${emp.designation || "–"}</td>
                        <td>${emp.teamName || "-"}</td>
                        <td>${emp.shiftGroupName || "–"}</td>
                        <td>${this._formatDate(emp.dobRaw)}</td>
                        <td>${this._calculateAge(emp.dobRaw)}</td>
                        <td>${emp.location || "–"}</td>
                    </tr>
                `;
            }

            let statusCell;
            if (isResignedOnly) {
                statusCell = `<span class="badge badge-danger">${emp.status || "Resigned"}</span>`;
            } else if (isNewJoinedOnly) {
                const badgeClass = emp.status === "Resigned" ? "badge-danger" : "badge-success";
                statusCell = `<span class="badge ${badgeClass}">${emp.status || "Working"}</span>`;
            } else if (key === "weeklyOff") {
                statusCell = `<span class="badge badge-info">Weekly Off</span>`;
            } else {
                statusCell = log?.status || "–";
            }

            return `
                <tr>
                    <td>${sr}</td>
                    <td><b>${emp.code || "–"}</b></td>
                    <td>${emp.name || "–"}</td>
                    <td>${emp.dept || "–"}</td>
                    <td>${emp.company || "–"}</td>
                    <td>${emp.designation || "–"}</td>
                    ${isAgeGroup ? `<td>${this._calculateAge(emp.dobRaw)}</td>` : ""}
                    <td>${log?.shiftName || emp?.shift || "–"}</td>
                    <td>${log?.inTime || "–"}</td>
                    <td>${log?.outTime || "–"}</td>
                    <td>${statusCell}</td>
                    <td>${this._actionViewLink(log, emp, date || log?.date)}</td>
                </tr>
            `;
        }).join("");

        let pageButtons = "";
        const startP = Math.max(1, currentPage - 2);
        const endP = Math.min(totalPages, currentPage + 2);
        for (let i = startP; i <= endP; i++) {
            pageButtons += `
                <button class="btn-page ${i === currentPage ? "btn-page-active" : ""}"
                    onclick="AppController.view._renderStatCardDrilldown(AppController.view._statCardKey, AppController.view._statCardItems, ${i}, '${containerId}', '${closeHandler}')">
                    ${i}
                </button>
            `;
        }

        this._statCardExportData = items.map(({ log, emp, date }) => {
            if (isDashboardMode) {
                return {
                    Code: emp?.code,
                    Name: emp?.name,
                    Dept: emp?.dept,
                    Company: emp?.company,
                    Designation: emp?.designation,
                    TeamName: emp?.teamName,
                    shiftGroupName: emp?.shiftGroupName,
                    Shift: emp?.shift,
                    ShiftStart: emp?.shiftStart || "",
                    ShiftEnd: emp?.shiftEnd || "",
                    Location: emp?.location || "",
                };
            }
            if (key === "resigned") {
                return {
                    Code: emp?.code,
                    Name: emp?.name,
                    Dept: emp?.dept,
                    Company: emp?.company,
                    Designation: emp?.designation,
                    TeamName: emp?.teamName,
                    shiftGroupName: emp?.shiftGroupName,
                    DOJ: emp?.doj,
                    DOR: emp?.dor,
                    Status: emp?.status,
                };
            }
            if (key === "totalHeadcount") {
                return {
                    Code: emp?.code,
                    Name: emp?.name,
                    Dept: emp?.dept,
                    Company: emp?.company,
                    Designation: emp?.designation,
                    TeamName: emp?.teamName,
                    shiftGroupName: emp?.shiftGroupName,
                    Shift: emp?.shift,
                    ShiftStart: emp?.shiftStart || "",
                    ShiftEnd: emp?.shiftEnd || "",
                    Location: emp?.location || "",
                };
            }
            if (key === "staffList" || key === "workerList") {
                return {
                    Code: emp?.code,
                    Name: emp?.name,
                    Dept: emp?.dept,
                    Company: emp?.company,
                    Designation: emp?.designation,
                    TeamName: emp?.teamName,
                    shiftGroupName: emp?.shiftGroupName,
                    Shift: emp?.shift,
                    Location: emp?.location,
                };
            }
            if (key === "newJoined") {
                return {
                    Code: emp?.code,
                    Name: emp?.name,
                    Dept: emp?.dept,
                    Company: emp?.company,
                    Designation: emp?.designation,
                    TeamName: emp?.teamName,
                    shiftGroupName: emp?.shiftGroupName,
                    DOJ: emp?.doj,
                    Status: emp?.status,
                };
            }

            if (key === "staffList" || key === "workerList" || key === "totalHeadcount") {
                return {
                    Code: emp?.code,
                    Name: emp?.name,
                    Dept: emp?.dept,
                    Company: emp?.company,
                    Designation: emp?.designation,
                    TeamName: emp?.teamName,
                    shiftGroupName: emp?.shiftGroupName,
                    Shift: emp?.shift,
                    Location: emp?.location,
                };
            }

            return {
                Code: emp?.code,
                Name: emp?.name,
                Dept: emp?.dept,
                Company: emp?.company,
                Designation: emp?.designation,
                TeamName: emp?.teamName,
                shiftGroupName: emp?.shiftGroupName,
                Shift: emp?.shift,
                ShiftStart: log?.shiftStart || emp?.shiftStart || "",
                ShiftEnd: log?.shiftEnd || emp?.shiftEnd || "",
                Date: this._formatDate(date || log?.date),
                In: log?.inTime || "",
                Out: log?.outTime || "",
                Hours: log?.hoursWorked ?? "",
                LateBy: log?.lateBy ?? "",
                EarlyBy: log?.earlyBy ?? "",
                Status: key === "weeklyOff" ? "Weekly Off" : log?.status || "",
                DetailedStatus: log?.detailedStatus || "",
                DOB: this._formatDate(emp?.dobRaw),
                Overtime: log?.overtime || 0,
            };
        });

        panel.style.display = "block";
        panel.innerHTML = `
			<div class="drilldown-box">
				<div class="drilldown-header">
					<div class="drilldown-title">
                        ${titleMap[key] || (isAgeGroup ? "🎂 Age Group: " + key.replace("ageGroup_", "") : isCompany ? "🏢 Company: " + key.replace("company_", "") : isDeptSummary ? "💼 Dept: " + key.replace("deptSummary_", "") : isGenderSummary ? "⚧ Gender: " + key.replace("genderSummary_", "") : isShiftSummary ? "🕐 Shift: " + key.replace("shiftSummary_", "") : isStaffSummary ? "👔 Staff Dept: " + key.replace("staffSummary_", "") : isWorkerSummary ? "🔧 Workmen Dept: " + key.replace("workerSummary_", "") : isDashboardDesig ? "🏷️ Designation: " + key.replace("dashboardDesig_", "") : key)}
						<small>${items.length} records</small>
					</div>
					<div class="drilldown-btn-group">
						<button class="btn-drill btn-drill-excel"
							onclick="AppController.view.exportExcel(AppController.view._statCardExportData, '${key}-employees')">
							↓ Excel
						</button>
						<button class="btn-drill btn-drill-back"
                            onclick="${closeHandler}">
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
                            onclick="AppController.view._renderStatCardDrilldown(AppController.view._statCardKey, AppController.view._statCardItems, 1, '${containerId}', '${closeHandler}')">«</button>
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
        document.querySelectorAll(".stat-card-clickable").forEach((c) => c.classList.remove("active"));
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
        const detailsContainer = document.getElementById("designation-order-details-container",);
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

            const dept = departments.find((d) => String(d.id) === String(deptId),);
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
                alert("Failed to save designation orders: " + (saveRes ? saveRes.message : "Unknown error"),);
            }
        });
    }


    async _initSortOrderTab(model) {
        const contentEl = document.getElementById("sort-order-content");
        if (!contentEl) return;

        const [compRes, deptRes, desigRes] = await Promise.all([
            model.fetchCompaniesOrder(),
            model.fetchDepartmentsOrder(),
            model.fetchDesignationGlobalOrder(),
        ]);

        if (!compRes.success || !deptRes.success || !desigRes.success) {
            contentEl.innerHTML = `
                <div style="padding:24px;background:rgba(244,63,94,0.05);border:1px solid rgba(244,63,94,0.2);color:#f43f5e;border-radius:var(--radius-md);font-weight:500;">
                    <i class="ph-fill ph-warning-circle" style="font-size:20px;"></i>
                    Error loading data. Please try again.
                </div>
            `;
            return;
        }

        const companies = compRes.data || [];
        const departments = deptRes.data || [];
        
        const designations = desigRes.data || [];

        contentEl.innerHTML = `
            <style>
                .sort-order-tabs { display:flex; gap:8px; margin-bottom:24px; }
                .sort-order-tab-btn {
                    padding: 10px 24px;
                    border-radius: 10px;
                    border: 1px solid var(--border-color);
                    background: var(--white);
                    font-size: 14px;
                    font-weight: 600;
                    color: var(--text-muted);
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .sort-order-tab-btn.active {
                    background: var(--primary);
                    color: #fff;
                    border-color: var(--primary);
                    box-shadow: 0 4px 14px rgba(99,102,241,0.3);
                }
                .sort-order-panel { display: none; }
                .sort-order-panel.active { display: block; }
                .sort-order-card {
                    background: var(--white);
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius-md);
                    box-shadow: var(--shadow-sm);
                    padding: 24px;
                    max-width: 560px;
                    margin: 0 auto;
                }
                .sort-order-header-bar {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                    padding-bottom: 16px;
                    border-bottom: 1px solid var(--border-color);
                }
                .sort-order-header-bar h3 {
                    font-size: 15px;
                    font-weight: 700;
                    color: var(--text-main);
                }
                .sort-order-header-bar p {
                    font-size: 12px;
                    color: var(--text-muted);
                    margin-top: 2px;
                }
                .sort-order-item {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 12px 16px;
                    background: #f8fafc;
                    border: 1px solid #f1f5f9;
                    border-radius: 10px;
                    margin-bottom: 10px;
                    font-size: 14px;
                    transition: background 0.15s, border-color 0.15s;
                }
                .sort-order-item:hover { background: #f1f5f9; border-color: #e2e8f0; }
                .sort-order-item-name { font-weight: 600; color: #334155; }
                .sort-order-null-badge {
                    font-size: 11px;
                    background: #f1f5f9;
                    color: #94a3b8;
                    padding: 2px 8px;
                    border-radius: 9999px;
                    margin-left: 8px;
                }
                .sort-order-control {
                    display: flex;
                    align-items: center;
                    background: var(--white);
                    border: 1px solid #cbd5e1;
                    border-radius: 8px;
                    overflow: hidden;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                }
                .sort-order-btn {
                    background: none;
                    border: none;
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #64748b;
                    cursor: pointer;
                    font-size: 14px;
                    transition: background 0.15s, color 0.15s;
                }
                .sort-order-btn:hover { background: #f1f5f9; color: var(--primary); }
                .sort-order-input {
                    width: 48px;
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
                .sort-order-input::-webkit-outer-spin-button,
                .sort-order-input::-webkit-inner-spin-button { -webkit-appearance: none; }
                .sort-order-clear-btn {
                    background: none;
                    border: none;
                    color: #94a3b8;
                    font-size: 12px;
                    cursor: pointer;
                    padding: 4px 6px;
                    border-radius: 6px;
                    transition: color 0.15s, background 0.15s;
                }
                .sort-order-clear-btn:hover { color: #f43f5e; background: rgba(244,63,94,0.07); }
                .sort-order-save-bar {
                    display: flex;
                    justify-content: flex-end;
                    margin-top: 20px;
                }
            </style>

            <div class="sort-order-tabs">
                <button class="sort-order-tab-btn active" data-panel="companies">
                    <i class="ph ph-buildings"></i> Companies
                </button>
                <button class="sort-order-tab-btn" data-panel="departments">
                    <i class="ph ph-briefcase"></i> Departments
                </button>
                <button class="sort-order-tab-btn" data-panel="designations">
                    <i class="ph ph-identification-badge"></i> Designations
                </button>
            </div>

            <!-- Companies Panel -->
            <div class="sort-order-panel active" id="sort-panel-companies">
                <div class="sort-order-card">
                    <div class="sort-order-header-bar">
                        <div>
                            <h3>Company Sort Order</h3>
                            <p>Set priority order for companies. Lower number = appears first. Leave blank for alphabetical.</p>
                        </div>
                        <button class="btn-order-save" id="btn-save-companies">
                            <i class="ph-bold ph-floppy-disk"></i> Save
                        </button>
                    </div>
                    <div id="companies-list">
                        ${companies.map((c) => `
                            <div class="sort-order-item">
                                <div style="display:flex;align-items:center;">
                                    <i class="ph ph-buildings" style="color:#6366f1;margin-right:10px;font-size:16px;"></i>
                                    <span class="sort-order-item-name">${c.name}</span>
                                    ${c.sortOrder === null ? '<span class="sort-order-null-badge">not set</span>' : ""}
                                </div>
                                <div style="display:flex;align-items:center;gap:6px;">
                                    <div class="sort-order-control">
                                        <button class="sort-order-btn btn-dec" type="button"><i class="ph ph-minus"></i></button>
                                        <input type="number" class="sort-order-input company-order-input"
                                            data-id="${c.id}"
                                            value="${c.sortOrder !== null ? c.sortOrder : ""}"
                                            placeholder="–">
                                        <button class="sort-order-btn btn-inc" type="button"><i class="ph ph-plus"></i></button>
                                    </div>
                                    <button class="sort-order-clear-btn" data-target="company" data-id="${c.id}" title="Clear (reset to NULL)">
                                        <i class="ph ph-x"></i>
                                    </button>
                                </div>
                            </div>
                        `,).join("")}
                    </div>
                </div>
            </div>

            <!-- Departments Panel -->
            <div class="sort-order-panel" id="sort-panel-departments">
                <div class="sort-order-card">
                    <div class="sort-order-header-bar">
                        <div>
                            <h3>Department Sort Order</h3>
                            <p>Set priority order for departments. Lower number = appears first. Leave blank for alphabetical.</p>
                        </div>
                        <button class="btn-order-save" id="btn-save-departments">
                            <i class="ph-bold ph-floppy-disk"></i> Save
                        </button>
                    </div>
                    <div id="departments-list">
                        ${departments.map((d) => `
                            <div class="sort-order-item">
                                <div style="display:flex;align-items:center;">
                                    <i class="ph ph-briefcase" style="color:#6366f1;margin-right:10px;font-size:16px;"></i>
                                    <span class="sort-order-item-name">${d.name}</span>
                                    ${d.sortOrder === null ? '<span class="sort-order-null-badge">not set</span>' : ""}
                                </div>
                                <div style="display:flex;align-items:center;gap:6px;">
                                    <div class="sort-order-control">
                                        <button class="sort-order-btn btn-dec" type="button"><i class="ph ph-minus"></i></button>
                                        <input type="number" class="sort-order-input dept-order-input"
                                            data-id="${d.id}"
                                            value="${d.sortOrder !== null ? d.sortOrder : ""}"
                                            placeholder="–">
                                        <button class="sort-order-btn btn-inc" type="button"><i class="ph ph-plus"></i></button>
                                    </div>
                                    <button class="sort-order-clear-btn" data-target="dept" data-id="${d.id}" title="Clear (reset to NULL)">
                                        <i class="ph ph-x"></i>
                                    </button>
                                </div>
                            </div>
                        `,).join("")}
                    </div>
                </div>
            </div>

            <!-- Designations Panel -->
            <div class="sort-order-panel" id="sort-panel-designations">
                <div class="sort-order-card">
                    <div class="sort-order-header-bar">
                        <div>
                            <h3>Designation Sort Order</h3>
                            <p>Set priority order for designations globally, independent of department. Lower number = appears first in Designation Stats.</p>
                        </div>
                        <button class="btn-order-save" id="btn-save-designations">
                            <i class="ph-bold ph-floppy-disk"></i> Save
                        </button>
                    </div>
                    <div id="designations-list">
                        ${designations.map((d) => `
                            <div class="sort-order-item">
                                <div style="display:flex;align-items:center;">
                                    <i class="ph ph-identification-badge" style="color:#6366f1;margin-right:10px;font-size:16px;"></i>
                                    <span class="sort-order-item-name">${d.name}</span>
                                    ${d.sortOrder === null ? '<span class="sort-order-null-badge">not set</span>' : ""}
                                </div>
                                <div style="display:flex;align-items:center;gap:6px;">
                                    <div class="sort-order-control">
                                        <button class="sort-order-btn btn-dec" type="button"><i class="ph ph-minus"></i></button>
                                        <input type="number" class="sort-order-input designation-order-input"
                                            data-id="${d.id}"
                                            value="${d.sortOrder !== null ? d.sortOrder : ""}"
                                            placeholder="–">
                                        <button class="sort-order-btn btn-inc" type="button"><i class="ph ph-plus"></i></button>
                                    </div>
                                    <button class="sort-order-clear-btn" data-target="designation" data-id="${d.id}" title="Clear (reset to NULL)">
                                        <i class="ph ph-x"></i>
                                    </button>
                                </div>
                            </div>
                        `,).join("")}
                    </div>
                </div>
            </div>
        `;

        contentEl.querySelectorAll(".sort-order-tab-btn").forEach((btn) => {
            btn.addEventListener("click", () => {
                contentEl.querySelectorAll(".sort-order-tab-btn").forEach((b) => b.classList.remove("active"));
                contentEl.querySelectorAll(".sort-order-panel").forEach((p) => p.classList.remove("active"));
                btn.classList.add("active");
                contentEl.querySelector(`#sort-panel-${btn.dataset.panel}`).classList.add("active");
            });
        });

        contentEl.querySelectorAll(".sort-order-item").forEach((item) => {
            const dec = item.querySelector(".btn-dec");
            const inc = item.querySelector(".btn-inc");
            const input = item.querySelector(".sort-order-input");
            if (!input) return;

            dec.addEventListener("click", () => {
                const val = input.value === "" ? null : parseInt(input.value);
                if (val === null) return;
                input.value = Math.max(1, val - 1);
            });

            inc.addEventListener("click", () => {
                const val = input.value === "" ? 1 : parseInt(input.value) + 1;
                input.value = val;
            });
        });

        contentEl.querySelectorAll(".sort-order-clear-btn").forEach((btn) => {
            btn.addEventListener("click", () => {
                const item = btn.closest(".sort-order-item");
                const input = item.querySelector(".sort-order-input");
                if (input) input.value = "";
            });
        });

        document.getElementById("btn-save-companies").addEventListener("click", async () => {
            const inputs = contentEl.querySelectorAll(".company-order-input",);
            const items = [];
            inputs.forEach((input) => {
                items.push({
                    id: parseInt(input.dataset.id),
                    sortOrder: input.value !== "" ? parseInt(input.value) : null,
                });
            });

            this.showOverlay("Saving company order...");
            const res = await model.saveCompaniesOrder(items);
            this.hideOverlay();

            if (res && res.success) {
                alert("Company sort order saved successfully!");
                model.state.filterLists = null;
            } else {
                alert("Failed: " + (res ? res.message : "Unknown error"));
            }
        });

        document.getElementById("btn-save-departments").addEventListener("click", async () => {
            const inputs = contentEl.querySelectorAll(".dept-order-input");
            const items = [];
            inputs.forEach((input) => {
                items.push({
                    id: parseInt(input.dataset.id),
                    sortOrder: input.value !== "" ? parseInt(input.value) : null,
                });
            });

            this.showOverlay("Saving department order...");
            const res = await model.saveDepartmentsOrder(items);
            this.hideOverlay();

            if (res && res.success) {
                alert("Department sort order saved successfully!");
                model.state.filterLists = null;
            } else {
                alert("Failed: " + (res ? res.message : "Unknown error"));
            }
        });

        document.getElementById("btn-save-designations").addEventListener("click", async () => {
            const inputs = contentEl.querySelectorAll(".designation-order-input");
            const items = [];
            inputs.forEach((input) => {
                items.push({
                    id: parseInt(input.dataset.id),
                    sortOrder: input.value !== "" ? parseInt(input.value) : null,
                });
            });

            this.showOverlay("Saving designation order...");
            const res = await model.saveDesignationGlobalOrder(items);

            if (res && res.success) {
                this.showOverlay("Refreshing data...");
                await model.fetchData();
                this.hideOverlay();
                alert("Designation sort order saved successfully!");
                model.state.filterLists = null;
            } else {
                this.hideOverlay();
                alert("Failed: " + (res ? res.message : "Unknown error"));
            }
        });
    }


    async _initDesignationFamiliesTab(model) {
        const contentEl = document.getElementById("designation-families-content");
        if (!contentEl) return;

        const [famRes, unmappedRes] = await Promise.all([
            model.fetchDesignationFamilies(),
            model.fetchUnmappedDesignations()
        ]);

        if (!famRes || !famRes.success) {
            contentEl.innerHTML = `
                <div class="alert-error-panel" style="padding:24px;background:rgba(244,63,94,0.05);border:1px solid rgba(244,63,94,0.2);color:#f43f5e;border-radius:var(--radius-md);display:flex;align-items:center;gap:12px;font-weight:500;">
                    <i class="ph-fill ph-warning-circle" style="font-size:24px;"></i>
                    <span><strong>Error loading families:</strong> ${famRes ? famRes.message : "Unknown error"}</span>
                </div>
            `;
            return;
        }

        const families = famRes.data || [];
        const unmapped = (unmappedRes && unmappedRes.success) ? (unmappedRes.data || []) : [];

        this._currentDesigFamiliesData = { families, unmapped };

        const colorCls = ["info", "success", "warning", "accent", "danger"];

        contentEl.innerHTML = `
            <style>
                .desig-fam-header{ display:flex; justify-content:space-between; align-items:center; gap:12px; padding:24px; margin-bottom:24px; background:#fff; border:1px solid #e2e8f0; border-radius:16px; box-shadow:0 6px 18px rgba(15,23,42,.06);}
                .desig-fam-new-input{ width:250px; height:35px;  padding:0 14px; border:1px solid var(--border-color); border-radius:10px; font-size:12px; outline:none; box-sizing:border-box;}
                .desig-fam-unmapped-banner{ display:flex; align-items:center; gap:12px; padding:16px 20px; margin-bottom:20px; border-radius:14px; background:#fffbeb; border:1px solid #fde68a; color:#92400e; font-weight:600;}
                .desig-fam-card{ background:#fff; border:1px solid #e5e7eb; border-radius:16px; padding:20px; margin-bottom:16px; transition:.25s; box-shadow:0 3px 10px rgba(15,23,42,.05);}
                .desig-fam-card:hover{ transform:translateY(-2px); box-shadow:0 10px 25px rgba(15,23,42,.10);}
                .desig-fam-card-top{ display:flex; justify-content:space-between; align-items:center; gap:20px;}
                .desig-fam-card-title{ display:flex; align-items:center; gap:12px; font-size:16px; font-weight:700; color:#1e293b;}
                .desig-fam-count-badge{ background:#eef2ff; color:#4f46e5; padding:5px 12px; border-radius:999px; font-size:12px; font-weight:700;}
                .desig-fam-card-actions{ display:flex; align-items:center; justify-content:center; gap:10px;}
                .desig-fam-btn-icon{ width:36px; height:36px; display:flex; align-items:center; justify-content:center; border-radius:10px; border:1px solid #e2e8f0; background:#fff; cursor:pointer; transition:.2s;}
                .desig-fam-btn-icon:hover{ background:#fef2f2; color:#dc2626; border-color:#fecaca;}
                .desig-fam-toggle-btn:hover{ background:#eef2ff; color:#4f46e5; border-color:#c7d2fe;}
                .desig-fam-detail{ margin-top:18px; padding-top:18px; border-top:1px solid #edf2f7;}
                .desig-fam-chip-list { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:14px; }
                .desig-fam-chip{ display:flex; align-items:center; gap:8px; padding:8px 14px; background:#eef2ff; color:#4338ca; border-radius:999px; font-size:13px; font-weight:600;}
                .desig-fam-chip button{ width:18px; height:18px; border:none; border-radius:50%; background:#4338ca; color:#fff; cursor:pointer;}
                .desig-fam-add-panel{ margin-top:18px; padding:18px 18px 10px 18px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:14px;}
                .desig-fam-add-panel-title { font-size:12px; font-weight:700; color:#64748b; margin-bottom:10px; text-transform:uppercase; letter-spacing:0.05em; }
                .desig-fam-search-input{ width:100%; height:42px; padding:0 14px; border:1px solid #dbe4ee; border-radius:10px; margin-bottom:16px; transition:.2s;}
                .desig-fam-search-input:focus{ border-color:#6366f1; box-shadow:0 0 0 4px rgba(99,102,241,.10);}
                .desig-fam-checkbox-grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:10px; max-height:220px; overflow:auto; padding-right:4px;}
                .desig-fam-checkbox-item{ display:flex; align-items:center; gap:10px; padding:10px 12px; background:#fff; border:1px solid #e2e8f0; border-radius:10px; transition:.2s; cursor:pointer;}
                .desig-fam-checkbox-item:hover{ background:#eef2ff; border-color:#6366f1;}
                .desig-fam-add-btn{ display:inline-flex; align-items:center; justify-content:center; flex-direction:row; gap:6px; white-space:nowrap; height:35px; padding:0 18px; margin-top:10px; background:#4f46e5; color:#fff; border:none; border-radius:10px; font-size:14px; font-weight:600; cursor:pointer; line-height:1; transition:.25s;}
                .desig-fam-add-btn i{ display:flex; align-items:center; justify-content:center; font-size:16px; line-height:1; flex-shrink:0;}
                .desig-fam-add-btn:hover{ background:#4338ca;}
                .desig-fam-no-results { color:#94a3b8; font-size:13px; padding:8px 0; display:none; }
            </style>

            <div class="desig-fam-header">
                    <div style="flex:1;">
                    <h3 style="font-size:16px;font-weight:700;color:var(--text-main);margin-bottom:4px;">Family Cards</h3>
                    <p style="font-size:13px;color:var(--text-muted);">Create family groups (e.g. Top Management, Workmen Family) and assign designations to each.</p>
                </div>
                <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;height:35px;">
                    <input type="text" id="new-family-name-input" class="desig-fam-new-input" placeholder="New family name (e.g. Top Management)">
                    <button class="btn-order-save desig-fam-add-btn" id="btn-create-family">
                        <i class="ph-bold ph-plus"></i> Create
                    </button>
                </div>
            </div>

            ${unmapped.length > 0 ? `
                <div class="desig-fam-unmapped-banner">
                    <i class="ph-fill ph-warning-circle" style="font-size:18px;"></i>
                    ${unmapped.length} designation${unmapped.length === 1 ? "" : "s"} not yet assigned to any family.
                </div>
            ` : ""}

            <div id="desig-fam-list">
                ${families.length === 0 ? `
                    <div class="empty-state-panel" style="padding:48px;text-align:center;color:var(--text-muted);background:var(--white);border-radius:var(--radius-md);box-shadow:var(--shadow-sm);">
                        <i class="ph ph-cards" style="font-size:40px;color:#cbd5e1;margin-bottom:10px;display:block;"></i>
                        <span>No families created yet. Create one above.</span>
                    </div>
                ` : families.map((fam, i) => `
                    <div class="desig-fam-card" data-family-id="${fam.id}">
                        <div class="desig-fam-card-top" onclick="AppController.view._toggleDesigFamilyDetail(${fam.id})">
                            <div class="desig-fam-card-title">
                                <i class="ph ph-cards" style="color:#6366f1;"></i>
                                ${this._escapeAttr(fam.name)}
                                <span class="desig-fam-count-badge">${fam.designations.length} designations</span>
                            </div>
                          <div class="desig-fam-card-actions">
                            <button class="desig-fam-btn-icon"
                                onclick="event.stopPropagation(); AppController.view._deleteDesigFamilyConfirm(${fam.id})"
                                title="Delete family">
                                <i class="ph ph-trash"></i>
                            </button>

                            <button class="desig-fam-btn-icon desig-fam-toggle-btn"
                                onclick="event.stopPropagation(); AppController.view._toggleDesigFamilyDetail(${fam.id})">
                                <i class="ph ph-caret-down"></i>
                            </button>
                        </div>
                        </div>
                        <div class="desig-fam-detail" id="desig-fam-detail-${fam.id}">
                            <div class="desig-fam-chip-list">
                                ${fam.designations.length === 0
                                    ? '<span style="color:#94a3b8;font-size:13px;">No designations assigned yet.</span>'
                                    : fam.designations.map(d => `
                                        <div class="desig-fam-chip">
                                            ${this._escapeAttr(d.name)}
                                            <button onclick="AppController.view._removeDesigFromFamily(${fam.id}, ${d.id})" title="Remove">✕</button>
                                        </div>
                                    `).join("")
                                }
                            </div>
                            <div class="desig-fam-add-panel">
                                <div class="desig-fam-add-panel-title">Add designations to this family</div>
                                ${unmapped.length === 0
                                    ? '<span style="color:#94a3b8;font-size:13px;">No unmapped designations available.</span>'
                                    : `
                                        <input type="text"
                                               class="desig-fam-search-input"
                                               data-family-id="${fam.id}"
                                               placeholder="Search designations..."
                                               oninput="AppController.view._filterDesigFamilyCheckboxes(${fam.id}, this.value)">
                                        <div class="desig-fam-checkbox-grid" id="desig-fam-checkbox-grid-${fam.id}">
                                            ${unmapped.map(d => `
                                                <label class="desig-fam-checkbox-item" data-search-text="${this._escapeAttr(d.name.toLowerCase())}">
                                                    <input type="checkbox" class="desig-fam-add-checkbox" data-family-id="${fam.id}" value="${d.id}">
                                                    ${this._escapeAttr(d.name)}
                                                </label>
                                            `).join("")}
                                        </div>
                                        <div class="desig-fam-no-results" id="desig-fam-no-results-${fam.id}">
                                            No matching designations.
                                        </div>
                                     <button class="btn-order-save desig-fam-add-btn" onclick="AppController.view._addDesigsToFamily(${fam.id})">
                                            <i class="ph-bold ph-plus"></i> Add Selected
                                    </button>
                                    `
                                }
                            </div>
                        </div>
                    </div>
                `).join("")}
            </div>
        `;

        const createBtn = document.getElementById("btn-create-family");
        const nameInput = document.getElementById("new-family-name-input");
        createBtn.addEventListener("click", () => this._createNewDesigFamily(nameInput.value));
        nameInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") this._createNewDesigFamily(nameInput.value);
        });
    }

    
    _toggleDesigFamilyDetail(familyId) {
        const el = document.getElementById(`desig-fam-detail-${familyId}`);
        if (!el) return;
        const isOpen = el.style.display === "block";
        document.querySelectorAll(".desig-fam-detail").forEach(d => (d.style.display = "none"));
        el.style.display = isOpen ? "none" : "block";
    }

    
    _filterDesigFamilyCheckboxes(familyId, query) {
        const grid = document.getElementById(`desig-fam-checkbox-grid-${familyId}`);
        const noResultsEl = document.getElementById(`desig-fam-no-results-${familyId}`);
        if (!grid) return;

        const q = (query || "").trim().toLowerCase();
        const items = grid.querySelectorAll(".desig-fam-checkbox-item");
        let visibleCount = 0;

        items.forEach(item => {
            const text = item.getAttribute("data-search-text") || "";
            const matches = text.includes(q);
            item.style.display = matches ? "flex" : "none";
            if (matches) visibleCount++;
        });

        if (noResultsEl) {
            noResultsEl.style.display = (visibleCount === 0 && q !== "") ? "block" : "none";
        }
    }

    
    async _createNewDesigFamily(name) {
        const trimmed = (name || "").trim();
        if (!trimmed) {
            alert("Please enter a family name.");
            return;
        }
        this.showOverlay("Creating family...");
        const res = await AppController.model.saveDesignationFamily(trimmed);
        this.hideOverlay();

        if (res && res.success) {
            await this._initDesignationFamiliesTab(AppController.model);
        } else {
            alert("Failed to create family: " + (res ? res.message : "Unknown error"));
        }
    }

    
    async _deleteDesigFamilyConfirm(familyId) {
        if (!confirm("Delete this family? Its designations will become unmapped.")) return;

        this.showOverlay("Deleting family...");
        const res = await AppController.model.deleteDesignationFamily(familyId);
        this.hideOverlay();

        if (res && res.success) {
            await this._initDesignationFamiliesTab(AppController.model);
        } else {
            alert("Failed to delete family: " + (res ? res.message : "Unknown error"));
        }
    }

    
    async _addDesigsToFamily(familyId) {
        const data = this._currentDesigFamiliesData;
        if (!data) return;

        const fam = data.families.find(f => f.id === familyId);
        if (!fam) return;

        const checked = Array.from(
            document.querySelectorAll(`.desig-fam-add-checkbox[data-family-id="${familyId}"]:checked`)
        ).map(cb => parseInt(cb.value));

        if (checked.length === 0) {
            alert("Please select at least one designation to add.");
            return;
        }

        const existingIds = fam.designations.map(d => d.id);
        const newIds = [...existingIds, ...checked];

        this.showOverlay("Saving...");
        const res = await AppController.model.saveDesignationFamilyMapping(familyId, newIds);
        this.hideOverlay();

        if (res && res.success) {
            await this._initDesignationFamiliesTab(AppController.model);
        } else {
            alert("Failed to save: " + (res ? res.message : "Unknown error"));
        }
    }

    
    async _removeDesigFromFamily(familyId, designationId) {
        const data = this._currentDesigFamiliesData;
        if (!data) return;

        const fam = data.families.find(f => f.id === familyId);
        if (!fam) return;

        const remainingIds = fam.designations.filter(d => d.id !== designationId).map(d => d.id);

        this.showOverlay("Removing...");
        const res = await AppController.model.saveDesignationFamilyMapping(familyId, remainingIds);
        this.hideOverlay();

        if (res && res.success) {
            await this._initDesignationFamiliesTab(AppController.model);
        } else {
            alert("Failed to remove: " + (res ? res.message : "Unknown error"));
        }
    }

    
    _renderStaff(logs, emps, empMap, model, page = 1) {
        this._currentStaffTabLogs = logs;
        this._currentStaffTabEmps = emps;
        this._currentStaffTabEmpMap = empMap;
        this._currentStaffTabModel = model;
        const staffTeamId = model.state.teamConfig?.staffTeamId ?? 7;
        const { dateFrom, dateTo } = model.state.filters;

        const staffEmps = emps.filter((e) => e.team === staffTeamId);
        const staffGroups = this._computeGroupedDayStats(staffEmps, logs, dateFrom, dateTo, (e) => e.dept);
        const staffDepts = [...new Set(staffEmps.map((e) => e.dept))].sort();
        const dayLogs = this._buildEmployeeDayLogs(staffEmps, logs, dateFrom, dateTo);

        const staffRows = staffDepts.map((d) => {
            const g = staffGroups[d] || {};
            return [d, g.total || 0, g.present || 0, g.halfPresent || 0, g.weeklyOffPresent || 0, g.weeklyOffHalfPresent || 0, g.weeklyOff || 0, g.singlePunch || 0, g.absent || 0, g.total ? Math.round((g.present / g.total) * 100) + "%" : "0%"];
        });

        this._lastData["staff-wise"] = staffRows.map((r) => ({
            Dept: r[0],
            Total: r[1],
            Present: r[2],
            Half: r[3],
            WOPresent: r[4],
            WOHalfPresent: r[5],
            WeeklyOff: r[6],
            Absent: r[7],
            Rate: r[8],
        }));
        // ---- Pagination ----
        const pageSize = 25;
        const currentPage = page;
        const totalPages = Math.max(1, Math.ceil(staffRows.length / pageSize));
        const pageRows = staffRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

        let pageButtons = "";
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, currentPage + 2);
        for (let i = startPage; i <= endPage; i++) {
            pageButtons += `
                <button class="btn-page ${i === currentPage ? "btn-page-active" : ""}" onclick="AppController.view._reRenderStaffTabPage(${i})">
                    ${i}
                </button>
            `;
        }
        return {
            html: `
				<h2 class="section-title">
					<i class="ph-fill ph-identification-badge"></i> Staff Statistics
				</h2>
				
                <div class="charts-grid">
					${this._chartCard("ch-staff-dept", '<i class="ph-fill ph-chart-bar"></i>', "violet", "Staff Attendance by Department", "Click bar for detail")}
				</div>
				
              <div id="main-table-wrap">
                    ${this._tableHTML("tbl-staff", ["Dept", "Total", "Present", "Half Present", "WO Present", "WO Half Present", "Weekly Off", "Single Punch", "Absent", "Rate"], pageRows, "staff-wise", (currentPage - 1) * pageSize)}
                    <div class="pagination-bar">
                        <div class="pagination-text">
                            Showing ${staffRows.length ? (currentPage - 1) * pageSize + 1 : 0}–${Math.min(currentPage * pageSize, staffRows.length)} of ${staffRows.length} records &nbsp;·&nbsp; Page ${currentPage} of ${totalPages}
                        </div>
                        <div class="pagination-buttons">
                            <button class="btn-page" ${currentPage === 1 ? "disabled" : ""} onclick="AppController.view._reRenderStaffTabPage(1)">«</button>
                            <button class="btn-page" ${currentPage === 1 ? "disabled" : ""} onclick="AppController.view._reRenderStaffTabPage(${currentPage - 1})">‹</button>
                            ${pageButtons}
                            <button class="btn-page" ${currentPage === totalPages ? "disabled" : ""} onclick="AppController.view._reRenderStaffTabPage(${currentPage + 1})">›</button>
                            <button class="btn-page" ${currentPage === totalPages ? "disabled" : ""} onclick="AppController.view._reRenderStaffTabPage(${totalPages})">»</button>
                        </div>
                    </div>
                </div>
				
                <div id="drilldown-table" style="margin-top:16px"></div>
			`,

            renderCharts: () => {
                Charts.stacked(
                    "ch-staff-dept",
                    staffDepts,
                    [
                        { name: "Present", data: staffRows.map((r) => r[2]) },
                        { name: "Half Present", data: staffRows.map((r) => r[3]), },
                        { name: "WO Present", data: staffRows.map((r) => r[4]), },
                        { name: "WO Half Present", data: staffRows.map((r) => r[5]), },
                        { name: "Weekly Off", data: staffRows.map((r) => r[6]), },
                        { name: "Single Punch", data: staffRows.map((r) => r[7]), },
                        { name: "Absent", data: staffRows.map((r) => r[8]) },
                    ],
                    "Staff by Department",
                    (dept, index, seriesIndex, seriesName) => {
                        const filtered = dayLogs.filter((l) => {
                            const e = empMap[l.empId];
                            if (!e || e.dept !== dept) return false;
                            if (e.team !== staffTeamId) return false;
                            return this._matchesStatus(l, seriesName);
                        });
                        this._renderDrillDown(filtered, `Staff – ${dept} – ${seriesName}`, empMap,);
                    },
                );
            },
        };
    }
    
    
    _reRenderStaffTabPage(page) {
        const content = this._renderStaff(
            this._currentStaffTabLogs,
            this._currentStaffTabEmps,
            this._currentStaffTabEmpMap,
            this._currentStaffTabModel,
            page
        );
        document.querySelector(".tab-pane-container").innerHTML = content.html;
        content.renderCharts();
    }

    
    _renderWorker(logs, emps, empMap, model, page = 1) {
        this._currentWorkerTabLogs = logs;
        this._currentWorkerTabEmps = emps;
        this._currentWorkerTabEmpMap = empMap;
        this._currentWorkerTabModel = model;
        const workerTeamId = model.state.teamConfig?.workerTeamId ?? 6;
        const { dateFrom, dateTo } = model.state.filters;

        const workerEmps = emps.filter((e) => e.team === workerTeamId);
        const workerGroups = this._computeGroupedDayStats(workerEmps, logs, dateFrom, dateTo, (e) => e.dept);
        const workerDepts = [...new Set(workerEmps.map((e) => e.dept))].sort();

        const workerRows = workerDepts.map((d) => {
            const g = workerGroups[d] || {};
            return [d, g.total || 0, g.present || 0, g.halfPresent || 0, g.weeklyOffPresent || 0, g.weeklyOffHalfPresent || 0, g.weeklyOff || 0, g.absent || 0, g.total ? Math.round((g.present / g.total) * 100) + "%" : "0%"];
        });

        this._lastData["worker-wise"] = workerRows.map((r) => ({
            Dept: r[0],
            Total: r[1],
            Present: r[2],
            Half: r[3],
            WOPresent: r[4],
            WOHalfPresent: r[5],
            WeeklyOff: r[6],
            Absent: r[7],
            Rate: r[8],
        }));
        // ---- Pagination ----
        const pageSize = 25;
        const currentPage = page;
        const totalPages = Math.max(1, Math.ceil(workerRows.length / pageSize));
        const pageRows = workerRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

        let pageButtons = "";
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, currentPage + 2);
        for (let i = startPage; i <= endPage; i++) {
            pageButtons += `
                <button class="btn-page ${i === currentPage ? "btn-page-active" : ""}" onclick="AppController.view._reRenderWorkerTabPage(${i})">
                    ${i}
                </button>
            `;
        }
        return {
            html: `
				<h2 class="section-title">
					<i class="ph-fill ph-hard-hat"></i> Workmen Statistics
				</h2>
				<div class="charts-grid">
					${this._chartCard("ch-worker-dept", '<i class="ph-fill ph-chart-bar"></i>', "amber", "Workmen Attendance by Department", "Click bar for detail")}
				</div>
				<div id="main-table-wrap">
                    ${this._tableHTML("tbl-worker", ["Dept", "Total", "Present", "Half Present", "WO Present", "WO Half Present", "Weekly Off", "Absent", "Rate"], pageRows, "worker-wise", (currentPage - 1) * pageSize)}
                    <div class="pagination-bar">
                        <div class="pagination-text">
                            Showing ${workerRows.length ? (currentPage - 1) * pageSize + 1 : 0}–${Math.min(currentPage * pageSize, workerRows.length)} of ${workerRows.length} records &nbsp;·&nbsp; Page ${currentPage} of ${totalPages}
                        </div>
                        <div class="pagination-buttons">
                            <button class="btn-page" ${currentPage === 1 ? "disabled" : ""} onclick="AppController.view._reRenderWorkerTabPage(1)">«</button>
                            <button class="btn-page" ${currentPage === 1 ? "disabled" : ""} onclick="AppController.view._reRenderWorkerTabPage(${currentPage - 1})">‹</button>
                            ${pageButtons}
                            <button class="btn-page" ${currentPage === totalPages ? "disabled" : ""} onclick="AppController.view._reRenderWorkerTabPage(${currentPage + 1})">›</button>
                            <button class="btn-page" ${currentPage === totalPages ? "disabled" : ""} onclick="AppController.view._reRenderWorkerTabPage(${totalPages})">»</button>
                        </div>
                    </div>
                </div>
				<div id="drilldown-table" style="margin-top:16px"></div>
			`,
            renderCharts: () => {
                Charts.stacked(
                    "ch-worker-dept",
                    workerDepts,
                    [
                        { name: "Present", data: workerRows.map((r) => r[2]) },
                        { name: "Half Present", data: workerRows.map((r) => r[3]), },
                        { name: "WO Present", data: workerRows.map((r) => r[4]), },
                        { name: "WO Half Present", data: workerRows.map((r) => r[5]), },
                        { name: "Weekly Off", data: workerRows.map((r) => r[6]), },
                        { name: "Absent", data: workerRows.map((r) => r[7]) },
                    ],
                    "Workmen by Department",
                    (dept, index, seriesIndex, seriesName) => {
                        const filtered = logs.filter((l) => {
                            const e = empMap[l.empId];
                            if (!e || e.dept !== dept) return false;
                            if (e.team !== workerTeamId) return false;
                            return this._matchesStatus(l, seriesName);
                        });
                        this._renderDrillDown(filtered, `Workmen – ${dept} – ${seriesName}`, empMap,);
                    },
                );
            },
        };
    }
    
    
    _reRenderWorkerTabPage(page) {
        const content = this._renderWorker(
            this._currentWorkerTabLogs,
            this._currentWorkerTabEmps,
            this._currentWorkerTabEmpMap,
            this._currentWorkerTabModel,
            page
        );
        document.querySelector(".tab-pane-container").innerHTML = content.html;
        content.renderCharts();
    }

    
    _renderJoinExitTab(model, mode, page = 1) {
        const isResigned = mode === "resigned";
        this._joinExitCache = this._joinExitCache || {};

        let items, dates, dateField, empMap;

        if (model) {
            items = isResigned ? model.getResignedEmployees() : model.getNewJoinedEmployees();
            dateField = isResigned ? "dor" : "doj";
            const { dateFrom, dateTo } = model.state.filters;
            dates = this._getDateRange(dateFrom, dateTo);
            empMap = {};
            items.forEach(({ emp }) => { empMap[emp.id] = emp; });
            this._joinExitCache[mode] = { items, dates, dateField, empMap };
        } else {
            ({ items, dates, dateField, empMap } = this._joinExitCache[mode]);
        }

        const formattedDates = dates.map((d) => this._formatDate(d));
        const depts = [...new Set(items.map((it) => it.emp.dept))].sort();

        const countByDate = {};
        dates.forEach((d) => (countByDate[d] = 0));
        items.forEach(({ emp }) => {
            const d = emp[dateField];
            if (countByDate[d] !== undefined) countByDate[d]++;
        });
        const series = [
            { name: isResigned ? "Resigned" : "Joined", data: dates.map((d) => countByDate[d] || 0), },
        ];

        const pageSize = 25;
        const currentPage = page;
        const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
        const pageItems = items.slice((currentPage - 1) * pageSize, currentPage * pageSize,);

        const rows = pageItems.map(({ emp }) =>
            isResigned
                ? [emp.code || "-", emp.name || "-", emp.dept || "-", emp.company || "-", emp.designation || "-", this._formatDate(emp.dobRaw), this._formatDate(emp.doj), this._formatDate(emp.dor), `<span class="badge badge-danger">${emp.status || "Resigned"}</span>`]
                : [emp.code || "-", emp.name || "-", emp.dept || "-", emp.company || "-", emp.designation || "-", this._formatDate(emp.dobRaw), this._formatDate(emp.doj), `<span class="badge badge-success">${emp.status || "Working"}</span>`],
        );

        const exportKey = isResigned ? "resigned-tab" : "newjoined-tab";
        this._lastData[exportKey] = items.map(({ emp }) =>
            isResigned
                ? { Code: emp.code, Name: emp.name, Dept: emp.dept, Company: emp.company, Designation: emp.designation, DOB: this._formatDate(emp.dobRaw), DOJ: emp.doj, DOR: emp.dor, Status: emp.status, }
                : { Code: emp.code, Name: emp.name, Dept: emp.dept, Company: emp.company, Designation: emp.designation, DOB: this._formatDate(emp.dobRaw), DOJ: emp.doj, Status: emp.status, },
        );

        let pageButtons = "";
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, currentPage + 2);
        for (let i = startPage; i <= endPage; i++) {
            pageButtons += `<button class="btn-page ${i === currentPage ? "btn-page-active" : ""}"
                onclick="AppController.view._reRenderJoinExitPage('${mode}', ${i})">${i}</button>`;
        }

        const headers = isResigned
            ? ["Code", "Name", "Dept", "Company", "Designation", "DOB", "DOJ", "DOR", "Status"]
            : ["Code", "Name", "Dept", "Company", "Designation", "DOB", "DOJ", "Status"];

        const chartId = isResigned ? "ch-resigned-date" : "ch-newjoined-date";
        const tableId = isResigned ? "tbl-resigned" : "tbl-newjoined";
        const title = isResigned ? "Resigned Employees" : "New Joined Employees";
        const icon = isResigned ? "ph-user-minus" : "ph-user-plus";
        const chartTitle = isResigned ? "Resignations by Date (Dept-wise)" : "New Joins by Date (Dept-wise)";

        return {
            html: `
                <h2 class="section-title"><i class="ph-fill ${icon}"></i> ${title}</h2>
                <div class="charts-grid">
                    ${this._chartCard(chartId, `<i class="ph-fill ${icon}"></i>`, isResigned ? "danger" : "success", chartTitle, "Click a segment for detail")}
                </div>
                ${this._tableHTML(tableId, headers, rows, exportKey, (currentPage - 1) * pageSize)}
                <div class="pagination-bar">
                    <div class="pagination-text">
                        Showing ${items.length ? (currentPage - 1) * pageSize + 1 : 0}–${Math.min(currentPage * pageSize, items.length)} of ${items.length} records &nbsp;·&nbsp; Page ${currentPage} of ${totalPages}
                    </div>
                    <div class="pagination-buttons">
                        <button class="btn-page" ${currentPage === 1 ? "disabled" : ""} onclick="AppController.view._reRenderJoinExitPage('${mode}', 1)">«</button>
                        <button class="btn-page" ${currentPage === 1 ? "disabled" : ""} onclick="AppController.view._reRenderJoinExitPage('${mode}', ${currentPage - 1})">‹</button>
                        ${pageButtons}
                        <button class="btn-page" ${currentPage === totalPages ? "disabled" : ""} onclick="AppController.view._reRenderJoinExitPage('${mode}', ${currentPage + 1})">›</button>
                        <button class="btn-page" ${currentPage === totalPages ? "disabled" : ""} onclick="AppController.view._reRenderJoinExitPage('${mode}', ${totalPages})">»</button>
                    </div>
                </div>
                <div id="drilldown-table" style="margin-top:16px"></div>
            `,
            renderCharts: () => {
                if (!items || items.length === 0) {
                    const chartEl = document.getElementById(chartId);
                    if (chartEl) {
                        chartEl.innerHTML = `
                            <div style="display:flex;align-items:center;justify-content:center;
                                height:200px;flex-direction:column;gap:8px;color:#94a3b8;font-size:13px;">
                                <i class="ph ph-user-minus" style="font-size:32px;"></i>
                                No ${isResigned ? "resignations" : "new joinings"} in selected date range
                            </div>
                        `;
                    }
                    return;
                }

                Charts.stacked(
                    chartId,
                    formattedDates,
                    series,
                    chartTitle,
                    (category, index) => {
                        const dateVal = dates[index];
                        const filteredEmps = items.filter(({ emp }) => emp[dateField] === dateVal).map(({ emp }) => emp);
                        this._renderJoinExitDrillDown(filteredEmps, `${isResigned ? "Resigned" : "Joined"} on ${this._formatDate(dateVal)}`, isResigned,);
                    },
                );
            },
        };
    }

    
    _renderJoinExitDrillDown(emps, title, isResigned, page = 1) {
        this._joinExitDrillEmps = emps;
        this._joinExitDrillTitle = title;
        this._joinExitDrillIsResigned = isResigned;

        const container = document.getElementById("drilldown-table");
        if (!container) return;

        const mainWrap = document.getElementById("main-table-wrap");
        if (mainWrap) mainWrap.style.display = "none";

        if (!emps || emps.length === 0) {
            container.innerHTML = `
                <div class="drilldown-box">
                    <div class="drilldown-header">
                        <span class="drilldown-title">🔍 ${title}</span>
                        <div class="drilldown-btn-group">
                            <button class="btn-drill btn-drill-back" onclick="AppController.view.closeDrillDown()">← Back</button>
                        </div>
                    </div>
                    <p style="padding:32px;color:#6b7280;">No records found.</p>
                </div>`;
            return;
        }

        const pageSize = 25;
        const currentPage = page;
        const totalPages = Math.max(1, Math.ceil(emps.length / pageSize));
        const pageEmps = emps.slice(
            (currentPage - 1) * pageSize,
            currentPage * pageSize,
        );

        const headers = isResigned
            ? ["Sr.No", "Code", "Name", "Dept", "Company", "Designation", "DOB", "DOJ", "DOR", "Status"]
            : ["Sr.No", "Code", "Name", "Dept", "Company", "Designation", "DOB", "DOJ", "Status"];

        const rows = pageEmps.map((emp, i) => {
            const sr = (currentPage - 1) * pageSize + i + 1;
            if (isResigned) {
                return `
                    <tr>
                        <td>${sr}</td>
                        <td><b>${emp.code || "–"}</b></td>
                        <td>${emp.name || "–"}</td>
                        <td>${emp.dept || "–"}</td>
                        <td>${emp.company || "–"}</td>
                        <td>${emp.designation || "–"}</td>
                        <td>${this._formatDate(emp.dobRaw)}</td>
                        <td>${this._formatDate(emp.doj)}</td>
                        <td>${this._formatDate(emp.dor)}</td>
                        <td><span class="badge badge-danger">${emp.status || "Resigned"}</span></td>
                    </tr>
                `;
            } else {
                return `
                    <tr>
                        <td>${sr}</td>
                        <td><b>${emp.code || "–"}</b></td>
                        <td>${emp.name || "–"}</td>
                        <td>${emp.dept || "–"}</td>
                        <td>${emp.company || "–"}</td>
                        <td>${emp.designation || "–"}</td>
                        <td>${this._formatDate(emp.dobRaw)}</td>
                        <td>${this._formatDate(emp.doj)}</td>
                        <td><span class="badge badge-success">${emp.status || "Working"}</span></td>
                    </tr>
                `;
            }
        }).join("");

        const exportData = emps.map((emp) =>
            isResigned
                ? { Code: emp.code, Name: emp.name, Dept: emp.dept, Company: emp.company, Designation: emp.designation, DOB: this._formatDate(emp.dobRaw), DOJ: emp.doj, DOR: emp.dor, Status: emp.status, }
                : { Code: emp.code, Name: emp.name, Dept: emp.dept, Company: emp.company, Designation: emp.designation, DOB: this._formatDate(emp.dobRaw), DOJ: emp.doj, Status: emp.status, },
        );

        this._joinExitDrillExportData = exportData;

        let pageButtons = "";
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, currentPage + 2);
        for (let i = startPage; i <= endPage; i++) {
            pageButtons += `
                <button class="btn-page ${i === currentPage ? "btn-page-active" : ""}"
                    onclick="AppController.view._renderJoinExitDrillDown(
                        AppController.view._joinExitDrillEmps,
                        AppController.view._joinExitDrillTitle,
                        AppController.view._joinExitDrillIsResigned,
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
                        <small>${emps.length} records</small>
                    </div>
                    <div class="drilldown-btn-group">
                        <button class="btn-drill btn-drill-excel"
                            onclick="AppController.view.exportExcel(AppController.view._joinExitDrillExportData, 'drilldown')">
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
                        <thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
                        <tbody>${rows || `<tr><td colspan="${headers.length}" style="text-align:center;padding:32px;color:#94a3b8;">No records found</td></tr>`}</tbody>
                    </table>
                </div>
                <div class="pagination-bar">
                    <div class="pagination-text">
                        Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, emps.length)} of ${emps.length} records &nbsp;·&nbsp; Page ${currentPage} of ${totalPages}
                    </div>
                    <div class="pagination-buttons">
                        <button class="btn-page" ${currentPage === 1 ? "disabled" : ""}
                            onclick="AppController.view._renderJoinExitDrillDown(AppController.view._joinExitDrillEmps,AppController.view._joinExitDrillTitle,AppController.view._joinExitDrillIsResigned,1)">«</button>
                        <button class="btn-page" ${currentPage === 1 ? "disabled" : ""}
                            onclick="AppController.view._renderJoinExitDrillDown(AppController.view._joinExitDrillEmps,AppController.view._joinExitDrillTitle,AppController.view._joinExitDrillIsResigned,${currentPage - 1})">‹</button>
                        ${pageButtons}
                        <button class="btn-page" ${currentPage === totalPages ? "disabled" : ""}
                            onclick="AppController.view._renderJoinExitDrillDown(AppController.view._joinExitDrillEmps,AppController.view._joinExitDrillTitle,AppController.view._joinExitDrillIsResigned,${currentPage + 1})">›</button>
                        <button class="btn-page" ${currentPage === totalPages ? "disabled" : ""}
                            onclick="AppController.view._renderJoinExitDrillDown(AppController.view._joinExitDrillEmps,AppController.view._joinExitDrillTitle,AppController.view._joinExitDrillIsResigned,${totalPages})">»</button>
                    </div>
                </div>
            </div>
        `;

        container.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    
    _reRenderJoinExitPage(mode, page) {
        const content = this._renderJoinExitTab(null, mode, page);
        document.querySelector(".tab-pane-container").innerHTML = content.html;
        content.renderCharts();
    }

    
    _showPresentHeadcountDrilldown() {
        document.querySelectorAll(".stat-card-clickable").forEach((c) => c.classList.remove("active"));

        const card = this.app.querySelector(
            '.stat-card-clickable[data-card-key="presentHeadcount"]'
        );
        if (card) card.classList.add("active");

        const items = this._currentTabPresentHeadcountItems;
        if (!items) return;

        this._renderStatCardDrilldown("presentHeadcount", items, 1);
    }


    _showHeadcountBreakdownDrilldown(type) {
        document.querySelectorAll("[data-headcount]").forEach((c) => c.classList.remove("active"));

        const card = this.app.querySelector(`[data-headcount="${type}"]`);
        if (card) card.classList.add("active");

        const byDept = AppController.model.state.requiredHeadcountByDept || {};
        const depts = Object.keys(byDept).sort();

        let totalRequired = 0;
        let totalAvailable = 0;
        let totalGap = 0;

        const rows = depts.map((d) => {
            const info = byDept[d];
            const required = Number(info.required || 0);
            const available = Number(info.available || 0);
            const gap = Number(info.gap || 0);

            totalRequired += required;
            totalAvailable += available;
            totalGap += gap;

            return `
                <tr>
                    <td><b>${this._escapeAttr(d)}</b></td>
                    <td>${required}</td>
                    <td>${available}</td>
                    <td style="color:${gap > 0 ? "#f43f5e" : "#10b981"};font-weight:700;">${gap}</td>
                </tr>
            `;
        }).join("");

        const panel = document.getElementById("stat-card-drilldown");
        if (!panel) return;

        panel.style.display = "block";

        panel.innerHTML = `
            <div class="drilldown-box">
                <div class="drilldown-header">
                    <div class="drilldown-title">
                        ${type === "required" ? "🎯 Required Headcount" : "⚖️ Headcount Gap"} — By Department
                        <small>${depts.length} departments</small>
                    </div>
                    <div class="drilldown-btn-group">
                        <button class="btn-drill btn-drill-back"
                            onclick="AppController.view._closeStatCardDrilldown()">
                            ✕ Close
                        </button>
                    </div>
                </div>

                <div style="overflow-x:auto;">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Department</th>
                                <th>Required</th>
                                <th>Available</th>
                                <th>Gap</th>
                            </tr>
                        </thead>

                        <tbody>
                            ${rows ||
                                `<tr>
                                    <td colspan="4" style="text-align:center;padding:32px;color:#94a3b8;">
                                        No department data found
                                    </td>
                                </tr>`
                            }

                            <tr style=" background:#f8fafc; border-top:2px solid #cbd5e1; font-weight:700;">
                                <td><b>Total</b></td>
                                <td><b>${totalRequired}</b></td>
                                <td><b>${totalAvailable}</b></td>
                                <td style="color:${totalGap > 0 ? "#f43f5e" : "#10b981"}; font-weight:700;"><b>${totalGap}</b></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        panel.scrollIntoView({
            behavior: "smooth",
            block: "start",
        });
    }


    _storeRecordDetail(log, emp, date) {
        if (!this._recordDetailStore) this._recordDetailStore = [];
        const id = this._recordDetailStore.length;
        this._recordDetailStore.push({ log, emp, date });
        return id;
    }


    _showRecordDetailModal(id) {
        const rec = this._recordDetailStore[id];
        if (!rec) return;

        const { log, emp, date } = rec;
        let overlay = document.getElementById("record-detail-overlay");
        
        if (!overlay) {
            overlay = document.createElement("div");
            overlay.id = "record-detail-overlay";
            document.body.appendChild(overlay);
        }

        const statusClass = (() => {
            const s = (log?.status || "").toLowerCase();

            if (s.includes("half")) return "half";
            if (s.includes("wo") || s.includes("weekly")) return "wo";
            if (s.includes("absent")) return "absent";
            if (s.includes("present")) return "present";

            return "default";
        })();

        const row = (label, value, full = false) => `
            <div class="rd-row ${full ? "rd-row-full" : ""}">
                <div class="rd-label">${label}</div>
                <div class="rd-value">${value ?? "-"}</div>
            </div>
        `;

        const isManualIn = log?.inDeviceId === 5;
        const isManualOut = log?.outDeviceId === 5;
        const hasManualEntry = isManualIn || isManualOut;

        const manualEntryHtml = hasManualEntry ? `
            <div class="rd-section">
                <div class="rd-section-title">
                    Manual Entry
                </div>
                <div class="rd-grid-3col">
                    ${isManualIn ? row("In", log?.inTime) : ""}
                    ${isManualOut ? row("Out", log?.outTime) : ""}
                </div>
            </div>
        ` : "";

        overlay.innerHTML = `
            <div class="rd-modal">
                <div class="rd-header">
                    <div class="rd-title">Employee Details</div>
                    <button class="rd-close"
                        onclick="AppController.view._closeRecordDetailModal()">
                        <i class="ph ph-x"></i>
                    </button>
                </div>

                <div class="rd-body">
                    <div class="rd-section">
                        <div class="rd-section-title">
                            Employee Information
                        </div>
                        <div class="rd-grid">
                            ${row("Employee Name", emp?.name)}
                            ${row("Employee Code", emp?.code)}
                            ${row("Company", emp?.company)}
                            ${row("Department", emp?.dept)}
                            ${row("Designation", emp?.designation)}
                            ${row("Location", emp?.location)}
                            ${row("Team", emp?.teamName)}
                            ${row("Shift Group", emp?.shiftGroupName)}
                        </div>
                    </div>

                    <div class="rd-section">
                        <div class="rd-section-title">
                            Shift Information
                        </div>

                        <div class="rd-grid-3col">
                            ${row("Shift", log?.shiftName || emp?.shift)}
                            ${row("Shift Start", log?.shiftStart || emp?.shiftStart)}
                            ${row("Shift End", log?.shiftEnd || emp?.shiftEnd)}
                        </div>

                        <div class="rd-grid-3col" style="margin-top:8px;">
                            ${row("In Time", log?.inTime)}
                            ${row("Out Time", log?.outTime)}
                            ${row("Hours Worked", log?.hoursWorked)}
                        </div>

                        <div class="rd-grid-3col" style="margin-top:8px;">
                            ${row("Overtime", (log?.overtime || 0) > 0 ? this._fmtMins(log.overtime) : "-")}
                            ${row("Late By", (log?.lateBy || 0) > 0 ? this._fmtMins(log.lateBy) : "-")}
                            ${row("Early By", (log?.earlyBy || 0) > 0 ? this._fmtMins(log.earlyBy) : "-")}
                        </div>
                    </div>

                    ${manualEntryHtml}

                    <div class="rd-section">
                        <div class="rd-section-title">
                            Attendance
                        </div>

                        <div class="rd-grid">
                            ${row("Attendance Date", this._formatDate(date || log?.date))}
                            <div class="rd-row">
                                <div class="rd-label">
                                    Status
                                </div>

                                <div class="rd-value">
                                    <span class="rd-badge ${statusClass}">
                                        ${log?.status || "-"}
                                    </span>
                                </div>
                            </div>

                            ${row("Detailed Status", log?.detailedStatus, true)}
                        </div>
                    </div>

                    <div class="rd-section">
                        <div class="rd-section-title">
                            Employment
                        </div>

                        <div class="rd-grid">
                            ${row("Date of Birth", this._formatDate(emp?.dobRaw))}
                            ${row("Age", this._calculateAge(emp?.dobRaw))}
                            ${row("Joining Date", this._formatDate(emp?.doj))}
                            ${row("Relieving Date", this._formatDate(emp?.dor))}
                        </div>
                    </div>
                </div>
            </div>
        `;

        overlay.classList.add("active");
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                this._closeRecordDetailModal();
            }
        };
    }


    _closeRecordDetailModal() {
        const overlay = document.getElementById("record-detail-overlay");
        if (overlay) overlay.classList.remove("active");
    }


    _actionViewLink(log, emp, date) {
        const id = this._storeRecordDetail(log, emp, date);
        return `<a href="javascript:void(0)" class="rd-view-link" onclick="AppController.view._showRecordDetailModal(${id})">View</a>`;
    }


    _getAgeSortValue(dobRaw) {
        const age = this._calculateAge(dobRaw);
        return typeof age === "number" ? age : -Infinity; 
    }
}

window.AttendanceView = AttendanceView;
