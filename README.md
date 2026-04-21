---
title: SJStore 4K Extractor
emoji: 🎬
colorFrom: green
colorTo: black
sdk: docker
app_port: 7860
---

# SJStore 4K Extractor

This application is converted to run on Hugging Face Spaces using Docker.

## Configuration

- **Port**: The application listens on port 7860 (configured in Dockerfile and README).
- **Backend**: Express.js proxy is used to bypass CORS.
- **Frontend**: Vite + React.

## Deployment

Simply push this to your Hugging Face Space repository.
