"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ClipboardList, Flag, MessageCircle, PauseCircle, Send } from "lucide-react";
import { useSessionStore } from "@/src/store/sessionStore";
import { createTrainingSession } from "@/src/lib/backendApi";

export function BAInput() {
  const [content, setContent] = useState("");
  const [isRestarting, setIsRestarting] = useState(false);
  const router = useRouter();
  const { sendMessage, finishSession, isLoading, isFinishing, isHalted, session } = useSessionStore();
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
          <Link href={`/session/${session.sessionId}/review`}>
            <ClipboardList size={15} />训练复盘
          </Link>
          <Link href={`/session/${session.sessionId}/conversation`}>
            <MessageCircle size={15} />回看对话
          </Link>
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

  if (isHalted) {
    return (
      <div className="halt-action halt-action-muted">
        <p><PauseCircle size={15} />训练已暂停，请先确认上方教练提醒。</p>
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
          placeholder="像面对真实顾客一样回应…"
          aria-label="输入你的回应"
          disabled={isLoading}
          rows={1}
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
        <span>Enter 发送 · Shift + Enter 换行</span>
        <button
          className={isFinishing ? "is-loading" : ""}
          onClick={async () => {
            if (isFinishing || isLoading) return; // 防抖
            const finished = await finishSession();
            if (finished && session) {
              router.replace(`/session/${session.sessionId}/review`);
            }
          }}
          disabled={isLoading || isFinishing}
        >
          <Flag size={14} />{isFinishing ? "正在结束…" : "结束训练"}
        </button>
      </div>
    </div>
  );
}
