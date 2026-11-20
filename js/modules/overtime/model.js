class OvertimeModel {
    constructor() {
        this.state = {
            filters: null,
            data: null,
            isLoading: false,
            error: null
        };
    }

    _canViewOvertime() {
        const OVERTIME_PILOT_IDS = [123]; 
        const currentUserId = Number((window.HRMS_USER || {}).id || (window.HRMS_USER || {}).userId || 0);
        return OVERTIME_PILOT_IDS.includes(currentUserId);
    }

    async fetchData(filters) {
        if (!this._canViewOvertime()) {
            return { success: false, message: 'Coming soon' };
        }

        this.state.filters = filters;
        this.state.isLoading = true;

        try {
            const url = new URL(window.APP_CONFIG.API_URL, window.location.origin);
            url.searchParams.set('action', 'overtime_data'); // The fresh API action
            
            if (filters.dateFrom) {
                url.searchParams.set('date_from', filters.dateFrom);
            }
            if (filters.dateTo) {
                url.searchParams.set('date_to', filters.dateTo);
            }
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
            
            const response = await fetch(url.toString(), { credentials: 'include' });
            const resData = await response.json();

            if (resData.success) {
                this.state.data = resData.overtime;
                return { success: true };
            } else {
                throw new Error(resData.message || 'API Error');
            }
        } catch (error) {
            console.error('Overtime Fetch Error:', error);
            this.state.error = error.message;
            return { success: false, error: error.message };
        } finally {
            this.state.isLoading = false;
        }
    }
}

window.OvertimeModel = OvertimeModel;