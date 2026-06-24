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
    case 'get_designations_order':
        handleGetDesignationsOrder();
        break;
    case 'save_designations_order':
        handleSaveDesignationsOrder($input);
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


function computeShiftStats($employees, $logs, $deviceEmployeeStats, $employeesInAttendanceLogs, $dayFrom, $dayTo, $conn) {
    $shiftStats = [];
    $empShiftLookup = [];
    foreach ($employees as $employee) {
        $shiftName = $employee['shift'] ?: 'No Shift';
        $empShiftLookup[$employee['id']] = $shiftName;

        if (!isset($shiftStats[$shiftName])) {
            $shiftStats[$shiftName] = [
                'shiftCode' => $shiftName,
                'shiftName' => $shiftName,
                'total' => 0,
                'present' => 0,
                'halfPresent' => 0,
                'weeklyOff' => 0,
                'holiday' => 0,
                'leave' => 0,
                'absent' => 0
            ];
        }
        $shiftStats[$shiftName]['total']++;
    }

    $logKeyMap = [];
    foreach ($logs as $log) {
        $key = $log['empId'] . '_' . $log['date'];
        if (!isset($logKeyMap[$key])) {
            $logKeyMap[$key] = $log;
        } else {
            if (floatval($log['present']) > floatval($logKeyMap[$key]['present'])) {
                $logKeyMap[$key] = $log;
            }
        }
    }

    $rangeStart = new DateTime($dayFrom);
    $rangeEnd = new DateTime($dayTo);

    for ($d = clone $rangeStart; $d <= $rangeEnd; $d->modify('+1 day')) {
        $dateStr = $d->format('Y-m-d');
        foreach ($employees as $e) {
            $empId = $e['id'];
            $shiftName = $empShiftLookup[$empId] ?? 'No Shift';
            $key = $empId . '_' . $dateStr;

            if (isset($logKeyMap[$key])) {
                $log = $logKeyMap[$key];
                $present = floatval($log['present']);
                $absent = floatval($log['absent']);

                if ($present == 1 && $absent == 0) {
                    $shiftStats[$shiftName]['present']++;
                } elseif ($present == 0.5 && $absent == 0.5) {
                    $shiftStats[$shiftName]['halfPresent']++;
                } elseif ($present == 0 && $absent == 0) {
                    $shiftStats[$shiftName]['weeklyOff']++;
                } else {
                    $shiftStats[$shiftName]['absent']++;
                }
            } elseif (isset($deviceEmployeeStats[$key])) {
                $stat = $deviceEmployeeStats[$key];
                if (($stat['inCount'] ?? 0) >= 1) {
                    $shiftStats[$shiftName]['present']++;
                } else {
                    $shiftStats[$shiftName]['absent']++;
                }
            } else {
                $shiftStats[$shiftName]['absent']++;
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
            'halfPresent' => $row['halfPresent'],
            'weeklyOff' => $row['weeklyOff'],
            'holiday' => $row['holiday'],
            'leave' => $row['leave'],
            'absent' => $row['absent'],
            'rate' => $row['total'] > 0 ? round(($row['present'] / $row['total']) * 100) : 0
        ];
    }

    return $result;
}

/**
 * Handle Dashboard Data Fetch (Employees, Logs, Counts)
 */
function handleDashboardData($input, $returnData = false) {
    $userId = isset($input['userId']) ? intval($input['userId']) : 0;
    if (isset($input['date_from']) && isset($input['date_to'])) {
        $dayFrom = $input['date_from'];
        $dayTo = $input['date_to'];
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
    $conn = getSQLServer();

    $userLocations = $_SESSION['locations'] ?? [];
    $userCompanies = $_SESSION['companies'] ?? [];
    $userDepartments = $_SESSION['departments'] ?? [];

    $locationList = !empty($userLocations) ? implode(',', array_map('intval', $userLocations)) : '0';
    $companyList = !empty($userCompanies) ? implode(',', array_map('intval', $userCompanies)) : '0';
    $departmentList = !empty($userDepartments) ? implode(',', array_map('intval', $userDepartments)) : '0';

    $empShifts = [];
    $shiftFilteredIds = [];
    $shiftParams = [];

    $sqlShifts = "SELECT ES.EmployeeId, ES.ShiftId, ES.Shiftdate, ES.ToDate, S.ShiftName, S.ShiftCode, S.BeginTime, S.EndTime FROM (SELECT EmployeeId, ShiftId, Shiftdate, ToDate, ROW_NUMBER() OVER(PARTITION BY EmployeeId ORDER BY Shiftdate DESC) as rn FROM EmployeeShift WITH (NOLOCK)  WHERE Shiftdate <= '$dayTo 23:59:59' AND (ToDate IS NULL OR ToDate >= '$dayFrom')) ES JOIN Shifts S WITH (NOLOCK) ON ES.ShiftId = S.ShiftId INNER JOIN Employees E WITH (NOLOCK) ON ES.EmployeeId = E.EmployeeId WHERE ES.rn = 1 AND E.Location IN ($locationList) AND E.CompanyId IN ($companyList) AND E.DepartmentId IN ($departmentList) AND E.Status = 'Working' AND E.RecordStatus = 1 AND S.RecordStatus = '1'";

    $shiftParams = [];
    if ($shiftName) {
        $sqlShifts .= " AND S.ShiftName = ?";
        $shiftParams[] = $shiftName;
    }

    $stmtShifts = sqlsrv_query($conn, $sqlShifts, $shiftParams);

	$empShiftMap = [];
	$empShiftTimeMap = [];
	$shiftFilteredIds = [];

	if ($stmtShifts) {
		while ($r = sqlsrv_fetch_array($stmtShifts, SQLSRV_FETCH_ASSOC)) {
			$empId = (string)$r['EmployeeId'];
			$empShiftMap[$empId] = $r['ShiftName'];
			$empShiftTimeMap[$empId] = [
				'start' => $r['BeginTime'] ? (is_object($r['BeginTime']) ? $r['BeginTime']->format('H:i') : $r['BeginTime']) : null,
				'end' => $r['EndTime'] ? (is_object($r['EndTime']) ? $r['EndTime']->format('H:i') : $r['EndTime']) : null
			];
			if ($shiftName) {
				$shiftFilteredIds[$r['EmployeeId']] = true;
			}
		}
	}

    if ($shiftName && empty($shiftFilteredIds)) {
        $shiftFilteredIds = [-1];
    } else {
        $shiftFilteredIds = array_keys($shiftFilteredIds);
    }

    $sqlEmp = "SELECT E.EmployeeId, E.EmployeeName, E.EmployeeCode, E.Gender, E.DOB, E.CategoryId, E.Designation, DG.DesignationsName as DesignationName, ISNULL(DSO.SortOrder, 0) as designationSortOrder, C.CompanyFName as company, L.LocationName as location, D.DepartmentFName as dept, D.std_hc FROM Employees E WITH (NOLOCK) LEFT JOIN Companies C WITH (NOLOCK) ON E.CompanyId = C.CompanyId LEFT JOIN Locations L WITH (NOLOCK) ON E.Location = L.LocationId LEFT JOIN Departments D WITH (NOLOCK) ON E.DepartmentId = D.DepartmentId LEFT JOIN Designations DG WITH (NOLOCK) ON E.Designation = DG.DesignationId LEFT JOIN departmentDeginationSortOrder DSO WITH (NOLOCK) ON E.DepartmentId = DSO.DepartmentId AND E.Designation = DSO.DesignationId WHERE E.RecordStatus = 1 AND E.Location IN ($locationList) AND E.CompanyId IN ($companyList) AND E.DepartmentId IN ($departmentList) AND E.Status = 'Working'";

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
                'categoryId' => intval($row['CategoryId']),
                'designation' => $row['DesignationName'] ?: 'Staff',
                'designationSortOrder' => isset($row['designationSortOrder']) ? intval($row['designationSortOrder']) : 0,
                'shift' => isset($empShiftMap[(string)$row['EmployeeId']]) ? $empShiftMap[(string)$row['EmployeeId']] : 'No Shift',
                'location' => $row['location'] ?: 'Head Office'
            ];
        }

        $staffCategoryIds  = [58];
        $workerCategoryIds = [51, 59, 60];

        $staffEmpIds  = [];
        $workerEmpIds = [];
        foreach ($employees as $emp) {
            if (in_array($emp['categoryId'], $staffCategoryIds)) {
                $staffEmpIds[$emp['id']] = true;
            } elseif (in_array($emp['categoryId'], $workerCategoryIds)) {
                $workerEmpIds[$emp['id']] = true;
            }
        }
    }

    $resignedEmployees = [];
    $newJoinedEmployees = [];

    $sqlResigned = "SELECT E.EmployeeId, E.EmployeeName, E.EmployeeCode, E.Gender, E.DOB, E.Designation, DG.DesignationsName as DesignationName, C.CompanyFName as company, L.LocationName as location, D.DepartmentFName as dept, E.DOJ, E.DOR, E.Status FROM Employees E WITH (NOLOCK) LEFT JOIN Companies C WITH (NOLOCK) ON E.CompanyId = C.CompanyId LEFT JOIN Locations L WITH (NOLOCK) ON E.Location = L.LocationId LEFT JOIN Departments D WITH (NOLOCK) ON E.DepartmentId = D.DepartmentId LEFT JOIN Designations DG WITH (NOLOCK) ON E.Designation = DG.DesignationId WHERE E.RecordStatus = 1 AND E.Location IN ($locationList) AND E.CompanyId IN ($companyList) AND E.DepartmentId IN ($departmentList) AND E.Status = 'Resigned' AND E.DOR >= ? AND E.DOR <= ?";

    $paramsResigned = [$dayFrom, $dayTo];
    if ($deptName) { 
        $sqlResigned .= " AND D.DepartmentFName = ?"; 
        $paramsResigned[] = $deptName; 
    }
    if ($compName) { 
        $sqlResigned .= " AND C.CompanyFName = ?"; 
        $paramsResigned[] = $compName; 
    }
    $sqlResigned .= " ORDER BY D.DepartmentFName ASC, E.EmployeeName ASC";

    $stmtResigned = sqlsrv_query($conn, $sqlResigned, $paramsResigned);
    if ($stmtResigned) {
        while ($row = sqlsrv_fetch_array($stmtResigned, SQLSRV_FETCH_ASSOC)) {
            $resignedEmployees[] = [
                'id' => (string)$row['EmployeeId'],
                'code' => $row['EmployeeCode'],
                'name' => $row['EmployeeName'],
                'dob' => $row['DOB'] ? $row['DOB']->format('Y-m-d') : '1990-01-01',
                'gender' => in_array(strtoupper(trim($row['Gender'])), ['MALE', 'M']) ? 'Male' : 'Female',
                'dept' => $row['dept'] ?: 'Dept ' . $row['DepartmentId'],
                'company' => $row['company'] ?: 'Unknown',
                'designation' => $row['DesignationName'] ?: 'Staff',
                'location' => $row['location'] ?: 'Head Office',
                'status' => 'Resigned',
                'doj' => $row['DOJ'] ? $row['DOJ']->format('Y-m-d') : null,
                'dor' => $row['DOR'] ? $row['DOR']->format('Y-m-d') : null
            ];
        }
    }

    $sqlNewJoined = "SELECT E.EmployeeId, E.EmployeeName, E.EmployeeCode, E.Gender, E.DOB, E.Designation, DG.DesignationsName as DesignationName, C.CompanyFName as company, L.LocationName as location, D.DepartmentFName as dept, E.DOJ, E.DOR, E.Status FROM Employees E WITH (NOLOCK) LEFT JOIN Companies C WITH (NOLOCK) ON E.CompanyId = C.CompanyId LEFT JOIN Locations L WITH (NOLOCK) ON E.Location = L.LocationId LEFT JOIN Departments D WITH (NOLOCK) ON E.DepartmentId = D.DepartmentId LEFT JOIN Designations DG WITH (NOLOCK) ON E.Designation = DG.DesignationId WHERE E.RecordStatus = 1 AND E.Location IN ($locationList) AND E.CompanyId IN ($companyList) AND E.DepartmentId IN ($departmentList) AND E.DOJ >= ? AND E.DOJ <= ?";

    $paramsNewJoined = [$dayFrom, $dayTo];
    if ($deptName) { 
        $sqlNewJoined .= " AND D.DepartmentFName = ?"; 
        $paramsNewJoined[] = $deptName; 
    }
    if ($compName) { 
        $sqlNewJoined .= " AND C.CompanyFName = ?"; 
        $paramsNewJoined[] = $compName; 
    }
    $sqlNewJoined .= " ORDER BY D.DepartmentFName ASC, E.EmployeeName ASC";

    $stmtNewJoined = sqlsrv_query($conn, $sqlNewJoined, $paramsNewJoined);
    if ($stmtNewJoined) {
        while ($row = sqlsrv_fetch_array($stmtNewJoined, SQLSRV_FETCH_ASSOC)) {
            $newJoinedEmployees[] = [
                'id' => (string)$row['EmployeeId'],
                'code' => $row['EmployeeCode'],
                'name' => $row['EmployeeName'],
                'dob' => $row['DOB'] ? $row['DOB']->format('Y-m-d') : '1990-01-01',
                'gender' => in_array(strtoupper(trim($row['Gender'])), ['MALE', 'M']) ? 'Male' : 'Female',
                'dept' => $row['dept'] ?: 'Dept ' . $row['DepartmentId'],
                'company' => $row['company'] ?: 'Unknown',
                'designation' => $row['DesignationName'] ?: 'Staff',
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
            $sqlLogs = "SELECT A.EmployeeId, A.AttendanceDate, A.InTime, A.OutTime, A.Status, A.Duration, A.LateBy, A.EarlyBy, A.ComplinFreeLateBy, A.ComplinFreeEarlyBy, A.Present, A.Absent, A.WeeklyOff, A.Holiday, A.IsOnLeave, A.IsPartialDay, A.MissedInPunch, A.MissedOutPunch, A.ShiftId, S.ShiftCode, S.ShiftName, S.BeginTime, S.EndTime FROM $logTable A WITH (NOLOCK) INNER JOIN Employees E WITH (NOLOCK) ON A.EmployeeId = E.EmployeeId LEFT JOIN Shifts S WITH (NOLOCK) ON A.ShiftId = S.ShiftId LEFT JOIN Departments D WITH (NOLOCK) ON E.DepartmentId = D.DepartmentId LEFT JOIN Companies C WITH (NOLOCK) ON E.CompanyId = C.CompanyId WHERE E.Location IN ($locationList) AND E.CompanyId IN ($companyList) AND E.DepartmentId IN ($departmentList) AND A.AttendanceDate >= '$dayFrom' AND A.AttendanceDate <= '$dayTo 23:59:59' AND E.Status = 'Working'";

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
                    $status = $row['Status'] ?: 'Absent';

                    $logs[] = [
                        'empId' => (string)$row['EmployeeId'],
                        'date' => $row['AttendanceDate'] ? $row['AttendanceDate']->format('Y-m-d') : null,
                        'inTime' => $row['InTime'],
                        'outTime' => $row['OutTime'],
                        'status' => $status,
                        'present' => floatval($row['Present']),
                        'absent' => floatval($row['Absent']),
                        'weeklyOff' => intval($row['WeeklyOff']),
                        'holiday' => intval($row['Holiday']),
                        'isOnLeave' => intval($row['IsOnLeave']),
                        'isPartialDay' => intval($row['IsPartialDay']),
                        'hoursWorked' => round(floatval($row['Duration']) / 60, 2),
                        'lateBy' => intval($row['LateBy']),
                        'earlyBy' => intval($row['EarlyBy']),
                        'missedInPunch'  => intval($row['MissedInPunch']),
                        'missedOutPunch' => intval($row['MissedOutPunch']),
                        'shiftId' => intval($row['ShiftId']),
                        'shiftName' => $row['ShiftName'],
                        'shiftCode' => $row['ShiftCode'],
                        'shiftStart' => $row['BeginTime'] ? (is_object($row['BeginTime']) ? $row['BeginTime']->format('H:i') : $row['BeginTime']) : null,
                        'shiftEnd' => $row['EndTime'] ? (is_object($row['EndTime']) ? $row['EndTime']->format('H:i') : $row['EndTime']) : null
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

            $sqlDevRaw = "SELECT D.AttDirection, D.LogDate, CAST(D.LogDate AS DATE) AS PunchDate, E.EmployeeId FROM $devTable D WITH (NOLOCK) INNER JOIN Employees E WITH (NOLOCK) ON CAST(D.UserId AS VARCHAR(50)) = CAST(E.EmployeeCodeInDevice AS VARCHAR(50)) LEFT JOIN Departments De WITH (NOLOCK) ON E.DepartmentId = De.DepartmentId LEFT JOIN Companies C WITH (NOLOCK) ON E.CompanyId = C.CompanyId WHERE E.Location IN ($locationList) AND E.CompanyId IN ($companyList) AND E.DepartmentId IN ($departmentList) AND D.LogDate >= '$dayFrom' AND D.LogDate <= '$dayTo 23:59:59' AND E.Status = 'Working' AND E.RecordStatus = 1";

            $paramsDevRaw = [];

            if ($deptName) {
                $sqlDevRaw .= " AND De.DepartmentFName = ?";
                $paramsDevRaw[] = $deptName;
            }

            if ($compName) {
                $sqlDevRaw .= " AND C.CompanyFName = ?";
                $paramsDevRaw[] = $compName;
            }

            $stmtDevRaw = sqlsrv_query($conn, $sqlDevRaw, $paramsDevRaw);

            $devEmpDayBuckets = [];
            if ($stmtDevRaw) {
				while ($row = sqlsrv_fetch_array($stmtDevRaw, SQLSRV_FETCH_ASSOC)) {
                    $dir = trim($row['AttDirection'] ?? '');
                    $isIn = (strcasecmp($dir, 'in') == 0 || $dir === '0');
                    $isOut = (strcasecmp($dir, 'out') == 0 || $dir === '1');

                    $punchDate = $row['PunchDate']->format('Y-m-d');
                    $key = (string)$row['EmployeeId'] . '_' . $punchDate;

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

    $totalEmployees = count($employees);

    // Step 1: mark which empId_date keys already exist in AttendanceLogs
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

        $logs[] = [
            'empId' => $empId,
            'date' => $date,
            'inTime' => $stat['firstIn'] ? $stat['firstIn']->format('H:i') : null,
            'outTime' => $hasOut ? $stat['lastOut']->format('H:i') : null,
            'status' => 'Present',
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
            'shiftId' => 0,
            'shiftName' => null,
            'shiftCode' => null
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
		$counts['in']  += $stat['inCount']  ?? 0;
		$counts['out'] += $stat['outCount'] ?? 0;
	}

	$singlePunch = 0;
	$singlePunchKeys = [];
	$weeklyOffKeySet = [];
	foreach ($logs as $log) {
		$present = floatval($log['present']);
		$absent  = floatval($log['absent']);
		if ($present == 0 && $absent == 0 && intval($log['weeklyOff']) == 1) {
			$weeklyOffKeySet[$log['empId'] . '_' . $log['date']] = true;
		}
	}

	$singlePunchData = []; 
	foreach ($deviceEmployeeStats as $key => $stat) {
		[$empId] = explode('_', $key, 2);
		if (!isset($validEmpIdSet[$empId])) {
			continue;
		}
		if (isset($weeklyOffKeySet[$key])) {
			continue;
		}

		$hasIn = ($stat['inCount']  ?? 0) >= 1;
		$hasOut = ($stat['outCount'] ?? 0) >= 1;

		$shiftTimes = $empShiftTimeMap[$empId] ?? ['start' => null, 'end' => null];

		if ($hasIn !== $hasOut) {
			$singlePunch++;
			$singlePunchKeys[] = $key;

			if ($hasIn && $stat['firstIn']) {
				$singlePunchData[$key] = [
					'time' => $stat['firstIn']->format('H:i'),
					'direction' => 'in',
					'shiftStart' => $shiftTimes['start'],
					'shiftEnd' => $shiftTimes['end']
				];
			} elseif ($hasOut && $stat['lastOut']) {
				$singlePunchData[$key] = [
					'time' => $stat['lastOut']->format('H:i'),
					'direction' => 'out',
					'shiftStart' => $shiftTimes['start'],
					'shiftEnd' => $shiftTimes['end']
				];
			}
		}
	}

	$lateIn = 0;
	$earlyOut = 0;
	$totalHours = 0;
	$hoursCount = 0;
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
	}

    $avgHours = $hoursCount > 0 ? round($totalHours / $hoursCount, 2) : 0;

    $statusKeyMap = [];
    foreach ($logs as $log) {
        $key = $log['empId'] . '_' . $log['date'];
        $present = floatval($log['present']);
        $absent  = floatval($log['absent']);

        if ($present == 1 && $absent == 0) {
            $hasBothPunches = ($log['missedInPunch'] == 0 && $log['missedOutPunch'] == 0);
            $statusKeyMap[$key] = $hasBothPunches ? 'present' : 'absent';
        } elseif ($present == 0.5 && $absent == 0.5) {
            $statusKeyMap[$key] = 'halfPresent';
        } elseif ($present == 0 && $absent == 0) {
            $statusKeyMap[$key] = 'weeklyOff';
        } else {
            $statusKeyMap[$key] = 'absent';
        }
    }

    $rangeStart = new DateTime($dayFrom);
    $rangeEnd = new DateTime($dayTo);
    
    $staffPresent = 0; 
    $staffHalfPresent = 0; 
    $staffAbsent = 0; 
    $staffWeeklyOff = 0;
    $workerPresent = 0; 
    $workerHalfPresent = 0; 
    $workerAbsent = 0; 
    $workerWeeklyOff = 0;

    for ($d = clone $rangeStart; $d <= $rangeEnd; $d->modify('+1 day')) {
        $dateStr = $d->format('Y-m-d');
        foreach ($employees as $e) {
            $k = $e['id'] . '_' . $dateStr;
            $empStatus = $statusKeyMap[$k] ?? 'absent';

            if (isset($staffEmpIds[$e['id']])) {
                if ($empStatus === 'present') {
                    $staffPresent++;
                } elseif ($empStatus === 'halfPresent') {
                    $staffHalfPresent++;
                }
                elseif ($empStatus === 'weeklyOff') {
                    $staffWeeklyOff++;
                } else {
                    $staffAbsent++;
                }
            } elseif (isset($workerEmpIds[$e['id']])) {
                if ($empStatus === 'present') {
                    $workerPresent++;
                } elseif ($empStatus === 'halfPresent') {
                    $workerHalfPresent++;
                } elseif ($empStatus === 'weeklyOff') {
                    $workerWeeklyOff++;
                } else {
                    $workerAbsent++;
                }
            }
        }
    }

    $totalEmployeeDays = 0;
    $presentEmployeeDays = 0;
    $halfPresentEmployeeDays = 0;
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
            } elseif ($empStatus === 'halfPresent') {
                $halfPresentEmployeeDays++;
            } elseif ($empStatus === 'weeklyOff') {
                $weeklyOffEmployeeDays++;
            } else {
                $absentEmployeeDays++;
            }
        }
    }

    $presentEmployees = $presentEmployeeDays;
    $absentEmployees = $absentEmployeeDays;
    $halfPresentTotal = $halfPresentEmployeeDays;
    $weeklyOffTotal = $weeklyOffEmployeeDays;

    $shiftStats = computeShiftStats($employees,  $logs,  $deviceEmployeeStats,  $employeesInAttendanceLogs,  $dayFrom, $dayTo, $conn);

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
            'present'     => $presentEmployees,
            'halfPresent' => $halfPresentTotal,
            'weeklyOff'   => $weeklyOffTotal,
            'absent'      => $absentEmployees,
            'total'       => $totalEmployees,
            'singlePunch' => $singlePunch,
            'lateIn'      => $lateIn,
            'earlyOut'    => $earlyOut,
            'avgHours'    => $avgHours,
            'resigned'    => count($resignedEmployees),
            'newJoined'   => count($newJoinedEmployees)
        ],
		'singlePunchKeys' => $singlePunchKeys,
		'singlePunchData' => $singlePunchData,
        'staffWorkerStats' => [
            'staffTotal'        => count($staffEmpIds),
            'staffPresent'      => $staffPresent,
            'staffHalfPresent'  => $staffHalfPresent,
            'staffWeeklyOff'    => $staffWeeklyOff,
            'staffAbsent'       => $staffAbsent,
            'workerTotal'       => count($workerEmpIds),
            'workerPresent'     => $workerPresent,
            'workerHalfPresent' => $workerHalfPresent,
            'workerWeeklyOff'   => $workerWeeklyOff,
            'workerAbsent'      => $workerAbsent,
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


function handleGetDesignationsOrder() {
    $conn = getSQLServer();

    $locationList = !empty($_SESSION['locations']) ? implode(',', array_map('intval', $_SESSION['locations'])) : '0';
    $companyList = !empty($_SESSION['companies']) ? implode(',', array_map('intval', $_SESSION['companies'])) : '0';
    $departmentList = !empty($_SESSION['departments']) ? implode(',', array_map('intval', $_SESSION['departments'])) : '0';

    $sql = "SELECT DISTINCT 
                D.DepartmentId, 
                D.DepartmentFName as DepartmentName, 
                DG.DesignationId, 
                DG.DesignationsName, 
                ISNULL(DSO.SortOrder, 0) as sortOrder
            FROM Employees E WITH (NOLOCK)
            INNER JOIN Departments D WITH (NOLOCK) ON E.DepartmentId = D.DepartmentId
            INNER JOIN Designations DG WITH (NOLOCK) ON E.Designation = DG.DesignationId
            LEFT JOIN departmentDeginationSortOrder DSO WITH (NOLOCK) ON D.DepartmentId = DSO.DepartmentId AND DG.DesignationId = DSO.DesignationId
            WHERE E.RecordStatus = 1 AND D.RecordStatus = 1 
              AND E.Location IN ($locationList)
              AND E.CompanyId IN ($companyList)
              AND E.DepartmentId IN ($departmentList)
            ORDER BY D.DepartmentFName ASC, sortOrder ASC, DG.DesignationsName ASC";

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
        
        $sqlUpdate = "UPDATE [eSSLSmartOffice].[dbo].[departmentDeginationSortOrder] 
                      SET SortOrder = ? 
                      WHERE DepartmentId = ? AND DesignationId = ?";
        $stmtUpdate = sqlsrv_query($conn, $sqlUpdate, [$sortOrder, $deptId, $id]);
        
        if ($stmtUpdate) {
            $rowsAffected = sqlsrv_rows_affected($stmtUpdate);
            if ($rowsAffected === 0) {
                $sqlInsert = "INSERT INTO [eSSLSmartOffice].[dbo].[departmentDeginationSortOrder] 
                              (DepartmentId, DesignationId, SortOrder) 
                              VALUES (?, ?, ?)";
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