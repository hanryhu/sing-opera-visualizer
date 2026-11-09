"""Tiny local POST receiver: saves the request body to ./<path> (benchmark results from the browser)."""
import http.server, os, sys

class H(http.server.BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()
    def do_POST(self):
        n = int(self.headers['Content-Length'])
        name = os.path.basename(self.path) or 'out.json'
        open(os.path.join(os.path.dirname(__file__), name), 'wb').write(self.rfile.read(n))
        self.send_response(200); self._cors(); self.end_headers(); self.wfile.write(b'ok')
        print('saved', name, flush=True)

http.server.ThreadingHTTPServer(('127.0.0.1', 5175), H).serve_forever()
