"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine
} from 'recharts';

// Mock data for demonstration
const mockChartData = [
  { time: '09:00', price: 45.2, bullish: 12, bearish: 8, timestamp: '2024-01-01T09:00:00' },
  { time: '09:30', price: 46.8, bullish: 15, bearish: 10, timestamp: '2024-01-01T09:30:00' },
  { time: '10:00', price: 44.5, bullish: 8, bearish: 18, timestamp: '2024-01-01T10:00:00' },
  { time: '10:30', price: 47.2, bullish: 20, bearish: 12, timestamp: '2024-01-01T10:30:00' },
  { time: '11:00', price: 48.9, bullish: 25, bearish: 7, timestamp: '2024-01-01T11:00:00' },
  { time: '11:30', price: 46.1, bullish: 10, bearish: 22, timestamp: '2024-01-01T11:30:00' },
  { time: '12:00', price: 49.5, bullish: 30, bearish: 5, timestamp: '2024-01-01T12:00:00' },
  { time: '12:30', price: 51.2, bullish: 35, bearish: 8, timestamp: '2024-01-01T12:30:00' },
  { time: '13:00', price: 48.7, bullish: 18, bearish: 25, timestamp: '2024-01-01T13:00:00' },
  { time: '13:30', price: 50.3, bullish: 28, bearish: 12, timestamp: '2024-01-01T13:30:00' },
  { time: '14:00', price: 52.8, bullish: 40, bearish: 6, timestamp: '2024-01-01T14:00:00' },
  { time: '14:30', price: 49.9, bullish: 15, bearish: 28, timestamp: '2024-01-01T14:30:00' },
];

export type ChartDataPoint = {
  time: string;
  price: number;
  bullish: number;
  bearish: number;
  timestamp: string;
};

interface PriceChartProps {
  data?: ChartDataPoint[];
  height?: number;
  className?: string;
}

// Custom tooltip component
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
        <p className="font-medium">{`Time: ${label}`}</p>
        <p className="text-sm">
          <span className="text-blue-600">Price: ${data.price.toFixed(2)}</span>
        </p>
        <p className="text-sm">
          <span className="text-green-600">Bullish: {data.bullish}</span>
        </p>
        <p className="text-sm">
          <span className="text-red-600">Bearish: {data.bearish}</span>
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {new Date(data.timestamp).toLocaleString()}
        </p>
      </div>
    );
  }
  return null;
};

export default function PriceChart({ 
  data = mockChartData, 
  height = 400,
  className = ""
}: PriceChartProps) {
  return (
    <div className={`w-full ${className}`}>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart
          data={data}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis 
            dataKey="time" 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12 }}
          />
          <YAxis 
            yAxisId="volume"
            orientation="left"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12 }}
          />
          <YAxis 
            yAxisId="price"
            orientation="right"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12 }}
            domain={['dataMin - 2', 'dataMax + 2']}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          
          {/* Bearish bars (red, on top) */}
          <Bar
            yAxisId="volume"
            dataKey="bearish"
            stackId="sentiment"
            fill="#ef4444"
            name="Bearish Volume"
            radius={[2, 2, 0, 0]}
          />
          
          {/* Bullish bars (green, on bottom) */}
          <Bar
            yAxisId="volume"
            dataKey="bullish"
            stackId="sentiment"
            fill="#22c55e"
            name="Bullish Volume"
            radius={[0, 0, 2, 2]}
          />
          
          {/* Price line */}
          <Line
            yAxisId="price"
            type="monotone"
            dataKey="price"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, fill: '#3b82f6' }}
            name="Price ($)"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
