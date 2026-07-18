import { Check, Lightbulb, TriangleAlert } from "lucide-react";
import type { CriticalMoment } from "@/src/types";

const momentLabels: Record<CriticalMoment["type"], string> = {
  good_probe: "好的追问",
  missed_concern: "待加强",
  objection_raised: "异议出现",
  buying_signal: "购买信号",
  premature_recommendation: "过早推荐",
};

export function CriticalTimeline({
  moments,
  getMomentHref,
}: {
  moments: CriticalMoment[];
  getMomentHref?: (moment: CriticalMoment) => string;
}) {
  return (
    <div className="critical-block">
      <h4>关键时刻</h4>
      <div className="critical-list">
        {[...moments].sort((a, b) => a.turn - b.turn).map((moment) => {
          const isGood = moment.type === "good_probe" || moment.type === "buying_signal";
          const content = (
            <>
              <span className="critical-icon">
                {isGood ? <Check size={14} /> : moment.type === "missed_concern" ? <TriangleAlert size={14} /> : <Lightbulb size={14} />}
              </span>
              <div><strong>第 {moment.turn} 轮 · {momentLabels[moment.type]}</strong><p>{moment.description}</p></div>
            </>
          );
          const href = getMomentHref?.(moment);

          if (href) {
            return (
              <a className={`critical-item ${isGood ? "is-good" : "is-focus"}`} href={href} key={`${moment.turn}-${moment.type}`}>
                {content}
              </a>
            );
          }

          return (
            <div className={`critical-item ${isGood ? "is-good" : "is-focus"}`} key={`${moment.turn}-${moment.type}`}>
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
