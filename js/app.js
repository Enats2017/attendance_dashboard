/**
 * Main Application Entry Point
 * Initializes the MVC components
 */
(function () {
    function initApp() {
        const model = new AttendanceModel();
        const view = new AttendanceView();
        const controller = new AttendanceController(model, view);

        // Export for global access via event handlers (e.g. onclick)
        window.AppController = controller;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initApp);
    } else {
        initApp();
    }
})();
