export default function Loading() {
  return (
    <main style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#f4ece1" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", color: "#6f6558", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ width: "32px", height: "32px", border: "3px solid #e2d3bd", borderTopColor: "#8a3345", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <p>加载中…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </main>
  );
}
