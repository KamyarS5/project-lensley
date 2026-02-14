# Lensley

Lensley is a real-time assistive vision app for blind and hard-of-sight pedestrians. It uses a live camera feed to detect crosswalk-like striping, pedestrian signal state (`WALK/STOP/UNKNOWN`), and countdown timers when available. The app reports confidence scores and announces important changes with text-to-speech.

## Key Features (MVP)
- Crosswalk detection with confidence score
- Pedestrian signal detection (`WALK`, `STOP`, `UNKNOWN`) with confidence score
- Timer presence detection and optional timer value with confidence score
- Real-time voice output on state change using ElevenLabs (browser TTS fallback if API key is missing)

## Tech Stack
- Frontend: React + Vite
- Backend: FastAPI + OpenCV
- Optional OCR: `pytesseract` (for timer digits)

## Project Structure
- `backend/` FastAPI server and CV inference pipeline
- `frontend/` React app (camera capture + infer polling + TTS)

## Backend Setup (FastAPI)
1. Open a terminal in `backend/`.
2. Create and activate a virtual environment.
3. Install dependencies:
  - `pip install -r requirements.txt`
4. Run server:
  - `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`

Health check:
- `GET http://localhost:8000/health`

Infer endpoint:
- `POST http://localhost:8000/infer`
- Form field: `file` (JPEG/PNG image)

## Frontend Setup (React + Vite)
1. Open a terminal in `frontend/`.
2. Install dependencies:
  - `npm install`
3. Create a local env file from `.env.example`:
  - `VITE_BACKEND_URL=http://localhost:8000/infer`
  - `VITE_ELEVENLABS_API_KEY=<your_key>`
  - `VITE_ELEVENLABS_VOICE_ID=<voice_id>` (optional)
4. Run app:
  - `npm run dev`

Open the Vite URL (typically `http://localhost:5173`) and allow camera access.

## OCR Notes (Timer Value)
- Timer digit extraction uses `pytesseract` only if Tesseract is installed on your machine.
- If Tesseract is not installed, timer presence still works heuristically, but exact `timer_value` may be missing.

## API Response Format
```json
{
  "is_crosswalk": { "value": true, "conf": 0.78 },
  "signal_state": { "value": "STOP", "conf": 0.64 },
  "has_timer": { "value": true, "conf": 0.82 },
  "timer_value": { "value": 12, "conf": 0.71 }
}
```

## Current Behavior
- Frontend captures camera frames about every 450ms.
- Backend returns confidence-scored detections for each frame.
- Frontend announces updates only when scene state changes (to reduce speech spam).
