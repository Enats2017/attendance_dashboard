(function () {
    if (typeof AttendanceModel === "undefined") {
        console.error("Units List model must be loaded after js/model.js");
        return;
    }

    AttendanceModel.prototype.fetchSubAdmins = async function () {
        if (this.state.subAdminList) return { success: true };
        try {
            const url = new URL(window.APP_CONFIG.API_URL, window.location.origin);
            url.searchParams.set('action', 'get_subadmins');
            const response = await fetch(url.toString(), { credentials: 'include' });
            const data = await response.json();
            this.state.subAdminList = (data.success ? data.data : []) || [];
            this._commit();
            return data;
        } catch (error) {
            console.error('Fetch SubAdmins Error:', error);
            this.state.subAdminList = [];
            return { success: false };
        }
    };
})();