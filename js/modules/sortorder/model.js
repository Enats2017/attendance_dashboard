(function () {
    if (typeof AttendanceModel === "undefined") {
        console.error("js/modules/sort_order/model.js must be loaded after js/model.js");
        return;
    }

    const apiUrl = (action) => {
        const url = new URL(window.APP_CONFIG.API_URL, window.location.origin);
        url.searchParams.set("action", action);
        return url.toString();
    };

    const get = async (action) => {
        try {
            const response = await fetch(apiUrl(action), { credentials: "include" });
            return await response.json();
        } catch (error) {
            console.error(`Sort Order GET "${action}" Error:`, error);
            return { success: false, message: error.message, error: error.message };
        }
    };

    const post = async (action, payload) => {
        try {
            const response = await fetch(apiUrl(action), {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, ...payload }),
            });
            return await response.json();
        } catch (error) {
            console.error(`Sort Order POST "${action}" Error:`, error);
            return { success: false, message: error.message, error: error.message };
        }
    };

    const methods = {
        fetchCompaniesOrder() { 
            return get("get_companies_order"); 
        },
        
        saveCompaniesOrder(items)          { 
            return post("save_companies_order", { items }); 
        },

        fetchDepartmentsOrder() { 
            return get("get_departments_order");
        },
        
        saveDepartmentsOrder(items) { 
            return post("save_departments_order", { items }); 
        },

        fetchDesignationGlobalOrder() { 
            return get("get_designation_global_order"); 
        },
        
        saveDesignationGlobalOrder(items) { 
            return post("save_designation_global_order", { items }); 
        },

        fetchLocationsOrder() { 
            return get("get_locations_order"); 
        },
        
        saveLocationsOrder(items) { 
            return post("save_locations_order", { items }); 
        },
    };

    Object.assign(AttendanceModel.prototype, methods);
})();