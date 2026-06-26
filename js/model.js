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
        try {
            const url = new URL(window.APP_CONFIG.API_URL, window.location.origin);
            url.searchParams.set('action', 'dashboard_data');
            url.searchParams.set('userId', (window.HRMS_USER || {}).id || 0);
            url.searchParams.set('date_from', this.state.filters.dateFrom);
            url.searchParams.set('date_to', this.state.filters.dateTo);
            url.searchParams.set('dept', this.state.filters.dept);
            url.searchParams.set('company', this.state.filters.company);
            url.searchParams.set('shift', this.state.filters.shift);
            url.searchParams.set('location', this.state.filters.location);
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
                    counts: data.counts,
                    singlePunchKeys: new Set(data.singlePunchKeys || []),
                    singlePunchData: data.singlePunchData || {}
                };
                this.state.todayStats = data.todayStats || {
                    present: 0, 
                    halfPresent: 0, 
                    weeklyOff: 0, 
                    absent: 0, 
                    total: 0,
                    singlePunch: 0, 
                    lateIn: 0, 
                    earlyOut: 0, 
                    avgHours: 0,
                    resigned: 0, 
                    newJoined: 0
                };
                this.state.staffWorkerStats = data.staffWorkerStats || {
                    staffTotal: 0, 
                    staffPresent: 0, 
                    staffHalfPresent: 0, 
                    staffWeeklyOff: 0, 
                    staffAbsent: 0,
                    workerTotal: 0, 
                    workerPresent: 0, 
                    workerHalfPresent: 0, 
                    workerWeeklyOff: 0, 
                    workerAbsent: 0
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
        this.state.filters = { 
            ...this.state.filters, 
            ...newFilters 
        };
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
    }


    switchTab(tabId) {
        if (this.state.activeTab === tabId) {
            return;
        }
        this.state.activeTab = tabId;
        this._commit();
    }


    getFilteredData() {
        const { filters, data } = this.state;
        const empMap = this.getEmpMap();

        const logs = data.attendanceLogs.filter(log => {
            const emp = empMap[log.empId];
            if (!emp) return false;
            if (filters.dateFrom && log.date < filters.dateFrom) {
                return false;
            }
            if (filters.dateTo && log.date > filters.dateTo) {
                return false;
            }
            if (filters.company !== 'All' && emp.company !== filters.company) {
                return false;
            }
            if (filters.dept !== 'All' && emp.dept !== filters.dept) {
                return false;
            }
            if (filters.gender !== 'All' && emp.gender !== filters.gender) {
                return false;
            }
            if (filters.shift !== 'All' && emp.shift !== filters.shift) {
                return false;
            }
            if (filters.location !== 'All' && emp.location !== filters.location) {
                return false;
            }
            return true;
        });

        const emps = data.employees.filter(emp => {
            if (filters.company !== 'All' && emp.company !== filters.company) {
                return false;
            }
            if (filters.dept !== 'All' && emp.dept !== filters.dept) {
                return false;
            }
            if (filters.gender !== 'All' && emp.gender !== filters.gender) {
                return false;
            }
            if (filters.shift !== 'All' && emp.shift !== filters.shift) {
                return false;
            }
            if (filters.location !== 'All' && emp.location !== filters.location) {
                return false;
            }
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
        if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
            age--;
        }
        return age;
    }


    getAgeGroup(dob) {
        const age = this.getAge(dob);
        if (age < 18) return 'Under 18';
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
                    if (gap === 0) {
                        gapStart = dt;
                    }
                    gap++;
                    if (gap > maxGap) { 
                        maxGap = gap; 
                        maxGapStart = gapStart; 
                    }
                } else {
                    gap = 0; 
                }
            });
            if (maxGap >= 5) {
                result.push({ emp: emp, maxGap: maxGap, gapStart: maxGapStart });
            }
        });
        return result;
    }


    groupBy(arr, keyFn) {
        const out = {};
        arr.forEach(item => {
            const k = keyFn(item);
            if (!out[k]) {
                out[k] = [];
            }
            out[k].push(item);
        });
        return out;
    }


    getSummaryStats() {
        const { logs, emps } = this.getFilteredData();
        const empIds = emps.map(e => e.id);
        const presentIds = new Set(logs.filter(l => l.present === 1).map(l => l.empId));
        const isPresent = (l) => l.present === 1 || l.status === 'Present';
        const todayStats = this.state.todayStats;
        const totalPresentRecords = todayStats ? todayStats.present : logs.filter(isPresent).length;
        const totalAbsentRecords = todayStats ? todayStats.absent : Math.max(0, emps.length - totalPresentRecords);
        const totalIn = logs.filter(l => parseFloat(l.present) > 0 || l.missedOutPunch == 1  ).length;
        const totalOut = logs.filter(l => parseFloat(l.present) > 0 && l.missedInPunch != 1   ).length;

        return {
            present: todayStats?.present ?? 0,
            halfPresent: todayStats?.halfPresent ?? 0,
            weeklyOff: todayStats?.weeklyOff ?? 0,
            absent: todayStats?.absent ?? 0,
            singlePunch: todayStats?.singlePunch ?? 0,
            lateIn: todayStats?.lateIn ?? 0,
            earlyOut: todayStats?.earlyOut ?? 0,
            avgHours: todayStats?.avgHours ?? 0,
            total: todayStats?.total ?? 0,
            resigned: todayStats?.resigned ?? (this.state.data.resignedEmployees || []).length,
            newJoined: todayStats?.newJoined ?? (this.state.data.newJoinedEmployees || []).length,
            filteredIn: totalIn,
            filteredOut: totalOut
        };
    }


    getFilterOptions() {
        const emps = this.state.data.employees || [];
        const uniq = (arr) => [...new Set(arr)].sort();
        const companies = this.state.filterLists ? this.state.filterLists.companies : uniq(emps.map(e => e.company));
        const depts = this.state.filterLists ? this.state.filterLists.depts : uniq(emps.map(e => e.dept));
        const shifts = this.state.filterLists ? this.state.filterLists.shifts : uniq(emps.map(e => e.shift));
        const locations = uniq(emps.map(e => e.location));
        
        return { companies, depts, shifts, locations };
    }


    getAllEmployees() {
        const { emps } = this.getFilteredData();
        return emps.map(emp => ({ log: null, emp, date: null }));
    }


    getPresentEmployees() {
        const { filters } = this.state;
        const { logs, emps } = this.getFilteredData();

        const presentKeySet = {};

        logs.forEach(l => {
            if (parseFloat(l.present) == 1 && l.absent == 0 && l.missedInPunch == 0 && l.missedOutPunch == 0) {
                presentKeySet[l.empId + '_' + l.date] = true;
            }
        });

        const logMap = {};

        logs.forEach(l => {
            const key = l.empId + '_' + l.date;
            const existing = logMap[key];

            if (!existing || parseFloat(l.present) > parseFloat(existing.present)) {
                logMap[key] = l;
            }
        });

        const fromStr = filters.dateFrom;
        const toStr = filters.dateTo;
        const result = [];

        emps.forEach(emp => {
            const from = new Date(fromStr);
            const to = new Date(toStr);
            for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
                const dateStr = d.toISOString().slice(0, 10);
                const key = emp.id + '_' + dateStr;

                if (presentKeySet[key]) {
                    result.push({
                        log: logMap[key] || null,
                        emp,
                        date: dateStr
                    });
                }
            }
        });

        result.sort((a, b) => b.date.localeCompare(a.date));
        return result;
    }


    getAbsentEmployees() {
        const { filters } = this.state;
        const { logs, emps } = this.getFilteredData();

        const statusKeyMap = this._buildStatusKeyMap(logs);
        const logMap = this._buildLogMap(logs);

        const fromStr = filters.dateFrom;
        const toStr = filters.dateTo;
        const result = [];

        emps.forEach(emp => {
            const from = new Date(fromStr);
            const to = new Date(toStr);
            for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
                const dateStr = d.toISOString().slice(0, 10);
                const key = emp.id + '_' + dateStr;
                if ((statusKeyMap[key] ?? 'absent') === 'absent') {
                    result.push({ log: logMap[key] || null, emp, date: dateStr });
                }
            }
        });

        result.sort((a, b) => b.date.localeCompare(a.date));
        return result;
    }


    getHalfPresentEmployees() {
        const { filters } = this.state;
        const { logs, emps } = this.getFilteredData();

        const statusKeyMap = this._buildStatusKeyMap(logs);
        const logMap = this._buildLogMap(logs);

        const fromStr = filters.dateFrom;
        const toStr = filters.dateTo;
        const result = [];

        emps.forEach(emp => {
            const from = new Date(fromStr);
            const to = new Date(toStr);
            for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
                const dateStr = d.toISOString().slice(0, 10);
                const key = emp.id + '_' + dateStr;
                if (statusKeyMap[key] === 'halfPresent') {
                    result.push({ log: logMap[key] || null, emp, date: dateStr });
                }
            }
        });

        result.sort((a, b) => b.date.localeCompare(a.date));
        return result;
    }


    getWeeklyOffEmployees() {
        const { filters } = this.state;
        const { logs, emps } = this.getFilteredData();

        const statusKeyMap = this._buildStatusKeyMap(logs);
        const logMap = this._buildLogMap(logs);

        const fromStr = filters.dateFrom;
        const toStr = filters.dateTo;
        const result = [];

        emps.forEach(emp => {
            const from = new Date(fromStr);
            const to = new Date(toStr);
            for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
                const dateStr = d.toISOString().slice(0, 10);
                const key = emp.id + '_' + dateStr;
                if (statusKeyMap[key] === 'weeklyOff') {
                    result.push({ log: logMap[key] || null, emp, date: dateStr });
                }
            }
        });

        result.sort((a, b) => b.date.localeCompare(a.date));
        return result;
    }


    getSinglePunchEmployees() {
        const { filters } = this.state;
        const { emps } = this.getFilteredData();
        const singlePunchKeys = this.state.data.singlePunchKeys || new Set();
        const singlePunchData = this.state.data.singlePunchData || {};

        const fromStr = filters.dateFrom;
        const toStr = filters.dateTo;
        const result = [];

        emps.forEach(emp => {
            const from = new Date(fromStr);
            const to = new Date(toStr);
            for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
                const dateStr = d.toISOString().slice(0, 10);
                const key = emp.id + '_' + dateStr;

                if (singlePunchKeys.has(key)) {
                    const punchInfo = singlePunchData[key] || {};
                    result.push({
                        log: {
                            empId: emp.id,
                            date: dateStr,
                            inTime: punchInfo.direction === 'in'  ? punchInfo.time : null,
                            outTime: punchInfo.direction === 'out' ? punchInfo.time : null,
                            status: 'Single Punch',
                            present: 0,
                            absent: 1,
                            hoursWorked: 0,
                            lateBy: 0,
                            earlyBy: 0,
                            shiftStart: punchInfo.shiftStart || null,
                            shiftEnd: punchInfo.shiftEnd || null
                        }, emp, date: dateStr
                    });
                }
            }
        });

        result.sort((a, b) => b.date.localeCompare(a.date));
        return result;
    }


    getLateInEmployees() {
        const { filters } = this.state;
        const { logs, emps } = this.getFilteredData();

        const logMap = {};
        logs.forEach(l => {
            const key = l.empId + '_' + l.date;
            const existing = logMap[key];
            if (!existing || parseFloat(l.present) > parseFloat(existing.present)) {
                logMap[key] = l;
            }
        });

        const fromStr = filters.dateFrom;
        const toStr = filters.dateTo;
        const result = [];

        emps.forEach(emp => {
            const from = new Date(fromStr);
            const to = new Date(toStr);
            for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
                const dateStr = d.toISOString().slice(0, 10);
                const log = logMap[emp.id + '_' + dateStr];

                if (log && (log.lateBy || 0) > 0) {
                    result.push({ log, emp, date: dateStr });
                }
            }
        });

        result.sort((a, b) => b.date.localeCompare(a.date));
        return result;
    }


    getEarlyOutEmployees() {
        const { filters } = this.state;
        const { logs, emps } = this.getFilteredData();

        const logMap = {};
        logs.forEach(l => {
            const key = l.empId + '_' + l.date;
            const existing = logMap[key];
            if (!existing || parseFloat(l.present) > parseFloat(existing.present)) {
                logMap[key] = l;
            }
        });

        const fromStr = filters.dateFrom;
        const toStr = filters.dateTo;
        const result = [];

        emps.forEach(emp => {
            const from = new Date(fromStr);
            const to = new Date(toStr);
            for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
                const dateStr = d.toISOString().slice(0, 10);
                const log = logMap[emp.id + '_' + dateStr];

                if (log && (log.earlyBy || 0) > 0) {
                    result.push({ log, emp, date: dateStr });
                }
            }
        });

        result.sort((a, b) => b.date.localeCompare(a.date));
        return result;
    }


    getResignedEmployees() {
        const resigned = this.state.data.resignedEmployees || [];
        const { filters } = this.state;
        return resigned.filter(emp => {
            if (filters.company !== 'All' && emp.company !== filters.company) {
                return false;
            }
            if (filters.dept !== 'All' && emp.dept !== filters.dept) {
                return false;
            }
            if (filters.gender !== 'All' && emp.gender !== filters.gender) {
                return false;
            }
            if (filters.location !== 'All' && emp.location !== filters.location) {
                return false;
            }
            return true;
        }).sort((a, b) => (b.dor || '').localeCompare(a.dor || '')).map(emp => ({ log: null, emp }));
    }


    getNewJoinedEmployees() {
        const newJoined = this.state.data.newJoinedEmployees || [];
        const { filters } = this.state;
        return newJoined.filter(emp => {
            if (filters.company !== 'All' && emp.company !== filters.company) {
                return false;
            }
            if (filters.dept !== 'All' && emp.dept !== filters.dept) {
                return false;
            }
            if (filters.gender !== 'All' && emp.gender !== filters.gender) {
                return false;
            }
            if (filters.location !== 'All' && emp.location !== filters.location) {
                return false;
            }
            return true;
        }).sort((a, b) => (b.doj || '').localeCompare(a.doj || '')).map(emp => ({ log: null, emp }));
    }


    async fetchDesignationsOrder() {
        try {
            const url = new URL(window.APP_CONFIG.API_URL, window.location.origin);
            url.searchParams.set('action', 'get_designations_order');
            const response = await fetch(url.toString());
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Fetch Designations Order Error:', error);
            return { success: false, error: error.message };
        }
    }


    async saveDesignationsOrder(items) {
        try {
            const url = new URL(window.APP_CONFIG.API_URL, window.location.origin);
            url.searchParams.set('action', 'save_designations_order');
            const response = await fetch(url.toString(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ action: 'save_designations_order', items })
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Save Designations Order Error:', error);
            return { success: false, error: error.message };
        }
    }


    getStaffEmployees() {
        const staffCategoryIds = [58];
        const { logs, emps } = this.getFilteredData();
        const staffEmps = emps.filter(emp => staffCategoryIds.includes(emp.categoryId));
        const logMap = this._buildLogMap(logs);
        const statusMap = this._buildStatusKeyMap(logs);       
        const { dateFrom, dateTo } = this.state.filters;

        const result = [];
        
        staffEmps.forEach(emp => {
            const from = new Date(dateFrom);
            const to = new Date(dateTo);
            for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
                const dateStr = d.toISOString().slice(0, 10);
                const key = emp.id + '_' + dateStr;
                const status = statusMap[key];
                if (status === 'present' || status === 'halfPresent') {
                    result.push({ log: logMap[key] || null, emp, date: dateStr });
                }
            }
        });
        
        result.sort((a, b) => b.date.localeCompare(a.date));
        return result;
    }


    getWorkerEmployees() {
        const workerCategoryIds = [51, 59, 60];
        const { logs, emps } = this.getFilteredData();
        const workerEmps = emps.filter(emp => workerCategoryIds.includes(emp.categoryId));
        const logMap = this._buildLogMap(logs);
        const statusMap = this._buildStatusKeyMap(logs);
        const { dateFrom, dateTo } = this.state.filters;

        const result = [];

        workerEmps.forEach(emp => {
            const from = new Date(dateFrom);
            const to = new Date(dateTo);
            for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
                const dateStr = d.toISOString().slice(0, 10);
                const key = emp.id + '_' + dateStr;
                const status = statusMap[key];
                if (status === 'present' || status === 'halfPresent') {
                    result.push({ log: logMap[key] || null, emp, date: dateStr });
                }
            }
        });
        
        result.sort((a, b) => b.date.localeCompare(a.date));
        return result;
    }


    _buildStatusKeyMap(logs) {
        const map = {};
        logs.forEach(l => {
            const key = l.empId + '_' + l.date;
            const present = parseFloat(l.present ?? 0);
            const absent = parseFloat(l.absent  ?? 0);

            if (present == 1 && absent == 0) {
                const hasBothPunches = (l.missedInPunch == 0 && l.missedOutPunch == 0);
                map[key] = hasBothPunches ? 'present' : 'absent';
            } else if (present == 0.5 && absent == 0.5) {
                map[key] = 'halfPresent';
            } else if (present == 0 && absent == 0) {
                map[key] = 'weeklyOff';
            } else {
                map[key] = 'absent';
            }
        });
        return map;
    }


    _buildLogMap(logs) {
        const map = {};
        logs.forEach(l => {
            const key = l.empId + '_' + l.date;
            const existing = map[key];
            if (!existing || parseFloat(l.present) > parseFloat(existing.present)) {
                map[key] = l;
            }
        });
        return map;
    }


    async fetchCompaniesOrder() {
        try {
            const url = new URL(window.APP_CONFIG.API_URL, window.location.origin);
            url.searchParams.set('action', 'get_companies_order');
            const response = await fetch(url.toString());
            return await response.json();
        } catch (error) {
            console.error('Fetch Companies Order Error:', error);
            return { success: false, error: error.message };
        }
    }


    async saveCompaniesOrder(items) {
        try {
            const url = new URL(window.APP_CONFIG.API_URL, window.location.origin);
            url.searchParams.set('action', 'save_companies_order');
            const response = await fetch(url.toString(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'save_companies_order', items })
            });
            return await response.json();
        } catch (error) {
            console.error('Save Companies Order Error:', error);
            return { success: false, error: error.message };
        }
    }


    async fetchDepartmentsOrder() {
        try {
            const url = new URL(window.APP_CONFIG.API_URL, window.location.origin);
            url.searchParams.set('action', 'get_departments_order');
            const response = await fetch(url.toString());
            return await response.json();
        } catch (error) {
            console.error('Fetch Departments Order Error:', error);
            return { success: false, error: error.message };
        }
    }


    async saveDepartmentsOrder(items) {
        try {
            const url = new URL(window.APP_CONFIG.API_URL, window.location.origin);
            url.searchParams.set('action', 'save_departments_order');
            const response = await fetch(url.toString(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'save_departments_order', items })
            });
            return await response.json();
        } catch (error) {
            console.error('Save Departments Order Error:', error);
            return { success: false, error: error.message };
        }
    }
}

window.AttendanceModel = AttendanceModel;
