# AI-Driven Phishing and Deepfake Detection System

A comprehensive system for detecting phishing attempts and deepfake content in real-time, consisting of a FastAPI backend and a browser extension.

## Features

- Real-time phishing URL detection using machine learning
- Deepfake detection for images and videos
- RESTful API for external integration
- Browser extension for real-time protection

## Project Structure

```
.
├── api/                    # FastAPI backend
│   ├── models/            # ML models and model-related code
│   ├── routers/           # API endpoints
│   └── utils/             # Utility functions
├── extension/             # Browser extension code
├── tests/                 # Test files
└── requirements.txt       # Python dependencies
```

## Setup

1. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Start the API server:
```bash
uvicorn api.main:app --reload
```

4. Load the browser extension:
- Open Chrome/Edge
- Go to extensions page
- Enable developer mode
- Load unpacked extension from the `extension` directory

## API Documentation

Once the server is running, visit `http://localhost:8000/docs` for interactive API documentation.

## License

MIT License 