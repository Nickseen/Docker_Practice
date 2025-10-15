# HTTP File Server Lab

This lab implements a simple HTTP file server using TCP sockets in Python, with Docker containerization.

## Files Structure

```
docker_practice/
├── file_server.py          # Main HTTP server implementation
├── client.py               # HTTP client for testing
├── Dockerfile              # Docker container configuration
├── docker-compose.yml      # Docker compose setup
├── setup.sh               # Setup script
├── content/               # Content directory to serve
│   ├── index.html         # Main HTML page with image
│   ├── sample-document.pdf # Sample PDF file
│   ├── readme.txt         # Text file
│   ├── books/             # Subdirectory with books
│   │   ├── programming-guide.pdf
│   │   └── networking-book.pdf
│   └── images/            # Images directory
│       └── library.png    # PNG image file
```

## Features Implemented

✅ **Basic HTTP Server**
- TCP socket implementation
- HTTP/1.1 request parsing
- GET method support
- Proper HTTP response headers

✅ **File Type Support** 
- HTML files (text/html)
- PNG images (image/png)
- PDF documents (application/pdf)
- Plain text files (text/plain)

✅ **Directory Listing**
- Automatic HTML generation for directories
- Navigation with clickable links
- Parent directory navigation (..)

✅ **Error Handling**
- 404 Not Found for missing files
- 403 Forbidden for security violations
- 400 Bad Request for malformed requests
- 500 Internal Server Error for server issues

✅ **Security Features**
- Path traversal attack prevention
- Input validation and sanitization

✅ **HTTP Client**
- Command-line HTTP client
- File download capability
- HTML content display
- Binary file saving

✅ **Docker Support**
- Containerized server deployment
- Volume mapping for content
- Network configuration

## Usage Instructions

### Local Testing
```bash
# Start server locally
python3 file_server.py content/

# Test with browser
curl http://localhost:8080/

# Test client
python3 client.py localhost 8080 /index.html downloads/
```

### Docker Testing
```bash
# Build and start container
docker-compose up --build

# Access server
http://localhost:8080/

# Test from another terminal
python3 client.py localhost 8080 /books/ downloads/
```

### Test Cases
1. **404 Error**: `http://localhost:8080/nonexistent.html`
2. **HTML with Image**: `http://localhost:8080/` 
3. **PDF File**: `http://localhost:8080/sample-document.pdf`
4. **PNG Image**: `http://localhost:8080/images/library.png`
5. **Directory Listing**: `http://localhost:8080/books/`
6. **Text File**: `http://localhost:8080/readme.txt`

## Network Testing

To test with friends on local network:

1. Find your IP address: `ip addr show`
2. Start server: `python3 file_server.py content/`
3. Friends access via: `http://YOUR_IP:8080/`
4. Download files: `python3 client.py YOUR_IP 8080 /books/programming-guide.pdf downloads/`

## Report Requirements Satisfied

- ✅ Source directory contents
- ✅ Docker compose file and Dockerfile  
- ✅ Container startup process
- ✅ Server command with directory argument
- ✅ Served directory contents
- ✅ Browser tests: 404, HTML+image, PDF, PNG
- ✅ HTTP client implementation and usage
- ✅ Directory listing functionality
- ✅ Network testing capability