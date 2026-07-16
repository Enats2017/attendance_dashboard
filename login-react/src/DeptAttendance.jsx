import React, { useState, useEffect, useCallback } from "react";
import { generateDummyReport, DEFAULT_STD_HC } from "./dummyData";
import "./DeptAttendance.css";

const API_BASE = "/attendance-dashboard/api/index.php";
const DASH_URL = "/attendance-dashboard/index.html";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function DeptAttendance() {
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
    const [showSettings, setShowSettings] = useState(false);
    const [editHc, setEditHc] = useState({});
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState(null);
    const [unitCapacity, setUnitCapacity] = useState("150 Tons");
    const [unitName, setUnitName] = useState("PSF");
    const [expandedDept, setExpandedDept] = useState(null);

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
        fetchStdHc();
    }, []);

    useEffect(() => {
        loadReport(); // eslint-disable-next-line
    }, [month, year, dayFrom, dayTo, stdHcMap]);

    async function fetchStdHc() {
        try {
            const res = await fetch(API_BASE, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "get_std_hc" }),
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
            }
        } catch {}
    }

    async function loadReport() {
		setLoading(true);
		try {
			const res = await fetch(API_BASE, {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action: "get_report", month, year, day_from: dayFrom, day_to: dayTo }),
			});
			
			const data = await res.json();
			console.log("REPORT DATA:", data);
			console.log("First dept designations:", data.departments?.[0]?.designations);

			if (data.success) {
				setReportData(data);
				setLoading(false);
				return;
			}
			// NEW: surface the real backend error instead of silently faking data
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

    async function saveStdHc() {
        const items = Object.entries(editHc).map(([id, hc]) => ({ dept_id: id, std_hc: hc }));
        try {
            await fetch(API_BASE, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "bulk_update_std_hc", items }),
            });
        } catch {}
        setStdHcMap({ ...editHc });
        setDeptList((prev) => prev.map((d) => ({ ...d, std_hc: editHc[d.dept_id] || 0 })));
        setShowSettings(false);
        showToast("STD HC values saved successfully!", "success");
    }

    function exportExcel() {
        const table = document.getElementById("da-report-table");
        if (!table) return;
        const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head><meta charset="utf-8"><style>td,th{border:1px solid #ccc;padding:4px 8px;font-family:Calibri;font-size:11pt;}th{background:#fbbf24;font-weight:bold;}</style></head>
      <body>${table.outerHTML}</body></html>`;
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
                    <button
                        className="da-btn da-btn-sm"
                        style={{ background: "#e2e8f0", color: "#475569" }}
                        onClick={() => {
                            setDayFrom(1);
                            setDayTo(maxDays);
                        }}
                    >
                        📅 Full Month
                    </button>
                </div>
                <div className="da-filter-actions">
                    <button className="da-btn da-btn-primary" onClick={loadReport}>
                        🔍 Generate
                    </button>
                    <button
                        className="da-btn da-btn-warning"
                        onClick={() => {
                            setEditHc({ ...stdHcMap });
                            setShowSettings(true);
                        }}
                    >
                        ⚙️ STD HC Settings
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
                        month={month}
                        year={year}
                        expandedDept={expandedDept}
                        onToggleDept={(id) => setExpandedDept((prev) => (prev === id ? null : id))}
                    />
                ) : (
                    <div className="da-loading">
                        <p>No data available.</p>
                    </div>
                )}
            </div>

            {showSettings && <SettingsModal editHc={editHc} setEditHc={setEditHc} onSave={saveStdHc} onClose={() => setShowSettings(false)} deptList={deptList} />}
        </div>
    );
}

function ReportTable({ data, days, unitName, unitCapacity, month, year, expandedDept, onToggleDept }) {
    if (!data || !data.departments) return null;
    const departments = data.departments || [];
    const summary = data.summary || {};
    const summary_avg = data.summary_avg || {};
    const total_std_hc = data.total_std_hc || 0;
    return (
        <div className="da-report-card">
            <div className="da-report-title">
                {unitName} Unit Per Day Actual Head Count (HC) Report {MONTH_NAMES[month - 1]} {year}
            </div>
            <div className="da-table-scroll">
                <table className="da-table" id="da-report-table">
                    <thead>
                        <tr>
                            <th>Department</th>
                            <th>
                                STD
                                <br />({unitCapacity})
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
                                    className="da-dept-row"
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

                                {expandedDept === dept.departmentId &&
                                    dept.designations &&
                                    dept.designations.map((desig, j) => (
                                        <tr key={`desig-${dept.departmentId}-${j}`} className="da-designation-row">
											<td className="da-designation-cell">{desig.designationName}</td>
                                            <td>–</td>
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
                                    ))}
                            </React.Fragment>
                        ))}
                    </tbody>
                    <tfoot>
                        <SummaryRow
                            label="Total Present For The Day"
                            stdValue={total_std_hc}
                            dayValues={summary.total_present}
                            avgValue={summary_avg.total_present}
                            days={days}
                            className="da-row-total"
                        />
                        <SummaryRow label="Over-Time Paid" stdValue="" dayValues={summary.overtime_paid} avgValue={summary_avg.overtime_paid} days={days} className="da-row-ot" />
                        <SummaryRow label="Weekly-Off / PH" stdValue="" dayValues={summary.weekly_off_ph} avgValue={summary_avg.weekly_off_ph} days={days} className="da-row-weekoff" />
                        <SummaryRow label="On Leave" stdValue="" dayValues={summary.on_leave} avgValue={summary_avg.on_leave} days={days} className="da-row-leave" />
                        <SummaryRow label="New Joinee" stdValue="" dayValues={summary.new_joinee} avgValue={summary_avg.new_joinee} days={days} className="da-row-joinee" />
                        <SummaryRow label="Left" stdValue="" dayValues={summary.left} avgValue={summary_avg.left} days={days} className="da-row-left" />
                        <SummaryRow label="Recruited Head Count" stdValue="" dayValues={summary.recruited_hc} avgValue={summary_avg.recruited_hc} days={days} className="da-row-recruited" />
                    </tfoot>
                </table>
            </div>
        </div>
    );
}

function SummaryRow({ label, stdValue, dayValues, avgValue, days, className }) {
    return (
        <tr className={className}>
            <td>{label}</td>
            <td>{stdValue}</td>
            {days.map((d) => {
                const val = dayValues && dayValues[d] !== undefined ? dayValues[d] : "";
                return (
                    <td key={d} className={val === 0 ? "da-empty" : ""}>
                        {val === 0 ? "" : val}
                    </td>
                );
            })}
            <td>{avgValue || 0}</td>
        </tr>
    );
}

function SettingsModal({ editHc, setEditHc, onSave, onClose, deptList }) {
    const total = Object.values(editHc).reduce((a, b) => a + (parseInt(b, 10) || 0), 0);
    return (
        <div
            className="da-modal-overlay"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="da-modal">
                <div className="da-modal-header">
                    <h2>⚙️ STD Head Count Settings</h2>
                    <button className="da-modal-close" onClick={onClose}>
                        ✕
                    </button>
                </div>
                <p style={{ color: "#64748b", fontSize: 13, marginBottom: 16 }}>Set the standard headcount for each department. These values are mapped to live Department IDs.</p>
                <div className="da-settings-table-wrap">
                    <table className="da-settings-table">
                        <thead>
                            <tr>
                                <th style={{ width: "15%" }}>ID</th>
                                <th style={{ width: "60%" }}>Department Name</th>
                                <th style={{ width: "25%" }}>STD HC</th>
                            </tr>
                        </thead>
                        <tbody>
                            {deptList.map((dept) => (
                                <tr key={dept.dept_id}>
                                    <td style={{ fontSize: 11, color: "#94a3b8" }}>{dept.dept_id}</td>
                                    <td style={{ fontWeight: 600 }}>{dept.department_name}</td>
                                    <td>
                                        <input
                                            type="number"
                                            min={0}
                                            value={editHc[dept.dept_id] || 0}
                                            onChange={(e) => setEditHc((prev) => ({ ...prev, [dept.dept_id]: parseInt(e.target.value, 10) || 0 }))}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="da-settings-total">
                    <span>Total STD Head Count</span>
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
