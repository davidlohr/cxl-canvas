const http = require('http');
const fs = require('fs');
const path = require('path');

/**
 * Simple static file server for testing
 */
class TestServer {
  constructor(port = 3000) {
    this.port = port;
    this.server = null;
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        const filePath = req.url === '/' ? '/index.html' : req.url;
        const fullPath = path.join(__dirname, '..', filePath);
        
        // Security: ensure we're serving from project directory
        if (!fullPath.startsWith(path.join(__dirname, '..'))) {
          res.writeHead(403);
          res.end('Forbidden');
          return;
        }

        fs.readFile(fullPath, (err, data) => {
          if (err) {
            res.writeHead(404);
            res.end('Not Found');
            return;
          }

          const ext = path.extname(fullPath).toLowerCase();
          const contentType = {
            '.html': 'text/html',
            '.js': 'application/javascript',
            '.css': 'text/css',
            '.json': 'application/json'
          }[ext] || 'text/plain';

          res.writeHead(200, { 'Content-Type': contentType });
          res.end(data);
        });
      });

      this.server.listen(this.port, (err) => {
        if (err) reject(err);
        else {
          console.log(`Test server running on http://localhost:${this.port}`);
          resolve();
        }
      });
    });
  }

  stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(resolve);
      } else {
        resolve();
      }
    });
  }
}

// If run directly, start the server
if (require.main === module) {
  const server = new TestServer();
  server.start().catch(console.error);
  
  process.on('SIGINT', async () => {
    console.log('\nShutting down server...');
    await server.stop();
    process.exit(0);
  });
}

module.exports = TestServer;