class OvertimeView {
    constructor() {
        this.model = new OvertimeModel();

        // Pagination state
        this.currentPage = 1;
        this.pageSize = 25;

        // Store current records for pagination
        this.currentData = null;

        // Keep track of the container
        this.container = null;

        // Bound handlers (initialized on attach)
        this._boundClickHandler = null;
        this._boundChangeHandler = null;

        this._filteredRecords = null;
        this._filteredCatLabel = "";
    }

    /**
     * Main Render Function
     */
    async render(container, parentFilters) {
        if (!container) {
            return;
        }

        this.container = container;

        // Attach event listeners
        this._attachPaginationEvents(container);

        // Access validation
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

        const data = this.model.getData();

        // Reset pagination whenever new data is fetched
        this.currentPage = 1;
        this.currentData = data;

        container.innerHTML = this._renderDashboard(data);
    }

    /**
     * Attach Pagination & Download Events
     */
    _attachPaginationEvents(container) {
        // Remove old listeners if they exist
        if (this._boundClickHandler) {
            container.removeEventListener("click", this._boundClickHandler);
        }
        if (this._boundChangeHandler) {
            container.removeEventListener("change", this._boundChangeHandler);
        }

        // Define the click handler
        this._boundClickHandler = (event) => {
            const catItem = event.target.closest(".stat-category-item");
            if (catItem && container.contains(catItem)) {
                event.stopPropagation();
                this._handleCategoryChipClick(catItem.dataset.cardKey, catItem.dataset.category);
                return;
            }

            const downloadBtn = event.target.closest("#downloadExcelBtn");
            if (downloadBtn) {
                this._downloadOvertimeExcel();
                return;
            }

            const button = event.target.closest("[data-pagination-action]");
            if (!button || !container.contains(button)) {
                return;
            }

            const action = button.dataset.paginationAction;

            if (action === "previous") {
                if (this.currentPage > 1) {
                    this.currentPage--;
                }
            } else if (action === "next") {
                const totalPages = this._getTotalPages();
                if (this.currentPage < totalPages) {
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

        // Define the change handler (kept for safety, though dropdown is removed)
        this._boundChangeHandler = (event) => {
            const select = event.target.closest("[data-pagination-size]");
            if (!select || !container.contains(select)) {
                return;
            }
            const newSize = Number(select.value);
            if (Number.isInteger(newSize) && newSize > 0) {
                this.pageSize = newSize;
                this.currentPage = 1;
                this._refreshTable();
            }
        };

        container.addEventListener("click", this._boundClickHandler);
        container.addEventListener("change", this._boundChangeHandler);
    }

    _downloadOvertimeExcel() {
        let source = [];

        if (this._filteredRecords) {
            source = this._filteredRecords;
        } else {
            if (this.currentData && Array.isArray(this.currentData.otRecords)) {
                source = this.currentData.otRecords;
            } else {
                source = [];
            }
        }

        if (!source.length) {
            alert("No data to download.");
            return;
        }

        const records = source;

        const headers = [
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

        const csvRows = [];
        csvRows.push(headers.map((h) => `"${h}"`).join(","));

        records.forEach((r) => {
            const row = [
                r.employeeCode,
                r.companyCategory,
                r.name,
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

        const csvString = csvRows.join("\r\n");
        const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });

        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10);

        link.setAttribute("href", url);
        link.setAttribute("download", `Overtime_Records_${dateStr}.csv`);
        link.style.visibility = "hidden";

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    _refreshTable() {
        if (!this.container || !this.currentData) {
            return;
        }

        this.container.innerHTML = this._renderDashboard(this.currentData);
    }

    _handleCategoryChipClick(cardKey, category) {
        if (!this.currentData) {
            return;
        }

        const target = this._mergeCat(category);

        if (!target) {
            return;
        }

        const ot = Array.isArray(this.currentData.otRecords) ? this.currentData.otRecords : [];
        const mb = Array.isArray(this.currentData.mightBeOT) ? this.currentData.mightBeOT : [];

        let source;
        if (cardKey === "otRecords") {
            source = ot;
        } else if (cardKey === "mightBeOT") {
            source = mb;
        } else {
            source = [...ot, ...mb];
        }

        const filtered = source.filter((r) => this._mergeCat(r.companyCategory) === target);

        this._filteredRecords = filtered;
        this._filteredCatLabel = target;
        this.currentPage = 1;

        this._refreshTable();
    }

    _clearCategoryFilter() {
        this._filteredRecords = null;
        this._filteredCatLabel = "";
        this.currentPage = 1;
        this._refreshTable();
    }

    _getTotalPages() {
        let records = [];

        if (this._filteredRecords) {
            records = this._filteredRecords;
        } else {
            if (this.currentData && Array.isArray(this.currentData.otRecords)) {
                records = this.currentData.otRecords;
            } else {
                records = [];
            }
        }

        return Math.max(1, Math.ceil(records.length / this.pageSize));
    }

    _renderLoading() {
        return `
            <div style="padding:40px; text-align:center; color:#64748b;">
                <i class="ph ph-spinner ph-spin" style="font-size:32px;"></i>
                <p style="margin-top:8px;">Loading Overtime Data...</p>
            </div>
        `;
    }

    _renderError(message) {
        const safe = this._escapeHtml(message || "Unknown error");

        return `
            <div style="padding:24px; text-align:center; color:#b91c1c; background:#fef2f2; border:1px solid #fecaca; border-radius:8px;">
                <i class="ph ph-warning-circle" style="font-size:28px;"></i>
                <p style="margin:8px 0 0; font-weight:600;">Error</p>
                <p style="margin:4px 0 0; font-size:14px;">${safe}</p>
            </div>
        `;
    }

    _renderComingSoon() {
        return `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:80px 20px; text-align:center;">
                <div style="background:#f1f5f9; width:80px; height:80px; border-radius:50%; display:flex; align-items:center; justify-content:center; margin-bottom:20px;">
                    <i class="ph ph-clock-user" style="font-size:40px; color:#64748b;"></i>
                </div>

                <h2 style="font-size:24px; font-weight:700; color:#1e293b; margin:0 0 8px;">
                    Overtime Module
                </h2>

                <p style="color:#64748b; font-size:16px; max-width:400px; margin:0 0 24px;">
                    We are currently perfecting the new Overtime calculations.
                    This module will be available for your account soon!
                </p>

                <span style="background:#fef08a; color:#854d0e; padding:6px 16px; border-radius:20px; font-weight:600; font-size:14px;">
                    Coming Soon
                </span>
            </div>
        `;
    }
    
    _renderDashboard(data) {
        if (!data) {
            return this._renderEmpty("No overtime data available.");
        }

        const summary = data.summary || {
            otRecordsCount: 0,
            mightBeOTCount: 0,
            employeeCount: 0
        };

        let otRecords = [];

        if (Array.isArray(data.otRecords)) {
            otRecords = data.otRecords;
        }

        const totalPages = Math.max(1, Math.ceil(otRecords.length / this.pageSize));

        if (this.currentPage > totalPages) {
            this.currentPage = totalPages;
        }

        const mightBeOT = Array.isArray(data.mightBeOT) ? data.mightBeOT : [];

        const tableRecords = this._filteredRecords || otRecords;

        const filterBanner = this._filteredRecords ? `
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin:0 0 12px; padding:10px 14px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px;">
                <div style="font-size:13px; font-weight:600; color:#1e3a8a;">
                    Filtered by category: <span style="color:#2563eb;">${this._escapeHtml(this._filteredCatLabel)}</span>
                    · ${this._filteredRecords.length} record(s)
                </div>
                <button type="button" id="otClearCategoryFilter"
                    style="padding:6px 12px; border:1px solid #93c5fd; border-radius:6px; background:#fff; color:#1e3a8a; cursor:pointer; font-size:12px; font-weight:600;">
                    <i class="ph ph-x"></i> Clear Filter
                </button>
            </div>
        ` : "";

        return `
            ${this._renderSummaryCards(summary, otRecords, mightBeOT)}
            ${filterBanner}
            ${this._renderRecordsTable(tableRecords)}
            ${this._renderFooterMeta(data)}
        `;
    }

    _renderSummaryCards(summary, otRecords = [], mightBeOT = []) {
        const categoryOrder = ["ON-ROLL", "CC", "CONTRACTOR", "OUTSOURCE"];

        const otCatCounts    = this._countByCategory(otRecords);
        const mbCatCounts    = this._countByCategory(mightBeOT);

        const totalCatCounts = this._emptyCatCounts();
        categoryOrder.forEach((cat) => {
            totalCatCounts[cat] = otCatCounts[cat] + mbCatCounts[cat];
        });

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
            {
                key: null,
                label: "Employees",
                val: Number(summary.employeeCount || 0),
                icon: "ph-users",
                cls: "",
                catCounts: totalCatCounts,
                hint: false,
            },
        ];

        return `
            <div class="summary-grid summary-grid-category">
                ${cards.map((c) => `
                    <div class="stat-card ${c.cls} ${c.key ? "stat-card-clickable" : ""}"
                        ${c.key ? `data-card-key="${c.key}"` : ""}>
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

                        ${c.catCounts ? `
                            <div class="stat-category-row">
                                ${categoryOrder.map((cat) => `
                                    <div class="stat-category-item"
                                        data-card-key="${c.key || ""}"
                                        data-category="${cat}"
                                        title="View ${cat} only">
                                        <span class="cat-label">${cat}</span>
                                        <span class="cat-value">${c.catCounts[cat] || 0}</span>
                                    </div>
                                `).join("")}
                            </div>
                        ` : ""}
                    </div>
                `).join("")}
            </div>
        `;
    }

    _renderRecordsTable(records) {
        const totalRecords = records.length;

        const totalPages = Math.max(1, Math.ceil(totalRecords / this.pageSize));

        this.currentPage = Math.min(Math.max(1, this.currentPage), totalPages);

        const startIndex = (this.currentPage - 1) * this.pageSize;
        const endIndex = Math.min(startIndex + this.pageSize, totalRecords);

        const paginatedRecords = records.slice(startIndex, endIndex);

        const rows = paginatedRecords.map(
            (r) => `
                <tr>
                    <!-- Employee Code -->
                    <td style="padding:12px; border-bottom:1px solid #f1f5f9; white-space:nowrap;">
                        ${this._escapeHtml(r.employeeCode)}
                    </td>

                    <!-- Employee Name -->
                    <td style="padding:12px; border-bottom:1px solid #f1f5f9; white-space:nowrap;">
                        ${this._escapeHtml(r.name)}
                    </td>

                    <!-- Company -->
                    <td style="padding:12px; border-bottom:1px solid #f1f5f9; white-space:nowrap;">
                        ${this._escapeHtml(r.company)}
                    </td>

                    <!-- Department -->
                    <td style="padding:12px; border-bottom:1px solid #f1f5f9; white-space:nowrap;">
                        ${this._escapeHtml(r.department)}
                    </td>

                    <!-- Designation -->
                    <td style="padding:12px; border-bottom:1px solid #f1f5f9; white-space:nowrap;">
                        ${this._escapeHtml(r.designation)}
                    </td>

                    <!-- Location -->
                    <td style="padding:12px; border-bottom:1px solid #f1f5f9; white-space:nowrap;">
                        ${this._escapeHtml(r.location)}
                    </td>

                    <!-- Date -->
                    <td style="padding:12px; border-bottom:1px solid #f1f5f9; white-space:nowrap;">
                        ${this._escapeHtml(r.attendanceDate)}
                    </td>

                    <!-- First Shift -->
                    <td style="padding:12px; border-bottom:1px solid #f1f5f9; white-space:nowrap;">
                        ${this._escapeHtml(r.shift1)}
                    </td>

                    <!-- First Shift Begin Time -->
                    <td style="padding:12px; border-bottom:1px solid #f1f5f9; white-space:nowrap;">
                        ${this._escapeHtml(r.shift1BeginTime)}
                    </td>

                    <!-- First Shift End Time -->
                    <td style="padding:12px; border-bottom:1px solid #f1f5f9; white-space:nowrap;">
                        ${this._escapeHtml(r.shift1EndTime)}
                    </td>

                    <!-- First Shift In Time -->
                    <td style="padding:12px; border-bottom:1px solid #f1f5f9; white-space:nowrap;">
                        ${this._escapeHtml(r.AttendanceLogsInTime)}
                    </td>

                    <!-- First Shift Out Time -->
                    <td style="padding:12px; border-bottom:1px solid #f1f5f9; white-space:nowrap;">
                        ${this._escapeHtml(r.AttendanceLogsOutTime)}
                    </td>

                    <!-- Second Shift -->
                    <td style="padding:12px; border-bottom:1px solid #f1f5f9; white-space:nowrap;">
                        ${this._escapeHtml(r.shift2)}
                    </td>

                    <!-- Second Shift Begin Time -->
                    <td style="padding:12px; border-bottom:1px solid #f1f5f9; white-space:nowrap;">
                        ${this._escapeHtml(r.shift2BeginTime)}
                    </td>

                    <!-- Second Shift End Time -->
                    <td style="padding:12px; border-bottom:1px solid #f1f5f9; white-space:nowrap;">
                        ${this._escapeHtml(r.shift2EndTime)}
                    </td>

                    <!-- Second Shift In Time -->
                    <td style="padding:12px; border-bottom:1px solid #f1f5f9; white-space:nowrap;">
                        ${this._escapeHtml(r.NewAttendanceLogsInTime)}
                    </td>

                    <!-- Second Shift Out Time -->
                    <td style="padding:12px; border-bottom:1px solid #f1f5f9; white-space:nowrap;">
                        ${this._escapeHtml(r.NewAttendanceLogsOutTime)}
                    </td>

                </tr>
            `,
        ).join("");

        const headers = [
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
            "In Time", "Out Time", 
            "Second Shift", 
            "Begin Time", 
            "End Time", 
            "In Time", 
            "Out Time",
        ];

        return `
            <div style="background:#fff; border:1px solid #e2e8f0; border-radius:10px; overflow:hidden;">

                <!-- Table Header Controls -->
                <div style="display:flex; flex-wrap:wrap; gap:12px; justify-content:space-between; align-items:center; padding:16px; border-bottom:1px solid #e2e8f0;">

                    <div style="font-size:14px; font-weight:600; color:#334155;">
                        Overtime Records
                    </div>

                    <div style="display:flex; align-items:center; gap:8px;">
                        <button
                            type="button"
                            id="downloadExcelBtn"
                            style="display:flex; align-items:center; gap:6px; padding:7px 14px; border:1px solid #10b981; border-radius:6px; background:#10b981; color:#fff; font-size:13px; font-weight:600; cursor:pointer; transition: background 0.2s;"
                            onmouseover="this.style.background='#059669'"
                            onmouseout="this.style.background='#10b981'"
                        >
                            <i class="ph ph-file-xls" style="font-size:16px;"></i>
                            Download Excel
                        </button>
                    </div>

                </div>

                <!-- Table -->
                <div style="overflow-x:auto;">
                    <table style="width:100%; border-collapse:collapse; font-size:14px; min-width:1800px;">

                        <thead style="background:#f8fafc;">
                            <tr>
                                ${headers
                                    .map(
                                        (header) => `
                                            <th style="text-align:left; padding:12px; border-bottom:1px solid #e2e8f0; font-weight:600; color:#475569; white-space:nowrap;">
                                                ${this._escapeHtml(header)}
                                            </th>
                                        `,
                                    )
                                    .join("")}
                            </tr>
                        </thead>

                        <tbody>
                            ${
                                rows ||
                                `
                                    <tr>
                                        <td colspan="${headers.length}" style="padding:24px; text-align:center; color:#64748b;">
                                            No records found.
                                        </td>
                                    </tr>
                                `
                            }
                        </tbody>

                    </table>
                </div>

                <!-- Pagination Footer -->
                ${this._renderPagination(totalRecords, totalPages, startIndex, endIndex)}

            </div>
        `;
    }

    /**
     * Pagination Controls
     */
    _renderPagination(totalRecords, totalPages, startIndex, endIndex) {
        const pageButtons = this._renderPageButtons(totalPages);

        return `
            <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:12px; padding:14px 16px; border-top:1px solid #e2e8f0;">

                <!-- Record Count -->
                <div style="font-size:13px; color:#64748b;">
                    ${totalRecords === 0 ? "Showing 0 records" : `Showing ${startIndex + 1}–${endIndex} of ${totalRecords} records`}
                </div>

                <!-- Pagination Buttons -->
                <div style="display:flex; flex-wrap:wrap; align-items:center; gap:6px;">

                    <!-- Previous -->
                    <button
                        type="button"
                        data-pagination-action="previous"
                        ${this.currentPage <= 1 ? "disabled" : ""}
                        style="padding:7px 12px; border:1px solid #e2e8f0; border-radius:6px; background:${this.currentPage <= 1 ? "#f1f5f9" : "#fff"}; color:${this.currentPage <= 1 ? "#94a3b8" : "#334155"}; cursor:${this.currentPage <= 1 ? "not-allowed" : "pointer"};"
                    >
                        <i class="ph ph-caret-left"></i>
                        Previous
                    </button>

                    <!-- Page Numbers -->
                    ${pageButtons}

                    <!-- Next -->
                    <button
                        type="button"
                        data-pagination-action="next"
                        ${this.currentPage >= totalPages ? "disabled" : ""}
                        style="padding:7px 12px; border:1px solid #e2e8f0; border-radius:6px; background:${this.currentPage >= totalPages ? "#f1f5f9" : "#fff"}; color:${this.currentPage >= totalPages ? "#94a3b8" : "#334155"}; cursor:${this.currentPage >= totalPages ? "not-allowed" : "pointer"};"
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
                    data-pagination-action="page"
                    data-page="${page}"
                    aria-current="${isActive ? "page" : "false"}"
                    style="min-width:36px; padding:7px 10px; border:1px solid ${isActive ? "#3b82f6" : "#e2e8f0"}; border-radius:6px; background:${isActive ? "#3b82f6" : "#fff"}; color:${isActive ? "#fff" : "#334155"}; font-weight:${isActive ? "600" : "400"}; cursor:pointer;"
                >
                    ${page}
                </button>
            `);
        }

        return pages.join("");
    }

    /**
     * Empty State
     */
    _renderEmpty(message) {
        return `
            <div style="padding:40px; text-align:center; color:#64748b; background:#f8fafc; border:1px dashed #cbd5e1; border-radius:10px;">
                <i class="ph ph-info" style="font-size:28px;"></i>
                <p style="margin:8px 0 0;">
                    ${this._escapeHtml(message)}
                </p>
            </div>
        `;
    }

    _renderFooterMeta(data) {
        const generatedAt = data.generatedAt ? `Generated at ${this._escapeHtml(data.generatedAt)}` : "";

        const scope = data.scope ? `Scope: ${this._escapeHtml(data.scope)}` : "";

        const meta = [scope, generatedAt].filter(Boolean).join(" · ");

        if (!meta) {
            return "";
        }

        return `
            <p style="margin-top:12px; font-size:12px; color:#94a3b8; text-align:right;">
                ${meta}
            </p>
        `;
    }

    _escapeHtml(v) {
        if (v === null || v === undefined) {
            return "";
        }

        return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }

    _mergeCat(rawCat) {
        if (!rawCat) {
            return null;
        }

        const c = String(rawCat).toUpperCase().trim();
        
        if (c === "ON-ROLL" || c === "ONROLL") {
            return "ON-ROLL";
        }

        if (c === "CC" || c === "COMPANY CONTRACT" || c === "COMPANY CONTRACT (CC)") {
            return "CC";
        }
        
        if (c === "CONTRACTOR") {
            return "CONTRACTOR";
        }
        
        if (c === "OUTSOURCE") {
            return "OUTSOURCE";
        }
        
        return null;
    }

    _emptyCatCounts() {
        return { "ON-ROLL": 0, "CC": 0, "CONTRACTOR": 0, "OUTSOURCE": 0 };
    }

    _countByCategory(records) {
        const counts = this._emptyCatCounts();
     
        (records || []).forEach((r) => {
            const cat = this._mergeCat(r && r.companyCategory);
     
            if (cat) {
                counts[cat]++;
            }
        });
     
        return counts;
    }
}

window.OvertimeView = OvertimeView;
