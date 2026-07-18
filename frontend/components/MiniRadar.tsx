"use client";

import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from "recharts";
import type { DimensionReasoning, Dimensions } from "@/src/types";

const labels: Record<keyof Dimensions, string> = {
  listening: "倾听力",
  professionalism: "专业度",
  recommendation: "推荐力",
  objectionHandling: "异议处理",
  warmth: "温度感",
};

interface MiniRadarProps {
  dimensions: Dimensions;
  reasoning?: DimensionReasoning;
  compact?: boolean;
}

export function MiniRadar({ dimensions, reasoning, compact = false }: MiniRadarProps) {
  const data = (Object.keys(labels) as Array<keyof Dimensions>).map((key) => ({
    dimension: labels[key],
    score: dimensions[key],
    fullMark: 100,
    reasoning: reasoning?.[key],
  }));

  return (
    <div className={compact ? "radar-wrap radar-wrap-compact" : "radar-wrap"} aria-label="五维能力雷达图">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="65%">
          <PolarGrid stroke="#e2d3bd" />
          <PolarAngleAxis
            dataKey="dimension"
            tick={(props) => {
              const point = data.find((item) => item.dimension === props.payload?.value);
              return (
                <text fill="#6f6558" fontSize={compact ? 9 : 11} textAnchor="middle" x={props.x} y={props.y}>
                  <title>{point?.reasoning ?? "本轮暂无评分依据。"}</title>
                  {props.payload?.value}
                </text>
              );
            }}
          />
          <Radar dataKey="score" stroke="#8a3345" fill="#8a3345" fillOpacity={0.22} strokeWidth={2} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
