// ─── Dummy Data matching [MOUNTMERU].[dbo] table structure ───────────────────
// Uses same column names as AttendanceLogs, Employees, Departments tables

// Default STD HC values (from screenshot)
export const DEFAULT_STD_HC = {
  'Customer Technical Services': 1,
  'E&I': 14,
  'HR': 1,
  'Logistics & Warehousing': 16,
  'Mechanical': 15,
  'Production': 79,
  'Purchase': 1,
  'Quality Control': 13,
  'Store': 1,
  'Security': 5,
  'Utility': 11,
  'Housekeeping': 17,
};

// Exact screenshot values for March 2026, Days 1-6
const SCREENSHOT_DEPT_DAYS = {
  'Customer Technical Services': [0, 1, 1, 0, 1, 1],
  'E&I':                         [10, 11, 12, 6, 11, 10],
  'HR':                          [1, 1, 1, 0, 1, 1],
  'Logistics & Warehousing':     [14, 16, 15, 10, 15, 14],
  'Mechanical':                  [11, 12, 12, 9, 12, 13],
  'Production':                  [62, 64, 63, 47, 62, 61],
  'Purchase':                    [0, 1, 1, 0, 1, 1],
  'Quality Control':             [9, 11, 10, 6, 10, 11],
  'Store':                       [1, 1, 1, 1, 1, 0],
  'Security':                    [5, 5, 5, 5, 5, 5],
  'Utility':                     [9, 10, 10, 7, 9, 9],
  'Housekeeping':                [11, 13, 14, 7, 12, 13],
};

const SCREENSHOT_SUMMARY = {
  overtimePaid: [3, 6, 1, 1, 3, 4],
  weeklyOffPH:  [22, 14, 12, 44, 10, 17],
  onLeave:      [22, 20, 18, 33, 27, 22],
  newJoinee:    [0, 0, 0, 0, 0, 0],
  left:         [0, 0, 0, 0, 0, 0],
};

function seededRandom(seed) {
  let x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

export function generateDummyReport(month, year, dayFrom, dayTo, stdHcMap) {
  const hcMap = stdHcMap || DEFAULT_STD_HC;
  const deptNames = Object.keys(hcMap);
  const totalDaysInMonth = new Date(year, month, 0).getDate();
  const clampedTo = Math.min(dayTo, totalDaysInMonth);
  const clampedFrom = Math.max(dayFrom, 1);
  const numDays = clampedTo - clampedFrom + 1;
  const recruitedHC = Object.values(hcMap).reduce((a, b) => a + b, 0);

  const dayTotalPresent = {};
  const dayTotalOT = {};
  const dayTotalWeekOff = {};
  const dayTotalLeave = {};
  const dayTotalNewJoinee = {};
  const dayTotalLeft = {};
  const dayTotalRecruited = {};

  for (let d = clampedFrom; d <= clampedTo; d++) {
    dayTotalPresent[d] = 0;
    dayTotalOT[d] = 0;
    dayTotalWeekOff[d] = 0;
    dayTotalLeave[d] = 0;
    dayTotalNewJoinee[d] = 0;
    dayTotalLeft[d] = 0;
    dayTotalRecruited[d] = recruitedHC;
  }

  const departments = deptNames.map((dept, di) => {
    const stdHc = hcMap[dept] || 0;
    const days = {};

    for (let d = clampedFrom; d <= clampedTo; d++) {
      let present;
      if (month === 3 && year === 2026 && d >= 1 && d <= 6 && SCREENSHOT_DEPT_DAYS[dept]) {
        present = SCREENSHOT_DEPT_DAYS[dept][d - 1];
      } else {
        const seed = di * 37 + d * 13 + month * 7 + year;
        const dayOfWeek = new Date(year, month - 1, d).getDay();
        if (dayOfWeek === 0) {
          present = Math.round(stdHc * 0.15 * seededRandom(seed));
        } else if (dayOfWeek === 6) {
          present = Math.round(stdHc * (0.4 + seededRandom(seed) * 0.3));
        } else {
          present = Math.round(stdHc * (0.65 + seededRandom(seed) * 0.3));
        }
        if (present > stdHc) present = stdHc;
        if (present < 0) present = 0;
      }
      days[d] = present;
      dayTotalPresent[d] += present;
    }

    const sum = Object.values(days).reduce((a, b) => a + b, 0);
    const avgHC = numDays > 0 ? Math.round(sum / numDays) : 0;

    return { department: dept, std_hc: stdHc, days, avg_hc: avgHC };
  });

  for (let d = clampedFrom; d <= clampedTo; d++) {
    if (month === 3 && year === 2026 && d >= 1 && d <= 6) {
      dayTotalOT[d] = SCREENSHOT_SUMMARY.overtimePaid[d - 1];
      dayTotalWeekOff[d] = SCREENSHOT_SUMMARY.weeklyOffPH[d - 1];
      dayTotalLeave[d] = SCREENSHOT_SUMMARY.onLeave[d - 1];
      dayTotalNewJoinee[d] = SCREENSHOT_SUMMARY.newJoinee[d - 1];
      dayTotalLeft[d] = SCREENSHOT_SUMMARY.left[d - 1];
    } else {
      const seed = d * 11 + month * 53 + year;
      const dayOfWeek = new Date(year, month - 1, d).getDay();
      dayTotalOT[d] = Math.round(seededRandom(seed * 2) * 8);
      dayTotalWeekOff[d] = dayOfWeek === 0 ? Math.round(recruitedHC * 0.3 + seededRandom(seed * 3) * 10)
        : dayOfWeek === 6 ? Math.round(recruitedHC * 0.15 + seededRandom(seed * 3) * 8)
        : Math.round(5 + seededRandom(seed * 3) * 15);
      dayTotalLeave[d] = Math.round(12 + seededRandom(seed * 4) * 25);
      dayTotalNewJoinee[d] = seededRandom(seed * 5) > 0.85 ? Math.round(seededRandom(seed * 6) * 3) : 0;
      dayTotalLeft[d] = seededRandom(seed * 7) > 0.92 ? Math.round(seededRandom(seed * 8) * 2) : 0;
    }
  }

  const avgOf = (obj) => {
    const vals = Object.values(obj);
    return vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  };

  return {
    success: true, unit_name: 'PSF', unit_capacity: '150 Tons',
    month, year, day_from: clampedFrom, day_to: clampedTo,
    departments,
    summary: {
      total_present: dayTotalPresent, overtime_paid: dayTotalOT,
      weekly_off_ph: dayTotalWeekOff, on_leave: dayTotalLeave,
      new_joinee: dayTotalNewJoinee, left: dayTotalLeft, recruited_hc: dayTotalRecruited,
    },
    summary_avg: {
      total_present: avgOf(dayTotalPresent), overtime_paid: avgOf(dayTotalOT),
      weekly_off_ph: avgOf(dayTotalWeekOff), on_leave: avgOf(dayTotalLeave),
      new_joinee: avgOf(dayTotalNewJoinee), left: avgOf(dayTotalLeft),
      recruited_hc: avgOf(dayTotalRecruited),
    },
    total_std_hc: recruitedHC,
  };
}
