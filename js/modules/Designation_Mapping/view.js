(function () {
    if (typeof AttendanceView === "undefined") {
        console.error("Dept-Designation Mapping view must be loaded after js/view.js");
        return;
    }

    Object.assign(AttendanceView.prototype, {
        _renderDeptDesignationMapping() {
            return { html: `
                        <div class="designation-order-container">
                            <h2 class="section-title"><i class="ph-fill ph-map-trifold"></i> Department – Designation Mapping</h2>
                            <div id="dept-designation-mapping-content">
                                <div style="display:flex; align-items:center; gap:12px; padding:32px; color:#64748b;">
                                    <div class="auth-spinner" style="width:24px; height:24px; border-width:2px; border-top-color:#6366f1;"></div>
                                    <span>Loading mapping data...</span>
                                </div>
                            </div>
                        </div>
                    ` };
        },
    async _initDeptDesignationMappingTab(model, selectedUserId = null) {
        const contentEl = document.getElementById("dept-designation-mapping-content");
        if (!contentEl) return;
        
        this._ddmModel = model;
        const isMaster = !!model.state.isMaster;
        let targetUserId = null;
        let subAdminList = [];
        
        if (isMaster) {
            const subAdminRes = await model.fetchSubAdmins();
            if (subAdminRes && subAdminRes.success) {
                subAdminList = model.state.subAdminList || [];
            }

            targetUserId = selectedUserId !== null ? Number(selectedUserId) : Number((window.HRMS_USER || {}).id || 0);
        }

        const res = await model.fetchDepartmentDesignationMapping(targetUserId);

        if (!res || !res.success) {
            contentEl.innerHTML = `
                <div style="background:#fff1f2; color:#dc2626; padding:18px; border-radius:10px; border:1px solid #fecdd3; font-weight:600;">
                    Error loading mapping
                </div>
            `;
            return;
        }

        const { departments, designations, mappingByDept, targetUserId: resolvedTargetUserId } = res;
        const pageSize = 25;
        let currentPage = 1;
        let filteredDepartments = [...departments];
        let searchText = "";
        this._currentDeptDesigMappingData = { departments, designations, mappingByDept, targetUserId: resolvedTargetUserId };
        
        this._ddmSelectedUserId = resolvedTargetUserId;
        this._ddmSubAdminList = subAdminList;

        contentEl.innerHTML = `<div id="ddm-main-container"></div>`;

        const mainContainer = document.getElementById("ddm-main-container");

        const renderTable = () => {
            const start = (currentPage - 1) * pageSize;
            const end = start + pageSize;
            const pageDepartments = filteredDepartments.slice(start, end);

            mainContainer.innerHTML = `
                <div style="background:#ffffff; border-radius:14px; border:1px solid #e5e7eb; box-shadow:0 4px 12px rgba(0,0,0,.06); overflow:hidden;">
                    <div style="padding:22px 25px; border-bottom:1px solid #e5e7eb; display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <h2 style="margin:0; font-size:24px; font-weight:700; color:#111827;">Department Designation Mapping</h2>
                            <p style="margin:6px 0 0; color:#6b7280; font-size:14px;">Manage designation mapping department wise.</p>
                        </div>

                        ${
                            isMaster ? `
                                <div style="display:flex; align-items:center; gap:10px;">
                                    <label for="ddm-user-selector" style="font-size:14px; font-weight:600; color:#374151;">Manage For:</label>
                                    <select id="ddm-user-selector" style="min-width:240px; padding:10px 14px; border:1px solid #d1d5db; border-radius:8px; font-size:14px; background:#fff; outline:none;">
                                        <option value="${(window.HRMS_USER || {}).id || ""}">My Own Mapping</option>
                                        ${subAdminList.map(user => `
                                            <option value="${user.id}">
                                                ${this._escapeAttr(user.name || user.username || user.user_name || "Sub Admin")}
                                            </option>
                                        `).join("")}
                                    </select>
                                </div>
                            `
                            : ""
                        }

                    </div>

                    <div style="padding:20px; border-bottom:1px solid #e5e7eb;">
                        <input type="text" value="${searchText}" id="ddm-department-search" placeholder="Search Department..." style="width:320px; padding:10px 14px; border:1px solid #d1d5db; border-radius:8px; font-size:14px; outline:none;">
                    </div>

                    <div style="overflow:auto;">
                        <table style="width:100%; border-collapse:collapse;">
                            <thead>
                                <tr style="background:#f8fafc; border-bottom:1px solid #e5e7eb;">
                                    <th style="padding:16px; text-align:left; font-size:14px; font-weight:700; color:#374151;">Department</th>
                                    <th style="padding:16px; text-align:center; font-size:14px; font-weight:700; color:#374151;">Assigned</th>
                                    <th style="padding:16px; text-align:center; font-size:14px; font-weight:700; color:#374151; width:150px;">Action</th>
                                </tr>
                            </thead>

                            <tbody>
                                ${
                                    pageDepartments.length > 0 ? pageDepartments.map(dept => {
                                        const assigned = mappingByDept[dept.id] || [];
                                        return `
                                            <tr class="ddm-row" style="border-bottom:1px solid #f1f5f9;">
                                                <td class="ddm-department-name" style="padding:18px 16px;font-size:15px;font-weight:600;color:#1f2937;">${this._escapeAttr(dept.name)}</td>
                                                <td style="text-align:center;padding:18px;">
                                                    <span style="display:inline-flex;justify-content:center;align-items:center;min-width:38px;height:38px;padding:0 12px;border-radius:999px;background:#eef2ff;color:#4338ca;font-weight:700;">
                                                        ${assigned.length}
                                                    </span>
                                                </td>
                                                <td style="text-align:center;padding:18px;">
                                                    <button class="ddm-edit-btn" data-id="${dept.id}" style="background:#4f46e5;color:#fff;border:none;border-radius:8px;padding:9px 18px;cursor:pointer;">
                                                        Edit
                                                    </button>
                                                </td>
                                            </tr>
                                        `;
                                    }).join("") : `
                                        <tr>
                                            <td colspan="3" style="padding:30px;text-align:center;color:#6b7280;">No departments found.</td>
                                        </tr>
                                    `
                                }
                            </tbody>
                        </table>

                        <div style="display:flex; justify-content:center; align-items:center; gap:12px; padding:20px;">
                            <button id="prev-page" ${currentPage === 1 ? "disabled" : ""} style="padding:8px 16px; cursor:pointer;">
                                Previous
                            </button>

                            <span>
                                Page ${currentPage} of ${Math.ceil(filteredDepartments.length / pageSize)}
                            </span>

                            <button id="next-page" ${currentPage === Math.ceil(filteredDepartments.length / pageSize) ? "disabled" : ""} style="padding:8px 16px; cursor:pointer;">
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            `;

            mainContainer.querySelectorAll(".ddm-edit-btn").forEach(btn => {
                btn.onclick = () => {
                    const deptId = Number(btn.dataset.id);
                    this._renderDeptDesigMappingCheckboxes(deptId);
                };
            });

            if (isMaster) {
                const userSelector = document.getElementById("ddm-user-selector");
                if (userSelector) {
                    userSelector.value = String(this._ddmSelectedUserId || (window.HRMS_USER || {}).id ||"");
                    userSelector.addEventListener("change", async (e) => {
                        const selectedUserId = e.target.value ? Number(e.target.value) : null;
                        this._ddmSelectedUserId = selectedUserId;
                        await this._initDeptDesignationMappingTab(model, selectedUserId);
                    });
                }
            }

            const deptSearch = document.getElementById("ddm-department-search");

            if (deptSearch) {
                deptSearch.focus();
                deptSearch.setSelectionRange(searchText.length, searchText.length);
                deptSearch.addEventListener("input", (e) => {
                    searchText = e.target.value.toLowerCase().trim();
                    filteredDepartments = departments.filter(dept => dept.name .toLowerCase() .includes(searchText));
                    currentPage = 1;
                    renderTable();
                });
            }

            document.getElementById("prev-page")?.addEventListener("click", () => {
                if (currentPage > 1) {
                    currentPage--;
                    renderTable();
                }
            });

            document.getElementById("next-page")?.addEventListener("click", () => {
                if (currentPage < Math.ceil(filteredDepartments.length / pageSize)) {
                    currentPage++;
                    renderTable();
                }
            });
        };

        renderTable();
    },

    _renderDeptDesigMappingCheckboxes(deptId) {
        const data = this._currentDeptDesigMappingData;
        if (!data) return;
        const { departments, designations, mappingByDept, targetUserId } = data;
        const department = departments.find(d => Number(d.id) === Number(deptId));
        if (!department) return;

        const existing = mappingByDept[deptId] || [];
        const existingMap = {};

        existing.forEach(m => {
            existingMap[Number(m.designationId)] = {
                assigned: true,
                parentDesignationId: m.parentDesignationId !== null && m.parentDesignationId !== undefined ? Number(m.parentDesignationId) : null
            };
        });

        const parentSelections = {};
        Object.keys(existingMap).forEach(designationId => {
            parentSelections[Number(designationId)] = existingMap[designationId].parentDesignationId;
        });

        const rowsHtml = designations.map(d => {
            const checked = Object.prototype.hasOwnProperty.call(existingMap, Number(d.id));
            return `
                <label style="display:flex; align-items:center; gap:10px; padding:14px 16px; border:1px solid ${checked ? "#4f46e5" : "#dbe4f0"}; background:${checked ? "#eef2ff" : "#fff"}; border-radius:10px; cursor:pointer; transition:.2s; font-size:14px; font-weight:500;" class="ddm-item">
                    <input type="checkbox" class="ddm-checkbox" value="${d.id}" ${checked ? "checked" : ""}>
                    <span>${this._escapeAttr(d.name)}</span>
                </label>
            `;
        }).join("");

        const mainContainer = document.getElementById("ddm-main-container");

        const renderParentChildMapping = () => {
            const container = document.getElementById("ddm-parent-child-container");
            if (!container) return;
            const checkedIds = Array.from(mainContainer.querySelectorAll(".ddm-checkbox:checked")).map(cb => Number(cb.value));
            const assignedDesignations = designations.filter(d => checkedIds.includes(Number(d.id)));

            if (assignedDesignations.length === 0) {
                container.innerHTML = `
                    <div style="padding:20px; text-align:center; color:#64748b; font-size:14px;">
                        No designations assigned.
                    </div>
                `;
                return;
            }

            container.innerHTML = assignedDesignations.map(d => {
                const designationId = Number(d.id);
                const selectedParentId = parentSelections[designationId] ?? null;
                const parentOptions = assignedDesignations.filter(parent => Number(parent.id) !== designationId).map(parent => {
                    const parentId = Number(parent.id);
                    return `
                        <option value="${parentId}" ${ Number(selectedParentId) === parentId ? "selected" : "" }>
                            ${this._escapeAttr(parent.name)}
                        </option>
                    `;
                }).join("");

                return `
                    <div class="ddm-parent-child-row" data-designation-id="${designationId}" style="display:grid; grid-template-columns:1fr 1fr; gap:20px; align-items:center; padding:12px 14px; border-bottom:1px solid #e5e7eb;">
                        <div style="font-size:14px; font-weight:600; color:#1f2937;">
                            ${this._escapeAttr(d.name)}
                        </div>

                        <select class="ddm-parent-select" data-designation-id="${designationId}"style=" width:100%; padding:9px 12px; border:1px solid #dbe4f0; border-radius:8px; background:#fff; font-size:14px;">
                            <option value="">
                                -- None --
                            </option>
                            ${parentOptions}
                        </select>
                    </div>
                `;
            }).join("");

            container.querySelectorAll(".ddm-parent-select").forEach(select => {
                select.addEventListener("change", () => {
                    const designationId = Number(select.dataset.designationId);
                    parentSelections[designationId] = select.value !== "" ? Number(select.value) : null;
                });
            });
        };

        mainContainer.innerHTML = `
            <button id="ddm-back-btn" style="border:none; background:#fff; border:1px solid #dbe4f0; padding:10px 18px; border-radius:8px; cursor:pointer; margin-bottom:20px; font-weight:600;">
                ← Back
            </button>

            <div style="background:#fff; border:1px solid #e5e7eb; border-radius:14px; padding:24px; box-shadow:0 4px 12px rgba(0,0,0,.05);">
                <!-- Header -->
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <div>
                        <h2 style="margin:0; font-size:26px;">${this._escapeAttr(department.name)}</h2>
                        <div style="margin-top:6px; color:#64748b;">
                            <span id="ddm-assigned-count">${existing.length}</span>
                            designation${existing.length != 1 ? "s" : ""}
                            assigned
                        </div>
                    </div>

                    <button id="ddm-save-btn" style="background:#4f46e5; color:#fff; border:none; padding:10px 18px; border-radius:8px; cursor:pointer; font-weight:600;">
                        Save Changes
                    </button>

                </div>

                <!-- Existing assigned designation chips -->
                <div style="display:flex; flex-wrap:wrap; gap:10px; margin-bottom:24px;">
                    ${
                        existing.map(m => {
                            const des = designations.find(d => Number(d.id) === Number(m.designationId));
                            if (!des) return "";
                            return `
                                <div style="display:flex; align-items:center; gap:8px; background:#eef2ff; color:#4f46e5; padding:8px 14px; border-radius:20px; font-size:13px; font-weight:600;">
                                    <span>${this._escapeAttr(des.name)}</span>
                                    <button class="ddm-remove-chip" data-dept="${deptId}" data-designation="${des.id}" style="border:none; background:transparent; color:#ef4444; cursor:pointer; font-size:16px; font-weight:bold; line-height:1;">
                                        ×
                                    </button>
                                </div>
                            `;
                        }).join("")
                    }
                </div>

                <!-- Parent Child Mapping -->
                <div style="border:1px solid #e5e7eb; border-radius:10px; overflow:hidden; margin-bottom:20px;">
                    <div style="padding:14px 16px; background:#f8fafc; border-bottom:1px solid #e5e7eb;">
                        <div style="font-size:16px; font-weight:700; color:#111827;">
                            Parent-Child Designation Mapping
                        </div>
                        <div style="margin-top:4px; font-size:13px; color:#64748b;">
                            Select a parent designation for each assigned designation.
                        </div>
                    </div>

                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; padding:12px 14px; background:#f8fafc; border-bottom:1px solid #e5e7eb; font-size:13px; font-weight:700; color:#475569;">
                        <div>Designation</div>
                        <div>Parent Designation</div>
                    </div>
                    <div id="ddm-parent-child-container"></div>
                </div>

                <!-- Search -->
                <input id="ddm-search" placeholder="Search Designation..." style="width:100%; padding:12px 14px; border:1px solid #dbe4f0; border-radius:8px; margin-bottom:20px; box-sizing:border-box;">

                <!-- Designation checkbox grid -->
                <div style="display:grid; grid-template-columns: repeat(auto-fill,minmax(230px,1fr)); gap:14px;">
                    ${rowsHtml}
                </div>
            </div>
        `;

        renderParentChildMapping();

        mainContainer.querySelectorAll(".ddm-remove-chip").forEach(btn => {
            btn.onclick = async () => {
                this.showOverlay("Removing...");
                const res = await this._ddmModel.deleteDepartmentDesignationMapping(Number(btn.dataset.dept), Number(btn.dataset.designation), targetUserId);
                this.hideOverlay();
                if (res.success) {
                    this.showToast("Designation removed successfully", "success");
                    const dept = Number(btn.dataset.dept);
                    const desig = Number(btn.dataset.designation);
                    this._currentDeptDesigMappingData.mappingByDept[dept] = (this._currentDeptDesigMappingData.mappingByDept[dept] || []).filter(x => Number(x.designationId) !== desig);
                    await this._refreshDepartmentDesignationMapping(dept);
                } else {
                    this.showToast(res.message,"error");
                }
            };
        });

        mainContainer.querySelectorAll(".ddm-checkbox").forEach(cb => {
            cb.addEventListener("change", () => {
                const designationId = Number(cb.value);
                if (cb.checked) {
                    if (!Object.prototype.hasOwnProperty.call(parentSelections,designationId)) {
                        parentSelections[designationId] = null;
                    }
                } else {
                    delete parentSelections[designationId];
                }
                renderParentChildMapping();
            });
        });

        document.getElementById("ddm-search").addEventListener("input", function () {
            const value = this.value.toLowerCase();
            mainContainer.querySelectorAll(".ddm-item").forEach(item => {
                item.style.display = item.innerText.toLowerCase().includes(value) ? "flex" : "none";
            });
        });

        document.getElementById("ddm-back-btn").onclick = () => {this._initDeptDesignationMappingTab(this._ddmModel, this._currentDeptDesigMappingData?.targetUserId ?? null);};

        document.getElementById("ddm-save-btn").onclick = async () => {
            const items = [];
            mainContainer.querySelectorAll(".ddm-item").forEach(row => {
                    const cb = row.querySelector(".ddm-checkbox");
                    const designationId = Number(cb.value);
                    const parentDesignationId = cb.checked ? (parentSelections[designationId] ?? null) : null;
                    items.push({
                        departmentId: Number(deptId),
                        designationId: designationId,
                        parentDesignationId: parentDesignationId,
                        isActive: cb.checked
                    })
                });

            const invalidSelfParent = items.find(item => item.parentDesignationId !== null &&Number(item.parentDesignationId) === Number(item.designationId));
            if (invalidSelfParent) {
                this.showToast("A designation cannot be its own parent.", "error");
                return;
            }

            this.showOverlay("Saving mapping...");

            const saveRes = await this._ddmModel.saveDepartmentDesignationMapping(items, targetUserId);

            this.hideOverlay();

            if (saveRes.success) {
                this.showToast("Mapping saved successfully", "success");
                await this._refreshDepartmentDesignationMapping(deptId);
            } else {
                this.showToast(saveRes.message, "error");
            }
        };
    },


    async _refreshDepartmentDesignationMapping(deptId) {
        const targetUserId = this._currentDeptDesigMappingData?.targetUserId ?? null;
        const res = await this._ddmModel.fetchDepartmentDesignationMapping(targetUserId);

        if (!res || !res.success) {
            console.error("Failed to refresh Department-Designation mapping", res);
            return;
        }

        console.log("Refreshed mapping:", res.mappingByDept?.[deptId]);

        this._currentDeptDesigMappingData = {
            departments: res.departments,
            designations: res.designations,
            mappingByDept: res.mappingByDept,
            targetUserId: res.targetUserId
        };

        this._renderDeptDesigMappingCheckboxes(deptId);
    }

    });
})();
