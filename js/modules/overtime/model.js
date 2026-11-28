class OvertimeModel {
    constructor() {
        this.OVERTIME_PILOT_IDS = [28];

        this.state = {
            filters: null,
            data: null,
            isLoading: false,
            error: null,
        };
    }

    /* =========================================================
     * Categories
     * Remove "OTHER" from this list once the PHP zone mapping
     * returns real categories for every employee.
     * ========================================================= */
    static CATEGORY_ORDER = ["ON-ROLL", "CC", "CONTRACTOR", "OUTSOURCE", "OTHER"];

    getCategoryOrder() {
        return OvertimeModel.CATEGORY_ORDER;
    }

    getCategoryLabel(cat) {
        return cat;
    }

    mergeCat(rawCat) {
        if (!rawCat) {
            return null;
        }

        const c = String(rawCat).toUpperCase().trim();

        if (c === "ON-ROLL" || c === "ONROLL" || c === "ON ROLL") {
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
        if (c === "OTHER") {
            return "OTHER";
        }

        return null;
    }

    emptyCatCounts() {
        const counts = {};
        OvertimeModel.CATEGORY_ORDER.forEach((cat) => {
            counts[cat] = 0;
        });
        return counts;
    }

    countByCategory(records) {
        const counts = this.emptyCatCounts();

        (records || []).forEach((r) => {
            const cat = this.mergeCat(r && r.companyCategory);

            if (cat && counts[cat] !== undefined) {
                counts[cat]++;
            }
        });

        return counts;
    }

    /* =========================================================
     * Access control
     * ========================================================= */
    _getCurrentUserId() {
        const u = window.HRMS_USER || {};
        const candidates = [u.id, u.userId, u.user_id, u.UserId, u.ID];

        for (const c of candidates) {
            const n = Number(c);

            if (!Number.isNaN(n) && n > 0) {
                return n;
            }
        }

        let attr = "";

        if (document.body && document.body.dataset) {
            attr = document.body.dataset.userId;
        }

        if (attr) {
            const n = Number(attr);

            if (!Number.isNaN(n) && n > 0) {
                return n;
            }
        }

        return 0;
    }

    _canViewOvertime() {
        const currentUserId = this._getCurrentUserId();
        return this.OVERTIME_PILOT_IDS.includes(currentUserId);
    }

    canView() {
        return this._canViewOvertime();
    }

    /* =========================================================
     * Data fetch
     * ========================================================= */
    async fetchData(filters) {
        if (!this._canViewOvertime()) {
            this.state.data = null;
            this.state.error = null;
            this.state.isLoading = false;

            return {
                success: false,
                message: "Coming Soon",
            };
        }

        if (!filters || typeof filters !== "object") {
            return {
                success: false,
                message: "Invalid filters",
            };
        }

        if (!filters.dateFrom || !filters.dateTo) {
            return {
                success: false,
                message: "dateFrom and dateTo are required",
            };
        }

        this.state.filters = filters;
        this.state.isLoading = true;
        this.state.error = null;

        try {
            const url = new URL(window.APP_CONFIG.API_URL, window.location.origin);

            url.searchParams.set("action", "overtime_data");
            url.searchParams.set("date_from", filters.dateFrom);
            url.searchParams.set("date_to", filters.dateTo);

            if (filters.dept && filters.dept !== "All") {
                url.searchParams.set("dept", filters.dept);
            }

            if (filters.company && filters.company !== "All") {
                url.searchParams.set("company", filters.company);
            }

            if (filters.designation && filters.designation !== "All") {
                url.searchParams.set("designation", filters.designation);
            }

            if (filters.shift && filters.shift !== "All") {
                url.searchParams.set("shift", filters.shift);
            }

            if (filters.location && filters.location !== "All") {
                url.searchParams.set("location", filters.location);
            }

            const response = await fetch(url.toString(), {
                method: "GET",
                credentials: "include",
                headers: {
                    Accept: "application/json",
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status} ${response.statusText}`);
            }

            const resData = await response.json();

            if (!resData || resData.success !== true) {
                throw new Error((resData && resData.message) || "API Error");
            }

            this.state.data = this._normalizeOvertimePayload(resData.overtime || {});

            return {
                success: true,
            };
        } catch (error) {
            console.error("Overtime Fetch Error:", error);

            this.state.error = error.message || "Unknown error";
            this.state.data = null;

            return {
                success: false,
                message: this.state.error,
            };
        } finally {
            this.state.isLoading = false;
        }
    }

    _normalizeOvertimePayload(raw) {
        const summary = raw.summary || {};

        const otRecords = Array.isArray(raw.otRecords) ? raw.otRecords : [];
        const mightBeOT = Array.isArray(raw.mightBeOT) ? raw.mightBeOT : [];

        return {
            summary: {
                otRecordsCount: Number(summary.otRecordsCount || 0),
                mightBeOTCount: Number(summary.mightBeOTCount || 0),
                employeeCount: Number(summary.employeeCount || 0),
            },

            otRecords: otRecords,
            mightBeOT: mightBeOT,

            filtersApplied: raw.filtersApplied || {},
            scope: raw.scope || "pilot",
            generatedAt: raw.generatedAt || null,
        };
    }

    /* =========================================================
     * Getters
     * ========================================================= */
    getData() {
        return this.state.data;
    }

    getSummary() {
        if (this.state.data && this.state.data.summary) {
            return this.state.data.summary;
        }

        return {
            otRecordsCount: 0,
            mightBeOTCount: 0,
            employeeCount: 0,
        };
    }

    getOTRecords() {
        if (this.state.data && this.state.data.otRecords) {
            return this.state.data.otRecords;
        }

        return [];
    }

    getMightBeOTRecords() {
        if (this.state.data && this.state.data.mightBeOT) {
            return this.state.data.mightBeOT;
        }

        return [];
    }

    getOTCategoryCounts() {
        return this.countByCategory(this.getOTRecords());
    }

    getMightBeOTCategoryCounts() {
        return this.countByCategory(this.getMightBeOTRecords());
    }

    getOTRecordsByCategory(cat) {
        const target = this.mergeCat(cat);

        if (!target) {
            return [];
        }

        return this.getOTRecords().filter((r) => this.mergeCat(r.companyCategory) === target);
    }

    getMightBeOTRecordsByCategory(cat) {
        const target = this.mergeCat(cat);

        if (!target) {
            return [];
        }

        return this.getMightBeOTRecords().filter((r) => this.mergeCat(r.companyCategory) === target);
    }

    isLoading() {
        return this.state.isLoading;
    }

    getError() {
        return this.state.error;
    }
}

window.OvertimeModel = OvertimeModel;
