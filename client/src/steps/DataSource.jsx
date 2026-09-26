import React, { useState, useRef } from "react";
import { C, S } from "../styles/tokens.js";
import { Btn, RemoveBtn } from "../components/Btn.jsx";
import { Toggle } from "../components/Toggle.jsx";
import { AccuracyBar } from "../components/AccuracyBar.jsx";
import { ACCEPT_RE, readFileExcerpt, readFileFull, fmtSize } from "../lib/files.js";
import { newId } from "../lib/layout.js";

export default function DataSource({ platform, setPlatform, files, setFiles, manualText, setManualText, selfReport, setSelfReport, onBack, onAnalyze, busy, isMobile }) {
  const [dragOver, setDragOver] = useState(false);
  const [rejected, setRejected] = useState([]);
  const inputRef = useRef(null);

  function addFiles(list) {
    const arr = Array.from(list || []);
    const ok = arr.filter((f) => ACCEPT_RE.test(f.name));
    setRejected(arr.filter((f) => !ACCEPT_RE.test(f.name)).map((f) => f.name));
    ok.forEach((file) => {
      const id = newId();
      const kind = /\.zip$/i.test(file.name) ? "zip" : /\.json$/i.test(file.name) ? "json" : "html";
      setFiles((fs) => {
        if (fs.some((f) => f.name === file.name && f.size === file.size)) return fs;
        return [...fs, { id, name: file.name, size: file.size, kind, text: null, status: kind === "zip" ? "archive" : "reading" }];
      });
      if (kind !== "zip") {
        Promise.all([readFileExcerpt(file), readFileFull(file)]).then(([text, full]) =>
          setFiles((fs) => fs.map((f) => (f.id === id ? { ...f, text, full, status: text ? "ready" : "empty" } : f)))
        );
      }
    });
  }

  const hasFiles = files.length > 0;
  const manualActive = !hasFiles && manualText.trim().length > 0;
  const accuracy = hasFiles ? (platform === "both" ? 85 : 65) : manualActive ? 40 : 0;
  const reading = files.some((f) => f.status === "reading");
  const valid = (hasFiles && !reading) || manualText.trim().length >= 20;
  const statusText = { reading: "reading…", ready: "text read", empty: "no readable text", archive: "zip — filename only, not parsed in-browser" };

  return (
    <div>
      <h2 style={S.h2}>Feed the audit.</h2>
      <p style={{ ...S.sub, marginBottom: 28 }}>Exports beat memory. People misreport their own habits. Files don't.</p>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 12 }}>
        {/* Upload panel */}
        <div style={S.card}>
          <div style={{ ...S.label, marginBottom: 14 }}>A / Upload export</div>
          <Toggle
            testId="platform-toggle"
            value={platform}
            onChange={setPlatform}
            options={[["youtube", "YouTube"], ["instagram", "Instagram"], ["both", "Both"]]}
          />
          <div
            role="button"
            tabIndex={0}
            data-testid="dropzone"
            onClick={() => inputRef.current && inputRef.current.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                inputRef.current && inputRef.current.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              addFiles(e.dataTransfer.files);
            }}
            style={{
              marginTop: 14,
              border: `1px dashed ${dragOver ? C.accent : C.dim}`,
              background: dragOver ? "rgba(232,255,0,0.04)" : C.bg,
              padding: "28px 16px",
              textAlign: "center",
              cursor: "pointer",
              outline: "none",
            }}
          >
            <div style={{ fontSize: 22, color: dragOver ? C.accent : C.muted, marginBottom: 8 }}>↓</div>
            <div style={{ fontSize: 13, marginBottom: 4 }}>Drop files or click to browse</div>
            <div style={{ fontSize: 11, color: C.muted }}>.json · .zip · .html</div>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".json,.zip,.html,.htm"
              data-testid="file-input"
              style={{ display: "none" }}
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
          {rejected.length > 0 && (
            <div style={{ fontSize: 12, color: C.danger, marginTop: 10 }}>Rejected (unsupported type): {rejected.join(", ")}</div>
          )}
          {hasFiles && (
            <div style={{ marginTop: 12 }}>
              {files.map((f) => (
                <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</div>
                    <div style={{ fontSize: 11, color: f.kind === "zip" ? "#ff8a3d" : C.muted }}>
                      {fmtSize(f.size)} · {statusText[f.status]}
                    </div>
                  </div>
                  <RemoveBtn label={`Remove ${f.name}`} onClick={() => setFiles((fs) => fs.filter((x) => x.id !== f.id))} />
                </div>
              ))}
            </div>
          )}
          <div style={{ fontSize: 11, color: "#4a4a4a", marginTop: 14, lineHeight: 1.6 }} data-testid="export-hint">
            YouTube: Takeout → YouTube and YouTube Music → history → watch-history.json. Instagram: Download your information → JSON.
          </div>
        </div>

        {/* Manual panel */}
        <div style={{ ...S.card, display: "flex", flexDirection: "column" }}>
          <div style={{ ...S.label, marginBottom: 14 }}>B / Describe it manually</div>
          <textarea
            data-testid="manual-text"
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            placeholder="What do you actually watch, follow and scroll? Channels, topics, how many hours. Be specific."
            rows={8}
            style={{ ...S.input, resize: "vertical", flex: 1, minHeight: 160, lineHeight: 1.6 }}
          />
          <div style={{ fontSize: 11, color: manualText.trim().length >= 20 ? C.muted : "#444", marginTop: 8 }}>
            {manualText.trim().length} chars {manualText.trim().length < 20 ? "· min 20" : ""}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 12 }}>
            {[
              ["hoursPerDay", "H / day", "number", "sr-hours"],
              ["bedtime", "Bedtime", "time", "sr-bedtime"],
              ["wakeTime", "Wake", "time", "sr-wake"],
            ].map(([k, label, type, tid]) => (
              <label key={k} style={{ display: "block", minWidth: 0 }}>
                <span style={{ ...S.label, fontSize: 10, display: "block", marginBottom: 4 }}>{label}</span>
                <input
                  type={type}
                  data-testid={tid}
                  value={selfReport[k]}
                  min={type === "number" ? 0 : undefined}
                  max={type === "number" ? 24 : undefined}
                  step={type === "number" ? 0.5 : undefined}
                  placeholder={type === "number" ? "4" : undefined}
                  onChange={(e) => setSelfReport((r) => ({ ...r, [k]: e.target.value }))}
                  style={{ ...S.input, padding: "8px 8px", fontSize: 13, colorScheme: "dark" }}
                />
              </label>
            ))}
          </div>
          <div style={{ ...S.label, fontSize: 10, margin: "10px 0 4px" }}>3 worst habits</div>
          <div style={{ display: "grid", gap: 6 }}>
            {[0, 1, 2].map((i) => (
              <input
                key={i}
                data-testid={`sr-habit-${i}`}
                value={selfReport.worstHabits[i]}
                maxLength={80}
                placeholder={["e.g. scrolling in bed", "e.g. Shorts at lunch", "e.g. autoplay binges"][i]}
                onChange={(e) => setSelfReport((r) => ({ ...r, worstHabits: r.worstHabits.map((w, j) => (j === i ? e.target.value : w)) }))}
                style={{ ...S.input, padding: "8px 10px", fontSize: 13 }}
              />
            ))}
          </div>
          {manualActive && (
            <div data-testid="manual-warning" style={{ marginTop: 12, border: `1px solid #ff8a3d`, color: "#ff8a3d", padding: "10px 12px", fontSize: 12, letterSpacing: "0.04em" }}>
              ⚠ Lower accuracy — upload recommended
            </div>
          )}
        </div>
      </div>

      <AccuracyBar
        label="Estimated accuracy"
        value={accuracy}
        caption={
          hasFiles
            ? platform === "both"
              ? "Two platforms cross-checked. Best signal available."
              : "Single platform. Solid signal, partial picture."
            : manualActive
            ? "Self-reported. Expect blind spots."
            : "No input yet."
        }
      />

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 28, gap: 12 }}>
        <Btn variant="ghost" onClick={onBack} disabled={busy}>
          ← Back
        </Btn>
        <Btn onClick={() => onAnalyze(accuracy)} disabled={busy || !valid}>
          Analyze →
        </Btn>
      </div>
    </div>
  );
}
