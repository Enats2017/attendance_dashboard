(function () {
    if (typeof AttendanceModel === "undefined") {
        console.error("Dept-Designation Mapping model must be loaded after js/model.js");
        return;
    }

    Object.assign(AttendanceModel.prototype, {
        async fetchDepartmentDesignationMapping(targetUserId = null) {
            try {
                const url = new URL(window.APP_CONFIG.API_URL, window.location.origin);
                
                url.searchParams.set('action', 'get_department_designation_mapping');

                if (targetUserId) {
                    url.searchParams.set('targetUserId', targetUserId);
                }

                const response = await fetch(url.toString(), {
                    credentials: 'include'
                });

                return await response.json();
            } catch (error) {
                console.error('Fetch Dept-Designation Mapping Error:', error);
                return {
                    success: false,
                    error: error.message
                };
            }
        },


        async saveDepartmentDesignationMapping(items, targetUserId = null) {
            try {
                const url = new URL(window.APP_CONFIG.API_URL, window.location.origin);

                url.searchParams.set('action', 'save_department_designation_mapping');

                const payload = { action: 'save_department_designation_mapping', items };

                if (targetUserId) {
                    payload.targetUserId = targetUserId;
                }

                const response = await fetch(url.toString(), {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                return await response.json();
            } catch (error) {
                console.error('Save Dept-Designation Mapping Error:', error);
                return {
                    success: false,
                    error: error.message
                };
            }
        },


        async deleteDepartmentDesignationMapping(departmentId, designationId, targetUserId = null) {
            try {
                const url = new URL(window.APP_CONFIG.API_URL, window.location.origin);

                url.searchParams.set('action', 'delete_department_designation_mapping');

                const payload = {
                    action: 'delete_department_designation_mapping',
                    departmentId,
                    designationId
                };

                if (targetUserId) {
                    payload.targetUserId = targetUserId;
                }

                const response = await fetch(url.toString(), {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                return await response.json();
            } catch (error) {
                console.error('Delete Dept-Designation Mapping Error:', error);
                return {
                    success: false,
                    error: error.message
                };
            }
        }
    
    });
})();
