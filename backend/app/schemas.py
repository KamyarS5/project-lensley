from pydantic import BaseModel
from typing import Optional, Union


class DetectionValue(BaseModel):
    value: Optional[Union[bool, str, int]]
    conf: float


class InferenceResponse(BaseModel):
    is_crosswalk: DetectionValue
    signal_state: DetectionValue
    has_timer: DetectionValue
    timer_value: DetectionValue
