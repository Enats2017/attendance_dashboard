    console.log('MODEL VERSION CHECK: v2-with-commit-fix', Date.now());
    class AttendanceModel {
        constructor() {
            this.state = {
                activeTab: 'feature',
                lastUpdated: null,
                data: {
                    employees: [],
                    attendanceLogs: [],
                    counts: { In: 0, Out: 0 },
                    designationFamilies: [],
                    designationToFamilyMap: {}
                },
                filterLists: null,
                filters: {
                    dateFrom: this._getToday(),
                    dateTo: this._getToday(),
                    company: 'All',
                    dept: 'All',
                    gender: 'All',
                    shift: 'All',
                    location: 'All',
                    subadminUserId: null,
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

                if (this.state.filters.subadminUserId) {
                    [urlDepts, urlComps, urlShifts].forEach(u => u.searchParams.set('subadmin_user_id', this.state.filters.subadminUserId));
                }

                const safeJson = async (response) => {
                    const text = await response.text();
                    if (!text || text.trim() === '') return [];
                    try {
                        return JSON.parse(text);
                    } catch (e) {
                        console.error('Invalid JSON response:', text.substring(0, 200));
                        return [];
                    }
                };

                const [deptRes, compRes, shiftRes] = await Promise.all([
                    fetch(urlDepts.toString(), { credentials: 'include' }).then(safeJson),
                    fetch(urlComps.toString(), { credentials: 'include' }).then(safeJson),
                    fetch(urlShifts.toString(), { credentials: 'include' }).then(safeJson)
                ]);

                this.state.filterLists = {
                    depts: Array.isArray(deptRes) ? deptRes.map(d => d.DepartmentName).filter(Boolean) : [],
                    companies: Array.isArray(compRes) ? compRes.map(c => c.CompanyName).filter(Boolean) : [],
                    shifts: (Array.isArray(shiftRes) ? shiftRes.map(s => s.ShiftName).filter(Boolean) : []).concat('No Shift')
                };

                this._commit();              // ← ADD THIS LINE
                return { success: true };

            } catch (error) {
                console.error('Fetch Filter Options Error:', error);
                this.state.filterLists = { depts: [], companies: [], shifts: ['No Shift'] };   
                this._commit();
                return { success: false, error: error.message };
            }
        }


        async fetchSubAdmins() {
            if (this.state.subAdminList) return { success: true };
            try {
                const url = new URL(window.APP_CONFIG.API_URL, window.location.origin);
                url.searchParams.set('action', 'get_subadmins');
                const response = await fetch(url.toString(), { credentials: 'include' });
                const data = await response.json();
                this.state.subAdminList = (data.success ? data.data : []) || [];
                this._commit();
                return data;
            } catch (error) {
                console.error('Fetch SubAdmins Error:', error);
                this.state.subAdminList = [];
                return { success: false };
            }
        }


        async fetchData() {
            console.trace("fetchData called");
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
                if (this.state.filters.subadminUserId) {
                    url.searchParams.set('subadmin_user_id', this.state.filters.subadminUserId);
                }
                console.log('Dashboard URL:', url.toString());
                const response = await fetch(url.toString(), { credentials: 'include' });
                const data = await response.json();

                if (data.success) {
                    this.state.data = {
                        employees: data.employees,              
                        resignedEmployees: data.resignedEmployees || [],
                        newJoinedEmployees: data.newJoinedEmployees || [],
                        attendanceLogs: data.attendanceLogs,
                        shiftStats: data.shiftStats || [],
                        counts: data.counts,
                        singlePunchKeys: new Set(data.singlePunchKeys || []),
                        singlePunchData: data.singlePunchData || {},
                        employeeDayStatus: data.employeeDayStatus || {},
                        punchFrequency: data.punchFrequency || { zeroPunches: 0, punches1to5: 0, punches6to10: 0 },
                         punchFrequencyDetails: data.punchFrequencyDetails || { zero: [], oneToFive: [], sixToTen: [] },
                        punchFrequencyEmpIds: data.punchFrequencyEmpIds || { zero: [], oneToFive: [], sixToTen: [] }
                    };
                    this.state.dashboardData = {
                        employees: data.dashboardEmployees || [],
                        attendanceLogs: data.attendanceLogs,     
                        todayStats: data.todayStats || {},
                        requiredHeadcount: data.requiredHeadcount ?? 0,
                        totalMachines: data.totalMachines ?? 0,
                        gapHeadcount: data.gapHeadcount ?? 0,
                        requiredHeadcountByDept: data.requiredHeadcountByDept || {},
                        requiredHeadcountByLocation: data.requiredHeadcountByLocation || [],
                        locationScope: data.locationScope || { count: 0, locations: [] }
                    };
                    this.state.todayStats = data.todayStats || {
                        present: 0, 
                        halfPresent: 0, 
                        weeklyOffPresent: 0,     
                        weeklyOffHalfPresent: 0, 
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
                        staffWeeklyOffPresent: 0,      
                        staffWeeklyOffHalfPresent: 0,  
                        staffWeeklyOff: 0, 
                        staffAbsent: 0,
                        workerTotal: 0, 
                        workerPresent: 0, 
                        workerHalfPresent: 0, 
                        workerWeeklyOff: 0, 
                        workerAbsent: 0
                    };
                    
                    this.state.requiredHeadcount = data.requiredHeadcount ?? 0;
                    this.state.gapHeadcount = data.gapHeadcount ?? 0;
                    this.state.requiredHeadcountByDept = data.requiredHeadcountByDept || {};
                    this.state.requiredHeadcountByLocation = data.requiredHeadcountByLocation || [];
                    this.state.teamConfig = data.teamConfig || { staffTeamId: 7, workerTeamId: 6 };
                    this.state.placeholderIds = data.placeholderIds || {
                        designation: [], department: [], company: [], shiftGroup: [], location: []
                    };
                    this.state.locationScope = data.locationScope || { count: 0, locations: [] };
                    this.state.isMaster = (data.isMaster !== undefined) ? !!data.isMaster : (window.HRMS_USER?.isMaster ?? true);

                    this.state.lastUpdated = new Date().toLocaleTimeString();
                    
                    window.EMPLOYEES = data.employees;
                    window.ATTENDANCE_LOGS = data.attendanceLogs;

                    this._commit();
                    this.loadDesignationFamiliesForStats();
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


        setSubAdmin(userId) {
            this.state.filters.subadminUserId = userId || null;
            this.state.filterLists = null;   
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
            if ((tabId === 'sort_order' || tabId === 'units') && !(window.HRMS_USER && window.HRMS_USER.isMaster)) {
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
                if (filters.gender !== 'All' && emp.gender !== filters.gender) {
                    return false;
                }
                if (filters.shift !== 'All' && emp.shift !== filters.shift) {
                    return false;
                }
                return true;
            });

            const emps = data.employees.filter(emp => {
                if (filters.gender !== 'All' && emp.gender !== filters.gender) {
                    return false;
                }
                if (filters.shift !== 'All' && emp.shift !== filters.shift) {
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


        _toMinutes(timeStr) {
            if (!timeStr) return null;

            const parts = String(timeStr).split(':');
            if (parts.length < 2) return null;

            const h = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10);

            if (isNaN(h) || isNaN(m)) return null;

            return h * 60 + m;
        }

        _isNightShiftTiming(startTime, endTime) {
            const start = this._toMinutes(startTime);
            const end = this._toMinutes(endTime);

            if (start === null || end === null) return false;
            if (start === end) return false;

            return end < start;
        }

        getNightShiftData() {
            const { logs, emps } = this.getFilteredData();

            const nightShiftLogs = logs.filter(log => this._isNightShiftTiming(log.shiftStart, log.shiftEnd));

            const nightEmpIdSet = new Set(nightShiftLogs.map(log => log.empId));

            const nightEmployees = emps.filter(emp => nightEmpIdSet.has(emp.id));

            const nightEmpMap = {};

            nightEmployees.forEach(emp => {
                nightEmpMap[emp.id] = emp;
            });

            return {
                logs: nightShiftLogs,
                emps: nightEmployees,
                empMap: nightEmpMap
            };
        }


        getNightShiftStats() {
            const { logs, emps } = this.getNightShiftData();
            const todayStats = this.state.todayStats;

            const isPresent = (l) => l.present === 1 || l.status === 'Present';
            const totalPresentRecords = logs.filter(isPresent).length;
            const totalAbsentRecords = Math.max(0, emps.length - totalPresentRecords);

            const avgHours = logs.length ? (logs.reduce((sum, l) => sum + (l.hoursWorked || 0), 0) / logs.length).toFixed(1) : 0;

            return {
                present: totalPresentRecords,
                halfPresent: logs.filter(l => (l.detailedStatusCode || '').toUpperCase().includes('½')).length,
                weeklyOffPresent: 0,
                weeklyOffHalfPresent: 0,
                weeklyOff: logs.filter(l => (l.detailedStatusCode || '').toUpperCase() === 'WO').length,
                absent: totalAbsentRecords,
                singlePunch: logs.filter(l => l.status === 'Single Punch').length,
                lateIn: logs.filter(l => (l.lateBy || 0) > 0).length,
                earlyOut: logs.filter(l => (l.earlyBy || 0) > 0).length,
                avgHours,
                total: emps.length,
                resigned: 0,
                newJoined: 0,
                filteredIn: 0,
                filteredOut: 0
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
            if (age < 60) return '55–59';
            return '60+';
        }


        findNoPunchEmployees() {
            const { filters } = this.state;
            const { logs, emps } = this.getFilteredData();
            const statusKeyMap = this._buildStatusKeyMap(logs);

            const result = [];
            emps.forEach(emp => {
                const doj = emp.doj ? String(emp.doj).slice(0, 10) : null;
                const dor = emp.dor ? String(emp.dor).slice(0, 10) : null;
                const effectiveStartDate = doj && doj > filters.dateFrom ? doj : filters.dateFrom;
                const effectiveEndDate = dor && dor < filters.dateTo ? dor : filters.dateTo;

                if (effectiveStartDate > effectiveEndDate) {
                    return;
                }

                const allDates = this._getDateRangeUTC(effectiveStartDate, effectiveEndDate);

                let noPunchDays = 0;
                const noPunchLogs = [];
                allDates.forEach((dt, index) => {
                    const key = `${emp.id}_${dt}`;
                    const status = statusKeyMap[key] || "absent";

                    if (status === "absent") {
                        noPunchDays++;
                        noPunchLogs.push({
                            date: dt,
                            status: status
                        });
                        return;
                    }

                    if (status === "weeklyOff") {
                        const previousDate = allDates[index - 1];
                        const nextDate = allDates[index + 1];
                        const previousStatus = previousDate ? statusKeyMap[`${emp.id}_${previousDate}`] || "absent" : null;
                        const nextStatus = nextDate ? statusKeyMap[`${emp.id}_${nextDate}`] || "absent" : null;
                        const isSandwich = previousStatus === "absent" && nextStatus === "absent";
                        if (isSandwich) {
                            noPunchDays++;
                            noPunchLogs.push({
                                date: dt,
                                status: status
                            });
                        }
                    }
                });

                if (noPunchDays >= 5) {
                    result.push({
                        emp: emp,
                        count: noPunchDays,
                        noPunchDays: noPunchDays,
                        logs: noPunchLogs
                    });
                }
            });

            result.sort((a, b) => b.count - a.count);
            return result;
        }


        _isPlaceholderValue(name) {
            if (!name) return true; // null/undefined/blank
            const cleaned = String(name).trim().toLowerCase();
            if (cleaned === '') return true;
            if (cleaned === '0') return true;
            if (cleaned === '.') return true;
            if (cleaned === 'null') return true;
            if (cleaned === 'none') return true;
            if (cleaned === 'unknown') return true;
            if (cleaned.startsWith('default')) return true;
            return false;
        }


        findMissingDataEmployees() {
            const { emps } = this.getFilteredData();
            const result = [];

            const staffTeamId = this.state.teamConfig?.staffTeamId ?? 7;
            const workerTeamId = this.state.teamConfig?.workerTeamId ?? 6;
            const contractTeamId = this.state.teamConfig?.contractTeamId ?? 8;
            const consultantTeamId = this.state.teamConfig?.consultantTeamId ?? 9;
            const placeholderIds = this.state.placeholderIds || {
                designation: [], department: [], company: [], shiftGroup: [], location: []
            };

            emps.forEach(emp => {
                const issues = [];
                const addIssue = (field, reason, rawValue) => {
                    issues.push({ field, reason, rawValue: rawValue ?? null });
                };

                if (!emp.code) addIssue('Employee Code', 'missing', emp.code);
                if (!emp.name) addIssue('Name', 'missing', emp.name);
                if (!emp.dobRaw) addIssue('DOB', 'missing', emp.dobRaw);
                if (!emp.genderRaw) addIssue('Gender', 'missing', emp.genderRaw);

                if (emp.categoryIdRaw === null || emp.categoryIdRaw === undefined || emp.categoryIdRaw === '') {
                    addIssue('Category', 'missing', emp.categoryIdRaw);
                }
                const validTeamIds = [staffTeamId, workerTeamId, contractTeamId, consultantTeamId];
                if (emp.team === null || emp.team === undefined || !validTeamIds.includes(emp.team)) {
                    addIssue('Team', 'unassigned/invalid', emp.team);
                }
                if (!emp.designationRaw) {
                    addIssue('Designation', 'missing id', emp.designationRaw);
                } else if (!emp.designationNameRaw) {
                    addIssue('Designation', 'invalid link (id has no matching name)', emp.designationId);
                } else if (this._isPlaceholderValue(emp.designationNameRaw) || (placeholderIds.designation || []).includes(emp.designationId)) {
                    addIssue('Designation', 'placeholder value', emp.designationId);
                }
                if (!emp.shiftGroupId || (placeholderIds.shiftGroup || []).includes(emp.shiftGroupId)) {
                    addIssue('Shift Group', 'not set', emp.shiftGroupId);
                }
                if (!emp.doj) {
                    addIssue('DOJ', 'missing', emp.doj);
                }
                if (emp.dobRaw && emp.dobRaw.slice(0, 4) === '1900') {
                    addIssue('DOB', 'invalid placeholder year (1900)', emp.dobRaw);
                } else if (emp.dobRaw && emp.doj && emp.dobRaw.slice(0, 10) === emp.doj.slice(0, 10)) {
                    addIssue('DOB', 'same as DOJ', emp.dobRaw);
                    addIssue('DOJ', 'same as DOB', emp.doj);
                }
                if (this._isPlaceholderValue(emp.company) || (placeholderIds.company || []).includes(emp.companyId)) {
                    addIssue('Company', 'not set', emp.companyId);
                }
                if (this._isPlaceholderValue(emp.dept) || (placeholderIds.department || []).includes(emp.deptId)) {
                    addIssue('Department', 'not set', emp.deptId);
                }
                if (this._isPlaceholderValue(emp.location) || (placeholderIds.location || []).includes(emp.locationId)) {
                    addIssue('Location', 'not set', emp.locationId);
                }

                if (issues.length > 0) {
                    result.push({ emp, issues, missingFields: issues.map(i => i.field) });
                }
            });

            return result;
        }


        findUncountedStaffWorkmenEmployees() {
            const { emps } = this.getFilteredData();
            const staffTeamId = this.state.teamConfig?.staffTeamId ?? 7;
            const workerTeamId = this.state.teamConfig?.workerTeamId ?? 6;

            return emps.filter(emp => emp.team !== staffTeamId && emp.team !== workerTeamId);
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
            const { filters } = this.state;
            const { logs, emps } = this.getFilteredData();

            const statusKeyMap = this._buildStatusKeyMap(logs);
            const dateRange = this._getDateRangeUTC(filters.dateFrom, filters.dateTo);

            const counts = {
                present: 0,
                halfPresent: 0,
                weeklyOffPresent: 0,
                weeklyOffHalfPresent: 0,
                weeklyOff: 0,
                absent: 0,
                singlePunch: 0
            };

            emps.forEach(emp => {
                dateRange.forEach(dateStr => {
                    const key = emp.id + '_' + dateStr;
                    const status = statusKeyMap[key] || 'absent';
                    if (Object.prototype.hasOwnProperty.call(counts, status)) {
                        counts[status]++;
                    }
                });
            });

            const manualPunchCount = logs.filter(l => l.isManualPunch === 1).length;
            const lateInCount = logs.filter(l => (l.lateBy || 0) > 0).length;
            const earlyOutCount = logs.filter(l => (l.earlyBy || 0) > 0).length;
            const avgHours = logs.length
                ? +(logs.reduce((sum, l) => sum + (l.hoursWorked || 0), 0) / logs.length).toFixed(2)
                : 0;

            const totalIn = logs.filter(l => (parseFloat(l.present) > 0 || l.missedOutPunch == 1) && l.isManualPunch !== 1).length;
            const totalOut = logs.filter(l => parseFloat(l.present) > 0 && l.missedInPunch != 1 && l.isManualPunch !== 1).length;

            return {
                present: counts.present,
                halfPresent: counts.halfPresent,
                weeklyOffPresent: counts.weeklyOffPresent,
                weeklyOffHalfPresent: counts.weeklyOffHalfPresent,
                weeklyOff: counts.weeklyOff,
                absent: counts.absent,
                singlePunch: counts.singlePunch,
                manualPunch: manualPunchCount,
                lateIn: lateInCount,
                earlyOut: earlyOutCount,
                avgHours,
                total: emps.length,
                resigned: this.getResignedEmployees().length,
                newJoined: this.getNewJoinedEmployees().length,
                filteredIn: totalIn,
                filteredOut: totalOut
            };
        }

    
        getRequiredHeadcount() {
            return (this.state.dashboardData?.requiredHeadcount) || 0;
        }

        getTotalMachines() {                                          
            return (this.state.dashboardData?.totalMachines) || 0;    
        }                                                             


        getGapHeadcount() {
            return (this.state.dashboardData?.gapHeadcount) || 0;
        }

        getRequiredHeadcountByDept(dept) {
            return ((this.state.dashboardData?.requiredHeadcountByDept) || {})[dept] || { required: 0, available: 0, gap: 0 };
        }

        getRequiredHeadcountByLocation() {
            return ((this.state.dashboardData?.requiredHeadcountByLocation) || []).slice().sort((a, b) =>
                (a.locationName || "").localeCompare(b.locationName || "", undefined, { numeric: true, sensitivity: "base" })
            );
        }

        sortLocations(locations) {
            return [...locations].sort((a, b) => (a || "").localeCompare(b || "", undefined, { numeric: true, sensitivity: "base" }));
        }

        getLocationScope() {
            return (this.state.dashboardData?.locationScope) || { count: 0, locations: [] };
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

            const statusKeyMap = this._buildStatusKeyMap(logs);
            const logMap = this._buildLogMap(logs);

            const fromStr = filters.dateFrom;
            const toStr = filters.dateTo;
            const result = [];

            const dateRange = this._getDateRangeUTC(fromStr, toStr);
            emps.forEach(emp => {
                dateRange.forEach(dateStr => {
                    const key = emp.id + '_' + dateStr;
                    if (statusKeyMap[key] === 'present') {
                        result.push({ log: logMap[key] || null, emp, date: dateStr });
                    }
                });
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

            const dateRange = this._getDateRangeUTC(fromStr, toStr);
            emps.forEach(emp => {
                dateRange.forEach(dateStr => {
                    const key = emp.id + '_' + dateStr;
                    const status = statusKeyMap[key] ?? 'absent';
                    if (status === 'absent') {
                        result.push({ log: logMap[key] || null, emp, date: dateStr });
                    }
                });
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

            const dateRange = this._getDateRangeUTC(fromStr, toStr);
            emps.forEach(emp => {
                dateRange.forEach(dateStr => {
                    const key = emp.id + '_' + dateStr;
                    if (statusKeyMap[key] === 'halfPresent') {
                        result.push({ log: logMap[key] || null, emp, date: dateStr });
                    }
                });
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

            const dateRange = this._getDateRangeUTC(fromStr, toStr);
            emps.forEach(emp => {
                dateRange.forEach(dateStr => {
                    const key = emp.id + '_' + dateStr;
                    if (statusKeyMap[key] === 'weeklyOff') {
                        result.push({ log: logMap[key] || null, emp, date: dateStr });
                    }
                });
            });

            result.sort((a, b) => b.date.localeCompare(a.date));
            return result;
        }


        getSinglePunchEmployees() {
            const { filters } = this.state;
            const { logs, emps } = this.getFilteredData();

            const statusKeyMap = this._buildStatusKeyMap(logs);
            const logMap = this._buildLogMap(logs);
            const singlePunchKeys = this.state.data.singlePunchKeys || new Set();
            const singlePunchData = this.state.data.singlePunchData || {};

            const fromStr = filters.dateFrom;
            const toStr = filters.dateTo;
            const result = [];

            const dateRange = this._getDateRangeUTC(fromStr, toStr);
            emps.forEach(emp => {
                dateRange.forEach(dateStr => {
                    const key = emp.id + '_' + dateStr;

                    if (statusKeyMap[key] !== 'singlePunch') return;

                    if (singlePunchKeys.has(key)) {
                        // no real log row exists — build a synthetic one from singlePunchData
                        const punchInfo = singlePunchData[key] || {};
                        result.push({
                            log: {
                                empId: emp.id,
                                date: dateStr,
                                inTime: punchInfo.direction === 'in' ? punchInfo.time : null,
                                outTime: punchInfo.direction === 'out' ? punchInfo.time : null,
                                status: 'Single Punch',
                                present: 0,
                                absent: 1,
                                hoursWorked: 0,
                                lateBy: 0,
                                earlyBy: 0,
                                shiftStart: punchInfo.shiftStart || null,
                                shiftEnd: punchInfo.shiftEnd || null,
                                shiftName: punchInfo.shiftName || emp.shift || 'No Shift',
                                shiftGroupId: punchInfo.shiftGroupId ?? emp.shiftGroupId ?? null,
                                shiftGroupName: punchInfo.shiftGroupName || emp.shiftGroupName || 'No Shift Group',
                                detailedStatus: 'Single Punch',
                                detailedStatusCode: 'SP'
                            },
                            emp,
                            date: dateStr
                        });
                    } else {
                        result.push({ log: logMap[key] || null, emp, date: dateStr });
                    }
                });
            });

            result.sort((a, b) => b.date.localeCompare(a.date));
            return result;
        }


        getSinglePunchEmployeesGrouped() {
            const items = this.getSinglePunchEmployees();
            const grouped = {};
            items.forEach(({ log, emp, date }) => {
                if (!grouped[emp.id]) {
                    grouped[emp.id] = {
                        emp,
                        count: 0,
                        logs: [],
                    };
                }
                grouped[emp.id].count++;
                grouped[emp.id].logs.push({
                    log,
                    date,
                });
            });

            return Object.values(grouped).sort((a, b) => {
                return b.count - a.count;
            });
        }        


        getManualPunchEmployees() {
            const { logs, empMap } = this.getFilteredData();
            const result = logs.filter(l => l.isManualPunch === 1).map(log => ({
                log,
                emp: empMap[log.empId],
                date: log.date
            })).filter(item => !!item.emp);
            result.sort((a, b) => b.date.localeCompare(a.date));
            return result;
        }


        getOvertimeEmployees() {
            const { filters } = this.state;
            const { logs, emps } = this.getFilteredData();
            const fromStr = filters.dateFrom;
            const toStr = filters.dateTo;

            const logMap = {};
            logs.forEach(l => {
                if ((l.overtime || 0) > 0) {
                    logMap[l.empId + '_' + l.date] = l;
                }
            });

            const result = [];
            const dateRange = this._getDateRangeUTC(fromStr, toStr);
            emps.forEach(emp => {
                dateRange.forEach(dateStr => {
                    const log = logMap[emp.id + '_' + dateStr];
                    if (log) result.push({ log, emp, date: dateStr });
                });
            });

            result.sort((a, b) => b.date.localeCompare(a.date));
            return result;
        }

        getOvertimeByShift() {
            const items = this.getOvertimeEmployees();
            const groups = {};
            items.forEach(({ log, emp }) => {
                const shiftName = log.shiftName || emp.shift || 'No Shift';
                if (!groups[shiftName]) {
                    groups[shiftName] = { shiftName, totalMinutes: 0, empSet: new Set(), recordCount: 0 };
                }
                groups[shiftName].totalMinutes += (log.overtime || 0);
                groups[shiftName].empSet.add(emp.id);
                groups[shiftName].recordCount++;
            });
            return Object.values(groups).map(g => ({
                shiftName: g.shiftName,
                totalMinutes: g.totalMinutes,
                totalHours: +(g.totalMinutes / 60).toFixed(2),
                empCount: g.empSet.size,
                recordCount: g.recordCount
            })).sort((a, b) => b.totalMinutes - a.totalMinutes);
        }


        getManualPunchByShift() {
            const items = this.getManualPunchEmployees(); 
            const groups = {};
            items.forEach(({ log, emp }) => {
                const shiftName = log.shiftName || emp.shift || 'No Shift';
                if (!groups[shiftName]) {
                    groups[shiftName] = { shiftName, count: 0, empSet: new Set() };
                }
                groups[shiftName].count++;
                groups[shiftName].empSet.add(emp.id);
            });
            return Object.values(groups)
                .map(g => ({ shiftName: g.shiftName, count: g.count, empCount: g.empSet.size }))
                .sort((a, b) => b.count - a.count);
        }


        getLateInEmployees() {
            const { filters } = this.state;
            const { logs, emps } = this.getFilteredData();
            const singlePunchKeys = this.state.data.singlePunchKeys || new Set();
            const singlePunchData = this.state.data.singlePunchData || {};

            const logMap = {};
            logs.forEach(l => {
                const key = l.empId + '_' + l.date;
                const existing = logMap[key];
                if (!existing || parseFloat(l.present) > parseFloat(existing.present)) {
                    logMap[key] = l;
                }
            });

            singlePunchKeys.forEach(key => {
                const punchInfo = singlePunchData[key] || {};
                const existing = logMap[key];
                logMap[key] = {
                    ...(existing || {}),
                    status: 'Single Punch',
                    detailedStatus: 'Single Punch',
                    detailedStatusCode: 'SP',
                    inTime: punchInfo.direction === 'in' ? punchInfo.time : (existing ? existing.inTime : null),
                    outTime: punchInfo.direction === 'out' ? punchInfo.time : (existing ? existing.outTime : null),
                };
            });

            const fromStr = filters.dateFrom;
            const toStr = filters.dateTo;
            const result = [];

            const dateRange = this._getDateRangeUTC(fromStr, toStr);
            emps.forEach(emp => {
                dateRange.forEach(dateStr => {
                    const log = logMap[emp.id + '_' + dateStr];
                    if (log && (log.lateBy || 0) > 0) {
                        result.push({ log, emp, date: dateStr });
                    }
                });
            });

            result.sort((a, b) => b.date.localeCompare(a.date));
            return result;
        }

        getLateInEmployeesGrouped() {
            const items = this.getLateInEmployees();
            const grouped = {};
            items.forEach(({ log, emp, date }) => {
                if (!grouped[emp.id]) grouped[emp.id] = { emp, count: 0, logs: [] };
                grouped[emp.id].count++;
                grouped[emp.id].logs.push(log);
            });
            return Object.values(grouped).sort((a, b) => b.count - a.count);
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

            const dateRange = this._getDateRangeUTC(fromStr, toStr);
            emps.forEach(emp => {
                dateRange.forEach(dateStr => {
                    const log = logMap[emp.id + '_' + dateStr];

                    if (log && (log.earlyBy || 0) > 0) {
                        result.push({ log, emp, date: dateStr });
                    }
                });
            });

            result.sort((a, b) => b.date.localeCompare(a.date));
            return result;
        }

        getEarlyOutEmployeesGrouped() {
            const items = this.getEarlyOutEmployees();
            const grouped = {};
            items.forEach(({ log, emp, date }) => {
                if (!grouped[emp.id]) grouped[emp.id] = { emp, count: 0, logs: [] };
                grouped[emp.id].count++;
                grouped[emp.id].logs.push(log);
            });
            return Object.values(grouped).sort((a, b) => b.count - a.count);
        }

        getResignedEmployees() {
            const resigned = this.state.data.resignedEmployees || [];
            const { filters } = this.state;
            return resigned.filter(emp => {
                if (filters.gender !== 'All' && emp.gender !== filters.gender) {
                    return false;
                }
                return true;
            }).sort((a, b) => (b.dor || '').localeCompare(a.dor || '')).map(emp => ({ log: null, emp }));
        }


        getNewJoinedEmployees() {
            const newJoined = this.state.data.newJoinedEmployees || [];
            const { filters } = this.state;
            return newJoined.filter(emp => {
                if (filters.gender !== 'All' && emp.gender !== filters.gender) {
                    return false;
                }
                return true;
            }).sort((a, b) => (b.doj || '').localeCompare(a.doj || '')).map(emp => ({ log: null, emp }));
        }


        async fetchDesignationsOrder() {
            try {
                const url = new URL(window.APP_CONFIG.API_URL, window.location.origin);
                url.searchParams.set('action', 'get_designations_order');
                const response = await fetch(url.toString(), { credentials: 'include' });
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
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'save_designations_order', items })
                });
                const data = await response.json();
                return data;
            } catch (error) {
                console.error('Save Designations Order Error:', error);
                return { success: false, error: error.message };
            }
        }


        async fetchDesignationFamilies() {
            try {
                const url = new URL(window.APP_CONFIG.API_URL, window.location.origin);
                url.searchParams.set('action', 'get_designation_families');
                const response = await fetch(url.toString(), { credentials: 'include' });
                return await response.json();
            } catch (error) {
                console.error('Fetch Designation Families Error:', error);
                return { success: false, error: error.message };
            }
        }


        async loadDesignationFamiliesForStats() {
            if (this.state.data.designationFamilies && this.state.data.designationFamilies.length) {
                return { success: true };
            }
            const res = await this.fetchDesignationFamilies();
            if (res && res.success) {
                this.state.data.designationFamilies = res.data || [];
                const map = {};
                (res.data || []).forEach(fam => {
                    (fam.designations || []).forEach(d => {
                        map[d.id] = { familyId: fam.id, familyName: fam.name };
                    });
                });
                this.state.data.designationToFamilyMap = map;
                this._commit();
            }
            return res;
        }


        async saveDesignationFamily(familyName, sortOrder = 0, id = 0) {
            try {
                const url = new URL(window.APP_CONFIG.API_URL, window.location.origin);
                url.searchParams.set('action', 'save_designation_family');
                const response = await fetch(url.toString(), {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'save_designation_family', id, familyName, sortOrder })
                });
                return await response.json();
            } catch (error) {
                console.error('Save Designation Family Error:', error);
                return { success: false, error: error.message };
            }
        }


        async deleteDesignationFamily(id) {
            try {
                const url = new URL(window.APP_CONFIG.API_URL, window.location.origin);
                url.searchParams.set('action', 'delete_designation_family');
                const response = await fetch(url.toString(), {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'delete_designation_family', id })
                });
                return await response.json();
            } catch (error) {
                console.error('Delete Designation Family Error:', error);
                return { success: false, error: error.message };
            }
        }


        async saveDesignationFamilyMapping(familyId, designationIds) {
            try {
                const url = new URL(window.APP_CONFIG.API_URL, window.location.origin);
                url.searchParams.set('action', 'save_designation_family_mapping');
                const response = await fetch(url.toString(), {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'save_designation_family_mapping', familyId, designationIds })
                });
                return await response.json();
            } catch (error) {
                console.error('Save Designation Family Mapping Error:', error);
                return { success: false, error: error.message };
            }
        }


        async fetchUnmappedDesignations() {
            try {
                const url = new URL(window.APP_CONFIG.API_URL, window.location.origin);
                url.searchParams.set('action', 'get_unmapped_designations');
                const response = await fetch(url.toString(), { credentials: 'include' });
                return await response.json();
            } catch (error) {
                console.error('Fetch Unmapped Designations Error:', error);
                return { success: false, error: error.message };
            }
        }

        
        getStaffEmployees() {
            const staffTeamId = this.state.teamConfig?.staffTeamId ?? 7;
            const { logs, emps } = this.getFilteredData();
            const staffEmps = emps.filter(emp => emp.team === staffTeamId);
            const logMap = this._buildLogMap(logs);
            const statusMap = this._buildStatusKeyMap(logs);       
            const { dateFrom, dateTo } = this.state.filters;

            const result = [];
            
            const dateRange = this._getDateRangeUTC(dateFrom, dateTo);
            staffEmps.forEach(emp => {
                dateRange.forEach(dateStr => {
                    const key = emp.id + '_' + dateStr;
                    const status = statusMap[key];
                    if (status === 'present' || status === 'halfPresent') {
                        result.push({ log: logMap[key] || null, emp, date: dateStr });
                    }
                });
            });
            
            result.sort((a, b) => b.date.localeCompare(a.date));
            return result;
        }


        getWorkerEmployees() {
            const workerTeamId = this.state.teamConfig?.workerTeamId ?? 6;
            const { logs, emps } = this.getFilteredData();
            const workerEmps = emps.filter(emp => emp.team === workerTeamId);
            const logMap = this._buildLogMap(logs);
            const statusMap = this._buildStatusKeyMap(logs);
            const { dateFrom, dateTo } = this.state.filters;

            const result = [];

            const dateRange = this._getDateRangeUTC(dateFrom, dateTo);
            workerEmps.forEach(emp => {
                dateRange.forEach(dateStr => {
                    const key = emp.id + '_' + dateStr;
                    const status = statusMap[key];
                    if (status === 'present' || status === 'halfPresent') {
                        result.push({ log: logMap[key] || null, emp, date: dateStr });
                    }
                });
            });
            
            result.sort((a, b) => b.date.localeCompare(a.date));
            return result;
        }


        getContractEmployees() {
            const contractTeamId = this.state.teamConfig?.contractTeamId ?? 8;
            const { logs, emps } = this.getFilteredData();
            const contractEmps = emps.filter(emp => emp.team === contractTeamId);
            const logMap = this._buildLogMap(logs);
            const statusMap = this._buildStatusKeyMap(logs);
            const { dateFrom, dateTo } = this.state.filters;

            const result = [];
            const dateRange = this._getDateRangeUTC(dateFrom, dateTo);
            contractEmps.forEach(emp => {
                dateRange.forEach(dateStr => {
                    const key = emp.id + '_' + dateStr;
                    const status = statusMap[key];
                    if (status === 'present' || status === 'halfPresent') {
                        result.push({ log: logMap[key] || null, emp, date: dateStr });
                    }
                });
            });

            result.sort((a, b) => b.date.localeCompare(a.date));
            return result;
        }

        getConsultantEmployees() {
            const consultantTeamId = this.state.teamConfig?.consultantTeamId ?? 9;
            const { logs, emps } = this.getFilteredData();
            const consultantEmps = emps.filter(emp => emp.team === consultantTeamId);
            const logMap = this._buildLogMap(logs);
            const statusMap = this._buildStatusKeyMap(logs);
            const { dateFrom, dateTo } = this.state.filters;

            const result = [];
            const dateRange = this._getDateRangeUTC(dateFrom, dateTo);
            consultantEmps.forEach(emp => {
                dateRange.forEach(dateStr => {
                    const key = emp.id + '_' + dateStr;
                    const status = statusMap[key];
                    if (status === 'present' || status === 'halfPresent') {
                        result.push({ log: logMap[key] || null, emp, date: dateStr });
                    }
                });
            });

            result.sort((a, b) => b.date.localeCompare(a.date));
            return result;
        }


        getUnassignedEmployees() {
            return this.findUncountedStaffWorkmenEmployees().map(emp => ({ log: null, emp, date: null }));
        }


        getWeeklyOffPresentEmployees() {
            const { filters } = this.state;
            const { logs, emps } = this.getFilteredData();
            const statusKeyMap = this._buildStatusKeyMap(logs);
            const logMap = this._buildLogMap(logs);
            const fromStr = filters.dateFrom;
            const toStr = filters.dateTo;
            const result = [];

            const dateRange = this._getDateRangeUTC(fromStr, toStr);
            emps.forEach(emp => {
                dateRange.forEach(dateStr => {
                    const key = emp.id + '_' + dateStr;
                    if (statusKeyMap[key] === 'weeklyOffPresent') {
                        result.push({ log: logMap[key] || null, emp, date: dateStr });
                    }
                });
            });

            result.sort((a, b) => b.date.localeCompare(a.date));
            return result;
        }

        getWeeklyOffHalfPresentEmployees() {
            const { filters } = this.state;
            const { logs, emps } = this.getFilteredData();
            const statusKeyMap = this._buildStatusKeyMap(logs);
            const logMap = this._buildLogMap(logs);
            const fromStr = filters.dateFrom;
            const toStr = filters.dateTo;
            const result = [];

            const dateRange = this._getDateRangeUTC(fromStr, toStr);
            emps.forEach(emp => {
                dateRange.forEach(dateStr => {
                    const key = emp.id + '_' + dateStr;
                    if (statusKeyMap[key] === 'weeklyOffHalfPresent') {
                        result.push({ log: logMap[key] || null, emp, date: dateStr });
                    }
                });
            });

            result.sort((a, b) => b.date.localeCompare(a.date));
            return result;
        }


        _buildStatusKeyMap(logs) {
            const singlePunchKeys = this.state.data.singlePunchKeys || new Set();
            const backendStatus = this.state.data.employeeDayStatus || {};
            const map = { ...backendStatus };
            singlePunchKeys.forEach(key => { map[key] = 'singlePunch'; });
            logs.forEach(l => {
                const key = l.empId + '_' + l.date;
                if (map[key] === 'singlePunch') return;
                if (!map[key]) map[key] = l.displayStatus || 'absent';
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


        _getDateRangeUTC(fromStr, toStr) {
            const [fy, fm, fd] = fromStr.split('-').map(Number);
            const [ty, tm, td] = toStr.split('-').map(Number);

            let cur = new Date(Date.UTC(fy, fm - 1, fd));
            const end = new Date(Date.UTC(ty, tm - 1, td));

            const dates = [];
            while (cur <= end) {
                dates.push(cur.toISOString().slice(0, 10));
                cur.setUTCDate(cur.getUTCDate() + 1);
            }
            return dates;
        }


        async fetchCompaniesOrder() {
            try {
                const url = new URL(window.APP_CONFIG.API_URL, window.location.origin);
                url.searchParams.set('action', 'get_companies_order');
                const response = await fetch(url.toString(), { credentials: 'include' });
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
                    credentials: 'include',
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
                const response = await fetch(url.toString(), { credentials: 'include' });
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
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'save_departments_order', items })
                });
                return await response.json();
            } catch (error) {
                console.error('Save Departments Order Error:', error);
                return { success: false, error: error.message };
            }
        }


        async fetchDesignationGlobalOrder() {
            try {
                const url = new URL(window.APP_CONFIG.API_URL, window.location.origin);
                url.searchParams.set('action', 'get_designation_global_order');
                const response = await fetch(url.toString(), { credentials: 'include' });
                return await response.json();
            } catch (error) {
                console.error('Fetch Designation Global Order Error:', error);
                return { success: false, error: error.message };
            }
        }


        async saveDesignationGlobalOrder(items) {
            try {
                const url = new URL(window.APP_CONFIG.API_URL, window.location.origin);
                url.searchParams.set('action', 'save_designation_global_order');
                const response = await fetch(url.toString(), {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'save_designation_global_order', items })
                });
                return await response.json();
            } catch (error) {
                console.error('Save Designation Global Order Error:', error);
                return { success: false, error: error.message };
            }
        }


        async fetchDepartmentDesignationMapping(targetUserId = null) {
            try {
                const url = new URL(window.APP_CONFIG.API_URL, window.location.origin);
                
                url.searchParams.set('action', 'get_department_designation_mapping');

                if (targetUserId) {
                    url.searchParams.set('targetUserId', targetUserId);
                }

                const response = await fetch(url.toString(), {
                    credentials: 'include'
                });

                return await response.json();
            } catch (error) {
                console.error('Fetch Dept-Designation Mapping Error:', error);
                return {
                    success: false,
                    error: error.message
                };
            }
        }


        async saveDepartmentDesignationMapping(items, targetUserId = null) {
            try {
                const url = new URL(window.APP_CONFIG.API_URL, window.location.origin);

                url.searchParams.set('action', 'save_department_designation_mapping');

                const payload = { action: 'save_department_designation_mapping', items };

                if (targetUserId) {
                    payload.targetUserId = targetUserId;
                }

                const response = await fetch(url.toString(), {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                return await response.json();
            } catch (error) {
                console.error('Save Dept-Designation Mapping Error:', error);
                return {
                    success: false,
                    error: error.message
                };
            }
        }


        async deleteDepartmentDesignationMapping(departmentId, designationId, targetUserId = null) {
            try {
                const url = new URL(window.APP_CONFIG.API_URL, window.location.origin);

                url.searchParams.set('action', 'delete_department_designation_mapping');

                const payload = {
                    action: 'delete_department_designation_mapping',
                    departmentId,
                    designationId
                };

                if (targetUserId) {
                    payload.targetUserId = targetUserId;
                }

                const response = await fetch(url.toString(), {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                return await response.json();
            } catch (error) {
                console.error('Delete Dept-Designation Mapping Error:', error);
                return {
                    success: false,
                    error: error.message
                };
            }
        }
    
        getPunchFrequency() {
            return this.state.data.punchFrequency || {
                zeroPunches: 0,
                punches1to5: 0,
                punches6to10: 0
            };
        }

        getZeroPunchEmployees() {
            const ids = this.state.data.punchFrequencyEmpIds?.zero || [];
            const empMap = this.getEmpMap();
            return ids.map(id => ({ log: null, emp: empMap[id], date: null })).filter(item => item.emp);
        }

        get1to5PunchEmployees() {
            const details = this.state.data.punchFrequencyDetails?.oneToFive || [];
            const empMap = this.getEmpMap();
            const logMap = this._buildLogMap(this.state.data.attendanceLogs || []);

            const result = [];
            details.forEach(item => {
                const emp = empMap[item.empId];
                if (!emp) return;
                
                const dates = item.dates || [];

                dates.forEach(d => {
                    const date = d.date;
                    const key = `${item.empId}_${date}`;
                    const attendanceLog = logMap[key] || null;
                    const punchInfo = this.state.data.singlePunchData?.[key];

                    const log = punchInfo ? {
                        ...(attendanceLog || {}),
                        empId: emp.id,
                        date,
                        inTime: punchInfo.direction === 'in' ? punchInfo.time : (attendanceLog?.inTime || null),
                        outTime: punchInfo.direction === 'out' ? punchInfo.time : (attendanceLog?.outTime || null),
                        status: 'Single Punch',
                        detailedStatus: 'Single Punch',
                        detailedStatusCode: 'SP',
                        shiftStart: punchInfo.shiftStart || attendanceLog?.shiftStart || null,
                        shiftEnd: punchInfo.shiftEnd || attendanceLog?.shiftEnd || null,
                        shiftName: punchInfo.shiftName || attendanceLog?.shiftName || emp.shift || 'No Shift',
                        shiftGroupId: punchInfo.shiftGroupId ?? attendanceLog?.shiftGroupId ?? emp.shiftGroupId ?? null,
                        shiftGroupName: punchInfo.shiftGroupName || attendanceLog?.shiftGroupName || emp.shiftGroupName || 'No Shift Group',
                        source: punchInfo.source || 'attendanceLogPunch'
                    } : attendanceLog;

                    result.push({ emp, log, date });
                });
            });

            return result;
        }

        get6to10PunchEmployees() {
            const details = this.state.data.punchFrequencyDetails?.sixToTen || [];
            const empMap = this.getEmpMap();
            const logMap = this._buildLogMap(this.state.data.attendanceLogs || []);

            const result = [];
            details.forEach(item => {
                const emp = empMap[item.empId];
                if (!emp) return;

                const dates = item.dates || [];

                dates.forEach(d => {
                    const date = d.date;
                    const key = `${item.empId}_${date}`;
                    const attendanceLog = logMap[key] || null;
                    const punchInfo = this.state.data.singlePunchData?.[key];

                    const log = punchInfo ? {
                        ...(attendanceLog || {}),
                        empId: emp.id,
                        date,
                        inTime: punchInfo.direction === 'in' ? punchInfo.time : (attendanceLog?.inTime || null),
                        outTime: punchInfo.direction === 'out' ? punchInfo.time : (attendanceLog?.outTime || null),
                        status: 'Single Punch',
                        detailedStatus: 'Single Punch',
                        detailedStatusCode: 'SP',
                        shiftStart: punchInfo.shiftStart || attendanceLog?.shiftStart || null,
                        shiftEnd: punchInfo.shiftEnd || attendanceLog?.shiftEnd || null,
                        shiftName: punchInfo.shiftName || attendanceLog?.shiftName || emp.shift || 'No Shift',
                        shiftGroupId: punchInfo.shiftGroupId ?? attendanceLog?.shiftGroupId ?? emp.shiftGroupId ?? null,
                        shiftGroupName: punchInfo.shiftGroupName || attendanceLog?.shiftGroupName || emp.shiftGroupName || 'No Shift Group',
                        source: punchInfo.source || 'attendanceLogPunch'
                    } : attendanceLog;

                    result.push({ emp, log, date });
                });
            });

            return result;
        }
    }


    window.AttendanceModel = AttendanceModel;
