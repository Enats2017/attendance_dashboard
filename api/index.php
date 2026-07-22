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
        "TrustServerCertificate" => true
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
        getSubAdmins();
        break;
    case 'get_std_hc':
        handleGetStdHC();
        break;
    case 'bulk_update_std_hc':
        handleBulkUpdateStdHC($input);
        break;
    case 'get_report':
        handleGetReport($input);
        break;
    case 'get_depts':
        handleGetDepts();
        break;
    case 'get_companies':
        handleGetCompanies();
        break;
    case 'get_shifts':
        handleGetShifts();
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
            'department'  => getPlaceholderIds($conn, 'Departments', 'DepartmentId', 'DepartmentFName'),
            'company'     => getPlaceholderIds($conn, 'Companies', 'CompanyId', 'CompanyFName'),
            'shiftGroup'  => getPlaceholderIds($conn, 'ShiftGroups', 'ShiftGroupId', 'ShiftGroupName'),
            'location'    => getPlaceholderIds($conn, 'Locations', 'LocationId', 'LocationName'),
        ];

        // Master = koi bhi dimension (location/company/department) me explicit restriction nahi hai
        $isMaster = !$locationsAssigned && !$companiesAssigned && !$departmentsAssigned;
        
        $_SESSION['userId'] = $userId;
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


/**
 * Handle Dashboard Data Fetch (Employees, Logs, Counts)
 */
function handleDashboardData($input, $returnData = false) {
    $userId = isset($input['userId']) ? intval($input['userId']) : 0;
    if (isset($input['date_from']) && isset($input['date_to'])) {
        $dayFrom = $input['date_from'];
        $dayTo = $input['date_to'];
        $deviceFrom = $dayFrom;
        $deviceTo = $dayTo;
    } else {
        // Backward-compatible fallback for any old caller still using month/year/day_from/day_to
        $month = isset($input['month']) ? intval($input['month']) : intval(date('n'));
        $year = isset($input['year']) ? intval($input['year']) : intval(date('Y'));
        $fromDay = isset($input['day_from']) ? intval($input['day_from']) : 1;
        $toDay = isset($input['day_to']) ? intval($input['day_to']) : date('t', strtotime("$year-$month-01"));
        $dayFrom = "$year-" . sprintf("%02d", $month) . "-" . sprintf("%02d", $fromDay);
        $dayTo = "$year-" . sprintf("%02d", $month) . "-" . sprintf("%02d", $toDay);
    }
    
    $deptName = isset($input['dept']) && $input['dept'] !== 'All' ? $input['dept'] : null;
    $compName = isset($input['company']) && $input['company'] !== 'All' ? $input['company'] : null;
    $shiftName = isset($input['shift']) && $input['shift'] !== 'All' ? $input['shift'] : null;
    $locationFilter = isset($input['location']) && $input['location'] !== 'All' ? $input['location'] : null;
    $conn = getSQLServer();
    $allTeams = getAllTeams($conn);

    $userLocations = $_SESSION['locations'] ?? [];
    $userCompanies = $_SESSION['companies'] ?? [];
    $userDepartments = $_SESSION['departments'] ?? [];

    $targetUserId = null;
    if (!empty($_SESSION['isMaster']) && !empty($input['subadmin_user_id'])) {
        $targetUserId = intval($input['subadmin_user_id']);
    }

    if ($targetUserId) {
        $userLocations = [];
        $userCompanies = [];
        $userDepartments = [];

        $stmtLoc = sqlsrv_query($conn, "SELECT LocationId FROM UserLocations WHERE UserId = ?", [$targetUserId]);
        while ($row = sqlsrv_fetch_array($stmtLoc, SQLSRV_FETCH_ASSOC)) {
            $userLocations[] = intval($row['LocationId']);
        }
        $stmtComp = sqlsrv_query($conn, "SELECT CompanyId FROM UserCompanies WHERE UserId = ?", [$targetUserId]);
        while ($row = sqlsrv_fetch_array($stmtComp, SQLSRV_FETCH_ASSOC)) {
            $userCompanies[] = intval($row['CompanyId']);
        }
        $stmtDept = sqlsrv_query($conn, "SELECT DepartmentId FROM UserDepartments WHERE UserId = ?", [$targetUserId]);
        while ($row = sqlsrv_fetch_array($stmtDept, SQLSRV_FETCH_ASSOC)) {
            $userDepartments[] = intval($row['DepartmentId']);
        }
    } else {
        $userLocations = $_SESSION['locations'] ?? [];
        $userCompanies = $_SESSION['companies'] ?? [];
        $userDepartments = $_SESSION['departments'] ?? [];
    }

    $placeholderIds = $_SESSION['placeholderIds'] ?? [
        'designation' => [], 'department' => [], 'company' => [], 'shiftGroup' => [], 'location' => []
    ];

    $locationList = !empty($userLocations) ? implode(',', array_map('intval', $userLocations)) : '0';
    $companyList = !empty($userCompanies) ? implode(',', array_map('intval', $userCompanies)) : '0';
    $departmentList = !empty($userDepartments) ? implode(',', array_map('intval', $userDepartments)) : '0';

    $shiftGroupNameMap = [];
    $stmtGroups = sqlsrv_query($conn, "SELECT ShiftGroupId, ShiftGroupName FROM ShiftGroups");
    if ($stmtGroups) {
        while ($r = sqlsrv_fetch_array($stmtGroups, SQLSRV_FETCH_ASSOC)) {
            $shiftGroupNameMap[intval($r['ShiftGroupId'])] = $r['ShiftGroupName'] ?? '';
        }
    }

    $sqlEmp = "SELECT E.EmployeeId, E.DepartmentId, E.ShiftGroupId, E.EmployeeName, E.EmployeeCode, E.Gender, E.DOB, E.CategoryId, E.Designation, E.DOJ, E.Team, DG.DesignationsName as DesignationName, ISNULL(DSO.SortOrder, 0) as designationSortOrder, ISNULL(DG.SortOrder, 0) as designationGlobalSortOrder, C.CompanyFName as company, C.CompanyeMail as companyEmail, Z.ZoneName as zoneName, L.LocationName as location, D.DepartmentFName as dept, D.std_hc FROM Employees E WITH (NOLOCK) LEFT JOIN Companies C WITH (NOLOCK) ON E.CompanyId = C.CompanyId LEFT JOIN Zones Z WITH (NOLOCK) ON C.ZoneId = Z.ZoneId LEFT JOIN Locations L WITH (NOLOCK) ON E.Location = L.LocationId LEFT JOIN Departments D WITH (NOLOCK) ON E.DepartmentId = D.DepartmentId LEFT JOIN Designations DG WITH (NOLOCK) ON E.Designation = DG.DesignationId LEFT JOIN departmentDeginationSortOrder DSO WITH (NOLOCK) ON E.DepartmentId = DSO.DepartmentId AND E.Designation = DSO.DesignationId WHERE E.RecordStatus = 1 AND E.Location IN ($locationList) AND E.CompanyId IN ($companyList) AND E.DepartmentId IN ($departmentList) AND E.DOJ <= ? AND (E.Status = 'Working' OR (E.Status = 'Resigned' AND E.DOR > ?))";

    $paramsEmp = [$dayTo, $dayTo];
    
    if ($deptName) { 
        $sqlEmp .= " AND D.DepartmentFName = ?"; 
        $paramsEmp[] = $deptName; 
    }
    
    if ($compName) { 
        $sqlEmp .= " AND C.CompanyFName = ?"; 
        $paramsEmp[] = $compName; 
    }
    
    if ($locationFilter) {
        $sqlEmp .= " AND L.LocationName = ?";
        $paramsEmp[] = $locationFilter;
    }
    
    $sqlEmp .= " ORDER BY CASE WHEN C.SortOrder IS NULL THEN 1 ELSE 0 END, C.SortOrder ASC, CASE WHEN D.SortOrder IS NULL THEN 1 ELSE 0 END, D.SortOrder ASC, E.EmployeeName ASC";

    $stmtEmp = sqlsrv_query($conn, $sqlEmp, $paramsEmp);
    
    $employees = [];
    
    if ($stmtEmp) {
        while ($row = sqlsrv_fetch_array($stmtEmp, SQLSRV_FETCH_ASSOC)) {
            $zoneName = strtoupper(trim($row['zoneName'] ?? ''));
                switch ($zoneName) {
                    case 'CONTRACTOR':
                        $companyCategory = 'CONTRACTOR';
                        break;
                    case 'ONROLL':
                        $companyCategory = 'ON-ROLL';
                        break;
                    case 'CC':
                        $companyCategory = 'CC';
                        break;
                    case 'AUDITOR':
                        $companyCategory = 'AUDITOR';
                        break;
                    case 'OUTSOURCE':
                        $companyCategory = 'OUTSOURCE';
                        break;
                    default:
                        $companyCategory = 'OTHER';
                        break;
                }

            $employees[] = [
                'id' => (string)$row['EmployeeId'],
                'code' => $row['EmployeeCode'],
                'name' => $row['EmployeeName'],
                'dob' => $row['DOB'] ? $row['DOB']->format('Y-m-d') : '1990-01-01',
                'dobRaw' => $row['DOB'] ? $row['DOB']->format('Y-m-d') : null,               
                'gender' => in_array(strtoupper(trim($row['Gender'] ?? '')), ['MALE', 'M']) ? 'Male' : 'Female',
                'genderRaw' => trim($row['Gender'] ?? ''),                                    
                'dept' => $row['dept'] ?: 'Dept ' . $row['DepartmentId'],
                'deptId' => intval($row['DepartmentId']),
                'std_hc' => intval($row['std_hc']),
                'company' => $row['company'] ?: 'Unknown',
                'companyEmail' => $row['companyEmail'] ?? null,
                'companyCategory' => $companyCategory,
                'categoryId' => intval($row['CategoryId']),
                'categoryIdRaw' => $row['CategoryId'],                                        
                'designationId' => intval($row['Designation']),
                'designationRaw' => $row['Designation'],                                      
                'designation' => $row['DesignationName'] ?: 'Staff',
                'designationNameRaw' => $row['DesignationName'],                        
                'designationSortOrder' => isset($row['designationSortOrder']) ? intval($row['designationSortOrder']) : 0,
                'designationGlobalSortOrder' => isset($row['designationGlobalSortOrder']) ? intval($row['designationGlobalSortOrder']) : 0,
                'shiftGroupId' => intval($row['ShiftGroupId']),
                'shiftGroupName' => $shiftGroupNameMap[intval($row['ShiftGroupId'])] ?? 'No Shift Group',
                'shiftId' => null,
                'shift' => null,
                'shiftStart' => null,
                'shiftEnd' => null,
                'location' => $row['location'] ?: 'Head Office',
                'doj' => $row['DOJ'] ? $row['DOJ']->format('Y-m-d') : null,               
                'team' => isset($row['Team']) ? intval($row['Team']) : null,
                'teamName' => isset($row['Team']) ? ($allTeams[intval($row['Team'])] ?? 'No Team') : 'No Team'                  
            ];
        }

        $staffTeamId = null;
        $workerTeamId = null;
        foreach ($allTeams as $tid => $tname) {
            if (strcasecmp(trim($tname ?? ''), 'Staff') === 0)   $staffTeamId = $tid;
            if (strcasecmp(trim($tname ?? ''), 'Workmen') === 0) $workerTeamId = $tid;
        }

        $staffEmpIds = [];
        $workerEmpIds = [];
        foreach ($employees as $emp) {
            $teamId = $emp['team'];
            if ($teamId === $staffTeamId) {
                $staffEmpIds[$emp['id']] = true;
            } elseif ($teamId === $workerTeamId) {
                $workerEmpIds[$emp['id']] = true;
            }
        }
    }
        
    $resignedEmployees = [];
    $newJoinedEmployees = [];

    $sqlResigned = "SELECT E.EmployeeId, E.CategoryId, E.Team, E.EmployeeName, E.ShiftGroupId, E.EmployeeCode, E.Gender, E.DOB, E.Designation, DG.DesignationsName as DesignationName, C.CompanyFName as company, L.LocationName as location, D.DepartmentFName as dept, E.DOJ, E.DOR, E.Status FROM Employees E WITH (NOLOCK) LEFT JOIN Companies C WITH (NOLOCK) ON E.CompanyId = C.CompanyId LEFT JOIN Locations L WITH (NOLOCK) ON E.Location = L.LocationId LEFT JOIN Departments D WITH (NOLOCK) ON E.DepartmentId = D.DepartmentId LEFT JOIN Designations DG WITH (NOLOCK) ON E.Designation = DG.DesignationId WHERE E.RecordStatus = 1 AND E.Location IN ($locationList) AND E.CompanyId IN ($companyList) AND E.DepartmentId IN ($departmentList) AND E.Status = 'Resigned' AND E.DOR >= ? AND E.DOR <= ?";

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
        $sqlResigned .= " AND L.LocationName = ?";
        $paramsResigned[] = $locationFilter;
    }
    $sqlResigned .= " ORDER BY CASE WHEN C.SortOrder IS NULL THEN 1 ELSE 0 END, C.SortOrder ASC, CASE WHEN D.SortOrder IS NULL THEN 1 ELSE 0 END, D.SortOrder ASC, E.EmployeeName ASC";

    $stmtResigned = sqlsrv_query($conn, $sqlResigned, $paramsResigned);
    if ($stmtResigned) {
        while ($row = sqlsrv_fetch_array($stmtResigned, SQLSRV_FETCH_ASSOC)) {
            $resignedEmployees[] = [
                'id' => (string)$row['EmployeeId'],
                'code' => $row['EmployeeCode'],
                'name' => $row['EmployeeName'],
                'dob' => $row['DOB'] ? $row['DOB']->format('Y-m-d') : null,
                'gender' => in_array(strtoupper(trim($row['Gender'])), ['MALE', 'M']) ? 'Male' : 'Female',
                'dept' => $row['dept'] ?: 'Dept ' . $row['DepartmentId'],
                'company' => $row['company'] ?: 'Unknown',
                'categoryId' => intval($row['CategoryId']),
                'team' => isset($row['Team']) ? intval($row['Team']) : null,
                'teamName' => isset($row['Team']) ? ($allTeams[intval($row['Team'])] ?? 'No Team') : 'No Team',
                'designationId' => intval($row['Designation']),
                'designation' => $row['DesignationName'] ?: 'Staff',
                'shiftGroupName' => $shiftGroupNameMap[intval($row['ShiftGroupId'])] ?? 'No Shift Group',
                'location' => $row['location'] ?: 'Head Office',
                'status' => 'Resigned',
                'doj' => $row['DOJ'] ? $row['DOJ']->format('Y-m-d') : null,
                'dor' => $row['DOR'] ? $row['DOR']->format('Y-m-d') : null
            ];
        }
    }

    $sqlNewJoined = "SELECT E.EmployeeId, E.CategoryId, E.Team, E.ShiftGroupId, E.EmployeeName, E.EmployeeCode, E.Gender, E.DOB, E.Designation, DG.DesignationsName as DesignationName, C.CompanyFName as company, L.LocationName as location, D.DepartmentFName as dept, E.DOJ, E.DOR, E.Status FROM Employees E WITH (NOLOCK) LEFT JOIN Companies C WITH (NOLOCK) ON E.CompanyId = C.CompanyId LEFT JOIN Locations L WITH (NOLOCK) ON E.Location = L.LocationId LEFT JOIN Departments D WITH (NOLOCK) ON E.DepartmentId = D.DepartmentId LEFT JOIN Designations DG WITH (NOLOCK) ON E.Designation = DG.DesignationId WHERE E.RecordStatus = 1 AND E.Location IN ($locationList) AND E.CompanyId IN ($companyList) AND E.DepartmentId IN ($departmentList) AND E.DOJ >= ? AND E.DOJ <= ?";

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
        $sqlNewJoined .= " AND L.LocationName = ?";
        $paramsNewJoined[] = $locationFilter;
    }
    $sqlNewJoined .= " ORDER BY CASE WHEN C.SortOrder IS NULL THEN 1 ELSE 0 END, C.SortOrder ASC, CASE WHEN D.SortOrder IS NULL THEN 1 ELSE 0 END, D.SortOrder ASC, E.EmployeeName ASC";

    $stmtNewJoined = sqlsrv_query($conn, $sqlNewJoined, $paramsNewJoined);
    if ($stmtNewJoined) {
        while ($row = sqlsrv_fetch_array($stmtNewJoined, SQLSRV_FETCH_ASSOC)) {
            $newJoinedEmployees[] = [
                'id' => (string)$row['EmployeeId'],
                'code' => $row['EmployeeCode'],
                'name' => $row['EmployeeName'],
                'dob' => $row['DOB'] ? $row['DOB']->format('Y-m-d') : null,
                'gender' => in_array(strtoupper(trim($row['Gender'])), ['MALE', 'M']) ? 'Male' : 'Female',
                'dept' => $row['dept'] ?: 'Dept ' . $row['DepartmentId'],
                'company' => $row['company'] ?: 'Unknown',
                'categoryId' => intval($row['CategoryId']),
                'team' => isset($row['Team']) ? intval($row['Team']) : null,
                'teamName' => isset($row['Team']) ? ($allTeams[intval($row['Team'])] ?? 'No Team') : 'No Team',
                'designationId' => intval($row['Designation']),
                'designation' => $row['DesignationName'] ?: 'Staff',
                'shiftGroupName' => $shiftGroupNameMap[intval($row['ShiftGroupId'])] ?? 'No Shift Group',
                'location' => $row['location'] ?: 'Head Office',
                'status' => $row['Status'] ?: 'Working',
                'doj' => $row['DOJ'] ? $row['DOJ']->format('Y-m-d') : null,
                'dor' => $row['DOR'] ? $row['DOR']->format('Y-m-d') : null
            ];
        }
    }

    $allTableNames = [];
    $stmtAllTables = sqlsrv_query($conn, "SELECT name FROM sys.tables WHERE name LIKE 'AttendanceLogs_%' OR name LIKE 'DeviceLogs_%'");
    if ($stmtAllTables) {
        while ($rowT = sqlsrv_fetch_array($stmtAllTables, SQLSRV_FETCH_ASSOC)) {
            $allTableNames[$rowT['name']] = true;
        }
    }

    $logs = [];

    $curDate = new DateTime(date('Y-m-01', strtotime($dayFrom)));
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
            $sqlLogs = "SELECT A.EmployeeId, A.AttendanceDate, A.InTime, A.OutTime, A.Status, A.DetailedStatus, A.DetailedStatusCode, A.Duration, A.LateBy, A.EarlyBy, A.ComplinFreeLateBy, A.ComplinFreeEarlyBy, A.Present, A.Absent, A.WeeklyOff, A.Holiday, A.IsOnLeave, A.IsPartialDay, A.MissedInPunch, A.MissedOutPunch, A.PunchRecords, A.ReportPunchRecords, A.PunchDirections, A.ShiftId, A.InDeviceId, A.OutDeviceId, A.PunchDevicesName, A.LastUpdatedOn, A.OverTime, S.ShiftCode, S.ShiftName, S.BeginTime, S.EndTime FROM $logTable A WITH (NOLOCK) INNER JOIN Employees E WITH (NOLOCK) ON A.EmployeeId = E.EmployeeId LEFT JOIN Shifts S WITH (NOLOCK) ON A.ShiftId = S.ShiftId LEFT JOIN Departments D WITH (NOLOCK) ON E.DepartmentId = D.DepartmentId LEFT JOIN Companies C WITH (NOLOCK) ON E.CompanyId = C.CompanyId LEFT JOIN Locations L WITH (NOLOCK) ON E.Location = L.LocationId WHERE E.Location IN ($locationList) AND E.CompanyId IN ($companyList) AND E.DepartmentId IN ($departmentList) AND A.AttendanceDate >= '$dayFrom' AND A.AttendanceDate <= '$dayTo 23:59:59' AND E.Status = 'Working'";

            $paramsLogs = [];
            
            if ($deptName) { 
                $sqlLogs .= " AND D.DepartmentFName = ?"; 
                $paramsLogs[] = $deptName; 
            }
            
            if ($compName) { 
                $sqlLogs .= " AND C.CompanyFName = ?"; 
                $paramsLogs[] = $compName; 
            }

            if ($locationFilter) {
                $sqlLogs .= " AND L.LocationName = ?";
                $paramsLogs[] = $locationFilter;
            }

            $stmtLogs = sqlsrv_query($conn, $sqlLogs, $paramsLogs);
            
            if ($stmtLogs) {
                while ($row = sqlsrv_fetch_array($stmtLogs, SQLSRV_FETCH_ASSOC)) {
                    $status = $row['Status'] ?: 'Absent';
                    $inDeviceId = intval($row['InDeviceId'] ?? 0);
                    $outDeviceId = intval($row['OutDeviceId'] ?? 0);
                    
                    $logs[] = [
                        'empId' => (string)$row['EmployeeId'],
                        'date' => $row['AttendanceDate'] ? $row['AttendanceDate']->format('Y-m-d') : null,
                        'inTime' => $row['InTime'] ? (is_object($row['InTime']) ? $row['InTime']->format('H:i:s') : $row['InTime']) : null,
                        'outTime' => $row['OutTime'] ? (is_object($row['OutTime']) ? $row['OutTime']->format('H:i:s') : $row['OutTime']) : null,
                        'status' => $status,
                        'detailedStatus' => trim($row['DetailedStatus'] ?? ''),
                        'detailedStatusCode' => strtoupper(trim($row['DetailedStatusCode'] ?? '')),
                        'present' => floatval($row['Present']),
                        'absent' => floatval($row['Absent']),
                        'weeklyOff' => intval($row['WeeklyOff']),
                        'holiday' => intval($row['Holiday']),
                        'isOnLeave' => intval($row['IsOnLeave']),
                        'isPartialDay' => intval($row['IsPartialDay']),
                        'hoursWorked' => round(floatval($row['Duration']) / 60, 2),
                        'lateBy' => intval($row['LateBy']),
                        'earlyBy' => intval($row['EarlyBy']),
                        'missedInPunch' => intval($row['MissedInPunch']),
                        'missedOutPunch' => intval($row['MissedOutPunch']),
                        'punchRecords' => trim($row['PunchRecords'] ?? ''),
                        'reportPunchRecords' => trim($row['ReportPunchRecords'] ?? ''),
                        'punchDirections' => trim($row['PunchDirections'] ?? ''),
                        'shiftId' => intval($row['ShiftId']),
                        'shiftName' => $row['ShiftName'],
                        'shiftCode' => $row['ShiftCode'],
                        'shiftStart' => $row['BeginTime'] ? (is_object($row['BeginTime']) ? $row['BeginTime']->format('H:i') : $row['BeginTime']) : null,
                        'shiftEnd' => $row['EndTime'] ? (is_object($row['EndTime']) ? $row['EndTime']->format('H:i') : $row['EndTime']) : null,
                        'inDeviceId' => $inDeviceId,
                        'outDeviceId' => $outDeviceId,
                        'punchDevicesName' => trim($row['PunchDevicesName'] ?? ''),
                        'lastUpdatedOn' => $row['LastUpdatedOn'] ? (is_object($row['LastUpdatedOn']) ? $row['LastUpdatedOn']->format('Y-m-d H:i:s') : $row['LastUpdatedOn']) : null,
                        'isManualPunch' => ($inDeviceId === 5 || $outDeviceId === 5) ? 1 : 0,
                        'overtime' => intval($row['OverTime'] ?? 0), 
                    ];
                }
            }
        }

        $curDate->modify('+1 month');
    }

    // 3. Device Counts
    $deviceEmployeeStats = [];
    $counts = ['in' => 0, 'out' => 0];
    $devTables = [];

    $curDate = new DateTime(date('Y-m-01', strtotime($dayFrom)));
    $endDate = new DateTime(date('Y-m-01', strtotime($dayTo)));

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

            $sqlDevRaw = "SELECT D.AttDirection, D.LogDate, CAST(D.LogDate AS DATE) AS PunchDate, E.EmployeeId FROM $devTable D WITH (NOLOCK) INNER JOIN Employees E WITH (NOLOCK) ON CAST(D.UserId AS VARCHAR(50)) = CAST(E.EmployeeCodeInDevice AS VARCHAR(50)) LEFT JOIN Departments De WITH (NOLOCK) ON E.DepartmentId = De.DepartmentId LEFT JOIN Companies C WITH (NOLOCK) ON E.CompanyId = C.CompanyId LEFT JOIN Locations L WITH (NOLOCK) ON E.Location = L.LocationId WHERE E.Location IN ($locationList) AND E.CompanyId IN ($companyList) AND E.DepartmentId IN ($departmentList) AND D.LogDate >= '$deviceFrom' AND D.LogDate <= '$deviceTo 23:59:59' AND E.Status = 'Working' AND E.RecordStatus = 1";

            $paramsDevRaw = [];

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

            $devEmpDayBuckets = [];
            if ($stmtDevRaw) {
				$deviceRows = [];
                while ($row = sqlsrv_fetch_array($stmtDevRaw, SQLSRV_FETCH_ASSOC)) {
                    $deviceRows[] = $row;
                    $dir = trim($row['AttDirection'] ?? '');
                    $isIn = (strcasecmp($dir, 'in') == 0 || $dir === '0');
                }

                $devEmpDayBuckets = [];
                foreach ($deviceRows as $row) {
                    $dir = trim($row['AttDirection'] ?? '');
                    $isIn = (strcasecmp($dir, 'in') == 0 || $dir === '0');
                    $isOut = (strcasecmp($dir, 'out') == 0 || $dir === '1');
                    $empId = (string)$row['EmployeeId'];

                    $attendanceDate = clone $row['LogDate'];
                    $attendanceDate->setTime(0, 0, 0);

                    $key = $empId . '_' . $attendanceDate->format('Y-m-d');

                    if (!isset($devEmpDayBuckets[$key])) {
                        $devEmpDayBuckets[$key] = [
                            'count' => 0,
                            'inCount' => 0,
                            'outCount' => 0,
                            'firstIn' => null,
                            'lastOut' => null,
                            'first' => $row['LogDate'],
                            'last' => $row['LogDate']
                        ];
                    }

                    $devEmpDayBuckets[$key]['count']++;

                    if ($isIn) {
                        $devEmpDayBuckets[$key]['inCount']++;
                        if ($devEmpDayBuckets[$key]['firstIn'] === null || $row['LogDate'] < $devEmpDayBuckets[$key]['firstIn']) {
                            $devEmpDayBuckets[$key]['firstIn'] = $row['LogDate'];
                        }
                    }

                    if ($isOut) {
                        $devEmpDayBuckets[$key]['outCount']++;
                        if ($devEmpDayBuckets[$key]['lastOut'] === null || $row['LogDate'] > $devEmpDayBuckets[$key]['lastOut']) {
                            $devEmpDayBuckets[$key]['lastOut'] = $row['LogDate'];
                        }
                    }

                    if ($row['LogDate'] < $devEmpDayBuckets[$key]['first']) {
                        $devEmpDayBuckets[$key]['first'] = $row['LogDate'];
                    }

                    if ($row['LogDate'] > $devEmpDayBuckets[$key]['last']) {
                        $devEmpDayBuckets[$key]['last'] = $row['LogDate'];
                    }
                }
            }

            foreach ($devEmpDayBuckets as $key => $bucket) {
                $deviceEmployeeStats[$key] = [
                    'punchCount' => $bucket['count'],
                    'inCount' => $bucket['inCount'],
                    'outCount' => $bucket['outCount'],
                    'firstIn' => $bucket['firstIn'],
                    'lastOut' => $bucket['lastOut'],
                    'firstPunch' => $bucket['first'],
                    'lastPunch' => $bucket['last']
                ];
            }
        }

        $curDate->modify('+1 month');
    }

    $empShiftFromLogs = [];
    foreach ($logs as $log) {
        if (!empty($log['shiftId']) && !isset($empShiftFromLogs[$log['empId']])) {
            $empShiftFromLogs[$log['empId']] = [
                'shiftId' => $log['shiftId'],
                'shift' => $log['shiftName'],
                'shiftStart' => $log['shiftStart'],
                'shiftEnd' => $log['shiftEnd'],
            ];
        }
    }
    foreach ($employees as &$emp) {
        if (isset($empShiftFromLogs[$emp['id']])) {
            $emp['shiftId'] = $empShiftFromLogs[$emp['id']]['shiftId'];
            $emp['shift'] = $empShiftFromLogs[$emp['id']]['shift'];
            $emp['shiftStart'] = $empShiftFromLogs[$emp['id']]['shiftStart'];
            $emp['shiftEnd'] = $empShiftFromLogs[$emp['id']]['shiftEnd'];
        }
    }
    unset($emp);

    if ($shiftName) {
        $employees = array_values(array_filter($employees, function($emp) use ($shiftName) {
            return $emp['shift'] === $shiftName;
        }));
        $staffEmpIds  = [];
        $workerEmpIds = [];
        foreach ($employees as $emp) {
            $teamId = $emp['team'];
            if ($teamId === $staffTeamId) {
                $staffEmpIds[$emp['id']] = true;
            } elseif ($teamId === $workerTeamId) {
                $workerEmpIds[$emp['id']] = true;
            }
        }
    }

    $totalEmployees = count($employees);

    $deptHeadcountMap = [];
    foreach ($employees as $emp) {
        $deptId = $emp['deptId'];
        if (!isset($deptHeadcountMap[$deptId])) {
            $deptHeadcountMap[$deptId] = [
                'name' => $emp['dept'],
                'required' => $emp['std_hc'],
                'available' => 0
            ];
        }
        $deptHeadcountMap[$deptId]['available']++;
    }

    $totalRequiredHeadcount = 0;
    $requiredHeadcountByDept = [];
    foreach ($deptHeadcountMap as $deptId => $info) {
        $totalRequiredHeadcount += $info['required'];
        $requiredHeadcountByDept[$info['name']] = [
            'required' => $info['required'],
            'available' => $info['available'],
            'gap' => $info['required'] - $info['available']
        ];
    }

    $totalGapHeadcount = $totalRequiredHeadcount - $totalEmployees;

    $employeesInAttendanceLogs = [];
    $presentRecordCount = 0;
    foreach ($logs as $log) {
        $key = $log['empId'] . '_' . $log['date'];
        $employeesInAttendanceLogs[$key] = true;
    
        if (floatval($log['present']) == 1 && $log['absent'] == 0) {
            $presentRecordCount++;
        }
    }

    $devicePresentDayCount = 0;
    foreach ($deviceEmployeeStats as $key => $stat) {
        if (isset($employeesInAttendanceLogs[$key])) {
            continue; 
        }

        if (($stat['inCount'] ?? 0) < 1 || ($stat['outCount'] ?? 0) < 1) {
            continue; 
        }

        list($empId, $date) = explode('_', $key, 2);

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

	$validEmpIdSet = [];
	foreach ($employees as $emp) {
		$validEmpIdSet[$emp['id']] = true;
	}

	$counts = ['in' => 0, 'out' => 0];
	foreach ($deviceEmployeeStats as $key => $stat) {
		[$empId] = explode('_', $key, 2);
		if (!isset($validEmpIdSet[$empId])) {
			continue;
		}
		$counts['in']  += $stat['inCount'] ?? 0;
		$counts['out'] += $stat['outCount'] ?? 0;
	}

	$singlePunch = 0;
    $singlePunchKeys = [];
    $singlePunchData = [];
    $weeklyOffKeySet = [];
    $today = date('Y-m-d');

    // Build weekly off set
    foreach ($logs as $log) {
        $present = floatval($log['present']);
        $absent = floatval($log['absent']);
        if ($present == 0 && $absent == 0 && intval($log['weeklyOff']) == 1) {
            $weeklyOffKeySet[$log['empId'] . '_' . $log['date']] = true;
        }
    }

    foreach ($logs as $log) {
        $key = $log['empId'] . '_' . $log['date'];
        $date = $log['date'];

        if (!isset($validEmpIdSet[$log['empId']])) continue;
        if (isset($weeklyOffKeySet[$key])) continue;
        if (isset($singlePunchData[$key])) continue;

        $hasInTime = !empty($log['inTime']) && $log['inTime'] !== '00:00' && $log['inTime'] !== '00:00:00';
        $hasOutTime = !empty($log['outTime']) && $log['outTime'] !== '00:00' && $log['outTime'] !== '00:00:00';

        if ($hasInTime && $hasOutTime) {
            continue;
        }

        $punchRecords = trim($log['reportPunchRecords'] ?? '');
        if (empty($punchRecords)) {
            continue;
        }

        $punchRecordsLower = strtolower($punchRecords);

        $inCount = substr_count($punchRecordsLower, '(in)');
        $outCount = substr_count($punchRecordsLower, '(out)');
        $totalPunches = $inCount + $outCount;

        if ($totalPunches == 0) {
            continue;
        }

        if ($totalPunches > 1) {
            continue;
        }

        if ($totalPunches == 1 && $inCount == 1) {
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
                'shiftEnd' => $log['shiftEnd'] ?? null
            ];

            continue;
        }

        if ($totalPunches == 1 && $outCount == 1) {
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
                'shiftEnd'   => $log['shiftEnd'] ?? null
            ];
            
            continue;
        }
    }

	$lateIn = 0;
	$earlyOut = 0;
	$totalHours = 0;
	$hoursCount = 0;
    $manualPunchCount = 0;  
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
	}

    $avgHours = $hoursCount > 0 ? round($totalHours / $hoursCount, 2) : 0;

    $statusKeyMap = [];

    foreach ($logs as $log) {

        $key = $log['empId'] . '_' . $log['date'];

        if (isset($singlePunchData[$key])) {
            $statusKeyMap[$key] = 'singlePunch';
            continue;
        }

        $code = strtoupper(trim($log['detailedStatusCode'] ?? ''));
        $isWeeklyOff = intval($log['weeklyOff']) === 1;

        switch ($code) {
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

    $rangeStart = new DateTime($dayFrom);
    $rangeEnd = new DateTime($dayTo);
    
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

    for ($d = clone $rangeStart; $d <= $rangeEnd; $d->modify('+1 day')) {
        $dateStr = $d->format('Y-m-d');
        foreach ($employees as $e) {
            $k = $e['id'] . '_' . $dateStr;
            $empStatus = $statusKeyMap[$k] ?? 'absent';

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
            }
        }
    }

    $totalEmployeeDays = 0;
    $presentEmployeeDays = 0;
    $weeklyOffPresentDays = 0;
    $halfPresentEmployeeDays = 0;
    $weeklyOffHalfPresentDays = 0;
    $weeklyOffEmployeeDays = 0;
    $absentEmployeeDays = 0;

    for ($d = clone $rangeStart; $d <= $rangeEnd; $d->modify('+1 day')) {
        $dateStr = $d->format('Y-m-d');
        foreach ($employees as $e) {
            $totalEmployeeDays++;
            $k = $e['id'] . '_' . $dateStr;
            $empStatus = $statusKeyMap[$k] ?? 'absent';

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

    echo json_encode([
        'success' => true,
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
        'gapHeadcount' => $totalGapHeadcount,
        'requiredHeadcountByDept' => $requiredHeadcountByDept,
		'teamConfig' => [
            'staffTeamId' => $staffTeamId,
            'workerTeamId' => $workerTeamId,
        ],
        'placeholderIds' => $placeholderIds,
        'singlePunchKeys' => $singlePunchKeys,
		'singlePunchData' => $singlePunchData,
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
        ],
        'employees' => $employees,
        'attendanceLogs' => $logs,
        'counts' => $counts,
        'shiftStats' => $shiftStats,
        'resignedEmployees' => $resignedEmployees,
        'newJoinedEmployees' => $newJoinedEmployees,
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

    $subAdmins = [];
    if ($stmt) {
        while ($row = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC)) {
            $stmtLoc = sqlsrv_query($conn, "SELECT COUNT(*) as cnt FROM UserLocations WHERE UserId = ?", [$row['UserId']]);
            $locCount = sqlsrv_fetch_array($stmtLoc, SQLSRV_FETCH_ASSOC)['cnt'];

            $stmtComp = sqlsrv_query($conn, "SELECT COUNT(*) as cnt FROM UserCompanies WHERE UserId = ?", [$row['UserId']]);
            $compCount = sqlsrv_fetch_array($stmtComp, SQLSRV_FETCH_ASSOC)['cnt'];

            $stmtDept = sqlsrv_query($conn, "SELECT COUNT(*) as cnt FROM UserDepartments WHERE UserId = ?", [$row['UserId']]);
            $deptCount = sqlsrv_fetch_array($stmtDept, SQLSRV_FETCH_ASSOC)['cnt'];

            $isSubMaster = ($locCount == 0 && $compCount == 0 && $deptCount == 0);
            if ($isSubMaster) continue; 

            $subAdmins[] = [
                'id' => $row['UserId'],
                'name' => $row['LoginName'],
                'role' => $row['RoleName'],
            ];
        }
    }

    echo json_encode(['success' => true, 'data' => $subAdmins]);
}


/**
 * Handle Dept Report - Get STD Headcounts
 */
function handleGetStdHC() {
    $sqlConn = getSQLServer();
    $locationList = !empty($_SESSION['locations']) ? implode(',', array_map('intval', $_SESSION['locations'])) : '0';
    
    $sqlDepts = "SELECT DISTINCT D.DepartmentId, D.DepartmentFName as DepartmentName, D.std_hc FROM Departments D WITH (NOLOCK) INNER JOIN Employees E WITH (NOLOCK) ON D.DepartmentId = E.DepartmentId WHERE E.Location IN ($locationList) AND E.Status = 'Working' ORDER BY D.DepartmentFName ASC";
    
    $stmt = sqlsrv_query($sqlConn, $sqlDepts);
    
    $data = [];
    while ($row = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC)) {
        $data[] = [
            'dept_id' => $row['DepartmentId'],
            'department_name' => $row['DepartmentName'],
            'std_hc' => intval($row['std_hc'])
        ];
    }

    $firstLocation = !empty($_SESSION['locations']) ? intval($_SESSION['locations'][0]) : 0;
    $sqlLoc = "SELECT LocationName as unit_name, unit_capacity FROM Locations WHERE LocationId = $firstLocation";
    $stmtLoc = sqlsrv_query($sqlConn, $sqlLoc);
    $unitConfig = ['unit_name' => 'PSF', 'unit_capacity' => '150 Tons']; // default
    if ($rowLoc = sqlsrv_fetch_array($stmtLoc, SQLSRV_FETCH_ASSOC)) {
        $unitConfig = [
            'unit_name' => $rowLoc['unit_name'] ?: 'PSF',
            'unit_capacity' => $rowLoc['unit_capacity'] ?: '150 Tons'
        ];
    }

    echo json_encode(['success' => true, 'data' => $data, 'unit_config' => $unitConfig]);
}

/**
 * Bulk Update STD Headcounts
 */
function handleBulkUpdateStdHC($input) {
    $items = isset($input['items']) ? $input['items'] : [];
    $sqlConn = getSQLServer();
    foreach ($items as $item) {
        $id = intval($item['dept_id']);
        $hc = intval($item['std_hc']);
        $sql = "UPDATE Departments SET std_hc = ? WHERE DepartmentId = ?";
        $params = array($hc, $id);
        sqlsrv_query($sqlConn, $sql, $params);
    }
    echo json_encode(['success' => true]);
}


// >>> NEW: add this small helper function ABOVE handleGetReport (outside it), once.
function resolveAttendanceStatusCode($detailedStatusCode, $isWeeklyOff) {
    $code = strtoupper(trim($detailedStatusCode ?? ''));
    switch ($code) {
        case 'P':
            return 'P';
        case '½PLD':
        case 'L_CL':
        case '½PCL':
        case '½PLD(HO)':
            return 'HD';
        case 'WO':
            return 'WO';
        case 'WOP':
            return $isWeeklyOff ? 'WOP' : 'P';
        case '½PLD(WO)':
            return $isWeeklyOff ? 'WOHP' : 'HD';
        case 'A':
        case 'ALD':
        case 'WOA':
        default:
            return 'A';
    }
}


function isSinglePunchDay($rec) {
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
    $locationList = !empty($_SESSION['locations']) ? implode(',', array_map('intval', $_SESSION['locations'])) : '0';
    $companyList = !empty($_SESSION['companies']) ? implode(',', array_map('intval', $_SESSION['companies'])) : '0';
    $departmentList = !empty($_SESSION['departments']) ? implode(',', array_map('intval', $_SESSION['departments'])) : '0';
 
    $sqlD = "SELECT D.DepartmentId, D.DepartmentFName as DepartmentName, D.std_hc, D.SortOrder FROM Departments D WITH (NOLOCK) INNER JOIN Employees E WITH (NOLOCK) ON D.DepartmentId = E.DepartmentId WHERE E.Location IN ($locationList) AND E.CompanyId IN ($companyList) AND E.DepartmentId IN ($departmentList) AND E.Status = 'Working' GROUP BY D.DepartmentId, D.DepartmentFName, D.std_hc, D.SortOrder ORDER BY CASE WHEN D.SortOrder IS NULL THEN 1 ELSE 0 END, D.SortOrder ASC, D.DepartmentFName ASC";
 
    $sqlEmpDates = "SELECT E.EmployeeId, E.DepartmentId, E.DOJ, E.DOR, E.Status FROM Employees E WITH (NOLOCK) WHERE E.Location IN ($locationList) AND E.CompanyId IN ($companyList) AND E.DepartmentId IN ($departmentList)";
    $stmtEmpDates = sqlsrv_query($sqlConn, $sqlEmpDates);
    $empDateRows = [];
    if ($stmtEmpDates) {
        while ($row = sqlsrv_fetch_array($stmtEmpDates, SQLSRV_FETCH_ASSOC)) {
            $empDateRows[] = [
                'deptId' => $row['DepartmentId'],
                'doj' => $row['DOJ'] ? $row['DOJ']->format('Y-m-d') : null,
                'dor' => $row['DOR'] ? $row['DOR']->format('Y-m-d') : null,
                'status' => $row['Status']
            ];
        }
    }
 
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
    $hcMap = [];
    $deptOrder = [];
    while ($row = sqlsrv_fetch_array($stmtD, SQLSRV_FETCH_ASSOC)) {
        $deptId = $row['DepartmentId'];
        $depts[$deptId] = $row['DepartmentName'];
        $hcMap[$deptId] = intval($row['std_hc']);
        $deptOrder[] = $deptId;
    }
 
    $sqlDesig = "SELECT E.DepartmentId, E.Designation as DesignationId, DG.DesignationsName, ISNULL(DSO.SortOrder, 0) as DesigSortOrder FROM Employees E WITH (NOLOCK) INNER JOIN Designations DG WITH (NOLOCK) ON E.Designation = DG.DesignationId LEFT JOIN departmentDeginationSortOrder DSO WITH (NOLOCK) ON E.DepartmentId = DSO.DepartmentId AND E.Designation = DSO.DesignationId WHERE E.Location IN ($locationList) AND E.CompanyId IN ($companyList) AND E.DepartmentId IN ($departmentList) AND E.Status = 'Working' GROUP BY E.DepartmentId, E.Designation, DG.DesignationsName, ISNULL(DSO.SortOrder, 0) ORDER BY CASE WHEN ISNULL(DSO.SortOrder, 0) IS NULL THEN 1 ELSE 0 END, ISNULL(DSO.SortOrder, 0) ASC, DG.DesignationsName ASC";
 
    $stmtDesig = sqlsrv_query($sqlConn, $sqlDesig);
 
    if (!$stmtDesig) {
        echo json_encode([
            'success' => false,
            'message' => 'Query failed (designations)',
            'errors' => sqlsrv_errors()
        ]);
 
        return;
    }
 
    $desigByDept = [];
    if ($stmtDesig) {
        while ($row = sqlsrv_fetch_array($stmtDesig, SQLSRV_FETCH_ASSOC)) {
            $deptId = $row['DepartmentId'];
            if (!isset($desigByDept[$deptId])) $desigByDept[$deptId] = [];
            $desigByDept[$deptId][] = [
                'id' => $row['DesignationId'],
                'name' => $row['DesignationsName'],
                'sortOrder' => intval($row['DesigSortOrder'])
            ];
        }
    }
 
    $sqlEmpList = "SELECT E.EmployeeId, E.EmployeeCode, E.EmployeeName, E.DepartmentId, E.Designation as DesignationId FROM Employees E WITH (NOLOCK) WHERE E.Location IN ($locationList) AND E.CompanyId IN ($companyList) AND E.DepartmentId IN ($departmentList) AND E.Status = 'Working'";
 
    $stmtEmpList = sqlsrv_query($sqlConn, $sqlEmpList);
 
    $employeesByDeptDesig = [];
    $empMeta = []; 
    if ($stmtEmpList) {
        while ($row = sqlsrv_fetch_array($stmtEmpList, SQLSRV_FETCH_ASSOC)) {
            $deptId = $row['DepartmentId'];
            $desigId = $row['DesignationId'];
            $empId = (string)$row['EmployeeId'];
            $employeesByDeptDesig[$deptId][$desigId][] = [
                'id' => $empId,
                'code' => $row['EmployeeCode'],
                'name' => $row['EmployeeName']
            ];
            
            $empMeta[$empId] = [
                'dept' => $deptId,
                'desig' => $desigId,
                'code' => $row['EmployeeCode'],
                'name' => $row['EmployeeName']
            ];
        }
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
 
    $liveData = [];
    $liveDataByDesig = [];
    $empDayStatus = [];
    if ($tableExists) {
        $sql = "SELECT E.DepartmentId, DAY(A.AttendanceDate) as AttDay, COUNT(CASE WHEN A.Present = 1 THEN 1 END) as PresentCount, COUNT(CASE WHEN A.OverTime > 0 THEN 1 END) as OTCount, COUNT(CASE WHEN A.WeeklyOff = 1 THEN 1 END) as WOCount, COUNT(CASE WHEN A.IsOnLeave = 1 THEN 1 END) as LeaveCount FROM $tableName A WITH (NOLOCK) JOIN Employees E WITH (NOLOCK) ON A.EmployeeId = E.EmployeeId WHERE A.AttendanceDate >= '$dayFrom' AND A.AttendanceDate <= '$dayTo 23:59:59' AND E.Location IN ($locationList) AND E.CompanyId IN ($companyList) AND E.DepartmentId IN ($departmentList) AND E.Status = 'Working' GROUP BY E.DepartmentId, DAY(A.AttendanceDate)";
 
        $stmt = sqlsrv_query($sqlConn, $sql);
        if ($stmt) {
            while ($row = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC)) {
                $liveData[$row['DepartmentId']][$row['AttDay']] = [
                    'present' => $row['PresentCount'], 'ot' => $row['OTCount'],
                    'wo' => $row['WOCount'], 'leave' => $row['LeaveCount']
                ];
            }
        }
 
        $sqlDesigData = "SELECT E.DepartmentId, E.Designation as DesignationId, DAY(A.AttendanceDate) as AttDay, COUNT(CASE WHEN A.Present = 1 THEN 1 END) as PresentCount FROM $tableName A WITH (NOLOCK) JOIN Employees E WITH (NOLOCK) ON A.EmployeeId = E.EmployeeId WHERE A.AttendanceDate >= '$dayFrom' AND A.AttendanceDate <= '$dayTo 23:59:59' AND E.Location IN ($locationList) AND E.CompanyId IN ($companyList) AND E.DepartmentId IN ($departmentList) AND E.Status = 'Working' GROUP BY E.DepartmentId, E.Designation, DAY(A.AttendanceDate)";
 
        $stmtDesigData = sqlsrv_query($sqlConn, $sqlDesigData);
        if ($stmtDesigData) {
            while ($row = sqlsrv_fetch_array($stmtDesigData, SQLSRV_FETCH_ASSOC)) {
                $liveDataByDesig[$row['DepartmentId']][$row['DesignationId']][$row['AttDay']] = intval($row['PresentCount']);
            }
        }
 
        $sqlEmpDayStatus = "SELECT A.EmployeeId, DAY(A.AttendanceDate) as AttDay, A.DetailedStatusCode, A.WeeklyOff, A.InTime, A.OutTime, A.ReportPunchRecords, A.Present, A.Absent, A.OverTime, A.IsOnLeave FROM $tableName A WITH (NOLOCK) JOIN Employees E WITH (NOLOCK) ON A.EmployeeId = E.EmployeeId WHERE A.AttendanceDate >= '$dayFrom' AND A.AttendanceDate <= '$dayTo 23:59:59' AND E.Location IN ($locationList) AND E.CompanyId IN ($companyList) AND E.DepartmentId IN ($departmentList) AND E.Status = 'Working'";
 
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
                    'onLeave' => intval($row['IsOnLeave'] ?? 0)
                ];
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
 
    $numDays = $toDay - $fromDay + 1;
    $departments = [];
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
        'recruited_hc' => array_fill($fromDay, $numDays, 0)   
    ];
 
    $deptHeadcountByDay = [];
    for ($d = $fromDay; $d <= $toDay; $d++) {
        $dateStr = "$year-" . sprintf('%02d', $month) . "-" . sprintf('%02d', $d);
        $deptActiveToday = [];
        foreach ($empDateRows as $emp) {
            if (!$emp['doj'] || $emp['doj'] > $dateStr) continue;
            $wasActive = ($emp['status'] === 'Working')
                || ($emp['status'] === 'Resigned' && $emp['dor'] && $emp['dor'] > $dateStr);
            if ($wasActive) {
                $deptActiveToday[$emp['deptId']] = true;
                $deptHeadcountByDay[$emp['deptId']][$d] = ($deptHeadcountByDay[$emp['deptId']][$d] ?? 0) + 1;
            }
        }
 
        $daySum = 0;
        foreach ($deptActiveToday as $deptId => $_) {
            $daySum += $hcMap[$deptId] ?? 0;
        }
        
        $summary['recruited_hc'][$d] = $daySum;
    }
 
    $newJoineeEmployeesByDay = [];
    $sqlNewJoinByDay = "SELECT E.EmployeeId, E.EmployeeCode, E.EmployeeName, E.DepartmentId, E.Designation as DesignationId, DAY(E.DOJ) as JoinDay FROM Employees E WITH (NOLOCK) WHERE E.Location IN ($locationList) AND E.CompanyId IN ($companyList) AND E.DepartmentId IN ($departmentList) AND E.DOJ >= '$dayFrom' AND E.DOJ <= '$dayTo'";
    $stmtNewJoin = sqlsrv_query($sqlConn, $sqlNewJoinByDay);
    if ($stmtNewJoin) {
        while ($row = sqlsrv_fetch_array($stmtNewJoin, SQLSRV_FETCH_ASSOC)) {
            $d = intval($row['JoinDay']);
            if (isset($summary['new_joinee'][$d])) {
                $summary['new_joinee'][$d]++;
            }
            if (!isset($newJoineeEmployeesByDay[$d])) $newJoineeEmployeesByDay[$d] = [];
            $newJoineeEmployeesByDay[$d][] = [
                'employeeId' => (string)$row['EmployeeId'],
                'employeeCode' => $row['EmployeeCode'],
                'employeeName' => $row['EmployeeName'],
                'departmentId' => $row['DepartmentId'],
                'departmentName' => $depts[$row['DepartmentId']] ?? null,
                'designationId' => $row['DesignationId']
            ];
        }
    }
 
    $leftEmployeesByDay = [];
    $sqlLeftByDay = "SELECT E.EmployeeId, E.EmployeeCode, E.EmployeeName, E.DepartmentId, E.Designation as DesignationId, DAY(E.DOR) as LeaveDay FROM Employees E WITH (NOLOCK) WHERE E.Location IN ($locationList) AND E.CompanyId IN ($companyList) AND E.DepartmentId IN ($departmentList) AND E.Status = 'Resigned' AND E.DOR >= '$dayFrom' AND E.DOR <= '$dayTo'";
    $stmtLeft = sqlsrv_query($sqlConn, $sqlLeftByDay);
    if ($stmtLeft) {
        while ($row = sqlsrv_fetch_array($stmtLeft, SQLSRV_FETCH_ASSOC)) {
            $d = intval($row['LeaveDay']);
            if (isset($summary['left'][$d])) {
                $summary['left'][$d]++;
            }
            if (!isset($leftEmployeesByDay[$d])) $leftEmployeesByDay[$d] = [];
            $leftEmployeesByDay[$d][] = [
                'employeeId' => (string)$row['EmployeeId'],
                'employeeCode' => $row['EmployeeCode'],
                'employeeName' => $row['EmployeeName'],
                'departmentId' => $row['DepartmentId'],
                'departmentName' => $depts[$row['DepartmentId']] ?? null,
                'designationId' => $row['DesignationId']
            ];
        }
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
        $hasData = isset($liveData[$id]) || isset($statusCountsByDept[$id]); 
        if ($stdHc <= 0 && !$hasData) continue;
 
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
            'total_absent' => array_fill($fromDay, $numDays, 0),
            'total_weekly_off' => array_fill($fromDay, $numDays, 0),
        ];
 
        $designations = [];
        if (isset($desigByDept[$id])) {
            foreach ($desigByDept[$id] as $desig) {
                $desigId = $desig['id'];
 
                $desigSummary = [
                    'total_employees' => count($employeesByDeptDesig[$id][$desigId] ?? []),
                    'total_present' => array_fill($fromDay, $numDays, 0),
                    'total_half_present' => array_fill($fromDay, $numDays, 0),
                    'total_wo_present' => array_fill($fromDay, $numDays, 0),
                    'total_wo_half_present' => array_fill($fromDay, $numDays, 0),
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
                                case 'SP':
                                    $desigSummary['total_present'][$d]++;
                                    $deptSummary['total_present'][$d]++;
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
                    'designationName' => $desig['name'],
                    'sortOrder' => $desig['sortOrder'],
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
        'total_std_hc' => array_sum($hcMap)
    ]);
}
 

/**
 * Get simple list of departments filtered by Location 14
 */
function handleGetDepts() {
    $conn = getSQLServer();

    if (empty($_SESSION['locations']) || empty($_SESSION['departments'])) {
        echo json_encode(['success' => false, 'message' => 'Session expired. Please login again.']);
        return;
    }

    $locationList = implode(',', array_map('intval', $_SESSION['locations']));
    $departmentList = implode(',', array_map('intval', $_SESSION['departments']));

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
function handleGetCompanies() {
    $conn = getSQLServer();

    if (empty($_SESSION['locations']) || empty($_SESSION['companies'])) {
        echo json_encode(['success' => false, 'message' => 'Session expired. Please login again.']);
        return;
    }

    $locationList = implode(',', array_map('intval', $_SESSION['locations']));
    $companyList = implode(',', array_map('intval', $_SESSION['companies']));

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
function handleGetShifts() {
    $conn = getSQLServer();

    if (empty($_SESSION['locations']) || empty($_SESSION['companies'])) {
        echo json_encode(['success' => false, 'message' => 'Session expired. Please login again.']);
        return;
    }

    $locationList = implode(',', array_map('intval', $_SESSION['locations']));
    $companyList = implode(',', array_map('intval', $_SESSION['companies']));

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

    $sql = "SELECT D.DepartmentId, D.DepartmentFName AS DepartmentName, D.SortOrder FROM Departments D WITH (NOLOCK) INNER JOIN Employees E WITH (NOLOCK) ON D.DepartmentId = E.DepartmentId WHERE E.Location IN ($locationList) AND E.DepartmentId IN ($departmentList) AND E.Status = 'Working' GROUP BY D.DepartmentId, D.DepartmentFName, D.SortOrder ORDER BY CASE WHEN D.SortOrder IS NULL THEN 1 ELSE 0 END, D.SortOrder ASC, D.DepartmentFName ASC";

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