(function () {
    const styleId = "custom-location-groups-module-styles";

    if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = `
            #clg-modal-overlay {
                box-sizing: border-box;
                padding: 16px;
            }

            #clg-modal-overlay *,
            #clg-modal-overlay *::before,
            #clg-modal-overlay *::after {
                box-sizing: border-box;
            }

            #clg-modal-overlay input:focus {
                border-color: #6366f1 !important;
                outline: 2px solid rgba(99, 102, 241, 0.14);
                outline-offset: 1px;
            }

            #clg-modal-overlay button:focus-visible,
            #custom-location-groups-content button:focus-visible {
                outline: 2px solid #6366f1;
                outline-offset: 2px;
            }

            #clg-loc-grid {
                scrollbar-width: thin;
            }

            @media (max-width: 640px) {
                #clg-modal-overlay > div {
                    width: 100% !important;
                    max-width: 100% !important;
                    max-height: calc(100vh - 32px) !important;
                    padding: 16px !important;
                }

                #clg-loc-grid {
                    grid-template-columns: 1fr !important;
                }

                #clg-search {
                    width: 100% !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    if (typeof AttendanceView === "undefined") {
        console.error("js/modules/custom_location_groups/view.js must be loaded after js/view.js");
        return;
    }

    const methods = {
        async _initCustomLocationGroupsTab(model) {
            const contentEl = document.getElementById("custom-location-groups-content");
            if (!contentEl) return;

            this._clgModel = model;

            const locRes = typeof model.fetchActiveLocations === "function" ? await model.fetchActiveLocations() : await model.fetchLocationsOrder();

            if (!document.body.contains(contentEl)) return;

            if (!locRes || !locRes.success) {
                contentEl.innerHTML = `
                    <div style="padding:24px;background:rgba(244,63,94,0.05);border:1px solid rgba(244,63,94,0.2);color:#f43f5e;border-radius:10px;font-weight:500;">
                        Error loading locations: ${this._escapeAttr((locRes && (locRes.message || locRes.error)) || "Unknown error")}
                    </div>`;
                return;
            }

            const locations = (locRes.data || []).map((l) => ({
                id: Number(l.id ?? l.LocationId ?? l.location_id),
                name: String(l.name ?? l.LocationName ?? l.location_name ?? ""),
            })).filter((l) => l.id > 0 && l.name);

            const prev = this._clgState || {};
            this._clgState = {
                locations,
                groups: [],
                page: 1,
                pageSize: 10,
                search: prev.search || "",
            };
            const state = this._clgState;

            contentEl.innerHTML = `
                <div style="background:#fff;border-radius:14px;border:1px solid #e5e7eb;box-shadow:0 4px 12px rgba(0,0,0,.06);overflow:hidden;">
                    <div style="padding:22px 25px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;">
                        <div>
                            <h2 style="margin:0;font-size:24px;font-weight:700;color:#111827;">Custom Location Groups</h2>
                            <p style="margin:6px 0 0;color:#6b7280;font-size:14px;">Group locations together (e.g. North Zone, Plant Cluster A).</p>
                        </div>
                        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                            <input id="clg-search" type="text" value="${this._escapeAttr(state.search)}" placeholder="Search group or location..."
                                style="width:260px;padding:10px 14px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;outline:none;">
                            <button id="clg-create-btn" style="background:#4f46e5;color:#fff;border:none;border-radius:8px;padding:10px 18px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;">
                                <i class="ph-bold ph-plus"></i> Create Group
                            </button>
                        </div>
                    </div>

                    <div style="overflow:auto;">
                        <table style="width:100%;border-collapse:collapse;">
                            <thead>
                                <tr style="background:#f8fafc;border-bottom:1px solid #e5e7eb;">
                                    <th style="padding:16px;text-align:left;font-size:14px;font-weight:700;color:#374151;width:70px;">#</th>
                                    <th style="padding:16px;text-align:left;font-size:14px;font-weight:700;color:#374151;">Group Name</th>
                                    <th style="padding:16px;text-align:center;font-size:14px;font-weight:700;color:#374151;">Status</th>
                                    <th style="padding:16px;text-align:left;font-size:14px;font-weight:700;color:#374151;">Locations</th>
                                    <th style="padding:16px;text-align:center;font-size:14px;font-weight:700;color:#374151;width:220px;">Action</th>
                                </tr>
                            </thead>
                            <tbody id="clg-table-body"></tbody>
                        </table>
                    </div>
                    <div id="clg-pagination" class="pagination-bar"></div>
                </div>
            `;

            document.getElementById("clg-create-btn")
                .addEventListener("click", () => this._openCustomLocationGroupModal(0));

            document.getElementById("clg-search").addEventListener("input", (e) => {
                state.search = e.target.value;
                state.page = 1;
                this._renderCustomLocationGroupsTable();
            });

            await this._loadCustomLocationGroups();
        },

        async _loadCustomLocationGroups() {
            const state = this._clgState;
            if (!state) return;

            const body = document.getElementById("clg-table-body");
            if (body) {
                body.innerHTML = `<tr><td colspan="5" style="padding:30px;text-align:center;color:#64748b;">Loading...</td></tr>`;
            }

            const res = await this._clgModel.fetchCustomLocationGroups();
            const tableBody = document.getElementById("clg-table-body");
            if (!tableBody) return;

            if (!res || !res.success) {
                state.groups = [];
                tableBody.innerHTML = `
                    <tr><td colspan="5" style="padding:30px;text-align:center;color:#dc2626;font-weight:600;">
                        ${this._escapeAttr((res && (res.message || res.error)) || "Failed to load custom location groups")}
                    </td></tr>`;
                return;
            }

            state.groups = (res.data || []).map((g) => ({
                id: Number(g.GroupId),
                name: g.GroupName || "",
                status: Number(g.Status) === 1 ? 1 : 0,
                locationIds: (g.LocationIds || []).map(Number),
                locations: g.Locations || [],
            }));

            this._renderCustomLocationGroupsTable();
        },

        _renderCustomLocationGroupsTable() {
            const state = this._clgState;
            const body = document.getElementById("clg-table-body");
            if (!state || !body) return;

            const q = state.search.trim().toLowerCase();
            const filtered = q
                ? state.groups.filter((g) =>
                    g.name.toLowerCase().includes(q) ||
                    g.locations.some((l) => String(l.location_name || "").toLowerCase().includes(q)))
                : state.groups;

            const totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
            state.page = Math.min(Math.max(1, state.page), totalPages);
            const start = (state.page - 1) * state.pageSize;
            const pageGroups = filtered.slice(start, start + state.pageSize);

            const chip = (text) => `<span style="display:inline-block;padding:4px 10px;margin:2px 4px 2px 0;border-radius:999px;background:#eef2ff;color:#4338ca;font-size:12px;font-weight:600;">${this._escapeAttr(text)}</span>`;

            body.innerHTML = pageGroups.length ? pageGroups.map((g, i) => {
                const shown = g.locations.slice(0, 3).map((l) => chip(l.location_name)).join("");
                const more = g.locations.length > 3 ? chip(`+${g.locations.length - 3} more`) : "";

                return `
                    <tr style="border-bottom:1px solid #f1f5f9;">
                        <td style="padding:16px;color:#64748b;">${start + i + 1}</td>
                        <td style="padding:16px;font-size:15px;font-weight:600;color:#1f2937;">
                            <i class="ph ph-map-pinned" style="color:#6366f1;margin-right:8px;"></i>${this._escapeAttr(g.name)}
                        </td>
                        <td style="padding:16px;text-align:center;">
                            <span style="display:inline-flex;justify-content:center;align-items:center;min-width:76px;padding:7px 12px;border-radius:999px;background:${g.status ? "#dcfce7" : "#f1f5f9"};color:${g.status ? "#166534" : "#64748b"};font-weight:700;">${g.status ? "Active" : "Inactive"}</span>
                        </td>
                        <td style="padding:16px;">
                            <span style="display:inline-flex;justify-content:center;align-items:center;min-width:30px;height:30px;padding:0 10px;border-radius:999px;background:#4f46e5;color:#fff;font-weight:700;font-size:13px;margin-right:8px;">${g.locations.length}</span>
                            ${shown}${more}
                        </td>
                        <td style="padding:16px;text-align:center;white-space:nowrap;">
                            <button onclick="AppController.view._openCustomLocationGroupModal(${g.id})" style="background:#4f46e5;color:#fff;border:none;border-radius:8px;padding:8px 16px;cursor:pointer;margin-right:6px;">Edit</button>
                            <button onclick="AppController.view._setCustomLocationGroupStatus(${g.id}, ${g.status ? 0 : 1})" style="background:${g.status ? "#fff" : "#16a34a"};color:${g.status ? "#dc2626" : "#fff"};border:1px solid ${g.status ? "#fecaca" : "#16a34a"};border-radius:8px;padding:8px 14px;cursor:pointer;">${g.status ? "Deactivate" : "Activate"}</button>
                        </td>
                    </tr>
                `;
            }).join("") : `
                <tr><td colspan="5" style="padding:30px;text-align:center;color:#6b7280;">
                    No custom location groups found. Click &quot;Create Group&quot; to add one.
                </td></tr>`;

            const pagination = document.getElementById("clg-pagination");
            
            if (pagination) {
                let btns = "";
                for (let p = Math.max(1, state.page - 2); p <= Math.min(totalPages, state.page + 2); p++) {
                    btns += `<button class="btn-page ${p === state.page ? "btn-page-active" : ""}" onclick="AppController.view._clgGoToPage(${p})">${p}</button>`;
                }
                pagination.innerHTML = `
                    <div class="pagination-text">
                        Showing ${filtered.length ? start + 1 : 0}–${Math.min(start + state.pageSize, filtered.length)} of ${filtered.length} groups &nbsp;·&nbsp; Page ${state.page} of ${totalPages}
                    </div>
                    <div class="pagination-buttons">
                        <button class="btn-page" ${state.page === 1 ? "disabled" : ""} onclick="AppController.view._clgGoToPage(${state.page - 1})">‹</button>
                        ${btns}
                        <button class="btn-page" ${state.page === totalPages ? "disabled" : ""} onclick="AppController.view._clgGoToPage(${state.page + 1})">›</button>
                    </div>
                `;
            }
        },

        _clgGoToPage(page) {
            if (!this._clgState) {
                return;
            }
            
            this._clgState.page = page;
            this._renderCustomLocationGroupsTable();
        },

        _openCustomLocationGroupModal(groupId = 0) {
            const state = this._clgState;
            
            if (!state) {
                return;
            }

            groupId = Number(groupId) || 0;
            const group = groupId ? state.groups.find((g) => g.id === groupId) : null;

            if (groupId && !group) {
                return;
            }

            const esc = (v) => this._escapeAttr(v ?? "");
            const activeIds = new Set(state.locations.map((l) => l.id));
            const selected = new Set(group ? group.locationIds : []);
            const inactiveCount = group ? group.locationIds.filter((id) => !activeIds.has(id)).length : 0;

            let overlay = document.getElementById("clg-modal-overlay");
            
            if (!overlay) {
                overlay = document.createElement("div");
                overlay.id = "clg-modal-overlay";
                overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;";
                document.body.appendChild(overlay);
            }

            const itemsHtml = state.locations.map((l) => {
                const checked = selected.has(l.id);
                return `
                    <label class="clg-loc-item" data-name="${esc(l.name.toLowerCase())}"
                        style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid ${checked ? "#4f46e5" : "#dbe4f0"};background:${checked ? "#eef2ff" : "#fff"};border-radius:10px;cursor:pointer;font-size:14px;">
                        <input type="checkbox" class="clg-loc-cb" value="${l.id}" ${checked ? "checked" : ""}>
                        <span>${esc(l.name)}</span>
                    </label>
                `;
            }).join("");

            overlay.innerHTML = `
                <div style="background:#fff;border-radius:12px;width:760px;max-width:95%;max-height:90vh;padding:24px;box-shadow:0 10px 25px rgba(0,0,0,0.2);display:flex;flex-direction:column;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
                        <h3 style="margin:0;font-size:18px;font-weight:700;">${group ? "Edit Custom Location Group" : "Create Custom Location Group"}</h3>
                        <button id="clg-modal-x" style="background:none;border:none;font-size:24px;cursor:pointer;color:#64748b;">&times;</button>
                    </div>

                    <div style="margin-bottom:16px;">
                        <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px;">Group Name *</label>
                        <input id="clg-group-name" type="text" maxlength="100" value="${esc(group ? group.name : "")}" placeholder="e.g. North Zone"
                            style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #dbe4f0;border-radius:8px;font-size:14px;outline:none;">
                    </div>

                    ${inactiveCount ? `
                        <div style="margin-bottom:12px;padding:10px 12px;background:#fffbeb;border:1px solid #fde68a;color:#92400e;border-radius:8px;font-size:13px;font-weight:600;">
                            ${inactiveCount} location${inactiveCount > 1 ? "s" : ""} in this group ${inactiveCount > 1 ? "are" : "is"} no longer active and will be removed when you save.
                        </div>` : ""}

                    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap;">
                        <label style="font-size:13px;font-weight:600;color:#374151;">Locations * <span id="clg-selected-count" style="color:#4f46e5;"></span></label>
                        <div style="display:flex;gap:8px;">
                            <button id="clg-select-all" type="button" style="padding:5px 10px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;cursor:pointer;font-size:12px;">Select visible</button>
                            <button id="clg-clear-all" type="button" style="padding:5px 10px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;cursor:pointer;font-size:12px;">Clear visible</button>
                        </div>
                    </div>

                    <input id="clg-loc-search" type="text" placeholder="Search locations..."
                        style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #dbe4f0;border-radius:8px;margin-bottom:12px;font-size:14px;outline:none;">

                    <div id="clg-loc-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px;overflow-y:auto;flex:1;min-height:120px;max-height:340px;padding-right:4px;">
                        ${itemsHtml || `<div style="color:#94a3b8;padding:16px;">No active locations available.</div>`}
                    </div>
                    <div id="clg-no-results" style="display:none;color:#94a3b8;font-size:13px;padding:10px 0;">No matching locations.</div>

                    <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px;">
                        <button id="clg-cancel-btn" type="button" style="padding:10px 18px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;cursor:pointer;font-weight:600;">Cancel</button>
                        <button id="clg-save-btn" type="button" style="padding:10px 20px;border:none;border-radius:8px;background:#4f46e5;color:#fff;cursor:pointer;font-weight:600;">${group ? "Save Changes" : "Create Group"}</button>
                    </div>
                </div>
            `;

            overlay.style.display = "flex";

            const grid = document.getElementById("clg-loc-grid");

            const paint = (item) => {
                const cb = item.querySelector(".clg-loc-cb");
                item.style.borderColor = cb.checked ? "#4f46e5" : "#dbe4f0";
                item.style.background = cb.checked ? "#eef2ff" : "#fff";
            };

            const updateCount = () => {
                const n = document.querySelectorAll("#clg-modal-overlay .clg-loc-cb:checked").length;
                document.getElementById("clg-selected-count").textContent = n ? `(${n} selected)` : "";
            };

            grid.addEventListener("change", (e) => {
                const item = e.target.closest(".clg-loc-item");
                if (item) paint(item);
                updateCount();
            });

            document.getElementById("clg-loc-search").addEventListener("input", (e) => {
                const q = e.target.value.trim().toLowerCase();
                let visible = 0;
                grid.querySelectorAll(".clg-loc-item").forEach((item) => {
                    const show = (item.dataset.name || "").includes(q);
                    item.style.display = show ? "flex" : "none";
                    if (show) visible++;
                });
                document.getElementById("clg-no-results").style.display = (visible === 0 && q) ? "block" : "none";
            });

            const setVisible = (checked) => {
                grid.querySelectorAll(".clg-loc-item").forEach((item) => {
                    if (item.style.display === "none") return;
                    item.querySelector(".clg-loc-cb").checked = checked;
                    paint(item);
                });
                updateCount();
            };

            document.getElementById("clg-select-all").addEventListener("click", () => setVisible(true));
            document.getElementById("clg-clear-all").addEventListener("click", () => setVisible(false));

            document.getElementById("clg-modal-x").addEventListener("click", () => this._closeCustomLocationGroupModal());
            document.getElementById("clg-cancel-btn").addEventListener("click", () => this._closeCustomLocationGroupModal());
            document.getElementById("clg-save-btn").addEventListener("click", () => this._saveCustomLocationGroupModal(groupId));
            overlay.onclick = (e) => { if (e.target === overlay) this._closeCustomLocationGroupModal(); };

            updateCount();
            document.getElementById("clg-group-name").focus();
        },

        _closeCustomLocationGroupModal() {
            const overlay = document.getElementById("clg-modal-overlay");
            if (overlay) overlay.remove();
        },

        async _saveCustomLocationGroupModal(groupId) {
            const state = this._clgState;
            if (!state) return;

            const name = document.getElementById("clg-group-name").value.trim();
            const locationIds = Array.from(
                document.querySelectorAll("#clg-modal-overlay .clg-loc-cb:checked")
            ).map((cb) => Number(cb.value));

            if (!name) {
                this.showToast("Group name is required", "error");
                return;
            }
            if (name.length > 100) {
                this.showToast("Group name cannot exceed 100 characters", "error");
                return;
            }
            if (!locationIds.length) {
                this.showToast("Please select at least one location", "error");
                return;
            }

            const duplicate = state.groups.some(
                (g) => g.id !== groupId && g.name.trim().toLowerCase() === name.toLowerCase()
            );
            if (duplicate) {
                this.showToast("A group with this name already exists", "error");
                return;
            }

            this.showOverlay("Saving group...");
            const res = await this._clgModel.saveCustomLocationGroup(groupId, name, locationIds);
            this.hideOverlay();

            if (res && res.success) {
                this.showToast(groupId ? "Group updated successfully" : "Group created successfully", "success");
                this._closeCustomLocationGroupModal();
                await this._loadCustomLocationGroups();
            } else {
                this.showToast((res && (res.message || res.error)) || "Failed to save group", "error");
            }
        },

        // ─────────────────────────────────────────────
        // ACTIVATE / DEACTIVATE
        // ─────────────────────────────────────────────
        async _setCustomLocationGroupStatus(groupId, status) {
            const state = this._clgState;
            if (!state) return;

            const group = state.groups.find((g) => g.id === Number(groupId));
            if (!group) return;

            const activate = Number(status) === 1;
            if (!confirm(`${activate ? "Activate" : "Deactivate"} group "${group.name}"?`)) return;

            this.showOverlay(`${activate ? "Activating" : "Deactivating"} group...`);
            const res = await this._clgModel.setCustomLocationGroupStatus(group.id, activate ? 1 : 0);
            this.hideOverlay();

            if (res && res.success) {
                this.showToast(res.message || `Group ${activate ? "activated" : "deactivated"} successfully`, "success");
                await this._loadCustomLocationGroups();
            } else {
                this.showToast((res && (res.message || res.error)) || "Failed to update status", "error");
            }
        },
    };

    Object.assign(AttendanceView.prototype, methods);
})();