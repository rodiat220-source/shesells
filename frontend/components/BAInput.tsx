"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ClipboardList, Flag, MessageCircle, Send } from "lucide-react";
import { useSessionStore } from "@/src/store/sessionStore";
import { createTrainingSession } from "@/src/lib/backendApi";

export function BAInput() {
  const [content, setContent] = useState("");
  const [isRestarting, setIsRestarting] = useState(false);
  const [isNavigating, setIsNavigating] = useState<string | null>(null);
  const router = useRouter();
  const { sendMessage, finishSession, continueAfterHalt, isLoading, isFinishing, isContinuingAfterHalt, isHalted, session } = useSessionStore();
  const isCompleted = session?.status === "completed";

  function submit() {
    if (!content.trim() || isLoading || isFinishing) return; // 防抖：发送中或结束中或内容为空忽略
    void sendMessage(content);
    setContent("");
  }

  if (isCompleted && session) {
    return (
      <div className="completed-bar">
        <span><Check size={16} />本次训练已完成</span>
        <div className="completed-actions">
          <button
            className={isNavigating === "review" ? "is-loading" : ""}
            disabled={isNavigating !== null || isRestarting}
            onClick={() => {
              if (isNavigating !== null || isRestarting) return;
              setIsNavigating("review");
              router.push(`/session/${session.sessionId}/review`);
            }}
          >
            {isNavigating === "review" ? "正在进入…" : <> <ClipboardList size={15} />训练复盘 </>}
          </button>
          <button
            className={isNavigating === "conversation" ? "is-loading" : ""}
            disabled={isNavigating !== null || isRestarting}
            onClick={() => {
              if (isNavigating !== null || isRestarting) return;
              setIsNavigating("conversation");
              router.push(`/session/${session.sessionId}/conversation`);
            }}
          >
            {isNavigating === "conversation" ? "正在进入…" : <> <MessageCircle size={15} />回看对话 </>}
          </button>
          <button
            className={isRestarting ? "is-loading" : ""}
            disabled={isRestarting}
            onClick={async () => {
              if (isRestarting) return; // 防抖
              setIsRestarting(true);
              try {
                const data = await createTrainingSession();
                router.push(`/session/${data.sessionId}`);
              } catch {
                setIsRestarting(false);
              }
            }}
          >
            {isRestarting ? "正在准备…" : "再练一次"}
            {!isRestarting && <ArrowRight size={15} />}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="composer-wrap">
      <div className="composer">
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={isHalted ? "按教练建议修改你的回应，重发即可…" : "像面对真实顾客一样回应…"}
          aria-label="输入你的回应"
          disabled={isLoading}
          rows={3}
        />
        <button
          className={`send-button ${isLoading ? "is-loading" : ""}`}
          onClick={submit}
          disabled={!content.trim() || isLoading}
          aria-label="发送回应"
        >
          <Send size={17} />
        </button>
      </div>
      <div className="composer-meta">
        {isHalted ? (
          <>
            <span>教练已暂停 · 修改后重发，或放弃修改继续</span>
            <button
              className={isContinuingAfterHalt ? "is-loading" : ""}
              onClick={() => {
                if (isContinuingAfterHalt) return; // 防抖
                void continueAfterHalt();
              }}
              disabled={isContinuingAfterHalt}
            >
              <Check size={14} />放弃修改，继续
            </button>
          </>
        ) : (
          <>
            <span>Enter 发送 · Shift + Enter 换行</span>
            <button
              className={isFinishing ? "is-loading" : ""}
              onClick={async () => {
                if (isFinishing || isLoading) return; // 防抖
                await finishSession();
              }}
              disabled={isLoading || isFinishing}
            >
              <Flag size={14} />{isFinishing ? "正在结束…" : "结束训练"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
