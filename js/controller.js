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

        this.view.bindResetFilters(() => {
            this.model.resetFilters();
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
