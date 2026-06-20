/**
 * AttendanceModel - Handles data state and API interactions
 */
class AttendanceModel {
    constructor() {
        this.state = {
            activeTab: 'feature',
            lastUpdated: null,
            data: {
                employees: [],
                attendanceLogs: [],
                counts: { In: 0, Out: 0 }
            },
            filterLists: null,
            filters: {
                dateFrom: this._getToday(),
                dateTo: this._getToday(),
                company: 'All',
                dept: 'All',
                gender: 'All',
                shift: 'All',
                location: 'All'
            }
        };
        
        this.onDataChanged = null;
    }

    _getMonthStart() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
    }

    _getToday() {
        const d = new Date();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${d.getFullYear()}-${mm}-${dd}`;
    }

    bindDataChanged(callback) {
        this.onDataChanged = callback;
    }

    _commit() {
        if (this.onDataChanged) {
            this.onDataChanged(this.state);
        }
    }

    async fetchFilterOptions() {
        if (this.state.filterLists) return { success: true };
        try {
            const urlDepts = new URL(window.APP_CONFIG.API_URL, window.location.origin);
            urlDepts.searchParams.set('action', 'get_depts');
            const urlComps = new URL(window.APP_CONFIG.API_URL, window.location.origin);
            urlComps.searchParams.set('action', 'get_companies');
            const urlShifts = new URL(window.APP_CONFIG.API_URL, window.location.origin);
            urlShifts.searchParams.set('action', 'get_shifts');

            const [deptRes, compRes, shiftRes] = await Promise.all([
                fetch(urlDepts.toString()).then(r => r.json()),
                fetch(urlComps.toString()).then(r => r.json()),
                fetch(urlShifts.toString()).then(r => r.json())
            ]);

            this.state.filterLists = {
                depts: deptRes.map(d => d.DepartmentName),
                companies: compRes.map(c => c.CompanyName),
                shifts: shiftRes.map(s => s.ShiftName)
            };
            return { success: true };
        } catch (error) {
            console.error('Fetch Filter Options Error:', error);
            return { success: false, error: error.message };
        }
    }

    async fetchData() {
        const dFrom = new Date(this.state.filters.dateFrom);
        const dTo = new Date(this.state.filters.dateTo);
        
        const month = dFrom.getMonth() + 1;
        const year = dFrom.getFullYear();
        const dayFrom = dFrom.getDate();
        const dayTo = dTo.getDate();

        try {
            const url = new URL(window.APP_CONFIG.API_URL, window.location.origin);
            url.searchParams.set('action', 'dashboard_data');
            url.searchParams.set('userId', (window.HRMS_USER || {}).id || 0);
            url.searchParams.set('month', month);
            url.searchParams.set('year', year);
            url.searchParams.set('day_from', dayFrom);
            url.searchParams.set('day_to', dayTo);
            url.searchParams.set('dept', this.state.filters.dept);
            url.searchParams.set('company', this.state.filters.company);
            url.searchParams.set('shift', this.state.filters.shift);
            console.log('Dashboard URL:', url.toString());
            const response = await fetch(url.toString());
            const data = await response.json();

            if (data.success) {
                this.state.data = {
                    employees: data.employees,
                    resignedEmployees: data.resignedEmployees || [],
                    newJoinedEmployees: data.newJoinedEmployees || [],
                    attendanceLogs: data.attendanceLogs,
                    shiftStats: data.shiftStats || [],
                    nightShiftEmployees: data.nightShiftEmployees || [],
                    nightShiftLogs: data.nightShiftLogs || [],
                    counts: data.counts
                };
                this.state.todayStats = data.todayStats || {
                    present: 0,
                    absent: 0,
                    total: 0,
                    singlePunch: 0,
                    lateIn: 0,
                    earlyOut: 0,
                    avgHours: 0,
                    resigned: 0,
                    newJoined: 0
                };
                this.state.nightShiftStats = data.nightShiftStats || {
                    present: 0,
                    absent: 0,
                    total: 0,
                    singlePunch: 0,
                    lateIn: 0,
                    earlyOut: 0,
                    avgHours: 0
                };
                this.state.lastUpdated = new Date().toLocaleTimeString();
                
                // Keep compatibility with legacy Utils if needed, but we'll migrate them
                window.EMPLOYEES = data.employees;
                window.ATTENDANCE_LOGS = data.attendanceLogs;

                this._commit();
                return { success: true };
            } else {
                throw new Error(data.message || 'API Error');
            }
        } catch (error) {
            console.error('Fetch Error:', error);
            return { success: false, error: error.message };
        }
    }

    updateFilters(newFilters) {
        this.state.filters = { ...this.state.filters, ...newFilters };
        this._commit();
    }

    resetFilters() {
        this.state.filters = {
            dateFrom: this._getMonthStart(),
            dateTo: this._getToday(),
            company: 'All',
            dept: 'All',
            gender: 'All',
            shift: 'All',
            location: 'All'
        };
        this._commit();
    }

    switchTab(tabId) {
        this.state.activeTab = tabId;
        this._commit();
    }

    getFilteredData() {
        const { filters, data } = this.state;
        const empMap = this.getEmpMap();

        const logs = data.attendanceLogs.filter(log => {
            const emp = empMap[log.empId];
            if (!emp) return false;
            if (filters.dateFrom && log.date < filters.dateFrom) return false;
            if (filters.dateTo && log.date > filters.dateTo) return false;
            if (filters.company !== 'All' && emp.company !== filters.company) return false;
            if (filters.dept !== 'All' && emp.dept !== filters.dept) return false;
            if (filters.gender !== 'All' && emp.gender !== filters.gender) return false;
            if (filters.shift !== 'All' && emp.shift !== filters.shift) return false;
            if (filters.location !== 'All' && emp.location !== filters.location) return false;
            return true;
        });

        const emps = data.employees.filter(emp => {
            if (filters.company !== 'All' && emp.company !== filters.company) return false;
            if (filters.dept !== 'All' && emp.dept !== filters.dept) return false;
            if (filters.gender !== 'All' && emp.gender !== filters.gender) return false;
            if (filters.shift !== 'All' && emp.shift !== filters.shift) return false;
            if (filters.location !== 'All' && emp.location !== filters.location) return false;
            return true;
        });

        return { logs, emps, empMap };
    }

    getEmpMap() {
        const m = {};
        this.state.data.employees.forEach(e => { m[e.id] = e; });
        return m;
    }

    getNightShiftData() {
        const empMap = {};

        (this.state.data.nightShiftEmployees || []).forEach(e => {
            empMap[e.id] = e;
        });

        return {
            logs: this.state.data.nightShiftLogs || [],
            emps: this.state.data.nightShiftEmployees || [],
            empMap
        };
    }

    getAge(dob) {
        const birth = new Date(dob);
        const now = new Date();
        let age = now.getFullYear() - birth.getFullYear();
        const m = now.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
        return age;
    }

    getAgeGroup(dob) {
        const age = this.getAge(dob);
        if (age < 25) return 'Under 25';
        if (age < 35) return '25–34';
        if (age < 45) return '35–44';
        if (age < 55) return '45–54';
        return '55+';
    }

    findNoPunchEmployees() {
        const { filters } = this.state;
        const { logs, emps } = this.getFilteredData();
        const empLogs = {};
        logs.forEach(log => {
            if (!empLogs[log.empId]) empLogs[log.empId] = [];
            empLogs[log.empId].push(log.date);
        });

        const result = [];
        emps.forEach(emp => {
            const dates = (empLogs[emp.id] || []).sort();
            const allDates = [];
            const from = new Date(filters.dateFrom);
            const to = new Date(filters.dateTo);
            for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
                allDates.push(d.toISOString().slice(0, 10));
            }
            let maxGap = 0, gap = 0, gapStart = null, maxGapStart = null;
            allDates.forEach(dt => {
                if (dates.indexOf(dt) === -1) {
                    if (gap === 0) gapStart = dt;
                    gap++;
                    if (gap > maxGap) { maxGap = gap; maxGapStart = gapStart; }
                } else { gap = 0; }
            });
            if (maxGap >= 5) result.push({ emp: emp, maxGap: maxGap, gapStart: maxGapStart });
        });
        return result;
    }

    groupBy(arr, keyFn) {
        const out = {};
        arr.forEach(item => {
            const k = keyFn(item);
            if (!out[k]) out[k] = [];
            out[k].push(item);
        });
        return out;
    }

    getSummaryStats() {
        const { logs, emps } = this.getFilteredData();
        const empIds = emps.map(e => e.id);
        
        // Only count as present if the record explicitly indicates presence
        const presentIds = new Set(logs.filter(l => l.present === 1).map(l => l.empId));
        
        // Helper to check if a log record represents a valid presence
        const isPresent = (l) => l.present === 1 || l.status === 'Present';

        // Calculate total presence records for the entire range
        // const totalPresentRecords = logs.filter(isPresent).length;
        
        // Calculate total possible records in this range (Staff * Days)
        const todayStats = this.state.todayStats;
        const totalPresentRecords = todayStats ? todayStats.present : logs.filter(isPresent).length;
        const totalAbsentRecords = todayStats ? todayStats.absent : Math.max(0, emps.length - totalPresentRecords);

        // Calculate total punches for the entire range (ignoring '00:00')
        const totalIn = logs.filter(l => l.inTime && l.inTime !== '00:00' && l.inTime !== '00:00:00').length;
        const totalOut = logs.filter(l => l.outTime && l.outTime !== '00:00' && l.outTime !== '00:00:00').length;

        // const lateIn = logs.filter(l => l.lateIn).length;
        // const earlyOut = logs.filter(l => l.earlyOut).length;
        // const avgHours = logs.length ? (logs.reduce((s, l) => s + (l.hoursWorked || 0), 0) / logs.length).toFixed(1) : 0;

        return {
            present: totalPresentRecords,
            absent: totalAbsentRecords,
            singlePunch: todayStats ? todayStats.singlePunch : 0,
            lateIn: todayStats ? todayStats.lateIn : 0,
            earlyOut: todayStats ? todayStats.earlyOut : 0,
            avgHours: todayStats ? todayStats.avgHours : 0,
            total: todayStats ? todayStats.total : emps.length,
            resigned: todayStats ? todayStats.resigned : (this.state.data.resignedEmployees || []).length,
            newJoined: todayStats ? todayStats.newJoined : (this.state.data.newJoinedEmployees || []).length,
            filteredIn: totalIn,
            filteredOut: totalOut
        };
    }

    getFilterOptions() {
        const emps = this.state.data.employees || [];
        const uniq = (arr) => [...new Set(arr)].sort();
        
        // Use API-fetched lists for companies and depts, otherwise fallback to extracting from punches JSON
        const companies = this.state.filterLists ? this.state.filterLists.companies : uniq(emps.map(e => e.company));
        const depts = this.state.filterLists ? this.state.filterLists.depts : uniq(emps.map(e => e.dept));
        const shifts = this.state.filterLists ? this.state.filterLists.shifts : uniq(emps.map(e => e.shift));
        const locations = uniq(emps.map(e => e.location));
        
        return { companies, depts, shifts, locations };
    }

    getPresentEmployees() {
        const { filters, data } = this.state;
        const { logs, emps, empMap } = this.getFilteredData();

        // Build a lookup: empId_date -> log (prefer the row with higher 'present')
        const logMap = {};
        logs.forEach(l => {
            const key = l.empId + '_' + l.date;
            const existing = logMap[key];
            if (!existing || parseFloat(l.present) > parseFloat(existing.present)) {
                logMap[key] = l;
            }
        });

        const from = new Date(filters.dateFrom);
        const to = new Date(filters.dateTo);
        const result = [];

        emps.forEach(emp => {
            for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
                const dateStr = d.toISOString().slice(0, 10);
                const log = logMap[emp.id + '_' + dateStr];
                if (log && parseFloat(log.present) > 0) {
                    result.push({ log, emp, date: dateStr });
                }
            }
        });

        return result;
    }

    getAbsentEmployees() {
        const { filters, data } = this.state;
        const { logs, emps, empMap } = this.getFilteredData();

        const logMap = {};
        logs.forEach(l => {
            const key = l.empId + '_' + l.date;
            const existing = logMap[key];
            if (!existing || parseFloat(l.present) > parseFloat(existing.present)) {
                logMap[key] = l;
            }
        });

        const from = new Date(filters.dateFrom);
        const to = new Date(filters.dateTo);
        const result = [];

        emps.forEach(emp => {
            for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
                const dateStr = d.toISOString().slice(0, 10);
                const log = logMap[emp.id + '_' + dateStr];

                // Same rule as the PHP $absentEmployeeDays loop:
                // no record present at all => absent for that day
                const isPresent = log && parseFloat(log.present) > 0;
                const isWeeklyOff = log && log.weeklyOff == 1;
                const isHoliday = log && log.holiday == 1;
                const isOnLeave = log && log.isOnLeave == 1;

                if (!isPresent && !isWeeklyOff && !isHoliday && !isOnLeave) {
                    result.push({ log: log || null, emp, date: dateStr });
                }
            }
        });

        return result;
    }

    getSinglePunchEmployees() {
        const { logs, empMap } = this.getFilteredData();
        return logs.filter(l => l.missedInPunch == 1 || l.missedOutPunch == 1).map(l => ({ log: l, emp: empMap[l.empId] }));
    }

    getLateInEmployees() {
        const { logs, empMap } = this.getFilteredData();
        return logs.filter(l => (l.lateBy || 0) > 0).map(l => ({ log: l, emp: empMap[l.empId] }));
    }

    getEarlyOutEmployees() {
        const { logs, empMap } = this.getFilteredData();
        return logs.filter(l => (l.earlyBy || 0) > 0).map(l => ({ log: l, emp: empMap[l.empId] }));
    }

    getResignedEmployees() {
        const resigned = this.state.data.resignedEmployees || [];
        const { filters } = this.state;
        return resigned.filter(emp => {
            if (filters.company !== 'All' && emp.company !== filters.company) return false;
            if (filters.dept !== 'All' && emp.dept !== filters.dept) return false;
            if (filters.gender !== 'All' && emp.gender !== filters.gender) return false;
            if (filters.location !== 'All' && emp.location !== filters.location) return false;
            return true;
        }).map(emp => ({ log: null, emp }));
    }

    getNewJoinedEmployees() {
        const newJoined = this.state.data.newJoinedEmployees || [];
        const { filters } = this.state;
        return newJoined.filter(emp => {
            if (filters.company !== 'All' && emp.company !== filters.company) return false;
            if (filters.dept !== 'All' && emp.dept !== filters.dept) return false;
            if (filters.gender !== 'All' && emp.gender !== filters.gender) return false;
            if (filters.location !== 'All' && emp.location !== filters.location) return false;
            return true;
        }).map(emp => ({ log: null, emp }));
    }
}

window.AttendanceModel = AttendanceModel;
