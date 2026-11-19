(function () {
    if (typeof AttendanceView === "undefined") {
        console.error("js/modules/sort_order/view.js must be loaded after js/view.js");
        return;
    }

    const methods = {
        async _initSortOrderTab(model) {
            const contentEl = document.getElementById("sort-order-content");
            if (!contentEl) return;

            const [compRes, deptRes, desigRes, locRes] = await Promise.all([
                model.fetchCompaniesOrder(),
                model.fetchDepartmentsOrder(),
                model.fetchDesignationGlobalOrder(),
                model.fetchLocationsOrder()
            ]);

            if (!document.body.contains(contentEl)) return;

            if (!compRes.success || !deptRes.success || !desigRes.success || !locRes.success) {
                contentEl.innerHTML = `
                    <div style="padding:24px;background:rgba(244,63,94,0.05);border:1px solid rgba(244,63,94,0.2);color:#f43f5e;border-radius:var(--radius-md);font-weight:500;">
                        <i class="ph-fill ph-warning-circle" style="font-size:20px;"></i>
                        Error loading data. Please try again.
                    </div>
                `;
                return;
            }

            const companies = compRes.data || [];
            const departments = deptRes.data || [];
            const designations = desigRes.data || [];
            const locations = locRes.data || [];

            const esc = (v) => this._escapeAttr(v ?? "");

            const renderItem = ({ icon, item, inputClass, target }) => `
                <div class="sort-order-item">
                    <div style="display:flex;align-items:center;">
                        <i class="ph ${icon}" style="color:#6366f1;margin-right:10px;font-size:16px;"></i>
                        <span class="sort-order-item-name">${esc(item.name)}</span>
                        ${item.sortOrder === null ? '<span class="sort-order-null-badge">not set</span>' : ""}
                    </div>
                    <div style="display:flex;align-items:center;gap:6px;">
                        <div class="sort-order-control">
                            <button class="sort-order-btn btn-dec" type="button"><i class="ph ph-minus"></i></button>
                            <input type="number" class="sort-order-input ${inputClass}" data-id="${item.id}" data-original-order="${item.sortOrder !== null ? item.sortOrder : ""}" value="${item.sortOrder !== null ? item.sortOrder : ""}" placeholder="–">
                            <button class="sort-order-btn btn-inc" type="button"><i class="ph ph-plus"></i></button>
                        </div>
                        <button class="sort-order-clear-btn" data-target="${target}" data-id="${item.id}" title="Clear (reset to NULL)">
                            <i class="ph ph-x"></i>
                        </button>
                    </div>
                </div>
            `;

            const renderPanel = ({ panelId, active, title, description, searchId, sortId, saveId, searchPlaceholder, listId, itemsHtml }) => `
                <div class="sort-order-panel ${active ? "active" : ""}" id="${panelId}">
                    <div class="sort-order-card">
                        <div class="sort-order-header-bar">
                            <div>
                                <h3>${title}</h3>
                                <p>${description}</p>
                            </div>
                        </div>
                        <div class="sort-order-toolbar">
                            <input type="text" class="sort-order-search" id="${searchId}" placeholder="${searchPlaceholder}">
                            <div class="sort-order-toolbar-actions">
                                <button class="btn-order-sort" id="${sortId}" type="button">
                                    <i class="ph-bold ph-sort-ascending"></i> Sort
                                </button>
                                <button class="btn-order-save" id="${saveId}" type="button">
                                    <i class="ph-bold ph-floppy-disk"></i> Save
                                </button>
                            </div>
                        </div>
                        <div id="${listId}">
                            ${itemsHtml}
                        </div>
                    </div>
                </div>
            `;

            contentEl.innerHTML = `
                <style>
                    .sort-order-tabs { display:flex; gap:8px; margin-bottom:24px; }
                    .sort-order-tab-btn {
                        padding: 10px 24px;
                        border-radius: 10px;
                        border: 1px solid var(--border-color);
                        background: var(--white);
                        font-size: 14px;
                        font-weight: 600;
                        color: var(--text-muted);
                        cursor: pointer;
                        transition: all 0.2s;
                    }
                    .sort-order-tab-btn.active {
                        background: var(--primary);
                        color: #fff;
                        border-color: var(--primary);
                        box-shadow: 0 4px 14px rgba(99,102,241,0.3);
                    }
                    .sort-order-panel { display: none; }
                    .sort-order-panel.active { display: block; }
                    .sort-order-card {
                        background: var(--white);
                        border: 1px solid var(--border-color);
                        border-radius: var(--radius-md);
                        box-shadow: var(--shadow-sm);
                        padding: 24px;
                        max-width: 560px;
                        margin: 0 auto;
                    }
                    .sort-order-header-bar {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 16px;
                        padding-bottom: 16px;
                        border-bottom: 1px solid var(--border-color);
                    }
                    .sort-order-header-bar h3 {
                        font-size: 15px;
                        font-weight: 700;
                        color: var(--text-main);
                    }
                    .sort-order-header-bar p {
                        font-size: 12px;
                        color: var(--text-muted);
                        margin-top: 2px;
                    }
                    .sort-order-toolbar {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        margin-bottom: 16px;
                        flex-wrap: wrap;
                    }
                    .sort-order-search {
                        flex: 1 1 200px;
                        padding: 9px 14px;
                        border: 1px solid #cbd5e1;
                        border-radius: 8px;
                        font-size: 14px;
                        color: #0f172a;
                        outline: none;
                        transition: border-color 0.15s, box-shadow 0.15s;
                    }
                    .sort-order-search::placeholder { color: #94a3b8; }
                    .sort-order-search:focus {
                        border-color: var(--primary);
                        box-shadow: 0 0 0 3px rgba(99,102,241,0.12);
                    }
                    .sort-order-toolbar-actions {
                        display: flex;
                        gap: 8px;
                        flex-shrink: 0;
                    }
                    .btn-order-sort {
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        padding: 9px 16px;
                        border-radius: 8px;
                        border: 1px solid #cbd5e1;
                        background: var(--white);
                        color: #334155;
                        font-size: 13px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: background 0.15s, border-color 0.15s;
                        white-space: nowrap;
                    }
                    .btn-order-sort:hover { background: #f1f5f9; border-color: #94a3b8; }
                    .sort-order-item {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        padding: 12px 16px;
                        background: #f8fafc;
                        border: 1px solid #f1f5f9;
                        border-radius: 10px;
                        margin-bottom: 10px;
                        font-size: 14px;
                        transition: background 0.15s, border-color 0.15s;
                    }
                    .sort-order-item:hover { background: #f1f5f9; border-color: #e2e8f0; }
                    .sort-order-item-name { font-weight: 600; color: #334155; }
                    .sort-order-null-badge {
                        font-size: 11px;
                        background: #f1f5f9;
                        color: #94a3b8;
                        padding: 2px 8px;
                        border-radius: 9999px;
                        margin-left: 8px;
                    }
                    .sort-order-control {
                        display: flex;
                        align-items: center;
                        background: var(--white);
                        border: 1px solid #cbd5e1;
                        border-radius: 8px;
                        overflow: hidden;
                        box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                    }
                    .sort-order-btn {
                        background: none;
                        border: none;
                        width: 32px;
                        height: 32px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: #64748b;
                        cursor: pointer;
                        font-size: 14px;
                        transition: background 0.15s, color 0.15s;
                    }
                    .sort-order-btn:hover { background: #f1f5f9; color: var(--primary); }
                    .sort-order-input {
                        width: 48px;
                        border: none;
                        border-left: 1px solid #cbd5e1;
                        border-right: 1px solid #cbd5e1;
                        text-align: center;
                        font-size: 14px;
                        font-weight: 700;
                        color: #0f172a;
                        padding: 4px 0;
                        outline: none;
                        -moz-appearance: textfield;
                    }
                    .sort-order-input::-webkit-outer-spin-button,
                    .sort-order-input::-webkit-inner-spin-button { -webkit-appearance: none; }
                    .sort-order-clear-btn {
                        background: none;
                        border: none;
                        color: #94a3b8;
                        font-size: 12px;
                        cursor: pointer;
                        padding: 4px 6px;
                        border-radius: 6px;
                        transition: color 0.15s, background 0.15s;
                    }
                    .sort-order-clear-btn:hover { color: #f43f5e; background: rgba(244,63,94,0.07); }
                    .sort-order-save-bar {
                        display: flex;
                        justify-content: flex-end;
                        margin-top: 20px;
                    }
                    .btn-order-save {
                        background: var(--primary);
                        color: var(--white);
                        border: none;
                        padding: 10px 20px;
                        border-radius: 10px;
                        font-size: 14px;
                        font-weight: 600;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        box-shadow: 0 4px 14px rgba(99, 102, 241, 0.3);
                        transition: background-color 0.2s, transform 0.1s, box-shadow 0.2s;
                    }
                    .btn-order-save:hover {
                        background: var(--primary-hover);
                        box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
                    }
                    .btn-order-save:active { transform: scale(0.97); }
                </style>

                <div class="sort-order-tabs">
                    <button class="sort-order-tab-btn active" data-panel="companies">
                        <i class="ph ph-buildings"></i> Companies
                    </button>
                    <button class="sort-order-tab-btn" data-panel="departments">
                        <i class="ph ph-briefcase"></i> Departments
                    </button>
                    <button class="sort-order-tab-btn" data-panel="designations">
                        <i class="ph ph-identification-badge"></i> Designations
                    </button>
                    <button class="sort-order-tab-btn" data-panel="locations">
                        <i class="ph ph-map-pin"></i> Locations
                    </button>
                </div>

                ${renderPanel({
                    panelId: "sort-panel-companies",
                    active: true,
                    title: "Company Sort Order",
                    description: "Set priority order for companies. Lower number = appears first. Leave blank for alphabetical.",
                    searchId: "search-companies",
                    sortId: "btn-sort-companies",
                    saveId: "btn-save-companies",
                    searchPlaceholder: "Search companies...",
                    listId: "companies-list",
                    itemsHtml: companies.map((item) => renderItem({ icon: "ph-buildings", item, inputClass: "company-order-input", target: "company" })).join(""),
                })}

                ${renderPanel({
                    panelId: "sort-panel-departments",
                    active: false,
                    title: "Department Sort Order",
                    description: "Set priority order for departments. Lower number = appears first. Leave blank for alphabetical.",
                    searchId: "search-departments",
                    sortId: "btn-sort-departments",
                    saveId: "btn-save-departments",
                    searchPlaceholder: "Search departments...",
                    listId: "departments-list",
                    itemsHtml: departments.map((item) => renderItem({ icon: "ph-briefcase", item, inputClass: "dept-order-input", target: "dept" })).join(""),
                })}

                ${renderPanel({
                    panelId: "sort-panel-designations",
                    active: false,
                    title: "Designation Sort Order",
                    description: "Set priority order for designations globally, independent of department. Lower number = appears first in Designation Stats.",
                    searchId: "search-designations",
                    sortId: "btn-sort-designations",
                    saveId: "btn-save-designations",
                    searchPlaceholder: "Search designations...",
                    listId: "designations-list",
                    itemsHtml: designations.map((item) => renderItem({ icon: "ph-identification-badge", item, inputClass: "designation-order-input", target: "designation" })).join(""),
                })}

                ${renderPanel({
                    panelId: "sort-panel-locations",
                    active: false,
                    title: "Location Sort Order",
                    description: "Lower number appears first. Leave blank to use alphabetical order.",
                    searchId: "search-locations",
                    sortId: "btn-sort-locations",
                    saveId: "btn-save-locations",
                    searchPlaceholder: "Search locations...",
                    listId: "locations-list",
                    itemsHtml: locations.map((item) => renderItem({ icon: "ph-map-pin", item, inputClass: "location-order-input", target: "location" })).join(""),
                })}
            `;

            // ---- Tab switching ----
            contentEl.querySelectorAll(".sort-order-tab-btn").forEach((btn) => {
                btn.addEventListener("click", () => {
                    contentEl.querySelectorAll(".sort-order-tab-btn").forEach((b) => b.classList.remove("active"));
                    contentEl.querySelectorAll(".sort-order-panel").forEach((p) => p.classList.remove("active"));
                    btn.classList.add("active");
                    contentEl.querySelector(`#sort-panel-${btn.dataset.panel}`).classList.add("active");
                });
            });

            // ---- +/- buttons ----
            contentEl.querySelectorAll(".sort-order-item").forEach((item) => {
                const dec = item.querySelector(".btn-dec");
                const inc = item.querySelector(".btn-inc");
                const input = item.querySelector(".sort-order-input");
                if (!input) return;

                dec.addEventListener("click", () => {
                    const val = input.value === "" ? null : parseInt(input.value);
                    if (val === null) return;
                    input.value = Math.max(1, val - 1);
                });

                inc.addEventListener("click", () => {
                    const val = input.value === "" ? 1 : parseInt(input.value) + 1;
                    input.value = val;
                });
            });

            // ---- Clear buttons ----
            contentEl.querySelectorAll(".sort-order-clear-btn").forEach((btn) => {
                btn.addEventListener("click", () => {
                    const item = btn.closest(".sort-order-item");
                    const input = item.querySelector(".sort-order-input");
                    if (input) input.value = "";
                });
            });

            // ---- Search filter ----
            const attachSearchFilter = (searchInputId, listContainerId) => {
                const searchInput = document.getElementById(searchInputId);
                const listContainer = document.getElementById(listContainerId);
                if (!searchInput || !listContainer) return;

                searchInput.addEventListener("input", () => {
                    const term = searchInput.value.trim().toLowerCase();
                    listContainer.querySelectorAll(".sort-order-item").forEach((item) => {
                        const nameEl = item.querySelector(".sort-order-item-name");
                        const name = nameEl ? nameEl.textContent.toLowerCase() : "";
                        item.style.display = name.includes(term) ? "" : "none";
                    });
                });
            };

            attachSearchFilter("search-companies", "companies-list");
            attachSearchFilter("search-departments", "departments-list");
            attachSearchFilter("search-designations", "designations-list");
            attachSearchFilter("search-locations", "locations-list");

            // ---- Sorting helpers ----
            const sortOrderEntries = (listContainer, inputSelector) => {
                const entries = Array.from(listContainer.querySelectorAll(".sort-order-item")).map((item) => ({
                    item,
                    input: item.querySelector(inputSelector),
                }));

                entries.sort((a, b) => {
                    const orderA = a.input && a.input.value !== "" ? Number(a.input.value) : Infinity;
                    const orderB = b.input && b.input.value !== "" ? Number(b.input.value) : Infinity;

                    if (orderA !== orderB) return orderA - orderB;

                    const nameA = a.item.querySelector(".sort-order-item-name")?.textContent.trim() || "";
                    const nameB = b.item.querySelector(".sort-order-item-name")?.textContent.trim() || "";

                    return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: "base" });
                });

                entries.forEach(({ item, input }) => {
                    listContainer.appendChild(item);
                    if (input) input.dataset.originalOrder = input.value;
                });
            };

            const hasDuplicateSortOrders = (inputs) => {
                const assignedOrders = new Set();

                for (const input of inputs) {
                    if (input.value === "") continue;

                    const sortOrder = parseInt(input.value, 10);
                    if (assignedOrders.has(sortOrder)) {
                        alert(`Sort order number ${sortOrder} is already assigned. Please change the sort order number.`);
                        input.focus();
                        return true;
                    }

                    assignedOrders.add(sortOrder);
                }

                return false;
            };

            // ---- Ordered sort (insert & shift) ----
            const performOrderedSort = (listContainerId, inputSelector) => {
                const listContainer = document.getElementById(listContainerId);
                if (!listContainer) return;

                const items = Array.from(listContainer.querySelectorAll(".sort-order-item"));
                const entries = items.map((item) => ({
                    item,
                    input: item.querySelector(inputSelector),
                }));

                const changed = entries.filter(
                    ({ input }) => input && input.value !== (input.dataset.originalOrder || "")
                );

                if (changed.length === 1) {
                    const movedInput = changed[0].input;
                    const newOrder = movedInput.value === "" ? null : Number(movedInput.value);

                    if (newOrder !== null && (!Number.isInteger(newOrder) || newOrder < 1)) {
                        alert("Enter a whole-number order of 1 or higher.");
                        return;
                    }

                    const oldOrderValue = movedInput.dataset.originalOrder || "";
                    const oldOrder = oldOrderValue !== "" ? Number(oldOrderValue) : null;

                    if (newOrder !== null) entries.forEach(({ input }) => {
                        if (!input || input === movedInput || input.value === "") return;

                        const currentOrder = Number(input.value);

                        if (oldOrder === null && currentOrder >= newOrder) {
                            input.value = currentOrder + 1;
                        } else if (oldOrder !== null && newOrder < oldOrder
                            && currentOrder >= newOrder && currentOrder < oldOrder) {
                            input.value = currentOrder + 1;
                        } else if (oldOrder !== null && newOrder > oldOrder
                            && currentOrder > oldOrder && currentOrder <= newOrder) {
                            input.value = currentOrder - 1;
                        }
                    });
                }

                sortOrderEntries(listContainer, inputSelector);
            };

            document.getElementById("btn-sort-companies").addEventListener("click", () => {
                performOrderedSort("companies-list", ".company-order-input");
            });
            document.getElementById("btn-sort-departments").addEventListener("click", () => {
                performOrderedSort("departments-list", ".dept-order-input");
            });
            document.getElementById("btn-sort-designations").addEventListener("click", () => {
                performOrderedSort("designations-list", ".designation-order-input");
            });
            document.getElementById("btn-sort-locations").addEventListener("click", () => {
                performOrderedSort("locations-list", ".location-order-input");
            });

            // ---- Save handlers ----
            const collectItems = (inputs) => {
                const items = [];
                inputs.forEach((input) => {
                    items.push({
                        id: parseInt(input.dataset.id, 10),
                        sortOrder: input.value !== "" ? parseInt(input.value, 10) : null,
                    });
                });
                return items;
            };

            document.getElementById("btn-save-companies").addEventListener("click", async () => {
                const inputs = contentEl.querySelectorAll(".company-order-input");
                if (hasDuplicateSortOrders(inputs)) return;

                this.showOverlay("Saving company order...");
                const res = await model.saveCompaniesOrder(collectItems(inputs));
                this.hideOverlay();

                if (res && res.success) {
                    sortOrderEntries(contentEl.querySelector("#companies-list"), ".company-order-input");
                    alert("Company sort order saved successfully!");
                    model.state.filterLists = null;
                } else {
                    alert("Failed: " + (res ? res.message : "Unknown error"));
                }
            });

            document.getElementById("btn-save-departments").addEventListener("click", async () => {
                const inputs = contentEl.querySelectorAll(".dept-order-input");
                if (hasDuplicateSortOrders(inputs)) return;

                this.showOverlay("Saving department order...");
                const res = await model.saveDepartmentsOrder(collectItems(inputs));
                this.hideOverlay();

                if (res && res.success) {
                    sortOrderEntries(contentEl.querySelector("#departments-list"), ".dept-order-input");
                    alert("Department sort order saved successfully!");
                    model.state.filterLists = null;
                } else {
                    alert("Failed: " + (res ? res.message : "Unknown error"));
                }
            });

            document.getElementById("btn-save-designations").addEventListener("click", async () => {
                const inputs = contentEl.querySelectorAll(".designation-order-input");
                if (hasDuplicateSortOrders(inputs)) return;

                this.showOverlay("Saving designation order...");
                const res = await model.saveDesignationGlobalOrder(collectItems(inputs));

                if (res && res.success) {
                    this.showOverlay("Refreshing data...");
                    await model.fetchData();
                    this.hideOverlay();
                    sortOrderEntries(contentEl.querySelector("#designations-list"), ".designation-order-input");
                    alert("Designation sort order saved successfully!");
                    model.state.filterLists = null;
                } else {
                    this.hideOverlay();
                    alert("Failed: " + (res ? res.message : "Unknown error"));
                }
            });

            document.getElementById("btn-save-locations").addEventListener("click", async () => {
                const inputs = contentEl.querySelectorAll(".location-order-input");
                if (hasDuplicateSortOrders(inputs)) return;

                this.showOverlay("Saving location order...");
                const res = await model.saveLocationsOrder(collectItems(inputs));

                if (res && res.success) {
                    await model.fetchData();
                    this.hideOverlay();
                    sortOrderEntries(contentEl.querySelector("#locations-list"), ".location-order-input");
                    alert("Location sort order saved successfully!");
                } else {
                    this.hideOverlay();
                    alert("Failed: " + (res ? res.message : "Unknown error"));
                }
            });
        },
    };

    Object.assign(AttendanceView.prototype, methods);
})();