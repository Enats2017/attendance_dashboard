<?php

ini_set('display_errors', 1);
error_reporting(E_ALL);
ini_set('max_execution_time', 0);

header('Content-Type: application/json');
date_default_timezone_set('Asia/Kolkata');

function writeDebugLog($message) {
    global $debugLogFile;
    $logMessage = "[" . date('Y-m-d H:i:s') . "] " . $message . PHP_EOL;
    file_put_contents($debugLogFile, $logMessage, FILE_APPEND | LOCK_EX);
}

function convertDate($value, $format) {
    if ($value instanceof DateTime) {
        return $value->format($format);
    }

    return date($format, strtotime($value));
}

function convertTime($value, $format = 'H:i:s') {
    if ($value === null || $value === '') {
        return 'NULL';
    }

    if ($value instanceof DateTime) {
        return $value->format($format);
    }

    return date($format, strtotime($value));
}

$sqlConfig = [
    "server" => "10.2.30.13",
    "database" => "eSSLSmartOffice",
    "uid" => "sa",
    "pwd" => "Wpl@123"
];

$conn = sqlsrv_connect($sqlConfig["server"], [
    "Database" => $sqlConfig["database"],
    "UID" => $sqlConfig["uid"],
    "PWD" => $sqlConfig["pwd"]
]);

if (!$conn) {
    die(json_encode(sqlsrv_errors()));
}

$month = (int) date('n');
$year = (int) date('Y');

$logFolder = __DIR__ . '/logs';

if (!is_dir($logFolder)) {
    mkdir($logFolder, 0777, true);
}

$debugLogFile = $logFolder . '/second_shift_attendance_' . str_pad($month, 2, '0', STR_PAD_LEFT) . '_' . $year . '.log';

writeDebugLog("Database connection successful.");

writeDebugLog("==================================================");
writeDebugLog("SCRIPT STARTED");
writeDebugLog("Processing Month: " . $month . ", Year: " . $year);

$attendanceTable = "AttendanceLogs_" . $month . "_" . $year;

$destinationTable = "NewAttendanceLogs_" . $month . "_" . $year;

$trackingTable = "OvertimeAttendanceCheck_" . $month . "_" . $year;

$dayShiftIds = [18, 29, 16, 6, 24, 9, 12, 7, 21, 32];

$dayShiftList = implode(",", $dayShiftIds);

$currentTime = date('H:i:s');

if ($currentTime < '10:00:00') {
    $processingDate = date('Y-m-d', strtotime('-1 day'));
} else {
    $processingDate = date('Y-m-d');
}

writeDebugLog("Processing Attendance Date: " . $processingDate);

$sql = "SELECT A.AttendanceLogId, A.AttendanceDate, A.EmployeeId, A.InTime, A.OutTime FROM dbo.$attendanceTable A LEFT JOIN dbo.$destinationTable N ON N.AttendanceLogId = A.AttendanceLogId LEFT JOIN dbo.$trackingTable T ON T.AttendanceLogId = A.AttendanceLogId WHERE A.ShiftId IN ($dayShiftList) AND CAST(A.AttendanceDate AS DATE) = ? AND N.AttendanceLogId IS NULL AND T.AttendanceLogId IS NULL ORDER BY A.AttendanceLogId ASC";

$stmt = sqlsrv_query($conn, $sql, [$processingDate]);

if (!$stmt) {
    writeDebugLog("ATTENDANCE QUERY ERROR: " . json_encode(sqlsrv_errors()));
    die(json_encode(sqlsrv_errors()));
}

$checked = 0;
$inserted = 0;
$alreadyExists = 0;
$noNightPunch = 0;
$skipped = 0;

$outPunchUpdated = 0;
$outPunchNotFound = 0;

while ($attendance = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC)) {
    $attendanceLogId = $attendance['AttendanceLogId'];

    $employeeId = $attendance['EmployeeId'];

    $workingDate = convertDate($attendance['AttendanceDate'], 'Y-m-d');

    $inTime = null;
    $outTime = null;
    $inPunchDate = null;
    $outPunchDate = null;
    $duration = null;

    $secondShiftFound = false;

    $nextDate = date('Y-m-d', strtotime($workingDate . ' +1 day'));

    writeDebugLog("--------------------------------------------------");
    writeDebugLog("Processing AttendanceLogId: " . $attendanceLogId . " | EmployeeId: " . $employeeId . " | AttendanceDate: " . $workingDate);
    writeDebugLog("Original Attendance InTime: " . convertTime($attendance['InTime']) . " | OutTime: " . convertTime($attendance['OutTime']));

    $employeeSql = "SELECT EmployeeCodeInDevice FROM dbo.Employees WHERE EmployeeId = ?";

    $employeeStmt = sqlsrv_query($conn, $employeeSql, [$employeeId]);

    if (!$employeeStmt) {
        die(json_encode(sqlsrv_errors()));
    }

    $employee = sqlsrv_fetch_array($employeeStmt, SQLSRV_FETCH_ASSOC);

    $canProcess = true;

    $deviceCode = null;

    if (!$employee || empty($employee['EmployeeCodeInDevice'])) {
        writeDebugLog("Employee mapping or device code not found for EmployeeId: " . $employeeId);
        $canProcess = false;
    } else {
        $deviceCode = trim($employee['EmployeeCodeInDevice']);
        writeDebugLog("Employee device code: " . $deviceCode);
    }

    if ($canProcess) {
        $minimumSecondShiftInStart = $workingDate . " 16:00:00";

        if ($attendance['OutTime'] != null && $attendance['OutTime'] != '00:00') {
            $originalOutTime = $workingDate . " " . convertTime($attendance['OutTime']);

            if ($originalOutTime < $minimumSecondShiftInStart) {
                $nightInStart = $minimumSecondShiftInStart;
            } else {
                $nightInStart = $originalOutTime;
            }
        } else {
            $skipped++;
            $canProcess = false;
        }
    }

    if ($canProcess) {
        $nightInEnd = $workingDate . " 23:59:59";

        $nightOutStart = $nextDate . " 07:00:00";

        $nightOutEnd = $nextDate . " 10:00:00";
        
        writeDebugLog("Second shift IN search starts from: " . $nightInStart);
        writeDebugLog("Second shift IN search ends at: " . $nightInEnd);
        writeDebugLog("Second shift OUT search starts from: " . $nightOutStart);
        writeDebugLog("Second shift OUT search ends at: " . $nightOutEnd);
        
        $currentDeviceTable = "DeviceLogs_" . $month . "_" . $year;

        $nextMonth = (int) date('n', strtotime($nextDate));
        $nextYear = (int) date('Y', strtotime($nextDate));

        $nextDeviceTable = "DeviceLogs_" . $nextMonth . "_" . $nextYear;

        $deviceTables = [$currentDeviceTable];

        if ($nextDeviceTable != $currentDeviceTable) {
            $deviceTables[] = $nextDeviceTable;
        }

        writeDebugLog("Device tables selected: " . implode(", ", $deviceTables));

        $nightIn = null;
        $nightOut = null;

        foreach ($deviceTables as $deviceTable) {

            writeDebugLog("Checking device table: " . $deviceTable);

            $tableCheck = sqlsrv_query($conn, "SELECT OBJECT_ID('dbo.$deviceTable') AS TableId");

            if (!$tableCheck) {
                die(json_encode(sqlsrv_errors()));
            }

            $tableRow = sqlsrv_fetch_array($tableCheck, SQLSRV_FETCH_ASSOC);

            if (!$tableRow['TableId']) {
                writeDebugLog("Device table not found: " . $deviceTable);

            } else {
                writeDebugLog("Device table exists: " . $deviceTable);

                $punchSql = "SELECT LogDate, AttDirection FROM dbo.$deviceTable WHERE LTRIM(RTRIM(UserId)) = ? AND LogDate > ? AND LogDate <= ? ORDER BY LogDate ASC";

                $punchStmt = sqlsrv_query($conn, $punchSql, [$deviceCode, $nightInStart, $nightOutEnd]);

                if (!$punchStmt) {
                    writeDebugLog("Punch query failed for table " . $deviceTable . ": " . json_encode(sqlsrv_errors()));
                    die(json_encode(sqlsrv_errors()));
                }

                while ($punch = sqlsrv_fetch_array($punchStmt, SQLSRV_FETCH_ASSOC)) {
                    $punchTime = $punch['LogDate'];
                    $direction = strtoupper(trim($punch['AttDirection']));
                    $punchDateTime = $punchTime->format('Y-m-d H:i:s');

                    writeDebugLog("PUNCH FOUND | Table: " . $deviceTable . " | Device Code: " . $deviceCode . " | DateTime: " . $punchDateTime . " | Direction: " . $direction);

                    if ($direction == 'IN' && $punchDateTime <= $nightInEnd && $nightIn == null) {
                        $nightIn = $punchTime;
                        writeDebugLog("SECOND SHIFT IN SELECTED: " . $punchDateTime);
                    }

                    if ($direction == 'OUT' && $punchDateTime >= $nightOutStart && $punchDateTime <= $nightOutEnd && $nightOut == null) {
                        $nightOut = $punchTime;
                        writeDebugLog("SECOND SHIFT OUT SELECTED: " . $punchDateTime);
                    }

                    if ($nightIn != null && $nightOut != null) {
                        writeDebugLog("Both second shift punches found. Stopping punch search.");
                        break;
                    }
                }
            }

            if ($nightIn != null && $nightOut != null) {
                writeDebugLog("Both second shift punches found. No need to check another device table.");
                break;
            }
        }

        if ($nightIn != null || $nightOut != null) {
            $duration = null;

            if ($nightIn != null && $nightOut != null && $nightOut > $nightIn) {
                $seconds = $nightOut->getTimestamp() - $nightIn->getTimestamp();

                $hours = floor($seconds / 3600);
                $minutes = floor(($seconds % 3600) / 60);
                $remainingSeconds = $seconds % 60;

                $duration = sprintf("%02d:%02d:%02d", $hours, $minutes, $remainingSeconds);

                writeDebugLog("DURATION CALCULATED: " . $duration);
            } else {
                writeDebugLog("Only one punch found OR invalid punch sequence. Duration will be NULL.");
            }

            $inTime = null;
            $outTime = null;
            $inPunchDate = null;
            $outPunchDate = null;

            if ($nightIn != null) {
                $inTime = $nightIn->format('H:i:s');
                $inPunchDate = $nightIn->format('Y-m-d H:i:s');
            }

            if ($nightOut != null) {
                $outTime = $nightOut->format('H:i:s');
                $outPunchDate = $nightOut->format('Y-m-d H:i:s');
            }

            $duplicateSql = "SELECT TOP 1 1 AS ExistingRecord FROM dbo.$destinationTable WHERE EmployeeId = ? AND ((InPunchDate >= ? AND InPunchDate < DATEADD(DAY, 1, ?)) OR (OutPunchDate >= ? AND OutPunchDate < DATEADD(DAY, 1, ?)))";

            $duplicateParams = [$employeeId, $workingDate, $workingDate, $nextDate, $nextDate];

            $duplicateStmt = sqlsrv_query($conn, $duplicateSql, $duplicateParams);

            if (!$duplicateStmt) {
                die(json_encode(sqlsrv_errors()));
            }

            $existing = sqlsrv_fetch_array($duplicateStmt, SQLSRV_FETCH_ASSOC);

            writeDebugLog("DUPLICATE CHECK | EmployeeId: " . $employeeId . " | Existing Record: " . ($existing ? 'YES' : 'NO'));

            if (!$existing) {
                $secondShiftFound = true;
                writeDebugLog("SECOND SHIFT PUNCH FOUND | EmployeeId: " . $employeeId);
            } else {
                $inTime = null;
                $outTime = null;
                $inPunchDate = null;
                $outPunchDate = null;
                $duration = null;

                $alreadyExists++;

                writeDebugLog("DUPLICATE FOUND | EmployeeId: " . $employeeId);
            }
        } else {
            $noNightPunch++;
            writeDebugLog("NO SECOND SHIFT PUNCH FOUND | AttendanceLogId: " . $attendanceLogId . " | IN: NOT FOUND | OUT: NOT FOUND");
        }
    }

    if ($secondShiftFound) {
        $insertSql = "INSERT INTO dbo.$destinationTable (AttendanceLogId, EmployeeId, EmployeeCodeInDevice, InTime, OutTime, InPunchDate, OutPunchDate, Duration) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";

        $insertParams = [$attendanceLogId, $employeeId, $deviceCode, $inTime, $outTime, $inPunchDate, $outPunchDate, $duration];

        $insertStmt = sqlsrv_query($conn, $insertSql, $insertParams);

        if (!$insertStmt) {
            writeDebugLog("NEW ATTENDANCE INSERT ERROR: " . json_encode(sqlsrv_errors()));
            die(json_encode(sqlsrv_errors()));
        }

        $inserted++;

        writeDebugLog("SECOND SHIFT DATA INSERTED | AttendanceLogId: " . $attendanceLogId);
    } else {
        $trackingSql = "INSERT INTO dbo.$trackingTable (AttendanceLogId) VALUES (?)";

        $trackingParams = [$attendanceLogId];

        $trackingStmt = sqlsrv_query($conn, $trackingSql, $trackingParams);

        if (!$trackingStmt) {
            writeDebugLog("TRACKING INSERT ERROR: " . json_encode(sqlsrv_errors()));
            die(json_encode(sqlsrv_errors()));
        }

        writeDebugLog("ATTENDANCE LOG ID SAVED IN TRACKING TABLE | AttendanceLogId: " . $attendanceLogId);
    }

    $checked++;
}


writeDebugLog("==================================================");
writeDebugLog("STARTING MISSING OUT PUNCH PROCESSING");

$previousDate = date('Y-m-d', strtotime('-1 day'));

writeDebugLog("Checking OUT punches for previous date: " . $previousDate);

$updateOutSql = "SELECT N.AttendanceLogId, N.EmployeeId, N.EmployeeCodeInDevice, N.InTime, N.InPunchDate FROM dbo.$destinationTable N INNER JOIN dbo.$attendanceTable A ON A.AttendanceLogId = N.AttendanceLogId WHERE A.ShiftId IN ($dayShiftList) AND N.InTime IS NOT NULL AND N.OutTime IS NULL AND N.InPunchDate = ? ORDER BY N.AttendanceLogId ASC";

$updateOutStmt = sqlsrv_query($conn, $updateOutSql, [$previousDate]);

if (!$updateOutStmt) {
    writeDebugLog("MISSING OUT PUNCH QUERY ERROR: " . json_encode(sqlsrv_errors()));
    die(json_encode(sqlsrv_errors()));
}

while ($updateAttendance = sqlsrv_fetch_array($updateOutStmt, SQLSRV_FETCH_ASSOC)) {
    $attendanceLogId = $updateAttendance['AttendanceLogId'];
    $employeeId = $updateAttendance['EmployeeId'];
    $deviceCode = trim($updateAttendance['EmployeeCodeInDevice']);

    $inTime = trim($updateAttendance['InTime']);
    $inPunchDate = convertDate($updateAttendance['InPunchDate'], 'Y-m-d');

    $workingDate = convertDate($updateAttendance['InPunchDate'], 'Y-m-d');
    $nextDate = date('Y-m-d', strtotime($workingDate . ' +1 day'));

    $nightOutStart = $nextDate . " 07:00:00";
    $nightOutEnd = $nextDate . " 10:00:00";

    writeDebugLog("--------------------------------------------------");
    writeDebugLog("CHECKING MISSING OUT PUNCH | AttendanceLogId: " . $attendanceLogId);
    writeDebugLog("EmployeeId: " . $employeeId . " | Device Code: " . $deviceCode);
    writeDebugLog("Existing IN: " . $inPunchDate . " " . $inTime);
    writeDebugLog("OUT SEARCH START: " . $nightOutStart);
    writeDebugLog("OUT SEARCH END: " . $nightOutEnd);

    $currentMonth = (int) date('n', strtotime($workingDate));
    $currentYear = (int) date('Y', strtotime($workingDate));

    $nextMonth = (int) date('n', strtotime($nextDate));
    $nextYear = (int) date('Y', strtotime($nextDate));

    $currentDeviceTable = "DeviceLogs_" . $currentMonth . "_" . $currentYear;
    $nextDeviceTable = "DeviceLogs_" . $nextMonth . "_" . $nextYear;

    $deviceTables = [$currentDeviceTable];

    if ($nextDeviceTable != $currentDeviceTable) {
        $deviceTables[] = $nextDeviceTable;
    }

    $nightOut = null;

    foreach ($deviceTables as $deviceTable) {
        writeDebugLog("Checking device table for OUT: " . $deviceTable);

        $tableCheck = sqlsrv_query($conn, "SELECT OBJECT_ID('dbo.$deviceTable') AS TableId");

        if (!$tableCheck) {
            die(json_encode(sqlsrv_errors()));
        }

        $tableRow = sqlsrv_fetch_array($tableCheck, SQLSRV_FETCH_ASSOC);

        if (!$tableRow['TableId']) {
            writeDebugLog("Device table not found: " . $deviceTable);
        } else {
            $outPunchSql = "SELECT LogDate, AttDirection FROM dbo.$deviceTable WHERE LTRIM(RTRIM(UserId)) = ? AND LogDate >= ? AND LogDate <= ? ORDER BY LogDate ASC";

            $outPunchStmt = sqlsrv_query($conn, $outPunchSql, [$deviceCode, $nightOutStart, $nightOutEnd]);

            if (!$outPunchStmt) {
                writeDebugLog("OUT PUNCH QUERY ERROR: " . json_encode(sqlsrv_errors()));
                die(json_encode(sqlsrv_errors()));
            }

            while ($punch = sqlsrv_fetch_array($outPunchStmt, SQLSRV_FETCH_ASSOC)) {
                $punchTime = $punch['LogDate'];
                $direction = strtoupper(trim($punch['AttDirection']));
                $punchDateTime = $punchTime->format('Y-m-d H:i:s');

                writeDebugLog("OUT SEARCH PUNCH | Table: " . $deviceTable . " | DateTime: " . $punchDateTime . " | Direction: " . $direction);

                if ($direction == 'OUT') {
                    $nightOut = $punchTime;
                    writeDebugLog("SECOND SHIFT OUT SELECTED: " . $punchDateTime);
                    break;
                }
            }
        }

        if ($nightOut != null) {
            break;
        }
    }

    if ($nightOut == null) {
        $outPunchNotFound++;
        writeDebugLog("OUT PUNCH STILL NOT FOUND | AttendanceLogId: " . $attendanceLogId);
    } else {
        $inDateTime = new DateTime($inPunchDate . " " . $inTime);

        $outDateTime = $nightOut;
        
        if ($outDateTime <= $inDateTime) {
            writeDebugLog("INVALID OUT PUNCH TIME | AttendanceLogId: " . $attendanceLogId);
        } else {
            $seconds = $outDateTime->getTimestamp() - $inDateTime->getTimestamp();

            $hours = floor($seconds / 3600);
            $minutes = floor(($seconds % 3600) / 60);
            $remainingSeconds = $seconds % 60;

            $duration = sprintf("%02d:%02d:%02d", $hours, $minutes, $remainingSeconds);

            $outTime = $outDateTime->format('H:i:s');
            $outPunchDate = $outDateTime->format('Y-m-d');

            writeDebugLog("NEW OUT TIME: " . $outTime);
            writeDebugLog("NEW OUT DATE: " . $outPunchDate);
            writeDebugLog("UPDATED DURATION: " . $duration);

            $updateSql = "UPDATE dbo.$destinationTable SET OutTime = ?, OutPunchDate = ?, Duration = ? WHERE AttendanceLogId = ? AND OutTime IS NULL";

            $updateParams = [$outTime, $outPunchDate, $duration, $attendanceLogId];

            $updateStmt = sqlsrv_query($conn, $updateSql, $updateParams);

            if (!$updateStmt) {
                writeDebugLog("OUT PUNCH UPDATE ERROR: " . json_encode(sqlsrv_errors()));
                die(json_encode(sqlsrv_errors()));
            } else {
                $affectedRows = sqlsrv_rows_affected($updateStmt);

                if ($affectedRows > 0) {
                    $outPunchUpdated++;
                    writeDebugLog("OUT PUNCH UPDATED SUCCESSFULLY | AttendanceLogId: " . $attendanceLogId);
                } else {
                    writeDebugLog("OUT PUNCH NOT UPDATED | Record may already have an OutTime | AttendanceLogId: " . $attendanceLogId);
                }
            }
        }
    }
}

writeDebugLog("MISSING OUT PUNCH PROCESSING COMPLETED");
writeDebugLog("Total OutPunch records updated: " . $outPunchUpdated);
writeDebugLog("Total OutPunch records still missing: " . $outPunchNotFound);
writeDebugLog("==================================================");

echo json_encode([
    "success" => true,
    "month" => $month,
    "year" => $year,
    "attendanceRecordsChecked" => $checked,
    "nightAttendanceInserted" => $inserted,
    "alreadyExists" => $alreadyExists,
    "noNightPunchFound" => $noNightPunch,
    "skippedEmptyAttendance" => $skipped,
    "outPunchUpdated" => $outPunchUpdated,
    "outPunchStillMissing" => $outPunchNotFound
], JSON_PRETTY_PRINT);

writeDebugLog("==================================================");
writeDebugLog("SCRIPT COMPLETED");
writeDebugLog("Total attendance records checked: " . $checked);
writeDebugLog("Total second shift records inserted: " . $inserted);
writeDebugLog("Total duplicate records: " . $alreadyExists);
writeDebugLog("Total records without valid punches: " . $noNightPunch);
writeDebugLog("Total empty attendance records skipped: " . $skipped);
writeDebugLog("==================================================");

sqlsrv_close($conn);

?>