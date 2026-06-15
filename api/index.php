<?php

//echo  phpinfo();exit;
/**
 * Consolidated API for Attendance Dashboard
 * Handles all requests through a single entry point using actions.
 */

// Suppress errors for clean JSON output
ini_set('display_errors', 0);
error_reporting(0);

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
    case 'night_shift_dashboard_data':
        handleNightShiftData($input);
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
    case 'setup_db':
        handleSetupDB();
        break;
    case 'logout':
        handleLogout();
        break;
    default:
        echo json_encode(['success' => false, 'message' => 'Invalid or missing action: ' . $action]);
        break;
}

// --- Function Implementations ---

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

    if (empty($departments)) {
        $stmtAllDept = sqlsrv_query($conn, "SELECT DepartmentId FROM Departments");
        while ($row = sqlsrv_fetch_array($stmtAllDept, SQLSRV_FETCH_ASSOC)) {
            $departments[] = intval($row['DepartmentId']);
        }
    }

    $_SESSION['userId'] = $user['UserId'];
    $_SESSION['locations'] = $locations;
    $_SESSION['companies'] = $companies;
    $_SESSION['departments'] = $departments;

    echo json_encode([
        'success' => true,
        'message' => 'Login successful',
        'user' => [
            'id' => $user['UserId'],
            'username' => $user['LoginName'],
            'employee_id' => $user['EmployeeId'],
            'role' => $user['RoleName']
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
        
        if (empty($departments)) {
            $stmtAllDept = sqlsrv_query($conn, "SELECT DepartmentId FROM Departments");
            while ($row = sqlsrv_fetch_array($stmtAllDept, SQLSRV_FETCH_ASSOC)) {
                $departments[] = intval($row['DepartmentId']);
            }
        }
        
        $_SESSION['userId'] = $userId;
        $_SESSION['locations'] = $locations;
        $_SESSION['companies'] = $companies;
        $_SESSION['departments'] = $departments;
        
        echo json_encode([
            'success' => true,
            'message' => 'Password setup successful',
            'user' => [
                'id' => $user['UserId'],
                'username' => $user['LoginName'],
                'employee_id' => $user['EmployeeId'],
                'role' => $user['RoleName']
            ]
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'message' => 'Failed to save password. Please try again.'
        ]);
    }
}


function computeShiftStats($employees, $logs, $conn) {
    $shiftMaster = [];
    $stmt = sqlsrv_query($conn, "SELECT ShiftId, ShiftCode, ShiftName FROM Shifts WHERE RecordStatus = 1");
    while ($row = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC)) {
        $shiftMaster[intval($row['ShiftId'])] = [
            'code' => $row['ShiftCode'],
            'name' => $row['ShiftName']
        ];
    }

    $shiftEmpIds = [];
    $shiftMeta   = [];

    foreach ($logs as $log) {
        $shiftId = intval($log['shiftId']);
        if (!isset($shiftMaster[$shiftId])) continue;

        $shiftCode = $shiftMaster[$shiftId]['code'];
        $shiftName = $shiftMaster[$shiftId]['name'];
        $key = $shiftName;

        if (!isset($shiftEmpIds[$key])) {
            $shiftEmpIds[$key] = [];
            $shiftMeta[$key]   = ['shiftCode' => $shiftCode, 'shiftName' => $shiftName];
        }
        $shiftEmpIds[$key][$log['empId']] = true;
    }

    $shiftTotals = [];
    foreach ($employees as $emp) {
        $sn = $emp['shift'] ?? 'Unknown';
        $shiftTotals[$sn] = ($shiftTotals[$sn] ?? 0) + 1;
    }

    $shiftCounts = [];
    foreach ($shiftEmpIds as $key => $empMap) {
        $present = count($empMap);
        $total = $shiftTotals[$key] ?? $present;
        $absent = max(0, $total - $present);
        $rate = $total > 0 ? round(($present / $total) * 100) : 0;

        $shiftCounts[] = [
            'shiftCode' => $shiftMeta[$key]['shiftCode'],
            'shiftName' => $shiftMeta[$key]['shiftName'],
            'present' => $present,
            'total' => $total,
            'absent' => $absent,
            'rate' => $rate
        ];
    }
    return $shiftCounts;
}


/**
 * Handle Dashboard Data Fetch (Employees, Logs, Counts)
 */
function handleDashboardData($input, $returnData = false) {
    $userId = isset($input['userId']) ? intval($input['userId']) : 0;
    $month = isset($input['month']) ? intval($input['month']) : intval(date('n'));
    $year = isset($input['year']) ? intval($input['year']) : intval(date('Y'));
    
    $fromDay = isset($input['day_from']) ? intval($input['day_from']) : 1;
    $toDay = isset($input['day_to']) ? intval($input['day_to']) : date('t', strtotime("$year-$month-01"));
    
    $dayFrom = "$year-" . sprintf("%02d", $month) . "-" . sprintf("%02d", $fromDay);
    $dayTo = "$year-" . sprintf("%02d", $month) . "-" . sprintf("%02d", $toDay);
    
    $deptName = isset($input['dept']) && $input['dept'] !== 'All' ? $input['dept'] : null;
    $compName = isset($input['company']) && $input['company'] !== 'All' ? $input['company'] : null;
    $shiftName = isset($input['shift']) && $input['shift'] !== 'All' ? $input['shift'] : null;
    $conn = getSQLServer();

    $userLocations = $_SESSION['locations'] ?? [];
    $userCompanies = $_SESSION['companies'] ?? [];
    $userDepartments = $_SESSION['departments'] ?? [];

    $locationList = !empty($userLocations) ? implode(',', array_map('intval', $userLocations)) : '0';
    $companyList = !empty($userCompanies) ? implode(',', array_map('intval', $userCompanies)) : '0';
    $departmentList = !empty($userDepartments) ? implode(',', array_map('intval', $userDepartments)) : '0';

    // Pre-fetch shifts
    $empShifts = [];
    $shiftFilteredIds = [];
    $shiftParams = [];
    
    $sqlShifts = "SELECT ES.EmployeeId, S.ShiftName FROM (SELECT EmployeeId, ShiftId, ROW_NUMBER() OVER(PARTITION BY EmployeeId ORDER BY Shiftdate DESC) as rn FROM EmployeeShift WITH (NOLOCK)) ES JOIN Shifts S WITH (NOLOCK) ON ES.ShiftId = S.ShiftId INNER JOIN Employees E WITH (NOLOCK) ON ES.EmployeeId = E.EmployeeId INNER JOIN UserCompanies UC WITH (NOLOCK) ON E.CompanyId = UC.CompanyId WHERE ES.rn = 1 AND E.Location IN ($locationList) AND E.Status = 'Working' AND UC.UserId = $userId AND S.RecordStatus = '1'";
                  
    if ($shiftName) {
        $sqlShifts .= " AND S.ShiftName = ?";
        $shiftParams[] = $shiftName;
    }
    
    $stmtShifts = sqlsrv_query($conn, $sqlShifts, $shiftParams);
    if ($stmtShifts) {
        while ($r = sqlsrv_fetch_array($stmtShifts, SQLSRV_FETCH_ASSOC)) {
            $empShifts[$r['EmployeeId']] = $r['ShiftName'];
            if ($shiftName) {
                $shiftFilteredIds[] = $r['EmployeeId'];
            }
        }
    }

    if ($shiftName && empty($shiftFilteredIds)) {
        $shiftFilteredIds = [-1];
    }

    $sqlEmp = "SELECT E.EmployeeId, E.EmployeeName, E.EmployeeCode, E.Gender, E.DOB, E.Designation, DG.DesignationsName as DesignationName, C.CompanyFName as company, L.LocationName as location, D.DepartmentFName as dept, D.std_hc FROM Employees E WITH (NOLOCK) LEFT JOIN Companies C WITH (NOLOCK) ON E.CompanyId = C.CompanyId LEFT JOIN Locations L WITH (NOLOCK) ON E.Location = L.LocationId LEFT JOIN Departments D WITH (NOLOCK) ON E.DepartmentId = D.DepartmentId LEFT JOIN Designations DG WITH (NOLOCK) ON E.Designation = DG.DesignationId WHERE E.RecordStatus = 1 AND E.Location IN ($locationList) AND E.CompanyId IN ($companyList) AND E.DepartmentId IN ($departmentList) AND E.Status = 'Working'";

    $paramsEmp = [];
    if ($deptName) { 
        $sqlEmp .= " AND D.DepartmentFName = ?"; 
        $paramsEmp[] = $deptName; 
    }
    if ($compName) { 
        $sqlEmp .= " AND C.CompanyFName = ?"; 
        $paramsEmp[] = $compName; 
    }
    if ($shiftName) { 
        $sqlEmp .= " AND E.EmployeeId IN (" . implode(',', $shiftFilteredIds) . ")"; 
    }
    $sqlEmp .= " ORDER BY D.DepartmentFName ASC, E.EmployeeName ASC";

    $stmtEmp = sqlsrv_query($conn, $sqlEmp, $paramsEmp);
    $employees = [];
    if ($stmtEmp) {
        while ($row = sqlsrv_fetch_array($stmtEmp, SQLSRV_FETCH_ASSOC)) {
            $employees[] = [
                'id' => (string)$row['EmployeeId'],
                'code' => $row['EmployeeCode'],
                'name' => $row['EmployeeName'],
                'dob' => $row['DOB'] ? $row['DOB']->format('Y-m-d') : '1990-01-01',
                'gender' => in_array(strtoupper(trim($row['Gender'])), ['MALE', 'M']) ? 'Male' : 'Female',
                'dept' => $row['dept'] ?: 'Dept ' . $row['DepartmentId'],
                'std_hc' => intval($row['std_hc']),
                'company' => $row['company'] ?: 'Unknown',
                'designation' => $row['DesignationName'] ?: 'Staff',
                'shift' => isset($empShifts[$row['EmployeeId']]) ? $empShifts[$row['EmployeeId']] : 'Unknown',
                'location' => $row['location'] ?: 'Head Office'
            ];
        }
    }

    // 2. Attendance Logs
    $logs = [];

    $curDate = new DateTime(date('Y-m-01', strtotime($dayFrom)));
    $endDate = new DateTime(date('Y-m-01', strtotime($dayTo)));

    while ($curDate <= $endDate) {
        $m = (int)$curDate->format('n');
        $y = (int)$curDate->format('Y');

        $logTable = "AttendanceLogs_{$m}_{$y}";
        $tableExists = false;
        $checkTable = sqlsrv_query($conn, "SELECT 1 FROM sys.tables WHERE name = ?", [$logTable]);
        if ($checkTable && sqlsrv_fetch_array($checkTable)) {
            $tableExists = true;
        } else {
            $logTable = "AttendanceLogs_" . sprintf("%02d", $m) . "_{$y}";
            $checkTable = sqlsrv_query($conn, "SELECT 1 FROM sys.tables WHERE name = ?", [$logTable]);
            if ($checkTable && sqlsrv_fetch_array($checkTable)) {
                $tableExists = true;
            }
        }

        if ($tableExists) {
            $sqlLogs = "SELECT A.EmployeeId, A.AttendanceDate, A.InTime, A.OutTime, A.Status, A.Duration, A.LateBy, A.EarlyBy, A.Present, A.MissedInPunch, A.MissedOutPunch, A.ShiftId FROM $logTable A WITH (NOLOCK) JOIN Employees E WITH (NOLOCK) ON A.EmployeeId = E.EmployeeId LEFT JOIN Departments D WITH (NOLOCK) ON E.DepartmentId = D.DepartmentId LEFT JOIN Companies C WITH (NOLOCK) ON E.CompanyId = C.CompanyId WHERE E.Location IN ($locationList) AND E.CompanyId IN ($companyList) AND E.DepartmentId IN ($departmentList) AND A.AttendanceDate >= '$dayFrom' AND A.AttendanceDate <= '$dayTo 23:59:59' AND E.Status = 'Working'";

            $paramsLogs = [];
            if ($deptName) { 
                $sqlLogs .= " AND D.DepartmentFName = ?"; 
                $paramsLogs[] = $deptName; 
            }
            if ($compName) { 
                $sqlLogs .= " AND C.CompanyFName = ?"; 
                $paramsLogs[] = $compName; 
            }
            if ($shiftName) { 
                $sqlLogs .= " AND A.EmployeeId IN (" . implode(',', $shiftFilteredIds) . ")"; 
            }

            $stmtLogs = sqlsrv_query($conn, $sqlLogs, $paramsLogs);
            if ($stmtLogs) {
                while ($row = sqlsrv_fetch_array($stmtLogs, SQLSRV_FETCH_ASSOC)) {
                    $logs[] = [
                        'empId' => (string)$row['EmployeeId'],
                        'date' => $row['AttendanceDate'] ? $row['AttendanceDate']->format('Y-m-d') : null,
                        'inTime' => $row['InTime'],
                        'outTime' => $row['OutTime'],
                        'status' => $row['Status'] ?: 'Present',
                        // 'present' => intval($row['Present']),
                        'present' => floatval($row['Present']),
                        'hoursWorked' => round(floatval($row['Duration']) / 60, 2),
                        'lateBy' => intval($row['LateBy']),
                        'earlyBy' => intval($row['EarlyBy']),
                        'missedInPunch'  => intval($row['MissedInPunch']),
                        'missedOutPunch' => intval($row['MissedOutPunch']),
                        'shiftId' => intval($row['ShiftId']),
                    ];
                }
            }
        }
        $curDate->modify('+1 month');
    }

    // 3. Device Counts
    $counts = ['in' => 0, 'out' => 0];
    $devTables = [];

    $curDate = new DateTime(date('Y-m-01', strtotime($dayFrom)));
    $endDate = new DateTime(date('Y-m-01', strtotime($dayTo)));

    while ($curDate <= $endDate) {
        $m = (int)$curDate->format('n');
        $y = (int)$curDate->format('Y');

        $devTable = "DeviceLogs_{$m}_{$y}";
        $tableExists = false;
        $checkTable = sqlsrv_query($conn, "SELECT 1 FROM sys.tables WHERE name = ?", [$devTable]);
        if ($checkTable && sqlsrv_fetch_array($checkTable)) {
            $tableExists = true;
        } else {
            $devTable = "DeviceLogs_" . sprintf("%02d", $m) . "_{$y}";
            $checkTable = sqlsrv_query($conn, "SELECT 1 FROM sys.tables WHERE name = ?", [$devTable]);
            if ($checkTable && sqlsrv_fetch_array($checkTable)) {
                $tableExists = true;
            }
        }

        if ($tableExists) {
            $devTables[] = $devTable;

            $sqlDev = "SELECT D.Direction, COUNT(D.DeviceLogId) as total FROM $devTable D WITH (NOLOCK) LEFT JOIN Employees E WITH (NOLOCK) ON CAST(D.UserId AS VARCHAR(50)) = CAST(E.EmployeeCodeInDevice AS VARCHAR(50)) LEFT JOIN Departments De WITH (NOLOCK) ON E.DepartmentId = De.DepartmentId LEFT JOIN Companies C WITH (NOLOCK) ON E.CompanyId = C.CompanyId WHERE E.Location IN ($locationList) AND E.CompanyId IN ($companyList) AND E.DepartmentId IN ($departmentList) AND D.Direction != '' AND D.LogDate >= '$dayFrom' AND D.LogDate <= '$dayTo 23:59:59' AND E.Status = 'Working'";

            $paramsDev = [];
            if ($deptName) { $sqlDev .= " AND De.DepartmentFName = ?"; $paramsDev[] = $deptName; }
            if ($compName) { $sqlDev .= " AND C.CompanyFName = ?"; $paramsDev[] = $compName; }
            if ($shiftName) { $sqlDev .= " AND D.UserId IN (" . implode(',', $shiftFilteredIds) . ")"; }
            $sqlDev .= " GROUP BY D.Direction";

            $stmtDev = sqlsrv_query($conn, $sqlDev, $paramsDev);
            if ($stmtDev) {
                while ($row = sqlsrv_fetch_array($stmtDev, SQLSRV_FETCH_ASSOC)) {
                    $dir = trim($row['Direction']);
                    if (strcasecmp($dir, 'in') == 0 || $dir === '0') $counts['in'] += $row['total'];
                    else if (strcasecmp($dir, 'out') == 0 || $dir === '1') $counts['out'] += $row['total'];
                }
            }
        }
        $curDate->modify('+1 month');
    }

    $totalEmployees = count($employees);
    $presentEmployees = 0;

    $attendancePresentEmpIds = [];
    foreach ($logs as $log) {
        if ($log['present'] == 1) {
            $attendancePresentEmpIds[$log['empId']] = true;
        }
    }

    $missingEmployeeIds = [];
    foreach ($employees as $emp) {
        if (!isset($attendancePresentEmpIds[$emp['id']])) {
            $missingEmployeeIds[] = $emp['id'];
        }
    }

    $devicePresentEmpIds = [];
    if (!empty($missingEmployeeIds) && !empty($devTables)) {
        $missingLookup = array_flip($missingEmployeeIds); 

        foreach ($devTables as $devTable) {
            $sqlDevicePresent = "SELECT DISTINCT E.EmployeeId FROM $devTable D WITH (NOLOCK) INNER JOIN Employees E WITH (NOLOCK) ON CAST(D.UserId AS VARCHAR(50)) = CAST(E.EmployeeCodeInDevice AS VARCHAR(50)) WHERE D.LogDate >= '$dayFrom' AND D.LogDate <= '$dayTo 23:59:59' AND E.Status = 'Working' AND E.RecordStatus = 1";

            $stmtDevicePresent = sqlsrv_query($conn, $sqlDevicePresent);

            if ($stmtDevicePresent) {
                while ($row = sqlsrv_fetch_array($stmtDevicePresent, SQLSRV_FETCH_ASSOC)) {
                    $empId = (string)$row['EmployeeId'];
                    if (isset($missingLookup[$empId])) {
                        $devicePresentEmpIds[$empId] = true;
                    }
                }
            }
        }
    }

    $finalPresentEmpIds = $attendancePresentEmpIds;

    foreach ($devicePresentEmpIds as $empId => $value) {
        $finalPresentEmpIds[$empId] = true;
    }

    $presentEmployees = count($finalPresentEmpIds);
    $dataSource = 'attendance+device';

    $singlePunch = 0;
    $lateIn = 0;
    $earlyOut = 0;
    $avgHours = 0;
    $totalHours = 0;
    $hoursCount = 0;
    foreach ($logs as $log) {
        if (($log['missedInPunch'] ?? 0) == 1 || ($log['missedOutPunch'] ?? 0) == 1) {
            $singlePunch++;
        }

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
    }
    $avgHours = $hoursCount > 0 ? round($totalHours / $hoursCount, 2) : 0;
    
    $absentEmployees = max(0, $totalEmployees - $presentEmployees);

    $shiftStats = computeShiftStats($employees, $logs, $conn);

    if ($returnData) {
        return [
            'conn' => $conn,
            'employees' => $employees,
            'logs' => $logs,
            'devTables' => $devTables,
            'dayFrom' => $dayFrom,
            'dayTo' => $dayTo,
            'shiftStats' => $shiftStats
        ];
    }

    echo json_encode([
        'success' => true,
        'todayStats' => [
            'present' => $presentEmployees,
            'absent' => $absentEmployees,
            'total' => $totalEmployees,
            'singlePunch' => $singlePunch,
            'lateIn' => $lateIn,
            'earlyOut' => $earlyOut,
            'avgHours' => $avgHours
        ],
        'employees' => $employees,
        'attendanceLogs' => $logs,
        'counts' => $counts,
        'shiftStats' => $shiftStats,
        'timestamp' => date('Y-m-d H:i:s'),
        'dataSource' => $dataSource
    ]);
}

function handleNightShiftData($input) {
    $data = handleDashboardData($input, true);
    $conn = $data['conn'];
    $employees = $data['employees'];
    $logs = $data['logs'];
    $devTables = $data['devTables'];
    $dayFrom = $data['dayFrom'];
    $dayTo = $data['dayTo'];

    $nightShiftEmployees = [];
    foreach ($employees as $emp) {
        if (in_array($emp['shift'], ['DSTN', 'CPC'])) {
            $nightShiftEmployees[] = $emp;
        }
    }
    $nightShiftEmployeeIds = array_column($nightShiftEmployees, 'id');

    $nightShiftLogs = [];
    foreach ($logs as $log) {
        if (in_array($log['empId'], $nightShiftEmployeeIds)) {
            $nightShiftLogs[] = $log;
        }
    }

    $nightSinglePunch = 0;
    $nightLateIn = 0;
    $nightEarlyOut = 0;
    $nightTotalHours = 0;
    $nightHoursCount = 0;
    foreach ($nightShiftLogs as $log) {
        if (($log['missedInPunch'] ?? 0) == 1 || ($log['missedOutPunch'] ?? 0) == 1) {
            $nightSinglePunch++;
        }
        if (($log['lateBy'] ?? 0) > 0) {
            $nightLateIn++;
        }
        if (($log['earlyBy'] ?? 0) > 0) {
            $nightEarlyOut++;
        }
        $nightTotalHours += floatval($log['hoursWorked']);
        if ($log['hoursWorked'] > 0) {
            $nightHoursCount++;
        }
    }

    $nightAvgHours = $nightHoursCount > 0 ? round($nightTotalHours / $nightHoursCount, 2) : 0;
    $nightTotalEmployees = count($nightShiftEmployees);

    if (!empty($nightShiftLogs)) {
        $nightPresentIds = [];
        foreach ($nightShiftLogs as $log) {
            if ($log['present'] == 1) {
                $nightPresentIds[$log['empId']] = true;
            }
        }
        $nightPresentEmployees = count($nightPresentIds);
    } else {
        $nightPresentEmployees = 0;

        if (!empty($nightShiftEmployeeIds) && !empty($devTables)) {
            $unionParts = [];
            foreach ($devTables as $devTable) {
                $unionParts[] = "SELECT D.UserId, D.LogDate FROM $devTable D WITH (NOLOCK) WHERE D.LogDate >= '$dayFrom' AND D.LogDate <= '$dayTo 23:59:59'";
            }
            $unionSql = implode(" UNION ALL ", $unionParts);

            $sql = "SELECT COUNT(DISTINCT E.EmployeeId) AS PresentEmployees FROM ($unionSql) D INNER JOIN Employees E WITH (NOLOCK) ON CAST(D.UserId AS VARCHAR(50)) = CAST(E.EmployeeCodeInDevice AS VARCHAR(50)) WHERE E.EmployeeId IN (" . implode(',', $nightShiftEmployeeIds) . ")";

            $stmt = sqlsrv_query($conn, $sql);

            if ($stmt && ($row = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC))) {
                $nightPresentEmployees = intval($row['PresentEmployees']);
            }
        }
    }

    $nightAbsentEmployees = max(0, $nightTotalEmployees - $nightPresentEmployees);

    echo json_encode([
        'success' => true,
        'nightShiftStats' => [
            'present' => $nightPresentEmployees,
            'absent' => $nightAbsentEmployees,
            'total' => $nightTotalEmployees,
            'singlePunch' => $nightSinglePunch,
            'lateIn' => $nightLateIn,
            'earlyOut' => $nightEarlyOut,
            'avgHours' => $nightAvgHours
        ],
        'nightShiftEmployees' => $nightShiftEmployees,
        'nightShiftLogs' => $nightShiftLogs,
        'timestamp' => date('Y-m-d H:i:s')
    ]);
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

/**
 * Generate Department Attendance Report
 */
function handleGetReport($input) {
    $month = intval($input['month']); $year = intval($input['year']);
    $fromDay = intval($input['day_from']); $toDay = intval($input['day_to']);
    
    // Construct full date strings for SQL Server query
    $dayFrom = "$year-" . sprintf("%02d", $month) . "-" . sprintf("%02d", $fromDay);
    $dayTo = "$year-" . sprintf("%02d", $month) . "-" . sprintf("%02d", $toDay);
    
    $sqlConn = getSQLServer();

    $locationList = !empty($_SESSION['locations']) ? implode(',', array_map('intval', $_SESSION['locations'])) : '0';

    // 1. Departments and HC from SQL Server, filtered by Location 14
    $sqlD = "SELECT DISTINCT D.DepartmentId, D.DepartmentFName as DepartmentName, D.std_hc FROM Departments D WITH (NOLOCK) INNER JOIN Employees E WITH (NOLOCK) ON D.DepartmentId = E.DepartmentId WHERE E.Location IN ($locationList) AND E.Status = 'Working' ORDER BY D.DepartmentFName ASC";

    $stmtD = sqlsrv_query($sqlConn, $sqlD);
    
    $depts = [];
    $hcMap = [];
    while ($row = sqlsrv_fetch_array($stmtD, SQLSRV_FETCH_ASSOC)) {
        $depts[$row['DepartmentId']] = $row['DepartmentName'];
        $hcMap[$row['DepartmentId']] = intval($row['std_hc']);
    }

    $tableName = "AttendanceLogs_{$month}_{$year}";
    // Check if table exists (trying both month formats)
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
    if ($tableExists) {
        $sql = "SELECT E.DepartmentId, DAY(A.AttendanceDate) as AttDay, COUNT(CASE WHEN A.Present = 1 THEN 1 END) as PresentCount, COUNT(CASE WHEN A.OverTime > 0 THEN 1 END) as OTCount, COUNT(CASE WHEN A.WeeklyOff = 1 THEN 1 END) as WOCount, COUNT(CASE WHEN A.IsOnLeave = 1 THEN 1 END) as LeaveCount FROM $tableName A WITH (NOLOCK) JOIN Employees E WITH (NOLOCK) ON A.EmployeeId = E.EmployeeId WHERE A.AttendanceDate >= '$dayFrom' AND A.AttendanceDate <= '$dayTo 23:59:59' AND E.Location IN ($locationList) AND E.Status = 'Working' GROUP BY E.DepartmentId, DAY(A.AttendanceDate)";
    
        $stmt = sqlsrv_query($sqlConn, $sql);
        if ($stmt) {
            while ($row = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC)) {
                $liveData[$row['DepartmentId']][$row['AttDay']] = [
                    'present' => $row['PresentCount'], 'ot' => $row['OTCount'], 
                    'wo' => $row['WOCount'], 'leave' => $row['LeaveCount']
                ];
            }
        }
    }

    // 3. Format Response
    $numDays = $toDay - $fromDay + 1;
    $departments = [];
    $summary = [
        'total_present' => array_fill($fromDay, $numDays, 0),
        'overtime_paid' => array_fill($fromDay, $numDays, 0),
        'weekly_off_ph' => array_fill($fromDay, $numDays, 0),
        'on_leave' => array_fill($fromDay, $numDays, 0),
        'new_joinee' => array_fill($fromDay, $numDays, 0),
        'left' => array_fill($fromDay, $numDays, 0),
        'recruited_hc' => array_fill($fromDay, $numDays, array_sum($hcMap))
    ];
    // Combine all unique IDs from both hcMap and liveData to ensure all active depts are shown
    $allIds = array_unique(array_merge(array_keys($hcMap), array_keys($liveData)));

    foreach ($allIds as $id) {
        $stdHc = isset($hcMap[$id]) ? intval($hcMap[$id]) : 0;
        $hasData = isset($liveData[$id]);
        
        if ($stdHc <= 0 && !$hasData) continue;
        
        $name = isset($depts[$id]) ? $depts[$id] : "Dept $id";
        $days = []; $deptSum = 0;
        for ($d = $fromDay; $d <= $toDay; $d++) {
            $val = isset($liveData[$id][$d]) ? intval($liveData[$id][$d]['present']) : 0;
            $days[$d] = $val; $deptSum += $val;
            $summary['total_present'][$d] += $val;
            if (isset($liveData[$id][$d])) {
                $summary['overtime_paid'][$d] += intval($liveData[$id][$d]['ot']);
                $summary['weekly_off_ph'][$d] += intval($liveData[$id][$d]['wo']);
                $summary['on_leave'][$d] += intval($liveData[$id][$d]['leave']);
            }
        }
        $departments[] = [
            'department' => $name, 'std_hc' => $stdHc, 'days' => $days,
            'avg_hc' => round($deptSum / $numDays)
        ];
    }

    // Calculate summary averages for the bottom row
    $summary_avg = [];
    foreach ($summary as $key => $values) {
        if (is_array($values)) {
            $summary_avg[$key] = round(array_sum($values) / $numDays);
        }
    }

    echo json_encode([
        'success' => true, 
        'departments' => $departments, 
        'summary' => $summary,
        'summary_avg' => $summary_avg,
        'total_std_hc' => array_sum($hcMap)
    ]);
}

/**
 * Get simple list of departments filtered by Location 14
 */
function handleGetDepts() {
    $conn = getSQLServer();

    $locationList = implode(',', array_map('intval', $_SESSION['locations']));
    $departmentList = implode(',', array_map('intval', $_SESSION['departments']));

    $sql = "SELECT DISTINCT D.DepartmentId, D.DepartmentFName as DepartmentName, D.std_hc FROM Departments D WITH (NOLOCK) INNER JOIN Employees E WITH (NOLOCK) ON D.DepartmentId = E.DepartmentId WHERE E.Location IN ($locationList) AND E.DepartmentId IN ($departmentList) AND E.Status = 'Working' ORDER BY D.DepartmentFName ASC";

    $stmt = sqlsrv_query($conn, $sql);

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

    $locationList = implode(',', array_map('intval', $_SESSION['locations']));
    $companyList = implode(',', array_map('intval', $_SESSION['companies']));

    $sql = "SELECT DISTINCT C.CompanyId, C.CompanyFName as CompanyName FROM Companies C WITH (NOLOCK) INNER JOIN Employees E WITH (NOLOCK) ON C.CompanyId = E.CompanyId WHERE E.Location IN ($locationList) AND E.CompanyId IN ($companyList) AND E.Status = 'Working' ORDER BY C.CompanyFName ASC";

    $stmt = sqlsrv_query($conn, $sql);

    $data = [];
    while ($row = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC)) {
        $data[] = $row;
    }
    echo json_encode($data);
}

/**
 * Get simple list of active shifts for employees at Location 14
 */
/**
 * Get simple list of active shifts for employees at Location 14
 */
function handleGetShifts() {
    $conn = getSQLServer();

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

    $db->query("CREATE TABLE IF NOT EXISTS `users` (
        `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        `username` VARCHAR(50) NOT NULL UNIQUE,
        `name` VARCHAR(120) NOT NULL,
        `password_hash` VARCHAR(255) NOT NULL,
        `role` ENUM('admin','hr','viewer') DEFAULT 'viewer',
        `is_active` TINYINT(1) DEFAULT 1,
        `last_login` DATETIME,
        `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
    )");

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