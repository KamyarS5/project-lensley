from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import cv2
import numpy as np

from .schemas import DetectionValue, InferenceResponse
from .vision import infer_from_frame

app = FastAPI(title="Lensley API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/infer", response_model=InferenceResponse)
async def infer(file: UploadFile = File(...)) -> InferenceResponse:
    if file.content_type not in {"image/jpeg", "image/jpg", "image/png"}:
        raise HTTPException(status_code=400, detail="Expected JPEG or PNG frame upload")

    payload = await file.read()
    np_arr = np.frombuffer(payload, np.uint8)
    frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    if frame is None:
        raise HTTPException(status_code=400, detail="Could not decode image")

    result = infer_from_frame(frame)

    return InferenceResponse(
        is_crosswalk=DetectionValue(value=result.is_crosswalk[0], conf=result.is_crosswalk[1]),
        signal_state=DetectionValue(value=result.signal_state[0], conf=result.signal_state[1]),
        has_timer=DetectionValue(value=result.has_timer[0], conf=result.has_timer[1]),
        timer_value=DetectionValue(value=result.timer_value[0], conf=result.timer_value[1]),
    )
