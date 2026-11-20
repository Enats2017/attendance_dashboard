(function () {
    if (typeof AttendanceView === "undefined") {
        console.error("Department Group Mapping view must be loaded after js/view.js");
        return;
    }

    Object.assign(AttendanceView.prototype, {
        _renderDeptGroupMappingPage() {
            return { html: `
                        <div class="designation-order-container">
                            <h2 class="section-title"><i class="ph-fill ph-squares-four"></i> Department Group Mapping</h2>
                            <div id="dept-group-mapping-content">
                                <div style="display:flex; align-items:center; gap:12px; padding:32px; color:#64748b;">
                                    <div class="auth-spinner" style="width:24px; height:24px; border-width:2px; border-top-color:#6366f1;"></div>
                                    <span>Loading department groups...</span>
                                </div>
                            </div>
                        </div>
                    ` };
        },
    _dgmOwnUserId() {
        const user = window.HRMS_USER || {};
        return Number(user.id || user.userId || 0);
    },

    async _initDeptGroupMappingTab(model) {
        const contentEl = document.getElementById("dept-group-mapping-content");
        if (!contentEl) return;

        this._dgmModel = model;
        const isMaster = !!(window.HRMS_USER && window.HRMS_USER.isMaster);
        const ownId = this._dgmOwnUserId();

        let subAdminList = [];
        if (isMaster) {
            await model.fetchSubAdmins();
            subAdminList = (model.state.subAdminList || []).filter((user) => Number(user.id) !== ownId);
        }

        if (!document.body.contains(contentEl)) return;

        const previousState = this._dgmState || {};
        this._dgmState = {
            isMaster,
            subAdminList,
            targetUserId: isMaster ? (previousState.targetUserId || ownId) : null,
            groups: [],
            page: 1,
            pageSize: 10,
        };
        const state = this._dgmState;

        contentEl.innerHTML = `
            <div style="background:#fff; border-radius:14px; border:1px solid #e5e7eb; box-shadow:0 4px 12px rgba(0,0,0,.06); overflow:hidden;">
                <div style="padding:22px 25px; border-bottom:1px solid #e5e7eb; display:flex; justify-content:space-between; align-items:center; gap:16px; flex-wrap:wrap;">
                    <div>
                        <h2 style="margin:0; font-size:24px; font-weight:700; color:#111827;">Department Group Mapping</h2>
                        <p style="margin:6px 0 0; color:#6b7280; font-size:14px;">Create groups (e.g. Group A, Group B) and assign departments to them.</p>
                    </div>
                    <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                        ${isMaster ? `
                            <div style="display:flex; align-items:center; gap:10px;">
                                <label for="dgm-user-selector" style="font-size:14px; font-weight:600; color:#374151;">Manage For:</label>
                                <select id="dgm-user-selector" style="min-width:220px; padding:10px 14px; border:1px solid #d1d5db; border-radius:8px; font-size:14px; background:#fff; outline:none;">
                                    <option value="${ownId}">My Own Mapping</option>
                                    ${subAdminList.map((user) => `<option value="${Number(user.id)}">${this._escapeAttr(user.name || "Sub Admin")}</option>`).join("")}
                                </select>
                            </div>
                        ` : ""}
                        <button id="dgm-create-btn" style="background:#4f46e5; color:#fff; border:none; border-radius:8px; padding:10px 18px; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:6px;">
                            <i class="ph-bold ph-plus"></i> Create Group
                        </button>
                    </div>
                </div>

                <div style="overflow:auto;">
                    <table style="width:100%; border-collapse:collapse;">
                        <thead>
                            <tr style="background:#f8fafc; border-bottom:1px solid #e5e7eb;">
                                <th style="padding:16px; text-align:left; font-size:14px; font-weight:700; color:#374151; width:70px;">#</th>
                                <th style="padding:16px; text-align:left; font-size:14px; font-weight:700; color:#374151;">Group Name</th>
                                <th style="padding:16px; text-align:center; font-size:14px; font-weight:700; color:#374151;">Status</th>
                                <th style="padding:16px; text-align:center; font-size:14px; font-weight:700; color:#374151;">Departments</th>
                                <th style="padding:16px; text-align:center; font-size:14px; font-weight:700; color:#374151; width:200px;">Action</th>
                            </tr>
                        </thead>
                        <tbody id="dgm-table-body"></tbody>
                    </table>
                </div>
                <div id="dgm-pagination" class="pagination-bar"></div>
            </div>
        `;

        if (isMaster) {
            const selector = document.getElementById("dgm-user-selector");
            selector.value = String(state.targetUserId);
            selector.addEventListener("change", async (event) => {
                state.targetUserId = Number(event.target.value) || ownId;
                state.page = 1;
                await this._loadDeptGroups();
            });
        }

        document.getElementById("dgm-create-btn").addEventListener("click", () => this._openDeptGroupModal(0));

        await this._loadDeptGroups();
    },

    async _loadDeptGroups() {
        const state = this._dgmState;
        if (!state) return;

        const body = document.getElementById("dgm-table-body");
        if (body) {
            body.innerHTML = `<tr><td colspan="5" style="padding:30px; text-align:center; color:#64748b;">Loading...</td></tr>`;
        }

        const result = await this._dgmModel.fetchDepartmentGroups(state.targetUserId);
        const tableBody = document.getElementById("dgm-table-body");
        if (!tableBody) return;

        if (!result || !result.success) {
            state.groups = [];
            tableBody.innerHTML = `
                <tr><td colspan="5" style="padding:30px; text-align:center; color:#dc2626; font-weight:600;">
                    ${this._escapeAttr((result && (result.message || result.error)) || "Failed to load department groups")}
                </td></tr>`;
            return;
        }

        state.groups = (result.data || []).map((group) => ({
            id: Number(group.GroupId),
            name: group.GroupName || "",
            sortOrder: Number(group.SortOrder) || 0,
            status: Number(group.Status) === 1 ? 1 : 0,
            deptCount: Number(group.DepartmentCount) || 0,
        }));
        this._renderDeptGroupTable();
    },

    _renderDeptGroupTable() {
        const state = this._dgmState;
        const body = document.getElementById("dgm-table-body");
        if (!state || !body) return;

        const filtered = state.groups;
        const totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
        state.page = Math.min(Math.max(1, state.page), totalPages);
        const start = (state.page - 1) * state.pageSize;
        const pageGroups = filtered.slice(start, start + state.pageSize);

        body.innerHTML = pageGroups.length ? pageGroups.map((group, index) => `
            <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:16px; color:#64748b;">${start + index + 1}</td>
                <td style="padding:16px; font-size:15px; font-weight:600; color:#1f2937;">
                    <i class="ph ph-squares-four" style="color:#6366f1; margin-right:8px;"></i>${this._escapeAttr(group.name)}
                </td>
                <td style="padding:16px; text-align:center;">
                    <span style="display:inline-flex; justify-content:center; align-items:center; min-width:76px; padding:7px 12px; border-radius:999px; background:${group.status ? "#dcfce7" : "#f1f5f9"}; color:${group.status ? "#166534" : "#64748b"}; font-weight:700;">${group.status ? "Active" : "Inactive"}</span>
                </td>
                <td style="padding:16px; text-align:center;">
                    <span style="display:inline-flex; justify-content:center; align-items:center; min-width:38px; height:38px; padding:0 12px; border-radius:999px; background:#eef2ff; color:#4338ca; font-weight:700;">${group.deptCount}</span>
                </td>
                <td style="padding:16px; text-align:center;">
                    ${group.status ? `<button onclick="AppController.view._openDeptGroupModal(${group.id})" style="background:#4f46e5; color:#fff; border:none; border-radius:8px; padding:8px 16px; cursor:pointer; margin-right:6px;">Edit</button>` : ""}
                    <button onclick="AppController.view._setDeptGroupStatus(${group.id}, ${group.status ? 0 : 1})" style="background:${group.status ? "#fff" : "#16a34a"}; color:${group.status ? "#dc2626" : "#fff"}; border:1px solid ${group.status ? "#fecaca" : "#16a34a"}; border-radius:8px; padding:8px 14px; cursor:pointer;">${group.status ? "Deactivate" : "Activate"}</button>
                </td>
            </tr>
        `).join("") : `
            <tr><td colspan="5" style="padding:30px; text-align:center; color:#6b7280;">
                No department groups yet. Click &quot;Create Group&quot; to add one.
            </td></tr>`;

        const pagination = document.getElementById("dgm-pagination");
        if (pagination) {
            let pageButtons = "";
            for (let page = Math.max(1, state.page - 2); page <= Math.min(totalPages, state.page + 2); page++) {
                pageButtons += `<button class="btn-page ${page === state.page ? "btn-page-active" : ""}" onclick="AppController.view._dgmGoToPage(${page})">${page}</button>`;
            }
            pagination.innerHTML = `
                <div class="pagination-text">
                    Showing ${filtered.length ? start + 1 : 0}–${Math.min(start + state.pageSize, filtered.length)} of ${filtered.length} groups &nbsp;·&nbsp; Page ${state.page} of ${totalPages}
                </div>
                <div class="pagination-buttons">
                    <button class="btn-page" ${state.page === 1 ? "disabled" : ""} onclick="AppController.view._dgmGoToPage(${state.page - 1})">‹</button>
                    ${pageButtons}
                    <button class="btn-page" ${state.page === totalPages ? "disabled" : ""} onclick="AppController.view._dgmGoToPage(${state.page + 1})">›</button>
                </div>
            `;
        }
    },

    _dgmGoToPage(page) {
        if (!this._dgmState) return;
        this._dgmState.page = page;
        this._renderDeptGroupTable();
    },

    async _openDeptGroupModal(groupId = 0) {
        const state = this._dgmState;
        if (!state) return;

        groupId = Number(groupId) || 0;
        const group = groupId ? state.groups.find((item) => item.id === groupId) : null;
        if (groupId && !group) return;

        this.showOverlay(groupId ? "Loading group..." : "Loading departments...");
        const result = await this._dgmModel.fetchGroupDepartments(groupId, state.targetUserId);
        this.hideOverlay();

        if (!result || !result.success) {
            this.showToast((result && (result.message || result.error)) || "Failed to load departments", "error");
            return;
        }

        const departments = result.data || [];
        const escape = (value) => this._escapeAttr(value ?? "");

        let overlay = document.getElementById("dgm-modal-overlay");
        if (!overlay) {
            overlay = document.createElement("div");
            overlay.id = "dgm-modal-overlay";
            overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;";
            document.body.appendChild(overlay);
        }

        const itemsHtml = departments.map((department) => {
            const checked = Number(department.IsAssigned) === 1;
            const assignedElsewhere = Number(department.IsAssignedToOtherGroup) === 1;
            return `
                <label class="dgm-dept-item" data-name="${escape(String(department.DepartmentFName || "").toLowerCase())}"
                    style="display:flex; align-items:center; gap:10px; padding:10px 12px; border:1px solid ${checked ? "#4f46e5" : "#dbe4f0"}; background:${checked ? "#eef2ff" : "#fff"}; border-radius:10px; cursor:${assignedElsewhere ? "not-allowed" : "pointer"}; font-size:14px; opacity:${assignedElsewhere ? ".65" : "1"};">
                    <input type="checkbox" class="dgm-dept-cb" value="${Number(department.DepartmentId)}" ${checked ? "checked" : ""} ${assignedElsewhere ? "disabled" : ""}>
                    <span>${escape(department.DepartmentFName)}${assignedElsewhere ? ` <small style="display:block;color:#b45309;font-weight:600;">Already assigned to: ${escape(department.AssignedGroupName || "another group")}</small>` : ""}</span>
                </label>
            `;
        }).join("");

        overlay.innerHTML = `
            <div style="background:#fff; border-radius:12px; width:760px; max-width:95%; max-height:90vh; padding:24px; box-shadow:0 10px 25px rgba(0,0,0,0.2); display:flex; flex-direction:column;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px;">
                    <h3 style="margin:0; font-size:18px; font-weight:700;">${group ? "Edit Department Group" : "Create Department Group"}</h3>
                    <button id="dgm-modal-x" style="background:none; border:none; font-size:24px; cursor:pointer; color:#64748b;">&times;</button>
                </div>

                <div style="margin-bottom:16px;">
                    <label style="display:block; font-size:13px; font-weight:600; color:#374151; margin-bottom:6px;">Group Name *</label>
                    <input id="dgm-group-name" type="text" maxlength="100" value="${escape(group ? group.name : "")}" placeholder="e.g. Group A"
                        style="width:100%; box-sizing:border-box; padding:10px 12px; border:1px solid #dbe4f0; border-radius:8px; font-size:14px; outline:none;">
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:10px; flex-wrap:wrap;">
                    <label style="font-size:13px; font-weight:600; color:#374151;">Departments <span id="dgm-selected-count" style="color:#4f46e5;"></span></label>
                    <div style="display:flex; gap:8px;">
                        <button id="dgm-select-all" type="button" style="padding:5px 10px; border:1px solid #cbd5e1; border-radius:6px; background:#fff; cursor:pointer; font-size:12px;">Select visible</button>
                        <button id="dgm-clear-all" type="button" style="padding:5px 10px; border:1px solid #cbd5e1; border-radius:6px; background:#fff; cursor:pointer; font-size:12px;">Clear visible</button>
                    </div>
                </div>

                <input id="dgm-dept-search" type="text" placeholder="Search departments..."
                    style="width:100%; box-sizing:border-box; padding:10px 12px; border:1px solid #dbe4f0; border-radius:8px; margin-bottom:12px; font-size:14px; outline:none;">

                <div id="dgm-dept-grid" style="display:grid; grid-template-columns:repeat(auto-fill,minmax(210px,1fr)); gap:10px; overflow-y:auto; flex:1; min-height:120px; max-height:340px; padding-right:4px;">
                    ${itemsHtml || `<div style="color:#94a3b8; padding:16px;">No active departments available for this user.</div>`}
                </div>
                <div id="dgm-no-results" style="display:none; color:#94a3b8; font-size:13px; padding:10px 0;">No matching departments.</div>

                <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:18px;">
                    <button id="dgm-cancel-btn" type="button" style="padding:10px 18px; border:1px solid #cbd5e1; border-radius:8px; background:#fff; cursor:pointer; font-weight:600;">Cancel</button>
                    <button id="dgm-save-btn" type="button" style="padding:10px 20px; border:none; border-radius:8px; background:#4f46e5; color:#fff; cursor:pointer; font-weight:600;">${group ? "Save Changes" : "Create Group"}</button>
                </div>
            </div>
        `;
        overlay.style.display = "flex";

        const grid = document.getElementById("dgm-dept-grid");
        const paintItem = (item) => {
            const checkbox = item.querySelector(".dgm-dept-cb");
            item.style.borderColor = checkbox.checked ? "#4f46e5" : "#dbe4f0";
            item.style.background = checkbox.checked ? "#eef2ff" : "#fff";
        };
        const updateCount = () => {
            const selectedCount = document.querySelectorAll("#dgm-modal-overlay .dgm-dept-cb:checked").length;
            document.getElementById("dgm-selected-count").textContent = selectedCount ? `(${selectedCount} selected)` : "";
        };

        grid.addEventListener("change", (event) => {
            const item = event.target.closest(".dgm-dept-item");
            if (item) paintItem(item);
            updateCount();
        });

        document.getElementById("dgm-dept-search").addEventListener("input", (event) => {
            const query = event.target.value.trim().toLowerCase();
            let visible = 0;
            grid.querySelectorAll(".dgm-dept-item").forEach((item) => {
                const show = (item.dataset.name || "").includes(query);
                item.style.display = show ? "flex" : "none";
                if (show) visible++;
            });
            document.getElementById("dgm-no-results").style.display = (visible === 0 && query && departments.length) ? "block" : "none";
        });

        const setVisible = (checked) => {
            grid.querySelectorAll(".dgm-dept-item").forEach((item) => {
                if (item.style.display === "none") return;
                const checkbox = item.querySelector(".dgm-dept-cb");
                if (checkbox.disabled) return;
                checkbox.checked = checked;
                paintItem(item);
            });
            updateCount();
        };
        document.getElementById("dgm-select-all").addEventListener("click", () => setVisible(true));
        document.getElementById("dgm-clear-all").addEventListener("click", () => setVisible(false));

        document.getElementById("dgm-modal-x").addEventListener("click", () => this._closeDeptGroupModal());
        document.getElementById("dgm-cancel-btn").addEventListener("click", () => this._closeDeptGroupModal());
        document.getElementById("dgm-save-btn").addEventListener("click", () => this._saveDeptGroupModal(groupId));
        overlay.onclick = (event) => {
            if (event.target === overlay) this._closeDeptGroupModal();
        };
        updateCount();
        document.getElementById("dgm-group-name").focus();
    },

    _closeDeptGroupModal() {
        const overlay = document.getElementById("dgm-modal-overlay");
        if (overlay) overlay.remove();
    },

    async _saveDeptGroupModal(groupId) {
        const state = this._dgmState;
        if (!state) return;

        const name = document.getElementById("dgm-group-name").value.trim();
        const existingGroup = state.groups.find((group) => group.id === groupId);
        const sortOrder = existingGroup
            ? existingGroup.sortOrder
            : state.groups.reduce((max, group) => Math.max(max, group.sortOrder), 0) + 1;

        if (!name) {
            this.showToast("Group name is required", "error");
            return;
        }
        const duplicate = state.groups.some((group) => group.id !== groupId && group.name.trim().toLowerCase() === name.toLowerCase());
        if (duplicate) {
            this.showToast("A group with this name already exists", "error");
            return;
        }

        const departmentIds = Array.from(
            document.querySelectorAll("#dgm-modal-overlay .dgm-dept-cb:checked")
        ).map((checkbox) => Number(checkbox.value));

        this.showOverlay("Saving group...");
        const result = await this._dgmModel.saveDepartmentGroup(groupId, name, sortOrder, departmentIds, state.targetUserId);
        this.hideOverlay();

        if (result && result.success) {
            this.showToast(groupId ? "Group updated successfully" : "Group created successfully", "success");
            this._closeDeptGroupModal();
            await this._loadDeptGroups();
        } else {
            const conflicts = result && Array.isArray(result.conflicts) ? result.conflicts : [];
            if (conflicts.length) {
                const details = conflicts
                    .map((conflict) => `${this._escapeAttr(conflict.departmentName || `Department ${conflict.departmentId}`)} — ${this._escapeAttr(conflict.groupName || "another group")}`)
                    .join("<br>");
                this.showToast(`Cannot save group. Already assigned:<br>${details}`, "error");
            } else {
                this.showToast((result && (result.message || result.error)) || "Failed to save group", "error");
            }
        }
    },

    async _setDeptGroupStatus(groupId, status) {
        const state = this._dgmState;
        if (!state) return;

        const group = state.groups.find((item) => item.id === Number(groupId));
        if (!group) return;
        const activate = Number(status) === 1;
        const action = activate ? "activate" : "deactivate";
        if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} group "${group.name}"?`)) return;

        this.showOverlay(`${activate ? "Activating" : "Deactivating"} group...`);
        const result = await this._dgmModel.setDepartmentGroupStatus(group.id, activate ? 1 : 0, state.targetUserId);
        this.hideOverlay();

        if (result && result.success) {
            this.showToast(`Group ${activate ? "activated" : "deactivated"} successfully`, "success");
            await this._loadDeptGroviups();
        } else {
            this.showToast((result && (result.message || result.error)) || `Failed to ${action} group`, "error");
        }
    }

    });
})();
