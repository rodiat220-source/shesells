"use client";

import { Fragment, useEffect, useRef } from "react";
import { UserRound } from "lucide-react";
import type { Message } from "@/src/types";
import { MessageBubble } from "./MessageBubble";

export function ChatContainer({ messages, isLoading }: { messages: Message[]; isLoading: boolean }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const reviewStartedRef = useRef(false);
  const hasSummary = messages.some((message) => message.coachType === "summary");

  useEffect(() => {
    if (!hasSummary) reviewStartedRef.current = false;
  }, [hasSummary]);

  useEffect(() => {
    if (hasSummary && !reviewStartedRef.current) {
      reviewStartedRef.current = true;
      summaryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    if (!hasSummary) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, isLoading, hasSummary]);

  return (
    <div className={`chat-scroll ${hasSummary ? "has-review" : ""}`} aria-live="polite">
      <div className="chat-day"><span>今天</span></div>
      {messages.map((message, index) => {
        const previousMessage = messages[index - 1];
        const shouldMarkTurn = message.turn > 0 && previousMessage?.turn !== message.turn;
        const anchorId = message.coachType === "summary"
          ? "training-summary"
          : message.coachType === "champion_replay"
            ? "training-champion-replay"
            : undefined;

        if (anchorId) {
          return (
            <div
              className="review-anchor"
              id={anchorId}
              key={message.id}
              ref={message.coachType === "summary" ? summaryRef : undefined}
            >
              <MessageBubble message={message} />
            </div>
          );
        }

        return (
          <Fragment key={message.id}>
            {shouldMarkTurn && <span className="turn-anchor" id={`turn-${message.turn}`} />}
            <MessageBubble message={message} />
          </Fragment>
        );
      })}
      {isLoading && (
        <div className="thinking-row">
          <span className="chat-avatar"><UserRound size={17} /></span>
          <div className="thinking-bubble"><i /><i /><i /></div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
