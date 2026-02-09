"use client";

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";

interface ChartProps {
  type: "line" | "bar" | "pie" | "area";
  data: any[];
  dataKey?: string;
  nameKey?: string;
  valueKey?: string;
  colorScheme?: string[];
}

const COLORS = ["#64748b", "#94a3b8", "#cbd5e1", "#475569", "#334155"];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 shadow-lg">
        <p className="text-xs text-slate-400 mb-1">{label}</p>
        <p className="text-sm font-medium text-white">{payload[0].value}</p>
      </div>
    );
  }
  return null;
};

export default function Chart({
  type,
  data,
  dataKey = "value",
  nameKey = "name",
  valueKey = "value",
  colorScheme = COLORS,
}: ChartProps) {
  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        {type === "line" && (
          <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#64748b" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#64748b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis 
              dataKey={nameKey} 
              stroke="#475569" 
              fontSize={10} 
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => value.slice(5)}
            />
            <YAxis 
              stroke="#475569" 
              fontSize={10} 
              tickLine={false}
              axisLine={false}
              width={30}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area 
              type="monotone" 
              dataKey={dataKey} 
              stroke="#64748b" 
              strokeWidth={2} 
              fill="url(#lineGradient)"
            />
          </AreaChart>
        )}

        {type === "bar" && (
          <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#94a3b8" stopOpacity={1} />
                <stop offset="100%" stopColor="#64748b" stopOpacity={1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis 
              dataKey={nameKey} 
              stroke="#475569" 
              fontSize={10} 
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => value.slice(5)}
            />
            <YAxis 
              stroke="#475569" 
              fontSize={10} 
              tickLine={false}
              axisLine={false}
              width={30}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar 
              dataKey={dataKey} 
              fill="url(#barGradient)" 
              radius={[4, 4, 0, 0]} 
              maxBarSize={40}
            />
          </BarChart>
        )}

        {type === "pie" && (
          <PieChart>
            <Tooltip content={<CustomTooltip />} />
            <Pie
              data={data}
              dataKey={valueKey}
              nameKey={nameKey}
              outerRadius={80}
              innerRadius={50}
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={colorScheme[index % colorScheme.length]} />
              ))}
            </Pie>
          </PieChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
