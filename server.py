""" Local dev server — serves static files + /api/chat proxy """
import http.server
import json
import urllib.request
import os
import socketserver

PORT = 3006
DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions"
API_KEY = os.environ.get("DEEPSEEK_API_KEY", "")

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == "/api/chat":
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length)) if length else {}

            req = urllib.request.Request(DEEPSEEK_URL,
                data=json.dumps({
                    "model": "deepseek-v4-flash",
                    "messages": body.get("messages", []),
                    "temperature": body.get("temperature", 0.8),
                    "max_tokens": body.get("max_tokens", 1024),
                }).encode(),
                headers={"Content-Type": "application/json", "Authorization": f"Bearer {API_KEY}"})

            try:
                with urllib.request.urlopen(req) as resp:
                    data = json.loads(resp.read())
                self._json({"reply": data["choices"][0]["message"]["content"]})
            except Exception as e:
                self._json({"error": str(e)}, 500)
        else:
            super().do_POST()

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json(self, data, status=200):
        self.send_response(status)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode())

print(f"Dev server at http://localhost:{PORT}")
print(f"API Key: {'configured' if API_KEY else 'NOT SET — set DEEPSEEK_API_KEY env var'}")

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    httpd.serve_forever()
