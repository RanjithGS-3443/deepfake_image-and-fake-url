from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
from typing import Optional
import tldextract
from deepface import DeepFace
import cv2
import numpy as np
import requests
from io import BytesIO

app = FastAPI(
    title="Phishing & Deepfake Detection API",
    description="API for detecting phishing attempts and deepfake content",
    version="1.0.0"
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class URLRequest(BaseModel):
    url: str

class ImageRequest(BaseModel):
    image_url: str

def extract_url_features(url: str) -> dict:
    """Extract features from URL for phishing detection."""
    extracted = tldextract.extract(url)
    
    # Get the full domain (subdomain + domain + tld)
    full_domain = f"{extracted.subdomain}.{extracted.domain}.{extracted.suffix}" if extracted.subdomain else f"{extracted.domain}.{extracted.suffix}"
    
    # Count suspicious words in the URL
    suspicious_words = ["secure", "account", "login", "verify", "password", "bank", "paypal", "amazon", "apple", "microsoft", "google"]
    url_lower = url.lower()
    suspicious_word_count = sum(1 for word in suspicious_words if word in url_lower)
    
    return {
        "domain": extracted.domain,
        "subdomain": extracted.subdomain,
        "tld": extracted.suffix,
        "full_domain": full_domain,
        "url_length": len(url),
        "has_https": url.startswith("https://"),
        "num_dots": url.count("."),
        "has_suspicious_words": suspicious_word_count > 0,
        "suspicious_word_count": suspicious_word_count,
        "has_ip_address": any(c.isdigit() for c in extracted.domain),
        "path_length": len(extracted.path) if hasattr(extracted, 'path') else 0
    }

def analyze_url(url: str) -> dict:
    """Analyze URL for potential phishing attempts."""
    features = extract_url_features(url)
    
    # Enhanced heuristic-based detection
    risk_score = 0
    
    # Check for HTTPS
    if not features["has_https"]:
        risk_score += 0.3
    
    # Check for suspicious words in URL
    suspicious_words = ["secure", "account", "login", "verify", "password", "bank", "paypal", "amazon", "apple", "microsoft", "google"]
    url_lower = url.lower()
    for word in suspicious_words:
        if word in url_lower:
            risk_score += 0.2
            break
    
    # Check for multiple dots
    if features["num_dots"] > 2:
        risk_score += 0.2
    
    # Check for suspicious subdomain
    if len(features["subdomain"]) > 0:
        # Check if subdomain contains suspicious words
        for word in suspicious_words:
            if word in features["subdomain"].lower():
                risk_score += 0.3
                break
        risk_score += 0.1
    
    # Check for IP address
    if features["has_ip_address"]:
        risk_score += 0.3
    
    # Check for suspicious TLD
    suspicious_tlds = ["xyz", "tk", "ml", "ga", "cf", "gq", "pw"]
    if features["tld"] in suspicious_tlds:
        risk_score += 0.3
    
    # Cap the risk score at 1.0
    risk_score = min(risk_score, 1.0)
        
    return {
        "url": url,
        "risk_score": risk_score,
        "is_phishing": risk_score > 0.5,
        "features": features
    }

def analyze_image(image_url: str) -> dict:
    """Analyze image for potential deepfake content."""
    try:
        # Download image from URL
        response = requests.get(image_url)
        img_array = np.asarray(bytearray(response.content), dtype=np.uint8)
        img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
        
        # Use DeepFace for analysis
        result = DeepFace.analyze(img, 
                                actions=['emotion', 'age', 'gender', 'race'],
                                enforce_detection=False)
        
        # Check if result is a list or dictionary
        if isinstance(result, list):
            analysis_result = result[0]
        else:
            analysis_result = result
        
        # Calculate deepfake probability based on multiple factors
        deepfake_score = 0.0
        
        # Factor 1: Emotion confidence (lower confidence might indicate manipulation)
        emotion_conf = analysis_result.get('dominant_emotion_conf', 0.5)
        if emotion_conf < 0.7:
            deepfake_score += 0.3
        elif emotion_conf < 0.85:  # Added intermediate threshold
            deepfake_score += 0.15
        
        # Factor 2: Face confidence (lower confidence might indicate manipulation)
        face_conf = analysis_result.get('face_confidence', 0.9)
        if face_conf < 0.9:
            deepfake_score += 0.2
        elif face_conf < 0.95:  # Added intermediate threshold
            deepfake_score += 0.1
        
        # Factor 3: Check for unrealistic age/gender combinations
        age = analysis_result.get('age', 0)
        gender = analysis_result.get('dominant_gender', '')
        
        # Unrealistic age for the detected gender
        if gender == 'Woman' and age > 80:
            deepfake_score += 0.2
        if gender == 'Man' and age < 10:
            deepfake_score += 0.2
        # Added more age/gender combinations
        if gender == 'Woman' and age < 5:
            deepfake_score += 0.2
        if gender == 'Man' and age > 90:
            deepfake_score += 0.2
        
        # Factor 4: Check for inconsistent lighting or artifacts
        # This is a simplified check - in a real implementation, you would use more sophisticated methods
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 100, 200)
        edge_density = np.sum(edges > 0) / (edges.shape[0] * edges.shape[1])
        
        if edge_density > 0.15:  # High edge density might indicate manipulation
            deepfake_score += 0.2
        elif edge_density > 0.1:  # Added intermediate threshold
            deepfake_score += 0.1
        
        # Factor 5: Check for inconsistent skin tones
        # This is a simplified check
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        skin_mask = cv2.inRange(hsv, (0, 20, 70), (20, 255, 255))
        skin_percentage = np.sum(skin_mask > 0) / (skin_mask.shape[0] * skin_mask.shape[1])
        
        # If skin percentage is very low or very high, might indicate manipulation
        if skin_percentage < 0.05 or skin_percentage > 0.8:
            deepfake_score += 0.15
        
        # Factor 6: Check for unrealistic facial symmetry
        # This is a simplified check
        height, width = img.shape[:2]
        left_half = img[:, :width//2]
        right_half = cv2.flip(img[:, width//2:], 1)
        
        # Resize right half to match left half
        right_half = cv2.resize(right_half, (left_half.shape[1], left_half.shape[0]))
        
        # Calculate difference between left and right halves
        diff = cv2.absdiff(left_half, right_half)
        diff_percentage = np.sum(diff > 30) / (diff.shape[0] * diff.shape[1] * diff.shape[2])
        
        # If difference is very low, might indicate manipulation (too perfect symmetry)
        if diff_percentage < 0.01:
            deepfake_score += 0.15
        
        # Cap the deepfake score at 1.0
        deepfake_score = min(deepfake_score, 1.0)
        
        # Lower the threshold for deepfake detection
        is_deepfake = deepfake_score > 0.3  # Lowered from 0.5 to 0.3
        
        return {
            "image_url": image_url,
            "is_deepfake": is_deepfake,
            "deepfake_score": deepfake_score,
            "confidence_score": emotion_conf,
            "analysis": analysis_result
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error analyzing image: {str(e)}")

@app.get("/")
async def root():
    return {"message": "Welcome to Phishing & Deepfake Detection API"}

@app.post("/analyze-url")
async def analyze_url_endpoint(request: URLRequest):
    return analyze_url(request.url)

@app.post("/analyze-image")
async def analyze_image_endpoint(request: ImageRequest):
    return analyze_image(request.image_url)

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True) 