import React, { useState } from "react";
import { C, S } from "../styles/tokens.js";
import { Btn } from "../components/Btn.jsx";
import { Toggle } from "../components/Toggle.jsx";
import { Loader } from "../components/Loader.jsx";
import { Daily } from "../components/planner/Daily.jsx";
import { Weekly } from "../components/planner/Weekly.jsx";
import { Monthly } from "../components/planner/Monthly.jsx";

export default function Planner({ plan, goal, onReset, onProgress, busy, isMobile }) {
  const [tab, setTab] = useState("daily");
  const progress = (plan && plan.progress) || {};
  const [done, setDone] = useState(() => ({ ...(progress.tasksDone || {}) }));
  const [weeklyDone, setWeeklyDone] = useState(() => [0, 1, 2, 3, 4].map((i) => !!(progress.weeklyDone || [])[i]));
  const [monthly, setMonthly] = useState(() => [0, 1, 2, 3, 4].map((i) => Number((progress.monthlyProgress || [])[i]) || 0));

  // Every change updates local state immediately and is persisted (sliders debounced).
  const toggleTask = (k) => {
    const next = { ...done, [k]: !done[k] };
    setDone(next);
    onProgress({ tasksDone: next }, 0);
  };
  const toggleWeekly = (i) => {
    const next = weeklyDone.map((v, j) => (j === i ? !v : v));
    setWeeklyDone(next);
    onProgress({ weeklyDone: next }, 0);
  };
  const setMonthlyValue = (i, val) => {
    const next = monthly.map((v, j) => (j === i ? val : v));
    setMonthly(next);
    onProgress({ monthlyProgress: next }, 400);
  };

  if (!plan) {
    return <Loader messages={["Building your schedule...", "Allocating deep work...", "Cutting the noise...", "Writing audit notes..."]} />;
  }
  return (
    <div style={{ animation: "auditFade 300ms ease" }}>
      <div style={{ ...S.label, color: C.accent, marginBottom: 10 }}>Your plan</div>
      <h2 style={{ ...S.h2, marginBottom: 24 }}>{goal.title}</h2>
      <div style={{ marginBottom: 24 }}>
        <Toggle testId="planner-tabs" value={tab} onChange={setTab} options={[["daily", "Daily"], ["weekly", "Weekly"], ["monthly", "Monthly"]]} />
      </div>
      {tab === "daily" && <Daily plan={plan} done={done} toggleTask={toggleTask} isMobile={isMobile} />}
      {tab === "weekly" && <Weekly plan={plan} weeklyDone={weeklyDone} toggleWeekly={toggleWeekly} />}
      {tab === "monthly" && (
        <Monthly plan={plan} monthly={monthly} setMonthlyValue={setMonthlyValue} isMobile={isMobile} />
      )}
      <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 40, paddingTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: "#444" }}>Progress saves automatically.</span>
        <Btn variant="ghost" onClick={onReset} disabled={busy}>
          Start Over
        </Btn>
      </div>
    </div>
  );
}
