"""
Two-phase fall detection (free-fall → impact) from raw accelerometer data.

The sketch sends (x, y, z) g-values via Bridge.notify.  This module checks
for a low-g free-fall phase followed by a high-g impact within a short window.
"""

import math
import time
import threading


class FallDetector:

    def __init__(self, free_fall_g=0.5, impact_g=2.5, window_sec=0.6,
                 on_fall=None, on_jolt=None):
        self.free_fall_g = free_fall_g
        self.impact_g = impact_g
        self.window = window_sec
        self._free_fall_time = None
        self._on_fall = on_fall
        self._on_jolt = on_jolt
        self._lock = threading.Lock()
        self._last_fall_time = 0
        self._fall_cooldown = 10  # ignore repeat falls within 10 s

    def set_callbacks(self, on_fall=None, on_jolt=None):
        if on_fall:
            self._on_fall = on_fall
        if on_jolt:
            self._on_jolt = on_jolt

    def process_sample(self, x: float, y: float, z: float):
        """Feed one accelerometer sample (units: g)."""
        mag = math.sqrt(x * x + y * y + z * z)
        now = time.time()

        with self._lock:
            if mag < self.free_fall_g:
                if self._free_fall_time is None:
                    self._free_fall_time = now

            elif mag > self.impact_g:
                if (self._free_fall_time is not None
                        and (now - self._free_fall_time) <= self.window):
                    elapsed = now - self._free_fall_time
                    if now - self._last_fall_time > self._fall_cooldown:
                        self._last_fall_time = now
                        if self._on_fall:
                            self._on_fall({
                                "magnitude": round(mag, 3),
                                "elapsed": round(elapsed, 3),
                                "x": round(x, 3),
                                "y": round(y, 3),
                                "z": round(z, 3),
                            })
                else:
                    if self._on_jolt:
                        self._on_jolt({"magnitude": round(mag, 3)})
                self._free_fall_time = None

            else:
                if (self._free_fall_time is not None
                        and (now - self._free_fall_time) > self.window):
                    self._free_fall_time = None
