from __future__ import annotations

from dataclasses import dataclass
import re

import cv2
import numpy as np

try:
    import pytesseract

    OCR_AVAILABLE = True
except Exception:
    OCR_AVAILABLE = False


@dataclass
class InferenceResult:
    is_crosswalk: tuple[bool, float]
    signal_state: tuple[str, float]
    has_timer: tuple[bool, float]
    timer_value: tuple[int | None, float]


def _clamp_conf(v: float) -> float:
    return float(max(0.0, min(0.99, v)))


def _detect_crosswalk(frame: np.ndarray) -> tuple[bool, float]:
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    _, thresh = cv2.threshold(blur, 170, 255, cv2.THRESH_BINARY)

    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (7, 3))
    cleaned = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel)

    contours, _ = cv2.findContours(cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    stripes = 0
    heights = []
    widths = []

    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        area = w * h
        if area < 250:
            continue
        aspect = w / max(h, 1)
        if aspect > 2.0 and 6 <= h <= 80:
            stripes += 1
            heights.append(h)
            widths.append(w)

    if stripes == 0:
        return False, 0.15

    stripe_density = min(1.0, stripes / 8.0)
    width_consistency = 1.0 - min(1.0, np.std(widths) / max(np.mean(widths), 1.0))
    height_consistency = 1.0 - min(1.0, np.std(heights) / max(np.mean(heights), 1.0))

    score = 0.55 * stripe_density + 0.25 * width_consistency + 0.20 * height_consistency
    conf = _clamp_conf(score)
    return conf > 0.45, conf


def _detect_signal(frame: np.ndarray) -> tuple[str, float]:
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)

    lower_red1 = np.array([0, 90, 70])
    upper_red1 = np.array([12, 255, 255])
    lower_red2 = np.array([165, 90, 70])
    upper_red2 = np.array([180, 255, 255])
    red_mask = cv2.inRange(hsv, lower_red1, upper_red1) | cv2.inRange(hsv, lower_red2, upper_red2)

    lower_walk = np.array([35, 55, 120])
    upper_walk = np.array([90, 255, 255])
    walk_mask = cv2.inRange(hsv, lower_walk, upper_walk)

    red_ratio = float(np.count_nonzero(red_mask)) / red_mask.size
    walk_ratio = float(np.count_nonzero(walk_mask)) / walk_mask.size

    if max(red_ratio, walk_ratio) < 0.001:
        return "UNKNOWN", 0.2

    if red_ratio > walk_ratio:
        conf = _clamp_conf(min(1.0, red_ratio * 45))
        return "STOP", max(conf, 0.35)

    conf = _clamp_conf(min(1.0, walk_ratio * 35))
    return "WALK", max(conf, 0.35)


def _read_timer_digits(gray: np.ndarray) -> tuple[int | None, float]:
    if not OCR_AVAILABLE:
        return None, 0.1

    scaled = cv2.resize(gray, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)
    _, bw = cv2.threshold(scaled, 140, 255, cv2.THRESH_BINARY)
    config = "--oem 3 --psm 6 -c tessedit_char_whitelist=0123456789"

    try:
        text = pytesseract.image_to_string(bw, config=config)
    except Exception:
        return None, 0.1
    match = re.search(r"\b(\d{1,2})\b", text)
    if not match:
        return None, 0.25

    value = int(match.group(1))
    if not (0 <= value <= 99):
        return None, 0.25

    conf = 0.55 if value > 0 else 0.45
    return value, conf


def _detect_timer(frame: np.ndarray) -> tuple[bool, float, int | None, float]:
    h, w = frame.shape[:2]
    roi = frame[0 : int(h * 0.55), int(w * 0.45) : w]
    if roi.size == 0:
        return False, 0.2, None, 0.2

    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 80, 180)
    edge_ratio = float(np.count_nonzero(edges)) / edges.size

    timer_value, timer_conf = _read_timer_digits(gray)
    has_timer = timer_value is not None or edge_ratio > 0.07

    has_timer_conf = _clamp_conf(0.35 + min(0.55, edge_ratio * 2.5))
    if timer_value is not None:
        has_timer_conf = max(has_timer_conf, 0.7)

    return has_timer, has_timer_conf, timer_value, _clamp_conf(timer_conf)


def infer_from_frame(frame: np.ndarray) -> InferenceResult:
    is_crosswalk = _detect_crosswalk(frame)
    signal_state = _detect_signal(frame)
    has_timer, has_timer_conf, timer_value, timer_conf = _detect_timer(frame)

    return InferenceResult(
        is_crosswalk=is_crosswalk,
        signal_state=signal_state,
        has_timer=(has_timer, has_timer_conf),
        timer_value=(timer_value, timer_conf if timer_value is not None else min(timer_conf, 0.3)),
    )
