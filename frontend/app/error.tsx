"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "system-ui, sans-serif", color: "#241f1a", background: "#f4ece1" }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>出了点问题</h1>
      <p style={{ color: "#6f6558", marginBottom: "1.5rem" }}>页面加载失败，请稍后重试。</p>
      <button
        onClick={reset}
        style={{ padding: "0.6rem 1.5rem", background: "#8a3345", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.95rem" }}
      >
        重新加载
      </button>
    </main>
  );
}
