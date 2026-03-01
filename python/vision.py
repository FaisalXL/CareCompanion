"""
Camera management and VLM-powered vision tools.

Provides scene description, object finding with directional guidance,
and OCR — all powered by the local SmolVLM (or cloud OpenAI as fallback).
"""

import base64
import threading

import cv2
import numpy as np

from config import CAMERA_INDEX, MAX_FRAME_DIM, VLM_MAX_TOKENS


class VisionProcessor:

    def __init__(self, llm_router=None):
        self._cap = cv2.VideoCapture(CAMERA_INDEX)
        self._lock = threading.Lock()
        self._llm = llm_router

    def set_llm_router(self, router):
        self._llm = router

    def release(self):
        if self._cap and self._cap.isOpened():
            self._cap.release()

    # ── frame capture ─────────────────────────────────────────────────────

    def capture_frame(self) -> np.ndarray | None:
        with self._lock:
            ret, frame = self._cap.read()
        if not ret:
            return None

        h, w = frame.shape[:2]
        if max(h, w) > MAX_FRAME_DIM:
            scale = MAX_FRAME_DIM / max(h, w)
            frame = cv2.resize(frame, (int(w * scale), int(h * scale)))
        return frame

    def frame_to_b64(self, frame: np.ndarray) -> str:
        _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
        return base64.b64encode(buf).decode("utf-8")

    # ── VLM queries ───────────────────────────────────────────────────────

    def _vlm_query(self, frame: np.ndarray, text_prompt: str) -> str:
        if self._llm is None:
            return "(vision system not initialised)"
        b64 = self.frame_to_b64(frame)
        return self._llm.complete_vision(b64, text_prompt)

    def describe_scene(self, frame: np.ndarray) -> str:
        """Describe the environment visible in *frame*."""
        return self._vlm_query(
            frame,
            "Describe what you see in this image in 2-3 concise sentences. "
            "Focus on the environment, notable objects, and any people. "
            "This description will be spoken aloud to help a visually "
            "impaired person understand their surroundings.",
        )

    def find_object(self, frame: np.ndarray, object_name: str) -> str:
        """Locate *object_name* and return directional guidance."""
        return self._vlm_query(
            frame,
            f"Look at this image carefully. Is there a '{object_name}' visible? "
            f"If YES: describe its exact spatial position using directions "
            f"(left, right, center, close, far, on the table, on the floor, etc.) "
            f"so a blind person can reach it. "
            f"If NO: say the object is not visible and suggest where it might "
            f"commonly be found.",
        )

    def read_text(self, frame: np.ndarray) -> str:
        """OCR — read any text visible in *frame*."""
        return self._vlm_query(
            frame,
            "Read ALL text visible in this image. Include labels, signs, "
            "medicine bottle labels, screens, letters — everything. "
            "Return the text exactly as written. If no text is visible, "
            "say 'No readable text found.'",
        )

    def analyze_for_safety(self, frame: np.ndarray) -> str:
        """Check the scene for safety hazards."""
        return self._vlm_query(
            frame,
            "Analyze this image for potential safety hazards for an elderly "
            "person (trip hazards, spills, obstacles, stove left on, etc.). "
            "If everything looks safe, say 'No hazards detected.' "
            "If there are hazards, list them clearly.",
        )
