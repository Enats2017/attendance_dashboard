<?php

ini_set('display_errors', 0);
error_reporting(0);
ini_set('max_execution_time', 800);

header('Content-Type: application/json');

date_default_timezone_set('Asia/Kolkata');

$sqlConfig = [
    "server" => "10.2.30.13",
    "database" => "eSSLSmartOffice",
    "uid" => "sa",
    "pwd" => "Wpl@123"
];

$sqlServerConnection = sqlsrv_connect($sqlConfig['server'], [
    "Database" => $sqlConfig['database'],
    "UID" => $sqlConfig['uid'],
    "PWD" => $sqlConfig['pwd']
]);

if ($sqlServerConnection === false) {

    echo json_encode([
        "success" => false,
        "message" => "SQL Server connection failed",
        "errors" => sqlsrv_errors()
    ], JSON_PRETTY_PRINT);

    exit;
}

// Initialize log file only after successful database connection
$debugLogFile = __DIR__ . '/table_creation.log';

function writeDebugLog($message)
{

    global $debugLogFile;

    $logMessage = "[" . date('Y-m-d H:i:s') . "] " . $message . PHP_EOL;

    file_put_contents($debugLogFile, $logMessage, FILE_APPEND);
}

writeDebugLog("SQL Server connection successful.");

$createdTables = [];
$existingTables = [];
$failedTables = [];

$currentMonthDate = new DateTime('first day of this month');

for ($monthOffset = 1; $monthOffset <= 1; $monthOffset++) {

    $futureMonthDate = clone $currentMonthDate;
    $futureMonthDate->modify("+$monthOffset month");

    $targetMonth = $futureMonthDate->format('n');
    $targetYear = $futureMonthDate->format('Y');

    $attendanceTableName = "NewAttendanceLogs_" . $targetMonth . "_" . $targetYear;
    $trackingTableName = "OvertimeAttendanceCheck_" . $targetMonth . "_" . $targetYear;

    writeDebugLog("Checking tables for month: " . $targetMonth . "_" . $targetYear);

    $tablesToCreate = [
        [
            "name" => $attendanceTableName,
            "query" => "
                CREATE TABLE dbo.[$attendanceTableName] (
                    Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    AttendanceLogId INT NOT NULL UNIQUE,
                    EmployeeId INT NOT NULL,
                    EmployeeCodeInDevice NVARCHAR(100) NULL,
                    InTime NVARCHAR(255) NULL,
                    OutTime NVARCHAR(255) NULL,
                    InPunchDate DATE NULL,
                    OutPunchDate DATE NULL,
                    Duration VARCHAR(50) NULL,
                    CreatedAt DATETIME NOT NULL DEFAULT (GETDATE()),
                    UpdatedAt DATETIME NULL
                );
            "
        ],
        [
            "name" => $trackingTableName,
            "query" => "
                CREATE TABLE dbo.[$trackingTableName] (
                    Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    AttendanceLogId INT NOT NULL,
                    CreatedAt DATETIME NOT NULL DEFAULT (GETDATE())
                );
            "
        ]
    ];

    foreach ($tablesToCreate as $tableInfo) {

        $tableName = $tableInfo['name'];

        writeDebugLog("Checking whether table exists: " . $tableName);

        $tableExistenceQuery = "SELECT OBJECT_ID(?, 'U') AS TableId";

        $tableExistenceStatement = sqlsrv_query(
            $sqlServerConnection,
            $tableExistenceQuery,
            ['dbo.' . $tableName]
        );

        if ($tableExistenceStatement === false) {

            $errors = sqlsrv_errors();

            $failedTables[] = [
                "table" => $tableName,
                "errors" => $errors
            ];

            writeDebugLog("FAILED: Could not check table existence: " . $tableName);
            writeDebugLog("SQL Error: " . json_encode($errors));

            continue;
        }

        $tableExistenceResult = sqlsrv_fetch_array(
            $tableExistenceStatement,
            SQLSRV_FETCH_ASSOC
        );

        sqlsrv_free_stmt($tableExistenceStatement);

        if (!empty($tableExistenceResult['TableId'])) {

            $existingTables[] = $tableName;

            writeDebugLog("EXISTS: Table already exists: " . $tableName);

        } else {

            writeDebugLog("Creating table: " . $tableName);

            $createTableStatement = sqlsrv_query(
                $sqlServerConnection,
                $tableInfo['query']
            );

            if ($createTableStatement === false) {

                $errors = sqlsrv_errors();

                $failedTables[] = [
                    "table" => $tableName,
                    "errors" => $errors
                ];

                writeDebugLog("FAILED: Table creation failed: " . $tableName);
                writeDebugLog("SQL Error: " . json_encode($errors));

            } else {

                $createdTables[] = $tableName;

                writeDebugLog("SUCCESS: Table created: " . $tableName);

                sqlsrv_free_stmt($createTableStatement);
            }
        }
    }
}

sqlsrv_close($sqlServerConnection);

writeDebugLog("SQL Server connection closed.");
writeDebugLog("Table creation process completed.");
writeDebugLog("Created Tables: " . json_encode($createdTables));
writeDebugLog("Existing Tables: " . json_encode($existingTables));
writeDebugLog("Failed Tables: " . json_encode($failedTables));

echo json_encode([
    "success" => empty($failedTables),
    "createdTables" => $createdTables,
    "existingTables" => $existingTables,
    "failedTables" => $failedTables
], JSON_PRETTY_PRINT);

?>