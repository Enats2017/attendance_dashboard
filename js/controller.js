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
            this.model.setSubAdmin(filters.subadminUserId);
            this.model.updateFilters(filters);

            this.view.showOverlay('Updating dashboard...');
            const result = await this.model.fetchData();
            await this.model.fetchFilterOptions();
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

        this.view.bindSubAdminChange((subadminUserId) => {
            this.model.state.filters.subadminUserId = subadminUserId || null;
            this.model.state.filterLists = null; 
        });

        this.view.bindStatCardClick((key) => {
            let items = [];
            switch (key) {
                case 'totalHeadcount': {
                    const { emps } = this.model.getFilteredData();
                    items = emps.map(emp => ({ log: null, emp, date: null }));
                    break;
                }
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
                case 'manualPunch':                                   
                    items = this.model.getManualPunchEmployees();      
                    break;           
                case "staffList": {
                    const data = this.view._currentStaffSummaryData;
                    if (data && data.isDashboard) {
                        items = data.emps.map(emp => ({ log: null, emp, date: null }));
                    } else {
                        items = this.model.getStaffEmployees();
                    }
                    break;
                }
                case "workerList": {
                    const data = this.view._currentWorkerSummaryData;
                    if (data && data.isDashboard) {
                        items = data.emps.map(emp => ({ log: null, emp, date: null }));
                    } else {
                        items = this.model.getWorkerEmployees();
                    }
                    break;
                }
                case "unassignedList": {
                    items = this.model.getUnassignedEmployees();
                    break;
                }
                case 'weeklyOffPresent':
                    items = this.model.getWeeklyOffPresentEmployees();
                    break;
                case 'weeklyOffHalfPresent':
                    items = this.model.getWeeklyOffHalfPresentEmployees();
                    break;
            }
            this.view._renderStatCardDrilldown(key, items);
        });

        // Initial fetch
        this.init();
    }

    async init() {
        this.view.showOverlay('Loading dashboard...');

        await this.model.fetchFilterOptions();

        if (window.HRMS_USER && window.HRMS_USER.isMaster) {
            await this.model.fetchSubAdmins();
        }

        const [result] = await Promise.all([
            this.model.fetchData(),
            this.model.fetchDashboardData()
        ]);

        if (!result.success) {
            alert('Error loading data: ' + result.error);
        }

        this.view.hideOverlay();
    }
}

window.AttendanceController = AttendanceController;
