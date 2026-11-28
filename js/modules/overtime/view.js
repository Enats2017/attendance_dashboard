class OvertimeView {
    constructor() {
        this.model = new OvertimeModel();

        // Pagination state (main table = OT Records)
        this.currentPage = 1;
        this.pageSize = 25;

        // Latest data returned by the model
        this.currentData = null;

        // Container this view renders into
        this.container = null;

        // Active drilldown: { cardKey: "otRecords" | "mightBeOT" | "all", category: "CC" | null }
        this._drill = null;

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
        this.currentData = this.model.getData();

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

            // 5. Download main table (OT Records)
            if (target.closest("#downloadExcelBtn")) {
                this._downloadCsv(this.model.getOTRecords(), "Overtime_Records");
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

    _getDrillRecords() {
        if (!this._drill) {
            return [];
        }

        const source = this._getDrillSource(this._drill.cardKey);

        if (!this._drill.category) {
            return source;
        }

        return source.filter((r) => this.model.mergeCat(r.companyCategory) === this._drill.category);
    }

    _getDrillTitle() {
        if (!this._drill) {
            return "";
        }

        let base = "All";

        if (this._drill.cardKey === "otRecords") {
            base = "OT Records";
        } else if (this._drill.cardKey === "mightBeOT") {
            base = "Might Be OT";
        }

        if (this._drill.category) {
            return `${base} - ${this._drill.category}`;
        }

        return base;
    }

    /* =========================================================
     * CSV download
     * ========================================================= */
    _downloadCsv(records, filePrefix) {
        if (!records || !records.length) {
            alert("No data to download.");
            return;
        }

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

        const csvRows = [];
        csvRows.push(headers.map((h) => `"${h}"`).join(","));

        records.forEach((r) => {
            const row = [
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
            ];

            const escapedRow = row.map((val) => {
                const safeVal = val === null || val === undefined ? "" : String(val);
                return `"${safeVal.replace(/"/g, '""')}"`;
            });

            csvRows.push(escapedRow.join(","));
        });

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
        const records = this.model.getOTRecords();
        return Math.max(1, Math.ceil(records.length / this.pageSize));
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

            ${this._renderRecordsTable(otRecords)}
            ${this._renderFooterMeta(data)}
        `;
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
    _renderDrilldown() {
        if (!this._drill) {
            return "";
        }

        const records = this._getDrillRecords();
        const title = this._getDrillTitle();

        return `
            <div class="ot-panel">
                <div class="ot-panel-header ot-panel-header--drill">
                    <div class="ot-drill-title">
                        <i class="ph ph-list-dashes"></i>
                        Viewing <span>${this._escapeHtml(title)}</span>
                        <span class="ot-drill-count">(${records.length} found)</span>
                    </div>

                    <div class="ot-actions">
                        <button type="button" class="ot-btn ot-btn--sm ot-btn--excel" data-ot-action="download-drill">
                            <i class="ph ph-file-xls"></i> Excel
                        </button>
                        <button type="button" class="ot-btn ot-btn--sm ot-btn--close" data-ot-action="close-drill">
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
    _renderRecordsTable(records) {
        const totalRecords = records.length;
        const totalPages = Math.max(1, Math.ceil(totalRecords / this.pageSize));

        this.currentPage = Math.min(Math.max(1, this.currentPage), totalPages);

        const startIndex = (this.currentPage - 1) * this.pageSize;
        const endIndex = Math.min(startIndex + this.pageSize, totalRecords);

        const paginatedRecords = records.slice(startIndex, endIndex);

        const rows = paginatedRecords.map((r) => this._renderRecordRow(r)).join("");
        const columnCount = this._getTableHeaders().length;

        return `
            <div class="ot-panel">

                <div class="ot-panel-header">
                    <div class="ot-panel-title">Overtime Records</div>

                    <div class="ot-actions">
                        <button type="button" id="downloadExcelBtn" class="ot-btn ot-btn--excel">
                            <i class="ph ph-file-xls"></i>
                            Download Excel
                        </button>
                    </div>
                </div>

                <div class="ot-table-wrap">
                    <table class="ot-table">
                        <thead>
                            <tr>
                                ${this._renderTableHeaders()}
                            </tr>
                        </thead>

                        <tbody>
                            ${
                                rows ||
                                `
                                <tr>
                                    <td colspan="${columnCount}" class="ot-empty-cell">No records found.</td>
                                </tr>
                            `
                            }
                        </tbody>
                    </table>
                </div>

                ${this._renderPagination(totalRecords, totalPages, startIndex, endIndex)}
            </div>
        `;
    }

    _renderPagination(totalRecords, totalPages, startIndex, endIndex) {
        const pageButtons = this._renderPageButtons(totalPages);

        const prevDisabled = this.currentPage <= 1;
        const nextDisabled = this.currentPage >= totalPages;

        return `
            <div class="ot-pagination">

                <div class="ot-pagination-info">
                    ${totalRecords === 0 ? "Showing 0 records" : `Showing ${startIndex + 1}–${endIndex} of ${totalRecords} records`}
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