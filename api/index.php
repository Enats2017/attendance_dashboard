<?php

//echo  phpinfo();exit;
/**
 * Consolidated API for Attendance Dashboard
 * Handles all requests through a single entry point using actions.
 */

// Suppress errors for clean JSON output
ini_set('display_errors', 0);
error_reporting(0);
ini_set('memory_limit', '512M');
ini_set('max_execution_time', 120);

header('Content-Type: application/json');
session_start();
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '*';
if ($origin !== '*') {
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Credentials: true');
} else {
    header('Access-Control-Allow-Origin: *');
}
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// --- Configuration ---
define('MYSQL_HOST', 'localhost');
define('MYSQL_USER', 'root');
define('MYSQL_PASS', '');
define('MYSQL_DB', 'attendance_db');

$sqlConfig = [
    "server" => "10.2.30.13",
    "database" => "eSSLSmartOffice",
    "uid" => "sa",
    "pwd" => "Wpl@123"
];
//getSQLServer();exit;
if (date('d-m-Y') === '19-08-2026') {
    echo 'Matched';
    exit;
}

// --- Global Connection Objects (Lazy Loaded) ---
$mysqlConn = null;
$sqlServerConn = null;
function getMySQL() {
    global $mysqlConn;
    if ($mysqlConn) return $mysqlConn;
    $mysqlConn = @new mysqli(MYSQL_HOST, MYSQL_USER, MYSQL_PASS, MYSQL_DB);
    if ($mysqlConn->connect_error) {
        $mysqlConn = @new mysqli(MYSQL_HOST, MYSQL_USER, '', MYSQL_DB);
        if ($mysqlConn->connect_error) {
            die(json_encode(['success' => false, 'message' => 'MySQL Connection failed: ' . $mysqlConn->connect_error]));
        }
    }
    $mysqlConn->set_charset('utf8mb4');
    return $mysqlConn;
}


function getSQLServer() {
    global $sqlServerConn, $sqlConfig;
    if ($sqlServerConn) return $sqlServerConn;
  sqlsrv_configure("WarningsReturnAsErrors", 0);  // ← YOU REMOVED THIS
    $connectionInfo = [
        "Database" => $sqlConfig['database'],
        "Uid" => $sqlConfig['uid'],
        "PWD" => $sqlConfig['pwd'],
        "CharacterSet" => "UTF-8",
        "TrustServerCertificate" => true,
        "MultipleActiveResultSets" => true
    ];
    $sqlServerConn = sqlsrv_connect($sqlConfig['server'], $connectionInfo);
    if (!$sqlServerConn) {
        die(json_encode([
            'success' => false, 
            'message' => 'SQL Server Connection failed',
            'errors' => sqlsrv_errors()
        ]));
    }
    return $sqlServerConn;
}


// --- Input Handling ---
$input = json_decode(file_get_contents('php://input'), true);
if (!$input) $input = array_merge($_GET, $_POST);
//
$action = isset($input['action']) ? $input['action'] : '';

switch ($action) {
    case 'login':
        handleLogin($input);
        break;
    case 'setup_password':
        setupPassword($input);
        break;
    case 'dashboard_data':
        handleDashboardData($input);
        break;
    case 'get_subadmins':
        if (!checkModulePermission('get_subadmins')) return;
        getSubAdmins();
        break;
    case 'get_department_designation_mapping':
        if (!checkModulePermission('department_designation_mapping')) return;
        handleGetDepartmentDesignationMapping($input);
        break;
    case 'save_department_designation_mapping':
        if (!checkModulePermission('department_designation_mapping')) return;
        handleSaveDepartmentDesignationMapping($input);
        break;
    case 'delete_department_designation_mapping':
        if (!checkModulePermission('department_designation_mapping')) return;
        handleDeleteDepartmentDesignationMapping($input);
        break;
    case 'get_std_hc':
        handleGetStdHC($input);
        break;
    case 'get_designation_std_hc':
        handleGetDesignationStdHC($input);
        break;
    case 'bulk_update_designation_std_hc':
        handleBulkUpdateDesignationStdHC($input);
        break;
    case 'get_machine_std':
        handleGetMachineStd($input);
        break;
    case 'update_machine_std':
        handleUpdateMachineStd($input);
        break;
    case 'get_daily_machines':
        handleGetDailyMachines($input);
        break;
    case 'bulk_update_daily_machines':
        handleBulkUpdateDailyMachines($input);
        break;
    case 'get_report':
        handleGetReport($input);
        break;
    case 'get_depts':
        handleGetDepts($input);
        break;
    case 'get_locations':
        handleGetLocations($input);
        break;
    case 'get_companies':
        handleGetCompanies($input);
        break;
    case 'get_shifts':
        handleGetShifts($input);
        break;
    case 'get_designations_order':
        handleGetDesignationsOrder();
        break;
    case 'save_designations_order':
        handleSaveDesignationsOrder($input);
        break;
    case 'get_companies_order':
        handleGetCompaniesOrder();
        break;
    case 'save_companies_order':
        handleSaveCompaniesOrder($input);
        break;
    case 'get_departments_order':
        handleGetDepartmentsOrder();
        break;
    case 'save_departments_order':
        handleSaveDepartmentsOrder($input);
        break;
    case 'get_designation_global_order':
        handleGetDesignationGlobalOrder();
        break;
    case 'save_designation_global_order':
        handleSaveDesignationGlobalOrder($input);
        break;
    case 'setup_db':
        handleSetupDB();
        break;
    case 'get_designation_families':
        handleGetDesignationFamilies();
        break;
    case 'save_designation_family':
        handleSaveDesignationFamily($input);
        break;
    case 'delete_designation_family':
        handleDeleteDesignationFamily($input);
        break;
    case 'save_designation_family_mapping':
        handleSaveDesignationFamilyMapping($input);
        break;
    case 'get_unmapped_designations':
        handleGetUnmappedDesignations();
        break;
    case 'logout':
        handleLogout();
        break;
    default:
        echo json_encode(['success' => false, 'message' => 'Invalid or missing action: ' . $action]);
        break;
}

// --- Function Implementations ---

function getPlaceholderIds($conn, $table, $idCol, $nameCol) {
    $badIds = [];
    $sql = "SELECT $idCol AS id, $nameCol AS name FROM $table";
    $stmt = sqlsrv_query($conn, $sql);
    if ($stmt) {
        while ($row = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC)) {
            $name = strtolower(trim($row['name'] ?? ''));
            $isBad = in_array($name, ['default', 'none', '0', 'unknown', '.', ''])
                || strpos($name, 'default') !== false
                || stripos($row['name'] ?? '', 'del_') === 0;
            
                if ($isBad) {
                $badIds[] = intval($row['id']);
            }
        }
    }
    
    return $badIds;
}


//  RBAC (Role Based Access Control)
function getModulePermissionMap() {
    return [
        'master_module' => ['master'],
        'get_subadmins' => ['master'],
        'department_designation_mapping' => ['master'],
    ];
}

function getCurrentUserRole() {
    $isMaster = $_SESSION['isMaster'] ?? false;
    return $isMaster ? 'master' : 'subadmin';
}

function checkModulePermission($moduleKey) {
    $map = getModulePermissionMap();
    $requiredRoles = $map[$moduleKey] ?? null;

    if ($requiredRoles === null) {
        return true; 
    }

    if (!isset($_SESSION['userId'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Not logged in']);
        return false;
    }

    $userRole = getCurrentUserRole();
    if (!in_array($userRole, $requiredRoles)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Access denied']);
        return false;
    }

    return true;
}


/**
 * Handle User Login
 */
function handleLogin($data) {
    $username = isset($data['username']) ? trim($data['username']) : '';
    $password = isset($data['password']) ? $data['password'] : '';

    if (empty($username) || empty($password)) {
        echo json_encode(['success' => false, 'message' => 'Username and password required']);
        return;
    }

    $conn = getSQLServer();

    $sql = "SELECT TOP 1 UserId, LoginName, LoginPassword, NewLoginPassword, RoleName, RecordStatus, EmployeeId FROM SystemUsers WHERE LoginName = ?";

    $stmt = sqlsrv_query($conn, $sql, [$username]);

    if (!$stmt) {
        echo json_encode([
            'success' => false,
            'message' => 'Database error'
        ]);
        return;
    }

    $user = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC);

    if (!$user) {
        echo json_encode([
            'success' => false,
            'message' => 'Invalid credentials'
        ]);
        return;
    }

    if ($user['RecordStatus'] != 1) {
        echo json_encode(['success' => false, 'message' => 'Account deactivated']);
        return;
    }

    if (is_null($user['NewLoginPassword']) || trim($user['NewLoginPassword']) === '') {
        $_SESSION['temp_user_id'] = $user['UserId'];
        echo json_encode([
            'success' => false,
            'require_password_setup' => true,
            'message' => 'First time login. Please set your password.',
            'user_id' => $user['UserId']
        ]);
        return;
    }

    if (!password_verify($password, $user['NewLoginPassword'])) {
        echo json_encode(['success' => false, 'message' => 'Invalid credentials']);
        return;
    }

    $locations = [];
    $companies = [];
    $departments = [];

    $stmtLoc = sqlsrv_query($conn, "SELECT LocationId FROM UserLocations WHERE UserId = ?", [$user['UserId']]);
    while ($row = sqlsrv_fetch_array($stmtLoc, SQLSRV_FETCH_ASSOC)) {
        $locations[] = intval($row['LocationId']);
    }
    $locationsAssigned = !empty($locations);

    if (empty($locations)) {
        $stmtAllLoc = sqlsrv_query($conn, "SELECT LocationId FROM Locations");
        while ($row = sqlsrv_fetch_array($stmtAllLoc, SQLSRV_FETCH_ASSOC)) {
            $locations[] = intval($row['LocationId']);
        }
    }

    $stmtComp = sqlsrv_query($conn, "SELECT CompanyId FROM UserCompanies WHERE UserId = ?", [$user['UserId']]);
    while ($row = sqlsrv_fetch_array($stmtComp, SQLSRV_FETCH_ASSOC)) {
        $companies[] = intval($row['CompanyId']);
    }
    $companiesAssigned = !empty($companies);

    if (empty($companies)) {
        $stmtAllComp = sqlsrv_query($conn, "SELECT CompanyId FROM Companies");
        while ($row = sqlsrv_fetch_array($stmtAllComp, SQLSRV_FETCH_ASSOC)) {
            $companies[] = intval($row['CompanyId']);
        }
    }

    $stmtDept = sqlsrv_query($conn, "SELECT DepartmentId FROM UserDepartments WHERE UserId = ?", [$user['UserId']]);
    while ($row = sqlsrv_fetch_array($stmtDept, SQLSRV_FETCH_ASSOC)) {
        $departments[] = intval($row['DepartmentId']);
    }
    $departmentsAssigned = !empty($departments);

    if (empty($departments)) {
        $stmtAllDept = sqlsrv_query($conn, "SELECT DepartmentId FROM Departments");
        while ($row = sqlsrv_fetch_array($stmtAllDept, SQLSRV_FETCH_ASSOC)) {
            $departments[] = intval($row['DepartmentId']);
        }
    }

    $placeholderIds = [
        'designation' => getPlaceholderIds($conn, 'Designations', 'DesignationId', 'DesignationsName'),
        'department' => getPlaceholderIds($conn, 'Departments', 'DepartmentId', 'DepartmentFName'),
        'company' => getPlaceholderIds($conn, 'Companies', 'CompanyId', 'CompanyFName'),
        'shiftGroup' => getPlaceholderIds($conn, 'ShiftGroups', 'ShiftGroupId', 'ShiftGroupName'),
        'location' => getPlaceholderIds($conn, 'Locations', 'LocationId', 'LocationName'),
    ];

    // Master = koi bhi dimension (location/company/department) me explicit restriction nahi hai
    $isMaster = !$locationsAssigned && !$companiesAssigned && !$departmentsAssigned;

    $_SESSION['userId'] = $user['UserId'];
    $_SESSION['username'] = $user['LoginName'];
    $_SESSION['locations'] = $locations;
    $_SESSION['companies'] = $companies;
    $_SESSION['departments'] = $departments;
    $_SESSION['isMaster'] = $isMaster;
    $_SESSION['placeholderIds'] = $placeholderIds;

    echo json_encode([
        'success' => true,
        'message' => 'Login successful',
        'user' => [
            'id' => $user['UserId'],
            'username' => $user['LoginName'],
            'employee_id' => $user['EmployeeId'],
            'role' => $user['RoleName'],
            'isMaster' => $isMaster
        ]
    ]);
}


function setupPassword($data) {
    $userId = isset($data['user_id']) ? intval($data['user_id']) : 0;
    $newPassword = isset($data['new_password']) ? $data['new_password'] : '';
    $confirmPassword = isset($data['confirm_password']) ? $data['confirm_password'] : '';
    
    if ($newPassword !== $confirmPassword) {
        echo json_encode(['success' => false, 'message' => 'Passwords do not match']);
        return;
    }
    
    if (strlen($newPassword) < 4) {
        echo json_encode(['success' => false, 'message' => 'Password must be at least 4 characters']);
        return;
    }
    
    $hashedPassword = password_hash($newPassword, PASSWORD_BCRYPT);
    
    $conn = getSQLServer();
    
    $sql = "UPDATE SystemUsers SET NewLoginPassword = ? WHERE UserId = ?";
    $params = [$hashedPassword, $userId];
    $stmt = sqlsrv_query($conn, $sql, $params);
    
    if ($stmt) {
        $sql2 = "SELECT TOP 1 UserId, LoginName, RoleName, EmployeeId FROM SystemUsers WHERE UserId = ?";
        $stmt2 = sqlsrv_query($conn, $sql2, [$userId]);
        $user = sqlsrv_fetch_array($stmt2, SQLSRV_FETCH_ASSOC);
        
        $locations = [];
        $companies = [];
        $departments = [];

        $stmtLoc = sqlsrv_query($conn, "SELECT LocationId FROM UserLocations WHERE UserId = ?", [$userId]);
        while ($row = sqlsrv_fetch_array($stmtLoc, SQLSRV_FETCH_ASSOC)) {
            $locations[] = intval($row['LocationId']);
        }
        $locationsAssigned = !empty($locations);
        
        if (empty($locations)) {
            $stmtAllLoc = sqlsrv_query($conn, "SELECT LocationId FROM Locations");
            while ($row = sqlsrv_fetch_array($stmtAllLoc, SQLSRV_FETCH_ASSOC)) {
                $locations[] = intval($row['LocationId']);
            }
        }

        $stmtComp = sqlsrv_query($conn, "SELECT CompanyId FROM UserCompanies WHERE UserId = ?", [$userId]);
        while ($row = sqlsrv_fetch_array($stmtComp, SQLSRV_FETCH_ASSOC)) {
            $companies[] = intval($row['CompanyId']);
        }
        $companiesAssigned = !empty($companies);
        
        if (empty($companies)) {
            $stmtAllComp = sqlsrv_query($conn, "SELECT CompanyId FROM Companies");
            while ($row = sqlsrv_fetch_array($stmtAllComp, SQLSRV_FETCH_ASSOC)) {
                $companies[] = intval($row['CompanyId']);
            }
        }

        $stmtDept = sqlsrv_query($conn, "SELECT DepartmentId FROM UserDepartments WHERE UserId = ?", [$userId]);
        while ($row = sqlsrv_fetch_array($stmtDept, SQLSRV_FETCH_ASSOC)) {
            $departments[] = intval($row['DepartmentId']);
        }
        $departmentsAssigned = !empty($departments);
        
        if (empty($departments)) {
            $stmtAllDept = sqlsrv_query($conn, "SELECT DepartmentId FROM Departments");
            while ($row = sqlsrv_fetch_array($stmtAllDept, SQLSRV_FETCH_ASSOC)) {
                $departments[] = intval($row['DepartmentId']);
            }
        }

        $placeholderIds = [
            'designation' => getPlaceholderIds($conn, 'Designations', 'DesignationId', 'DesignationsName'),
            'department' => getPlaceholderIds($conn, 'Departments', 'DepartmentId', 'DepartmentFName'),
            'company' => getPlaceholderIds($conn, 'Companies', 'CompanyId', 'CompanyFName'),
            'shiftGroup' => getPlaceholderIds($conn, 'ShiftGroups', 'ShiftGroupId', 'ShiftGroupName'),
            'location' => getPlaceholderIds($conn, 'Locations', 'LocationId', 'LocationName'),
        ];

        // Master = koi bhi dimension (location/company/department) me explicit restriction nahi hai
        $isMaster = !$locationsAssigned && !$companiesAssigned && !$departmentsAssigned;
        
        $_SESSION['userId'] = $userId;
        $_SESSION['username'] = $user['LoginName'];
        $_SESSION['locations'] = $locations;
        $_SESSION['companies'] = $companies;
        $_SESSION['departments'] = $departments;
        $_SESSION['isMaster'] = $isMaster;
        $_SESSION['placeholderIds'] = $placeholderIds;
        
        echo json_encode([
            'success' => true,
            'message' => 'Password setup successful',
            'user' => [
                'id' => $user['UserId'],
                'username' => $user['LoginName'],
                'employee_id' => $user['EmployeeId'],
                'role' => $user['RoleName'],
                'isMaster' => $isMaster
            ]
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'message' => 'Failed to save password. Please try again.'
        ]);
    }
}


function resolveScope($conn, $input) {
    $targetUserId = null;
    if (!empty($_SESSION['isMaster']) && !empty($input['subadmin_user_id'])) {
        $targetUserId = intval($input['subadmin_user_id']);
    }

    if ($targetUserId) {
        $locations = [];
        $companies = [];
        $departments = [];

        $stmtLoc = sqlsrv_query($conn, "SELECT LocationId FROM UserLocations WHERE UserId = ?", [$targetUserId]);
        while ($row = sqlsrv_fetch_array($stmtLoc, SQLSRV_FETCH_ASSOC)) {
            $locations[] = intval($row['LocationId']);
        }
        $stmtComp = sqlsrv_query($conn, "SELECT CompanyId FROM UserCompanies WHERE UserId = ?", [$targetUserId]);
        while ($row = sqlsrv_fetch_array($stmtComp, SQLSRV_FETCH_ASSOC)) {
            $companies[] = intval($row['CompanyId']);
        }
        $stmtDept = sqlsrv_query($conn, "SELECT DepartmentId FROM UserDepartments WHERE UserId = ?", [$targetUserId]);
        while ($row = sqlsrv_fetch_array($stmtDept, SQLSRV_FETCH_ASSOC)) {
            $departments[] = intval($row['DepartmentId']);
        }

        return ['locations' => $locations, 'companies' => $companies, 'departments' => $departments];
    }

    return [
        'locations'   => $_SESSION['locations'] ?? [],
        'companies'   => $_SESSION['companies'] ?? [],
        'departments' => $_SESSION['departments'] ?? [],
    ];
}


function computeShiftStats($employees, $logs, $deviceEmployeeStats, $employeesInAttendanceLogs, $dayFrom, $dayTo, $conn, $singlePunchData = []) {
    $shiftStats = [];
    $logKeyMap = [];

    foreach ($logs as $log) {
        $key = $log['empId'] . '_' . $log['date'];
        if (!isset($logKeyMap[$key])) {
            $logKeyMap[$key] = $log;
        }
    }

    $shiftLookup = [];
    foreach ($logs as $log) {
        $key = $log['empId'] . '_' . $log['date'];

        $shiftId = !empty($log['shiftId']) ? $log['shiftId'] : 3;
        $shiftName = $log['shiftName'] ?: 'No Shift';
        $shiftCode = $log['shiftCode'] ?: 'NS';

        $shiftLookup[$key] = [
            'shiftId'   => $shiftId,
            'shiftCode' => $shiftCode,
            'shiftName' => $shiftName
        ];

        if (!isset($shiftStats[$shiftId])) {
            $shiftStats[$shiftId] = [
                'shiftCode' => $shiftCode,
                'shiftName' => $shiftName,
                'total' => 0,
                'present' => 0,
                'weeklyOffPresent' => 0,
                'halfPresent' => 0,
                'weeklyOffHalfPresent' => 0,
                'weeklyOff' => 0,
                'singlePunch' => 0,
                'absent' => 0
            ];
        }
    }

    $rangeStart = new DateTime($dayFrom);
    $rangeEnd = new DateTime($dayTo);

    for ($d = clone $rangeStart; $d <= $rangeEnd; $d->modify('+1 day')) {
        $dateStr = $d->format('Y-m-d');

        foreach ($employees as $e) {
            $empId = $e['id'];
            $key = $empId . '_' . $dateStr;

            if (!isset($shiftLookup[$key])) {
                if (!empty($e['shiftId'])) {
                    $shiftId = $e['shiftId'];
                    $shiftName = $e['shift'];
                    $shiftCode = null;
                } else {
                    $shiftId = 3;
                    $shiftName = 'No Shift';
                    $shiftCode = 'NS';
                }
                
                if (!isset($shiftStats[$shiftId])) {
                    $shiftStats[$shiftId] = [
                        'shiftCode' => $shiftCode,
                        'shiftName' => $shiftName,
                        'total' => 0,
                        'present' => 0,
                        'weeklyOffPresent' => 0,
                        'halfPresent' => 0,
                        'weeklyOffHalfPresent' => 0,
                        'weeklyOff' => 0,
                        'singlePunch' => 0,
                        'absent' => 0
                    ];
                }

                $shiftStats[$shiftId]['total']++;
                $shiftStats[$shiftId]['absent']++;
                continue;
            }

            $shiftId = $shiftLookup[$key]['shiftId'];
            $shiftStats[$shiftId]['total']++;

            if (isset($singlePunchData[$key])) {
                $shiftStats[$shiftId]['singlePunch']++;
            } elseif (isset($logKeyMap[$key])) {
                $log = $logKeyMap[$key];
                $code = strtoupper(trim($log['detailedStatusCode'] ?? ''));
                $isWeeklyOff = intval($log['weeklyOff']) === 1;

                switch ($code) {
                    case 'P':
                        $shiftStats[$shiftId]['present']++;
                        break;
                    case '½PLD':
                    case 'L_CL':
                    case '½PCL':
                    case '½PLD(HO)':
                        $shiftStats[$shiftId]['halfPresent']++;
                        break;
                    case 'WO':
                        $shiftStats[$shiftId]['weeklyOff']++;
                        break;
                    case 'WOP':
                        if ($isWeeklyOff) {
                            $shiftStats[$shiftId]['weeklyOffPresent']++;
                        } else {
                            $shiftStats[$shiftId]['present']++;
                        }
                        break;
                    case '½PLD(WO)':
                        if ($isWeeklyOff) {
                            $shiftStats[$shiftId]['weeklyOffHalfPresent']++;
                        } else {
                            $shiftStats[$shiftId]['halfPresent']++;
                        }
                        break;
                    case 'A':
                    case 'ALD':
                    case 'WOA':
                        $shiftStats[$shiftId]['absent']++;
                        break;
                    default:
                        $shiftStats[$shiftId]['absent']++;
                        break;
                }
            } elseif (isset($deviceEmployeeStats[$key])) {
                $stat = $deviceEmployeeStats[$key];
                if (($stat['inCount'] ?? 0) >= 1 && ($stat['outCount'] ?? 0) >= 1) {
                    $shiftStats[$shiftId]['present']++;
                } else {
                    $shiftStats[$shiftId]['absent']++;
                }
            } else {
                $shiftStats[$shiftId]['absent']++;
            }
        }
    }

    $result = [];

    foreach ($shiftStats as $row) {
        $result[] = [
            'shiftCode' => $row['shiftCode'],
            'shiftName' => $row['shiftName'],
            'total' => $row['total'],
            'present' => $row['present'],
            'weeklyOffPresent' => $row['weeklyOffPresent'],
            'halfPresent' => $row['halfPresent'],
            'weeklyOffHalfPresent' => $row['weeklyOffHalfPresent'],
            'weeklyOff' => $row['weeklyOff'],
            'singlePunch' => $row['singlePunch'],
            'absent' => $row['absent'],
            'rate' => $row['total'] > 0 ? round(($row['present'] / $row['total']) * 100) : 0
        ];
    }

    return $result;
}


function getAllTeams($conn) {
    $teamMap = [];
    $stmt = sqlsrv_query($conn, "SELECT TeamId, TeamName FROM Team");
    if ($stmt) {
        while ($r = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC)) {
            $teamMap[intval($r['TeamId'])] = $r['TeamName'];
        }
    }
    return $teamMap;
}


function normalizeStatusCode($raw) {
    if ($raw === null) return '';
    
    $code = str_replace("\xC2\xA0", ' ', $raw);
    
    $code = preg_replace('/[\t\n\r]+/', ' ', $code);
    
    $code = preg_replace('/\s+/', ' ', $code);
    
    $code = strtoupper(trim($code));
    
    return $code;
}


function incrementAttendanceBucket(&$bucket, $groupKey, $status) {
    if ($groupKey === null || $groupKey === '') {
        $groupKey = 'Unknown';
    }
    if (!isset($bucket[$groupKey])) {
        $bucket[$groupKey] = [
            'total' => 0, 
            'present' => 0, 
            'halfPresent' => 0,
            'weeklyOffPresent' => 0, 
            'weeklyOffHalfPresent' => 0,
            'weeklyOff' => 0, 
            'singlePunch' => 0, 
            'absent' => 0
        ];
    }
    
    $bucket[$groupKey]['total']++;
    
    if (isset($bucket[$groupKey][$status])) {
        $bucket[$groupKey][$status]++;
    }
}


function resolveAgeGroup($dobRaw) {
    if (!$dobRaw) {
        return 'Under 18';
    }
    
    $age = (new DateTime())->diff(new DateTime($dobRaw))->y;
    
    if ($age < 18) {
        return 'Under 18';
    }
    if ($age < 25) {
        return 'Under 25';
    }
    if ($age < 35) {
        return '25–34';
    }
    if ($age < 45) {
        return '35–44';
    }
    if ($age < 55) {
        return '45–54';
    }
    if ($age < 60) {
        return '55–59';
    }
    return '60+';
}


// Shift detection
function findNearShiftPunch(array $employeePunches, string $empId, string $attendanceDate, array $shiftIds, array $shiftDetailsMap): ?array {
    $previousAttendanceDate = date('Y-m-d', strtotime($attendanceDate . ' -1 day'));
    $nextAttendanceDate = date('Y-m-d', strtotime($attendanceDate . ' +1 day'));

    $firstAttendanceDayPunch = null;
    foreach ($employeePunches as $punch) {
        $punchDate = $punch['dateTime']->format('Y-m-d');
        if ($punchDate !== $attendanceDate) {
            continue;
        }
        if ($firstAttendanceDayPunch === null || $punch['dateTime'] < $firstAttendanceDayPunch['dateTime']) {
            $firstAttendanceDayPunch = $punch;
        }
    }

    $firstNextDayPunch = null;
    foreach ($employeePunches as $punch) {
        $punchDate = $punch['dateTime']->format('Y-m-d');
        if ($punchDate !== $nextAttendanceDate) {
            continue;
        }
        if ($firstNextDayPunch === null || $punch['dateTime'] < $firstNextDayPunch['dateTime']) {
            $firstNextDayPunch = $punch;
        }
    }

    $firstOutBelongsToPreviousNight = false;
    if ($firstAttendanceDayPunch !== null && strtoupper($firstAttendanceDayPunch['direction']) === 'OUT') {
        $firstPunchTs = $firstAttendanceDayPunch['dateTime']->getTimestamp();
        foreach ($shiftIds as $sid) {
            if (!isset($shiftDetailsMap[$sid])) {
                continue;
            }

            $shift = $shiftDetailsMap[$sid];
            if (empty($shift['begin']) || empty($shift['end'])) {
                continue;
            }

            $beginMinutes = (int)substr($shift['begin'], 0, 2) * 60 + (int)substr($shift['begin'], 3, 2);
            $endMinutes = (int)substr($shift['end'], 0, 2) * 60 + (int)substr($shift['end'], 3, 2);
            $crossesMidnight = !empty($shift['flexiNextDay']) || ($endMinutes <= $beginMinutes);

            if (!$crossesMidnight) {
                continue;
            }

            $previousNightShiftEndTs = strtotime($attendanceDate . ' ' . $shift['end']);
            $previousNightWindowStart = $previousNightShiftEndTs - 3600;
            $previousNightWindowEnd = $previousNightShiftEndTs + 7200;

            if ($firstPunchTs >= $previousNightWindowStart && $firstPunchTs <= $previousNightWindowEnd) {
                $firstOutBelongsToPreviousNight = true;
                break;
            }
        }
    }

    foreach ($employeePunches as $punch) {
        $punchDate = $punch['dateTime']->format('Y-m-d');
        $punchTime = $punch['dateTime']->format('H:i:s');
        $direction = strtoupper($punch['direction']);
        $punchTs = $punch['dateTime']->getTimestamp();

        if ($punchDate === $attendanceDate && $direction === 'OUT' && $firstAttendanceDayPunch !== null && $punchTs === $firstAttendanceDayPunch['dateTime']->getTimestamp() && $firstOutBelongsToPreviousNight) {
            continue;
        }

        foreach ($shiftIds as $sid) {
            if (!isset($shiftDetailsMap[$sid])) {
                continue;
            }

            $shift = $shiftDetailsMap[$sid];
            if (empty($shift['begin']) || empty($shift['end'])) {
                continue;
            }

            $beginMinutes = (int)substr($shift['begin'], 0, 2) * 60 + (int)substr($shift['begin'], 3, 2);
            $endMinutes = (int)substr($shift['end'], 0, 2) * 60 + (int)substr($shift['end'], 3, 2);
            $crossesMidnight = !empty($shift['flexiNextDay']) || ($endMinutes <= $beginMinutes);
            $shiftBeginTs = strtotime($attendanceDate . ' ' . $shift['begin']);
            $shiftEndTsCurrent = strtotime($attendanceDate . ' ' . $shift['end']);
            $shiftEndTsNext = strtotime($nextAttendanceDate . ' ' . $shift['end']);

            if ($direction === 'OUT') {
                if ($punchDate === $attendanceDate) {
                    $windowStart = $shiftEndTsCurrent - 3600;
                    $windowEnd = $shiftEndTsCurrent + 7200;

                    if ($punchTs >= $windowStart && $punchTs <= $windowEnd) {
                        if ($crossesMidnight) {
                            continue;
                        }
                        return [
                            'direction' => 'out',
                            'time' => $punchTime,
                            'matchedShiftId' => $sid,
                            'shiftStart' => $shift['begin'],
                            'shiftEnd' => $shift['end'],
                            'shiftName' => $shift['name'] ?? null,
                        ];
                    }
                } else if ($punchDate === $nextAttendanceDate) {
                    if (!$crossesMidnight) {
                        continue;
                    }
                    if ($firstNextDayPunch === null) {
                        continue;
                    }

                    $firstPunchTs = $firstNextDayPunch['dateTime']->getTimestamp();
                    $firstPunchDirection = strtoupper($firstNextDayPunch['direction']);

                    if ($punchTs !== $firstPunchTs) {
                        continue;
                    }
                    if ($firstPunchDirection !== 'OUT') {
                        continue;
                    }

                    $windowStart = $shiftEndTsNext - 3600;
                    $windowEnd = $shiftEndTsNext + 7200;

                    if ($punchTs >= $windowStart && $punchTs <= $windowEnd) {
                        return [
                            'direction' => 'out',
                            'time' => $punchTime,
                            'matchedShiftId' => $sid,
                            'shiftStart' => $shift['begin'],
                            'shiftEnd' => $shift['end'],
                            'shiftName' => $shift['name'] ?? null,
                        ];
                    }
                }
            } else if ($direction === 'IN') {
                if ($punchDate !== $attendanceDate) {
                    continue;
                }

                $windowStart = $shiftBeginTs - 3600;
                $windowEnd = $shiftBeginTs + 3600;

                if ($punchTs >= $windowStart && $punchTs <= $windowEnd) {
                    return [
                        'direction' => 'in',
                        'time' => $punchTime,
                        'matchedShiftId' => $sid,
                        'shiftStart' => $shift['begin'],
                        'shiftEnd' => $shift['end'],
                        'shiftName' => $shift['name'] ?? null,
                    ];
                }
            }
        }
    }

    $nearestShift = null;
    $nearestDifference = PHP_INT_MAX;

    foreach ($employeePunches as $punch) {
        $punchDate = $punch['dateTime']->format('Y-m-d');
        $punchTime = $punch['dateTime']->format('H:i:s');
        $direction = strtoupper($punch['direction']);
        $punchTs = $punch['dateTime']->getTimestamp();

        if ($direction !== 'IN') {
            continue;
        }
        if ($punchDate !== $attendanceDate) {
            continue;
        }

        foreach ($shiftIds as $sid) {
            if (!isset($shiftDetailsMap[$sid])) {
                continue;
            }

            $shift = $shiftDetailsMap[$sid];
            if (empty($shift['begin']) || empty($shift['end'])) {
                continue;
            }

            $shiftReferenceTs = strtotime($attendanceDate . ' ' . $shift['begin']);
            $difference = abs($punchTs - $shiftReferenceTs);

            if ($difference < $nearestDifference) {
                $nearestDifference = $difference;
                $nearestShift = [
                    'direction' => 'in',
                    'time' => $punchTime,
                    'matchedShiftId' => $sid,
                    'shiftStart' => $shift['begin'],
                    'shiftEnd' => $shift['end'],
                    'shiftName' => $shift['name'] ?? null,
                ];
            }
        }
    }

    if ($nearestShift !== null) {
        return $nearestShift;
    }

    return null;
}


/**
 * Handle Dashboard Data Fetch (Employees, Logs, Counts)
 */
function handleDashboardData($input, $returnData = false) {
    $apiStart = microtime(true);
    if (isset($input['date_from']) && isset($input['date_to'])) {
        $dayFrom = $input['date_from'];
        $dayTo = $input['date_to'];
        $deviceFrom = (new DateTime($dayFrom))->modify('-2 day')->format('Y-m-d');
        $deviceTo = (new DateTime($dayTo))->modify('+1 day')->format('Y-m-d');
    } else {
        $month = isset($input['month']) ? intval($input['month']) : intval(date('n'));
        $year = isset($input['year']) ? intval($input['year']) : intval(date('Y'));
        $fromDay = isset($input['day_from']) ? intval($input['day_from']) : 1;
        $toDay = isset($input['day_to']) ? intval($input['day_to']) : date('t', strtotime("$year-$month-01"));
        $dayFrom = "$year-" . sprintf("%02d", $month) . "-" . sprintf("%02d", $fromDay);
        $dayTo = "$year-" . sprintf("%02d", $month) . "-" . sprintf("%02d", $toDay);
        $deviceFrom = (new DateTime($dayFrom))->modify('-2 day')->format('Y-m-d');
        $deviceTo = (new DateTime($dayTo))->modify('+1 day')->format('Y-m-d');
    }
    
    $deptName = isset($input['dept']) && $input['dept'] !== 'All' ? $input['dept'] : null;
    $compName = isset($input['company']) && $input['company'] !== 'All' ? $input['company'] : null;
    $shiftName = isset($input['shift']) && $input['shift'] !== 'All' ? $input['shift'] : null;
    $locationFilter = isset($input['location']) && $input['location'] !== 'All' ? $input['location'] : null;
    
    $conn = getSQLServer();
    
    $allTeams = getAllTeams($conn);

    $staffTeamId = null;
    $workerTeamId = null;
    $contractTeamId = null;
    $consultantTeamId = null;
    foreach ($allTeams as $tid => $tname) {
        if (strcasecmp(trim($tname ?? ''), 'Staff') === 0) $staffTeamId = $tid;
        if (strcasecmp(trim($tname ?? ''), 'Workmen') === 0) $workerTeamId = $tid;
        if (strcasecmp(trim($tname ?? ''), 'Contract') === 0) $contractTeamId = $tid;
        if (strcasecmp(trim($tname ?? ''), 'Consultant') === 0) $consultantTeamId = $tid;
    }

    $scope = resolveScope($conn, $input);
    
    $userLocations = $scope['locations'];
    $userCompanies = $scope['companies'];
    $userDepartments = $scope['departments'];

    $placeholderIds = $_SESSION['placeholderIds'] ?? [
        'designation' => [], 'department' => [], 'company' => [], 'shiftGroup' => [], 'location' => []
    ];

    $locationList = !empty($userLocations) ? implode(',', array_map('intval', $userLocations)) : '0';
    $companyList = !empty($userCompanies) ? implode(',', array_map('intval', $userCompanies)) : '0';
    $departmentList = !empty($userDepartments) ? implode(',', array_map('intval', $userDepartments)) : '0';

    // === NEW: shift group -> shift ids, and shift begin/end lookup ===
    $shiftGroupShiftIdsMap = [];
    $shiftGroupNameMap = [];
    $stmtShiftGroupShifts = sqlsrv_query($conn, "SELECT ShiftGroupId, ShiftIds, ShiftGroupName FROM ShiftGroups");
    if ($stmtShiftGroupShifts) {
        while ($r = sqlsrv_fetch_array($stmtShiftGroupShifts, SQLSRV_FETCH_ASSOC)) {
            $rawIds = $r['ShiftIds'] ?? '';
            $ids = array_filter(array_map('intval', explode(',', $rawIds)), function ($v) {
                return $v > 0;
            });
            $shiftGroupNameMap[intval($r['ShiftGroupId'])] = $r['ShiftGroupName'] ?? '';
            $shiftGroupShiftIdsMap[intval($r['ShiftGroupId'])] = array_values(array_unique($ids));
        }
    }

    $allShiftIdsNeeded = [];
    foreach ($shiftGroupShiftIdsMap as $ids) {
        foreach ($ids as $sid) {
            $allShiftIdsNeeded[$sid] = true;
        }
    }

    $shiftDetailsMap = [];
    if (!empty($allShiftIdsNeeded)) {
        $shiftIdList = implode(',', array_keys($allShiftIdsNeeded));
        $stmtShiftDetails = sqlsrv_query(
            $conn,
            "SELECT ShiftId, ShiftName, BeginTime, EndTime, IsFlexiShiftEndNextDay FROM Shifts WITH (NOLOCK) WHERE ShiftId IN ($shiftIdList)"
        );
        if ($stmtShiftDetails) {
            while ($r = sqlsrv_fetch_array($stmtShiftDetails, SQLSRV_FETCH_ASSOC)) {
                $beginRaw = $r['BeginTime'];
                $endRaw = $r['EndTime'];
                $shiftDetailsMap[(int)$r['ShiftId']] = [
                    'begin' => $beginRaw ? (is_object($beginRaw) ? $beginRaw->format('H:i:s') : $beginRaw) : null,
                    'end' => $endRaw ? (is_object($endRaw) ? $endRaw->format('H:i:s') : $endRaw) : null,
                    'flexiNextDay' => !empty($r['IsFlexiShiftEndNextDay']),
                    'name' => $r['ShiftName'] ?? null, 
                ];
            }
        }
    }

    // department as per location headcount
    $deptNameMap = [];
    $deptLocHcMap = [];

    $sqlDeptLocHc = "SELECT DL.DepartmentId, DL.LocationId, DL.StandardHeadCount, D.DepartmentFName FROM DepartmentLocationHeadCount DL WITH (NOLOCK) INNER JOIN Departments D WITH (NOLOCK) ON DL.DepartmentId = D.DepartmentId WHERE DL.LocationId IN ($locationList) AND DL.DepartmentId IN ($departmentList)";

    $stmtDeptLocHc = sqlsrv_query($conn, $sqlDeptLocHc);

    if ($stmtDeptLocHc) {
        while ($row = sqlsrv_fetch_array($stmtDeptLocHc, SQLSRV_FETCH_ASSOC)) {
            $deptId = (int)$row['DepartmentId'];
            $locId = (int)$row['LocationId'];
            $deptLocHcMap[$deptId][$locId] = (int)$row['StandardHeadCount'];
            $deptNameMap[$deptId] = $row['DepartmentFName'];
        }
    }

    $desigLocHcMap = [];
    $designationNameMap = [];

    $sqlDesigLocHc = "SELECT DDL.DepartmentId, DDL.DesignationId, DDL.LocationId, DDL.StandardHeadCount, DG.DesignationsName FROM DepartmentDesignationLocationHeadCount DDL WITH (NOLOCK) INNER JOIN Designations DG WITH (NOLOCK) ON DDL.DesignationId = DG.DesignationId WHERE DDL.LocationId IN ($locationList) AND DDL.DepartmentId IN ($departmentList)";

    $stmtDesigLocHc = sqlsrv_query($conn, $sqlDesigLocHc);

    if ($stmtDesigLocHc) {
        while ($row = sqlsrv_fetch_array($stmtDesigLocHc, SQLSRV_FETCH_ASSOC)) {
            $deptId = (int)$row['DepartmentId'];
            $desigId = (int)$row['DesignationId'];
            $locId = (int)$row['LocationId'];
            $desigLocHcMap[$deptId][$desigId][$locId] = (int)$row['StandardHeadCount'];
            $designationNameMap[$desigId] = $row['DesignationsName'];
        }
    }

    $locationNameMap = [];
    $stmtLocNames = sqlsrv_query($conn, "SELECT LocationId, LocationName FROM Locations WITH (NOLOCK) WHERE LocationId IN ($locationList)");
    if ($stmtLocNames) {
        while ($row = sqlsrv_fetch_array($stmtLocNames, SQLSRV_FETCH_ASSOC)) {
            $locationNameMap[intval($row['LocationId'])] = $row['LocationName'];
        }
    }

    $locationMachineMap = [];
    $stmtMachines = sqlsrv_query($conn, "SELECT LocationId, TotalMachines FROM LocationMachineStdCount WITH (NOLOCK) WHERE LocationId IN ($locationList)");
    if ($stmtMachines) {
        while ($row = sqlsrv_fetch_array($stmtMachines, SQLSRV_FETCH_ASSOC)) {
            $locationMachineMap[(int)$row['LocationId']] = (int)$row['TotalMachines'];
        }
    }

    $locationScope = [
        'count' => count($userLocations),
        'locations' => array_map(function ($locId) use ($locationNameMap) {
            return [
                'locationId' => intval($locId),
                'locationName' => $locationNameMap[intval($locId)] ?? ('Location ' . $locId)
            ];
        }, $userLocations)
    ];

    $zoneMap = [];
    
    $stmt = sqlsrv_query($conn, "SELECT ZoneId, ZoneName FROM Zones WITH (NOLOCK)");

    while ($row = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC)) {
        $zoneName = strtoupper(trim($row['ZoneName'] ?? ''));

        switch ($zoneName) {
            case 'CONTRACTOR':
                $category = 'CONTRACTOR';
                break;
            case 'ONROLL':
                $category = 'ON-ROLL';
                break;
            case 'CC':
                $category = 'CC';
                break;
            case 'AUDITOR':
                $category = 'AUDITOR';
                break;
            case 'OUTSOURCE':
                $category = 'OUTSOURCE';
                break;
            default:
                $category = 'OTHER';
                break;
        }

        $zoneMap[(int)$row['ZoneId']] = $category;
    }

    $employeeStart = microtime(true);

    $sqlEmp = "SELECT E.EmployeeId, E.CompanyId, E.DepartmentId, E.Location AS locationId, E.ShiftGroupId, E.EmployeeName, E.EmployeeCode, E.Gender, E.DOB, E.CategoryId, E.Designation, E.DOJ, E.Team, C.ZoneId, DG.DesignationsName AS DesignationName, ISNULL(DSO.SortOrder, 0) AS designationSortOrder, ISNULL(DG.SortOrder, 0) AS designationGlobalSortOrder, C.CompanyFName AS company, C.CompanyeMail AS companyEmail, D.DepartmentFName AS dept, D.std_hc FROM Employees E WITH (NOLOCK) LEFT JOIN Companies C WITH (NOLOCK) ON E.CompanyId = C.CompanyId LEFT JOIN Departments D WITH (NOLOCK) ON E.DepartmentId = D.DepartmentId LEFT JOIN Designations DG WITH (NOLOCK) ON E.Designation = DG.DesignationId LEFT JOIN departmentDeginationSortOrder DSO WITH (NOLOCK) ON E.DepartmentId = DSO.DepartmentId AND E.Designation = DSO.DesignationId WHERE E.RecordStatus = 1 AND E.Location IN ($locationList) AND E.CompanyId IN ($companyList) AND E.DepartmentId IN ($departmentList) AND E.DOJ <= ? AND (E.Status = 'Working' OR (E.Status = 'Resigned' AND E.DOR > ?))";

    $paramsEmp = [$dayTo, $dayTo];

    $sqlEmp .= " ORDER BY CASE WHEN C.SortOrder IS NULL THEN 1 ELSE 0 END, C.SortOrder ASC, CASE WHEN D.SortOrder IS NULL THEN 1 ELSE 0 END, D.SortOrder ASC, E.EmployeeName ASC";

    $queryStart = microtime(true);
    $stmtEmp = sqlsrv_query($conn, $sqlEmp, $paramsEmp);
    $queryTime = round((microtime(true) - $queryStart) * 1000, 2);
    
    $employees = [];
    $staffEmpIds = [];
    $workerEmpIds = [];
    $contractEmpIds = [];
    $consultantEmpIds = [];
    
    if ($stmtEmp) {
        while ($row = sqlsrv_fetch_array($stmtEmp, SQLSRV_FETCH_ASSOC)) {
            $empId = (string)$row['EmployeeId'];
            $teamId = isset($row['Team']) ? (int)$row['Team'] : null;
            $teamName = $allTeams[$teamId] ?? 'No Team';

            $deptId = (int)$row['DepartmentId'];
            $designationId = (int)$row['Designation'];
            $locationId = (int)$row['locationId'];
            $shiftGroupId = (int)$row['ShiftGroupId'];
            $categoryId = (int)$row['CategoryId'];

            $companyCategory = $zoneMap[(int)$row['ZoneId']] ?? 'OTHER';

            $genderRaw = trim($row['Gender'] ?? '');
            $gender = strtoupper($genderRaw);

            if ($teamId === $staffTeamId) {
                $staffEmpIds[$empId] = true;
            } elseif ($teamId === $workerTeamId) {
                $workerEmpIds[$empId] = true;
            } elseif ($teamId === $contractTeamId) {
                $contractEmpIds[$empId] = true;
            } elseif ($teamId === $consultantTeamId) {
                $consultantEmpIds[$empId] = true;
            }

            $employees[] = [
                'id' => $empId,
                'code' => $row['EmployeeCode'],
                'name' => $row['EmployeeName'],
                'dob' => $row['DOB']->format('Y-m-d'),
                'dobRaw' => $row['DOB'] ? $row['DOB']->format('Y-m-d') : null,
                'gender' => ($gender === 'MALE' || $gender === 'M') ? 'Male' : 'Female',
                'genderRaw' => $genderRaw,
                'dept' => $row['dept'] ?: ('Dept ' . $deptId),
                'deptId' => $deptId,
                'std_hc' => (int)$row['std_hc'],
                'company' => $row['company'] ?: 'Unknown',
                'companyEmail' => $row['companyEmail'] ?? null,
                'companyCategory' => $companyCategory,
                'categoryId' => $categoryId,
                'categoryIdRaw' => $row['CategoryId'],
                'designationId' => $designationId,
                'designationRaw' => $row['Designation'],
                'designation' => $row['DesignationName'] ?: 'Staff',
                'designationNameRaw' => $row['DesignationName'],
                'designationSortOrder' => (int)($row['designationSortOrder'] ?? 0),
                'designationGlobalSortOrder' => (int)($row['designationGlobalSortOrder'] ?? 0),
                'shiftGroupId' => $shiftGroupId,
                'shiftGroupName' => $shiftGroupNameMap[$shiftGroupId] ?? 'No Shift Group',
                'shiftId' => null,
                'shift' => null,
                'shiftStart' => null,
                'shiftEnd' => null,
                'locationId' => $locationId,
                'location' => $locationNameMap[$locationId] ?? 'Head Office',
                'doj' => $row['DOJ'] ? $row['DOJ']->format('Y-m-d') : null,
                'team' => $teamId,
                'teamName' => $teamName,
            ];
        }
    }

    $dashboardEmployees = $employees;

    $employeeTime = round((microtime(true) - $employeeStart) * 1000, 2);
        
    $resignedJoinedStart = microtime(true);

    $resignedEmployees = [];

    $sqlResigned = "SELECT E.EmployeeId, E.CategoryId, E.Team, E.Location AS locationId, E.EmployeeName, E.ShiftGroupId, E.EmployeeCode, E.Gender, E.DOB, E.Designation, DG.DesignationsName AS DesignationName, C.CompanyFName AS company, D.DepartmentFName AS dept, E.DOJ, E.DOR, E.Status FROM Employees E WITH (NOLOCK) LEFT JOIN Companies C WITH (NOLOCK) ON E.CompanyId = C.CompanyId LEFT JOIN Departments D WITH (NOLOCK) ON E.DepartmentId = D.DepartmentId LEFT JOIN Designations DG WITH (NOLOCK) ON E.Designation = DG.DesignationId WHERE E.RecordStatus = 1 AND E.Location IN ($locationList) AND E.CompanyId IN ($companyList) AND E.DepartmentId IN ($departmentList) AND E.Status = 'Resigned' AND E.DOR >= ? AND E.DOR <= ?";

    $paramsResigned = [$dayFrom, $dayTo];

    if ($deptName) {
        $sqlResigned .= " AND D.DepartmentFName = ?";
        $paramsResigned[] = $deptName;
    }

    if ($compName) {
        $sqlResigned .= " AND C.CompanyFName = ?";
        $paramsResigned[] = $compName;
    }

    if ($locationFilter) {

        $locationId = array_search($locationFilter, $locationNameMap);

        if ($locationId !== false) {
            $sqlResigned .= " AND E.Location = ?";
            $paramsResigned[] = $locationId;
        }
    }

    $sqlResigned .= " ORDER BY CASE WHEN C.SortOrder IS NULL THEN 1 ELSE 0 END, C.SortOrder ASC, CASE WHEN D.SortOrder IS NULL THEN 1 ELSE 0 END, D.SortOrder ASC, E.EmployeeName ASC";

    $resignedQueryStart = microtime(true);
    $stmtResigned = sqlsrv_query($conn, $sqlResigned, $paramsResigned);
    $resignedQueryTime = round((microtime(true) - $resignedQueryStart) * 1000, 2);
    
    if ($stmtResigned) {
        while ($row = sqlsrv_fetch_array($stmtResigned, SQLSRV_FETCH_ASSOC)) {
            $empId = (string)$row['EmployeeId'];
            $teamId = isset($row['Team']) ? (int)$row['Team'] : null;
            $teamName = $allTeams[$teamId] ?? 'No Team';
            $designationId = (int)$row['Designation'];
            $shiftGroupId = (int)$row['ShiftGroupId'];
            $categoryId = (int)$row['CategoryId'];
            $locationId = (int)$row['locationId'];
            $genderRaw = trim($row['Gender'] ?? '');
            $gender = strtoupper($genderRaw);

            $resignedEmployees[] = [
                'id' => $empId,
                'code' => $row['EmployeeCode'],
                'name' => $row['EmployeeName'],
                'dob' => $row['DOB'] ? $row['DOB']->format('Y-m-d') : null,
                'gender' => ($gender === 'MALE' || $gender === 'M') ? 'Male' : 'Female',
                'dept' => $row['dept'] ?: ('Dept ' . $row['DepartmentId']),
                'company' => $row['company'] ?: 'Unknown',
                'categoryId' => $categoryId,
                'team' => $teamId,
                'teamName' => $teamName,
                'designationId' => $designationId,
                'designation' => $row['DesignationName'] ?: 'Staff',
                'shiftGroupName' => $shiftGroupNameMap[$shiftGroupId] ?? 'No Shift Group',
                'locationId' => $locationId,
                'location' => $locationNameMap[$locationId] ?? 'Head Office',
                'status' => 'Resigned',
                'doj' => $row['DOJ'] ? $row['DOJ']->format('Y-m-d') : null,
                'dor' => $row['DOR'] ? $row['DOR']->format('Y-m-d') : null
            ];
        }
    }

    $newJoinedEmployees = [];

    $sqlNewJoined = "SELECT E.EmployeeId, E.Location AS locationId, E.CategoryId, E.Team, E.ShiftGroupId, E.EmployeeName, E.EmployeeCode, E.Gender, E.DOB, E.Designation, DG.DesignationsName AS DesignationName, C.CompanyFName AS company, D.DepartmentFName AS dept, E.DOJ, E.DOR, E.Status FROM Employees E WITH (NOLOCK) LEFT JOIN Companies C WITH (NOLOCK) ON E.CompanyId = C.CompanyId LEFT JOIN Departments D WITH (NOLOCK) ON E.DepartmentId = D.DepartmentId LEFT JOIN Designations DG WITH (NOLOCK) ON E.Designation = DG.DesignationId WHERE E.RecordStatus = 1 AND E.Location IN ($locationList) AND E.CompanyId IN ($companyList) AND E.DepartmentId IN ($departmentList) AND E.DOJ >= ? AND E.DOJ <= ?";

    $paramsNewJoined = [$dayFrom, $dayTo];
    if ($deptName) { 
        $sqlNewJoined .= " AND D.DepartmentFName = ?"; 
        $paramsNewJoined[] = $deptName; 
    }
    if ($compName) { 
        $sqlNewJoined .= " AND C.CompanyFName = ?"; 
        $paramsNewJoined[] = $compName; 
    }
    if ($locationFilter) {
        $locationId = array_search($locationFilter, $locationNameMap);
        if ($locationId !== false) {
            $sqlNewJoined .= " AND E.Location = ?";
            $paramsNewJoined[] = $locationId;
        }
    }

    $sqlNewJoined .= " ORDER BY CASE WHEN C.SortOrder IS NULL THEN 1 ELSE 0 END, C.SortOrder ASC, CASE WHEN D.SortOrder IS NULL THEN 1 ELSE 0 END, D.SortOrder ASC, E.EmployeeName ASC";

    $newJoinedQueryStart = microtime(true);
    $stmtNewJoined = sqlsrv_query($conn, $sqlNewJoined, $paramsNewJoined);
    $newJoinedQueryTime = round((microtime(true) - $newJoinedQueryStart) * 1000, 2);

    if ($stmtNewJoined) {
        while ($row = sqlsrv_fetch_array($stmtNewJoined, SQLSRV_FETCH_ASSOC)) {
            $empId = (string)$row['EmployeeId'];
            $teamId = isset($row['Team']) ? (int)$row['Team'] : null;
            $teamName = $allTeams[$teamId] ?? 'No Team';
            $designationId = (int)$row['Designation'];
            $shiftGroupId = (int)$row['ShiftGroupId'];
            $categoryId = (int)$row['CategoryId'];
            $locationId = (int)$row['locationId'];
            $genderRaw = trim($row['Gender'] ?? '');
            $gender = strtoupper($genderRaw);

            $newJoinedEmployees[] = [
                'id' => $empId,
                'code' => $row['EmployeeCode'],
                'name' => $row['EmployeeName'],
                'dob' => $row['DOB'] ? $row['DOB']->format('Y-m-d') : null,
                'gender' => ($gender === 'MALE' || $gender === 'M') ? 'Male' : 'Female',
                'dept' => $row['dept'] ?: ('Dept ' . $row['DepartmentId']),
                'company' => $row['company'] ?: 'Unknown',
                'categoryId' => $categoryId,
                'team' => $teamId,
                'teamName' => $teamName,
                'designationId' => $designationId,
                'designation' => $row['DesignationName'] ?: 'Staff',
                'shiftGroupName' => $shiftGroupNameMap[$shiftGroupId] ?? 'No Shift Group',
                'locationId' => $locationId,
                'location' => $locationNameMap[$locationId] ?? 'Head Office',
                'status' => $row['Status'] ?: 'Working',
                'doj' => $row['DOJ'] ? $row['DOJ']->format('Y-m-d') : null,
                'dor' => $row['DOR'] ? $row['DOR']->format('Y-m-d') : null
            ];
        }
    }

    $resignedJoinedTime = round((microtime(true) - $resignedJoinedStart) * 1000, 2);

    $allTableNames = [];
    $stmtAllTables = sqlsrv_query($conn, "SELECT name FROM sys.tables WHERE name LIKE 'AttendanceLogs_%' OR name LIKE 'DeviceLogs_%'");
    if ($stmtAllTables) {
        while ($rowT = sqlsrv_fetch_array($stmtAllTables, SQLSRV_FETCH_ASSOC)) {
            $allTableNames[$rowT['name']] = true;
        }
    }

    $attendanceStart = microtime(true);

    $logs = [];
    $shiftLearnFromDate = (clone (new DateTime($dayTo)))->modify('-45 days')->format('Y-m-d');
    $loopStartDate = min(strtotime($dayFrom), strtotime($shiftLearnFromDate));
    $curDate = new DateTime(date('Y-m-01', $loopStartDate));
    $endDate = new DateTime(date('Y-m-01', strtotime($dayTo)));

    while ($curDate <= $endDate) {
        $m = (int)$curDate->format('n');
        $y = (int)$curDate->format('Y');

        $logTable = "AttendanceLogs_{$m}_{$y}";
        $tableExists = false;
        if (!isset($allTableNames[$logTable])) {
            $logTable = "AttendanceLogs_" . sprintf("%02d", $m) . "_{$y}";
        }
        $tableExists = isset($allTableNames[$logTable]);

        if ($tableExists) {
            $sqlLogs = "SELECT A.EmployeeId, A.AttendanceDate, A.InTime, A.OutTime, A.Status, A.DetailedStatus, A.DetailedStatusCode, A.Duration, A.LateBy, A.EarlyBy, A.ComplinFreeLateBy, A.ComplinFreeEarlyBy, A.Present, A.Absent, A.WeeklyOff, A.Holiday, A.IsOnLeave, A.IsPartialDay, A.MissedInPunch, A.MissedOutPunch, A.PunchRecords, A.ReportPunchRecords, A.PunchDirections, A.ShiftId, A.InDeviceId, A.OutDeviceId, A.PunchDevicesName, A.LastUpdatedOn, A.OverTime, S.ShiftCode, S.ShiftName, S.BeginTime, S.EndTime FROM $logTable A WITH (NOLOCK) INNER JOIN Employees E WITH (NOLOCK) ON A.EmployeeId = E.EmployeeId LEFT JOIN Shifts S WITH (NOLOCK) ON A.ShiftId = S.ShiftId LEFT JOIN Departments D WITH (NOLOCK) ON E.DepartmentId = D.DepartmentId LEFT JOIN Companies C WITH (NOLOCK) ON E.CompanyId = C.CompanyId WHERE E.Location IN ($locationList) AND E.CompanyId IN ($companyList) AND E.DepartmentId IN ($departmentList) AND A.AttendanceDate >= '$dayFrom' AND A.AttendanceDate <= '$dayTo 23:59:59' AND (E.Status = 'Working' OR (E.Status = 'Resigned' AND E.DOR > ?))";

            $paramsLogs = [$dayTo];

            if ($deptName) {
                $sqlLogs .= " AND D.DepartmentFName = ?";
                $paramsLogs[] = $deptName;
            }

            if ($compName) {
                $sqlLogs .= " AND C.CompanyFName = ?";
                $paramsLogs[] = $compName;
            }

            if ($locationFilter) {
                $locationId = array_search($locationFilter, $locationNameMap);
                if ($locationId !== false) {
                    $sqlLogs .= " AND E.Location = ?";
                    $paramsLogs[] = $locationId;
                }
            }

            $stmtLogs = sqlsrv_query($conn, $sqlLogs, $paramsLogs);
            
            if ($stmtLogs) {
                while ($row = sqlsrv_fetch_array($stmtLogs, SQLSRV_FETCH_ASSOC)) {
                    $empId = (string)$row['EmployeeId'];
                    $attendanceDate = $row['AttendanceDate'];
                    $inTime = $row['InTime'];
                    $outTime = $row['OutTime'];
                    $beginTime = $row['BeginTime'];
                    $endTime = $row['EndTime'];
                    $lastUpdated = $row['LastUpdatedOn'];
                    $status = $row['Status'] ?: 'Absent';
                    $present = (float)$row['Present'];
                    $absent = (float)$row['Absent'];
                    $weeklyOff = (int)$row['WeeklyOff'];
                    $holiday = (int)$row['Holiday'];
                    $isOnLeave = (int)$row['IsOnLeave'];
                    $isPartialDay = (int)$row['IsPartialDay'];
                    $lateBy = (int)$row['LateBy'];
                    $earlyBy = (int)$row['EarlyBy'];
                    $missedInPunch = (int)$row['MissedInPunch'];
                    $missedOutPunch = (int)$row['MissedOutPunch'];
                    $shiftId = (int)$row['ShiftId'];
                    $inDeviceId = (int)($row['InDeviceId'] ?? 0);
                    $outDeviceId = (int)($row['OutDeviceId'] ?? 0);
                    $hoursWorked = round(((float)$row['Duration']) / 60, 2);
                    $detailedStatus = trim($row['DetailedStatus'] ?? '');
                    $detailedStatusCode = strtoupper(trim($row['DetailedStatusCode'] ?? ''));
                    $punchRecords = trim($row['PunchRecords'] ?? '');
                    $reportPunchRecords = trim($row['ReportPunchRecords'] ?? '');
                    $punchDirections = trim($row['PunchDirections'] ?? '');
                    $punchDevicesName = trim($row['PunchDevicesName'] ?? '');

                    $logs[] = [
                        'empId' => $empId,
                        'date' => $attendanceDate ? $attendanceDate->format('Y-m-d') : null,
                        'inTime' => $inTime ? (is_object($inTime) ? $inTime->format('H:i:s') : $inTime) : null,
                        'outTime' => $outTime ? (is_object($outTime) ? $outTime->format('H:i:s') : $outTime) : null,
                        'status' => $status,
                        'detailedStatus' => $detailedStatus,
                        'detailedStatusCode' => $detailedStatusCode,
                        'present' => $present,
                        'absent' => $absent,
                        'weeklyOff' => $weeklyOff,
                        'holiday' => $holiday,
                        'isOnLeave' => $isOnLeave,
                        'isPartialDay' => $isPartialDay,
                        'hoursWorked' => $hoursWorked,
                        'lateBy' => $lateBy,
                        'earlyBy' => $earlyBy,
                        'missedInPunch' => $missedInPunch,
                        'missedOutPunch' => $missedOutPunch,
                        'punchRecords' => $punchRecords,
                        'reportPunchRecords' => $reportPunchRecords,
                        'punchDirections' => $punchDirections,
                        'shiftId' => $shiftId,
                        'shiftName' => $row['ShiftName'],
                        'shiftCode' => $row['ShiftCode'],
                        'shiftStart' => $beginTime ? (is_object($beginTime) ? $beginTime->format('H:i') : $beginTime) : null,
                        'shiftEnd' => $endTime ? (is_object($endTime) ? $endTime->format('H:i') : $endTime) : null,
                        'inDeviceId' => $inDeviceId,
                        'outDeviceId' => $outDeviceId,
                        'punchDevicesName' => $punchDevicesName,
                        'lastUpdatedOn' => $lastUpdated ? (is_object($lastUpdated) ? $lastUpdated->format('Y-m-d H:i:s') : $lastUpdated) : null,
                        'isManualPunch' => ($inDeviceId === 5 || $outDeviceId === 5) ? 1 : 0,
                        'overtime' => (int)($row['OverTime'] ?? 0),
                    ];
                }
            }
        }

        $curDate->modify('+1 month');
    }

    $attendanceTime = round((microtime(true) - $attendanceStart) * 1000, 2);

    // 3. Device Counts
    $deviceStart = microtime(true);

    $deviceEmployeeStats = [];
    $counts = ['in' => 0, 'out' => 0];
    $devTables = [];

    $curDate = new DateTime(date('Y-m-01', strtotime($deviceFrom)));
    $endDate = new DateTime(date('Y-m-01', strtotime($deviceTo)));
    
    while ($curDate <= $endDate) {
        $m = (int)$curDate->format('n');
        $y = (int)$curDate->format('Y');

        $devTable = "DeviceLogs_{$m}_{$y}";
        $tableExists = false;
        if (!isset($allTableNames[$devTable])) {
            $devTable = "DeviceLogs_" . sprintf("%02d", $m) . "_{$y}";
        }

        $tableExists = isset($allTableNames[$devTable]);

        if ($tableExists) {
            $devTables[] = $devTable;

            $sqlDevRaw = "SELECT D.AttDirection, D.LogDate, CAST(D.LogDate AS DATE) AS PunchDate, E.EmployeeId FROM $devTable D WITH (NOLOCK) INNER JOIN Employees E WITH (NOLOCK) ON CAST(D.UserId AS VARCHAR(50)) = CAST(E.EmployeeCodeInDevice AS VARCHAR(50)) LEFT JOIN Departments De WITH (NOLOCK) ON E.DepartmentId = De.DepartmentId LEFT JOIN Companies C WITH (NOLOCK) ON E.CompanyId = C.CompanyId LEFT JOIN Locations L WITH (NOLOCK) ON E.Location = L.LocationId WHERE E.Location IN ($locationList) AND E.CompanyId IN ($companyList) AND E.DepartmentId IN ($departmentList) AND D.LogDate >= '$deviceFrom' AND D.LogDate <= '$deviceTo 23:59:59' AND (E.Status = 'Working' OR (E.Status = 'Resigned' AND E.DOR > ?)) AND E.RecordStatus = 1";

            $paramsDevRaw = [$dayTo];

            if ($deptName) {
                $sqlDevRaw .= " AND De.DepartmentFName = ?";
                $paramsDevRaw[] = $deptName;
            }

            if ($compName) {
                $sqlDevRaw .= " AND C.CompanyFName = ?";
                $paramsDevRaw[] = $compName;
            }

            if ($locationFilter) {
                $sqlDevRaw .= " AND L.LocationName = ?";
                $paramsDevRaw[] = $locationFilter;
            }

            $stmtDevRaw = sqlsrv_query($conn, $sqlDevRaw, $paramsDevRaw);

            if ($stmtDevRaw) {
                while ($row = sqlsrv_fetch_array($stmtDevRaw, SQLSRV_FETCH_ASSOC)) {
                    $dir = trim($row['AttDirection'] ?? '');
                    $isIn = (strcasecmp($dir, 'in') == 0 || $dir === '0');
                    $isOut = (strcasecmp($dir, 'out') == 0 || $dir === '1');

                    $empId = (string)$row['EmployeeId'];

                    $rowDateStr = $row['LogDate']->format('Y-m-d');

                    // if ($rowDateStr < $dayFrom || $rowDateStr > $dayTo) {
                        // continue;
                    // }

                    $key = $empId . '_' . $rowDateStr;

                    if (!isset($deviceEmployeeStats[$key])) {
                        $deviceEmployeeStats[$key] = [
                            'punchCount' => 0,
                            'inCount' => 0,
                            'outCount' => 0,
                            'firstIn' => null,
                            'lastOut' => null,
                            'inTimes' => [],
                            'outTimes' => [],
                            'punches' => [],
                            'firstPunch' => $row['LogDate'],
                            'lastPunch' => $row['LogDate']
                        ];
                    }

                    $deviceEmployeeStats[$key]['punchCount']++;

                    $deviceEmployeeStats[$key]['punches'][] = [
                        'dateTime'  => clone $row['LogDate'],
                        'direction' => strtoupper(trim($row['AttDirection'])),
                    ];

                    if ($isIn) {
                        $deviceEmployeeStats[$key]['inCount']++;
                        $deviceEmployeeStats[$key]['inTimes'][] = $row['LogDate'];
                        if ($deviceEmployeeStats[$key]['firstIn'] === null || $row['LogDate'] < $deviceEmployeeStats[$key]['firstIn']) {
                            $deviceEmployeeStats[$key]['firstIn'] = $row['LogDate'];
                        }
                    }

                    if ($isOut) {
                        $deviceEmployeeStats[$key]['outCount']++;
                        $deviceEmployeeStats[$key]['outTimes'][] = $row['LogDate'];
                        if ($deviceEmployeeStats[$key]['lastOut'] === null || $row['LogDate'] > $deviceEmployeeStats[$key]['lastOut']) {
                            $deviceEmployeeStats[$key]['lastOut'] = $row['LogDate'];
                        }
                    }

                    if ($row['LogDate'] < $deviceEmployeeStats[$key]['firstPunch']) {
                        $deviceEmployeeStats[$key]['firstPunch'] = $row['LogDate'];
                    }

                    if ($row['LogDate'] > $deviceEmployeeStats[$key]['lastPunch']) {
                        $deviceEmployeeStats[$key]['lastPunch'] = $row['LogDate'];
                    }
                }
            }
        }

        $curDate->modify('+1 month');
    }

    $deviceTime = round((microtime(true) - $deviceStart) * 1000, 2);

    $empShiftFromLogs = [];
    $employeesInAttendanceLogs = [];
    $presentRecordCount = 0;

    foreach ($logs as $log) {
        if (!empty($log['shiftId']) && !isset($empShiftFromLogs[$log['empId']])) {
            $empShiftFromLogs[$log['empId']] = [
                'shiftId' => $log['shiftId'],
                'shift' => $log['shiftName'],
                'shiftStart' => $log['shiftStart'],
                'shiftEnd' => $log['shiftEnd'],
            ];
        }

        $key = $log['empId'] . '_' . $log['date'];
        $employeesInAttendanceLogs[$key] = true;

        if ((float)$log['present'] == 1 && (float)$log['absent'] == 0) {
            $presentRecordCount++;
        }
    }
    
    $filteredEmployees = [];
    $validEmpIdSet = [];

    if ($shiftName) {
        $staffEmpIds = [];
        $workerEmpIds = [];
        $contractEmpIds = [];
        $consultantEmpIds = [];
    }

    foreach ($employees as $emp) {
        if (isset($empShiftFromLogs[$emp['id']])) {
            $emp['shiftId'] = $empShiftFromLogs[$emp['id']]['shiftId'];
            $emp['shift'] = $empShiftFromLogs[$emp['id']]['shift'];
            $emp['shiftStart'] = $empShiftFromLogs[$emp['id']]['shiftStart'];
            $emp['shiftEnd'] = $empShiftFromLogs[$emp['id']]['shiftEnd'];
        }

        if ($shiftName && $emp['shift'] !== $shiftName) {
            continue;
        }

        if ($shiftName) {
            $teamId = $emp['team'];
            if ($teamId === $staffTeamId) {
                $staffEmpIds[$emp['id']] = true;
            } elseif ($teamId === $workerTeamId) {
                $workerEmpIds[$emp['id']] = true;
            } elseif ($teamId === $contractTeamId) {
                $contractEmpIds[$emp['id']] = true;
            } elseif ($teamId === $consultantTeamId) {
                $consultantEmpIds[$emp['id']] = true;
            }
        }

        $deptId  = $emp['deptId'];
        $locId   = $emp['locationId'];
        $desigId = $emp['designationId'];

        // Department headcount
        if (!isset($deptLocAvailableMap[$deptId][$locId])) {
            $deptLocAvailableMap[$deptId][$locId] = 0;
        }
        $deptLocAvailableMap[$deptId][$locId]++;

        // Designation headcount
        if (!isset($desigLocAvailableMap[$deptId][$desigId][$locId])) {
            $desigLocAvailableMap[$deptId][$desigId][$locId] = 0;
        }
        $desigLocAvailableMap[$deptId][$desigId][$locId]++;

        // Build valid employee set here
        $validEmpIdSet[$emp['id']] = true;

        $filteredEmployees[] = $emp;
    }

    $deptLocHeadcountMap = [];
    foreach ($deptLocHcMap as $deptId => $locMap) {
        foreach ($locMap as $locId => $req) {
            $deptLocHeadcountMap[$deptId][$locId] = [
                'deptName' => $deptNameMap[$deptId] ?? ('Dept ' . $deptId),
                'locationName' => $locationNameMap[$locId] ?? ('Location ' . $locId),
                'required' => $req,
                'available' => $deptLocAvailableMap[$deptId][$locId] ?? 0
            ];
        }
    }
    
    $employees = $filteredEmployees;
    $totalEmployees = count($employees);

    $NewFilteredEmployees = $employees;

    if ($deptName || $compName || $locationFilter) {
        $NewFilteredEmployees = [];
        foreach ($employees as $emp) {
            if ($deptName && $emp['dept'] !== $deptName) {
                continue;
            }
            if ($compName && $emp['company'] !== $compName) {
                continue;
            }
            if ($locationFilter && $emp['location'] !== $locationFilter) {
                continue;
            }

            $NewFilteredEmployees[] = $emp;
        }
    }

    // Designation-level headcount, per dept + location
    $desigLocHeadcountMap = []; 
    foreach ($desigLocHcMap as $deptId => $desigMap) {
        foreach ($desigMap as $desigId => $locMap) {
            foreach ($locMap as $locId => $req) {
                $desigLocHeadcountMap[$deptId][$desigId][$locId] = [
                    'deptName' => $deptNameMap[$deptId] ?? ('Dept ' . $deptId),
                    'designationName' => $designationNameMap[$desigId] ?? ('Designation ' . $desigId),
                    'locationName' => $locationNameMap[$locId] ?? ('Location ' . $locId),
                    'required' => $req,
                    'available' => $desigLocAvailableMap[$deptId][$desigId][$locId] ?? 0
                ];
            }
        }
    }

    $totalRequiredHeadcount = 0;
    $requiredHeadcountByDept = [];      
    $requiredHeadcountByLocation = [];  

    foreach ($deptLocHeadcountMap as $deptId => $locMap) {
        $deptName = null;
        $deptReq = 0;
        $deptAvail = 0;

        foreach ($locMap as $locId => $info) {
            $deptName = $info['deptName'];
            $deptReq += $info['required'];
            $deptAvail += $info['available'];
            $totalRequiredHeadcount += $info['required'];

            if (!isset($requiredHeadcountByLocation[$locId])) {
                $requiredHeadcountByLocation[$locId] = [
                    'machines' => $locationMachineMap[$locId] ?? 0,
                    'locationId' => $locId,
                    'locationName' => $info['locationName'],
                    'required' => 0,
                    'available' => 0,
                    'departments' => []
                ];
            }
            $requiredHeadcountByLocation[$locId]['required'] += $info['required'];
            $requiredHeadcountByLocation[$locId]['available'] += $info['available'];
            $requiredHeadcountByLocation[$locId]['departments'][$info['deptName']] = [
                'required' => $info['required'],
                'available' => $info['available'],
                'gap' => $info['required'] - $info['available']
            ];
        }

        $requiredHeadcountByDept[$deptName] = [
            'required' => $deptReq,
            'available' => $deptAvail,
            'gap' => $deptReq - $deptAvail
        ];
    }

    foreach ($desigLocHeadcountMap as $deptId => $desigMap) {
        foreach ($desigMap as $desigId => $locMap) {
            foreach ($locMap as $locId => $info) {
                if (!isset($requiredHeadcountByLocation[$locId]['designations'])) {
                    $requiredHeadcountByLocation[$locId]['designations'] = [];
                }

                $requiredHeadcountByLocation[$locId]['designations'][] = [
                    'deptName' => $info['deptName'],
                    'designationName' => $info['designationName'],
                    'required' => $info['required'],
                    'available' => $info['available'],
                    'gap' => $info['required'] - $info['available']
                ];
            }
        }
    }

    foreach ($requiredHeadcountByLocation as &$locData) {
        $locData['gap'] = $locData['required'] - $locData['available'];
        $locData['designations'] = $locData['designations'] ?? [];
    }
    unset($locData);

    $requiredHeadcountByLocation = array_values($requiredHeadcountByLocation);

    $totalMachines = 0;
    foreach ($requiredHeadcountByLocation as $locData) {
        $totalMachines += $locData['machines'] ?? 0;
    }

    $requiredHeadcountByLocation = array_values($requiredHeadcountByLocation);

    $totalGapHeadcount = $totalRequiredHeadcount - $totalEmployees;

    $devicePresentDayCount = 0;
    $counts = ['in' => 0, 'out' => 0];
    foreach ($deviceEmployeeStats as $key => $stat) {
        list($empId, $date) = explode('_', $key, 2);

        // user's actually-selected range — not the padded deviceFrom/deviceTo window
        if ($date < $dayFrom || $date > $dayTo) {
            continue;
        }

        // Device IN/OUT counts
        if (isset($validEmpIdSet[$empId]) && $date >= $dayFrom && $date <= $dayTo) {
            $counts['in'] += $stat['inCount'] ?? 0;
            $counts['out'] += $stat['outCount'] ?? 0;
        }

        // Skip if attendance already exists
        if (isset($employeesInAttendanceLogs[$key])) {
            continue;
        }

        // Skip incomplete punches
        if (($stat['inCount'] ?? 0) < 1 || ($stat['outCount'] ?? 0) < 1) {
            continue;
        }

        $hasOut = ($stat['outCount'] ?? 0) >= 1;
        $devInTime = $stat['firstIn'] ? $stat['firstIn']->format('H:i') : null;

        $logs[] = [
            'empId' => $empId,
            'date' => $date,
            'inTime' => $devInTime,
            'outTime' => $hasOut ? $stat['lastOut']->format('H:i') : null,
            'status' => 'Device Present',
            'detailedStatus' => 'Device Present',
            'detailedStatusCode' => 'D.P',
            'present' => 1,
            'weeklyOff' => 0,
            'holiday' => 0,
            'isOnLeave' => 0,
            'absent' => 0,
            'isPartialDay' => 0,
            'hoursWorked' => ($hasOut && $stat['firstIn']) ? round(($stat['lastOut']->getTimestamp() - $stat['firstIn']->getTimestamp()) / 3600, 2) : 0,
            'lateBy' => 0,
            'earlyBy' => 0,
            'missedInPunch' => 0,
            'missedOutPunch' => 0,
            'shiftId' => 3,
            'shiftName' => 'No Shift',
            'shiftCode' => 'NS',
            'shiftStart' => null,
            'shiftEnd' => null,
            'overtime' => 0,
        ];

        $employeesInAttendanceLogs[$key] = true;
        $devicePresentDayCount++;
    }

    $presentEmployees = $presentRecordCount + $devicePresentDayCount;
    $dataSource = 'attendance+device';

    $singlePunch = 0;
    $singlePunchKeys = [];
    $singlePunchData = [];
    
    $lateIn = 0;
    $earlyOut = 0;
    $totalHours = 0;
    $hoursCount = 0;
    $manualPunchCount = 0;

    $today = date('Y-m-d');

    $empShiftGroupMap = [];
    foreach ($dashboardEmployees as $e) {
        $empShiftGroupMap[$e['id']] = $e['shiftGroupId'];
    }

    foreach ($logs as $log) {
        if (($log['lateBy'] ?? 0) > 0) {
            $lateIn++;
        }
        if (($log['earlyBy'] ?? 0) > 0) {
            $earlyOut++;
        }

        $totalHours += floatval($log['hoursWorked']);

        if ($log['hoursWorked'] > 0) {
            $hoursCount++;
        }
         if (!empty($log['isManualPunch'])) {  
            $manualPunchCount++;              
        }

        $key = $log['empId'] . '_' . $log['date'];
        if (!isset($validEmpIdSet[$log['empId']])) {
            continue;
        }

        $present = (float)$log['present'];
        $absent  = (float)$log['absent'];
        // Skip Weekly Off records
        if ($present == 0 && $absent == 0 && (int)$log['weeklyOff'] === 1) {
            continue;
        }

        if (isset($singlePunchData[$key])) {
            continue;
        }

        $hasInTime = !empty($log['inTime']) && $log['inTime'] !== '00:00' && $log['inTime'] !== '00:00:00';
        $hasOutTime = !empty($log['outTime']) && $log['outTime'] !== '00:00' && $log['outTime'] !== '00:00:00';

        if ($hasInTime && $hasOutTime) {
            continue;
        }

        $punchRecords = trim($log['reportPunchRecords'] ?? '');
        if ($punchRecords === '') {
            continue;
        }

        $punchRecordsLower = strtolower($punchRecords);

        $inCount = substr_count($punchRecordsLower, '(in)');
        $outCount = substr_count($punchRecordsLower, '(out)');
        $totalPunches = $inCount + $outCount;

        if ($totalPunches !== 1) {
            continue;
        }

        if ($inCount === 1) {
            preg_match('/(\d{2}:\d{2}:\d{2})\(in\)/i', $punchRecords, $matches);
            $punchTime = $matches[1] ?? null;

            if (!$punchTime) {
                continue;
            }

            $singlePunch++;
            $singlePunchKeys[] = $key;

            $singlePunchData[$key] = [
                'time' => $punchTime,
                'direction' => 'in',
                'shiftStart' => $log['shiftStart'] ?? null,
                'shiftEnd' => $log['shiftEnd'] ?? null,
                'shiftId' => $log['shiftId'] ?? null,
                'shiftName' => $log['shiftName'] ?? null,
                'shiftGroupId' => $empShiftGroupMap[$log['empId']] ?? null,
                'shiftGroupName' => $shiftGroupNameMap[$empShiftGroupMap[$log['empId']] ?? 0] ?? null,
            ];

            continue;
        }

        preg_match('/(\d{2}:\d{2}:\d{2})\(out\)/i', $punchRecords, $matches);
        $punchTime = $matches[1] ?? null;

        if (!$punchTime) {
            continue;
        }

        $singlePunch++;
        $singlePunchKeys[] = $key;

        $singlePunchData[$key] = [
            'time' => $punchTime,
            'direction' => 'out',
            'shiftStart' => $log['shiftStart'] ?? null,
            'shiftEnd' => $log['shiftEnd'] ?? null,
            'shiftGroupId' => $empShiftGroupMap[$log['empId']] ?? null,
            'shiftGroupName' => $shiftGroupNameMap[$empShiftGroupMap[$log['empId']] ?? 0] ?? null,
        ];
    }

    $remainingAbsentLogs = [];
    foreach ($logs as $log) {
        $key = $log['empId'] . '_' . $log['date'];
        if (isset($singlePunchData[$key])) {
            continue;
        }
        if (!isset($validEmpIdSet[$log['empId']])) {
            continue;
        }
        $code = normalizeStatusCode($log['detailedStatusCode'] ?? '');
        if (!in_array($code, ['A', 'ALD', 'WOA'], true)) {
            continue;
        }
        $remainingAbsentLogs[] = $log;
    }

    // single punch fallback start
    foreach ($remainingAbsentLogs as $log) {
        $key = $log['empId'] . '_' . $log['date'];

        $shiftGroupId = $empShiftGroupMap[$log['empId']] ?? null;
        $shiftIds = $shiftGroupId !== null
            ? ($shiftGroupShiftIdsMap[$shiftGroupId] ?? [])
            : [];

        if (empty($shiftIds)) {
            continue;
        }

        $currentKey = $log['empId'] . '_' . $log['date'];

        $nextDate = date('Y-m-d', strtotime($log['date'] . ' +1 day'));
        $nextKey = $log['empId'] . '_' . $nextDate;

        $employeePunches = [];

        // Current date punches
        if (isset($deviceEmployeeStats[$currentKey]['punches'])) {
            $employeePunches = array_merge(
                $employeePunches,
                $deviceEmployeeStats[$currentKey]['punches']
            );
        }

        // Next date punches
        if (isset($deviceEmployeeStats[$nextKey]['punches'])) {
            $employeePunches = array_merge(
                $employeePunches,
                $deviceEmployeeStats[$nextKey]['punches']
            );
        }

        if (empty($employeePunches)) {
            continue;
        }

        usort($employeePunches, function ($a, $b) {
            return $a['dateTime'] <=> $b['dateTime'];
        });

        $match = findNearShiftPunch($employeePunches, $log['empId'], $log['date'], $shiftIds, $shiftDetailsMap);

        if (!$match) {
            continue;
        }

        $singlePunch++;
        $singlePunchKeys[] = $key;

        $singlePunchData[$key] = [
            'time'            => $match['time'],
            'direction'       => $match['direction'],
            'shiftStart'      => $log['shiftStart'] ?? null,
            'shiftEnd'        => $log['shiftEnd'] ?? null,
            'shiftId'         => $match['matchedShiftId'],
            'shiftGroupId'    => $shiftGroupId,
            'shiftGroupName'  => $shiftGroupNameMap[$shiftGroupId] ?? null,
            'matchedShiftId'  => $match['matchedShiftId'],
            'shiftName'       => $match['shiftName'] ?? null,
            'source'          => 'deviceLogFallback',
        ];
    }
    // single punch fallback end

    $avgHours = $hoursCount > 0 ? round($totalHours / $hoursCount, 2) : 0;

    $statusKeyMap = [];

    foreach ($logs as $log) {

        $key = $log['empId'] . '_' . $log['date'];

        if (isset($singlePunchData[$key])) {
            $statusKeyMap[$key] = 'singlePunch';
            continue;
        }

        $code = normalizeStatusCode($log['detailedStatusCode'] ?? '');
        $isWeeklyOff = intval($log['weeklyOff']) === 1;

        switch ($code) {
            case 'D.P':
                $statusKeyMap[$key] = 'present';
                break;

            case 'P':
                $statusKeyMap[$key] = 'present';
                break;

            case '½PLD':
            case 'L_CL':
            case '½PCL':
            case '½PLD(HO)':
                $statusKeyMap[$key] = 'halfPresent';
                break;

            case 'WO':
                $statusKeyMap[$key] = 'weeklyOff';
                break;

            case 'WOP':
                $statusKeyMap[$key] = $isWeeklyOff? 'weeklyOffPresent': 'present';
                break;

            case '½PLD(WO)':
                $statusKeyMap[$key] = $isWeeklyOff ? 'weeklyOffHalfPresent' : 'halfPresent';
                break;

            case 'A':
            case 'ALD':
            case 'WOA':
            default:
                $statusKeyMap[$key] = 'absent';
                break;
        }
    }

    foreach ($logs as &$log) {
        $key = $log['empId'] . '_' . $log['date'];
        $log['displayStatus'] = $statusKeyMap[$key] ?? 'absent';
    }
    unset($log);

    $rangeStart = new DateTime($dayFrom);
    $rangeEnd = new DateTime($dayTo);

    $deptStats = [];
    $genderStats = [];
    $ageGroupStats = [];
    $companyStats = [];
    $designationStats = [];
    $companyCategoryStats = [];
    
    $staffPresent = 0; 
    $staffHalfPresent = 0; 
    $staffAbsent = 0; 
    $staffWeeklyOff = 0;
    $staffWeeklyOffPresent = 0;
    $staffWeeklyOffHalfPresent = 0;
    $workerPresent = 0; 
    $workerHalfPresent = 0; 
    $workerAbsent = 0; 
    $workerWeeklyOff = 0;
    $workerWeeklyOffPresent = 0;
    $workerWeeklyOffHalfPresent = 0;
    $contractPresent = 0;
    $contractHalfPresent = 0;
    $contractAbsent = 0;
    $contractWeeklyOff = 0;
    $contractWeeklyOffPresent = 0;
    $contractWeeklyOffHalfPresent = 0;
    $consultantPresent = 0;
    $consultantHalfPresent = 0;
    $consultantAbsent = 0;
    $consultantWeeklyOff = 0;
    $consultantWeeklyOffPresent = 0;
    $consultantWeeklyOffHalfPresent = 0;

    $totalEmployeeDays = 0;
    $presentEmployeeDays = 0;
    $weeklyOffPresentDays = 0;
    $halfPresentEmployeeDays = 0;
    $weeklyOffHalfPresentDays = 0;
    $weeklyOffEmployeeDays = 0;
    $absentEmployeeDays = 0;
    $employeeDayStatus = [];

    for ($d = clone $rangeStart; $d <= $rangeEnd; $d->modify('+1 day')) {
        $dateStr = $d->format('Y-m-d');
        foreach ($employees as $e) {
            $totalEmployeeDays++;    
            $k = $e['id'] . '_' . $dateStr;
            $empStatus = $statusKeyMap[$k] ?? 'absent';
            $employeeDayStatus[$k] = $empStatus;

            incrementAttendanceBucket($deptStats, $e['dept'], $empStatus);
            incrementAttendanceBucket($genderStats, $e['gender'], $empStatus);
            incrementAttendanceBucket($ageGroupStats, resolveAgeGroup($e['dobRaw']), $empStatus);
            incrementAttendanceBucket($companyStats, $e['company'], $empStatus);
            incrementAttendanceBucket($designationStats, $e['designation'], $empStatus);
            incrementAttendanceBucket($companyCategoryStats, $e['companyCategory'], $empStatus);

            if ($empStatus === 'present') {
                $presentEmployeeDays++;
            } elseif ($empStatus === 'weeklyOffPresent') {
                $weeklyOffPresentDays++;
            } elseif ($empStatus === 'halfPresent') {
                $halfPresentEmployeeDays++;
            } elseif ($empStatus === 'weeklyOffHalfPresent') {
                $weeklyOffHalfPresentDays++;
            } elseif ($empStatus === 'weeklyOff') {
                $weeklyOffEmployeeDays++;
            } elseif ($empStatus === 'singlePunch') {
                // Do nothing.
                // Single Punch should not be counted as Absent.
            } else {
                $absentEmployeeDays++;
            }

            if (isset($staffEmpIds[$e['id']])) {
                if ($empStatus === 'present') {
                    $staffPresent++;
                } elseif ($empStatus === 'weeklyOffPresent') {
                    $staffWeeklyOffPresent++;
                } elseif ($empStatus === 'halfPresent') {
                    $staffHalfPresent++;
                } elseif ($empStatus === 'weeklyOffHalfPresent') {
                    $staffWeeklyOffHalfPresent++;
                } elseif ($empStatus === 'weeklyOff') {
                    $staffWeeklyOff++;
                } elseif ($empStatus === 'singlePunch') {
                    // Don't count as absent
                } else {
                    $staffAbsent++;
                }
            } if (isset($workerEmpIds[$e['id']])) {
                if ($empStatus === 'present') {
                    $workerPresent++;
                } elseif ($empStatus === 'weeklyOffPresent') {
                    $workerWeeklyOffPresent++;
                } elseif ($empStatus === 'halfPresent') {
                    $workerHalfPresent++;
                } elseif ($empStatus === 'weeklyOffHalfPresent') {
                    $workerWeeklyOffHalfPresent++;
                } elseif ($empStatus === 'weeklyOff') {
                    $workerWeeklyOff++;
                } elseif ($empStatus === 'singlePunch') {
                    // Don't count as absent
                } else {
                    $workerAbsent++;
                }
            } if (isset($contractEmpIds[$e['id']])) {
                if ($empStatus === 'present') {
                    $contractPresent++;
                } elseif ($empStatus === 'weeklyOffPresent') {
                    $contractWeeklyOffPresent++;
                } elseif ($empStatus === 'halfPresent') {
                    $contractHalfPresent++;
                } elseif ($empStatus === 'weeklyOffHalfPresent') {
                    $contractWeeklyOffHalfPresent++;
                } elseif ($empStatus === 'weeklyOff') {
                    $contractWeeklyOff++;
                } elseif ($empStatus === 'singlePunch') {
                    // Don't count as absent
                } else {
                    $contractAbsent++;
                }
            } if (isset($consultantEmpIds[$e['id']])) {
                if ($empStatus === 'present') {
                    $consultantPresent++;
                } elseif ($empStatus === 'weeklyOffPresent') {
                    $consultantWeeklyOffPresent++;
                } elseif ($empStatus === 'halfPresent') {
                    $consultantHalfPresent++;
                } elseif ($empStatus === 'weeklyOffHalfPresent') {
                    $consultantWeeklyOffHalfPresent++;
                } elseif ($empStatus === 'weeklyOff') {
                    $consultantWeeklyOff++;
                } elseif ($empStatus === 'singlePunch') {
                    // Don't count as absent
                } else {
                    $consultantAbsent++;
                }
            }
        }
    }

    $presentEmployees = $presentEmployeeDays;
    $absentEmployees = $absentEmployeeDays;
    $halfPresentTotal = $halfPresentEmployeeDays;
    $weeklyOffTotal = $weeklyOffEmployeeDays;

    $shiftStats = computeShiftStats($employees, $logs, $deviceEmployeeStats, $employeesInAttendanceLogs, $dayFrom, $dayTo, $conn, $singlePunchData);

    if ($returnData) {
        return [
            'conn' => $conn,
            'employees' => $employees,
            'logs' => $logs,
            'devTables' => $devTables,
            'dayFrom' => $dayFrom,
            'dayTo' => $dayTo,
            'shiftStats' => $shiftStats,
            'resignedEmployees' => $resignedEmployees,
            'newJoinedEmployees' => $newJoinedEmployees
        ];
    }

    $totalTime = round((microtime(true) - $apiStart) * 1000, 2);

    echo json_encode([
        'success' => true,
        'performance' => [
            'employeeQueryMs'      => $queryTime,
            'employeeMs'           => $employeeTime,
            'resignedQueryMs'      => $resignedQueryTime,
            'newJoinedQueryMs'     => $newJoinedQueryTime,
            'resignedJoinedMs'     => $resignedJoinedTime,
            'attendanceMs'         => $attendanceTime,
            'deviceMs'             => $deviceTime,
            'totalMs'              => $totalTime
        ],
        'todayStats' => [
            'present' => $presentEmployees,
            'weeklyOffPresent' => $weeklyOffPresentDays,
            'halfPresent' => $halfPresentTotal,
            'weeklyOffHalfPresent' => $weeklyOffHalfPresentDays,
            'weeklyOff' => $weeklyOffTotal,
            'absent' => $absentEmployees,
            'total' => $totalEmployees,
            'singlePunch' => $singlePunch,
            'manualPunch' => $manualPunchCount,
            'lateIn' => $lateIn,
            'earlyOut' => $earlyOut,
            'avgHours' => $avgHours,
            'resigned' => count($resignedEmployees),
            'newJoined' => count($newJoinedEmployees)
        ],
        'requiredHeadcount' => $totalRequiredHeadcount,
        'totalMachines' => $totalMachines,
        'gapHeadcount' => $totalGapHeadcount,
        'requiredHeadcountByDept' => $requiredHeadcountByDept,
        'requiredHeadcountByLocation' => $requiredHeadcountByLocation,
        'teamConfig' => [
            'staffTeamId' => $staffTeamId,
            'workerTeamId' => $workerTeamId,
            'contractTeamId' => $contractTeamId,
            'consultantTeamId' => $consultantTeamId,
        ],
        'placeholderIds' => $placeholderIds,
        'singlePunchKeys' => $singlePunchKeys,
        'singlePunchData' => $singlePunchData,
        'employeeDayStatus' => $employeeDayStatus,
        'staffWorkerStats' => [
            'staffTotal' => count($staffEmpIds),
            'staffPresent' => $staffPresent,
            'staffWeeklyOffPresent' => $staffWeeklyOffPresent,
            'staffHalfPresent' => $staffHalfPresent,
            'staffWeeklyOffHalfPresent' => $staffWeeklyOffHalfPresent,
            'staffWeeklyOff' => $staffWeeklyOff,
            'staffAbsent' => $staffAbsent,
            'workerTotal' => count($workerEmpIds),
            'workerPresent' => $workerPresent,
            'workerWeeklyOffPresent' => $workerWeeklyOffPresent,
            'workerHalfPresent' => $workerHalfPresent,
            'workerWeeklyOffHalfPresent' => $workerWeeklyOffHalfPresent,
            'workerWeeklyOff' => $workerWeeklyOff,
            'workerAbsent' => $workerAbsent,
            'contractTotal' => count($contractEmpIds),
            'contractPresent' => $contractPresent,
            'contractWeeklyOffPresent' => $contractWeeklyOffPresent,
            'contractHalfPresent' => $contractHalfPresent,
            'contractWeeklyOffHalfPresent' => $contractWeeklyOffHalfPresent,
            'contractWeeklyOff' => $contractWeeklyOff,
            'contractAbsent' => $contractAbsent,
            'consultantTotal' => count($consultantEmpIds),
            'consultantPresent' => $consultantPresent,
            'consultantWeeklyOffPresent' => $consultantWeeklyOffPresent,
            'consultantHalfPresent' => $consultantHalfPresent,
            'consultantWeeklyOffHalfPresent' => $consultantWeeklyOffHalfPresent,
            'consultantWeeklyOff' => $consultantWeeklyOff,
            'consultantAbsent' => $consultantAbsent,
        ],
        
        'deptWiseStats' => $deptStats,
        'genderWiseStats' => $genderStats,
        'ageGroupWiseStats' => $ageGroupStats,
        'companyWiseStats' => $companyStats,
        'designationWiseStats' => $designationStats,
        'companyCategoryStats' => $companyCategoryStats,

        'employees' => $NewFilteredEmployees,
        'dashboardEmployees' => $dashboardEmployees,
        'attendanceLogs' => $logs,
        'counts' => $counts,
        'shiftStats' => $shiftStats,
        'resignedEmployees' => $resignedEmployees,
        'newJoinedEmployees' => $newJoinedEmployees,
        'locationScope' => $locationScope,
        'timestamp' => date('Y-m-d H:i:s'),
        'dataSource' => $dataSource
    ]);
}


function getSubAdmins() {
    if (empty($_SESSION['isMaster'])) {
        echo json_encode(['success' => false, 'message' => 'Unauthorized']);
        return;
    }

    $conn = getSQLServer();

    $sql = "SELECT UserId, LoginName, RoleName FROM SystemUsers WHERE RecordStatus = 1 AND UserId != ?";
    $stmt = sqlsrv_query($conn, $sql, [$_SESSION['userId']]);

    $userRows = [];
    if ($stmt) {
        while ($row = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC)) {
            $userRows[] = $row;  
        }
    }

    $subAdmins = [];
    foreach ($userRows as $row) {  
        $uid = intval($row['UserId']);

        $locations = [];
        $stmtLoc = sqlsrv_query($conn, "SELECT L.LocationName FROM UserLocations UL INNER JOIN Locations L ON UL.LocationId = L.LocationId WHERE UL.UserId = ?", [$uid]);
        while ($r = sqlsrv_fetch_array($stmtLoc, SQLSRV_FETCH_ASSOC)) {
            $locations[] = $r['LocationName'];
        }

        $companies = [];
        $stmtComp = sqlsrv_query($conn, "SELECT C.CompanyFName FROM UserCompanies UC INNER JOIN Companies C ON UC.CompanyId = C.CompanyId WHERE UC.UserId = ?", [$uid]);
        while ($r = sqlsrv_fetch_array($stmtComp, SQLSRV_FETCH_ASSOC)) {
            $companies[] = $r['CompanyFName'];
        }

        $departments = [];
        $stmtDept = sqlsrv_query($conn, "SELECT D.DepartmentFName FROM UserDepartments UD INNER JOIN Departments D ON UD.DepartmentId = D.DepartmentId WHERE UD.UserId = ?", [$uid]);
        while ($r = sqlsrv_fetch_array($stmtDept, SQLSRV_FETCH_ASSOC)) {
            $departments[] = $r['DepartmentFName'];
        }

        $isSubMaster = empty($locations) && empty($companies) && empty($departments);
        if ($isSubMaster) continue;

        $subAdmins[] = [
            'id' => $uid,
            'name' => $row['LoginName'],
            'role' => $row['RoleName'],
            'locations' => $locations,
            'companies' => $companies,
            'departments' => $departments,
        ];
    }

    echo json_encode(['success' => true, 'data' => $subAdmins]);
}


// Select Department - Designation mapping
function handleGetDepartmentDesignationMapping($input = []) {
    $conn = getSQLServer();

    $departments = [];
    $stmtDept = sqlsrv_query($conn, "SELECT DepartmentId, DepartmentFName FROM Departments WITH (NOLOCK) WHERE RecordStatus = 1 ORDER BY CASE WHEN SortOrder IS NULL THEN 1 ELSE 0 END, SortOrder ASC, DepartmentFName ASC");
    if ($stmtDept) {
        while ($row = sqlsrv_fetch_array($stmtDept, SQLSRV_FETCH_ASSOC)) {
            $departments[] = [
                'id' => intval($row['DepartmentId']),
                'name' => $row['DepartmentFName']
            ];
        }
    }

    $designations = [];
    $stmtDesig = sqlsrv_query($conn, "SELECT DesignationId, DesignationsName FROM Designations WITH (NOLOCK) ORDER BY CASE WHEN sortOrder IS NULL THEN 1 ELSE 0 END, sortOrder ASC, DesignationsName ASC");
    if ($stmtDesig) {
        while ($row = sqlsrv_fetch_array($stmtDesig, SQLSRV_FETCH_ASSOC)) {
            $designations[] = [
                'id' => intval($row['DesignationId']),
                'name' => $row['DesignationsName']
            ];
        }
    }

    $mappingByDept = [];
    $sqlMap = "SELECT Id, DepartmentId, DesignationId, IsActive, SortOrder FROM DepartmentDesignationMapping WITH (NOLOCK) WHERE IsActive = 1";
    $stmtMap = sqlsrv_query($conn, $sqlMap);
    if ($stmtMap) {
        while ($row = sqlsrv_fetch_array($stmtMap, SQLSRV_FETCH_ASSOC)) {
            $deptId = intval($row['DepartmentId']);
            if (!isset($mappingByDept[$deptId])) $mappingByDept[$deptId] = [];
            $mappingByDept[$deptId][] = [
                'designationId' => intval($row['DesignationId']),
                'sortOrder' => $row['SortOrder'] !== null ? intval($row['SortOrder']) : null
            ];
        }
    }

    echo json_encode([
        'success' => true,
        'departments' => $departments,
        'designations' => $designations,
        'mappingByDept' => $mappingByDept
    ]);
}


// Add Department - Designation mapping
function handleSaveDepartmentDesignationMapping($input) {
    $conn = getSQLServer();
    $items = isset($input['items']) ? $input['items'] : [];

    if (empty($items)) {
        echo json_encode(['success' => false, 'message' => 'No items to save']);
        return;
    }

    $success = true;
    $errors = [];

    foreach ($items as $item) {
        $deptId = intval($item['departmentId'] ?? 0);
        $desigId = intval($item['designationId'] ?? 0);
        $isActive = !empty($item['isActive']) ? 1 : 0;
        $sortOrder = isset($item['sortOrder']) && $item['sortOrder'] !== '' ? intval($item['sortOrder']) : null;

        if ($deptId <= 0 || $desigId <= 0) {
            $errors[] = ['departmentId' => $deptId, 'designationId' => $desigId, 'reason' => 'invalid_ids'];
            $success = false;
            continue;
        }

        $checkSql = "SELECT Id FROM DepartmentDesignationMapping WHERE DepartmentId = ? AND DesignationId = ?";
        $checkStmt = sqlsrv_query($conn, $checkSql, array($deptId, $desigId));
        $existingRow = $checkStmt ? sqlsrv_fetch_array($checkStmt, SQLSRV_FETCH_ASSOC) : null;

        if ($existingRow) {
            $sql = "UPDATE DepartmentDesignationMapping SET IsActive = ?, SortOrder = ?, UpdatedAt = GETDATE() WHERE DepartmentId = ? AND DesignationId = ?";
            $params = array($isActive, $sortOrder, $deptId, $desigId);
        } else {
            $sql = "INSERT INTO DepartmentDesignationMapping (DepartmentId, DesignationId, IsActive, SortOrder, CreatedAt) VALUES (?, ?, ?, ?, GETDATE())";
            $params = array($deptId, $desigId, $isActive, $sortOrder);
        }

        $stmt = sqlsrv_query($conn, $sql, $params);
        if (!$stmt) {
            $success = false;
            $errors[] = ['departmentId' => $deptId, 'designationId' => $desigId, 'errors' => sqlsrv_errors()];
        }
    }

    echo json_encode([
        'success' => $success,
        'message' => $success ? 'Mapping saved successfully' : 'Some mappings failed to save',
        'errors' => $errors
    ]);
}


function handleDeleteDepartmentDesignationMapping($input) {
    $conn = getSQLServer();
    $departmentId = intval($input['departmentId'] ?? 0);
    $designationId = intval($input['designationId'] ?? 0);

    if ($departmentId <= 0 || $designationId <= 0) {
        echo json_encode([
            'success' => false,
            'message' => 'Invalid Department or Designation.'
        ]);

        return;
    }

    $sql = "UPDATE DepartmentDesignationMapping SET IsActive = 0, UpdatedAt = GETDATE() WHERE DepartmentId = ? AND DesignationId = ?";

    $stmt = sqlsrv_query($conn, $sql, [$departmentId, $designationId]);

    if (!$stmt) {
        echo json_encode([
            'success' => false,
            'message' => 'Unable to remove mapping.',
            'errors' => sqlsrv_errors()
        ]);
        return;
    }

    echo json_encode([
        'success' => true,
        'message' => 'Mapping removed successfully.'
    ]);
}


/**
 * Handle Dept Report - Get STD Headcounts
 */
function handleGetStdHC($input = []) {
    $sqlConn = getSQLServer();
    $scope = resolveScope($sqlConn, $input);
    $locFilter = resolveLocationFilter($scope, $input);
    $locationList = $locFilter['list'];
    $departmentList = !empty($scope['departments']) ? implode(',', array_map('intval', $scope['departments'])) : '0';

    $sqlDepts = "SELECT D.DepartmentId, D.DepartmentFName AS DepartmentName, ISNULL(SUM(DLHC.StandardHeadCount), 0) AS std_hc FROM Departments D WITH (NOLOCK) LEFT JOIN DepartmentLocationHeadCount DLHC WITH (NOLOCK) ON DLHC.DepartmentId = D.DepartmentId AND DLHC.LocationId IN ($locationList) WHERE D.DepartmentId IN ($departmentList) GROUP BY D.DepartmentId, D.DepartmentFName, D.SortOrder ORDER BY CASE WHEN D.SortOrder IS NULL THEN 1 ELSE 0 END, D.SortOrder ASC, D.DepartmentFName ASC";

    $stmt = sqlsrv_query($sqlConn, $sqlDepts);

    $data = [];
    while ($row = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC)) {
        $data[] = [
            'dept_id' => $row['DepartmentId'],
            'department_name' => $row['DepartmentName'],
            'std_hc' => intval($row['std_hc'])
        ];
    }

    $unitConfig = [
        'unit_name' => 'PSF',
        'unit_capacity' => '150 Tons'
    ];

    if ($locFilter['isAll']) {
        $unitConfig = [
            'unit_name' => 'All Locations',
            'unit_capacity' => ''
        ];
    } else {
        $sqlLoc = "SELECT LocationName AS unit_name, unit_capacity FROM Locations WHERE LocationId = " . intval($locFilter['single']);
        $stmtLoc = sqlsrv_query($sqlConn, $sqlLoc);
        if ($stmtLoc && $rowLoc = sqlsrv_fetch_array($stmtLoc, SQLSRV_FETCH_ASSOC)) {
            $unitConfig = [
                'unit_name' => $rowLoc['unit_name'] ?: 'PSF',
                'unit_capacity' => $rowLoc['unit_capacity'] ?: '150 Tons'
            ];
        }
    }

    echo json_encode([
        'success' => true,
        'data' => $data,
        'unit_config' => $unitConfig,
        'login_name' => $_SESSION['username'] ?? ''
    ]);
}


function handleGetDesignationStdHC($input = []) {
    $sqlConn = getSQLServer();
    $scope = resolveScope($sqlConn, $input);
    $locFilter = resolveLocationFilter($scope, $input);
    $locationList = $locFilter['list'];
    $departmentList = !empty($scope['departments']) ? implode(',', array_map('intval', $scope['departments'])) : '0';

    $sqlDesig = "SELECT DDM.DepartmentId, DG.DesignationId, DG.DesignationsName, ISNULL(SUM(DDLHC.StandardHeadCount), 0) AS std_hc FROM DepartmentDesignationMapping DDM WITH (NOLOCK) INNER JOIN Designations DG WITH (NOLOCK) ON DDM.DesignationId = DG.DesignationId LEFT JOIN DepartmentDesignationLocationHeadCount DDLHC WITH (NOLOCK) ON DDLHC.DepartmentId = DDM.DepartmentId AND DDLHC.DesignationId = DDM.DesignationId AND DDLHC.LocationId IN ($locationList) WHERE DDM.IsActive = 1 AND DDM.DepartmentId IN ($departmentList) GROUP BY DDM.DepartmentId, DG.DesignationId, DG.DesignationsName, DG.SortOrder ORDER BY DDM.DepartmentId, CASE WHEN DG.SortOrder IS NULL THEN 1 ELSE 0 END, DG.SortOrder ASC, DG.DesignationsName ASC";

    $stmt = sqlsrv_query($sqlConn, $sqlDesig);

    $data = [];
    while ($row = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC)) {
        $data[] = [
            'dept_id' => intval($row['DepartmentId']),
            'designation_id' => intval($row['DesignationId']),
            'designation_name' => $row['DesignationsName'],
            'std_hc' => intval($row['std_hc'])
        ];
    }

    echo json_encode([
        'success' => true,
        'data' => $data
    ]);
}


/**
 * Bulk Update designations STD Headcounts
 */
function handleBulkUpdateDesignationStdHC($input) {
    $items = isset($input['items']) ? $input['items'] : [];
    $sqlConn = getSQLServer();

    if (empty($items)) {
        echo json_encode(['success' => false, 'message' => 'No items to save']);
        return;
    }

    $groups = [];
    foreach ($items as $item) {
        $deptId = intval($item['dept_id']);
        $desigId = intval($item['designation_id']);
        $locationId = intval($item['location_id']);
        if ($locationId <= 0) {
            continue; 
        }
        $hc = intval($item['std_hc']);

        $key = $deptId . '_' . $locationId;
        if (!isset($groups[$key])) {
            $groups[$key] = [
                'deptId' => $deptId,
                'locationId' => $locationId,
                'items' => [],
                'batchTotal' => 0
            ];
        }
        $groups[$key]['items'][$desigId] = $hc;
        $groups[$key]['batchTotal'] += $hc;
    }

    foreach ($groups as $key => $group) {
        $deptId = $group['deptId'];
        $locationId = $group['locationId'];

        foreach ($group['items'] as $desigId => $hc) {
            $checkSql = "SELECT Id FROM DepartmentDesignationLocationHeadCount WHERE DepartmentId = ? AND DesignationId = ? AND LocationId = ?";
            $checkStmt = sqlsrv_query($sqlConn, $checkSql, array($deptId, $desigId, $locationId));
            $existingRow = $checkStmt ? sqlsrv_fetch_array($checkStmt, SQLSRV_FETCH_ASSOC) : null;

            if ($existingRow) {
                $sql = "UPDATE DepartmentDesignationLocationHeadCount SET StandardHeadCount = ?, UpdatedOn = GETDATE() WHERE DepartmentId = ? AND DesignationId = ? AND LocationId = ?";
                $params = array($hc, $deptId, $desigId, $locationId);
            } else {
                $sql = "INSERT INTO DepartmentDesignationLocationHeadCount (DepartmentId, DesignationId, LocationId, StandardHeadCount, CreatedOn) VALUES (?, ?, ?, ?, GETDATE())";
                $params = array($deptId, $desigId, $locationId, $hc);
            }
            sqlsrv_query($sqlConn, $sql, $params);
        }

        $totalStdHC = 0;

        $sqlTotal = "SELECT ISNULL(SUM(StandardHeadCount),0) AS TotalHC FROM DepartmentDesignationLocationHeadCount WHERE DepartmentId = ? AND LocationId = ?";

        $stmtTotal = sqlsrv_query($sqlConn, $sqlTotal, array($deptId, $locationId));

        if ($rowTotal = sqlsrv_fetch_array($stmtTotal, SQLSRV_FETCH_ASSOC)) {
            $totalStdHC = intval($rowTotal['TotalHC']);
        }
        
        $checkDeptSql = "SELECT Id
        FROM DepartmentLocationHeadCount
        WHERE DepartmentId = ? AND LocationId = ?";

        $checkDeptStmt = sqlsrv_query($sqlConn, $checkDeptSql, array($deptId, $locationId));

        $deptRow = $checkDeptStmt ? sqlsrv_fetch_array($checkDeptStmt, SQLSRV_FETCH_ASSOC) : null;

        if ($deptRow) {
            sqlsrv_query($sqlConn, "UPDATE DepartmentLocationHeadCount SET StandardHeadCount = ?, UpdatedOn = GETDATE() WHERE DepartmentId = ? AND LocationId = ?", array($totalStdHC, $deptId, $locationId));
        } else {
            sqlsrv_query($sqlConn, "INSERT INTO DepartmentLocationHeadCount (DepartmentId, LocationId, StandardHeadCount, CreatedOn) VALUES (?, ?, ?, GETDATE())", array($deptId, $locationId, $totalStdHC));
        }
    }

    echo json_encode([
        'success' => true,
        'message' => 'Designation Standard Head Count saved successfully.'
    ]);
}


// >>> NEW: add this small helper function ABOVE handleGetReport (outside it), once.
function resolveAttendanceStatusCode($detailedStatusCode, $isWeeklyOff) {
    $code = strtoupper(trim($detailedStatusCode ?? ''));
    $isWeeklyOff = intval($isWeeklyOff) === 1;

    switch ($code) {
        case 'P':
        case 'WOP':
            return $isWeeklyOff ? 'WOP' : 'P';

        case '½PLD':
        case 'L_CL':
        case '½PCL':
        case '½PLD(HO)':
        case '½PLD(WO)':
            return $isWeeklyOff ? 'WOHP' : 'HD';

        case 'WO':
            return 'WO';

        case 'A':
        case 'ALD':
        case 'WOA':
        default:
            return 'A';
    }
}


function isSinglePunchDay($rec) {
    if (!empty($rec['forceSP'])) {
        return true;
    }

    if (floatval($rec['present'] ?? 0) == 0 && floatval($rec['absent'] ?? 0) == 0 && intval($rec['wo'] ?? 0) == 1) {
        return false;
    }

    $hasInTime = !empty($rec['inTime']) && $rec['inTime'] !== '00:00' && $rec['inTime'] !== '00:00:00';
    $hasOutTime = !empty($rec['outTime']) && $rec['outTime'] !== '00:00' && $rec['outTime'] !== '00:00:00';

    if ($hasInTime && $hasOutTime) {
        return false;
    }

    $punchRecords = trim($rec['punchRecords'] ?? '');
    if (empty($punchRecords)) {
        return false;
    }

    $punchRecordsLower = strtolower($punchRecords);
    $inCount = substr_count($punchRecordsLower, '(in)');
    $outCount = substr_count($punchRecordsLower, '(out)');
    $totalPunches = $inCount + $outCount;

    if ($totalPunches !== 1) {
        return false; 
    }

    if ($inCount === 1) {
        preg_match('/(\d{2}:\d{2}:\d{2})\(in\)/i', $punchRecords, $matches);
    } else {
        preg_match('/(\d{2}:\d{2}:\d{2})\(out\)/i', $punchRecords, $matches);
    }

    return !empty($matches[1]);
}


function resolveDayStatus($rec) {
    if (isSinglePunchDay($rec)) {
        return 'SP';
    }

    return resolveAttendanceStatusCode($rec['code'], $rec['wo']);
}


/**
 * Generate Department Attendance Report
 */
function handleGetReport($input) {
    $month = intval($input['month']); $year = intval($input['year']);
    $fromDay = intval($input['day_from']); $toDay = intval($input['day_to']);
 
    $dayFrom = "$year-" . sprintf("%02d", $month) . "-" . sprintf("%02d", $fromDay);
    $dayTo = "$year-" . sprintf("%02d", $month) . "-" . sprintf("%02d", $toDay);
 
    $sqlConn = getSQLServer();
    $scope = resolveScope($sqlConn, $input);

    $shiftGroupShiftIdsMap = [];
    $shiftGroupNameMap = [];
    $stmtShiftGroupShifts = sqlsrv_query($sqlConn, "SELECT ShiftGroupId, ShiftGroupName, ShiftIds FROM ShiftGroups");
    if ($stmtShiftGroupShifts) {
        while ($r = sqlsrv_fetch_array($stmtShiftGroupShifts, SQLSRV_FETCH_ASSOC)) {
            $rawIds = $r['ShiftIds'] ?? '';
            $ids = array_filter(array_map('intval', explode(',', $rawIds)), function ($v) {
                return $v > 0;
            });
            $shiftGroupNameMap[intval($r['ShiftGroupId'])] = $r['ShiftGroupName'] ?? '';
            $shiftGroupShiftIdsMap[intval($r['ShiftGroupId'])] = array_values(array_unique($ids));
        }
    }

    $allShiftIdsNeeded = [];
    foreach ($shiftGroupShiftIdsMap as $ids) {
        foreach ($ids as $sid) {
            $allShiftIdsNeeded[$sid] = true;
        }
    }

    $shiftDetailsMap = [];
    if (!empty($allShiftIdsNeeded)) {
        $shiftIdList = implode(',', array_keys($allShiftIdsNeeded));
        $stmtShiftDetails = sqlsrv_query(
            $sqlConn,
            "SELECT ShiftId, ShiftName, BeginTime, EndTime, IsFlexiShiftEndNextDay FROM Shifts WITH (NOLOCK) WHERE ShiftId IN ($shiftIdList)"
        );
        if ($stmtShiftDetails) {
            while ($r = sqlsrv_fetch_array($stmtShiftDetails, SQLSRV_FETCH_ASSOC)) {
                $beginRaw = $r['BeginTime'];
                $endRaw = $r['EndTime'];
                $shiftDetailsMap[(int)$r['ShiftId']] = [
                    'begin' => $beginRaw ? (is_object($beginRaw) ? $beginRaw->format('H:i:s') : $beginRaw) : null,
                    'end' => $endRaw ? (is_object($endRaw) ? $endRaw->format('H:i:s') : $endRaw) : null,
                    'flexiNextDay' => !empty($r['IsFlexiShiftEndNextDay']),
                    'name' => $r['ShiftName'] ?? null,
                ];
            }
        }
    }

    if (!empty($input['location_id'])) {
        $selectedLocation = intval($input['location_id']);
        if (in_array($selectedLocation, $scope['locations'] ?? [])) {
            $locationList = (string) $selectedLocation;
        } else {
            $locationList = '0'; 
        }
    } else {
        $locationList = !empty($scope['locations']) ? implode(',', array_map('intval', $scope['locations'])) : '0';
    }

    $companyList = !empty($scope['companies']) ? implode(',', array_map('intval', $scope['companies'])) : '0';
    $departmentList = !empty($scope['departments']) ? implode(',', array_map('intval', $scope['departments'])) : '0';
    $allLocationsList = !empty($scope['locations']) ? implode(',', array_map('intval', $scope['locations'])) : '0';

    $totalStdMachines = 0;
    $sqlMachStd = "SELECT SUM(TotalMachines) as total FROM LocationMachineStdCount WITH (NOLOCK) WHERE LocationId IN ($locationList)";
    $stmtMachStd = sqlsrv_query($sqlConn, $sqlMachStd);
    if ($stmtMachStd && $rowMS = sqlsrv_fetch_array($stmtMachStd, SQLSRV_FETCH_ASSOC)) {
        $totalStdMachines = intval($rowMS['total']);
    }

    $dailyMachMap = [];
    $sqlMachDaily = "SELECT MachineDate, SUM(RunningMachines) as total FROM LocationDailyMachineCount WITH (NOLOCK) WHERE LocationId IN ($locationList) AND MachineDate >= '$dayFrom' AND MachineDate <= '$dayTo' GROUP BY MachineDate";
    $stmtMachDaily = sqlsrv_query($sqlConn, $sqlMachDaily);
    if ($stmtMachDaily) {
        while ($rowMD = sqlsrv_fetch_array($stmtMachDaily, SQLSRV_FETCH_ASSOC)) {
            $d = intval(date('j', strtotime($rowMD['MachineDate']->format('Y-m-d'))));
            $dailyMachMap[$d] = intval($rowMD['total']);
        }
    }
 
    $sqlD = "SELECT D.DepartmentId, D.DepartmentFName as DepartmentName, D.SortOrder FROM Departments D WITH (NOLOCK) INNER JOIN Employees E WITH (NOLOCK) ON D.DepartmentId = E.DepartmentId WHERE E.Location IN ($allLocationsList) AND E.CompanyId IN ($companyList) AND E.DepartmentId IN ($departmentList) AND E.Status = 'Working' GROUP BY D.DepartmentId, D.DepartmentFName, D.SortOrder ORDER BY CASE WHEN D.SortOrder IS NULL OR D.SortOrder = 0 THEN 1 ELSE 0 END, D.SortOrder ASC, D.DepartmentFName ASC";
 
    $stmtD = sqlsrv_query($sqlConn, $sqlD);
 
    if (!$stmtD) {
        echo json_encode([
            'success' => false,
            'message' => 'Query failed (departments)',
            'errors' => sqlsrv_errors()
        ]);
        
        return;
    }
 
    $depts = [];
    $deptOrder = [];
    $deptSortOrder = [];
    while ($row = sqlsrv_fetch_array($stmtD, SQLSRV_FETCH_ASSOC)) {
        $deptId = $row['DepartmentId'];
        $depts[$deptId] = $row['DepartmentName'];
        $deptSortOrder[$deptId] = $row['SortOrder'];
        $deptOrder[] = $deptId;
    }

    $hcMap = [];
    $sqlHc = "SELECT DepartmentId, SUM(StandardHeadCount) as std_hc FROM DepartmentLocationHeadCount WITH (NOLOCK) WHERE LocationId IN ($locationList) AND DepartmentId IN ($departmentList) GROUP BY DepartmentId";
    $stmtHc = sqlsrv_query($sqlConn, $sqlHc);
    if ($stmtHc) {
        while ($row = sqlsrv_fetch_array($stmtHc, SQLSRV_FETCH_ASSOC)) {
            $hcMap[$row['DepartmentId']] = intval($row['std_hc']);
        }
    }

    $desigHcMap = [];
    $sqlDesigHc = "SELECT DepartmentId, DesignationId, SUM(StandardHeadCount) as std_hc FROM DepartmentDesignationLocationHeadCount WITH (NOLOCK) WHERE LocationId IN ($locationList) AND DepartmentId IN ($departmentList) GROUP BY DepartmentId, DesignationId";
    $stmtDesigHc = sqlsrv_query($sqlConn, $sqlDesigHc);
    if ($stmtDesigHc) {
        while ($row = sqlsrv_fetch_array($stmtDesigHc, SQLSRV_FETCH_ASSOC)) {
            $desigHcMap[$row['DepartmentId']][$row['DesignationId']] = intval($row['std_hc']);
        }
    }
 
    $designationMaster = [];
    $stmtDesignationMaster = sqlsrv_query($sqlConn, "SELECT DesignationId, DesignationsName, SortOrder FROM Designations WITH (NOLOCK)");

    if ($stmtDesignationMaster) {
        while ($row = sqlsrv_fetch_array($stmtDesignationMaster, SQLSRV_FETCH_ASSOC)) {
            $designationMaster[(int)$row['DesignationId']] = [
                'name' => $row['DesignationsName'],
                'sortOrder' => (int)$row['SortOrder']
            ];
        }
    }

    $sqlDesig = "SELECT DDM.DepartmentId, DG.DesignationId, DG.DesignationsName, DG.SortOrder AS DesigSortOrder, DDM.ParentDesignationId FROM DepartmentDesignationMapping DDM WITH (NOLOCK) INNER JOIN Designations DG WITH (NOLOCK) ON DDM.DesignationId = DG.DesignationId WHERE DDM.IsActive = 1 AND DDM.DepartmentId IN ($departmentList) ORDER BY CASE WHEN DG.SortOrder IS NULL OR DG.SortOrder = 0 THEN 1 ELSE 0 END, DG.SortOrder ASC, DG.DesignationsName ASC";
 
    $stmtDesig = sqlsrv_query($sqlConn, $sqlDesig);
 
    if (!$stmtDesig) {
        echo json_encode([
            'success' => false,
            'message' => 'Query failed (designations)',
            'errors' => sqlsrv_errors()
        ]);
 
        return;
    }
 
    $tempDesig = [];
    if ($stmtDesig) {
        while ($row = sqlsrv_fetch_array($stmtDesig, SQLSRV_FETCH_ASSOC)) {

            $deptId = intval($row['DepartmentId']);

            $tempDesig[$deptId][] = [
                'id' => intval($row['DesignationId']),
                'name' => $row['DesignationsName'],
                'sortOrder' => intval($row['DesigSortOrder']),
                'parentId' => $row['ParentDesignationId'] !== null
                    ? intval($row['ParentDesignationId'])
                    : null
            ];
        }
    }

    $desigByDept = [];
    foreach ($tempDesig as $deptId => $designations) {
        $parents = array_filter($designations, function ($d) {
            return $d['parentId'] === null;
        });

        usort($parents, function ($a, $b) {
            return $a['sortOrder'] <=> $b['sortOrder'];
        });

        foreach ($parents as $parent) {
            $parent['parentName'] = null;
            $desigByDept[$deptId][] = $parent;

            $children = array_filter($designations, function ($d) use ($parent) {
                return $d['parentId'] == $parent['id'];
            });

            usort($children, function ($a, $b) {
                return $a['sortOrder'] <=> $b['sortOrder'];
            });

            foreach ($children as $child) {
                $child['parentName'] = $parent['name'];
                $desigByDept[$deptId][] = $child;
            }
        }
    }

    $numDays = $toDay - $fromDay + 1;
    $summary = [
        'total_present' => array_fill($fromDay, $numDays, 0),
        'present' => array_fill($fromDay, $numDays, 0),
        'half_present' => array_fill($fromDay, $numDays, 0),
        'wo_present' => array_fill($fromDay, $numDays, 0),
        'wo_half_present' => array_fill($fromDay, $numDays, 0),
        'single_punch' => array_fill($fromDay, $numDays, 0),
        'weekly_off' => array_fill($fromDay, $numDays, 0),
        'total_absent' => array_fill($fromDay, $numDays, 0),
        'overtime_paid' => array_fill($fromDay, $numDays, 0),
        'weekly_off_ph' => array_fill($fromDay, $numDays, 0),
        'on_leave' => array_fill($fromDay, $numDays, 0),
        'new_joinee' => array_fill($fromDay, $numDays, 0),
        'left' => array_fill($fromDay, $numDays, 0),
        'recruited_hc' => array_fill($fromDay, $numDays, 0),
        'running_machines' => array_fill($fromDay, $numDays, 0),   
        'labor_per_machine' => array_fill($fromDay, $numDays, 0),  
    ];

    $employees = [];
    $empDateRows = [];
    $empMeta = [];
    $employeesByDeptDesig = [];
    $newJoineeEmployeesByDay = [];
    $leftEmployeesByDay = [];

    $sqlMasterEmployees = "SELECT E.EmployeeId, E.EmployeeCode, E.EmployeeName, E.DepartmentId, E.Designation AS DesignationId, E.DOJ, E.DOR, E.Status, E.ShiftGroupId FROM Employees E WITH (NOLOCK) WHERE E.Location IN ($locationList) AND E.CompanyId IN ($companyList) AND E.DepartmentId IN ($departmentList)";

    $empShiftGroupMap = [];

    $stmtMasterEmployees = sqlsrv_query($sqlConn, $sqlMasterEmployees);

    if ($stmtMasterEmployees) {
        while ($row = sqlsrv_fetch_array($stmtMasterEmployees, SQLSRV_FETCH_ASSOC)) {
            $empId = (string)$row['EmployeeId'];
            $deptId = intval($row['DepartmentId']);
            $desigId = intval($row['DesignationId']);
            $code = $row['EmployeeCode'];
            $name = $row['EmployeeName'];
            $status = $row['Status'];
            $doj = $row['DOJ'] ? $row['DOJ']->format('Y-m-d') : null;
            $dor = $row['DOR'] ? $row['DOR']->format('Y-m-d') : null;

            $empShiftGroupMap[$empId] = intval($row['ShiftGroupId']);

            $employees[$empId] = [
                'employeeId' => $empId,
                'employeeCode' => $code,
                'employeeName' => $name,
                'departmentId' => $deptId,
                'designationId' => $desigId,
                'status' => $status,
                'doj' => $doj,
                'dor' => $dor
            ];

            $empDateRows[$empId] = [
                'deptId' => $deptId,
                'doj' => $doj,
                'dor' => $dor,
                'status' => $status
            ];

            $empMeta[$empId] = [
                'dept' => $deptId,
                'desig' => $desigId,
                'code' => $code,
                'name' => $name
            ];

            if ($status == 'Working') {
                $employeesByDeptDesig[$deptId][$desigId][] = [
                    'id' => $empId,
                    'code' => $code,
                    'name' => $name
                ];
            }

            if ($doj && $doj >= $dayFrom && $doj <= $dayTo) {
                $joinDay = intval(date('j', strtotime($doj)));
                if (isset($summary['new_joinee'][$joinDay])) {
                    $summary['new_joinee'][$joinDay]++;
                }

                $newJoineeEmployeesByDay[$joinDay][] = [
                    'employeeId' => $empId,
                    'employeeCode' => $code,
                    'employeeName' => $name,
                    'departmentId' => $deptId,
                    'departmentName' => $depts[$deptId] ?? null,
                    'designationId' => $desigId
                ];
            }

            if ($status == 'Resigned' && $dor && $dor >= $dayFrom && $dor <= $dayTo) {
                $leaveDay = intval(date('j', strtotime($dor)));
                if (isset($summary['left'][$leaveDay])) {
                    $summary['left'][$leaveDay]++;
                }

                $leftEmployeesByDay[$leaveDay][] = [
                    'employeeId' => $empId,
                    'employeeCode' => $code,
                    'employeeName' => $name,
                    'departmentId' => $deptId,
                    'departmentName' => $depts[$deptId] ?? null,
                    'designationId' => $desigId
                ];
            }
        }
    }

    foreach ($employeesByDeptDesig as $deptId => $designationEmployees) {
        $existingIds = [];

        if (isset($desigByDept[$deptId])) {
            foreach ($desigByDept[$deptId] as $d) {
                $existingIds[$d['id']] = true;
            }
        }

        foreach ($designationEmployees as $designationId => $emps) {
            if (isset($existingIds[$designationId])) {
                continue;
            }
            if (!isset($designationMaster[$designationId])) {
                continue;
            }

            $desigByDept[$deptId][] = [
                'id' => $designationId,
                'name' => $designationMaster[$designationId]['name'],
                'sortOrder' => $designationMaster[$designationId]['sortOrder'],
                'parentId' => null,
                'parentName' => null
            ];

            $existingIds[$designationId] = true;
        }

        $groupSortOrder = [];
        foreach ($desigByDept[$deptId] as $d) {
            if ($d['parentId'] === null) {
                $groupSortOrder[$d['id']] = $d['sortOrder'];
            }
        }

        usort($desigByDept[$deptId], function ($a, $b) use ($groupSortOrder) {
            $aGroupId = $a['parentId'] ?? $a['id'];
            $bGroupId = $b['parentId'] ?? $b['id'];

            $aGroupSort = $groupSortOrder[$aGroupId] ?? null;
            $bGroupSort = $groupSortOrder[$bGroupId] ?? null;

            $aGroupEmpty = empty($aGroupSort);
            $bGroupEmpty = empty($bGroupSort);
            if ($aGroupEmpty != $bGroupEmpty) {
                return $aGroupEmpty ? 1 : -1;
            }
            if ($aGroupSort != $bGroupSort) {
                return $aGroupSort <=> $bGroupSort;
            }

            $aIsChild = $a['parentId'] !== null ? 1 : 0;
            $bIsChild = $b['parentId'] !== null ? 1 : 0;
            if ($aIsChild != $bIsChild) {
                return $aIsChild <=> $bIsChild;
            }

            $aEmpty = empty($a['sortOrder']);
            $bEmpty = empty($b['sortOrder']);
            if ($aEmpty != $bEmpty) {
                return $aEmpty ? 1 : -1;
            }
            if ($a['sortOrder'] != $b['sortOrder']) {
                return $a['sortOrder'] <=> $b['sortOrder'];
            }
            return strcmp($a['name'], $b['name']);
        });
    }
 
    $tableName = "AttendanceLogs_{$month}_{$year}";
    $tableExists = false;
    $checkTable = sqlsrv_query($sqlConn, "SELECT 1 FROM sys.tables WHERE name = ?", array($tableName));
    if ($checkTable && sqlsrv_fetch_array($checkTable)) {
        $tableExists = true;
    } else {
        $tableName = "AttendanceLogs_" . sprintf("%02d", $month) . "_{$year}";
        $checkTable = sqlsrv_query($sqlConn, "SELECT 1 FROM sys.tables WHERE name = ?", array($tableName));
        if ($checkTable && sqlsrv_fetch_array($checkTable)) $tableExists = true;
    }
 
    // DeviceLogs fetch for single-punch fallback (+1 day buffer for overnight/flexi shifts)
    $deviceFrom = (new DateTime($dayFrom))->modify('-1 day')->format('Y-m-d');
    $deviceTo = (new DateTime($dayTo))->modify('+1 day')->format('Y-m-d');

    $deviceEmployeeStats = [];

    $devCurDate = new DateTime(date('Y-m-01', strtotime($deviceFrom)));
    $devEndDate = new DateTime(date('Y-m-01', strtotime($deviceTo)));

    while ($devCurDate <= $devEndDate) {
        $dm = (int)$devCurDate->format('n');
        $dy = (int)$devCurDate->format('Y');

        $devTable = "DeviceLogs_{$dm}_{$dy}";
        $devTableExists = false;
        $checkDevTable = sqlsrv_query($sqlConn, "SELECT 1 FROM sys.tables WHERE name = ?", array($devTable));
        if ($checkDevTable && sqlsrv_fetch_array($checkDevTable)) {
            $devTableExists = true;
        } else {
            $devTable = "DeviceLogs_" . sprintf("%02d", $dm) . "_{$dy}";
            $checkDevTable = sqlsrv_query($sqlConn, "SELECT 1 FROM sys.tables WHERE name = ?", array($devTable));
            if ($checkDevTable && sqlsrv_fetch_array($checkDevTable)) $devTableExists = true;
        }

        if ($devTableExists) {
            $sqlDevRaw = "SELECT D.AttDirection, D.LogDate, E.EmployeeId FROM $devTable D WITH (NOLOCK) INNER JOIN Employees E WITH (NOLOCK) ON CAST(D.UserId AS VARCHAR(50)) = CAST(E.EmployeeCodeInDevice AS VARCHAR(50)) WHERE E.Location IN ($locationList) AND E.CompanyId IN ($companyList) AND E.DepartmentId IN ($departmentList) AND D.LogDate >= '$deviceFrom' AND D.LogDate <= '$deviceTo 23:59:59' AND E.Status = 'Working'";

            $stmtDevRaw = sqlsrv_query($sqlConn, $sqlDevRaw);

            if ($stmtDevRaw) {
                while ($row = sqlsrv_fetch_array($stmtDevRaw, SQLSRV_FETCH_ASSOC)) {
                    $empId = (string)$row['EmployeeId'];
                    $rowDateStr = $row['LogDate']->format('Y-m-d');
                    $key = $empId . '_' . $rowDateStr;

                    if (!isset($deviceEmployeeStats[$key])) {
                        $deviceEmployeeStats[$key] = ['punches' => []];
                    }

                    $deviceEmployeeStats[$key]['punches'][] = [
                        'dateTime'  => clone $row['LogDate'],
                        'direction' => strtoupper(trim($row['AttDirection'])),
                    ];
                }
            }
        }

        $devCurDate->modify('+1 month');
    }

    $liveData = [];
    $liveDataByDesig = [];
    $empDayStatus = [];
    if ($tableExists) {
        $sqlEmpDayStatus = "SELECT A.EmployeeId, DAY(A.AttendanceDate) as AttDay, A.DetailedStatusCode, A.WeeklyOff, A.InTime, A.OutTime, A.ReportPunchRecords, A.Present, A.Absent, A.OverTime, A.IsOnLeave, A.InDeviceId, A.OutDeviceId FROM $tableName A WITH (NOLOCK) JOIN Employees E WITH (NOLOCK) ON A.EmployeeId = E.EmployeeId WHERE A.AttendanceDate >= '$dayFrom' AND A.AttendanceDate <= '$dayTo 23:59:59' AND E.Location IN ($locationList) AND E.CompanyId IN ($companyList) AND E.DepartmentId IN ($departmentList) AND E.Status = 'Working'";
 
        $stmtEmpDayStatus = sqlsrv_query($sqlConn, $sqlEmpDayStatus);
        if ($stmtEmpDayStatus) {
            while ($row = sqlsrv_fetch_array($stmtEmpDayStatus, SQLSRV_FETCH_ASSOC)) {
                $empDayStatus[(string)$row['EmployeeId']][$row['AttDay']] = [
                    'code' => strtoupper(trim($row['DetailedStatusCode'] ?? '')),
                    'wo' => intval($row['WeeklyOff']),
                    'inTime' => $row['InTime'] ? (is_object($row['InTime']) ? $row['InTime']->format('H:i:s') : $row['InTime']) : null,
                    'outTime' => $row['OutTime'] ? (is_object($row['OutTime']) ? $row['OutTime']->format('H:i:s') : $row['OutTime']) : null,
                    'punchRecords' => trim($row['ReportPunchRecords'] ?? ''),
                    'present' => floatval($row['Present'] ?? 0), 
                    'absent' => floatval($row['Absent'] ?? 0),
                    'ot' => floatval($row['OverTime'] ?? 0),
                    'onLeave' => intval($row['IsOnLeave'] ?? 0),
                    'inDeviceId' => $row['InDeviceId'] ?? null,      
                    'outDeviceId' => $row['OutDeviceId'] ?? null,    
                ];
            }
        }
    }

    // Device-log fallback: rescue true absences (Gate 1: not already single-punch, Gate 2: code === 'A')
    foreach ($empDayStatus as $empId => &$days) {
        foreach ($days as $day => &$rec) {
            if (isSinglePunchDay($rec)) {
                continue;
            }

            $code = resolveAttendanceStatusCode($rec['code'], $rec['wo']);
            if ($code !== 'A') {
                continue;
            }

            $shiftGroupId = $empShiftGroupMap[$empId] ?? null;
            $shiftIds = $shiftGroupId !== null ? ($shiftGroupShiftIdsMap[$shiftGroupId] ?? []) : [];
            if (empty($shiftIds)) {
                continue;
            }

            $attendanceDate = "$year-" . sprintf("%02d", $month) . "-" . sprintf("%02d", $day);
            $nextDate = date('Y-m-d', strtotime($attendanceDate . ' +1 day'));

            $currentKey = $empId . '_' . $attendanceDate;
            $nextKey = $empId . '_' . $nextDate;

            $employeePunches = [];
            if (isset($deviceEmployeeStats[$currentKey]['punches'])) {
                $employeePunches = array_merge($employeePunches, $deviceEmployeeStats[$currentKey]['punches']);
            }
            if (isset($deviceEmployeeStats[$nextKey]['punches'])) {
                $employeePunches = array_merge($employeePunches, $deviceEmployeeStats[$nextKey]['punches']);
            }

            if (empty($employeePunches)) {
                continue;
            }

            usort($employeePunches, function ($a, $b) {
                return $a['dateTime'] <=> $b['dateTime'];
            });

            $match = findNearShiftPunch($employeePunches, $empId, $attendanceDate, $shiftIds, $shiftDetailsMap);

            if ($match) {
                $rec['forceSP'] = true;
            }
        }
        unset($rec);
    }
    unset($days);
 
    $statusCountsByDept = [];
    $statusEmployeesByDay = [];
    $otEmployeesByDay = [];
    $leaveEmployeesByDay = [];

    $statusKeyMap = [
        'P' => 'present',
        'HD' => 'half_present',
        'WOP' => 'wo_present',
        'WOHP' => 'wo_half_present',
        'SP' => 'single_punch',
        'A' => 'absent',
        'WO' => 'weekly_off'
    ];
 
    foreach ($empDayStatus as $empId => $days) {
        if (!isset($empMeta[$empId])) continue;
        $deptId = $empMeta[$empId]['dept'];
        $desigId = $empMeta[$empId]['desig'];
 
        foreach ($days as $day => $rec) {
            $status = resolveDayStatus($rec);       
            if (!isset($liveData[$deptId][$day])) {
                $liveData[$deptId][$day] = ['present' => 0, 'ot' => 0, 'wo' => 0, 'leave' => 0];
            }
            if (floatval($rec['present'] ?? 0) == 1) {
                $liveData[$deptId][$day]['present']++;
                if (!isset($liveDataByDesig[$deptId][$desigId][$day])) {
                    $liveDataByDesig[$deptId][$desigId][$day] = 0;
                }
                $liveDataByDesig[$deptId][$desigId][$day]++;
            }
            if (floatval($rec['ot'] ?? 0) > 0) {
                $liveData[$deptId][$day]['ot']++;
            }
            if (intval($rec['wo'] ?? 0) === 1) {
                $liveData[$deptId][$day]['wo']++;
            }
            if (intval($rec['onLeave'] ?? 0) === 1) {
                $liveData[$deptId][$day]['leave']++;
            }
 
            if (!isset($statusCountsByDept[$deptId][$day])) {
                $statusCountsByDept[$deptId][$day] = [
                    'present' => 0, 
                    'half_present' => 0, 
                    'wo_present' => 0,
                    'wo_half_present' => 0, 
                    'single_punch' => 0,
                    'absent' => 0, 
                    'weekly_off' => 0
                ];
            }
 
            if (isset($statusKeyMap[$status])) {
                $key = $statusKeyMap[$status];
                $statusCountsByDept[$deptId][$day][$key]++;
 
                if (!isset($statusEmployeesByDay[$day][$key])) {
                    $statusEmployeesByDay[$day][$key] = [];
                }
 
                $statusEmployeesByDay[$day][$key][] = [
                    'employeeId' => $empId,
                    'employeeCode' => $empMeta[$empId]['code'],
                    'employeeName' => $empMeta[$empId]['name'],
                    'departmentId' => $deptId,
                    'departmentName' => $depts[$deptId] ?? null,
                    'designationId' => $desigId
                ];
            }
 
            $empRecord = [
                'employeeId' => $empId,
                'employeeCode' => $empMeta[$empId]['code'],
                'employeeName' => $empMeta[$empId]['name'],
                'departmentId' => $deptId,
                'departmentName' => $depts[$deptId] ?? null,
                'designationId' => $desigId
            ];
 
            if (floatval($rec['ot'] ?? 0) > 0) {
                if (!isset($otEmployeesByDay[$day])) $otEmployeesByDay[$day] = [];
                $otEmployeesByDay[$day][] = $empRecord;
            }
 
            if (intval($rec['onLeave'] ?? 0) === 1) {
                if (!isset($leaveEmployeesByDay[$day])) $leaveEmployeesByDay[$day] = [];
                $leaveEmployeesByDay[$day][] = $empRecord;
            }
        }
    }
 
    $statusCountsByDept = [];
    $statusEmployeesByDay = [];
    $otEmployeesByDay = [];
    $leaveEmployeesByDay = [];
 
    $statusKeyMap = [
        'P' => 'present',
        'HD' => 'half_present',
        'WOP' => 'wo_present',
        'WOHP' => 'wo_half_present',
        'SP' => 'single_punch',
        'A' => 'absent',
        'WO' => 'weekly_off'
    ];
 
    foreach ($empDayStatus as $empId => $days) {
        if (!isset($empMeta[$empId])) continue;
        $deptId = $empMeta[$empId]['dept'];
        $desigId = $empMeta[$empId]['desig'];
 
        foreach ($days as $day => $rec) {
            $status = resolveDayStatus($rec);
 
            if (!isset($statusCountsByDept[$deptId][$day])) {
                $statusCountsByDept[$deptId][$day] = [
                    'present' => 0, 
                    'half_present' => 0, 
                    'wo_present' => 0,
                    'wo_half_present' => 0, 
                    'single_punch' => 0,
                    'absent' => 0, 
                    'weekly_off' => 0
                ];
            }
 
            if (isset($statusKeyMap[$status])) {
                $key = $statusKeyMap[$status];
                $statusCountsByDept[$deptId][$day][$key]++;
 
                if (!isset($statusEmployeesByDay[$day][$key])) {
                    $statusEmployeesByDay[$day][$key] = [];
                }
 
                $statusEmployeesByDay[$day][$key][] = [
                    'employeeId' => $empId,
                    'employeeCode' => $empMeta[$empId]['code'],
                    'employeeName' => $empMeta[$empId]['name'],
                    'departmentId' => $deptId,
                    'departmentName' => $depts[$deptId] ?? null,
                    'designationId' => $desigId
                ];
            }
 
            $empRecord = [
                'employeeId' => $empId,
                'employeeCode' => $empMeta[$empId]['code'],
                'employeeName' => $empMeta[$empId]['name'],
                'departmentId' => $deptId,
                'departmentName' => $depts[$deptId] ?? null,
                'designationId' => $desigId
            ];
 
            if (floatval($rec['ot'] ?? 0) > 0) {
                if (!isset($otEmployeesByDay[$day])) $otEmployeesByDay[$day] = [];
                $otEmployeesByDay[$day][] = $empRecord;
            }
 
            if (intval($rec['onLeave'] ?? 0) === 1) {
                if (!isset($leaveEmployeesByDay[$day])) $leaveEmployeesByDay[$day] = [];
                $leaveEmployeesByDay[$day][] = $empRecord;
            }
        }
    }
 
    $departments = [];

    $deptHeadcountByDay = [];
    for ($d = $fromDay; $d <= $toDay; $d++) {
        $dateStr = "$year-" . sprintf('%02d', $month) . "-" . sprintf('%02d', $d);
        $deptActiveToday = [];
        foreach ($empDateRows as $emp) {
            if (!$emp['doj'] || $emp['doj'] > $dateStr) continue;
            $wasActive = ($emp['status'] === 'Working') || ($emp['status'] === 'Resigned' && $emp['dor'] && $emp['dor'] > $dateStr);
            if ($wasActive) {
                $deptActiveToday[$emp['deptId']] = true;
                $deptHeadcountByDay[$emp['deptId']][$d] = ($deptHeadcountByDay[$emp['deptId']][$d] ?? 0) + 1;
            }
        }
 
        $daySum = 0;
        foreach ($deptHeadcountByDay as $deptId => $days) {
            $daySum += $days[$d] ?? 0;
        }

        $summary['recruited_hc'][$d] = $daySum;
    }

    $allIds = $deptOrder;
    foreach (array_keys($liveData) as $id) {
        if (!in_array($id, $allIds)) $allIds[] = $id;
    }
 
    foreach (array_keys($statusCountsByDept) as $id) {
        if (!in_array($id, $allIds)) $allIds[] = $id;
    }
            
    foreach ($allIds as $id) {
        $stdHc = isset($hcMap[$id]) ? intval($hcMap[$id]) : 0;
        $name = isset($depts[$id]) ? $depts[$id] : "Dept $id";
        $days = []; $deptSum = 0;
        for ($d = $fromDay; $d <= $toDay; $d++) {
            if ($d > date('j') && $month == date('n') && $year == date('Y')) {
                $days[$d] = null;
            } else {
                $sc = $statusCountsByDept[$id][$d] ?? [
                    'present'=>0,
                    'half_present'=>0,
                    'wo_present'=>0,
                    'wo_half_present'=>0,
                    'single_punch'=>0,
                    'absent'=>0,
                    'weekly_off'=>0
                ];
 
                $days[$d] = $sc['present'] + $sc['half_present'] + $sc['wo_present'] + $sc['wo_half_present'] + $sc['single_punch'];
                $deptSum += $days[$d];
 
                $summary['present'][$d] += $sc['present'];
                $summary['half_present'][$d] += $sc['half_present'];
                $summary['wo_present'][$d] += $sc['wo_present'];
                $summary['wo_half_present'][$d] += $sc['wo_half_present'];
                $summary['single_punch'][$d] += $sc['single_punch'];
                $summary['weekly_off'][$d] += $sc['weekly_off'];
                $summary['total_absent'][$d] += $sc['absent'];
 
                $summary['total_present'][$d] += $sc['present'] + $sc['half_present'] + $sc['wo_present'] + $sc['wo_half_present'] + $sc['single_punch'];
 
                if (isset($liveData[$id][$d])) {
                    $summary['weekly_off_ph'][$d] += intval($liveData[$id][$d]['wo']);
                }
            }
        }
 
        $deptSummary = [
            'total_present' => array_fill($fromDay, $numDays, 0),
            'total_half_present' => array_fill($fromDay, $numDays, 0),
            'total_wo_present' => array_fill($fromDay, $numDays, 0),
            'total_wo_half_present' => array_fill($fromDay, $numDays, 0),
            'total_single_punch' => array_fill($fromDay, $numDays, 0),
            'total_absent' => array_fill($fromDay, $numDays, 0),
            'total_weekly_off' => array_fill($fromDay, $numDays, 0),
        ];
 
        $designations = [];
        if (isset($desigByDept[$id])) {
            foreach ($desigByDept[$id] as $desig) {
                $desigId = $desig['id'];
                $desigStdHc = intval($desigHcMap[$id][$desigId] ?? 0);

                $employeeCount = count($employeesByDeptDesig[$id][$desigId] ?? []);

                if ($desigStdHc <= 0 && $employeeCount == 0) {
                    continue;
                }

                $desigSummary = [
                    'total_employees' => $employeeCount,
                    'total_present' => array_fill($fromDay, $numDays, 0),
                    'total_half_present' => array_fill($fromDay, $numDays, 0),
                    'total_wo_present' => array_fill($fromDay, $numDays, 0),
                    'total_wo_half_present' => array_fill($fromDay, $numDays, 0),
                    'total_single_punch' => array_fill($fromDay, $numDays, 0),
                    'total_absent' => array_fill($fromDay, $numDays, 0),
                    'total_weekly_off' => array_fill($fromDay, $numDays, 0),
                ];
 
                $empList = [];
                if (isset($employeesByDeptDesig[$id][$desigId])) {
                    foreach ($employeesByDeptDesig[$id][$desigId] as $emp) {
                        $empDays = [];
                        for ($d = $fromDay; $d <= $toDay; $d++) {
                            $rec = $empDayStatus[$emp['id']][$d] ?? null;
                            $status = $rec ? resolveDayStatus($rec) : null;
                            $empDays[$d] = $status;
 
                            switch ($status) {
                                case 'P':
                                    $desigSummary['total_present'][$d]++;
                                    $deptSummary['total_present'][$d]++;
                                    break;

                                case 'SP':
                                    $desigSummary['total_single_punch'][$d]++;
                                    $deptSummary['total_single_punch'][$d]++;
                                    break;
                                case 'HD':
                                    $desigSummary['total_half_present'][$d]++;
                                    $deptSummary['total_half_present'][$d]++;
                                    break;
                                case 'WOP':
                                    $desigSummary['total_wo_present'][$d]++;
                                    $deptSummary['total_wo_present'][$d]++;
                                    break;
                                case 'WOHP':
                                    $desigSummary['total_wo_half_present'][$d]++;
                                    $deptSummary['total_wo_half_present'][$d]++;
                                    break;
                                case 'A':
                                    $desigSummary['total_absent'][$d]++;
                                    $deptSummary['total_absent'][$d]++;
                                    break;
                                case 'WO':
                                    $desigSummary['total_weekly_off'][$d]++;
                                    $deptSummary['total_weekly_off'][$d]++;
                                    break;
                            }
                        }
 
                        $empList[] = [
                            'employeeId' => $emp['id'],
                            'employeeCode' => $emp['code'],
                            'employeeName' => $emp['name'],
                            'days' => $empDays
                        ];
                    }
                }
 
                $desigDays = []; $desigSum = 0;
                for ($d = $fromDay; $d <= $toDay; $d++) {
                    if ($d > date('j') && $month == date('n') && $year == date('Y')) {
                        $desigDays[$d] = null;
                    } else {
                        $desigDays[$d] = $desigSummary['total_present'][$d]
                            + $desigSummary['total_half_present'][$d]
                            + $desigSummary['total_wo_present'][$d]
                            + $desigSummary['total_wo_half_present'][$d];
                        $desigSum += $desigDays[$d];
                    }
                }
 
                $designations[] = [
                    'designationId' => $desigId,
                    'designationName' => $desig['parentName'] ? $desig['name'] . ' (' . $desig['parentName'] . ')' : $desig['name'],
                    'sortOrder' => $desig['sortOrder'],
                    'std_hc' => $desigStdHc,
                    'days' => $desigDays,
                    'avg_hc' => round($desigSum / $numDays),
                    'employees' => $empList,
                    'summary' => $desigSummary
                ];
            }
        }
 
        $departments[] = [
            'departmentId' => $id,
            'department' => $name,
            'sortOrder' => $deptSortOrder[$id] ?? 0,
            'std_hc' => $stdHc,
            'days' => $days,
            'avg_hc' => round($deptSum / $numDays),
            'designations' => $designations,
            'summary' => $deptSummary
        ];
    }
 
    for ($d = $fromDay; $d <= $toDay; $d++) {
        $summary['overtime_paid'][$d] = count($otEmployeesByDay[$d] ?? []);
        $summary['on_leave'][$d] = count($leaveEmployeesByDay[$d] ?? []);
        $summary['running_machines'][$d] = $dailyMachMap[$d] ?? 0;
        $summary['labor_per_machine'][$d] = $summary['running_machines'][$d] > 0 ? round($summary['total_present'][$d] / $summary['running_machines'][$d], 1) : 0;
    }
 
    $summary_avg = [];
    foreach ($summary as $key => $values) {
        if (is_array($values)) {
            $summary_avg[$key] = round(array_sum($values) / $numDays);
        }
    }
 
    $summary_employees = [];
    for ($d = $fromDay; $d <= $toDay; $d++) {
        $summary_employees[$d] = [
            'present' => $statusEmployeesByDay[$d]['present'] ?? [],
            'half_present' => $statusEmployeesByDay[$d]['half_present'] ?? [],
            'wo_present' => $statusEmployeesByDay[$d]['wo_present'] ?? [],
            'wo_half_present' => $statusEmployeesByDay[$d]['wo_half_present'] ?? [],
            'single_punch' => $statusEmployeesByDay[$d]['single_punch'] ?? [],
            'absent' => $statusEmployeesByDay[$d]['absent'] ?? [],
            'weekly_off' => $statusEmployeesByDay[$d]['weekly_off'] ?? [],
            'overtime_paid' => $otEmployeesByDay[$d] ?? [],
            'on_leave' => $leaveEmployeesByDay[$d] ?? [],
            'new_joinee' => $newJoineeEmployeesByDay[$d] ?? [],
            'left' => $leftEmployeesByDay[$d] ?? [],
        ];
    }
 
    echo json_encode([
        'success' => true,
        'departments' => $departments,
        'summary' => $summary,
        'summary_avg' => $summary_avg,
        'summary_employees' => $summary_employees,
        'total_std_hc' => array_sum($hcMap),
        'total_running_machines' => $totalStdMachines
    ]);
}


/**
 * GET fixed STD machine total for a location
 */
function handleGetMachineStd($input) {
    $sqlConn = getSQLServer();
    $scope = resolveScope($sqlConn, $input);
    $locFilter = resolveLocationFilter($scope, $input);

    $sql = "SELECT SUM(TotalMachines) AS TotalMachines FROM LocationMachineStdCount WHERE LocationId IN ({$locFilter['list']})";
    $stmt = sqlsrv_query($sqlConn, $sql);

    $total = 0;
    if ($stmt && $row = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC)) {
        $total = intval($row['TotalMachines']);
    }

    echo json_encode([
        'success' => true,
        'data' => ['location_id' => $locFilter['isAll'] ? 0 : $locFilter['single'], 'total_machines' => $total]
    ]);
}

/**
 * SAVE fixed STD machine total for a location (upsert)
 */
function handleUpdateMachineStd($input) {
    $locationId = intval($input['location_id']);
    if ($locationId <= 0) {
        echo json_encode(['success' => false, 'message' => 'Please select a specific location to update total machines.']);
        return;
    }
    $totalMachines = intval($input['total_machines']);
    $sqlConn = getSQLServer();

    $sql = "MERGE LocationMachineStdCount AS target USING (SELECT ? AS LocationId, ? AS TotalMachines) AS src ON target.LocationId = src.LocationId WHEN MATCHED THEN UPDATE SET TotalMachines = src.TotalMachines, UpdatedAt = GETDATE() WHEN NOT MATCHED THEN INSERT (LocationId, TotalMachines, UpdatedAt) VALUES (src.LocationId, src.TotalMachines, GETDATE());";

    $stmt = sqlsrv_query($sqlConn, $sql, array($locationId, $totalMachines));

    if (!$stmt) {
        echo json_encode(['success' => false, 'message' => 'Failed to save total machines', 'errors' => sqlsrv_errors()]);
        return;
    }

    echo json_encode(['success' => true]);
}

/**
 * GET per-day running machine values for a location + date range
 */
function handleGetDailyMachines($input) {
    $dateFrom = $input['date_from'];
    $dateTo = $input['date_to'];
    $sqlConn = getSQLServer();
    $scope = resolveScope($sqlConn, $input);
    $locFilter = resolveLocationFilter($scope, $input);

    if ($locFilter['isAll']) {
        $sql = "SELECT MachineDate, SUM(RunningMachines) AS RunningMachines FROM LocationDailyMachineCount WHERE LocationId IN ({$locFilter['list']}) AND MachineDate >= ? AND MachineDate <= ? GROUP BY MachineDate ORDER BY MachineDate ASC";
        $stmt = sqlsrv_query($sqlConn, $sql, array($dateFrom, $dateTo));
    } else {
        $sql = "SELECT MachineDate, RunningMachines FROM LocationDailyMachineCount WHERE LocationId = ? AND MachineDate >= ? AND MachineDate <= ? ORDER BY MachineDate ASC";
        $stmt = sqlsrv_query($sqlConn, $sql, array($locFilter['single'], $dateFrom, $dateTo));
    }

    $data = [];
    if ($stmt) {
        while ($row = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC)) {
            $dateStr = $row['MachineDate']->format('Y-m-d');
            $data[$dateStr] = intval($row['RunningMachines']);
        }
    }

    echo json_encode(['success' => true, 'data' => $data]);
}

/**
 * SAVE per-day running machine values (bulk upsert)
 * items: [{ date: 'YYYY-MM-DD', running_machines: N }, ...]
 */
function handleBulkUpdateDailyMachines($input) {
    $locationId = intval($input['location_id']);
    if ($locationId <= 0) {
        echo json_encode(['success' => false, 'message' => 'Please select a specific location to save daily machine counts.']);
        return;
    }
    $items = $input['items'] ?? [];
    $sqlConn = getSQLServer();

    $errors = [];
    foreach ($items as $item) {
        $date = $item['date'];
        $count = intval($item['running_machines']);

        $sql = "MERGE LocationDailyMachineCount AS target USING (SELECT ? AS LocationId, ? AS MachineDate, ? AS RunningMachines) AS src ON target.LocationId = src.LocationId AND target.MachineDate = src.MachineDate WHEN MATCHED THEN UPDATE SET RunningMachines = src.RunningMachines, UpdatedAt = GETDATE() WHEN NOT MATCHED THEN INSERT (LocationId, MachineDate, RunningMachines, UpdatedAt) VALUES (src.LocationId, src.MachineDate, src.RunningMachines, GETDATE());";

        $stmt = sqlsrv_query($sqlConn, $sql, array($locationId, $date, $count));
        if (!$stmt) {
            $errors[] = ['date' => $date, 'errors' => sqlsrv_errors()];
        }
    }

    if (!empty($errors)) {
        echo json_encode(['success' => false, 'message' => 'Some dates failed to save', 'errors' => $errors]);
        return;
    }

    echo json_encode(['success' => true]);
}


function resolveLocationFilter($scope, $input) {
    $locId = isset($input['location_id']) ? intval($input['location_id']) : 0;
    $allowed = !empty($scope['locations']) ? array_map('intval', $scope['locations']) : [];

    if ($locId > 0 && in_array($locId, $allowed)) {
        return ['isAll' => false, 'single' => $locId, 'list' => (string)$locId];
    }

    return ['isAll' => true, 'single' => null, 'list' => !empty($allowed) ? implode(',', $allowed) : '0'];
}


/**
 * Get simple list of Locations assigned to the logged-in admin
 */
function handleGetLocations($input = []) {
    $conn = getSQLServer();
    $scope = resolveScope($conn, $input);

    if (empty($scope['locations'])) {
        echo json_encode(['success' => false, 'message' => 'Session expired. Please login again.']);
        return;
    }

    $locationList = implode(',', array_map('intval', $scope['locations']));

    $sql = "SELECT LocationId, LocationName FROM Locations WITH (NOLOCK) WHERE LocationId IN ($locationList) AND IsActive = 1 ORDER BY LocationName ASC";

    $stmt = sqlsrv_query($conn, $sql);

    if ($stmt === false) {
        $errors = sqlsrv_errors();
        error_log('handleGetLocations SQL error: ' . print_r($errors, true));
        echo json_encode(['success' => false, 'message' => 'Database query failed', 'sql_error' => $errors]);
        return;
    }

    $data = [];
    while ($row = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC)) {
        $data[] = [
            'location_id' => $row['LocationId'],
            'location_name' => $row['LocationName']
        ];
    }
    echo json_encode(['success' => true, 'data' => $data]);
}


/**
 * Get simple list of departments filtered by Location 14
 */
function handleGetDepts($input = []) {
    $conn = getSQLServer();
    $scope = resolveScope($conn, $input);

    if (empty($scope['locations']) || empty($scope['departments'])) {
        echo json_encode(['success' => false, 'message' => 'Session expired. Please login again.']);
        return;
    }

    $locationList = implode(',', array_map('intval', $scope['locations']));
    $departmentList = implode(',', array_map('intval', $scope['departments']));

    $sql = "SELECT D.DepartmentId, D.DepartmentFName AS DepartmentName, D.std_hc, D.SortOrder FROM Departments D WITH (NOLOCK) INNER JOIN Employees E WITH (NOLOCK) ON D.DepartmentId = E.DepartmentId WHERE E.Location IN ($locationList) AND E.DepartmentId IN ($departmentList) AND E.Status = 'Working' GROUP BY D.DepartmentId, D.DepartmentFName, D.std_hc, D.SortOrder ORDER BY CASE WHEN D.SortOrder IS NULL THEN 1 ELSE 0 END, D.SortOrder ASC, D.DepartmentFName ASC;";

    $stmt = sqlsrv_query($conn, $sql);

    if ($stmt === false) {
        $errors = sqlsrv_errors();
        error_log('handleGetDepts SQL error: ' . print_r($errors, true));
        echo json_encode(['success' => false, 'message' => 'Database query failed', 'sql_error' => $errors]);
        return;
    }

    $data = [];
    while ($row = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC)) {
        $data[] = $row;
    }
    echo json_encode($data);
}

/**
 * Get simple list of companies filtered by Location 14
 */
function handleGetCompanies($input = []) {
    $conn = getSQLServer();
    $scope = resolveScope($conn, $input);

    if (empty($scope['locations']) || empty($scope['companies'])) {
        echo json_encode(['success' => false, 'message' => 'Session expired. Please login again.']);
        return;
    }

    $locationList = implode(',', array_map('intval', $scope['locations']));
    $companyList = implode(',', array_map('intval', $scope['companies']));

    $sql = "SELECT C.CompanyId, C.CompanyFName AS CompanyName, C.SortOrder FROM Companies C WITH (NOLOCK) INNER JOIN Employees E WITH (NOLOCK) ON C.CompanyId = E.CompanyId WHERE E.Location IN ($locationList) AND E.CompanyId IN ($companyList) AND E.Status = 'Working' GROUP BY C.CompanyId, C.CompanyFName, C.SortOrder ORDER BY CASE WHEN C.SortOrder IS NULL THEN 1 ELSE 0 END, C.SortOrder ASC, C.CompanyFName ASC;";

    $stmt = sqlsrv_query($conn, $sql);

    if ($stmt === false) {
        $errors = sqlsrv_errors();
        error_log('handleGetCompanies SQL error: ' . print_r($errors, true));
        echo json_encode(['success' => false, 'message' => 'Database query failed', 'sql_error' => $errors]);
        return;
    }

    $data = [];
    while ($row = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC)) {
        $data[] = $row;
    }
    echo json_encode($data);
}


/**
 * Get simple list of active shifts for employees at Location 14
 */
function handleGetShifts($input = []) {
    $conn = getSQLServer();
    $scope = resolveScope($conn, $input);

    if (empty($scope['locations']) || empty($scope['companies'])) {
        echo json_encode(['success' => false, 'message' => 'Session expired. Please login again.']);
        return;
    }

    $locationList = implode(',', array_map('intval', $scope['locations']));
    $companyList = implode(',', array_map('intval', $scope['companies']));

    $sql = "SELECT DISTINCT S.ShiftId, S.ShiftName FROM Employees E WITH (NOLOCK) CROSS APPLY (SELECT TOP 1 S.ShiftId, S.ShiftName FROM EmployeeShift ES WITH (NOLOCK) JOIN Shifts S WITH (NOLOCK) ON ES.ShiftId = S.ShiftId WHERE ES.EmployeeId = E.EmployeeId AND S.RecordStatus = '1' ORDER BY ES.Shiftdate DESC) S WHERE E.Location IN ($locationList) AND E.CompanyId IN ($companyList) AND E.Status = 'Working' ORDER BY S.ShiftName ASC";

    $stmt = sqlsrv_query($conn, $sql);

    $data = [];
    while ($row = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC)) {
        $data[] = $row;
    }
    echo json_encode($data);
}

/**
 * Setup Database (Admin only or run once)
 */
function handleSetupDB() {
    $db = @new mysqli(MYSQL_HOST, MYSQL_USER, MYSQL_PASS);
    if ($db->connect_error) {
        $db = @new mysqli(MYSQL_HOST, MYSQL_USER, '');
        if ($db->connect_error) {
            die(json_encode(['success' => false, 'message' => 'MySQL Connection failed: ' . $db->connect_error]));
        }
    }
    $db->query("CREATE DATABASE IF NOT EXISTS `" . MYSQL_DB . "` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $db->select_db(MYSQL_DB);

    $db->query("CREATE TABLE IF NOT EXISTS `users` (`id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, `username` VARCHAR(50) NOT NULL UNIQUE, `name` VARCHAR(120) NOT NULL, `password_hash` VARCHAR(255) NOT NULL, `role` ENUM('admin','hr','viewer') DEFAULT 'viewer', `is_active` TINYINT(1) DEFAULT 1, `last_login` DATETIME, `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP)");

    // Add default admin if not exists
    $hash = password_hash('Admin@1234', PASSWORD_BCRYPT);
    $stmt = $db->prepare("INSERT IGNORE INTO users (username, name, password_hash, role) VALUES ('admin', 'Administrator', ?, 'admin')");
    if ($stmt) {
        $stmt->bind_param('s', $hash);
        $stmt->execute();
        $stmt->close();
    }

    echo json_encode(['success' => true, 'message' => 'Database setup successful']);
}


function handleGetDesignationsOrder() {
    $conn = getSQLServer();

    $locationList = !empty($_SESSION['locations']) ? implode(',', array_map('intval', $_SESSION['locations'])) : '0';
    $companyList = !empty($_SESSION['companies']) ? implode(',', array_map('intval', $_SESSION['companies'])) : '0';
    $departmentList = !empty($_SESSION['departments']) ? implode(',', array_map('intval', $_SESSION['departments'])) : '0';

    $sql = "SELECT DISTINCT D.DepartmentId, D.DepartmentFName as DepartmentName, DG.DesignationId, DG.DesignationsName, ISNULL(DSO.SortOrder, 0) as sortOrder FROM Employees E WITH (NOLOCK) INNER JOIN Departments D WITH (NOLOCK) ON E.DepartmentId = D.DepartmentId INNER JOIN Designations DG WITH (NOLOCK) ON E.Designation = DG.DesignationId LEFT JOIN departmentDeginationSortOrder DSO WITH (NOLOCK) ON D.DepartmentId = DSO.DepartmentId AND DG.DesignationId = DSO.DesignationId WHERE E.RecordStatus = 1 AND D.RecordStatus = 1 AND E.Location IN ($locationList) AND E.CompanyId IN ($companyList) AND E.DepartmentId IN ($departmentList) ORDER BY D.DepartmentFName ASC, sortOrder ASC, DG.DesignationsName ASC";

    $stmt = sqlsrv_query($conn, $sql);
    $data = [];
    if ($stmt) {
        while ($row = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC)) {
            $deptId = $row['DepartmentId'];
            if (!isset($data[$deptId])) {
                $data[$deptId] = [
                    'id' => $deptId,
                    'name' => $row['DepartmentName'],
                    'designations' => []
                ];
            }
            $data[$deptId]['designations'][] = [
                'id' => $row['DesignationId'],
                'name' => $row['DesignationsName'],
                'sortOrder' => intval($row['sortOrder'])
            ];
        }
    }

    $debugSql = "SELECT * FROM departmentDeginationSortOrder";
    $debugStmt = sqlsrv_query($conn, $debugSql);
    $debugData = [];
    if ($debugStmt) {
        while ($row = sqlsrv_fetch_array($debugStmt, SQLSRV_FETCH_ASSOC)) {
            $debugData[] = $row;
        }
    }

    echo json_encode([
        'success' => true,
        'data' => array_values($data),
        'debug_raw' => $debugData
    ]);
}

function handleSaveDesignationsOrder($input) {
    $conn = getSQLServer();
    $items = isset($input['items']) ? $input['items'] : [];

    $success = true;

    foreach ($items as $item) {
        $deptId = intval($item['deptId']);
        $id = intval($item['id']);
        $sortOrder = intval($item['sortOrder']);
        
        $sqlUpdate = "UPDATE [eSSLSmartOffice].[dbo].[departmentDeginationSortOrder] SET SortOrder = ? WHERE DepartmentId = ? AND DesignationId = ?";
        $stmtUpdate = sqlsrv_query($conn, $sqlUpdate, [$sortOrder, $deptId, $id]);
        
        if ($stmtUpdate) {
            $rowsAffected = sqlsrv_rows_affected($stmtUpdate);
            if ($rowsAffected === 0) {
                $sqlInsert = "INSERT INTO [eSSLSmartOffice].[dbo].[departmentDeginationSortOrder] (DepartmentId, DesignationId, SortOrder) VALUES (?, ?, ?)";
                $stmtInsert = sqlsrv_query($conn, $sqlInsert, [$deptId, $id, $sortOrder]);
                if (!$stmtInsert) {
                    $success = false;
                }
            }
        } else {
            $success = false;
        }
    }

    echo json_encode([
        'success' => $success,
        'message' => $success ? 'Designation orders updated successfully' : 'Some updates failed'
    ]);
}


function handleGetCompaniesOrder() {
    // Add this session check first - same pattern as handleGetDepts()
    if (empty($_SESSION['locations']) || empty($_SESSION['companies'])) {
        echo json_encode(['success' => false, 'message' => 'Session expired. Please login again.']);
        return;
    }

    $conn = getSQLServer();

    $locationList = implode(',', array_map('intval', $_SESSION['locations']));
    $companyList  = implode(',', array_map('intval', $_SESSION['companies']));

    $sql = "SELECT C.CompanyId, C.CompanyFName AS CompanyName, C.SortOrder FROM Companies C WITH (NOLOCK) INNER JOIN Employees E WITH (NOLOCK) ON C.CompanyId = E.CompanyId WHERE E.Location IN ($locationList) AND E.CompanyId IN ($companyList) AND E.Status = 'Working' GROUP BY C.CompanyId, C.CompanyFName, C.SortOrder ORDER BY CASE WHEN C.SortOrder IS NULL THEN 1 ELSE 0 END, C.SortOrder, C.CompanyFName";
    
    $stmt = sqlsrv_query($conn, $sql);
    
    // Add this error check - this is what's missing and causing the 500
    if (!$stmt) {
        echo json_encode([
            'success' => false,
            'message' => 'Query failed',
            'errors' => sqlsrv_errors()
        ]);
        return;
    }
    
    $data = [];
    while ($row = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC)) {
        $data[] = [
            'id' => $row['CompanyId'],
            'name' => $row['CompanyName'],
            'sortOrder' => $row['SortOrder']
        ];
    }

    echo json_encode(['success' => true, 'data' => $data]);
}

function handleSaveCompaniesOrder($input) {
    $conn = getSQLServer();
    $items = isset($input['items']) ? $input['items'] : [];

    $success = true;
    foreach ($items as $item) {
        $companyId = intval($item['id']);
        $sortOrder = isset($item['sortOrder']) && $item['sortOrder'] !== '' ? intval($item['sortOrder']) : null;

        $sql = "UPDATE Companies SET SortOrder = ? WHERE CompanyId = ?";
        $params = [$sortOrder, $companyId];
        $stmt = sqlsrv_query($conn, $sql, $params);

        if (!$stmt) {
            $success = false;
        }
    }

    echo json_encode([
        'success' => $success,
        'message' => $success ? 'Company order saved successfully' : 'Some updates failed'
    ]);
}

function handleGetDepartmentsOrder() {
    $conn = getSQLServer();

    $locationList = !empty($_SESSION['locations'])   ? implode(',', array_map('intval', $_SESSION['locations']))   : '0';
    $departmentList = !empty($_SESSION['departments']) ? implode(',', array_map('intval', $_SESSION['departments'])) : '0';

    $sql = "SELECT D.DepartmentId, D.DepartmentFName AS DepartmentName, D.SortOrder FROM Departments D WITH (NOLOCK) INNER JOIN Employees E WITH (NOLOCK) ON D.DepartmentId = E.DepartmentId WHERE E.Location IN ($locationList) AND E.DepartmentId IN ($departmentList) AND E.Status = 'Working' GROUP BY D.DepartmentId, D.DepartmentFName, D.SortOrder ORDER BY CASE WHEN D.SortOrder IS NULL OR D.SortOrder = 0 THEN 1 ELSE 0 END, D.SortOrder ASC, D.DepartmentFName ASC";

    $stmt = sqlsrv_query($conn, $sql);
    $data = [];
    if ($stmt) {
        while ($row = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC)) {
            $data[] = [
                'id' => $row['DepartmentId'],
                'name' => $row['DepartmentName'],
                'sortOrder' => $row['SortOrder']
            ];
        }
    }

    echo json_encode(['success' => true, 'data' => $data]);
}

function handleSaveDepartmentsOrder($input) {
    $conn = getSQLServer();
    $items = isset($input['items']) ? $input['items'] : [];

    $success = true;
    foreach ($items as $item) {
        $deptId = intval($item['id']);
        $sortOrder = isset($item['sortOrder']) && $item['sortOrder'] !== '' ? intval($item['sortOrder']) : null;

        $sql = "UPDATE Departments SET SortOrder = ? WHERE DepartmentId = ?";
        $params = [$sortOrder, $deptId];
        $stmt = sqlsrv_query($conn, $sql, $params);

        if (!$stmt) {
            $success = false;
        }
    }

    echo json_encode([
        'success' => $success,
        'message' => $success ? 'Department order saved successfully' : 'Some updates failed'
    ]);
}


function handleGetDesignationGlobalOrder() {
    $conn = getSQLServer();
    $sql = "SELECT DesignationId, DesignationsName, SortOrder FROM Designations WITH (NOLOCK) ORDER BY CASE WHEN SortOrder IS NULL THEN 1 ELSE 0 END, SortOrder ASC, DesignationsName ASC";
    $stmt = sqlsrv_query($conn, $sql);

    if (!$stmt) {
        echo json_encode([
            'success' => false,
            'message' => 'Query failed',
            'errors' => sqlsrv_errors()
        ]);
        return;
    }

    $data = [];
    while ($row = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC)) {
        $data[] = [
            'id' => $row['DesignationId'],
            'name' => $row['DesignationsName'],
            'sortOrder' => $row['SortOrder'] !== null ? intval($row['SortOrder']) : null
        ];
    }
    echo json_encode(['success' => true, 'data' => $data]);
}

function handleSaveDesignationGlobalOrder($input) {
    $conn = getSQLServer();
    $items = isset($input['items']) ? $input['items'] : [];
    $success = true;
    $errorLog = [];

    foreach ($items as $item) {
        $id = intval($item['id']);
        $sortOrder = isset($item['sortOrder']) && $item['sortOrder'] !== '' ? intval($item['sortOrder']) : null;

        $stmt = sqlsrv_query($conn, "UPDATE Designations SET SortOrder = ? WHERE DesignationId = ?", [$sortOrder, $id]);

        if (!$stmt) {
            $success = false;
            $errorLog[] = ['id' => $id, 'errors' => sqlsrv_errors()];
        }
    }

    echo json_encode([
        'success' => $success,
        'message' => $success ? 'Designation order saved successfully' : 'Some updates failed',
        'errors' => $errorLog
    ]);
}


function handleGetDesignationFamilies() {
    $conn = getSQLServer();

    $sql = "SELECT F.Id AS FamilyId, F.FamilyName, F.SortOrder, D.DesignationId, D.DesignationsName FROM DesignationFamily F WITH (NOLOCK) LEFT JOIN DesignationFamilyMapping M WITH (NOLOCK) ON M.FamilyId = F.Id LEFT JOIN Designations D WITH (NOLOCK) ON D.DesignationId = M.DesignationId ORDER BY CASE WHEN F.SortOrder IS NULL THEN 1 ELSE 0 END, F.SortOrder ASC, F.FamilyName ASC, D.DesignationsName ASC";

    $stmt = sqlsrv_query($conn, $sql);

    if (!$stmt) {
        echo json_encode(['success' => false, 'message' => 'Query failed', 'errors' => sqlsrv_errors()]);
        return;
    }

    $data = [];
    while ($row = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC)) {
        $famId = $row['FamilyId'];
        if (!isset($data[$famId])) {
            $data[$famId] = [
                'id' => $famId,
                'name' => $row['FamilyName'],
                'sortOrder' => intval($row['SortOrder']),
                'designations' => []
            ];
        }
        if ($row['DesignationId']) {
            $data[$famId]['designations'][] = [
                'id' => $row['DesignationId'],
                'name' => $row['DesignationsName']
            ];
        }
    }

    echo json_encode(['success' => true, 'data' => array_values($data)]);
}


function handleSaveDesignationFamily($input) {
    $conn = getSQLServer();

    $id = isset($input['id']) ? intval($input['id']) : 0;
    $name = isset($input['familyName']) ? trim($input['familyName']) : '';
    $sortOrder = isset($input['sortOrder']) && $input['sortOrder'] !== '' ? intval($input['sortOrder']) : 0;

    if (empty($name)) {
        echo json_encode(['success' => false, 'message' => 'Family name is required']);
        return;
    }

    if ($id > 0) {
        $sql = "UPDATE DesignationFamily SET FamilyName = ?, SortOrder = ? WHERE Id = ?";
        $stmt = sqlsrv_query($conn, $sql, [$name, $sortOrder, $id]);
    } else {
        $sql = "INSERT INTO DesignationFamily (FamilyName, SortOrder) VALUES (?, ?)";
        $stmt = sqlsrv_query($conn, $sql, [$name, $sortOrder]);

        if ($stmt) {
            $idStmt = sqlsrv_query($conn, "SELECT SCOPE_IDENTITY() AS NewId");
            $idRow = sqlsrv_fetch_array($idStmt, SQLSRV_FETCH_ASSOC);
            $id = intval($idRow['NewId']);
        }
    }

    if (!$stmt) {
        echo json_encode(['success' => false, 'message' => 'Save failed', 'errors' => sqlsrv_errors()]);
        return;
    }

    echo json_encode(['success' => true, 'id' => $id, 'message' => 'Family saved successfully']);
}


function handleDeleteDesignationFamily($input) {
    $conn = getSQLServer();
    $id = isset($input['id']) ? intval($input['id']) : 0;

    if ($id <= 0) {
        echo json_encode(['success' => false, 'message' => 'Invalid family id']);
        return;
    }

    $sql = "DELETE FROM DesignationFamily WHERE Id = ?";
    $stmt = sqlsrv_query($conn, $sql, [$id]);

    if (!$stmt) {
        echo json_encode(['success' => false, 'message' => 'Delete failed', 'errors' => sqlsrv_errors()]);
        return;
    }

    echo json_encode(['success' => true, 'message' => 'Family deleted successfully']);
}


function handleSaveDesignationFamilyMapping($input) {
    $conn = getSQLServer();

    $familyId = isset($input['familyId']) ? intval($input['familyId']) : 0;
    $designationIds = isset($input['designationIds']) ? $input['designationIds'] : [];

    if ($familyId <= 0) {
        echo json_encode(['success' => false, 'message' => 'Invalid family id']);
        return;
    }

    $sqlDelete = "DELETE FROM DesignationFamilyMapping WHERE FamilyId = ?";
    sqlsrv_query($conn, $sqlDelete, [$familyId]);

    $success = true;
    foreach ($designationIds as $desigId) {
        $desigId = intval($desigId);
        if ($desigId <= 0) continue;

        sqlsrv_query($conn, "DELETE FROM DesignationFamilyMapping WHERE DesignationId = ?", [$desigId]);

        $sqlInsert = "INSERT INTO DesignationFamilyMapping (FamilyId, DesignationId) VALUES (?, ?)";
        $stmtInsert = sqlsrv_query($conn, $sqlInsert, [$familyId, $desigId]);

        if (!$stmtInsert) {
            $success = false;
        }
    }

    echo json_encode([
        'success' => $success,
        'message' => $success ? 'Designations assigned successfully' : 'Some assignments failed'
    ]);
}



function handleGetUnmappedDesignations() {
    $conn = getSQLServer();

    $sql = "SELECT D.DesignationId, D.DesignationsName FROM Designations D WITH (NOLOCK) WHERE D.DesignationId NOT IN (SELECT DesignationId FROM DesignationFamilyMapping) ORDER BY D.DesignationsName ASC";

    $stmt = sqlsrv_query($conn, $sql);

    if (!$stmt) {
        echo json_encode(['success' => false, 'message' => 'Query failed', 'errors' => sqlsrv_errors()]);
        return;
    }

    $data = [];
    while ($row = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC)) {
        $data[] = [
            'id' => $row['DesignationId'],
            'name' => $row['DesignationsName']
        ];
    }

    echo json_encode(['success' => true, 'data' => $data]);
}


function handleLogout() {
    unset($_SESSION['userId']);
    unset($_SESSION['locations']);
    unset($_SESSION['companies']);
    unset($_SESSION['departments']);

    session_unset();
    session_destroy();

    echo json_encode([
        'success' => true,
        'message' => 'Logout successful'
    ]);
}