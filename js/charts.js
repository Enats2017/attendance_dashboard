// charts.js – Premium ApexCharts v3
var Charts = (function () {
  var instances = {};

  // ── Rich Premium Palette ──────────────────────────────────────────────
  var palette = [
    "#7c3aed", // violet
    "#0ea5e9", // sky
    "#10b981", // emerald
    "#f59e0b", // amber
    "#f43f5e", // rose
    "#06b6d4", // cyan
    "#f97316", // orange
    "#a855f7", // purple
    "#84cc16", // lime
    "#ec4899", // pink
  ];

  // ── Shared font ───────────────────────────────────────────────────────
  var font = "'Plus Jakarta Sans', 'Inter', 'Segoe UI', sans-serif";

  // ── Shared base objects ───────────────────────────────────────────────
  var baseChart = {
    fontFamily: font,
    background: "transparent",
    toolbar: { show: false },
    animations: {
      enabled: true,
      easing: "easeinout",
      speed: 700,
      animateGradually: { enabled: true, delay: 100 },
    },
    dropShadow: { enabled: false },
  };

  var baseGrid = {
    borderColor: "rgba(99,102,241,0.07)",
    strokeDashArray: 5,
    xaxis: { lines: { show: false } },
    yaxis: { lines: { show: true } },
    padding: { left: 4, right: 4, top: 0, bottom: 0 },
  };

  var baseTooltip = {
    theme: "dark",
    style: { fontSize: "12px", fontFamily: font },
    x: { show: true },
    marker: { show: true },
  };

  var baseLegend = {
    position: "bottom",
    fontSize: "12px",
    fontWeight: 600,
    fontFamily: font,
    labels: { colors: "#64748b" },
    markers: { width: 10, height: 10, radius: 4 },
    itemMargin: { horizontal: 12, vertical: 4 },
  };

  var baseXaxis = {
    axisBorder: { show: false },
    axisTicks: { show: false },
    labels: {
      style: {
        fontSize: "11px",
        fontWeight: 600,
        colors: "#94a3b8",
        fontFamily: font,
      },
    },
  };

  var baseYaxis = {
    labels: {
      style: {
        fontSize: "11px",
        fontWeight: 500,
        colors: "#94a3b8",
        fontFamily: font,
      },
    },
  };

  function destroy(id) {
    if (instances[id]) {
      try {
        instances[id].destroy();
      } catch (e) {}
      delete instances[id];
    }
  }

  // ── BAR CHART ────────────────────────────────────────────────────────
  function bar(
    id,
    categories,
    series,
    title,
    horizontal,
    onDataClick,
    tooltipData,
  ) {
    destroy(id);
    var el = document.getElementById(id);
    if (!el) return;

    var isSeries = Array.isArray(series[0]);
    var seriesArr = isSeries
      ? series
      : [{ name: title || "Count", data: series }];

    var chartHeight = horizontal ? Math.max(300, categories.length * 40) : 300;

    var opts = {
      chart: Object.assign({}, baseChart, {
        type: "bar",
        height: chartHeight,
        cursor: onDataClick ? "pointer" : "default",
        events: onDataClick
          ? {
              dataPointSelection: function (e, ctx, cfg) {
                onDataClick(
                  categories[cfg.dataPointIndex],
                  cfg.dataPointIndex,
                  cfg.seriesIndex,
                );
              },
            }
          : {},
      }),
      plotOptions: {
        bar: {
          horizontal: !!horizontal,
          borderRadius: horizontal ? 4 : 6,
          borderRadiusApplication: "end",
          columnWidth:
            categories.length <= 3
              ? "35%"
              : categories.length <= 6
                ? "45%"
                : "58%",
          barHeight: horizontal ? "65%" : undefined,
          dataLabels: { position: horizontal ? "center" : "top" },
          distributed: !isSeries,
        },
      },
      series: seriesArr,
      xaxis: Object.assign({}, baseXaxis, {
        categories: categories,
        labels: Object.assign({}, baseXaxis.labels, {
          rotate: categories.length > 6 ? -30 : 0,
          trim: true,
          maxHeight: 60,
        }),
      }),
      yaxis: Object.assign({}, baseYaxis, { min: 0 }),
      colors: palette,
      fill: isSeries
        ? {
            type: "gradient",
            gradient: {
              shade: "light",
              type: "vertical",
              shadeIntensity: 0.2,
              opacityFrom: 0.95,
              opacityTo: 0.75,
            },
          }
        : {
            type: "gradient",
            gradient: {
              shade: "light",
              type: "vertical",
              shadeIntensity: 0.35,
              opacityFrom: 1,
              opacityTo: 0.72,
              stops: [0, 100],
            },
          },
      dataLabels: {
        enabled: !horizontal,
        style: {
          fontSize: "11px",
          fontWeight: 800,
          fontFamily: font,
          colors: ["#1e293b"],
        },
        offsetY: -6,
        background: { enabled: false },
        formatter: function (val) {
          return val > 0 ? val : "";
        },
      },
      grid: baseGrid,
      // tooltip: Object.assign({}, baseTooltip, { shared: isSeries }),
      tooltip: tooltipData
        ? Object.assign({}, baseTooltip, {
            custom: function (opts) {
              var idx = opts.dataPointIndex;
              var d = tooltipData[idx] || {};
              var label = categories[idx];
              return (
                '<div style="padding:10px 14px;font-family:' +
                font +
                ';min-width:160px;">' +
                '<div style="font-weight:700;margin-bottom:8px;color:#0f172a;">' +
                label +
                "</div>" +
                '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;"><span style="width:8px;height:8px;border-radius:50%;background:#10b981;display:inline-block;"></span> Present: <b style="margin-left:auto;">' +
                (d.present ?? 0) +
                "</b></div>" +
                '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;"><span style="width:8px;height:8px;border-radius:50%;background:#f59e0b;display:inline-block;"></span> Half Present: <b style="margin-left:auto;">' +
                (d.halfPresent ?? 0) +
                "</b></div>" +
                '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;"><span style="width:8px;height:8px;border-radius:50%;background:#3b82f6;display:inline-block;"></span> Weekly Off: <b style="margin-left:auto;">' +
                (d.weeklyOff ?? 0) +
                "</b></div>" +
                '<div style="display:flex;align-items:center;gap:6px;"><span style="width:8px;height:8px;border-radius:50%;background:#f43f5e;display:inline-block;"></span> Absent: <b style="margin-left:auto;">' +
                (d.absent ?? 0) +
                "</b></div>" +
                "</div>"
              );
            },
          })
        : Object.assign({}, baseTooltip, { shared: isSeries }),
      legend: isSeries ? baseLegend : { show: false },
      states: {
        hover: { filter: { type: "lighten", value: 0.07 } },
        active: { filter: { type: "darken", value: 0.1 } },
      },
    };

    instances[id] = new ApexCharts(el, opts);
    instances[id].render();
  }

  // ── DONUT CHART ──────────────────────────────────────────────────────
  function donut(id, labels, series, title, onDataClick) {
    destroy(id);
    var el = document.getElementById(id);
    if (!el) return;

    var total = series.reduce(function (a, b) {
      return a + b;
    }, 0);

    var opts = {
      chart: Object.assign({}, baseChart, {
        type: "donut",
        height: 300,
        events: onDataClick
          ? {
              dataPointSelection: function (e, ctx, cfg) {
                onDataClick(labels[cfg.dataPointIndex], cfg.dataPointIndex);
              },
            }
          : {},
      }),
      labels: labels,
      series: series,
      colors: palette,
      fill: {
        type: "gradient",
        gradient: {
          shade: "dark",
          type: "horizontal",
          shadeIntensity: 0.4,
          opacityFrom: 1,
          opacityTo: 0.88,
        },
      },
      legend: Object.assign({}, baseLegend, {
        position: "right",
        offsetY: 10,
        height: 230,
      }),
      dataLabels: {
        enabled: true,
        style: {
          fontSize: "11px",
          fontWeight: 800,
          fontFamily: font,
          colors: ["#fff"],
        },
        dropShadow: { enabled: true, blur: 4, opacity: 0.4 },
        formatter: function (val) {
          return val.toFixed(1) + "%";
        },
      },
      plotOptions: {
        pie: {
          donut: {
            size: "68%",
            background: "transparent",
            labels: {
              show: true,
              name: {
                show: true,
                fontSize: "13px",
                fontWeight: 700,
                color: "#64748b",
                fontFamily: font,
                offsetY: -8,
              },
              value: {
                show: true,
                fontSize: "28px",
                fontWeight: 900,
                color: "#0f172a",
                fontFamily: font,
                offsetY: 6,
                formatter: function (v) {
                  return v;
                },
              },
              total: {
                show: true,
                label: "Total",
                color: "#94a3b8",
                fontSize: "12px",
                fontWeight: 600,
                fontFamily: font,
                formatter: function () {
                  return total;
                },
              },
            },
          },
        },
      },
      stroke: { width: 3, colors: ["#fff"] },
      tooltip: Object.assign({}, baseTooltip, {
        y: {
          formatter: function (val) {
            return (
              val + " (" + (total ? ((val * 100) / total).toFixed(1) : 0) + "%)"
            );
          },
        },
      }),
      states: {
        hover: { filter: { type: "lighten", value: 0.05 } },
        active: { filter: { type: "darken", value: 0.08 } },
      },
      responsive: [
        {
          breakpoint: 600,
          options: {
            legend: { position: "bottom", offsetY: 0 },
          },
        },
      ],
    };

    instances[id] = new ApexCharts(el, opts);
    instances[id].render();
  }

  // ── LINE / AREA CHART ─────────────────────────────────────────────────
  // Auto-switches to a richer bar/column when only 1 data point exists
  function line(id, categories, seriesArr, title, onDataClick) {
    destroy(id);
    var el = document.getElementById(id);
    if (!el) return;

    var isSingle = categories.length <= 1;

    var events = onDataClick
      ? {
          dataPointSelection: function (e, ctx, cfg) {
            onDataClick(
              categories[cfg.dataPointIndex],
              cfg.dataPointIndex,
              cfg.seriesIndex,
            );
          },
          markerClick: function (e, ctx, cfg) {
            if (onDataClick)
              onDataClick(
                categories[cfg.dataPointIndex],
                cfg.dataPointIndex,
                cfg.seriesIndex,
              );
          },
        }
      : {};

    var opts;

    if (isSingle) {
      // ── Single-day fallback: large stylish bar ───────────────────
      opts = {
        chart: Object.assign({}, baseChart, {
          type: "bar",
          height: 300,
          events: events,
        }),
        series: seriesArr,
        xaxis: Object.assign({}, baseXaxis, { categories: categories }),
        yaxis: Object.assign({}, baseYaxis, { min: 0 }),
        colors: palette,
        plotOptions: {
          bar: {
            borderRadius: 12,
            borderRadiusApplication: "end",
            columnWidth: "28%",
            dataLabels: { position: "top" },
          },
        },
        fill: {
          type: "gradient",
          gradient: {
            shade: "light",
            type: "vertical",
            gradientToColors: ["#0ea5e9"],
            inverseColors: false,
            shadeIntensity: 0.3,
            opacityFrom: 1,
            opacityTo: 0.7,
          },
        },
        dataLabels: {
          enabled: true,
          style: {
            fontSize: "16px",
            fontWeight: 900,
            fontFamily: font,
            colors: ["#1e293b"],
          },
          offsetY: -10,
          background: { enabled: false },
        },
        grid: baseGrid,
        tooltip: baseTooltip,
        legend: { show: false },
        annotations: {
          yaxis: [
            {
              y: 0,
              borderColor: "transparent",
              label: {
                text: "📅 Single day view",
                position: "left",
                style: {
                  color: "#94a3b8",
                  fontSize: "10px",
                  fontFamily: font,
                  background: "transparent",
                  border: 0,
                },
              },
            },
          ],
        },
      };
    } else {
      // ── Multi-point area chart ────────────────────────────────────
      opts = {
        chart: Object.assign({}, baseChart, {
          type: "area",
          height: 300,
          events: events,
        }),
        series: seriesArr,
        xaxis: Object.assign({}, baseXaxis, {
          categories: categories,
          labels: Object.assign({}, baseXaxis.labels, {
            rotate: categories.length > 12 ? -40 : -25,
            rotateAlways: categories.length > 7,
          }),
        }),
        yaxis: Object.assign({}, baseYaxis, { min: 0 }),
        colors: palette,
        fill: {
          type: "gradient",
          gradient: {
            shadeIntensity: 1,
            opacityFrom: 0.5,
            opacityTo: 0.02,
            stops: [0, 90, 100],
            type: "vertical",
          },
        },
        stroke: { curve: "smooth", width: 3 },
        markers: {
          size: categories.length > 20 ? 0 : 5,
          strokeWidth: 3,
          strokeColors: "#fff",
          fillOpacity: 1,
          hover: { size: 8, sizeOffset: 2 },
        },
        grid: baseGrid,
        tooltip: Object.assign({}, baseTooltip, {
          shared: seriesArr.length > 1,
          intersect: false,
        }),
        legend: seriesArr.length > 1 ? baseLegend : { show: false },
      };
    }

    instances[id] = new ApexCharts(el, opts);
    instances[id].render();
  }

  // ── STACKED BAR ───────────────────────────────────────────────────────
  function stacked(id, categories, seriesArr, title, onDataClick, horizontal) {
    destroy(id);
    var el = document.getElementById(id);
    if (!el) return;

    var stackColors = seriesArr.map(function (s, i) {
      var n = (s.name || "").toLowerCase();
      if (n.indexOf("half present") !== -1) {
        return "#f59e0b";
      }
      if (n.indexOf("weekly off") !== -1) {
        return "#3b82f6";
      }
      if (n.indexOf("present") !== -1) {
        return "#10b981";
      }
      if (n.indexOf("absent") !== -1) {
        return "#f43f5e";
      }
      if (n.indexOf("late") !== -1) {
        return "#f59e0b";
      }
      if (n.indexOf("early") !== -1) {
        return "#f97316";
      }
      if (n.indexOf("single") !== -1) {
        return "#0ea5e9";
      }
      return palette[i % palette.length];
    });

    var opts = {
      chart: Object.assign({}, baseChart, {
        type: "bar",
        stacked: true,
        height: horizontal ? Math.max(300, categories.length * 45) : 300,
        events: onDataClick
          ? {
              dataPointSelection: function (e, ctx, cfg) {
                onDataClick(
                  categories[cfg.dataPointIndex],
                  cfg.dataPointIndex,
                  cfg.seriesIndex,
                  seriesArr[cfg.seriesIndex].name,
                );
              },
            }
          : {},
      }),
      series: seriesArr,
      xaxis: Object.assign({}, baseXaxis, {
        categories: categories,
        labels: Object.assign({}, baseXaxis.labels, {
          rotate: categories.length > 6 ? -30 : 0,
        }),
      }),
      yaxis: Object.assign({}, baseYaxis, { min: 0 }),
      colors: stackColors,
      plotOptions: {
        bar: {
          horizontal: !!horizontal,
          borderRadius: 6,
          borderRadiusApplication: "end",
          columnWidth: !horizontal
            ? categories.length <= 3
              ? "32%"
              : categories.length <= 6
                ? "44%"
                : "58%"
            : undefined,
          barHeight: horizontal ? "60%" : undefined,
        },
      },
      fill: { opacity: [0.92, 0.8] },
      dataLabels: {
        enabled: true,
        style: {
          fontSize: "11px",
          fontWeight: 700,
          fontFamily: font,
          colors: ["#fff"],
        },
        formatter: function (val) {
          return val > 0 ? val : "";
        },
      },
      legend: Object.assign({}, baseLegend, {
        position: "top",
        horizontalAlign: "right",
      }),
      grid: baseGrid,
      tooltip: Object.assign({}, baseTooltip, {
        shared: true,
        intersect: false,
      }),
      states: {
        hover: { filter: { type: "lighten", value: 0.04 } },
        active: { filter: { type: "darken", value: 0.1 } },
      },
    };

    instances[id] = new ApexCharts(el, opts);
    instances[id].render();
  }

  // ── HEATMAP ───────────────────────────────────────────────────────────
  function heatmap(id, seriesArr, title) {
    destroy(id);
    var el = document.getElementById(id);
    if (!el) return;

    var opts = {
      chart: Object.assign({}, baseChart, { type: "heatmap", height: 300 }),
      series: seriesArr,
      colors: ["#7c3aed"],
      dataLabels: { enabled: false },
      stroke: { width: 2, colors: ["#fff"] },
      xaxis: baseXaxis,
      yaxis: baseYaxis,
      tooltip: baseTooltip,
      plotOptions: {
        heatmap: {
          radius: 4,
          colorScale: {
            ranges: [
              { from: 0, to: 2, color: "#ede9fe", name: "Low" },
              { from: 3, to: 5, color: "#a78bfa", name: "Medium" },
              { from: 6, to: 8, color: "#7c3aed", name: "High" },
              { from: 9, to: 999, color: "#4c1d95", name: "Very High" },
            ],
          },
        },
      },
    };

    instances[id] = new ApexCharts(el, opts);
    instances[id].render();
  }

  // ── RADIAL BAR ────────────────────────────────────────────────────────
  function radialBar(id, labels, series, title) {
    destroy(id);
    var el = document.getElementById(id);
    if (!el) return;

    var opts = {
      chart: Object.assign({}, baseChart, { type: "radialBar", height: 300 }),
      series: series,
      labels: labels,
      colors: palette,
      plotOptions: {
        radialBar: {
          offsetY: 0,
          hollow: { size: "28%", background: "transparent" },
          track: { background: "#f1f5f9", strokeWidth: "100%", margin: 6 },
          dataLabels: {
            name: {
              fontSize: "12px",
              fontWeight: 700,
              color: "#475569",
              fontFamily: font,
            },
            value: {
              fontSize: "16px",
              fontWeight: 900,
              color: "#0f172a",
              fontFamily: font,
            },
          },
        },
      },
      legend: Object.assign({}, baseLegend),
      fill: {
        type: "gradient",
        gradient: {
          shade: "light",
          type: "horizontal",
          shadeIntensity: 0.5,
          opacityFrom: 1,
          opacityTo: 0.85,
        },
      },
      stroke: { lineCap: "round" },
      tooltip: baseTooltip,
    };

    instances[id] = new ApexCharts(el, opts);
    instances[id].render();
  }

  return { bar, donut, line, stacked, heatmap, radialBar, destroy };
})();