import React, { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const C_ATTACK = ["#f59e0b", "#fb923c", "#fbbf24"];
const C_SERVE = ["#f97316", "#fdba74", "#ea580c"];
const C_RECEPTION = ["#22c55e", "#86efac", "#16a34a"];
const C_BLOCK = ["#3b82f6", "#93c5fd"];

function pct(value, total) {
  if (!total) return 0;
  return Math.round((Number(value) / total) * 100);
}

function pctLabel(value, total) {
  if (!total) return "";
  return `${pct(value, total)}%`;
}

function DonutTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const name = p?.name ?? "";
  const value = Number(p?.value) || 0;
  const label = p?.payload?.pctLabel;
  return (
    <div
      style={{
        background: "#0b1220",
        border: "1px solid rgba(255,255,255,0.16)",
        borderRadius: 12,
        padding: "10px 12px",
        color: "rgba(255,255,255,0.92)",
        boxShadow: "0 10px 22px rgba(0,0,0,0.35)",
      }}
    >
      <div style={{ fontWeight: 900, marginBottom: 4 }}>{name}</div>
      <div style={{ color: "rgba(255,255,255,0.80)", fontWeight: 700 }}>
        {value}
        {label ? ` (${label})` : ""}
      </div>
    </div>
  );
}

function MiniDonutChart({ title, segments, colors }) {
  const data = useMemo(
    () =>
      segments.map((s, i) => ({
        name: s.name,
        value: Math.max(0, Number(s.value) || 0),
        fill: colors[i % colors.length],
      })),
    [segments, colors]
  );

  const chartData = useMemo(() => data.filter((d) => d.value > 0), [data]);
  const total = useMemo(
    () => data.reduce((s, x) => s + (Number(x.value) || 0), 0),
    [data]
  );
  const isEmpty = total <= 0;
  const chartDataWithPct = useMemo(
    () =>
      chartData.map((d) => ({
        ...d,
        pctLabel: pctLabel(d.value, total),
      })),
    [chartData, total]
  );

  return (
    <div className="mini-chart">
      <h4 className="mini-chart-title">{title}</h4>
      <div className="donut-wrap donut-wrap--legend">
        <div className="donut-chart-area">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={chartDataWithPct}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.fill}
                      stroke="rgba(0,0,0,0.25)"
                      strokeWidth={1.2}
                    />
                  ))}
                </Pie>
                <Tooltip
                  content={<DonutTooltip />}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="donut-empty" aria-hidden="true">
              <div className="donut-ring-empty" />
              <div className="donut-empty-text">No data yet</div>
            </div>
          )}
        </div>
        <div className="donut-legend" aria-label={`${title} legend`}>
          {data.map((d, i) => (
            <div key={`${d.name}-${i}`} className="donut-legend-row">
              <span
                className="donut-legend-swatch"
                style={{ background: d.fill }}
                aria-hidden="true"
              />
              <span className="donut-legend-name">{d.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PlayerStatChartsCard({ player }) {
  const attackSeg = useMemo(
    () => [
      { name: "Points", value: player.attack?.points ?? 0 },
      { name: "Faults", value: player.attack?.faults ?? 0 },
      { name: "Rally continues", value: player.attack?.rally_continues ?? 0 },
    ],
    [player]
  );

  const serveSeg = useMemo(
    () => [
      { name: "Points", value: player.serve?.points ?? 0 },
      { name: "Faults", value: player.serve?.faults ?? 0 },
      { name: "Rally continues", value: player.serve?.rally_continues ?? 0 },
    ],
    [player]
  );

  const receptionSeg = useMemo(
    () => [
      { name: "Positive", value: player.reception?.positive ?? 0 },
      { name: "Double positive", value: player.reception?.double_positive ?? 0 },
      { name: "Fault", value: player.reception?.fault ?? 0 },
    ],
    [player]
  );

  const blockSeg = useMemo(
    () => [
      { name: "Blocks", value: player.block?.total ?? 0 },
      { name: "Blocks out", value: player.block?.outs ?? 0 },
    ],
    [player]
  );

  return (
    <div className="player-chart-card">
      <h3 className="player-chart-name">
        {player.first_name} {player.last_name}
      </h3>
      <div className="chart-grid">
        <MiniDonutChart
          title="Attack"
          segments={attackSeg}
          colors={C_ATTACK}
        />
        <MiniDonutChart
          title="Serve"
          segments={serveSeg}
          colors={C_SERVE}
        />
        <MiniDonutChart
          title="Reception"
          segments={receptionSeg}
          colors={C_RECEPTION}
        />
        <MiniDonutChart
          title="Block"
          segments={blockSeg}
          colors={C_BLOCK}
        />
      </div>
    </div>
  );
}
