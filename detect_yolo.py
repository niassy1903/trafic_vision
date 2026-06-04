# -*- coding: utf-8 -*-
"""
========================================================================
🎥 YOLOv8 Real-Time Traffic Violation Detection System (No-Helmet Rider)
========================================================================
This Python client connects our Computer Vision YOLO AI models to the Node.js
Express API back-end via real-time JSON transmissions using Base64 imagery.

Author: AI Traffic Automation Core Team
"""

import cv2
import os
import base64
import requests
from datetime import datetime

try:
    from ultralytics import YOLO
except ImportError:
    print("❌ ERROR: 'ultralytics' library is required to run YOLOv8 models.")
    print("👉 Please run: pip install ultralytics requests opencv-python")
    exit(1)

# ========================================================================
# 📡 CONFIGURATION
# ========================================================================
# Address of the Node.js API server.
# - If running integrated server, port is 3000: "http://localhost:3000/api/infractions"
# - If running stand-alone backend, port is 3001: "http://localhost:3001/api/infractions"
NODE_API_URL = "http://localhost:3000/api/infractions"

# ========================================================================
# 🤖 YOLO COCO + CASQUE MODEL INITIALIZATION
# ========================================================================
print("⏳ Loading YOLOv8 custom models...")
try:
    # 1. Base YOLOv8 model for general COCO classes (like motorcycles, cars, riders)
    model_moto = YOLO("yolov8n.pt")
    
    # 2. Specialty trained model to find helmet infractions ("With Helmet" / "Without Helmet")
    # For simulation, we fall back gracefully if your custom best.pt weights are not yet found.
    weights_path = "runs/detect/train/weights/best.pt"
    if os.path.exists(weights_path):
        model_helmet = YOLO(weights_path)
        print(f"✅ Loaded specialty helmet weights from: {weights_path}")
    else:
        # Fallback to base model for simulation/standalone tracking
        model_helmet = model_moto
        print(f"⚠️  Specialty weights '{weights_path}' not found. Using yolov8n.pt as local handler.")
        
except Exception as e:
    print(f"❌ Failed to load YOLO models: {e}")
    exit(1)

# Ensure folder exists to save local evidence files
os.makedirs("moto", exist_ok=True)

# Initialize camera device capture stream (0 is usually the integrated webcam)
print("🎥 Initializing hardware video capture on Camera [0]...")
cap = cv2.VideoCapture(0)

if not cap.isOpened():
    print("❌ ERROR: Camera inaccessible or already in use by another application.")
    print("👉 If you are in a headless environment, consider feeding a pre-recorded test MP4 file instead:")
    print("   cap = cv2.VideoCapture('path/to/test_video.mp4')")
    exit(1)

print("\n==========================================================")
print("🎥 AI MOTORCYCLE HELMET TRACKING SYSTEM ONLINE!")
print(f"📡 Transmitting real-time violations to: {NODE_API_URL}")
print("   - Press 'ESC' relative to the window to shut down.")
print("==========================================================\n")

def send_infraction_payload(image_path, box_coords, confidence):
    """
    Encodes the captured infraction JPEG into a Base64 string and uploads it
    directly to the decoupled Node.js API backend as part of a clean JSON payload.
    """
    now = datetime.now()
    
    # Ready the image binary and convert to a base64 encoded stream
    try:
        with open(image_path, "rb") as img_file:
            base64_data = base64.b64encode(img_file.read()).decode('utf-8')
        image_uri = f"data:image/jpeg;base64,{base64_data}"
    except Exception as err:
        print(f"⚠️  Could not convert infraction image to base64: {err}")
        return

    # Structure perfect JSON payload
    payload = {
        "type": "moto_sans_casque",
        "date_infraction": now.strftime("%Y-%m-%d"),
        "heure_infraction": now.strftime("%H:%M:%S"),
        "distance": 0,
        "etat_feu": "vert",  # Can represent the current controller's light state
        "message": "Détection Intelligence Artificielle YOLOv8: Motocycliste circulant sans casque de protection",
        "image": image_uri,
        "coordonnees": str(box_coords),
        "score_confiance": round(float(confidence), 2)
    }

    try:
        response = requests.post(NODE_API_URL, json=payload, timeout=5)
        if response.status_code == 201 or response.status_code == 200:
            print(f"📡 [SYNC SUCCESS] Uploaded to Node.js! Coords {box_coords} | Conf: {confidence:.2f}")
        else:
            print(f"⚠️  [SERVER RESPONSE ERROR] Status {response.status_code}: {response.text}")
    except requests.exceptions.RequestException as e:
        print(f"❌ [API TRANSMISSION FAILED] Connection refused. Is Node.js running on Port 3000/3001?")
        print(f"   Internal Error: {e}")

# ========================================================================
# 🔄 REAL-TIME PROCESSING LOOP
# ========================================================================
try:
    while True:
        ret, frame = cap.read()
        if not ret:
            print("⚠️  Frame drops detected. Waiting to reconnect stream...")
            continue

        # 🔥 Execute tracking with persistence to assign unique tracker IDs
        results = model_moto.track(frame, persist=True, verbose=False)
        annotated = results[0].plot()

        if results[0].boxes is not None:
            for box in results[0].boxes:
                # Retrieve class identifier
                cls_id = int(box.cls[0].item())
                class_name = model_moto.names[cls_id]

                # Filter strictly for motorcycles / moto-related elements
                if class_name != "motorcycle":
                    continue

                # Bounding box boundaries
                xyxy = box.xyxy[0].cpu().numpy()
                x1, y1, x2, y2 = map(int, xyxy)

                # Ensure boundaries do not leak negative dimension crops
                h, w = frame.shape[:2]
                x1, y1 = max(0, x1), max(0, y1)
                x2, y2 = min(w, x2), min(h, y2)

                if x2 <= x1 or y2 <= y1:
                    continue

                # Crop motorcycle frame section
                moto_crop = frame[y1:y2, x1:x2]
                if moto_crop.size == 0:
                    continue

                # Run custom casque model against cropped motorcycle selection
                helmet_results = model_helmet(moto_crop, verbose=False)
                no_helmet_detected = False
                highest_helmet_conf = 0.85 # default mockup confidence

                if helmet_results[0].boxes is not None:
                    for hbox in helmet_results[0].boxes:
                        hcls = int(hbox.cls[0].item())
                        hname = model_helmet.names[hcls]
                        hconf = float(hbox.conf[0].item())

                        # Identify if label represents a "Without Helmet" / "No Helmet" classification
                        if hname.lower() in ["without helmet", "no helmet", "sans_casque"]:
                            no_helmet_detected = True
                            highest_helmet_conf = hconf
                            break
                else:
                    # In demonstration mode with a fallback base model, we can simulate detections of motorcyclists 
                    # as helmetless if they are at specific bounding positions or randomly for software testing.
                    # Remove or change this if you are using your real absolute trained best.pt weights.
                    if model_helmet == model_moto:
                        # Simple simulation condition so you can see live triggers while testing with base COCO
                        no_helmet_detected = (x1 % 2 == 0) # Trigger at regular coordinate boundaries
                        highest_helmet_conf = 0.91

                # 🚨 INFRACTION COMMITTED: Trigger automated notification alert!
                if no_helmet_detected:
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    filename = f"moto/infraction_{timestamp}.jpg"

                    # Save full frame locally for backup archives
                    cv2.imwrite(filename, frame)
                    print(f"🚨 [INFRACTION ALERTE] Conducteur sans casque détecté ! (Confidence: {highest_helmet_conf:.2f})")

                    # Deliver JSON upload payload with base64 image data to Node.js backend
                    send_infraction_payload(filename, [x1, y1, x2, y2], highest_helmet_conf)

        # Render output display window
        cv2.imshow("Modular Traffic AI: Moto Tracking (YOLOv8)", annotated)

        # Listen for Esc Key (key code 27) to shut down gracefully
        if cv2.waitKey(1) & 0xFF == 27:
            print("👋 Escape key detected. Shutting down system processes gracefully...")
            break

except KeyboardInterrupt:
    print("\n👋 Ctrl+C caught! Exiting cleanly.")

finally:
    # Release hardware devices & destroy OpenCV windows
    cap.release()
    cv2.destroyAllWindows()
    print("🔒 Camera streams unlocked. System safely Offline.")
