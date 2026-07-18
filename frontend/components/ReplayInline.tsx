"use client";

import { useState } from "react";
import { Crown, Sparkles, X } from "lucide-react";
import type { ReplayTurn } from "@/src/types";

export function ReplayInline({ turns }: { turns: ReplayTurn[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeTurn = turns[activeIndex] ?? turns[0];

  if (!activeTurn) return null;

  const originalMessage = activeTurn.originalBaMessage ?? "你这一轮的回应没有接住顾客的关键信号。";
  const championMessage = activeTurn.championMessage ?? activeTurn.baMessage;

  return (
    <div className="replay-block">
      <div className="replay-heading">
        <div><Crown size={17} /><span>销冠对比 · {turns.length} 个关键时刻</span></div>
        <small>点击切换示范</small>
      </div>

      <div className="replay-tabs" role="tablist" aria-label="选择销冠示范关键时刻">
        {turns.map((turn, index) => (
          <button
            aria-pressed={index === activeIndex}
            className={index === activeIndex ? "is-active" : undefined}
            key={`${turn.turn}-${turn.scenario ?? "tab"}`}
            onClick={() => setActiveIndex(index)}
            type="button"
          >
            第 {turn.turn} 轮
          </button>
        ))}
      </div>

      <article className="replay-turn" key={`${activeTurn.turn}-${activeTurn.scenario ?? "replay"}`}>
        <div className="replay-turn-head">
          <span>顾客当时说</span>
          <em>{activeTurn.customerMessage}</em>
        </div>

        <div className="replay-compare-grid">
          <div className="replay-compare-card is-original">
            <div className="replay-compare-label"><X size={13} /><b>你的回复</b></div>
            <p>{originalMessage}</p>
          </div>
          <div className="replay-compare-card is-champion">
            <div className="replay-compare-label"><Sparkles size={13} /><b>销冠回复</b></div>
            <p>{championMessage}</p>
          </div>
        </div>

        <div className="replay-note">
          <strong>技巧说明</strong>
          <p>{activeTurn.note}</p>
          {activeTurn.tags && activeTurn.tags.length > 0 && (
            <div className="replay-tags">
              {activeTurn.tags.map((tag) => <span key={tag}>{tag}</span>)}
            </div>
          )}
        </div>
      </article>
    </div>
  );
}
