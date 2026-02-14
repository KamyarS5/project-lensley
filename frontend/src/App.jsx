import { useEffect, useMemo, useRef, useState } from "react";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000/infer";
const ELEVENLABS_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY || "";
const ELEVENLABS_VOICE_ID = import.meta.env.VITE_ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL";

function formatConfidence(conf) {
  return `${Math.round((conf || 0) * 100)}%`;
}

function buildAnnouncement(infer) {
  if (!infer) return "";

  const pieces = [];

  if (infer.is_crosswalk.value) {
    pieces.push(`Crosswalk detected at ${formatConfidence(infer.is_crosswalk.conf)} confidence.`);
  } else {
    pieces.push(`No clear crosswalk detected. Confidence ${formatConfidence(infer.is_crosswalk.conf)}.`);
  }

  const signal = infer.signal_state.value;
  pieces.push(`Signal is ${signal}. Confidence ${formatConfidence(infer.signal_state.conf)}.`);

  if (infer.has_timer.value) {
    if (infer.timer_value.value !== null && infer.timer_value.value !== undefined) {
      pieces.push(
        `Countdown timer shows ${infer.timer_value.value} seconds. Confidence ${formatConfidence(
          infer.timer_value.conf
        )}.`
      );
    } else {
      pieces.push(`Timer detected, value unreadable.`);
    }
  }

  return pieces.join(" ");
}

async function speakWithElevenLabs(text) {
  if (!ELEVENLABS_KEY) {
    const fallback = window.speechSynthesis;
    if (fallback) {
      fallback.cancel();
      fallback.speak(new SpeechSynthesisUtterance(text));
    }
    return;
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}/stream`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": ELEVENLABS_KEY,
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
      }),
    }
  );

  if (!response.ok) {
    throw new Error("ElevenLabs TTS failed");
  }

  const blob = await response.blob();
  const audioUrl = URL.createObjectURL(blob);
  const audio = new Audio(audioUrl);
  await audio.play();
  audio.onended = () => URL.revokeObjectURL(audioUrl);
}

function getStateFingerprint(infer) {
  if (!infer) return "";
  const timerBucket =
    infer.timer_value.value === null || infer.timer_value.value === undefined
      ? "none"
      : Math.max(0, Math.floor(infer.timer_value.value / 3) * 3);

  return [
    infer.is_crosswalk.value,
    infer.signal_state.value,
    infer.has_timer.value,
    timerBucket,
    Math.round((infer.is_crosswalk.conf || 0) * 10),
    Math.round((infer.signal_state.conf || 0) * 10),
  ].join("|");
}

export default function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const prevStateRef = useRef("");
  const speakingRef = useRef(false);

  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [inference, setInference] = useState(null);

  useEffect(() => {
    let stream;

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setRunning(true);
        }
      } catch (e) {
        setError(`Camera access failed: ${e.message}`);
      }
    }

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      setRunning(false);
    };
  }, []);

  useEffect(() => {
    if (!running) return;
    let active = true;

    async function sendFrame() {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!video || !canvas || video.videoWidth === 0 || video.videoHeight === 0) {
        return;
      }

      const maxW = 640;
      const scale = Math.min(1, maxW / video.videoWidth);
      canvas.width = Math.floor(video.videoWidth * scale);
      canvas.height = Math.floor(video.videoHeight * scale);

      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.75));
      if (!blob) return;

      const formData = new FormData();
      formData.append("file", blob, "frame.jpg");

      try {
        const response = await fetch(BACKEND_URL, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Backend error ${response.status}`);
        }

        const result = await response.json();
        if (!active) return;

        setInference(result);

        const currentFingerprint = getStateFingerprint(result);
        const hasChanged = currentFingerprint !== prevStateRef.current;
        if (hasChanged && !speakingRef.current) {
          prevStateRef.current = currentFingerprint;
          const announcement = buildAnnouncement(result);
          speakingRef.current = true;
          speakWithElevenLabs(announcement)
            .catch((e) => setError(`TTS error: ${e.message}`))
            .finally(() => {
              speakingRef.current = false;
            });
        }
      } catch (e) {
        setError(e.message);
      }
    }

    const interval = setInterval(sendFrame, 450);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [running]);

  const statusColor = useMemo(() => {
    if (!inference) return "neutral";
    if (inference.signal_state.value === "WALK") return "safe";
    if (inference.signal_state.value === "STOP") return "danger";
    return "neutral";
  }, [inference]);

  const signalText = inference?.signal_state?.value || "UNKNOWN";
  const countdownValue =
    inference?.timer_value?.value === null || inference?.timer_value?.value === undefined
      ? "N/A"
      : `${inference.timer_value.value}s`;

  return (
    <main className="app-shell">
      <canvas ref={canvasRef} className="hidden-canvas" />

      <header className="topbar">
        <div>
          <p className="eyebrow">Assistive Vision</p>
          <h1>Lensley</h1>
          <p className="subtitle">Real-time crosswalk, signal, and countdown awareness.</p>
        </div>
        <div className={`signal-pill ${statusColor}`}>
          <span className="signal-dot" />
          {signalText}
        </div>
      </header>

      <section className="dashboard-grid">
        <article className="panel camera-panel">
          <div className="panel-header">
            <h2>Live Camera</h2>
            <span className={`chip ${running ? "active" : "inactive"}`}>
              {running ? "Active" : "Not active"}
            </span>
          </div>
          <div className="video-frame">
            <video ref={videoRef} autoPlay playsInline muted className="video" />
          </div>
        </article>

        <article className={`panel status-panel ${statusColor}`}>
          <div className="panel-header">
            <h2>Scene Analysis</h2>
            <span className="chip muted">Updated ~450ms</span>
          </div>

          <div className="metric-grid">
            <div className="metric-card">
              <p className="metric-label">Crosswalk</p>
              <p className="metric-value">{inference?.is_crosswalk?.value ? "Detected" : "Not detected"}</p>
              <p className="metric-sub">Confidence {formatConfidence(inference?.is_crosswalk?.conf)}</p>
            </div>

            <div className="metric-card">
              <p className="metric-label">Signal</p>
              <p className="metric-value">{signalText}</p>
              <p className="metric-sub">Confidence {formatConfidence(inference?.signal_state?.conf)}</p>
            </div>

            <div className="metric-card">
              <p className="metric-label">Timer</p>
              <p className="metric-value">{inference?.has_timer?.value ? "Detected" : "Not detected"}</p>
              <p className="metric-sub">Confidence {formatConfidence(inference?.has_timer?.conf)}</p>
            </div>

            <div className="metric-card">
              <p className="metric-label">Countdown</p>
              <p className="metric-value">{countdownValue}</p>
              <p className="metric-sub">Confidence {formatConfidence(inference?.timer_value?.conf)}</p>
            </div>
          </div>

          <div className="system-row">
            <div className="system-item">
              <span>Backend</span>
              <strong>Connected</strong>
            </div>
            <div className="system-item">
              <span>TTS</span>
              <strong>{ELEVENLABS_KEY ? "ElevenLabs" : "Browser fallback"}</strong>
            </div>
          </div>
        </article>
      </section>

      {error && <p className="error">{error}</p>}
    </main>
  );
}
