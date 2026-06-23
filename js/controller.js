/**
 * AttendanceController - Coordinates between Model and View
 */
class AttendanceController {
    constructor(model, view) {
        this.model = model;
        this.view = view;

        // Bind model changes to view render
        this.model.bindDataChanged(state => {
            // Use requestAnimationFrame to ensure smooth rendering and avoid race conditions
            requestAnimationFrame(() => {
                this.view.render(state, this.model);
            });
        });

        // Bind view events to controller actions
        this.view.bindSwitchTab(tabId => {
            this.model.switchTab(tabId);
        });

        this.view.bindApplyFilters(async filters => {
            this.model.updateFilters(filters);
            this.view.showOverlay('Updating dashboard...');
            const result = await this.model.fetchData();
            this.view.hideOverlay();
            
            if (!result.success) {
                alert('Error updating data: ' + result.error);
            }
        });

        this.view.bindRefreshData(async () => {
            this.view.showOverlay('Syncing with eSSL Server...');
            await this.model.fetchData();
            this.view.hideOverlay();
        });

        this.view.bindResetFilters(async () => {
            this.model.resetFilters();
            this.view.showOverlay('Resetting dashboard...');
            await this.model.fetchData(); // ← fetch after reset
            this.view.hideOverlay();
        });

        this.view.bindStatCardClick((key) => {
            let items = [];
            switch (key) {
                case 'present': 
                    items = this.model.getPresentEmployees(); 
                    break;
                case 'halfPresent':
                    items = this.model.getHalfPresentEmployees();
                    break;
                case 'weeklyOff':
                    items = this.model.getWeeklyOffEmployees();
                    break;
                case 'absent':      
                    items = this.model.getAbsentEmployees(); 
                    break;
                case 'resigned':
                    items = this.model.getResignedEmployees();
                    break;
                case 'newJoined':
                    items = this.model.getNewJoinedEmployees();
                    break;
                case 'singlePunch': 
                    items = this.model.getSinglePunchEmployees(); 
                    break;
                case 'lateIn':      
                    items = this.model.getLateInEmployees();      
                    break;
                case 'earlyOut':    
                    items = this.model.getEarlyOutEmployees();    
                    break;
                case 'staffList':
                    items = this.model.getStaffEmployees();
                    break;
                case 'workerList':
                    items = this.model.getWorkerEmployees();
                    break;
            }
            this.view._renderStatCardDrilldown(key, items);
        });

        // Initial fetch
        this.init();
    }

    async init() {
        this.view.showOverlay('Loading dashboard...');
        
        // Fetch filter options (departments, companies) from API
        await this.model.fetchFilterOptions();
        
        const result = await this.model.fetchData();
        if (!result.success) {
            alert('Error loading data: ' + result.error);
        }
        this.view.hideOverlay();
    }
}

window.AttendanceController = AttendanceController;
