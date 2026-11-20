import React, { useState, useEffect, useCallback, useRef } from "react";
import ExcelJS from "exceljs";
import { generateDummyReport, DEFAULT_STD_HC } from "./dummyData";
import "./DeptAttendance.css";

const API_BASE = "/attendance-dashboard/api/index.php";
const DASH_URL = "/attendance-dashboard/index.html";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function DeptAttendance() {
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [locationList, setLocationList] = useState([]);
    const [adminList, setAdminList] = useState([]);
    const [selectedAdminId, setSelectedAdminId] = useState(null);
    const [isMasterAdmin, setIsMasterAdmin] = useState(false);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const [month, setMonth] = useState(() => yesterday.getMonth() + 1);
    const [year, setYear] = useState(() => yesterday.getFullYear());
    const [dayFrom, setDayFrom] = useState(() => yesterday.getDate());
    const [dayTo, setDayTo] = useState(() => yesterday.getDate());

    // Temporary states for the filter UI (only applied on button click)
    const [tempMonth, setTempMonth] = useState(month);
    const [tempYear, setTempYear] = useState(year);
    const [tempDayFrom, setTempDayFrom] = useState(dayFrom);
    const [tempDayTo, setTempDayTo] = useState(dayTo);
    const [tempSelectedLocation, setTempSelectedLocation] = useState(selectedLocation);

    // Forces a reload on every "Apply Filter" click, even when nothing changed
    const [refreshKey, setRefreshKey] = useState(0);
    // Used to ignore responses of outdated requests
    const reportReqId = useRef(0);
    const dailyReqId = useRef(0);

    const [reportData, setReportData] = useState(null);
    const [stdHcMap, setStdHcMap] = useState({});
    const [deptList, setDeptList] = useState([]);
    const [showDesigSettings, setShowDesigSettings] = useState(false);
    const [desigStdHcMap, setDesigStdHcMap] = useState({});
    const [desigList, setDesigList] = useState([]);
    const [editDesigHc, setEditDesigHc] = useState({});
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState(null);
    const [unitCapacity, setUnitCapacity] = useState("150 Tons");
    const [unitName, setUnitName] = useState("PSF");
    const [loginName, setLoginName] = useState("");
    const [expandedDept, setExpandedDept] = useState(null);
    const [expandedDesig, setExpandedDesig] = useState(null);
    const [expandedSummary, setExpandedSummary] = useState(null);
    const [statusDetail, setStatusDetail] = useState(null);
    const [attendanceDetail, setAttendanceDetail] = useState(null);
    const [machineStd, setMachineStd] = useState(0);
    const [editMachineStd, setEditMachineStd] = useState(0);
    const [showMachineStdSettings, setShowMachineStdSettings] = useState(false);
    const [dailyMachines, setDailyMachines] = useState({});
    const [editDailyMachines, setEditDailyMachines] = useState({});
    const [showDailyMachineSettings, setShowDailyMachineSettings] = useState(false);
    const [savingDesigStdHc, setSavingDesigStdHc] = useState(false);

    const currentUserId = getCurrentUserId();

    let runningMachinesLabel = "No. of Running Machines";
    let labourPerMachineLabel = "Labour Per Machine Per Day";
    let machineUnitSuffix = "M/C's";

    if (currentUserId === 28 || currentUserId === 34 || currentUserId === 36 || currentUserId === 13 || currentUserId === 14) {
        runningMachinesLabel = "Daily Production (In Tons)";
        labourPerMachineLabel = "Labour per ton per day";
        machineUnitSuffix = "Tons";
    } else if (currentUserId === 33 || currentUserId === 35) {
        runningMachinesLabel = "No. of running winder's";
        labourPerMachineLabel = "Labour per winder per day";
        machineUnitSuffix = "W's";
    }

    const showToast = useCallback((msg, type = "success") => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    useEffect(() => {
        const userSession = localStorage.getItem("hrms_user");

        if (!userSession) {
            window.location.replace("/attendance-dashboard/login");
            return;
        }

        try {
            const user = JSON.parse(userSession);
            const master = Boolean(user.isMaster ?? user.is_master ?? user.IsMaster);
            const userId = Number(user.userId ?? user.UserId ?? user.id);

            setIsMasterAdmin(master);

            if (master) {
                fetchSubAdmins();
            } else if (userId > 0) {
                setSelectedAdminId(userId);
                fetchLocations(userId);
            }
        } catch (err) {
            console.error("Invalid hrms_user session:", err);
        }
    }, []);

    useEffect(() => {
        if (selectedLocation !== null) {
            setTempSelectedLocation(selectedLocation);
        }
    }, [selectedLocation]);

    useEffect(() => {
        if (selectedLocation !== null && selectedAdminId !== null) {
            fetchStdHc();
            fetchDesignationStdHc();
            fetchMachineStd();
        }
    }, [selectedLocation, selectedAdminId]);

    useEffect(() => {
        if (selectedLocation !== null && selectedAdminId !== null) {
            loadReport();
            fetchDailyMachines();
        }
    }, [month, year, dayFrom, dayTo, selectedLocation, selectedAdminId, refreshKey]);

    function applyFilters() {
        if (tempDayTo < tempDayFrom) {
            showToast("'To' date cannot be before 'From' date.", "error");
            return;
        }
        setMonth(tempMonth);
        setYear(tempYear);
        setDayFrom(tempDayFrom);
        setDayTo(tempDayTo);
        if (tempSelectedLocation) setSelectedLocation(tempSelectedLocation);
        setRefreshKey((k) => k + 1); 
    }

    function getCurrentUserId() {
        try {
            const user = JSON.parse(localStorage.getItem("hrms_user"));
            return Number(user?.userId ?? user?.UserId ?? user?.id);
        } catch {
            return NaN;
        }
    }

    async function fetchSubAdmins() {
        try {
            const res = await fetch(API_BASE, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "get_subadmins"
                }),
            });

            const data = await res.json();

            if (data.success && Array.isArray(data.data)) {
                const currentUserId = getCurrentUserId();

                const sortedAdmins = [...data.data].sort((a, b) => {
                    const aIsSelf = Number(a.id) === currentUserId;
                    const bIsSelf = Number(b.id) === currentUserId;
                    if (aIsSelf && !bIsSelf) return -1;
                    if (!aIsSelf && bIsSelf) return 1;
                    return String(a.name || "").localeCompare(String(b.name || ""));
                });

                setAdminList(sortedAdmins);

                if (sortedAdmins.length > 0) {
                    const selfAdmin = sortedAdmins.find((admin) => Number(admin.id) === currentUserId);
                    const firstAdmin = selfAdmin || sortedAdmins[0];
                    setSelectedAdminId(firstAdmin.id);
                    await fetchLocations(firstAdmin.id);
                }
            }
        } catch (err) {
            console.error("fetchSubAdmins error:", err);
        }
    }


    async function fetchLocations(adminId) {
        try {
            const res = await fetch(API_BASE, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "get_locations",
                    targetUserId: adminId
                }),
            });

            const data = await res.json();

            if (data.success && Array.isArray(data.data)) {
                setLocationList(data.data);
                if (data.data.length === 1) {
                    const singleItem = data.data[0];
                    setSelectedLocation({ type: singleItem.type, id: singleItem.type === 'group' ? singleItem.group_id : singleItem.location_id });
                } else {
                    setSelectedLocation({ type: 'all', id: 0 });
                }
            } else {
                setLocationList([]);
                setSelectedLocation({ type: 'all', id: 0 });
            }
        } catch (err) {
            console.error("fetchLocations error:", err);
            setLocationList([]);
            setSelectedLocation({ type: 'all', id: 0 });
        }
    }


    async function handleAdminChange(adminId) {
        setSelectedAdminId(adminId);

        // Reset current location
        setSelectedLocation(null);
        setTempSelectedLocation(null);
        setLocationList([]);

        // Clear old Admin's data
        setReportData(null);
        setStdHcMap({});
        setDeptList([]);
        setDesigStdHcMap({});
        setDesigList([]);
        setMachineStd(0);
        setDailyMachines({});
        setStatusDetail(null);
        setAttendanceDetail(null);

        // Reset expanded sections
        setExpandedDept(null);
        setExpandedDesig(null);
        setExpandedSummary(null);

        // Load locations belonging to the selected Admin
        await fetchLocations(adminId);
    }


    async function fetchStdHc() {
        try {
            const res = await fetch(API_BASE, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "get_std_hc",
                    location_id: locationId,
                    targetUserId: selectedAdminId
                }),
            });
            const data = await res.json();
            if (data.success && data.data) {
                const map = {};
                data.data.forEach((d) => {
                    map[d.dept_id] = parseInt(d.std_hc, 10);
                });
                setStdHcMap(map);
                setDeptList(data.data);
                if (data.unit_config) {
                    setUnitCapacity(data.unit_config.unit_capacity || "");
                    setUnitName(data.unit_config.unit_name || "All Locations");
                }
                if (data.login_name) setLoginName(data.login_name);
            }
        } catch {}
    }

    async function fetchDesignationStdHc() {
        try {
            const res = await fetch(API_BASE, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "get_designation_std_hc",
                    location_id: locationId,
                    targetUserId: selectedAdminId
                }),
            });

            const data = await res.json();

            if (data.success && data.data) {
                const map = {};
                data.data.forEach((d) => {
                    if (!map[d.dept_id]) map[d.dept_id] = {};
                    map[d.dept_id][d.designation_id] = parseInt(d.std_hc, 10);
                });
                setDesigStdHcMap(map);
                setDesigList(data.data);
            }
        } catch {}
    }

    async function fetchMachineStd() {
        try {
            const res = await fetch(API_BASE, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "get_machine_std",
                    location_id: locationId,
                    targetUserId: selectedAdminId
                }),
            });
            const data = await res.json();
            if (data.success && data.data) setMachineStd(data.data.total_machines || 0);
        } catch {}
    }

    async function saveMachineStd() {
        try {
            const res = await fetch(API_BASE, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "update_machine_std",
                    location_id: locationId,
                    targetUserId: selectedAdminId,
                    total_machines: editMachineStd
                }),
            });
            const data = await res.json();
            if (!data.success) {
                showToast(data.message || "Failed to save total machines", "error");
                return false;
            }
        } catch (err) {
            console.error("saveMachineStd error:", err);
            showToast("Network error saving total machines", "error");
            return false;
        }
        setMachineStd(editMachineStd);
        return true;
    }

    function dateStr(y, m, d) {
        return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }

    async function fetchDailyMachines() {
        const reqId = ++dailyReqId.current;
        setDailyMachines({});

        try {
            const res = await fetch(API_BASE, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "get_daily_machines",
                    location_id: locationId,
                    targetUserId: selectedAdminId,
                    date_from: dateStr(year, month, dayFrom),
                    date_to: dateStr(year, month, dayTo),
                }),
            });
            const data = await res.json();
            if (reqId !== dailyReqId.current) return; // outdated response
            if (data.success && data.data) {
                setDailyMachines(data.data);
            }
        } catch {}
    }

    async function saveDailyMachines() {
        const items = Object.entries(editDailyMachines).map(([date, count]) => ({
            date,
            running_machines: count,
        }));
        try {
            const res = await fetch(API_BASE, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "bulk_update_daily_machines",
                    location_id: locationId,
                    targetUserId: selectedAdminId,
                    items
                }),
            });
            const data = await res.json();
            if (!data.success) {
                showToast(data.message || "Failed to save daily machine counts", "error");
                return false;
            }
        } catch (err) {
            console.error("saveDailyMachines error:", err);
            showToast("Network error saving daily machine counts", "error");
            return false;
        }
        setDailyMachines({ ...editDailyMachines });
        return true;
    }

    async function loadReport() {
        const reqId = ++reportReqId.current;
        setLoading(true);
        // Clear all data belonging to the previous filter selection
        setReportData(null);
        setStatusDetail(null);
        setAttendanceDetail(null);

        // Reset expanded states from previous report
        setExpandedDept(null);
        setExpandedDesig(null);
        setExpandedSummary(null);

        try {
            const res = await fetch(API_BASE, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "get_report",
                    month,
                    year,
                    day_from: dayFrom,
                    day_to: dayTo,
                    location_id: locationId,
                    targetUserId: selectedAdminId
                }),
            });

            const data = await res.json();

            if (reqId !== reportReqId.current) return; // a newer request exists, ignore this one

            if (data.success) {
                setReportData(data);
                setLoading(false);
                return;
            }

            console.error("get_report failed:", data.message, data.errors);
            showToast(data.message || "Failed to load report — showing sample data", "error");
        } catch (err) {
            if (reqId !== reportReqId.current) return;
            console.error("get_report request error:", err);
            showToast("Network error — showing sample data", "error");
        }

        if (reqId !== reportReqId.current) return;
        const dummy = generateDummyReport(month, year, dayFrom, dayTo, stdHcMap);
        setReportData(dummy);
        setLoading(false);
    }

    async function saveDesigStdHc() {
        setSavingDesigStdHc(true);
        const items = [];
        Object.entries(editDesigHc).forEach(([deptId, desigMap]) => {
            Object.entries(desigMap).forEach(([desigId, hc]) => {
                items.push({
                    dept_id: deptId,
                    designation_id: desigId,
                    location_id: locationId,
                    std_hc: hc === "" || hc === null || hc === undefined
                        ? null
                        : Number(hc)
                });
            });
        });

        if (items.length === 0) {
            showToast("No designation data to save.", "error");
            setSavingDesigStdHc(false);
            return false;
        }

        try {
            const res = await fetch(API_BASE, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "bulk_update_designation_std_hc",
                    targetUserId: selectedAdminId,
                    items
                }),
            });
            const data = await res.json();

            await fetchDesignationStdHc();
            await fetchStdHc();

            if (!data.success) {
                showToast(data.message || "Failed to save Designation STD HC.", "error");
                return false;
            }

            return true;
        } catch (err) {
            console.error("saveDesigStdHc error:", err);
            showToast("Network error saving designation STD HC", "error");
            return false;
        } finally {
            setSavingDesigStdHc(false);
        }
    }

    async function exportExcel() {
        if (loading || !reportData) {
            showToast("Please wait until the report loads.", "error");
            return;
        }

        try {
            const workbook = new ExcelJS.Workbook();

            workbook.creator = "Department Attendance";
            workbook.created = new Date();

            const worksheet = workbook.addWorksheet("Attendance", {
                properties: {
                    outlineLevelRow: 2,
                    outlineProperties: {
                        summaryBelow: false
                    }
                }
            });

            const departments = reportData.departments || [];
            const summary = reportData.summary || {};
            const summaryAvg = reportData.summary_avg || {};

            const totalMachines = Number(reportData.total_running_machines) || 0;
            const totalStdHc = Number(reportData.total_std_hc) || 0;

            const columnCount = days.length + 6;

            // ---------------------------------------
            // Report title
            // ---------------------------------------
            worksheet.mergeCells(1, 1, 1, columnCount);

            const titleCell = worksheet.getCell(1, 1);

            titleCell.value =
                `${loginName} Unit Per Day Actual Head Count (HC) Report ` +
                `${MONTH_NAMES[month - 1]} ${year}`;

            titleCell.font = {
                bold: true,
                size: 15,
                color: { argb: "FFFFFFFF" }
            };

            titleCell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "F59E0B" }
            };

            titleCell.alignment = {
                horizontal: "center",
                vertical: "middle"
            };

            worksheet.getRow(1).height = 30;

            // ---------------------------------------
            // Column headers
            // ---------------------------------------
            const headers = [
                "Department",
                "Designation",
                "Employee Code",
                "Employee Name",
                `STD HC (${totalMachines} ${machineUnitSuffix})`,
                ...days.map(d => String(d)),
                "Avg. HC"
            ];

            const headerRow = worksheet.addRow(headers);

            headerRow.height = 32;

            headerRow.eachCell((cell) => {
                cell.font = { bold: true, color: { argb: "FF000000" } };
                cell.fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: { argb: "FFFBBF24" }
                };
                cell.alignment = {
                    horizontal: "center",
                    vertical: "middle",
                    wrapText: true
                };
                cell.border = {
                    top: { style: "thin", color: { argb: "FFCCCCCC" } },
                    bottom: { style: "thin", color: { argb: "FFCCCCCC" } },
                    left: { style: "thin", color: { argb: "FFCCCCCC" } },
                    right: { style: "thin", color: { argb: "FFCCCCCC" } }
                };
            });

            // ---------------------------------------
            // Helper to create report rows
            // ---------------------------------------
            function addReportRow({
                department = "",
                designation = "",
                employeeCode = "",
                employeeName = "",
                std = "",
                dayValues = {},
                avg = "",
                level = 0,
                hidden = false,
                type = ""
            }) {
                const rowData = [
                    department,
                    designation,
                    employeeCode,
                    employeeName,
                    std,
                    ...days.map(d => {
                        const value = dayValues && dayValues[d] !== undefined
                            ? dayValues[d]
                            : "";

                        return value === 0 ? "" : value;
                    }),
                    avg
                ];

                const row = worksheet.addRow(rowData);

                // Excel row grouping:
                // Level 0 = Department
                // Level 1 = Designation
                // Level 2 = Employee
                row.outlineLevel = level;
                row.hidden = hidden;

                row.eachCell((cell) => {
                    cell.border = {
                        top: { style: "thin", color: { argb: "FFD1D5DB" } },
                        bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
                        left: { style: "thin", color: { argb: "FFD1D5DB" } },
                        right: { style: "thin", color: { argb: "FFD1D5DB" } }
                    };

                    cell.alignment = {
                        vertical: "middle",
                        horizontal: "center"
                    };
                });

                // Department styling
                if (type === "department") {
                    row.font = { bold: true };
                    row.fill = {
                        type: "pattern",
                        pattern: "solid",
                        fgColor: { argb: "FFEFF6FF" }
                    };
                    row.height = 22;
                }

                // Designation styling
                if (type === "designation") {
                    row.getCell(2).font = {
                        bold: true,
                        color: { argb: "FF1E40AF" }
                    };
                    row.getCell(2).alignment = {
                        horizontal: "left",
                        indent: 1,
                        vertical: "middle"
                    };
                    row.height = 20;
                }

                // Employee styling
                if (type === "employee") {
                    row.getCell(4).alignment = {
                        horizontal: "left",
                        indent: 1,
                        vertical: "middle"
                    };
                    row.getCell(3).font = {
                        color: { argb: "FF64748B" }
                    };
                }

                // Department summary styling
                if (type === "dept-summary") {
                    row.getCell(1).font = {
                        italic: true,
                        color: { argb: "FF475569" }
                    };
                }

                // Overall and group total styling
                // Overall and group total styling
                if (type === "total") {
                    row.eachCell((cell) => {
                        cell.font = {
                            bold: true,
                            color: { argb: "FF1E40AF" }
                        };

                        cell.fill = {
                            type: "pattern",
                            pattern: "solid",
                            fgColor: { argb: "FFDBEAFE" }
                        };

                        cell.alignment = {
                            horizontal: "center",
                            vertical: "middle"
                        };
                    });

                    row.height = 22;
                }

                if (type === "summary-heading") {
                    row.getCell(1).font = { bold: true };
                    row.getCell(1).fill = {
                        type: "pattern",
                        pattern: "solid",
                        fgColor: { argb: "FFE2E8F0" }
                    };
                }

                return row;
            }

            // ---------------------------------------
            // Department ordering (same as frontend)
            // ---------------------------------------
            const groupDeptMap = {};

            departments.forEach((dept, index) => {
                if (dept.groupId === null || dept.groupId === undefined) {
                    return;
                }

                const gid = String(dept.groupId);

                if (!groupDeptMap[gid]) {
                    groupDeptMap[gid] = {
                        name: dept.groupName,
                        sortOrder: Number(dept.groupSortOrder) || 0,
                        firstIndex: index,
                        depts: []
                    };
                }

                groupDeptMap[gid].depts.push(dept);
            });

            const orderedDepartments = Object.values(groupDeptMap)
                .sort((a, b) =>
                    a.sortOrder - b.sortOrder ||
                    a.firstIndex - b.firstIndex
                )
                .flatMap(group =>
                    group.depts.map((dept, index) => ({
                        dept,
                        isGroupLast: index === group.depts.length - 1
                    }))
                )
                .concat(
                    departments
                        .filter(dept =>
                            dept.groupId === null ||
                            dept.groupId === undefined
                        )
                        .map(dept => ({
                            dept,
                            isGroupLast: false
                        }))
                );

            // ---------------------------------------
            // Export departments and nested rows
            // ---------------------------------------
            orderedDepartments.forEach(({ dept, isGroupLast }) => {

                // Department row (always visible)
                addReportRow({
                    department: dept.department,
                    std: dept.std_hc,
                    dayValues: dept.days,
                    avg: dept.avg_hc,
                    level: 0,
                    hidden: false,
                    type: "department"
                });

                // Designation rows (initially collapsed)
                (dept.designations || []).forEach(desig => {

                    addReportRow({
                        designation: desig.designationName,
                        std: desig.std_hc ?? 0,
                        dayValues: desig.days,
                        avg: desig.avg_hc,
                        level: 1,
                        hidden: true,
                        type: "designation"
                    });

                    // Employee rows (nested inside designation)
                    (desig.employees || []).forEach(emp => {

                        addReportRow({
                            employeeCode: emp.employeeCode || "",
                            employeeName: emp.employeeName || "",
                            dayValues: emp.days,
                            level: 2,
                            hidden: true,
                            type: "employee"
                        });
                    });
                });

                // Department summary
                if (dept.summary) {
                    addReportRow({
                        department: "Department Summary",
                        level: 1,
                        hidden: true,
                        type: "summary-heading"
                    });

                    const deptSummaryRows = [
                        ["total_present", "Total Present"],
                        ["total_half_present", "Total Half Present"],
                        ["total_wo_present", "Total Weekly-Off Present"],
                        ["total_wo_half_present", "Total Weekly-Off Half Present"],
                        ["total_single_punch", "Total Single Punches"],
                        ["total_weekly_off", "Total Weekly Off"],
                        ["total_absent", "Total Absent"]
                    ];

                    deptSummaryRows.forEach(([key, label]) => {
                        addReportRow({
                            department: label,
                            dayValues: dept.summary[key],
                            level: 2,
                            hidden: true,
                            type: "dept-summary"
                        });
                    });
                }

                // Group totals (same calculation as frontend)
                if (
                    isGroupLast &&
                    dept.groupId !== null &&
                    dept.groupId !== undefined
                ) {
                    const group = groupDeptMap[String(dept.groupId)];

                    const groupStd = group.depts.reduce(
                        (sum, item) => sum + (Number(item.std_hc) || 0),
                        0
                    );

                    const groupAvg = group.depts.reduce(
                        (sum, item) => sum + (Number(item.avg_hc) || 0),
                        0
                    );

                    const groupDayTotals = {};

                    days.forEach(d => {
                        groupDayTotals[d] = group.depts.reduce(
                            (sum, item) =>
                                sum + (Number(item.days?.[d]) || 0),
                            0
                        );
                    });

                    addReportRow({
                        department: "Total Present",
                        std: groupStd,
                        dayValues: groupDayTotals,
                        avg: groupAvg,
                        type: "total"
                    });
                }
            });

            // ---------------------------------------
            // Overall report summary
            // ---------------------------------------
            const stdLabourPerMachine = (totalLabour) =>
                totalMachines > 0
                    ? (Number(totalLabour) / totalMachines).toFixed(1)
                    : "";

            const overallRows = [
                {
                    label: "Overall Present",
                    std: totalStdHc,
                    values: summary.total_present,
                    avg: summaryAvg.total_present
                },
                {
                    label: runningMachinesLabel,
                    std: totalMachines,
                    values: summary.running_machines,
                    avg: summaryAvg.running_machines
                },
                {
                    label: labourPerMachineLabel,
                    std: stdLabourPerMachine(totalStdHc),
                    values: summary.labor_per_machine,
                    avg: summaryAvg.labor_per_machine
                },
                {
                    label: "Total Present",
                    values: summary.present,
                    avg: summaryAvg.present
                },
                {
                    label: "Total Half Present",
                    values: summary.half_present,
                    avg: summaryAvg.half_present
                },
                {
                    label: "Total Weekly-Off Present",
                    values: summary.wo_present,
                    avg: summaryAvg.wo_present
                },
                {
                    label: "Total Weekly-Off Half Present",
                    values: summary.wo_half_present,
                    avg: summaryAvg.wo_half_present
                },
                {
                    label: "Total Single Punches",
                    values: summary.single_punch,
                    avg: summaryAvg.single_punch
                },
                {
                    label: "Total Weekly Off",
                    values: summary.weekly_off,
                    avg: summaryAvg.weekly_off
                },
                {
                    label: "Total Absent",
                    values: summary.total_absent,
                    avg: summaryAvg.total_absent
                },
                {
                    label: "Over-Time Paid",
                    values: summary.overtime_paid,
                    avg: summaryAvg.overtime_paid
                },
                {
                    label: "On Leave",
                    values: summary.on_leave,
                    avg: summaryAvg.on_leave
                },
                {
                    label: "Total New Joinee",
                    values: summary.new_joinee,
                    avg: summaryAvg.new_joinee
                },
                {
                    label: "Total Resigned",
                    values: summary.left,
                    avg: summaryAvg.left
                },
                {
                    label: "Recruited Head Count",
                    values: summary.recruited_hc,
                    avg: summaryAvg.recruited_hc
                }
            ];

            overallRows.forEach(item => {
                addReportRow({
                    department: item.label,
                    std: item.std ?? "",
                    dayValues: item.values,
                    avg: item.avg ?? "",
                    type: "total"
                });
            });

            // ---------------------------------------
            // Column widths and Excel outline
            // ---------------------------------------
            worksheet.getColumn(1).width = 25;
            worksheet.getColumn(2).width = 24;
            worksheet.getColumn(3).width = 18;
            worksheet.getColumn(4).width = 28;
            worksheet.getColumn(5).width = 16;

            days.forEach((d, index) => {
                worksheet.getColumn(index + 6).width = 12;
            });

            worksheet.getColumn(columnCount).width = 12;

            // Freeze title, header and first four identity columns
            worksheet.views = [{
                state: "frozen",
                xSplit: 4,
                ySplit: 2,
                topLeftCell: "E3"
            }];

            // Show Excel's outline controls
            worksheet.properties.outlineLevelRow = 2;
            worksheet.properties.outlineProperties = {
                summaryBelow: false
            };

            // ---------------------------------------
            // Download genuine XLSX file
            // ---------------------------------------
            const buffer = await workbook.xlsx.writeBuffer();

            const blob = new Blob(
                [buffer],
                {
                    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                }
            );

            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");

            link.href = url;
            link.download =
                `Dept_HC_Report_${MONTH_NAMES[month - 1]}_${year}.xlsx`;

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            setTimeout(() => URL.revokeObjectURL(url), 1000);

            showToast("Excel exported successfully!", "success");

        } catch (error) {
            console.error("Excel export error:", error);
            showToast("Unable to export Excel report.", "error");
        }
    }

    const maxDays = new Date(year, month, 0).getDate();
    const pad = (n) => String(n).padStart(2, "0");

    const minDate = "2020-01-01";
    const maxDate = "2030-12-31";

    // Range is limited to the month of the "From" date (API takes a single month/year)
    const tempMaxDays = new Date(tempYear, tempMonth, 0).getDate();
    const maxToDateValue = `${tempYear}-${pad(tempMonth)}-${pad(tempMaxDays)}`;

    const days = [];
    const clampedFrom = Math.max(1, Math.min(dayFrom, maxDays));
    const clampedTo = Math.max(clampedFrom, Math.min(dayTo, maxDays));

    for (let d = clampedFrom; d <= clampedTo; d++) {
        days.push(d);
    }

    let locationId = 0;
    if (selectedLocation) {
        if (selectedLocation.type === 'all') {
            locationId = 0;
        } else if (selectedLocation.type === 'location') {
            locationId = selectedLocation.id;
        } else if (selectedLocation.type === 'group') {
            const selectedGroup = locationList.find((item) => item.type === 'group' && item.group_id === selectedLocation.id);
            if (selectedGroup && selectedGroup.location_ids) {
                locationId = selectedGroup.location_ids.join(',');
            }
        }
    }

    return (
        <div className="da-page">
            {toast && (
                <div className={`da-toast da-toast-${toast.type}`}>
                    {toast.type === "success" ? "✅" : toast.type === "error" ? "⚠️" : "ℹ️"} {toast.msg}
                </div>
            )}

            <div className="da-header">
                <div className="da-header-logo">🏭</div>
                <div>
                    <h1>Department Attendance</h1>
                    <p>Per Day Actual Head Count (HC) Report</p>
                </div>
                <div className="da-header-actions">
                    <a href={DASH_URL} className="da-btn-back">
                        ⬅ Back to Dashboard
                    </a>
                </div>
            </div>

            <div className="da-filter-bar">
                {isMasterAdmin && (
                    <div className="da-filter-group">
                        <label>Admin</label>
                        <select value={selectedAdminId ?? ""} onChange={(e) => handleAdminChange(Number(e.target.value))}>
                            {adminList.map((admin) => {
                                const isSelf = Number(admin.id) === getCurrentUserId();
                                return (
                                    <option key={admin.id} value={admin.id}>
                                        {isSelf ? "Me (Self)" : admin.name}
                                    </option>
                                );
                            })}
                        </select>
                    </div>
                )}

                <div className="da-filter-group">
                    <label>Location</label>
                    <select value={tempSelectedLocation ? (tempSelectedLocation.type === 'all' ? "all" : `${tempSelectedLocation.type}-${tempSelectedLocation.id}`) : "all"}
                        onChange={(e) => {
                            const val = e.target.value;
                            if (val === "all") {
                                setTempSelectedLocation({ type: 'all', id: 0 });
                            } else if (val !== "separator") {
                                const [type, id] = val.split('-');
                                setTempSelectedLocation({ type, id: Number(id) });
                            }
                        }}
                    >
                        {locationList.length !== 1 && (
                            <option value="all">All Locations</option>
                        )}

                        {locationList.filter(item => item.type === 'location').map((loc) => (
                            <option key={`loc-${loc.location_id}`} value={`location-${loc.location_id}`}>
                                {loc.location_name}
                            </option>
                        ))}

                        {locationList.filter(item => item.type === 'group').length > 0 && (
                            <option disabled value="separator" style={{ color: "#94a3b8", fontSize: "12px", fontWeight: "bold" }}>
                                ────────────────
                            </option>
                        )}

                        {locationList.filter(item => item.type === 'group').map((group) => (
                            <option key={`group-${group.group_id}`} value={`group-${group.group_id}`}>
                                {group.group_name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="da-filter-group" style={{ minWidth: "280px" }}>
                    <label>Date Range (Within One Month)</label>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <input type="date" min={minDate} max={maxDate}
                            value={`${tempYear}-${pad(tempMonth)}-${pad(tempDayFrom)}`}
                            style={{ flex: 1, padding: "6px 8px", fontSize: "13px" }}
                            onChange={(e) => {
                                if (!e.target.value) return;
                                const [y, m, d] = e.target.value.split("-").map(Number);
                                const sameMonth = y === tempYear && m === tempMonth;
                                setTempYear(y);
                                setTempMonth(m);
                                setTempDayFrom(d);
                                // if the month changed or "to" is now before "from", reset "to"
                                if (!sameMonth || tempDayTo < d) setTempDayTo(d);
                            }}
                        />
                        <span style={{ color: "#64748b", fontSize: "13px", fontWeight: "bold" }}>to</span>
                        <input type="date"
                            min={`${tempYear}-${pad(tempMonth)}-${pad(tempDayFrom)}`}
                            max={maxToDateValue}
                            value={`${tempYear}-${pad(tempMonth)}-${pad(tempDayTo)}`}
                            style={{ flex: 1, padding: "6px 8px", fontSize: "13px" }}
                            onChange={(e) => {
                                if (!e.target.value) return;
                                const [y, m, d] = e.target.value.split("-").map(Number);
                                if (y !== tempYear || m !== tempMonth) {
                                    showToast("Date range must be within the same month.", "error");
                                    return;
                                }
                                setTempDayTo(d);
                            }}
                        />
                    </div>
                </div>

                <div className="da-filter-group">
                    <label>&nbsp;</label>
                    <button className="da-btn da-btn-sm" style={{ background: "#e2e8f0", color: "#475569" }} onClick={() => {
                        setTempDayFrom(1);
                        setTempDayTo(tempMaxDays); // uses the temp month, not the applied one
                    }}>
                        📅 Full Month
                    </button>
                </div>

                <div className="da-filter-actions">
                    <button className="da-btn da-btn-primary" disabled={loading} onClick={applyFilters}>
                        {loading ? "⏳ Loading..." : "🔍 Apply Filter"}
                    </button>

                    <button className="da-btn da-btn-warning" disabled={locationId === null || locationId === 0}
                        onClick={() => {
                            if (selectedLocation && (selectedLocation.type === 'all' || selectedLocation.type === 'group')) {
                                showToast("Please select a single location in the filter.", "error");
                                return;
                            }
                            const initialData = JSON.parse(JSON.stringify(desigStdHcMap));

                            Object.keys(initialData).forEach((deptId) => {
                                Object.keys(initialData[deptId]).forEach((desigId) => {
                                    if (
                                        initialData[deptId][desigId] === 0 ||
                                        initialData[deptId][desigId] === "0"
                                    ) {
                                        initialData[deptId][desigId] = null;
                                    }
                                });
                            });

                            setEditDesigHc(initialData);
                            setShowDesigSettings(true);
                        }}
                    >
                        ⚙️ Designation STD HC
                    </button>

                    <button className="da-btn da-btn-warning" disabled={locationId === null || locationId === 0}
                        onClick={() => {
                            if (selectedLocation && (selectedLocation.type === 'all' || selectedLocation.type === 'group')) {
                                showToast("Please select a single location in the filter.", "error");
                                return;
                            }
                            setEditMachineStd(machineStd);
                            setShowMachineStdSettings(true);
                        }}
                    >
                        ⚙️ Total Machines
                    </button>

                    <button className="da-btn da-btn-warning" disabled={locationId === null || locationId === 0}
                        onClick={() => {
                            if (selectedLocation && (selectedLocation.type === 'all' || selectedLocation.type === 'group')) {
                                showToast("Please select a single location in the filter.", "error");
                                return;
                            }
                            const initial = {};
                            for (let d = clampedFrom; d <= clampedTo; d++) {
                                const ds = dateStr(year, month, d);
                                initial[ds] = dailyMachines[ds] ?? 0;
                            }
                            setEditDailyMachines(initial);
                            setShowDailyMachineSettings(true);
                        }}
                    >
                        ⚙️ Daily Running Machines
                    </button>

                    <button className="da-btn da-btn-success" onClick={exportExcel}>
                        ⬇ Excel
                    </button>

                    <button className="da-btn da-btn-sm" style={{ background: "#475569", color: "#fff" }} onClick={() => window.print()}>
                        🖨 Print
                    </button>
                </div>
            </div>

            <div className="da-report-container">
                {loading ? (
                    <div className="da-loading">
                        <div className="da-spinner" />
                        <p>Generating report…</p>
                    </div>
                ) : reportData ? (
                    <ReportTable
                        data={reportData}
                        days={days}
                        unitName={unitName}
                        unitCapacity={unitCapacity}
                        loginName={loginName}
                        month={month}
                        year={year}
                        runningMachinesLabel={runningMachinesLabel}
                        labourPerMachineLabel={labourPerMachineLabel}
                        machineUnitSuffix={machineUnitSuffix}
                        expandedDept={expandedDept}
                        onToggleDept={(id) => setExpandedDept((prev) => (prev === id ? null : id))}
                        expandedDesig={expandedDesig}
                        onToggleDesig={(key) => setExpandedDesig((prev) => (prev === key ? null : key))}
                        expandedSummary={expandedSummary}
                        onToggleSummary={(id) => setExpandedSummary((prev) => (prev === id ? null : id))}
                        onViewStatus={(statusKey, statusLabel, date, employees) => {
                            setStatusDetail({
                                statusKey,
                                statusLabel,
                                date,
                                employees
                            });
                        }}
                        onViewAttendance={(statusKey, statusLabel, day, date, employees) => {
                            setAttendanceDetail({ statusKey, statusLabel, day, date, employees });
                        }}
                    />
                ) : (
                    <div className="da-loading">
                        <p>No data available.</p>
                    </div>
                )}
                {attendanceDetail && (
                    <AttendanceEmployeeReport
                        statusLabel={attendanceDetail.statusLabel}
                        date={attendanceDetail.date}
                        employees={attendanceDetail.employees}
                        onClose={() => setAttendanceDetail(null)}
                    />
                )}

                {!loading && reportData && (
                    <StatusSummary
                        summary={reportData.summary || {}}
                        summaryEmployees={reportData.summary_employees || {}}
                        days={days}
                        month={month}
                        year={year}
                        onView={(statusKey, statusLabel, date, employees) => {
                            setStatusDetail({ statusKey, statusLabel, date, employees });
                        }}
                    />
                )}
            </div>

            {showDesigSettings && (
                <DesigSettingsModal
                    deptList={deptList}
                    editDesigHc={editDesigHc}
                    setEditDesigHc={setEditDesigHc}
                    desigList={desigList}
                    saving={savingDesigStdHc}
                    onSave={async () => {
                        const ok = await saveDesigStdHc();
                        if (ok) {
                            setShowDesigSettings(false);
                            showToast("Designation STD HC saved successfully!", "success");
                        }
                    }}
                    onClose={() => setShowDesigSettings(false)}
                />
            )}

            {showMachineStdSettings && (
                <MachineStdModal value={editMachineStd} setValue={setEditMachineStd}
                    onSave={async () => {
                        const ok = await saveMachineStd();
                        if (ok) {
                            setShowMachineStdSettings(false);
                            showToast("Total machines saved successfully!", "success");
                        }
                    }}
                    onClose={() => setShowMachineStdSettings(false)}
                />
            )}

            {showDailyMachineSettings && (
                <DailyMachineModal year={year} month={month} days={days} editDailyMachines={editDailyMachines} setEditDailyMachines={setEditDailyMachines}
                    onSave={async () => {
                        const ok = await saveDailyMachines();
                        if (ok) {
                            setShowDailyMachineSettings(false);
                            showToast("Daily running machine counts saved successfully!", "success");
                        }
                    }}
                    onClose={() => setShowDailyMachineSettings(false)}
                />
            )}

            {statusDetail && (
                <StatusEmployeeModal statusLabel={statusDetail.statusLabel} date={statusDetail.date} employees={statusDetail.employees} onClose={() => setStatusDetail(null)} />
            )}
        </div>
    );
}


function DeptSummaryRows({ summary, days }) {
    const rows = [
        { key: "total_present", label: "Total Present", cls: "da-dsum-present" },
        { key: "total_half_present", label: "Total Half Present", cls: "da-dsum-half" },
        { key: "total_wo_present", label: "Total Weekly-Off Present", cls: "da-dsum-wop" },
        { key: "total_wo_half_present", label: "Total Weekly-Off Half Present", cls: "da-dsum-wohp" },
        { key: "total_single_punch", label: "Total Single Punches", cls: "da-dsum-single-punch" },
        { key: "total_weekly_off", label: "Total Weekly Off", cls: "da-dsum-wo" },
        { key: "total_absent", label: "Total Absent", cls: "da-dsum-absent" },
    ];

    return (
        <>
            {rows.map((row) => (
                <tr key={row.key} className={`da-dept-summary-row ${row.cls}`}>
                    <td className="da-dept-summary-label">{row.label}</td>
                    <td>–</td>
                    {days.map((d) => {
                        const val = summary[row.key] && summary[row.key][d] !== undefined ? summary[row.key][d] : "";
                        return (
                            <td key={d} className={val === 0 || val === "" ? "da-empty" : ""}>
                                {val === 0 ? "" : val}
                            </td>
                        );
                    })}
                    <td>–</td>
                </tr>
            ))}
        </>
    );
}


function ReportTable({ data, days, unitName, unitCapacity, loginName, month, year, runningMachinesLabel, labourPerMachineLabel, machineUnitSuffix, expandedDept, onToggleDept, expandedDesig, onToggleDesig, expandedSummary, onToggleSummary, onViewAttendance }) {
    if (!data || !data.departments) return null;
    const departments = data.departments || [];
    const summary = data.summary || {};
    const summary_avg = data.summary_avg || {};
    const summary_employees = data.summary_employees || {};
    const total_std_hc = data.total_std_hc || 0;
    const total_running_machines = data.total_running_machines || 0;
    const colSpan = days.length + 3;
    const totalMachinesNum = Number(total_running_machines) || 0;
    const stdLabourPerMachine = (totalLabour) =>
        totalMachinesNum > 0 ? (Number(totalLabour) / totalMachinesNum).toFixed(1) : "";

    // ---- Department Group totals (dynamic, driven by groupId/groupName from API) ----
    const groupDeptMap = {};     // groupId -> { name, sortOrder, firstIndex, depts: [] }

    departments.forEach((dept, i) => {
        if (dept.groupId === null || dept.groupId === undefined) return;
        const gid = String(dept.groupId);
        if (!groupDeptMap[gid]) {
            groupDeptMap[gid] = {
                name: dept.groupName,
                sortOrder: Number(dept.groupSortOrder) || 0,
                firstIndex: i,
                depts: []
            };
        }
        groupDeptMap[gid].depts.push(dept);
    });

    const orderedDepartments = Object.values(groupDeptMap)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.firstIndex - b.firstIndex)
        .flatMap((group) => group.depts.map((dept, i) => ({
            dept,
            isGroupLast: i === group.depts.length - 1
        })))
        .concat(
            departments
                .filter((dept) => dept.groupId === null || dept.groupId === undefined)
                .map((dept) => ({ dept, isGroupLast: false }))
        );

    function getGroupTotals(gid) {
        const group = groupDeptMap[gid];
        const std = group.depts.reduce((sum, dept) => sum + (Number(dept.std_hc) || 0), 0);
        const avg = group.depts.reduce((sum, dept) => sum + (Number(dept.avg_hc) || 0), 0);
        const dayTotals = {};
        const groupLaborPerMachine = {};
        const machinesArray = {};

        days.forEach((d) => {
            const dayPresentTotal = group.depts.reduce((sum, dept) => sum + (Number(dept.days && dept.days[d]) || 0), 0);
            dayTotals[d] = dayPresentTotal;

            const machines = Number(summary.running_machines?.[d]) || 0;
            machinesArray[d] = summary.running_machines?.[d] || "";
            groupLaborPerMachine[d] = machines > 0 ? (dayPresentTotal / machines).toFixed(1) : 0;
        });

        return { name: group.name, std, avg, dayTotals, groupLaborPerMachine, machinesArray };
    }

    function makeDayClickHandler(statusKey, statusLabel) {
        return (key, day, count) => {
            const employees = summary_employees?.[day]?.[statusKey] || [];
            const dateLabel = `${String(day).padStart(2, "0")} ${MONTH_NAMES[month - 1]} ${year}`;
            onViewAttendance(statusKey, statusLabel, day, dateLabel, employees);
        };
    }

    return (
        <div className="da-report-card">
            <div className="da-report-title">
                {loginName} Unit Per Day Actual Head Count (HC) Report {MONTH_NAMES[month - 1]} {year}
            </div>
            <div className="da-table-scroll">
                <table className="da-table" id="da-report-table">
                    <thead>
                        <tr>
                            <th>Department</th>
                            <th>
                                STD
                                <br />({total_running_machines} {machineUnitSuffix})
                            </th>
                            {days.map((d) => (
                                <th key={d}>{d}</th>
                            ))}
                            <th>
                                Avg.
                                <br />
                                HC
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {orderedDepartments.map(({ dept, isGroupLast }, i) => (
                            <React.Fragment key={dept.departmentId ?? i}>
                                <tr
                                    onClick={() => dept.designations && dept.designations.length > 0 && onToggleDept(dept.departmentId)}
                                    style={{
                                        cursor: dept.designations && dept.designations.length > 0 ? "pointer" : "default",
                                        borderTop: (i === 0 || orderedDepartments[i - 1]?.dept.groupId !== dept.groupId) && dept.groupId ? "2.5px solid #1e40af" : "none"
                                    }}
                                    className={`da-dept-row ${expandedDept === dept.departmentId ? "da-dept-row-open" : ""}`}
                                >
                                    <td>{dept.department}</td>
                                    <td>{dept.std_hc}</td>
                                    {days.map((d) => {
                                        const val = dept.days && dept.days[d] !== undefined ? dept.days[d] : "";
                                        return (
                                            <td key={d} className={val === 0 || val === "" ? "da-empty" : ""}>
                                                {val === 0 ? "" : val}
                                            </td>
                                        );
                                    })}
                                    <td>{dept.avg_hc}</td>
                                </tr>

                                {expandedDept === dept.departmentId && (dept.designations || []).map((desig, j) => {
                                    const desigKey = `${dept.departmentId}-${desig.designationId}`;
                                    const hasEmployees = desig.employees && desig.employees.length > 0;
                                    return (
                                        <React.Fragment key={desigKey}>
                                            <tr className="da-designation-row" onClick={() => hasEmployees && onToggleDesig(desigKey)} style={{ cursor: hasEmployees ? "pointer" : "default" }}>
                                                <td className="da-designation-cell">{desig.designationName}</td>
                                                <td>{desig.std_hc ?? 0}</td>
                                                {days.map((d) => {
                                                    const val = desig.days && desig.days[d] !== undefined ? desig.days[d] : "";
                                                    return (
                                                        <td key={d} className={val === 0 || val === "" ? "da-empty" : ""}>
                                                            {val === 0 ? "" : val}
                                                        </td>
                                                    );
                                                })}
                                                <td>{desig.avg_hc}</td>
                                            </tr>

                                            {expandedDesig === desigKey &&
                                                desig.employees.map((emp) => (
                                                    <tr key={emp.employeeId} className="da-employee-row">
                                                        <td className="da-employee-cell">
                                                            {emp.employeeName} <span className="da-emp-code">({emp.employeeCode})</span>
                                                        </td>
                                                        <td>–</td>
                                                        {days.map((d) => {
                                                            const status = emp.days && emp.days[d];
                                                            return (
                                                                <td key={d} className={status ? `da-emp-status da-status-${status.toLowerCase()}` : "da-empty"}>
                                                                    {status || ""}
                                                                </td>
                                                            );
                                                        })}
                                                        <td>–</td>
                                                    </tr>
                                                ))}
                                        </React.Fragment>
                                    );
                                })}

                                {expandedDept === dept.departmentId && dept.summary && (
                                    <>
                                        <tr className="da-summary-toggle-row" onClick={() => onToggleSummary(dept.departmentId)}>
                                            <td colSpan={colSpan}>
                                                {expandedSummary === dept.departmentId ? "▲ Hide Summary" : "▼ Show Summary"}
                                            </td>
                                        </tr>
                                        {expandedSummary === dept.departmentId && (
                                            <DeptSummaryRows summary={dept.summary} days={days} />
                                        )}
                                    </>
                                )}

                                {isGroupLast && (() => {
                                    const g = getGroupTotals(String(dept.groupId));
                                    return (
                                        <>
                                            <tr className="da-group-total-row" style={{ backgroundColor: "#f8fafc", borderTop: "2.5px solid #1e40af" }}>
                                                <td className="da-group-total-label" style={{ color: "#334155", fontWeight: "bold", paddingLeft: "16px" }}>
                                                    Total Present
                                                </td>
                                                <td style={{ fontWeight: "bold", color: "#334155" }}>
                                                    {g.std}
                                                </td>
                                                {days.map((d) => {
                                                    const val = g.dayTotals[d];
                                                    return (
                                                        <td key={d} style={{ fontWeight: "bold", color: "#334155" }}>
                                                            {val || ""}
                                                        </td>
                                                    );
                                                })}
                                                <td style={{ fontWeight: "bold", color: "#334155" }}>{g.avg}</td>
                                            </tr>

                                            {/* Group Running Machines Row */}
                                            <tr className="da-group-total-row" style={{ backgroundColor: "#f8fafc", borderTop: "1px solid #e2e8f0" }}>
                                                <td className="da-group-total-label" style={{ color: "#475569", fontSize: "11px", paddingLeft: "16px" }}>
                                                    {runningMachinesLabel}
                                                </td>
                                                <td>{total_running_machines}</td>
                                                {days.map((d) => {
                                                    const val = g.machinesArray[d];
                                                    return (
                                                        <td key={d} style={{ color: "#475569", fontSize: "11px" }}>
                                                            {val || ""}
                                                        </td>
                                                    );
                                                })}
                                                <td>–</td>
                                            </tr>

                                            <tr className="da-group-total-row" style={{ backgroundColor: "#f8fafc", borderBottom: "2.5px solid #1e40af" }}>
                                                <td className="da-group-total-label" style={{ color: "#475569", fontSize: "11px", paddingLeft: "16px" }}>
                                                    {labourPerMachineLabel}
                                                </td>
                                                <td>{stdLabourPerMachine(g.std)}</td>
                                                {days.map((d) => {
                                                    const val = g.groupLaborPerMachine[d];
                                                    return (
                                                        <td key={d} style={{ color: "#475569", fontSize: "11px" }}>
                                                            {val || ""}
                                                        </td>
                                                    );
                                                })}
                                                <td>–</td>
                                            </tr>
                                        </>
                                    );
                                })()}
                            </React.Fragment>
                        ))}
                    </tbody>
                    <tfoot>
                        <SummaryRow label="Overall Present" stdValue={total_std_hc} dayValues={summary.total_present} avgValue={summary_avg.total_present} days={days} className="da-row-combined da-row-grand-total" />
                        <SummaryRow label={runningMachinesLabel} stdValue={total_running_machines} dayValues={summary.running_machines} avgValue={summary_avg.running_machines} days={days} className="da-row-heading" />
                        <SummaryRow label={labourPerMachineLabel} stdValue={stdLabourPerMachine(total_std_hc)} dayValues={summary.labor_per_machine} avgValue={summary_avg.labor_per_machine} days={days} className="da-row-heading da-row-labor-border" />
                        <SummaryRow label="Total Present" statusKey="present" stdValue="" dayValues={summary.present} avgValue={summary_avg.present} days={days} className="da-row-total" onDayClick={makeDayClickHandler("present", "Total Present")} />
                        <SummaryRow label="Total Half Present" statusKey="half_present" stdValue="" dayValues={summary.half_present} avgValue={summary_avg.half_present} days={days} className="da-row-heading" onDayClick={makeDayClickHandler("half_present", "Total Half Present")} />
                        <SummaryRow label="Total Weekly-Off Present" statusKey="wo_present" stdValue="" dayValues={summary.wo_present} avgValue={summary_avg.wo_present} days={days} className="da-row-heading" onDayClick={makeDayClickHandler("wo_present", "Total Weekly-Off Present")} />
                        <SummaryRow label="Total Weekly-Off Half Present" statusKey="wo_half_present" stdValue="" dayValues={summary.wo_half_present} avgValue={summary_avg.wo_half_present} days={days} className="da-row-heading" onDayClick={makeDayClickHandler("wo_half_present", "Total Weekly-Off Half Present")} />
                        <SummaryRow label="Total Single Punches" statusKey="single_punch" stdValue="" dayValues={summary.single_punch} avgValue={summary_avg.single_punch} days={days} className="da-row-heading" onDayClick={makeDayClickHandler("single_punch", "Total Single Punches")} />
                        <SummaryRow label="Total Weekly Off" statusKey="weekly_off" stdValue="" dayValues={summary.weekly_off} avgValue={summary_avg.weekly_off} days={days} className="da-row-heading" onDayClick={makeDayClickHandler("weekly_off", "Total Weekly Off")} />
                        <SummaryRow label="Total Absent" statusKey="absent" stdValue="" dayValues={summary.total_absent} avgValue={summary_avg.total_absent} days={days} className="da-row-absent-total" onDayClick={makeDayClickHandler("absent", "Total Absent")} />
                        <SummaryRow label="Over-Time Paid" statusKey="overtime_paid" stdValue="" dayValues={summary.overtime_paid} avgValue={summary_avg.overtime_paid} days={days} className="da-row-ot da-row-separator" onDayClick={makeDayClickHandler("overtime_paid", "Over-Time Paid")} />
                        <SummaryRow label="On Leave" statusKey="on_leave" stdValue="" dayValues={summary.on_leave} avgValue={summary_avg.on_leave} days={days} className="da-row-leave" onDayClick={makeDayClickHandler("on_leave", "On Leave")} />
                        <SummaryRow label="Total New Joinee" statusKey="new_joinee" stdValue="" dayValues={summary.new_joinee} avgValue={summary_avg.new_joinee} days={days} className="da-row-joinee" onDayClick={makeDayClickHandler("new_joinee", "Total New Joinee")} />
                        <SummaryRow label="Total Resigned" statusKey="left" stdValue="" dayValues={summary.left} avgValue={summary_avg.left} days={days} className="da-row-left" onDayClick={makeDayClickHandler("left", "Total Resigned")} />
                        <SummaryRow label="Recruited Head Count" stdValue="" dayValues={summary.recruited_hc} avgValue={summary_avg.recruited_hc} days={days} className="da-row-recruited" />
                    </tfoot>
                </table>
            </div>
        </div>
    );
}


function StatusSummary({ summary, summaryEmployees, days, month, year, onView }) {
    const PAGE_SIZE = 5;
    const [currentPages, setCurrentPages] = useState({
        overtime_paid: 1,
        new_joinee: 1,
        left: 1
    });

    const statusRows = [
        {
            key: "overtime_paid",
            label: "Over-Time Paid",
            icon: "⏱️"
        },
        {
            key: "new_joinee",
            label: "New Joinee",
            icon: "👤"
        },
        {
            key: "left",
            label: "Resigned",
            icon: "👤"
        }
    ];

    function formatDate(day) {
        return `${String(day).padStart(2, "0")} ${MONTH_NAMES[month - 1]} ${year}`;
    }

    function changePage(statusKey, page, totalPages) {
        const safePage = Math.max(1, Math.min(page, totalPages));
        setCurrentPages((prev) => ({
            ...prev,
            [statusKey]: safePage
        }));
    }

    return (
        <div className="da-status-summary-card">
            <div className="da-status-summary-header">
                <div>
                    <h3>Employee Status Summary</h3>
                    <p>Click the eye button to view employees for that date.</p>
                </div>
            </div>

            <div className="da-status-summary-grid">
                {statusRows.map((status) => {
                    const statusValues = summary[status.key] || {};
                    const dateRows = days.map((day) => ({ day, count: Number(statusValues[day] || 0) })).filter((row) => row.count > 0);
                    const totalRecords = dateRows.length;
                    const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));
                    const requestedPage = currentPages[status.key] || 1;
                    const currentPage = Math.min(requestedPage, totalPages);
                    const startIndex = (currentPage - 1) * PAGE_SIZE;
                    const paginatedRows = dateRows.slice(startIndex, startIndex + PAGE_SIZE);

                    return (
                        <div key={status.key} className="da-status-summary-box">
                            <div className="da-status-summary-box-header">
                                <span>
                                    {status.icon}{" "}
                                    {status.label}
                                </span>

                                {totalRecords > 0 && (
                                    <span className="da-status-record-count">{totalRecords} records</span>
                                )}
                            </div>

                            {totalRecords === 0 ? (
                                <div className="da-status-summary-empty">
                                    No records found.
                                </div>
                            ) : (
                                <>
                                    <div className="da-status-summary-table-wrap">
                                        <table className="da-status-summary-table">
                                            <colgroup>
                                                <col className="da-status-col-date" />
                                                <col className="da-status-col-count" />
                                                <col className="da-status-col-view" />
                                            </colgroup>

                                            <thead>
                                                <tr>
                                                    <th>Date</th>
                                                    <th>Count</th>
                                                    <th>View</th>
                                                </tr>
                                            </thead>

                                            <tbody>
                                                {paginatedRows.map(
                                                    ({ day, count }) => {
                                                        const employees = summaryEmployees?.[day]?.[status.key] || [];
                                                        return (
                                                            <tr key={day}>
                                                                <td>{formatDate(day)}</td>
                                                                <td className="da-status-count">{count}</td>
                                                                <td>
                                                                    <button type="button" className="da-view-btn" title={`View ${status.label} employees`} onClick={() => onView(status.key, status.label, formatDate(day), employees)}>
                                                                        👁️
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    }
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    {totalPages > 1 && (
                                        <div className="da-status-pagination">
                                            <button type="button" className="da-page-btn" disabled={currentPage === 1} onClick={() => changePage(status.key, 1, totalPages)} title="First page">
                                                &lt;&lt;
                                            </button>

                                            <button type="button" className="da-page-btn" disabled={currentPage === 1} onClick={() => changePage(status.key, currentPage - 1, totalPages)} title="Previous page">
                                                &lt;
                                            </button>

                                            {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                                                <button key={page} type="button" className={`da-page-btn ${currentPage === page ? "da-page-btn-active" : ""}`} onClick={() => changePage(status.key, page, totalPages)}>
                                                    {page}
                                                </button>
                                            ))}

                                            <button type="button" className="da-page-btn" disabled={currentPage === totalPages} onClick={() => changePage(status.key, currentPage + 1, totalPages)} title="Next page">
                                                &gt;
                                            </button>

                                            <button type="button" className="da-page-btn" disabled={currentPage === totalPages} onClick={() => changePage(status.key, totalPages, totalPages)} title="Last page">
                                                &gt;&gt;
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}


function AttendanceEmployeeReport({ statusLabel, date, employees, onClose }) {
    const [employeeNameSearch, setEmployeeNameSearch] = useState("");
    const [employeeCodeSearch, setEmployeeCodeSearch] = useState("");
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;

    const employeeList = employees || [];

    const filtered = employeeList.filter((emp) => {
        const nameQuery = employeeNameSearch.trim().toLowerCase();
        const codeQuery = employeeCodeSearch.trim().toLowerCase();
        const matchesName = !nameQuery || (emp.employeeName || "").toLowerCase().includes(nameQuery);
        const matchesCode = !codeQuery || (emp.employeeCode || "").toLowerCase().includes(codeQuery);
        return matchesName && matchesCode;
    });

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const paginated = filtered.slice(startIndex, startIndex + PAGE_SIZE);
    const showingFrom = filtered.length === 0 ? 0 : startIndex + 1;
    const showingTo = Math.min(startIndex + PAGE_SIZE, filtered.length);

    const pageNumbers = [];
    if (totalPages <= 3) {
        for (let i = 1; i <= totalPages; i++) {
            pageNumbers.push(i);
        }
    } else {
        if (currentPage <= 2) {
            pageNumbers.push(1, 2, 3);
        } else if (currentPage >= totalPages - 1) {
            pageNumbers.push(totalPages - 2, totalPages - 1, totalPages);
        } else {
            pageNumbers.push(currentPage - 1, currentPage, currentPage + 1);
        }
    }

    function exportEmployeesExcel() {
        const table = document.getElementById("da-attendance-employee-table");
        if (!table) return;
        const html = `<html><head><meta charset="utf-8"></head><body>${table.outerHTML}</body></html>`;
        const blob = new Blob([html], { type: "application/vnd.ms-excel" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${statusLabel}_${date}.xls`.replace(/\s+/g, "_");
        a.click();
        URL.revokeObjectURL(url);
    }

    return (
        <div className="da-attendance-report-card">
            <div className="da-attendance-report-header">
                <div>
                    <h3>{statusLabel} Employees</h3>
                    <p className="da-attendance-report-meta">{date} <span>(Total Employees: {employeeList.length})</span></p>
                </div>

                <button className="da-modal-close" onClick={onClose}>
                    ✕
                </button>
            </div>

            <div className="da-attendance-report-toolbar">
                <div className="da-attendance-report-actions">
                    <div className="da-attendance-search-group">
                        <label htmlFor="employee-name-search">Employee Name:</label>
                        <input id="employee-name-search" type="text" placeholder="Search employee name..." value={employeeNameSearch}
                            onChange={(e) => {
                                setEmployeeNameSearch(e.target.value);
                                setPage(1);
                            }} className="da-attendance-search-input"
                        />
                    </div>

                    <div className="da-attendance-search-group">
                        <label htmlFor="employee-code-search">Employee Code:</label>
                        <input id="employee-code-search" type="text" placeholder="Search employee code..." value={employeeCodeSearch}
                            onChange={(e) => {
                                setEmployeeCodeSearch(e.target.value);
                                setPage(1);
                            }} className="da-attendance-search-input"
                        />
                    </div>

                </div>
            </div>

            {employeeList.length === 0 ? (
                <div className="da-status-modal-empty">No employees found for this selection.</div>
            ) : (
                <>
                    <div className="da-attendance-table-wrap">
                        <table className="da-status-employee-table" id="da-attendance-employee-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Employee Code</th>
                                    <th>Employee Name</th>
                                    <th>Company</th>
                                    <th>Department</th>
                                    <th>Designation</th>
                                    <th>Location</th>
                                    <th>Shift</th>
                                    <th>Shift Start Time</th>
                                    <th>Shift End Time</th>
                                    <th>In Time</th>
                                    <th>Out Time</th>
                                    <th>Status</th>
                                    <th>Detail Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginated.map((emp, index) => (
                                    <tr key={emp.employeeId ?? emp.employeeCode ?? index}>
                                        <td>{startIndex + index + 1}</td>
                                        <td>{emp.employeeCode || "–"}</td>
                                        <td className="da-modal-employee-name">{emp.employeeName || "–"}</td>
                                        <td>{emp.companyName || "–"}</td>
                                        <td>{emp.departmentName || "–"}</td>
                                        <td>{emp.designationName || "–"}</td>
                                        <td>{emp.locationName || "–"}</td>
                                        <td>{emp.shift || "–"}</td>
                                        <td>{emp.shiftStartTime || "–"}</td>
                                        <td>{emp.shiftEndTime || "–"}</td>
                                        <td>{emp.inTime || "–"}</td>
                                        <td>{emp.outTime || "–"}</td>
                                        <td>{emp.status || statusLabel}</td>
                                        <td>{emp.detailStatus || "–"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="da-attendance-pagination">
                        <div className="da-attendance-pagination-info">
                            Showing data {showingFrom} to {showingTo} of {filtered.length}
                        </div>

                        {totalPages > 1 && (
                            <div className="da-attendance-pagination-buttons">
                                <button type="button" className="da-page-btn" disabled={currentPage === 1} onClick={() => setPage(1)} title="First page">
                                    &lt;&lt;
                                </button>

                                <button type="button" className="da-page-btn" disabled={currentPage === 1} onClick={() => setPage((p) => p - 1)} title="Previous page">
                                    &lt;
                                </button>

                                {pageNumbers.map((p) => (
                                    <button key={p} type="button" className={`da-page-btn ${currentPage === p ? "da-page-btn-active" : ""}`} onClick={() => setPage(p)} >
                                        {p}
                                    </button>
                                ))}

                                <button type="button" className="da-page-btn" disabled={currentPage === totalPages} onClick={() => setPage((p) => p + 1)} title="Next page">
                                    &gt;
                                </button>

                                <button type="button" className="da-page-btn" disabled={currentPage === totalPages} onClick={() => setPage(totalPages)} title="Last page">
                                    &gt;&gt;
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}


function SummaryRow({ label, statusKey, stdValue, dayValues, avgValue, days, className, hideLabel, onDayClick }) {
    return (
        <tr className={className}>
            <td>{hideLabel ? "" : label}</td>
            <td>{stdValue}</td>
            {days.map((d) => {
                const val = dayValues && dayValues[d] !== undefined ? dayValues[d] : "";
                const isEmpty = val === 0 || val === "";
                const clickable = !isEmpty && statusKey && onDayClick;
                return (
                    <td key={d} className={isEmpty ? "da-empty" : ""}>
                        {clickable ? (
                            <span className="da-count-clickable" onClick={() => onDayClick(statusKey, d, val)}>
                                {val}
                            </span>
                        ) : (val === 0 ? "" : val)}
                    </td>
                );
            })}
            <td>{avgValue || 0}</td>
        </tr>
    );
}


function DesigSettingsModal({ deptList, editDesigHc, setEditDesigHc, desigList, saving, onSave, onClose }) {
    // Group designations under their parent department
    const desigByDept = {};
    desigList.forEach((d) => {
        if (!desigByDept[d.dept_id]) desigByDept[d.dept_id] = [];
        desigByDept[d.dept_id].push(d);
    });

    function getDesigTotal(deptId) {
        const map = editDesigHc[deptId] || {};
        return Object.values(map).reduce((a, b) => a + (parseInt(b, 10) || 0), 0);
    }

    // Only departments that actually have designations are relevant here
    const relevantDepts = deptList.filter((dept) => (desigByDept[dept.dept_id] || []).length > 0);

    return (
        <div className="da-modal-overlay"
            onClick={(e) => {
                if (saving) return;
                if (e.target === e.currentTarget) {
                    onClose();
                }
            }}
        >
            <div className="da-modal" style={{ maxWidth: 720 }}>
                <div className="da-modal-header">
                    <h2>⚙️ Designation STD Head Count Settings</h2>
                    <button className="da-modal-close" disabled={saving} onClick={onClose}>
                        ✕
                    </button>
                </div>
                <p style={{ color: "#64748b", fontSize: 13, marginBottom: 16 }}>
                    The Department STD HC is calculated automatically as the sum of all Designation STD HC values for that department.
                </p>

                <div className="da-settings-grouped-wrap" style={{ maxHeight: 480, overflowY: "auto" }}>
                    {relevantDepts.length === 0 && (
                        <p style={{ color: "#94a3b8", fontSize: 13 }}>No designations found for this location.</p>
                    )}

                    {relevantDepts.map((dept) => {
                        const desigs = desigByDept[dept.dept_id] || [];
                        const desigTotal = getDesigTotal(dept.dept_id);

                        return (
                            <div key={dept.dept_id} style={{ border: "1px solid #e2e8f0", borderRadius: 10, marginBottom: 14, overflow: "hidden", }}>
                                {/* Department header — read-only here, just for context */}
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", }}>
                                    <div style={{ fontWeight: 700, fontSize: 14 }}>
                                        {dept.department_name}
                                        <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 8 }}>
                                            (ID: {dept.dept_id})
                                        </span>
                                    </div>
                                    <div style={{ fontSize: 12, color: "#64748b" }}>
                                        Department Total: {getDesigTotal(dept.dept_id)}
                                    </div>
                                </div>

                                <div style={{ padding: "8px 14px 12px 28px" }}>
                                    {desigs.map((d) => (
                                        <div key={d.designation_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", fontSize: 13, }}>
                                            <span>{d.designation_name}</span>
                                            <input type="number" min={0} step={1} inputMode="numeric" placeholder="0" style={{ width: 70, textAlign: "right" }}
                                                value={
                                                    (() => {
                                                        const v = editDesigHc[dept.dept_id]?.[d.designation_id];
                                                        return v === 0 || v == null || v === "" ? "" : v;
                                                    })()
                                                }
                                                onChange={(e) => {
                                                    const raw = e.target.value;
                                                    const val = raw === "" ? "" : Math.max(0, Number(raw) || 0);
                                                    setEditDesigHc((prev) => ({
                                                        ...prev,
                                                        [dept.dept_id]: {
                                                            ...(prev[dept.dept_id] || {}),
                                                            [d.designation_id]: val,
                                                        },
                                                    }));
                                                }}
                                                // onBlur={(e) => {
                                                //     if (e.target.value === "") {
                                                //         setEditDesigHc((prev) => ({
                                                //             ...prev,
                                                //             [dept.dept_id]: {
                                                //                 ...(prev[dept.dept_id] || {}),
                                                //                 [d.designation_id]: 0,
                                                //             },
                                                //         }));
                                                //     }
                                                // }}
                                            />
                                        </div>
                                    ))}

                                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px dashed #e2e8f0", display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, color: "#16a34a" }}>
                                        <span>Department STD HC: {desigTotal}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="da-modal-footer" style={{ marginTop: 16 }}>
                    <button className="da-btn da-btn-sm" disabled={saving} onClick={onClose}>
                        Cancel
                    </button>
                    <button className="da-btn da-btn-sm da-btn-primary" disabled={saving} onClick={onSave}>
                        {saving ? "Saving..." : "💾 Save Changes"}
                    </button>
                </div>
            </div>
        </div>
    );
}


function MachineStdModal({ value, setValue, onSave, onClose }) {
    return (
        <div className="da-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="da-modal" style={{ maxWidth: 360 }}>
                <div className="da-modal-header">
                    <h2>⚙️ Total Machines</h2>
                    <button className="da-modal-close" onClick={onClose}>✕</button>
                </div>
                <p style={{ color: "#64748b", fontSize: 13, marginBottom: 16 }}>
                    Fixed total machine count for this location. Shown in the report header.
                </p>

                <input type="number" min={0} step="0.01" inputMode="decimal" placeholder="0.00" value={value === 0 || value == null || value === "" ? "" : value}
                    onChange={(e) => {
                        const raw = e.target.value;
                        setValue(raw === "" ? "" : raw);
                    }}
                    onBlur={(e) => {
                        const raw = e.target.value;
                        if (raw === "") {
                            setValue(0);
                        } else if (
                            Number.isFinite(Number(raw)) &&
                            Number(raw) >= 0
                        ) {
                            setValue(Number(raw));
                        }
                    }}
                    style={{
                        width: "100%",
                        padding: "8px 10px",
                        fontSize: 14,
                        textAlign: "right"
                    }}
                />

                <div className="da-modal-footer" style={{ marginTop: 16 }}>
                    <button className="da-btn da-btn-sm" style={{ background: "#e2e8f0", color: "#475569" }} onClick={onClose}>
                        Cancel
                    </button>
                    <button className="da-btn da-btn-sm da-btn-primary" onClick={onSave}>
                        💾 Save
                    </button>
                </div>
            </div>
        </div>
    );
}


function DailyMachineModal({ year, month, days, editDailyMachines, setEditDailyMachines, onSave, onClose }) {
    function dateStr(y, m, d) {
        return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }

    const total = Object.values(editDailyMachines).reduce((sum, value) => sum + (Number(value) || 0), 0);

    return (
        <div className="da-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="da-modal" style={{ maxWidth: 480 }}>
                <div className="da-modal-header">
                    <h2>⚙️ Daily Running Machines</h2>
                    <button className="da-modal-close" onClick={onClose}>✕</button>
                </div>
                <p style={{ color: "#64748b", fontSize: 13, marginBottom: 16 }}>
                    Set the actual number of running machines for each day in the selected range.
                </p>
                <div className="da-settings-table-wrap" style={{ maxHeight: 400, overflowY: "auto" }}>
                    <table className="da-settings-table">
                        <thead>
                            <tr>
                                <th style={{ width: "50%" }}>Date</th>
                                <th style={{ width: "50%" }}>Running Machines</th>
                            </tr>
                        </thead>
                        <tbody>
                            {days.map((d) => {
                                const ds = dateStr(year, month, d);
                                return (
                                    <tr key={ds}>
                                        <td style={{ fontWeight: 600 }}>{ds}</td>
                                        <td>
                                            <input type="number" min={0} step="0.01" inputMode="decimal" placeholder="0.00" style={{ textAlign: "right" }}
                                                value={
                                                    (() => {
                                                        const v = editDailyMachines[ds];
                                                        return v === 0 || v == null || v === "" ? "" : v;
                                                    })()
                                                }
                                                onChange={(e) => {
                                                    const raw = e.target.value;
                                                    // IMPORTANT: keep empty as ""
                                                    const val = raw === "" ? "" : Math.max(0, Number(raw) || 0);
                                                    setEditDailyMachines((prev) => ({
                                                        ...prev,
                                                        [ds]: val,
                                                    }));
                                                }}
                                                onBlur={(e) => {
                                                    if (e.target.value === "") {
                                                        setEditDailyMachines((prev) => ({
                                                            ...prev,
                                                            [ds]: 0,
                                                        }));
                                                    }
                                                }}
                                            />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <div className="da-settings-total">
                    <span>Total (sum across days)</span>
                    <span>{total}</span>
                </div>
                <div className="da-modal-footer">
                    <button className="da-btn da-btn-sm" style={{ background: "#e2e8f0", color: "#475569" }} onClick={onClose}>
                        Cancel
                    </button>
                    <button className="da-btn da-btn-sm da-btn-primary" onClick={onSave}>
                        💾 Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
}


function StatusEmployeeModal({ statusLabel, date, employees, onClose }) {
    const employeeList = employees || [];
    return (
        <div className="da-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) { onClose(); } }}>
            <div className="da-status-modal">
                <div className="da-modal-header">
                    <div>
                        <h2>{statusLabel} Employees</h2>
                        <p className="da-status-modal-date">📅 {date}</p>
                    </div>

                    <button className="da-modal-close" onClick={onClose}>
                        ✕
                    </button>
                </div>

                <div className="da-status-modal-summary">
                    {employeeList.length} Employee
                    {employeeList.length !== 1 ? "s" : ""}
                </div>

                {employeeList.length === 0 ? (
                    <div className="da-status-modal-empty">
                        No employees found for this date.
                    </div>
                ) : (
                    <div className="da-status-employee-table-wrap">
                        <table className="da-status-employee-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Employee Code</th>
                                    <th>Employee Name</th>
                                    <th>Department</th>
                                </tr>
                            </thead>

                            <tbody>
                                {employeeList.map((emp, index) => (
                                    <tr key={emp.employeeId ?? emp.employeeCode ?? index}>
                                        <td>{index + 1}</td>
                                        <td>{emp.employeeCode || "–"}</td>
                                        <td className="da-modal-employee-name">{emp.employeeName || "–"}</td>
                                        <td>{emp.departmentName || "–"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="da-modal-footer">
                    <button className="da-btn da-btn-sm" style={{ background: "#e2e8f0", color: "#475569" }} onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}