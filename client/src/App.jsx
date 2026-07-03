import { useEffect, useRef, useState } from "react";

/* ---------- dial geometry: 270° arc, open at the bottom ---------- */
const CX = 150, CY = 150, R = 118, START = 135, SWEEP = 270;
const polar = (deg) => {
  const a = (deg * Math.PI) / 180;
  return [CX + R * Math.cos(a), CY + R * Math.sin(a)];
};
const arcPath = () => {
  const [x1, y1] = polar(START);
  const [x2, y2] = polar(START + SWEEP);
  return `M ${x1} ${y1} A ${R} ${R} 0 1 1 ${x2} ${y2}`;
};

/* ---------- colour along the disgust spectrum ---------- */
const STOPS = [
  [0, [95, 214, 160]], [35, [196, 214, 69]], [58, [240, 168, 48]],
  [78, [232, 99, 44]], [100, [192, 48, 122]],
];
function colorAt(v) {
  v = Math.max(0, Math.min(100, v));
  for (let i = 0; i < STOPS.length - 1; i++) {
    const [p0, c0] = STOPS[i], [p1, c1] = STOPS[i + 1];
    if (v <= p1) {
      const t = (v - p0) / (p1 - p0);
      const c = c0.map((n, k) => Math.round(n + (c1[k] - n) * t));
      return `rgb(${c[0]},${c[1]},${c[2]})`;
    }
  }
  return `rgb(${STOPS.at(-1)[1].join(",")})`;
}
function bandLabel(v) {
  if (v <= 15) return "בסדר גמור";
  if (v <= 35) return "קצת מקולל";
  if (v <= 55) return "מפוקפק";
  if (v <= 75) return "ממש לא בסדר";
  if (v <= 90) return "מבחיל";
  return "פשע נגד הפה";
}

export default function App() {
  const fillRef = useRef(null);
  const tipRef = useRef(null);
  const scoreRef = useRef(null);
  const bandRef = useRef(null);
  const rafRef = useRef(0);
  const currentRef = useRef(0);
  const recogRef = useRef(null);
  const transcriptRef = useRef("");
  const finalRef = useRef("");

  const [verdict, setVerdict] = useState({ text: "הקישו על המיקרופון והתחילו למנות דברים.", cls: "empty" });
  const [chips, setChips] = useState([]);
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState("הקישו כדי לדבר");
  const [liveT, setLiveT] = useState("");
  const [textIn, setTextIn] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [hasResult, setHasResult] = useState(false);
  const scoreValRef = useRef(0);
  const canSpeak = typeof window !== "undefined" && !!window.speechSynthesis;
  const [bubbles] = useState(() =>
    Array.from({ length: 14 }, () => ({
      size: 6 + Math.random() * 22,
      left: Math.random() * 100,
      dur: 11 + Math.random() * 16,
      delay: -Math.random() * 16,
    }))
  );

  /* paint the gauge at a given value */
  function setVisual(v) {
    const col = colorAt(v);
    const fill = fillRef.current, tip = tipRef.current, score = scoreRef.current, band = bandRef.current;
    if (fill) { fill.style.stroke = col; fill.setAttribute("stroke-dashoffset", 100 - v); fill.style.opacity = v < 0.5 ? 0 : 1; }
    if (score) { score.textContent = Math.round(v); score.style.color = col; }
    if (tip) {
      const [tx, ty] = polar(START + SWEEP * (v / 100));
      tip.style.color = col; tip.setAttribute("fill", col);
      tip.setAttribute("cx", tx); tip.setAttribute("cy", ty);
      tip.setAttribute("opacity", v > 0 ? 1 : 0);
    }
    if (band) { band.textContent = bandLabel(v); band.style.color = col; }
  }
  function animateTo(target) {
    cancelAnimationFrame(rafRef.current);
    const from = currentRef.current, dur = 1300, t0 = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    const step = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      const v = from + (target - from) * ease(t);
      setVisual(v);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
      else currentRef.current = target;
    };
    rafRef.current = requestAnimationFrame(step);
  }

  /* read the current verdict aloud (Hebrew text-to-speech) */
  function speak() {
    const synth = window.speechSynthesis;
    if (!synth) return;
    if (speaking) { synth.cancel(); setSpeaking(false); return; }
    const parts = [`ציון הגועל: ${scoreValRef.current}`, bandLabel(scoreValRef.current), verdict.text];
    const u = new SpeechSynthesisUtterance(parts.filter(Boolean).join(". "));
    u.lang = "he-IL";
    u.rate = 1;
    const heVoice = synth.getVoices().find((v) => v.lang && v.lang.toLowerCase().startsWith("he"));
    if (heVoice) u.voice = heVoice;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    synth.cancel();
    setSpeaking(true);
    synth.speak(u);
  }

  /* initial paint + speech-recognition setup */
  useEffect(() => {
    setVisual(0);
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      const recog = new SR();
      recog.lang = "he-IL";
      recog.interimResults = true;
      recog.continuous = true;
      recog.onresult = (e) => {
        // Only newly-changed results are read (from resultIndex onward).
        // Finalized chunks are appended once to finalRef; interim text is
        // rebuilt live. This avoids the duplicate/runaway accumulation that
        // happens when re-reading the whole results list on every event and
        // across the onend->start() restart loop.
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          if (res.isFinal) finalRef.current += res[0].transcript + " ";
          else interim += res[0].transcript;
        }
        const full = (finalRef.current + interim).replace(/\s+/g, " ").trim();
        transcriptRef.current = full;
        setLiveT(full);
      };
      recog.onend = () => { if (recogRef.current?._listening) { try { recog.start(); } catch {} } };
      recog.onerror = (ev) => {
        if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
          setHint("הגישה למיקרופון חסומה — הקלידו למטה");
          stopListening(false);
        } else if (ev.error === "no-speech") {
          setHint("לא נשמע כלום — נסו שוב או הקלידו");
        }
      };
      recogRef.current = recog;
    } else {
      setHint("אין תמיכה בקול כאן — הקלידו למטה");
    }
    return () => { try { recogRef.current?.stop(); } catch {} try { window.speechSynthesis?.cancel(); } catch {} cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function judge(text) {
    text = (text || "").trim();
    if (!text) { setVerdict({ text: "קודם תגידו או תקלידו כמה דברים.", cls: "empty" }); return; }
    if (busy) return;
    try { window.speechSynthesis?.cancel(); } catch {}
    setSpeaking(false);
    setHasResult(false);
    setBusy(true);
    setHint("");
    setVerdict({ text: "מנתחים את הדגימה…", cls: "" });
    setChips([]);
    try {
      const res = await fetch("/api/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error("HTTP " + res.status + " " + (await res.text()).slice(0, 140));
      const out = await res.json();
      const score = Math.max(0, Math.min(100, Math.round(out.score)));
      setVerdict({ text: out.verdict || "…אין מילים לתאר את זה.", cls: "" });
      setChips(out.ingredients || []);
      scoreValRef.current = score;
      setHasResult(true);
      animateTo(score);
    } catch (err) {
      setVerdict({ text: "תקלה: " + (err.message || err), cls: "err" });
      console.error(err);
    } finally {
      setBusy(false);
      setHint(recogRef.current ? "הקישו כדי לדבר" : "אין תמיכה בקול — הקלידו למעלה");
    }
  }

  function startListening() {
    const recog = recogRef.current;
    if (!recog) return;
    transcriptRef.current = ""; finalRef.current = ""; setLiveT("");
    recog._listening = true; setListening(true);
    setHint("מקשיבים… הקישו כדי לעצור");
    try { recog.start(); } catch {}
  }
  function stopListening(doJudge = true) {
    const recog = recogRef.current;
    if (recog) recog._listening = false;
    setListening(false);
    setHint("הקישו כדי לדבר");
    try { recog?.stop(); } catch {}
    if (doJudge && transcriptRef.current.trim()) judge(transcriptRef.current);
  }
  const onMic = () => {
    if (!recogRef.current) return;
    listening ? stopListening(true) : startListening();
  };

  return (
    <>
      <div className="bubbles" aria-hidden="true">
        {bubbles.map((b, i) => (
          <span key={i} style={{
            width: b.size, height: b.size, left: b.left + "%",
            animationDuration: b.dur + "s", animationDelay: b.delay + "s",
          }} />
        ))}
      </div>

      <div className="wrap">
        <header>
          <div className="eyebrow">ניתוח דגימה</div>
          <h1>מד הגועל</h1>
          <p className="sub">אמרו צירוף כלשהו של דברים — אוכל, לא אוכל, לא משנה — וגלו כמה זה מגעיל.</p>
        </header>

        <div className="dial">
          <svg viewBox="0 0 300 300" aria-hidden="true">
            <path className="track" d={arcPath()} pathLength="100" />
            <path ref={fillRef} className="fill" d={arcPath()} pathLength="100" strokeDasharray="100" strokeDashoffset="100" />
            <circle ref={tipRef} className="tip" r="9" fill="var(--mint)" cx="0" cy="0" opacity="0" />
          </svg>
          <div className="readout">
            <div ref={scoreRef} className="score" role="status" aria-live="polite">0</div>
            <div className="of">מתוך 100 גועל</div>
            <div ref={bandRef} className="band" />
          </div>
        </div>

        <div className="verdict-row">
          <p className={"verdict " + verdict.cls}>{verdict.text}</p>
          {hasResult && canSpeak && (
            <button
              className={"play" + (speaking ? " playing" : "")}
              onClick={speak}
              aria-label={speaking ? "עצרו את ההקראה" : "השמיעו את התוצאה"}
              title={speaking ? "עצרו" : "השמיעו את התוצאה"}
            >
              {speaking ? "■" : "▶"}
            </button>
          )}
        </div>

        <div className="chips" aria-label="מרכיבים">
          {chips.map((c, i) => <span key={i} className="chip">{c}</span>)}
        </div>

        <div className="controls">
          <button className={"mic" + (listening ? " live" : "")} onClick={onMic} disabled={busy} aria-label="הקישו כדי לדבר">
            {listening ? "■" : "🎤"}
          </button>
          <div className="hint">{hint}</div>
          <div className="live-transcript" aria-live="polite">{liveT}</div>

          <div className="typed">
            <input
              type="text"
              value={textIn}
              onChange={(e) => setTextIn(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") judge(textIn); }}
              placeholder="…או הקלידו אותם, למשל קטשופ, משחת שיניים, מהדק"
              aria-label="הקלידו מרכיבים"
            />
            <button onClick={() => judge(textIn)} disabled={busy}>דרגו</button>
          </div>
        </div>

        <p className="footnote">הפסיקות ניתנות בידי קלוד, ללא הכשרה קולינרית ועם דעות נחרצות. למטרות בידור בלבד — בבקשה אל תאכלו את המהדק.</p>
      </div>
    </>
  );
}
