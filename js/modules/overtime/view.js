class OvertimeView {
    constructor() {
        this.model = new OvertimeModel();
    }

    async render(container, parentFilters) {
        if (!this.model._canViewOvertime()) {
            container.innerHTML = this._renderComingSoon();
            return;
        }

        container.innerHTML = `
            <div style="padding:40px; text-align:center; color:#64748b;">
                <i class="ph ph-spinner ph-spin" style="font-size:32px;"></i>
                <p>Loading Overtime Data...</p>
            </div>
        `;

        const result = await this.model.fetchData(parentFilters);

        if (!result.success) {
            container.innerHTML = `<div style="color:red; padding:20px;">Error: ${result.error || result.message}</div>`;
            return;
        }

        container.innerHTML = this._renderDashboard(this.model.state.data);
    }

    _renderComingSoon() {
        return `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:80px 20px; text-align:center;">
                <div style="background:#f1f5f9; width:80px; height:80px; border-radius:50%; display:flex; align-items:center; justify-content:center; margin-bottom:20px;">
                    <i class="ph ph-clock-user" style="font-size:40px; color:#64748b;"></i>
                </div>
                <h2 style="font-size:24px; font-weight:700; color:#1e293b; margin:0 0 8px;">Overtime Module</h2>
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
        if (!data || !data.summary) return '<p>No data found.</p>';
        
        // Placeholder for the real UI
        return `
            <div class="summary-grid">
                <div class="stat-card info">
                    <div class="stat-icon"><i class="ph ph-timer"></i></div>
                    <div class="stat-content">
                        <span class="stat-label">Total OT Hours</span>
                        <span class="stat-value">${data.summary.totalHours || 0}</span>
                    </div>
                </div>
                <div class="stat-card success">
                    <div class="stat-icon"><i class="ph ph-users"></i></div>
                    <div class="stat-content">
                        <span class="stat-label">Employees with OT</span>
                        <span class="stat-value">${data.summary.employeeCount || 0}</span>
                    </div>
                </div>
            </div>
            <p style="padding:20px; color:#64748b;">Overtime module is fully active. API returned data successfully.</p>
        `;
    }
}

window.OvertimeView = OvertimeView;