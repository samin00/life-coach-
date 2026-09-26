import React, { useState, useEffect, useCallback } from "react";
import * as api from "./api/client.js";
import { C, FONT, GLOBAL_CSS, S } from "./styles/tokens.js";
import { StepIndicator } from "./components/StepIndicator.jsx";
import { ErrorBanner } from "./components/ErrorBanner.jsx";
import { BootScreen } from "./components/BootScreen.jsx";
import { useIsMobile } from "./lib/useIsMobile.js";
import { useDebouncedSave } from "./lib/useDebouncedSave.js";
import { layoutNodes, toServerNodes } from "./lib/layout.js";
import { withMinDelay, pad2 } from "./lib/time.js";
import { buildHabitsBody } from "./lib/files.js";
import Landing from "./steps/Landing.jsx";
import DataSource from "./steps/DataSource.jsx";
import Analysis from "./steps/Analysis.jsx";
import BrainMap from "./steps/BrainMap.jsx";
import Goals from "./steps/Goals.jsx";
import Planner from "./steps/Planner.jsx";

// UI step index: 0 landing, 1 source, 2 analysis question, 3 map, 4 goals, 5 planner.
const SERVER_STEP = { source: 1, analyze: 2, map: 3, goals: 4, output: 5 };
const errMsg = (e) => (e && e.message) || "Something went wrong.";

export default function App() {
  const isMobile = useIsMobile();
  const [boot, setBoot] = useState({ loading: true, error: null });
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  // DataSource form (local only until "Analyze")
  const [platform, setPlatform] = useState("youtube");
  const [files, setFiles] = useState([]);
  const [manualText, setManualText] = useState("");
  // Server-backed session
  const [analysis, setAnalysis] = useState(null);
  const [answer, setAnswer] = useState("");
  const [nodes, setNodesState] = useState([]);
  const [goalMode, setGoalMode] = useState(null);
  const [suggestions, setSuggestions] = useState(null);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [customGoal, setCustomGoal] = useState("");
  const [goal, setGoal] = useState(null);
  const [plan, setPlan] = useState(null);

  const fail = (e) => setError(errMsg(e));
  const interestSaver = useDebouncedSave((patch) => api.updateAnalysis(patch).catch(fail));
  const progressSaver = useDebouncedSave((patch) => api.updateProgress(patch).catch(fail));

  // Restore everything from GET /api/state and jump to the right step.
  const load = useCallback(async () => {
    setBoot({ loading: true, error: null });
    setError(null);
    try {
      const st = await api.getState();
      const a = st.analysis;
      setPlatform(st.habitInput && st.habitInput.sourceType !== "manual" ? st.habitInput.sourceType : "youtube");
      setFiles([]);
      setManualText("");
      setAnalysis(a);
      setAnswer(a && a.answer ? a.answer : "");
      setNodesState(a ? layoutNodes(a.interests) : []);
      setSuggestions(a && a.suggestions ? a.suggestions : null);
      setSuggestLoading(false);
      setGoal(st.goal);
      setPlan(st.plan);
      const g = st.goal;
      const sIdx = g && a && a.suggestions ? a.suggestions.findIndex((s) => s.title === g.title) : -1;
      setGoalMode(g ? (g.source === "suggested" && sIdx >= 0 ? "suggest" : "own") : null);
      setSelectedGoal(sIdx >= 0 ? sIdx : null);
      setCustomGoal(g && sIdx < 0 ? g.title : "");
      // "map" also covers an unanswered (skipped) question: land on the map, not the question.
      const s = SERVER_STEP[st.step] || 1;
      setStep(s === 1 && !st.habitInput ? 0 : s);
      setBoot({ loading: false, error: null });
      if (s === 2) runAnalyze(); // habits saved but analysis missing (e.g. reload mid-analysis)
    } catch (e) {
      setBoot({ loading: false, error: errMsg(e) });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  // Wrap an API action: one in flight at a time, errors go to the banner.
  async function run(fn, onError) {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      fail(e);
      if (onError) onError(e);
    } finally {
      setBusy(false);
    }
  }

  function runAnalyze() {
    setAnalysis(null);
    setStep(2);
    return run(
      async () => {
        const a = await withMinDelay(api.analyze(), 3000);
        setAnalysis(a);
        setAnswer(a.answer || "");
        setNodesState(layoutNodes(a.interests));
        setSuggestions(a.suggestions || null);
      },
      () => setStep(1)
    );
  }
  async function startAnalysis(accuracy) {
    const ok = await run(async () => {
      await api.saveHabits(buildHabitsBody({ platform, files, manualText, accuracy }));
      return true;
    });
    if (ok) runAnalyze();
  }
  const toMap = (skip) =>
    run(async () => {
      const a = await api.updateAnalysis({ answer: skip ? null : answer.trim() });
      if (skip) setAnswer("");
      setAnalysis(a);
      setStep(3);
    });

  // setNodes(updater, persistDelay): delay undefined = local only (drag), 0 = now, >0 = debounced.
  const setNodes = (updater, delay) => {
    setNodesState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (delay !== undefined) queueMicrotask(() => interestSaver.schedule({ interests: toServerNodes(next) }, delay));
      return next;
    });
  };
  const toGoals = () =>
    run(async () => {
      await interestSaver.flush();
      setError(null);
      setGoalMode(goal ? goalMode : null);
      setStep(4);
    });
  async function requestSuggestions() {
    setGoalMode("suggest");
    if (suggestions || suggestLoading) return;
    setSuggestLoading(true);
    setError(null);
    try {
      const r = await withMinDelay(api.suggestGoals(), 1500);
      setSuggestions(r.goals);
      setSelectedGoal(null);
    } catch (e) {
      fail(e);
      setGoalMode(null);
    } finally {
      setSuggestLoading(false);
    }
  }
  async function buildPlan() {
    const g =
      goalMode === "suggest"
        ? { ...suggestions[selectedGoal], source: "suggested" }
        : { title: customGoal.trim(), description: null, source: "custom" };
    setPlan(null);
    setStep(5);
    await run(
      async () => {
        setGoal(await api.saveGoal(g));
        setPlan(await withMinDelay(api.generatePlan(), 3000));
      },
      () => setStep(4)
    );
  }
  const onProgress = (patch, delay) => progressSaver.schedule(patch, delay);
  const startOver = () =>
    run(async () => {
      await progressSaver.flush();
      await api.reset();
      await load();
    });

  if (boot.loading || boot.error) {
    return (
      <>
        <style>{GLOBAL_CSS}</style>
        <BootScreen error={boot.error} onRetry={load} />
      </>
    );
  }

  const banner = <ErrorBanner error={error} onDismiss={() => setError(null)} />;
  const pagePad = isMobile ? "0 16px" : "0 24px";
  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: FONT }}>
      <style>{GLOBAL_CSS}</style>
      <div style={{ maxWidth: 820, margin: "0 auto", padding: pagePad }}>
        {step === 0 ? (
          <Landing onStart={() => setStep(1)} isMobile={isMobile} />
        ) : (
          <div style={{ padding: isMobile ? "24px 0 64px" : "40px 0 96px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.2em", color: C.accent }}>
                AUDIT<span style={{ animation: "auditBlink 1s step-end infinite" }}>_</span>
              </span>
              <span style={{ ...S.label, color: "#444" }}>{pad2(step)} / 05</span>
            </div>
            <StepIndicator step={step} />
            {banner}
            {step === 1 && (
              <DataSource
                platform={platform}
                setPlatform={setPlatform}
                files={files}
                setFiles={setFiles}
                manualText={manualText}
                setManualText={setManualText}
                onBack={() => setStep(0)}
                onAnalyze={startAnalysis}
                busy={busy}
                isMobile={isMobile}
              />
            )}
            {step === 2 && (
              <Analysis analysis={analysis} answer={answer} setAnswer={setAnswer} onContinue={() => toMap(false)} onSkip={() => toMap(true)} busy={busy} />
            )}
            {step === 3 && (
              <BrainMap
                nodes={nodes}
                setNodes={setNodes}
                insight={analysis && analysis.patterns ? analysis.patterns[0] : ""}
                onNext={toGoals}
                busy={busy}
                isMobile={isMobile}
              />
            )}
            {step === 4 && (
              <Goals
                goalMode={goalMode}
                onSuggest={requestSuggestions}
                onOwn={() => setGoalMode("own")}
                suggestions={suggestions}
                loading={suggestLoading}
                selected={selectedGoal}
                setSelected={setSelectedGoal}
                customGoal={customGoal}
                setCustomGoal={setCustomGoal}
                onBack={() => setStep(3)}
                onBuild={buildPlan}
                busy={busy || suggestLoading}
                isMobile={isMobile}
              />
            )}
            {step === 5 && (
              <Planner key={plan ? plan.id : "pending"} plan={plan} goal={goal} onReset={startOver} onProgress={onProgress} busy={busy} isMobile={isMobile} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
