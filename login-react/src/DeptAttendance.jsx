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

	const [expandedStatus, setExpandedStatus] = useState(null); 

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
        if (locationId) {
            fetchStdHc();
            fetchDesignationStdHc();
            fetchMachineStd();
        }
    }, [locationId]);

    useEffect(() => {
        if (locationId) {
            loadReport();
            fetchDailyMachines();
        }
    }, [month, year, dayFrom, dayTo, stdHcMap, locationId]);

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
                setLocationId(data.data[0].location_id);
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
                    if (data.unit_config.unit_capacity) setUnitCapacity(data.unit_config.unit_capacity);
                    if (data.unit_config.unit_name) setUnitName(data.unit_config.unit_name);
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
            if (data.success && data.data) setDailyMachines(data.data);
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
    const days = [];
    const clampedFrom = Math.max(1, Math.min(dayFrom, maxDays));
    const clampedTo = Math.max(clampedFrom, Math.min(dayTo, maxDays));
    for (let d = clampedFrom; d <= clampedTo; d++) days.push(d);

    function handleStatusToggle(statusKey) {
        setExpandedStatus((prev) => (prev === statusKey ? null : statusKey));
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
                <div className="da-filter-group">
                    <label>Location</label>
                    <select value={locationId || ""} onChange={(e) => setLocationId(Number(e.target.value))}>
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
                    <input type="number" min={1} max={maxDays} value={dayFrom} onChange={(e) => setDayFrom(Math.max(1, Math.min(Number(e.target.value), maxDays)))} />
                </div>
                <div className="da-filter-group">
                    <label>Day To</label>
                    <input type="number" min={1} max={maxDays} value={dayTo} onChange={(e) => setDayTo(Math.max(1, Math.min(Number(e.target.value), maxDays)))} />
                </div>
                <div className="da-filter-group">
                    <label>&nbsp;</label>
                    <button className="da-btn da-btn-sm" style={{ background: "#e2e8f0", color: "#475569" }} onClick={() => { setDayFrom(1); setDayTo(maxDays); }}>
                        📅 Full Month
                    </button>
                </div>
                <div className="da-filter-actions">
                    <button className="da-btn da-btn-primary" onClick={loadReport}>
                        🔍 Generate
                    </button>
                    <button className="da-btn da-btn-warning" onClick={() => { setEditDesigHc(JSON.parse(JSON.stringify(desigStdHcMap))); setShowDesigSettings(true); }}>
                        ⚙️ Designation STD HC
                    </button>
                    <button className="da-btn da-btn-warning" onClick={() => { setEditMachineStd(machineStd); setShowMachineStdSettings(true); }}>
                        ⚙️ Total Machines
                    </button>
                    <button className="da-btn da-btn-warning"
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
						expandedStatus={expandedStatus}
						onToggleStatus={handleStatusToggle}
					/>
                ) : (
                    <div className="da-loading">
                        <p>No data available.</p>
                    </div>
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
        </div>
    );
}

function DeptSummaryRows({ summary, days }) {
    const rows = [
        { key: "total_present", label: "Total Present", cls: "da-dsum-present" },
        { key: "total_half_present", label: "Total Half Present", cls: "da-dsum-half" },
        { key: "total_wo_present", label: "Total Weekly-Off Present", cls: "da-dsum-wop" },
        { key: "total_wo_half_present", label: "Total Weekly-Off Half Present", cls: "da-dsum-wohp" },
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

function ReportTable({ data, days, unitName, unitCapacity, loginName, month, year, expandedDept, onToggleDept, expandedDesig, onToggleDesig, expandedSummary, onToggleSummary, expandedStatus, onToggleStatus }) {
    if (!data || !data.departments) return null;
    const departments = data.departments || [];
    const summary = data.summary || {};
    const summary_avg = data.summary_avg || {};
    const summary_employees = data.summary_employees || {};
    const total_std_hc = data.total_std_hc || 0;
    const total_running_machines = data.total_running_machines || 0;   
    const colSpan = days.length + 3;

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
												<tr
													className="da-designation-row"
													onClick={() => hasEmployees && onToggleDesig(desigKey)}
													style={{ cursor: hasEmployees ? "pointer" : "default" }}
												>
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
																	<td
																		key={d}
																		className={status ? `da-emp-status da-status-${status.toLowerCase()}` : "da-empty"}
																	>
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
										<tr
											className="da-summary-toggle-row"
											onClick={() => onToggleSummary(dept.departmentId)}
										>
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
                        <SummaryRow label="Total Present" stdValue="" dayValues={summary.present} avgValue={summary_avg.present} days={days} className="da-row-total" statusKey="present" expandedStatus={expandedStatus} onToggleStatus={onToggleStatus} summaryEmployeesByDay={summary_employees} colSpan={colSpan} />
                        <SummaryRow label="Total Half Present" stdValue="" dayValues={summary.half_present} avgValue={summary_avg.half_present} days={days} className="da-row-heading" statusKey="half_present" expandedStatus={expandedStatus} onToggleStatus={onToggleStatus} summaryEmployeesByDay={summary_employees} colSpan={colSpan} />
                        <SummaryRow label="Total Weekly-Off Present" stdValue="" dayValues={summary.wo_present} avgValue={summary_avg.wo_present} days={days} className="da-row-heading" statusKey="wo_present" expandedStatus={expandedStatus} onToggleStatus={onToggleStatus} summaryEmployeesByDay={summary_employees} colSpan={colSpan} />
                        <SummaryRow label="Total Weekly-Off Half Present" stdValue="" dayValues={summary.wo_half_present} avgValue={summary_avg.wo_half_present} days={days} className="da-row-heading" statusKey="wo_half_present" expandedStatus={expandedStatus} onToggleStatus={onToggleStatus} summaryEmployeesByDay={summary_employees} colSpan={colSpan} />
                        <SummaryRow label="Total Weekly Off" stdValue="" dayValues={summary.weekly_off} avgValue={summary_avg.weekly_off} days={days} className="da-row-heading" statusKey="weekly_off" expandedStatus={expandedStatus} onToggleStatus={onToggleStatus} summaryEmployeesByDay={summary_employees} colSpan={colSpan} />
                        <SummaryRow label="Total Absent" stdValue="" dayValues={summary.total_absent} avgValue={summary_avg.total_absent} days={days} className="da-row-absent-total" statusKey="absent" expandedStatus={expandedStatus} onToggleStatus={onToggleStatus} summaryEmployeesByDay={summary_employees} colSpan={colSpan} />
                        <SummaryRow label="Total Single Punches" stdValue="" dayValues={summary.single_punch} avgValue={summary_avg.single_punch} days={days} className="da-row-heading" statusKey="single_punch" expandedStatus={expandedStatus} onToggleStatus={onToggleStatus} summaryEmployeesByDay={summary_employees} colSpan={colSpan} />
                        <SummaryRow label="Over-Time Paid" stdValue="" dayValues={summary.overtime_paid} avgValue={summary_avg.overtime_paid} days={days} className="da-row-ot" statusKey="overtime_paid" expandedStatus={expandedStatus} onToggleStatus={onToggleStatus} summaryEmployeesByDay={summary_employees} colSpan={colSpan} />
                        <SummaryRow label="Weekly-Off / PH" stdValue="" dayValues={summary.weekly_off_ph} avgValue={summary_avg.weekly_off_ph} days={days} className="da-row-weekoff" />
                        <SummaryRow label="On Leave" stdValue="" dayValues={summary.on_leave} avgValue={summary_avg.on_leave} days={days} className="da-row-leave" statusKey="on_leave" expandedStatus={expandedStatus} onToggleStatus={onToggleStatus} summaryEmployeesByDay={summary_employees} colSpan={colSpan} />
                        <SummaryRow label="Total New Joinee" stdValue="" dayValues={summary.new_joinee} avgValue={summary_avg.new_joinee} days={days} className="da-row-joinee" statusKey="new_joinee" expandedStatus={expandedStatus} onToggleStatus={onToggleStatus} summaryEmployeesByDay={summary_employees} colSpan={colSpan} />
                        <SummaryRow label="Total Resigned" stdValue="" dayValues={summary.left} avgValue={summary_avg.left} days={days} className="da-row-left" statusKey="left" expandedStatus={expandedStatus} onToggleStatus={onToggleStatus} summaryEmployeesByDay={summary_employees} colSpan={colSpan} />
                        <SummaryRow label="Recruited Head Count" stdValue="" dayValues={summary.recruited_hc} avgValue={summary_avg.recruited_hc} days={days} className="da-row-recruited" />
                    </tfoot>
                </table>
            </div>
        </div>
    );
}

function SummaryRow({ label, stdValue, dayValues, avgValue, days, className, statusKey, expandedStatus, onToggleStatus, summaryEmployeesByDay, colSpan }) {
    const clickable = !!statusKey && !!onToggleStatus;
    const isExpanded = clickable && expandedStatus === statusKey;

    let employeeRows = [];
    if (isExpanded) {
        const map = {};
        days.forEach((d) => {
            const list = (summaryEmployeesByDay && summaryEmployeesByDay[d] && summaryEmployeesByDay[d][statusKey]) || [];
            list.forEach((emp) => {
                const key = emp.employeeId ?? emp.employeeCode;
                if (!map[key]) {
                    map[key] = {
                        employeeId: key,
                        employeeName: emp.employeeName,
                        employeeCode: emp.employeeCode,
                        departmentName: emp.departmentName,
                        presence: {},
                    };
                }
                map[key].presence[d] = true;
            });
        });
        employeeRows = Object.values(map).sort((a, b) => a.employeeName.localeCompare(b.employeeName));
    }

    return (
        <>
            <tr className={className}>
                <td
                    className={clickable ? "da-summary-label-clickable" : ""}
                    onClick={clickable ? () => onToggleStatus(statusKey) : undefined}
                >
                    {label}
                </td>
                <td>{stdValue}</td>
                {days.map((d) => {
                    const val = dayValues && dayValues[d] !== undefined ? dayValues[d] : "";
                    return (
                        <td key={d} className={val === 0 || val === "" ? "da-empty" : ""}>
                            {val === 0 ? "" : val}
                        </td>
                    );
                })}
                <td>{avgValue || 0}</td>
            </tr>

            {isExpanded && employeeRows.length === 0 && (
                <tr className="da-emp-expand-empty-row">
                    <td colSpan={colSpan} className="da-emp-expand-empty">
                        No employees found for this range.
                    </td>
                </tr>
            )}

            {isExpanded &&
                employeeRows.map((emp) => (
                    <tr key={emp.employeeId} className="da-employee-row da-employee-row-summary">
                        <td className="da-employee-cell">
                            {emp.employeeName} - {emp.departmentName} <span className="da-emp-code">({emp.employeeCode})</span>
                        </td>
                        <td>–</td>
                        {days.map((d) => (
                            <td key={d} className={emp.presence[d] ? "da-yn-yes" : "da-yn-no"}>
                                {emp.presence[d] ? "Yes" : " "}
                            </td>
                        ))}
                        <td>–</td>
                    </tr>
                ))}
        </>
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
        <div
            className="da-modal-overlay"
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
                            <div
                                key={dept.dept_id}
                                style={{
                                    border: "1px solid #e2e8f0",
                                    borderRadius: 10,
                                    marginBottom: 14,
                                    overflow: "hidden",
                                }}
                            >
                                {/* Department header — read-only here, just for context */}
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        padding: "10px 14px",
                                        background: "#f8fafc",
                                        borderBottom: "1px solid #e2e8f0",
                                    }}
                                >
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
                                        <div
                                            key={d.designation_id}
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                                padding: "6px 0",
                                                fontSize: 13,
                                            }}
                                        >
                                            <span>{d.designation_name}</span>
                                            <input
                                                type="number"
                                                min={0}
                                                style={{ width: 70 }}
                                                value={
                                                    (editDesigHc[dept.dept_id] &&
                                                        editDesigHc[dept.dept_id][d.designation_id]) || 0
                                                }
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value, 10) || 0;
                                                    setEditDesigHc((prev) => ({
                                                        ...prev,
                                                        [dept.dept_id]: {
                                                            ...(prev[dept.dept_id] || {}),
                                                            [d.designation_id]: val,
                                                        },
                                                    }));
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
        <div
            className="da-modal-overlay"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="da-modal" style={{ maxWidth: 360 }}>
                <div className="da-modal-header">
                    <h2>⚙️ Total Machines</h2>
                    <button className="da-modal-close" onClick={onClose}>✕</button>
                </div>
                <p style={{ color: "#64748b", fontSize: 13, marginBottom: 16 }}>
                    Fixed total machine count for this location. Shown in the report header.
                </p>
                <input
                    type="number"
                    min={0}
                    value={value}
                    onChange={(e) => setValue(parseInt(e.target.value, 10) || 0)}
                    style={{ width: "100%", padding: "8px 10px", fontSize: 14 }}
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
        <div
            className="da-modal-overlay"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
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
                                            <input
                                                type="number"
                                                min={0}
                                                value={editDailyMachines[ds] ?? 0}
                                                onChange={(e) =>
                                                    setEditDailyMachines((prev) => ({
                                                        ...prev,
                                                        [ds]: parseInt(e.target.value, 10) || 0,
                                                    }))
                                                }
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