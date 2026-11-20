class OvertimeModel {
    constructor() {
        this.OVERTIME_PILOT_IDS = [28];

        this.state = {
            filters: null,
            data: null,
            isLoading: false,
            error: null
        };
    }

    _getCurrentUserId() {
        const u = window.HRMS_USER || {};
        const candidates = [u.id, u.userId, u.user_id, u.UserId, u.ID];

        for (const c of candidates) {
            const n = Number(c);
            if (!Number.isNaN(n) && n > 0) return n;
        }
        
        const attr = document.body?.dataset?.userId;
        
        if (attr) {
            const n = Number(attr);
            if (!Number.isNaN(n) && n > 0) return n;
        }
        
        return 0;
    }

    _canViewOvertime() {
        const currentUserId = this._getCurrentUserId();
        return this.OVERTIME_PILOT_IDS.includes(currentUserId);
    }

    async fetchData(filters) {
        if (!this._canViewOvertime()) {
            return { success: false, message: 'Coming soon' };
        }

        if (!filters || typeof filters !== 'object') {
            return { success: false, message: 'Invalid filters' };
        }

        if (!filters.dateFrom || !filters.dateTo) {
            return { success: false, message: 'dateFrom and dateTo are required' };
        }

        this.state.filters = filters;
        this.state.isLoading = true;
        this.state.error = null;

        try {
            const url = new URL(window.APP_CONFIG.API_URL, window.location.origin);
            url.searchParams.set('action', 'overtime_data');

            url.searchParams.set('date_from', filters.dateFrom);
            url.searchParams.set('date_to',   filters.dateTo);

            if (filters.dept && filters.dept !== 'All') {
                url.searchParams.set('dept', filters.dept);
            }
            if (filters.company && filters.company !== 'All') {
                url.searchParams.set('company', filters.company);
            }
            if (filters.shift && filters.shift !== 'All') {
                url.searchParams.set('shift', filters.shift);
            }
            if (filters.location && filters.location !== 'All') {
                url.searchParams.set('location', filters.location);
            }

            const response = await fetch(url.toString(), {
                method: 'GET',
                credentials: 'include',
                headers: { 'Accept': 'application/json' }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status} ${response.statusText}`);
            }

            const resData = await response.json();

            if (!resData || resData.success !== true) {
                throw new Error(resData?.message || 'API Error');
            }

            this.state.data = this._normalizeOvertimePayload(resData.overtime || {});
            return { success: true };
        } catch (error) {
            console.error('Overtime Fetch Error:', error);
            this.state.error = error.message || 'Unknown error';
            this.state.data = null;
            return { success: false, message: this.state.error };
        } finally {
            this.state.isLoading = false;
        }
    }

    _normalizeOvertimePayload(raw) {
        const summary = raw.summary || {};
        const records = Array.isArray(raw.records) ? raw.records : (Array.isArray(raw.employees) ? raw.employees : []);

        return {
            summary: {
                overtimeRecords: Number(summary.overtimeRecords ?? summary.overtimeDays ?? 0),
                employeeCount:   Number(summary.employeeCount ?? 0)
            },
            records: records,
            filtersApplied: raw.filtersApplied || {},
            scope: raw.scope || 'pilot',
            generatedAt: raw.generatedAt || null
        };
    }

    getData() { 
        return this.state.data; 
    }
    getSummary() { 
        return this.state.data?.summary || { overtimeRecords: 0, employeeCount: 0 }; 
    }
    getRecords() { 
        return this.state.data?.records || []; 
    }
    isLoading() { 
        return this.state.isLoading; 
    }
    getError() { 
        return this.state.error; 
    }
    canView() { 
        return this._canViewOvertime(); 
    }
}

window.OvertimeModel = OvertimeModel;