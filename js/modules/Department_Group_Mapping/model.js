(function () {
    if (typeof AttendanceModel === "undefined") {
        console.error("Department Group Mapping model must be loaded after js/model.js");
        return;
    }

    Object.assign(AttendanceModel.prototype, {
        // Fetch department groups
        async fetchDepartmentGroups(targetUserId = null) {
            try {
                const url = new URL(window.APP_CONFIG.API_URL, window.location.origin);

                url.searchParams.set('action', 'get_department_groups');

                if (targetUserId) {
                    url.searchParams.set('targetUserId', targetUserId);
                }

                const response = await fetch(url.toString(), {
                    credentials: 'include'
                });

                return await response.json();
            } catch (error) {
                console.error('Fetch Department Groups Error:', error);
                return { success: false, message: error.message };
            }
        },

        // Fetch departments and their assignment status
        async fetchGroupDepartments(groupId = 0, targetUserId = null) {
            try {
                const url = new URL(window.APP_CONFIG.API_URL, window.location.origin);

                url.searchParams.set('action', 'get_group_departments');
                url.searchParams.set('groupId', groupId);

                if (targetUserId) {
                    url.searchParams.set('targetUserId', targetUserId);
                }

                const response = await fetch(url.toString(), {
                    credentials: 'include'
                });

                return await response.json();
            } catch (error) {
                console.error('Fetch Group Departments Error:', error);
                return { success: false, message: error.message };
            }
        },


        // Create or update a department group
        async saveDepartmentGroup(groupId, groupName, sortOrder, departmentIds, targetUserId = null) {
            try {
                const url = new URL(window.APP_CONFIG.API_URL, window.location.origin);

                url.searchParams.set('action', 'save_department_group');

                const payload = {
                    action: 'save_department_group',
                    groupId,
                    groupName,
                    sortOrder,
                    departmentIds
                };

                if (targetUserId) {
                    payload.targetUserId = targetUserId;
                }

                const response = await fetch(url.toString(), {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                return await response.json();
            } catch (error) {
                console.error('Save Department Group Error:', error);
                return { success: false, message: error.message };
            }
        },


        // Deactivate a department group
        async deleteDepartmentGroup(groupId, targetUserId = null) {
            try {
                const url = new URL(window.APP_CONFIG.API_URL, window.location.origin);

                url.searchParams.set('action', 'delete_department_group');

                const payload = {
                    action: 'delete_department_group',
                    groupId
                };

                if (targetUserId) {
                    payload.targetUserId = targetUserId;
                }

                const response = await fetch(url.toString(), {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                return await response.json();

            } catch (error) {
                console.error('Delete Department Group Error:', error);
                return { success: false, message: error.message };
            }
        },

        async setDepartmentGroupStatus(groupId, status, targetUserId = null) {
            try {
                const url = new URL(window.APP_CONFIG.API_URL, window.location.origin);
                url.searchParams.set('action', 'set_department_group_status');

                const payload = {
                    action: 'set_department_group_status',
                    groupId,
                    status
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
                console.error('Set Department Group Status Error:', error);
                return { success: false, message: error.message };
            }
        }

    });
})();
