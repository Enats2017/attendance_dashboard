class OvertimeView {
    constructor() {
        this.model = new OvertimeModel();

        // Main department summary state
        this.currentPage = 1;
        this.pageSize = 25;
        this._departments = [];
        this._expandedSummaryDepartments = new Set();

        // Latest data returned by the model
        this.currentData = null;

        // Container this view renders into
        this.container = null;

        // Active drilldown: { cardKey: "otRecords" | "mightBeOT" | "all", category: "CC" | null }
        this._drill = null;
        this._chartDrill = null;
        this._expandedDepartment = null;

        // Bound handlers
        this._boundClickHandler = null;
    }

    /* =========================================================
     * Main render
     * ========================================================= */
    async render(container, parentFilters) {
        if (!container) {
            return;
        }

        this.container = container;

        this._attachEvents(container);

        if (!this.model.canView()) {
            container.innerHTML = this._renderComingSoon();
            return;
        }

        container.innerHTML = this._renderLoading();

        const result = await this.model.fetchData(parentFilters);

        if (!result.success) {
            if (result.message === "Coming Soon") {
                container.innerHTML = this._renderComingSoon();
                return;
            }

            container.innerHTML = this._renderError(result.message || "Unable to load overtime data.");
            return;
        }

        this.currentPage = 1;
        this._drill = null;
        this._chartDrill = null;
        this._expandedDepartment = null;
        this._expandedSummaryDepartments.clear();
        this.currentData = this.model.getData();
        this._departments = this._groupDepartmentRecords([
            { key: "otRecords", records: this.model.getOTRecords() },
            { key: "mightBeOT", records: this.model.getMightBeOTRecords() },
        ]);

        container.innerHTML = this._renderDashboard(this.currentData);
    }

    /* =========================================================
     * Events
     * ========================================================= */
    _attachEvents(container) {
        if (this._boundClickHandler) {
            container.removeEventListener("click", this._boundClickHandler);
        }

        this._boundClickHandler = (event) => {
            const target = event.target;

            if (target.closest("[data-ot-action='close-chart-drill']")) {
                this._chartDrill = null;
                this._refreshTable();
                return;
            }

            if (target.closest("[data-ot-action='download-chart-drill']")) {
                this._downloadCsv(this._getDrillRecords(this._chartDrill), "Overtime_Chart_Drilldown");
                return;
            }

            const chart = target.closest(".ot-dept-chart");
            if (chart && container.contains(chart)) {
                this._handleDepartmentChartClick(chart, target);
                return;
            }

            // 1. Category chip inside a card (e.g. CC under OT Records)
            const chip = target.closest(".stat-category-item");
            if (chip && container.contains(chip)) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();

                this._openDrilldown(chip.dataset.otCard, chip.dataset.category);
                return;
            }

            // 2. Whole card click (OT Records / Might Be OT)
            const card = target.closest(".ot-card-clickable");
            if (card && container.contains(card)) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();

                this._openDrilldown(card.dataset.otCard, null);
                return;
            }

            // 3. Close drilldown
            if (target.closest("[data-ot-action='close-drill']")) {
                this._drill = null;
                this._refreshTable();
                return;
            }

            // 4. Download drilldown records
            if (target.closest("[data-ot-action='download-drill']")) {
                const records = this._getDrillRecords();
                this._downloadCsv(records, "Overtime_Drilldown");
                return;
            }

            const toggle = target.closest("[data-ot-summary-toggle]");
            if (toggle && container.contains(toggle)) {
                const department = toggle.dataset.otSummaryToggle;
                const expanded = !this._expandedSummaryDepartments.delete(department);
                if (expanded) {
                    this._expandedSummaryDepartments.add(department);
                }
                toggle.setAttribute("aria-expanded", expanded);
                toggle.closest("table").querySelector("#" + toggle.getAttribute("aria-controls")).hidden = !expanded;
                return;
            }

            // 5. Download main department summary
            if (target.closest("#downloadExcelBtn")) {
                const rows = this._departments.flatMap(({ name, counts, designations }) => [
                    ["Department", name, "", counts.otRecords || 0, counts.mightBeOT || 0],
                    ...designations.map(([designation, child]) =>
                        ["Designation", name, designation, child.otRecords || 0, child.mightBeOT || 0]
                    ),
                ]);
                this._downloadCsvRows(
                    ["Row Type", "Department", "Designation", "Overtime Records", "Might be Overtime Records"],
                    rows,
                    "Overtime_Department_Summary"
                );
                return;
            }

            // 6. Pagination
            const button = target.closest("[data-pagination-action]");
            if (!button || !container.contains(button)) {
                return;
            }

            const action = button.dataset.paginationAction;

            if (action === "previous") {
                if (this.currentPage > 1) {
                    this.currentPage--;
                }
            } else if (action === "next") {
                if (this.currentPage < this._getTotalPages()) {
                    this.currentPage++;
                }
            } else if (action === "page") {
                const page = Number(button.dataset.page);
                if (Number.isInteger(page) && page > 0) {
                    this.currentPage = page;
                }
            }

            this._refreshTable();
        };

        container.addEventListener("click", this._boundClickHandler);
    }

    _openDrilldown(cardKey, category) {
        if (!this.currentData) {
            return;
        }

        let cat = null;

        if (category) {
            cat = this.model.mergeCat(category);
            if (!cat) {
                return;
            }
        }

        this._drill = {
            cardKey: cardKey || "all",
            category: cat,
        };

        this._refreshTable();

        // Bring the drilldown into view
        const box = this.container && this.container.querySelector("#overtime-drilldown-container");
        if (box && typeof box.scrollIntoView === "function") {
            box.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
    }

    _refreshTable() {
        if (!this.container || !this.currentData) {
            return;
        }

        this.container.innerHTML = this._renderDashboard(this.currentData);
    }

    /* =========================================================
     * Drilldown data
     * ========================================================= */
    _getDrillSource(cardKey) {
        const ot = this.model.getOTRecords();
        const mb = this.model.getMightBeOTRecords();

        if (cardKey === "otRecords") {
            return ot;
        }

        if (cardKey === "mightBeOT") {
            return mb;
        }

        return [...ot, ...mb];
    }

    _getDrillRecords(drill = this._drill) {
        if (!drill) {
            return [];
        }

        const { cardKey, group, category } = drill;
        const source = this._getDrillSource(cardKey);

        if (group) {
            return source.filter((record) =>
                this._chartGroupName(record.department) === group.department &&
                (group.designation === undefined || this._chartGroupName(record.designation) === group.designation)
            );
        }

        if (!category) {
            return source;
        }

        return source.filter((r) => this.model.mergeCat(r.companyCategory) === category);
    }

    _getDrillTitle(drill) {
        if (!drill) {
            return "";
        }

        let base = "All";

        if (drill.cardKey === "otRecords") {
            base = "OT Records";
        } else if (drill.cardKey === "mightBeOT") {
            base = "Might Be OT";
        }

        if (drill.category) {
            return `${base} - ${drill.category}`;
        }

        const group = drill.group;
        return group ? [base, group.department, group.designation].filter(Boolean).join(" - ") : base;
    }

    /* =========================================================
     * CSV download
     * ========================================================= */
    _downloadCsv(records, filePrefix) {
        const headers = [
            "Employee Code",
            "Employee Name",
            "Company Category",
            "Company",
            "Department",
            "Designation",
            "Location",
            "Date",
            "First Shift",
            "Begin Time",
            "End Time",
            "In Time",
            "Out Time",
            "Second Shift",
            "Begin Time",
            "End Time",
            "In Time",
            "Out Time",
        ];

        const rows = records.map((r) => [
                r.employeeCode,
                r.name,
                r.companyCategory,
                r.company,
                r.department,
                r.designation,
                r.location,
                r.attendanceDate,
                r.shift1,
                r.shift1BeginTime,
                r.shift1EndTime,
                r.AttendanceLogsInTime,
                r.AttendanceLogsOutTime,
                r.shift2,
                r.shift2BeginTime,
                r.shift2EndTime,
                r.NewAttendanceLogsInTime,
                r.NewAttendanceLogsOutTime,
        ]);
        this._downloadCsvRows(headers, rows, filePrefix);
    }

    _downloadCsvRows(headers, rows, filePrefix) {
        if (!rows.length) {
            alert("No data to download.");
            return;
        }

        const csvRows = [headers, ...rows].map((row) =>
            row.map((val) => {
                const safeVal = val === null || val === undefined ? "" : String(val);
                return `"${safeVal.replace(/"/g, '""')}"`;
            }).join(",")
        );

        // BOM so Excel opens UTF-8 correctly
        const csvString = "\uFEFF" + csvRows.join("\r\n");
        const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });

        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        const dateStr = new Date().toISOString().slice(0, 10);

        link.setAttribute("href", url);
        link.setAttribute("download", `${filePrefix}_${dateStr}.csv`);
        link.style.visibility = "hidden";

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    /* =========================================================
     * Pagination helpers
     * ========================================================= */
    _getTotalPages() {
        return Math.max(1, Math.ceil(this._departments.length / this.pageSize));
    }

    /* =========================================================
     * Simple states
     * ========================================================= */
    _renderLoading() {
        return `
            <div class="ot-loading">
                <i class="ph ph-spinner ph-spin"></i>
                <p>Loading Overtime Data...</p>
            </div>
        `;
    }

    _renderError(message) {
        const safe = this._escapeHtml(message || "Unknown error");

        return `
            <div class="ot-error">
                <i class="ph ph-warning-circle"></i>
                <p class="ot-error-title">Error</p>
                <p class="ot-error-text">${safe}</p>
            </div>
        `;
    }

    _renderComingSoon() {
        return `
            <div class="ot-soon">
                <div class="ot-soon-icon">
                    <i class="ph ph-clock-user"></i>
                </div>

                <h2 class="ot-soon-title">Overtime Module</h2>

                <p class="ot-soon-text">
                    We are currently perfecting the new Overtime calculations.
                    This module will be available for your account soon!
                </p>

                <span class="ot-soon-badge">Coming Soon</span>
            </div>
        `;
    }

    _renderEmpty(message) {
        return `
            <div class="ot-empty">
                <i class="ph ph-info"></i>
                <p>${this._escapeHtml(message)}</p>
            </div>
        `;
    }

    /* =========================================================
     * Dashboard
     * ========================================================= */
    _renderDashboard(data) {
        if (!data) {
            return this._renderEmpty("No overtime data available.");
        }

        const summary = data.summary || {
            otRecordsCount: 0,
            mightBeOTCount: 0,
            employeeCount: 0,
        };

        const otRecords = Array.isArray(data.otRecords) ? data.otRecords : [];
        const mightBeOT = Array.isArray(data.mightBeOT) ? data.mightBeOT : [];

        return `
            ${this._renderSummaryCards(summary, otRecords, mightBeOT)}

            <!-- Drilldown opens here when a card or chip is clicked -->
            <div id="overtime-drilldown-container" class="ot-drilldown ${this._drill ? "ot-drilldown--open" : ""}">
                ${this._renderDrilldown()}
            </div>

            ${this._renderDepartmentChart()}
            <div id="overtime-chart-detail-container">
                ${this._chartDrill ? this._renderDrilldown(this._chartDrill, "chart-drill") : this._renderRecordsTable()}
            </div>
            ${this._renderFooterMeta(data)}
        `;
    }

    _chartGroupName(value) {
        return String(value ?? "").trim() || "Unassigned";
    }

    _groupDepartmentRecords(series) {
        const departments = new Map();
        for (const { key, records } of series) {
            for (const record of records) {
                const name = this._chartGroupName(record.department);
                const designation = this._chartGroupName(record.designation);
                if (!departments.has(name)) {
                    departments.set(name, { name, counts: {}, designations: new Map() });
                }
                const { counts, designations } = departments.get(name);
                if (!designations.has(designation)) {
                    designations.set(designation, {});
                }
                const designationCounts = designations.get(designation);
                counts[key] = (counts[key] || 0) + 1;
                designationCounts[key] = (designationCounts[key] || 0) + 1;
            }
        }

        // Present by Dept uses the order in which departments appear in the employee list.
        const order = new Map();
        for (const employee of window.AppController?.model?.state?.data?.employees || []) {
            const name = this._chartGroupName(employee.dept);
            if (!order.has(name)) {
                order.set(name, { index: order.size, designations: new Map() });
            }
            order.get(name).designations.set(
                this._chartGroupName(employee.designationNameRaw ?? employee.designation),
                Number(employee.designationSortOrder) || 0
            );
        }

        return [...departments.values()].sort((a, b) =>
            (order.get(a.name)?.index ?? Infinity) - (order.get(b.name)?.index ?? Infinity) ||
            a.name.localeCompare(b.name)
        ).map(({ name, counts, designations }) => {
            const designationOrder = order.get(name)?.designations;
            return {
                name,
                counts,
                designations: [...designations].sort(([a], [b]) =>
                    (designationOrder?.get(a) || 0) - (designationOrder?.get(b) || 0) || a.localeCompare(b)
                ),
            };
        });
    }

    _renderDepartmentChart() {
        const series = [
            { key: "otRecords", label: "OT Records", color: "blue" },
            { key: "mightBeOT", label: "Might Be OT", color: "amber" },
        ];
        const departments = this._departments;
        const max = departments.reduce((largest, { counts }) =>
            Math.max(largest, (counts.otRecords || 0) + (counts.mightBeOT || 0)), 0);
        const rawStep = Math.max(1, max / 5);
        const magnitude = 10 ** Math.floor(Math.log10(rawStep));
        const step = [1, 2, 5, 10].map((n) => n * magnitude).find((n) => n >= rawStep);
        const intervals = Math.ceil(max / step);
        const axisMax = intervals * step;

        let tooltipIndex = 0;
        const renderBar = (name, counts, designation = false) => {
            const label = this._escapeHtml(name);
            const tooltipId = `ot-chart-tooltip-${tooltipIndex++}`;
            const ot = counts.otRecords || 0;
            const mightBeOT = counts.mightBeOT || 0;
            return `
            <div class="ot-chart-track">
                ${series.filter(({ key }) => counts[key]).map(({ key, label, color }) => `
                    <button type="button" class="ot-chart-segment ot-chart-${color}" data-ot-series="${key}"
                        ${designation ? `data-ot-designation="${this._escapeHtml(name)}"` : ""}
                        style="width:${counts[key] / axisMax * 100}%"
                        aria-label="${label}, ${this._escapeHtml(name)}, ${counts[key]} records"
                        aria-describedby="${tooltipId}">${counts[key]}</button>
                `).join("")}
                <div class="ot-chart-tooltip" id="${tooltipId}" role="tooltip">
                    <strong>${label}</strong>
                    <span><span><i class="ot-chart-blue" aria-hidden="true"></i> OT Records:</span> <b>${ot}</b></span>
                    <span><span><i class="ot-chart-amber" aria-hidden="true"></i> Might be OT Records:</span> <b>${mightBeOT}</b></span>
                    <span class="ot-chart-tooltip-total"><span>Total:</span> <b>${ot + mightBeOT}</b></span>
                </div>
            </div>
            `;
        };

        return `
            <section class="ot-panel ot-dept-chart" aria-labelledby="ot-dept-chart-title">
                <div class="ot-panel-header ot-chart-header">
                    <h3 id="ot-dept-chart-title" class="ot-drill-title">
                        <i class="ph-fill ph-chart-bar" aria-hidden="true"></i> Overtime by Department
                    </h3>
                    <div class="ot-chart-legend">
                        ${series.map(({ label, color }) => `<span data-ot-legend="${color}"><i class="ot-chart-${color}" aria-hidden="true"></i>${label}</span>`).join("")}
                    </div>
                </div>
                ${max ? `
                    <div class="ot-chart-body" style="--ot-chart-grid-step:${100 / intervals}%">
                        ${departments.map(({ name, counts, designations }, index) => {
                            const expanded = this._expandedDepartment === name;
                            const label = this._escapeHtml(name);
                            return `
                                <div class="ot-chart-department" data-ot-department="${label}">
                                    <div class="ot-chart-row">
                                        <button type="button" class="ot-chart-label" data-ot-chart-toggle
                                            aria-expanded="${expanded}" aria-controls="ot-chart-designations-${index}">
                                            <i class="ph ph-caret-right" aria-hidden="true"></i> ${label}
                                        </button>
                                        ${renderBar(name, counts)}
                                    </div>
                                    <div id="ot-chart-designations-${index}" class="ot-chart-designations" ${expanded ? "" : "hidden"}>
                                        ${designations.map(([designation, totals]) => `
                                            <div class="ot-chart-row">
                                                <span class="ot-chart-designation">${this._escapeHtml(designation)}</span>
                                                ${renderBar(designation, totals, true)}
                                            </div>
                                        `).join("")}
                                    </div>
                                </div>
                            `;
                        }).join("")}
                        <div class="ot-chart-row" aria-hidden="true">
                            <div class="ot-chart-axis">
                                ${Array.from({ length: intervals + 1 }, (_, i) => `<span>${i * step}</span>`).join("")}
                            </div>
                        </div>
                    </div>
                ` : '<p class="ot-drill-empty">No overtime records for the selected filters.</p>'}
            </section>
        `;
    }

    _handleDepartmentChartClick(chart, target) {
        const row = target.closest(".ot-chart-department");
        if (!row) {
            return;
        }

        const department = row.dataset.otDepartment;
        const segment = target.closest("[data-ot-series]");
        if (segment) {
            const { otSeries, otDesignation } = segment.dataset;
            this._chartDrill = { cardKey: otSeries, group: { department, designation: otDesignation } };
            this._refreshTable();
            this.container.querySelector("#overtime-chart-detail-container")?.scrollIntoView?.({
                behavior: "smooth", block: "nearest",
            });
            return;
        }

        if (target.closest("[data-ot-chart-toggle]")) {
            this._expandedDepartment = this._expandedDepartment === department ? null : department;
            chart.querySelectorAll(".ot-chart-department").forEach((departmentRow) => {
                const expanded = departmentRow.dataset.otDepartment === this._expandedDepartment;
                departmentRow.querySelector("[data-ot-chart-toggle]").setAttribute("aria-expanded", expanded);
                departmentRow.querySelector(".ot-chart-designations").hidden = !expanded;
            });
        }
    }

    _renderSummaryCards(summary, otRecords, mightBeOT) {
        const categoryOrder = this.model.getCategoryOrder();

        const otCatCounts = this.model.countByCategory(otRecords);
        const mbCatCounts = this.model.countByCategory(mightBeOT);

        const cards = [
            {
                key: "otRecords",
                label: "OT Records",
                val: Number(summary.otRecordsCount || 0),
                icon: "ph-timer",
                cls: "info",
                catCounts: otCatCounts,
                hint: true,
            },
            {
                key: "mightBeOT",
                label: "Might Be OT",
                val: Number(summary.mightBeOTCount || 0),
                icon: "ph-clock-countdown",
                cls: "warning",
                catCounts: mbCatCounts,
                hint: true,
            },
        ];

        return `
            <div class="summary-grid summary-grid-category">
                ${cards
                    .map((c) => {
                        const isActive = this._drill && c.key && this._drill.cardKey === c.key;

                        const cardClasses = ["stat-card", c.cls, c.key ? "ot-card-clickable" : "", isActive ? "ot-card-active" : ""].filter(Boolean).join(" ");

                        return `
                    <div class="${cardClasses}" ${c.key ? `data-ot-card="${c.key}"` : ""}>

                        <div class="stat-card-top">
                            <div class="stat-card-top-left">
                                <div class="stat-icon"><i class="ph ${c.icon}"></i></div>
                                <div class="stat-content">
                                    <span class="stat-label">${this._escapeHtml(c.label)}</span>
                                    <span class="stat-value">${c.val}</span>
                                </div>
                            </div>
                            ${c.key && c.hint ? '<span class="stat-card-hint">↓ click to view</span>' : ""}
                        </div>

                        <div class="stat-category-row ot-chip-row">
                            ${categoryOrder
                                .map(
                                    (cat) => `
                                <div class="stat-category-item ot-chip"
                                    data-ot-card="${c.key || "all"}"
                                    data-category="${cat}"
                                    title="View ${cat} only">
                                    <span class="cat-label">${cat}</span>
                                    <span class="cat-value">${c.catCounts[cat] || 0}</span>
                                </div>
                            `,
                                )
                                .join("")}
                        </div>
                    </div>
                `;
                    })
                    .join("")}
            </div>
        `;
    }

    /* =========================================================
     * Drilldown panel
     * ========================================================= */
    _renderDrilldown(drill = this._drill, action = "drill") {
        if (!drill) {
            return "";
        }

        const records = this._getDrillRecords(drill);
        const title = this._getDrillTitle(drill);

        return `
            <div class="ot-panel">
                <div class="ot-panel-header ot-panel-header--drill">
                    <div class="ot-drill-title">
                        <i class="ph ph-list-dashes"></i>
                        Viewing <span>${this._escapeHtml(title)}</span>
                        <span class="ot-drill-count">(${records.length} found)</span>
                    </div>

                    <div class="ot-actions">
                        <button type="button" class="ot-btn ot-btn--sm ot-btn--excel" data-ot-action="download-${action}">
                            <i class="ph ph-file-xls"></i> Excel
                        </button>
                        <button type="button" class="ot-btn ot-btn--sm ot-btn--close" data-ot-action="close-${action}">
                            <i class="ph ph-x"></i> Close
                        </button>
                    </div>
                </div>

                <div class="ot-drill-scroll">
                    ${this._renderDrilldownTable(records)}
                </div>
            </div>
        `;
    }

    _renderDrilldownTable(records) {
        if (!records || records.length === 0) {
            return `<div class="ot-drill-empty">No records found.</div>`;
        }

        const rows = records.map((r) => this._renderRecordRow(r)).join("");

        return `
            <div class="ot-table-wrap">
                <table class="ot-table">
                    <thead>
                        <tr>
                            ${this._renderTableHeaders()}
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        `;
    }

    /* =========================================================
     * Shared table pieces (used by drilldown and main table)
     * ========================================================= */
    _getTableHeaders() {
        return [
            "Employee Code",
            "Employee Name",
            "Company",
            "Department",
            "Designation",
            "Location",
            "Date",
            "First Shift",
            "Begin Time",
            "End Time",
            "In Time",
            "Out Time",
            "Second Shift",
            "Begin Time",
            "End Time",
            "In Time",
            "Out Time",
        ];
    }

    _renderTableHeaders() {
        return this._getTableHeaders()
            .map((h) => `<th>${this._escapeHtml(h)}</th>`)
            .join("");
    }

    _renderRecordRow(r) {
        return `
            <tr>
                <td>${this._escapeHtml(r.employeeCode)}</td>
                <td>${this._escapeHtml(r.name)}</td>
                <td>${this._escapeHtml(r.company)}</td>
                <td>${this._escapeHtml(r.department)}</td>
                <td>${this._escapeHtml(r.designation)}</td>
                <td>${this._escapeHtml(r.location)}</td>
                <td>${this._escapeHtml(r.attendanceDate)}</td>
                <td>${this._escapeHtml(r.shift1)}</td>
                <td>${this._escapeHtml(r.shift1BeginTime)}</td>
                <td>${this._escapeHtml(r.shift1EndTime)}</td>
                <td>${this._escapeHtml(r.AttendanceLogsInTime)}</td>
                <td>${this._escapeHtml(r.AttendanceLogsOutTime)}</td>
                <td>${this._escapeHtml(r.shift2)}</td>
                <td>${this._escapeHtml(r.shift2BeginTime)}</td>
                <td>${this._escapeHtml(r.shift2EndTime)}</td>
                <td>${this._escapeHtml(r.NewAttendanceLogsInTime)}</td>
                <td>${this._escapeHtml(r.NewAttendanceLogsOutTime)}</td>
            </tr>
        `;
    }

    /* =========================================================
     * Main records table (OT Records, paginated)
     * ========================================================= */
    _renderRecordsTable() {
        const totalDepartments = this._departments.length;
        const totalPages = this._getTotalPages();

        this.currentPage = Math.min(Math.max(1, this.currentPage), totalPages);

        const startIndex = (this.currentPage - 1) * this.pageSize;
        const endIndex = Math.min(startIndex + this.pageSize, totalDepartments);
        const countCells = (counts) => `
            <td class="ot-summary-count">${counts.otRecords || 0}</td>
            <td class="ot-summary-count">${counts.mightBeOT || 0}</td>
        `;
        const groups = this._departments.slice(startIndex, endIndex).map(({ name, counts, designations }, index) => {
            const expanded = this._expandedSummaryDepartments.has(name);
            const childId = `ot-summary-designations-${startIndex + index}`;
            const label = this._escapeHtml(name);
            return `
                <tbody>
                    <tr>
                        <td>
                            <button type="button" class="ot-summary-toggle" data-ot-summary-toggle="${label}"
                                aria-expanded="${expanded}" aria-controls="${childId}">
                                <i class="ph ph-caret-right" aria-hidden="true"></i> ${label}
                            </button>
                        </td>
                        ${countCells(counts)}
                    </tr>
                </tbody>
                <tbody id="${childId}" ${expanded ? "" : "hidden"}>
                    ${designations.map(([designation, child]) => `
                        <tr>
                            <td class="ot-summary-designation">${this._escapeHtml(designation)}</td>
                            ${countCells(child)}
                        </tr>
                    `).join("")}
                </tbody>
            `;
        }).join("");

        return `
            <div class="ot-panel">

                <div class="ot-panel-header">
                    <div class="ot-panel-title">Overtime Department Summary</div>

                    <div class="ot-actions">
                        <button type="button" id="downloadExcelBtn" class="ot-btn ot-btn--excel">
                            <i class="ph ph-file-xls"></i>
                            Download Excel
                        </button>
                    </div>
                </div>

                <div class="ot-table-wrap">
                    <table class="ot-table ot-summary-table">
                        <thead>
                            <tr>
                                <th scope="col">Departments</th>
                                <th scope="col" class="ot-summary-count">Overtime Records</th>
                                <th scope="col" class="ot-summary-count">Might be Overtime Records</th>
                            </tr>
                        </thead>

                        ${groups || `
                            <tbody>
                                <tr>
                                    <td colspan="3" class="ot-empty-cell">No records found.</td>
                                </tr>
                            </tbody>
                        `}
                    </table>
                </div>

                ${this._renderPagination(totalDepartments, totalPages, startIndex, endIndex)}
            </div>
        `;
    }

    _renderPagination(totalDepartments, totalPages, startIndex, endIndex) {
        const pageButtons = this._renderPageButtons(totalPages);

        const prevDisabled = this.currentPage <= 1;
        const nextDisabled = this.currentPage >= totalPages;

        return `
            <div class="ot-pagination">

                <div class="ot-pagination-info">
                    ${totalDepartments === 0 ? "Showing 0 departments" : `Showing ${startIndex + 1}–${endIndex} of ${totalDepartments} departments`}
                </div>

                <div class="ot-pagination-controls">

                    <button
                        type="button"
                        class="ot-page-btn ot-page-btn--nav"
                        data-pagination-action="previous"
                        ${prevDisabled ? "disabled" : ""}
                    >
                        <i class="ph ph-caret-left"></i>
                        Previous
                    </button>

                    ${pageButtons}

                    <button
                        type="button"
                        class="ot-page-btn ot-page-btn--nav"
                        data-pagination-action="next"
                        ${nextDisabled ? "disabled" : ""}
                    >
                        Next
                        <i class="ph ph-caret-right"></i>
                    </button>

                </div>
            </div>
        `;
    }

    _renderPageButtons(totalPages) {
        const pages = [];

        let startPage = Math.max(1, this.currentPage - 2);
        let endPage = Math.min(totalPages, this.currentPage + 2);

        if (this.currentPage <= 3) {
            endPage = Math.min(5, totalPages);
        }

        if (this.currentPage >= totalPages - 2) {
            startPage = Math.max(1, totalPages - 4);
        }

        for (let page = startPage; page <= endPage; page++) {
            const isActive = page === this.currentPage;

            pages.push(`
                <button
                    type="button"
                    class="ot-page-btn ${isActive ? "ot-page-btn--active" : ""}"
                    data-pagination-action="page"
                    data-page="${page}"
                    aria-current="${isActive ? "page" : "false"}"
                >
                    ${page}
                </button>
            `);
        }

        return pages.join("");
    }

    _renderFooterMeta(data) {
        const generatedAt = data.generatedAt ? `Generated at ${this._escapeHtml(data.generatedAt)}` : "";
        const scope = data.scope ? `Scope: ${this._escapeHtml(data.scope)}` : "";

        const meta = [scope, generatedAt].filter(Boolean).join(" · ");

        if (!meta) {
            return "";
        }

        return `<p class="ot-footer-meta">${meta}</p>`;
    }

    /* =========================================================
     * Utils
     * ========================================================= */
    _escapeHtml(v) {
        if (v === null || v === undefined) {
            return "";
        }

        return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }
}

window.OvertimeView = OvertimeView;
