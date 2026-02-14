from pydantic import BaseModel


class DetectionValue(BaseModel):
    value: bool | str | int | None
    conf: float


class InferenceResponse(BaseModel):
    is_crosswalk: DetectionValue
    signal_state: DetectionValue
    has_timer: DetectionValue
    timer_value: DetectionValue
