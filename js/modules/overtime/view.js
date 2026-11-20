class OvertimeView {
    constructor() {
        this.model = new OvertimeModel();
    }

    async render(container, parentFilters) {
        if (!container) {
            return;
        }

        if (!this.model.canView()) {
            container.innerHTML = this._renderComingSoon();
            return;
        }

        container.innerHTML = this._renderLoading();

        const result = await this.model.fetchData(parentFilters);

        if (!result.success) {
            container.innerHTML = this._renderError(result.message || 'Unable to load overtime data.');
            return;
        }

        container.innerHTML = this._renderDashboard(this.model.getData());
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
        const safe = this._escapeHtml(message || 'Unknown error');
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
        if (!data) {
            return this._renderEmpty('No overtime data available.');
        }

        const summary = data.summary || { overtimeRecords: 0, employeeCount: 0 };
        const records = Array.isArray(data.records) ? data.records : [];

        return `
            ${this._renderSummaryCards(summary)}
            ${records.length > 0 ? this._renderRecordsTable(records) : this._renderEmpty('No overtime records for the selected period.')}
            ${this._renderFooterMeta(data)}
        `;
    }

    _renderSummaryCards(summary) {
        return `
            <div class="summary-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:16px; margin-bottom:20px;">
                <div class="stat-card info" style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px; padding:16px; display:flex; gap:12px; align-items:center;">
                    <div class="stat-icon" style="background:#3b82f6; color:#fff; width:44px; height:44px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:22px;">
                        <i class="ph ph-timer"></i>
                    </div>
                    <div class="stat-content">
                        <div class="stat-label" style="font-size:12px; color:#1e3a8a; text-transform:uppercase; letter-spacing:.04em;">OT Records</div>
                        <div class="stat-value" style="font-size:24px; font-weight:700; color:#1e3a8a;">${Number(summary.overtimeRecords || 0)}</div>
                    </div>
                </div>
                <div class="stat-card success" style="background:#ecfdf5; border:1px solid #a7f3d0; border-radius:10px; padding:16px; display:flex; gap:12px; align-items:center;">
                    <div class="stat-icon" style="background:#10b981; color:#fff; width:44px; height:44px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:22px;">
                        <i class="ph ph-users"></i>
                    </div>
                    <div class="stat-content">
                        <div class="stat-label" style="font-size:12px; color:#065f46; text-transform:uppercase; letter-spacing:.04em;">Employees with OT</div>
                        <div class="stat-value" style="font-size:24px; font-weight:700; color:#065f46;">${Number(summary.employeeCount || 0)}</div>
                    </div>
                </div>
            </div>
        `;
    }

    _renderRecordsTable(records) {
        const rows = records.map(r => `
            <tr>
                <td>${this._escapeHtml(r.employeeCode)}</td>
                <td>${this._escapeHtml(r.name)}</td>
                <td>${this._escapeHtml(r.company)}</td>
                <td>${this._escapeHtml(r.department)}</td>
                <td>${this._escapeHtml(r.designation)}</td>
                <td>${this._escapeHtml(r.shift)}</td>
                <td>${this._escapeHtml(r.attendanceDate)}</td>
                <td>${this._escapeHtml(r.inTime)}</td>
                <td>${this._escapeHtml(r.outTime)}</td>
            </tr>
        `).join('');

        return `
            <div style="overflow:auto; background:#fff; border:1px solid #e2e8f0; border-radius:10px;">
                <table style="width:100%; border-collapse:collapse; font-size:14px;">
                    <thead style="background:#f8fafc;">
                        <tr>
                            <th style="text-align:left; padding:12px; border-bottom:1px solid #e2e8f0;">Emp Code</th>
                            <th style="text-align:left; padding:12px; border-bottom:1px solid #e2e8f0;">Name</th>
                            <th style="text-align:left; padding:12px; border-bottom:1px solid #e2e8f0;">Company</th>
                            <th style="text-align:left; padding:12px; border-bottom:1px solid #e2e8f0;">Department</th>
                            <th style="text-align:left; padding:12px; border-bottom:1px solid #e2e8f0;">Designation</th>
                            <th style="text-align:left; padding:12px; border-bottom:1px solid #e2e8f0;">Shift</th>
                            <th style="text-align:left; padding:12px; border-bottom:1px solid #e2e8f0;">Attendance Date</th>
                            <th style="text-align:left; padding:12px; border-bottom:1px solid #e2e8f0;">In Time</th>
                            <th style="text-align:left; padding:12px; border-bottom:1px solid #e2e8f0;">Out Time</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        `;
    }

    _renderEmpty(message) {
        return `
            <div style="padding:40px; text-align:center; color:#64748b; background:#f8fafc; border:1px dashed #cbd5e1; border-radius:10px;">
                <i class="ph ph-info" style="font-size:28px;"></i>
                <p style="margin:8px 0 0;">${this._escapeHtml(message)}</p>
            </div>
        `;
    }

    _renderFooterMeta(data) {
        const generatedAt = data.generatedAt ? `Generated at ${this._escapeHtml(data.generatedAt)}` : '';
        const scope = data.scope ? `Scope: ${this._escapeHtml(data.scope)}` : '';
        const meta = [scope, generatedAt].filter(Boolean).join(' · ');
        if (!meta) return '';
        return `
            <p style="margin-top:12px; font-size:12px; color:#94a3b8; text-align:right;">${meta}</p>
        `;
    }

    _escapeHtml(v) {
        if (v === null || v === undefined) return '';
        return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
}

window.OvertimeView = OvertimeView;