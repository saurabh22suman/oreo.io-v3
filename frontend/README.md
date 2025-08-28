# Oreo Frontend

React + Vite app for Oreo API.

- Dev (local): npm install && npm run dev
- Build: npm run build
- Docker (compose): service "frontend" serves on http://localhost:5173

Configure API base via VITE_API_BASE (defaults to http://localhost:8081/api).

Google Sign-In (optional): set your OAuth Web client ID so the Auth page can render the Google button.

```
VITE_GOOGLE_CLIENT_ID=your-google-oauth-web-client-id
```