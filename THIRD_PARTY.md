# Third-party files shipped with the app

| File | Source | Notes |
|---|---|---|
| `models/mediapipe/wasm/vision_wasm_internal.{js,wasm}` | npm `@mediapipe/tasks-vision` 1.2.3 (Apache-2.0) | Copied from `node_modules` at build time by `vite.config.ts`; version pinned by `package-lock.json`. |
| `models/blaze_face_short_range.tflite` | https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite | MediaPipe Face Detector (BlazeFace short-range). SHA-256 `b4578f35940bf5a1a655214a1cce5cab13eba73c1297cd78e1a04c2380b0152f`. Check the MediaPipe model card for the model's license terms before redistributing outside this project. |

Everything above is served from this app's own domain. Face detection runs entirely in the browser; frames and face positions are never sent anywhere.
