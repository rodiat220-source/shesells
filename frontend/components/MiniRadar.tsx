"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Info } from "lucide-react";
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
  const [showReasoning, setShowReasoning] = useState(false);
  const hasReasoning = reasoning && Object.values(reasoning).some((r) => r && r.length > 0);
  const isCompact = compact;
  const data = (Object.keys(labels) as Array<keyof Dimensions>).map((key) => ({
    dimension: labels[key],
    score: dimensions[key],
    fullMark: 100,
    reasoning: reasoning?.[key],
  }));

  return (
    <div className={isCompact ? "radar-wrap radar-wrap-compact" : "radar-wrap"} aria-label="五维能力雷达图">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="65%">
          <PolarGrid stroke="#e2d3bd" />
          <PolarAngleAxis
            dataKey="dimension"
            tick={(props) => {
              const point = data.find((item) => item.dimension === props.payload?.value);
              return (
                <text
                  fill="#6f6558"
                  fontSize={isCompact ? 9 : 11}
                  textAnchor="middle"
                  x={props.x}
                  y={props.y}
                  style={{ cursor: hasReasoning ? "pointer" : "default" }}
                  onClick={() => { if (hasReasoning) setShowReasoning((v) => !v); }}
                >
                  <title>{point?.reasoning ?? "本轮暂无评分依据。"}</title>
                  {props.payload?.value}
                </text>
              );
            }}
          />
          <Radar dataKey="score" stroke="#8a3345" fill="#8a3345" fillOpacity={0.22} strokeWidth={2} />
        </RadarChart>
      </ResponsiveContainer>
      {hasReasoning && !isCompact && (
        <button
          className="radar-reasoning-toggle"
          onClick={() => setShowReasoning((v) => !v)}
          aria-label="切换评分依据显示"
        >
          <Info size={13} />
          <span>{showReasoning ? "收起评分依据" : "显示评分依据"}</span>
          {showReasoning ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      )}
      {hasReasoning && showReasoning && (
        <div className="radar-reasoning-list">
          {(Object.keys(labels) as Array<keyof Dimensions>).map((key) => {
            const text = reasoning?.[key];
            if (!text) return null;
            return (
              <div key={key} className="radar-reasoning-item">
                <span className="radar-reasoning-label">{labels[key]}</span>
                <span className="radar-reasoning-score">{dimensions[key]}</span>
                <p className="radar-reasoning-text">{text}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
