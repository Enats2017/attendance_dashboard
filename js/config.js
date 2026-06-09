/**
 * Global Configuration for HRMS Attendance Dashboard
 */
const APP_CONFIG = {
    API_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost/attendance-dashboard/api/index.php'
        : 'http://10.2.30.16/attendance-dashboard/api/index.php'
};

window.APP_CONFIG = APP_CONFIG;
