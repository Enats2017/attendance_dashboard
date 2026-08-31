import React, { useState, useEffect, useCallback } from "react";
import { generateDummyReport, DEFAULT_STD_HC } from "./dummyData";
import "./DeptAttendance.css";

const API_BASE = "/attendance-dashboard/api/index.php";
const DASH_URL = "/attendance-dashboard/index.html";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function DeptAttendance() {
    const [locationId, setLocationId] = useState(null);
    const [locationList, setLocationList] = useState([]);
    const [month, setMonth] = useState(() => new Date().getMonth() + 1);
    const [year, setYear] = useState(() => new Date().getFullYear());
    const [dayFrom, setDayFrom] = useState(1);
    
    const [dayTo, setDayTo] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    });
    
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
        fetchLocations();
    }, []);

    useEffect(() => {
        if (locationId !== null) {
            fetchStdHc();
            fetchDesignationStdHc();
            fetchMachineStd();
        }
    }, [locationId]);

    useEffect(() => {
        if (locationId !== null) {
            loadReport();
            fetchDailyMachines();
        }
    }, [month, year, dayFrom, dayTo, locationId]);

    useEffect(() => {
        const maxDays = new Date(year, month, 0).getDate();
        setDayFrom((prev) => Math.min(prev, maxDays));
        setDayTo((prev) => Math.max(
            Math.min(prev, maxDays),
            Math.min(dayFrom, maxDays)
        ));
    }, [month, year]);

    async function fetchLocations() {
        try {
            const res = await fetch(API_BASE, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "get_locations" }),
            });
            const data = await res.json();
            if (data.success && data.data && data.data.length > 0) {
                setLocationList(data.data);
                setLocationId(0);
            }
        } catch {}
    }

    async function fetchStdHc() {
        try {
            const res = await fetch(API_BASE, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "get_std_hc", location_id: locationId }),
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
                body: JSON.stringify({ action: "get_designation_std_hc", location_id: locationId }),
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
                body: JSON.stringify({ action: "get_machine_std", location_id: locationId }),
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
                body: JSON.stringify({ action: "update_machine_std", location_id: locationId, total_machines: editMachineStd }),
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
        setDailyMachines({});

        try {
            const res = await fetch(API_BASE, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "get_daily_machines",
                    location_id: locationId,
                    date_from: dateStr(year, month, dayFrom),
                    date_to: dateStr(year, month, dayTo),
                }),
            });
            const data = await res.json();
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
                body: JSON.stringify({ action: "bulk_update_daily_machines", location_id: locationId, items }),
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
		setLoading(true);
        // Clear all data belonging to the previous filter selection
        setReportData(null);
        setDailyMachines({});
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
                body: JSON.stringify({ action: "get_report", month, year, day_from: dayFrom, day_to: dayTo, location_id: locationId }),
			});
			
			const data = await res.json();

			if (data.success) {
				setReportData(data);
				setLoading(false);
				return;
			}
			console.error("get_report failed:", data.message, data.errors);
			showToast(data.message || "Failed to load report — showing sample data", "error");
		} catch (err) {
			console.error("get_report request error:", err);
			showToast("Network error — showing sample data", "error");
		}
		
		const dummy = generateDummyReport(month, year, dayFrom, dayTo, stdHcMap);
		setReportData(dummy);
		setLoading(false);
	}

    async function saveDesigStdHc() {
        setSavingDesigStdHc(true);
        const items = [];
        Object.entries(editDesigHc).forEach(([deptId, desigMap]) => {
            Object.entries(desigMap).forEach(([desigId, hc]) => {
                items.push({ dept_id: deptId, designation_id: desigId, location_id: locationId, std_hc: hc });
            });
        });

        if (items.length === 0) {
            showToast("No designation data to save.", "error");
            return false;
        }

        try {
            const res = await fetch(API_BASE, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "bulk_update_designation_std_hc", items }),
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

    function exportExcel() {
        const table = document.getElementById("da-report-table");
        if (!table) return;
        const html = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
                <head>
                    <meta charset="utf-8">
                    <style>
                        td,th{border:1px solid #ccc;padding:4px 8px;font-family:Calibri;font-size:11pt;}
                        th{background:#fbbf24;font-weight:bold;}
                    </style>
                </head>
                <body>
                    ${table.outerHTML}
                </body>
            </html>
        `;
        const blob = new Blob([html], { type: "application/vnd.ms-excel" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Dept_HC_Report_${MONTH_NAMES[month - 1]}_${year}.xls`;
        a.click();
        URL.revokeObjectURL(url);
        showToast("Excel exported!", "success");
    }

    const maxDays = new Date(year, month, 0).getDate();
    const fromDateValue = `${year}-${String(month).padStart(2, "0")}-${String(dayFrom).padStart(2, "0")}`;
    const toDateValue = `${year}-${String(month).padStart(2, "0")}-${String(dayTo).padStart(2, "0")}`;
    const minDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const maxDate = `${year}-${String(month).padStart(2, "0")}-${String(maxDays).padStart(2, "0")}`;


    const days = [];
    const clampedFrom = Math.max(1, Math.min(dayFrom, maxDays));
    const clampedTo = Math.max(clampedFrom, Math.min(dayTo, maxDays));
    for (let d = clampedFrom; d <= clampedTo; d++) days.push(d);

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
                <div className="da-filter-group">
                    <label>Location</label>
                    <select value={locationId ?? ""} onChange={(e) => setLocationId(Number(e.target.value))}>
                        <option value={0}>All Locations</option>
                        {locationList.map((loc) => (
                            <option key={loc.location_id} value={loc.location_id}>
                                {loc.location_name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="da-filter-group">
                    <label>Month</label>
                    <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                        {MONTH_NAMES.map((m, i) => (
                            <option key={i} value={i + 1}>
                                {m}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="da-filter-group">
                    <label>Year</label>
                    <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
                        {[2024, 2025, 2026, 2027, 2028].map((y) => (
                            <option key={y} value={y}>
                                {y}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="da-filter-group">
                    <label>Day From</label>
                    <input type="date" min={minDate} max={toDateValue} value={fromDateValue}
                        onChange={(e) => {
                            if (!e.target.value) return;
                            const selectedDay = Number(e.target.value.split("-")[2]);
                            setDayFrom(selectedDay);
                        }}
                    />
                </div>
                <div className="da-filter-group">
                    <label>Day To</label>
                    <input type="date" min={fromDateValue} max={maxDate} value={toDateValue}
                        onChange={(e) => {
                            if (!e.target.value) return;
                            const selectedDay = Number(e.target.value.split("-")[2]);
                            setDayTo(selectedDay);
                        }}
                    />
                </div>
                <div className="da-filter-group">
                    <label>&nbsp;</label>
                    <button className="da-btn da-btn-sm" style={{ background: "#e2e8f0", color: "#475569" }} onClick={() => { setDayFrom(1); setDayTo(maxDays); }}>
                        📅 Full Month
                    </button>
                </div>
                <div className="da-filter-actions">
                    <button className="da-btn da-btn-primary" disabled={loading} onClick={loadReport}>
                        {loading ? "⏳ Loading..." : "🔍 Generate"}
                    </button>
                    <button className="da-btn da-btn-warning" disabled={locationId === null} onClick={() => { setEditDesigHc(JSON.parse(JSON.stringify(desigStdHcMap))); setShowDesigSettings(true); }}>
                        ⚙️ Designation STD HC
                    </button>
                    <button className="da-btn da-btn-warning" disabled={locationId === null} onClick={() => { setEditMachineStd(machineStd); setShowMachineStdSettings(true); }}>
                        ⚙️ Total Machines
                    </button>
                    <button className="da-btn da-btn-warning" disabled={locationId === null}
                        onClick={() => {
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

function ReportTable({ data, days, unitName, unitCapacity, loginName, month, year, expandedDept, onToggleDept, expandedDesig, onToggleDesig, expandedSummary, onToggleSummary, onViewAttendance }) {
    if (!data || !data.departments) return null;
    const departments = data.departments || [];
    const summary = data.summary || {};
    const summary_avg = data.summary_avg || {};
    const summary_employees = data.summary_employees || {};
    const total_std_hc = data.total_std_hc || 0;
    const total_running_machines = data.total_running_machines || 0;   
    const colSpan = days.length + 3;

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
                                <br />({total_running_machines} M/C's)
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
                        {departments.map((dept, i) => (
                            <React.Fragment key={dept.departmentId ?? i}>
                                <tr
                                    onClick={() => dept.designations && dept.designations.length > 0 && onToggleDept(dept.departmentId)}
                                    style={{ cursor: dept.designations && dept.designations.length > 0 ? "pointer" : "default" }}
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
                            </React.Fragment>
                        ))}
                    </tbody>
                    <tfoot>
                        <SummaryRow label="Total Present" stdValue={total_std_hc} dayValues={summary.total_present} avgValue={summary_avg.total_present} days={days} className="da-row-combined" />
                        <SummaryRow label="No. of Running Machines" stdValue="" dayValues={summary.running_machines} avgValue={summary_avg.running_machines} days={days} className="da-row-heading" />
                        <SummaryRow label="Labor Per Machine Per Day" stdValue="" dayValues={summary.labor_per_machine} avgValue={summary_avg.labor_per_machine} days={days} className="da-row-heading da-row-labor-border" />
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
                    const dateRows = days.map((day) => ({day, count: Number(statusValues[day] || 0)})).filter((row) => row.count > 0);
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
                                                                    <button type="button" className="da-view-btn" title={`View ${status.label} employees`} onClick={() => onView(status.key, status.label, formatDate( day ), employees) }>
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
                                            <button type="button" className="da-page-btn" disabled={ currentPage === 1 } onClick={() => changePage(status.key, 1, totalPages) } title="First page">
                                                &lt;&lt;
                                            </button>

                                            <button type="button" className="da-page-btn" disabled={ currentPage === 1 } onClick={() => changePage( status.key, currentPage - 1, totalPages ) } title="Previous page">
                                                &lt;
                                            </button>

                                            {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                                                <button key={page} type="button" className={`da-page-btn ${ currentPage === page ? "da-page-btn-active" : "" }`} onClick={() => changePage(status.key, page, totalPages) }>
                                                    {page}
                                                </button>
                                            ))}

                                            <button type="button" className="da-page-btn" disabled={ currentPage === totalPages } onClick={() => changePage(status.key, currentPage + 1, totalPages) } title="Next page">
                                                &gt;
                                            </button>

                                            <button type="button" className="da-page-btn" disabled={ currentPage === totalPages } onClick={() => changePage( status.key, totalPages, totalPages ) } title="Last page">
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
                                    <button key={p} type="button" className={`da-page-btn ${ currentPage === p ? "da-page-btn-active" : "" }`} onClick={() => setPage(p)} >
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
                                                    const val = raw === "" ? "" : Math.max(0, parseInt(raw, 10) || 0);
                                                    setEditDesigHc((prev) => ({
                                                        ...prev,
                                                        [dept.dept_id]: {
                                                            ...(prev[dept.dept_id] || {}),
                                                            [d.designation_id]: val,
                                                        },
                                                    }));
                                                }}
                                                onBlur={(e) => {
                                                    if (e.target.value === "") {
                                                        setEditDesigHc((prev) => ({
                                                            ...prev,
                                                            [dept.dept_id]: {
                                                                ...(prev[dept.dept_id] || {}),
                                                                [d.designation_id]: 0,
                                                            },
                                                        }));
                                                    }
                                                }}
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
                <input type="number" min={0} step={1} inputMode="numeric" placeholder="0" value={value === 0 || value == null || value === "" ? "" : value}
                    onChange={(e) => {
                        const raw = e.target.value;
                        // IMPORTANT: keep empty as ""
                        const val = raw === "" ? "" : Math.max(0, parseInt(raw, 10) || 0);
                        setValue(val);
                    }}
                    onBlur={(e) => {
                        if (e.target.value === "") setValue(0);
                    }}
                    style={{ width: "100%", padding: "8px 10px", fontSize: 14, textAlign: "right" }}
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

    const total = Object.values(editDailyMachines).reduce((a, b) => a + (parseInt(b, 10) || 0), 0);

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
                                            <input type="number" min={0} step={1} inputMode="numeric" placeholder="0" style={{ textAlign: "right" }}
                                                value={
                                                    (() => {
                                                        const v = editDailyMachines[ds];
                                                        return v === 0 || v == null || v === "" ? "" : v;
                                                    })()
                                                }
                                                onChange={(e) => {
                                                    const raw = e.target.value;
                                                    // IMPORTANT: keep empty as ""
                                                    const val = raw === "" ? "" : Math.max(0, parseInt(raw, 10) || 0);
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
                                    <tr key={ emp.employeeId ?? emp.employeeCode ?? index }>
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