(function () {
    if (typeof AttendanceModel === "undefined") {
        console.error("Custom Location Groups model must be loaded after js/model.js");
        return;
    }

    const methods = {
        async fetchCustomLocationGroups() {
            try {
                const url = new URL(
                    window.APP_CONFIG.API_URL,
                    window.location.origin
                );
                
                url.searchParams.set("action", "get_custom_location_groups");

                const response = await fetch(url.toString(), {
                    credentials: "include"
                });

                return await response.json();
            } catch (error) {
                console.error("Fetch Custom Location Groups Error:", error);
                return {
                    success: false,
                    message: error.message
                };
            }
        },

        async saveCustomLocationGroup(groupId, groupName, locationIds) {
            try {
                const url = new URL(
                    window.APP_CONFIG.API_URL,
                    window.location.origin
                );

                url.searchParams.set("action", "save_custom_location_group");

                const payload = {
                    action: "save_custom_location_group",
                    groupId: Number(groupId) || 0,
                    groupName: String(groupName || "").trim(),
                    locationIds: Array.isArray(locationIds) ? locationIds.map(Number).filter((id) => id > 0) : []
                };

                const response = await fetch(url.toString(), {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(payload)
                });

                return await response.json();
            } catch (error) {
                console.error("Save Custom Location Group Error:", error);
                return {
                    success: false,
                    message: error.message
                };
            }
        },

        async setCustomLocationGroupStatus(groupId, status) {
            try {
                const url = new URL(
                    window.APP_CONFIG.API_URL,
                    window.location.origin
                );
                
                url.searchParams.set("action", "set_custom_location_group_status");

                const payload = {
                    action: "set_custom_location_group_status",
                    groupId: Number(groupId),
                    status: Number(status) === 1 ? 1 : 0
                };

                const response = await fetch(url.toString(), {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(payload)
                });

                return await response.json();
            } catch (error) {
                console.error("Set Custom Location Group Status Error:", error);
                return {
                    success: false,
                    message: error.message
                };
            }
        }
    };

    Object.assign(AttendanceModel.prototype, methods);
})();