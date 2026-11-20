(function () {
    if (typeof AttendanceView === "undefined") {
        console.error("Units List view must be loaded after js/view.js");
        return;
    }

    Object.assign(AttendanceView.prototype, {
        _renderUnitsList(model) {
            const units = model.state.subAdminList || [];

            if (units.length === 0) {
                return {
                    html: `
                        <h2 class="section-title"><i class="ph-fill ph-buildings"></i> Units List</h2>
                        <div style="display:flex; align-items:center; gap:12px; padding:32px; color:#64748b;">
                            <div class="auth-spinner" style="width:24px; height:24px; border-width:2px; border-top-color:#6366f1;"></div>
                            <span>Loading units...</span>
                        </div>
                    `,
                };
            }

            this._currentUnitsList = units;
            return { html: this._renderUnitsListTable(1) };
        },

        _renderUnitsListTable(page = 1) {
            const units = this._currentUnitsList || [];
            const pageSize = 10;
            const currentPage = page;
            const totalPages = Math.max(1, Math.ceil(units.length / pageSize));
            const pageUnits = units.slice((currentPage - 1) * pageSize, currentPage * pageSize);

            const rows = pageUnits.map((u, i) => {
                const sr = (currentPage - 1) * pageSize + i + 1;
                return `
                    <tr>
                        <td class="sr-col">${sr}</td>
                        <td>
                            <div style="font-weight:700;color:#1e293b;">${this._escapeAttr(u.name)}</div>
                            <div style="font-size:12px;color:#94a3b8;">${this._escapeAttr(u.email || "")}</div>
                        </td>
                        <td>${(u.locations || []).length}</td>
                        <td>${(u.companies || []).length}</td>
                        <td>${(u.departments || []).length}</td>
                        <td>
                            <button class="units-eye-btn" onclick="AppController.view._showUnitDetailsModal('${this._escapeAttr(u.name)}')" title="View details">
                                <i class="ph ph-eye"></i>
                            </button>
                        </td>
                    </tr>
                `;
            }).join("") || `<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:24px;">No subadmins found</td></tr>`;

            let pageButtons = "";
            const startP = Math.max(1, currentPage - 2);
            const endP = Math.min(totalPages, currentPage + 2);
            for (let i = startP; i <= endP; i++) {
                pageButtons += `<button class="btn-page ${i === currentPage ? "btn-page-active" : ""}" onclick="AppController.view._reRenderUnitsListPage(${i})">${i}</button>`;
            }

            return `
                <h2 class="section-title"><i class="ph-fill ph-buildings"></i> Units List</h2>
                <div class="table-wrap">
                    <div class="table-header"><h3>Subadmins Access Overview</h3></div>
                    <div style="overflow-x:auto;">
                        <table class="data-table" id="tbl-units-list">
                            <thead>
                                <tr>
                                    <th class="sr-col">#</th>
                                    <th>Subadmin</th>
                                    <th>Locations</th>
                                    <th>Companies</th>
                                    <th>Departments</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                    <div class="pagination-bar">
                        <div class="pagination-text">
                            Showing ${units.length ? (currentPage - 1) * pageSize + 1 : 0}–${Math.min(currentPage * pageSize, units.length)} of ${units.length} subadmins
                        </div>
                        <div class="pagination-buttons">
                            <button class="btn-page" ${currentPage === 1 ? "disabled" : ""} onclick="AppController.view._reRenderUnitsListPage(1)">«</button>
                            <button class="btn-page" ${currentPage === 1 ? "disabled" : ""} onclick="AppController.view._reRenderUnitsListPage(${currentPage - 1})">‹</button>
                            ${pageButtons}
                            <button class="btn-page" ${currentPage === totalPages ? "disabled" : ""} onclick="AppController.view._reRenderUnitsListPage(${currentPage + 1})">›</button>
                            <button class="btn-page" ${currentPage === totalPages ? "disabled" : ""} onclick="AppController.view._reRenderUnitsListPage(${totalPages})">»</button>
                        </div>
                    </div>
                </div>
            `;
        },

        _reRenderUnitsListPage(page) {
            const container = document.querySelector(".tab-pane-container");
            if (container) container.innerHTML = this._renderUnitsListTable(page);
        },

        _showUnitDetailsModal(name) {
            const unit = (this._currentUnitsList || []).find(u => u.name === name);
            if (!unit) return;

            let overlay = document.getElementById("unit-detail-overlay");
            if (!overlay) {
                overlay = document.createElement("div");
                overlay.id = "unit-detail-overlay";
                document.body.appendChild(overlay);
            }

            const listBlock = (title, icon, items) => `
                <div class="rd-section">
                    <div class="rd-section-title"><i class="ph ${icon}"></i> ${title} (${items.length})</div>
                    ${items.length
                        ? `<div class="unit-detail-grid">
                            ${items.map(it => `<div class="unit-detail-grid-item">${this._escapeAttr(it)}</div>`).join("")}
                        </div>`
                        : `<div style="color:#94a3b8;font-size:13px;">None assigned</div>`}
                </div>
            `;

            overlay.innerHTML = `
                <div class="rd-modal">
                    <div class="rd-header">
                        <div class="rd-title">Login name: ${this._escapeAttr(unit.name)}</div>
                        <button class="rd-close" onclick="AppController.view._closeUnitDetailsModal()"><i class="ph ph-x"></i></button>
                    </div>
                    <div class="rd-body">
                        ${listBlock("Locations", "ph-map-pin", unit.locations || [])}
                        ${listBlock("Companies", "ph-buildings", unit.companies || [])}
                        ${listBlock("Departments", "ph-briefcase", unit.departments || [])}
                    </div>
                </div>
            `;

            overlay.classList.add("active");
            overlay.onclick = (e) => { if (e.target === overlay) this._closeUnitDetailsModal(); };
        },

        _closeUnitDetailsModal() {
            const overlay = document.getElementById("unit-detail-overlay");
            if (overlay) overlay.classList.remove("active");
        },

        _bindUnitsListSelect() {
            const select = document.getElementById("units-list-select");
            if (!select) return;
            select.addEventListener("change", (e) => {
                const container = document.querySelector(".tab-pane-container");
                if (container) {
                    container.innerHTML = this._renderUnitsListTable(e.target.value);
                    this._bindUnitsListSelect();
                }
            });
        }
    });
})();