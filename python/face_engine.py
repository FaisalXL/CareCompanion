"""
Multi-profile face recognition engine.

Family members register their faces via profiles.json (or the REST API).
At runtime the engine encodes reference faces once, then compares against
every detected face in the live camera feed.

Cooldown logic prevents the same person from being announced repeatedly.
"""

import json
import os
import threading
import time
import urllib.request

import cv2
import numpy as np

from config import (
    FACE_COOLDOWN,
    FACE_MATCH_THRESHOLD,
    MAX_FRAME_DIM,
    SFACE_URL,
    YUNET_URL,
)


def _download(url: str, dest: str):
    if os.path.exists(dest):
        return
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req) as r, open(dest, "wb") as f:
            f.write(r.read())
    except Exception as exc:
        print(f"[face_engine] download failed {dest}: {exc}")


class FaceEngine:

    def __init__(self, faces_dir: str = "faces"):
        self.faces_dir = faces_dir
        self._profiles: dict = {}
        self._cooldowns: dict = {}
        self._lock = threading.Lock()

        model_dir = os.path.dirname(os.path.abspath(__file__))
        self._yunet_path = os.path.join(model_dir, "face_detection_yunet_2023mar.onnx")
        self._sface_path = os.path.join(model_dir, "face_recognition_sface_2021dec.onnx")

        _download(YUNET_URL, self._yunet_path)
        _download(SFACE_URL, self._sface_path)

        self._detector = cv2.FaceDetectorYN.create(self._yunet_path, "", (320, 320))
        self._recognizer = cv2.FaceRecognizerSF.create(self._sface_path, "")

        self._load_profiles()

    # ── profile management ────────────────────────────────────────────────

    def _load_profiles(self):
        profiles_file = os.path.join(self.faces_dir, "profiles.json")
        if not os.path.exists(profiles_file):
            return
        try:
            with open(profiles_file) as fh:
                data = json.load(fh)
        except Exception:
            return

        for entry in data.get("profiles", []):
            img_path = os.path.join(self.faces_dir, entry["image"])
            self.register(
                name=entry["name"],
                relationship=entry.get("relationship", ""),
                image_path=img_path,
                notes=entry.get("notes", ""),
            )

    def register(self, name: str, relationship: str, image_path: str,
                 notes: str = "") -> bool:
        """Encode a reference face and store its feature vector."""
        img = cv2.imread(image_path)
        if img is None:
            print(f"[face_engine] cannot read {image_path}")
            return False

        h, w = img.shape[:2]
        if max(h, w) > MAX_FRAME_DIM:
            scale = MAX_FRAME_DIM / max(h, w)
            img = cv2.resize(img, (int(w * scale), int(h * scale)))

        self._detector.setInputSize((img.shape[1], img.shape[0]))
        _, faces = self._detector.detect(img)
        if faces is None or len(faces) == 0:
            print(f"[face_engine] no face found in {image_path}")
            return False

        aligned = self._recognizer.alignCrop(img, faces[0])
        features = self._recognizer.feature(aligned)

        with self._lock:
            self._profiles[name] = {
                "features": features,
                "relationship": relationship,
                "notes": notes,
                "image_path": image_path,
            }
        print(f"[face_engine] registered: {name} ({relationship})")
        return True

    # ── recognition ───────────────────────────────────────────────────────

    def recognize(self, frame: np.ndarray) -> list[dict]:
        """Return list of recognized people (with cooldown filtering)."""
        h, w = frame.shape[:2]
        self._detector.setInputSize((w, h))
        _, faces = self._detector.detect(frame)
        if faces is None:
            return []

        now = time.time()
        results = []

        with self._lock:
            for face in faces:
                aligned = self._recognizer.alignCrop(frame, face)
                live_feat = self._recognizer.feature(aligned)

                best_name, best_score = None, 0.0
                for name, prof in self._profiles.items():
                    score = self._recognizer.match(
                        prof["features"], live_feat,
                        cv2.FaceRecognizerSF_FR_COSINE,
                    )
                    if score >= FACE_MATCH_THRESHOLD and score > best_score:
                        best_score = score
                        best_name = name

                if best_name is None:
                    continue

                if best_name in self._cooldowns:
                    if now - self._cooldowns[best_name] < FACE_COOLDOWN:
                        continue

                self._cooldowns[best_name] = now
                results.append({
                    "name": best_name,
                    "relationship": self._profiles[best_name]["relationship"],
                    "confidence": round(best_score, 3),
                    "notes": self._profiles[best_name].get("notes", ""),
                })

        return results

    def get_all_profiles(self) -> list[dict]:
        with self._lock:
            return [
                {
                    "name": n,
                    "relationship": p["relationship"],
                    "notes": p.get("notes", ""),
                    "has_image": bool(p.get("image_path")),
                }
                for n, p in self._profiles.items()
            ]

    def get_face_image_b64(self, name: str) -> str | None:
        """Return the face image as a base64-encoded JPEG string."""
        import base64
        with self._lock:
            p = self._profiles.get(name)
            if not p or not p.get("image_path"):
                return None
            path = p["image_path"]

        if not os.path.exists(path):
            return None

        try:
            img = cv2.imread(path)
            if img is None:
                return None
            h, w = img.shape[:2]
            if max(h, w) > 200:
                scale = 200 / max(h, w)
                img = cv2.resize(img, (int(w * scale), int(h * scale)))
            _, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 70])
            return base64.b64encode(buf.tobytes()).decode("ascii")
        except Exception:
            return None

    def add_profile_runtime(self, name: str, relationship: str):
        """Add a face profile at runtime (from the family app). No image encoding."""
        with self._lock:
            if name not in self._profiles:
                self._profiles[name] = {
                    "relationship": relationship,
                    "notes": "",
                    "features": None,
                    "image_path": None,
                }
                print(f"[faces] runtime profile added: {name} ({relationship})")
