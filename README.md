# IP Port Scanner

A beginner-friendly **TCP Port Scanner** web application built with Python (Flask) and vanilla HTML/CSS/JavaScript. Designed as an educational cybersecurity tool for understanding IP addresses, TCP ports, and basic network reconnaissance.

> ⚠️ **Only scan systems you own or have explicit permission to test. Unauthorized scanning is illegal and unethical.**

---

## Objective

Help students understand:
- IP addresses and TCP ports
- The difference between open and closed ports
- Common network services (SSH, HTTP, HTTPS, etc.)
- Basic network reconnaissance concepts

---

## Features

| Feature | Description |
|---|---|
| 🎯 Target Input | Enter any valid IPv4 address |
| 🔢 Port Range | Define start and end ports (1–65535) |
| ⚡ Live Progress | Real-time progress bar + current port indicator |
| 📋 Results Table | Color-coded OPEN/CLOSED status with service names |
| 📊 Stats Dashboard | Target, ports scanned, open/closed count, scan time |
| 🔍 Filters | Filter results by All / Open Only / Closed Only |
| 📥 CSV Export | Download results as a `.csv` file |
| 🛑 Stop Scan | Cancel a running scan at any time |
| ✅ Validation | Client-side + server-side input validation |

---

## Technologies Used

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3 (Vanilla), JavaScript (ES6+) |
| Backend | Python 3, Flask |
| Networking | Python `socket` module |
| Fonts | Google Fonts (Inter, JetBrains Mono) |

No database required.

---

## Project Structure

```
ip-port-scanner/
│
├── app.py               ← Flask backend (API + scanning logic)
├── requirements.txt     ← Python dependencies
├── README.md            ← This file
│
├── templates/
│   └── index.html       ← Main HTML page (Jinja2 template)
│
└── static/
    ├── style.css        ← Dark cybersecurity dashboard theme
    └── script.js        ← Frontend logic (fetch, polling, rendering)
```

---

## Installation

### Prerequisites
- Python 3.8 or higher
- pip (Python package manager)

### Steps

**1. Clone or download the project:**
```bash
# If using git
git clone <repository-url>
cd ip-port-scanner

# Or just unzip the project folder and cd into it
```

**2. (Optional) Create a virtual environment:**
```bash
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate
```

**3. Install dependencies:**
```bash
pip install -r requirements.txt
```

---

## How to Run

```bash
python app.py
```

Then open your browser and navigate to:

```
http://127.0.0.1:5000
```

---

## How to Use the Scanner

1. **Enter Target IP** — Type a valid IPv4 address (e.g., `127.0.0.1` for localhost).
2. **Set Port Range** — Enter start port (default: `1`) and end port (default: `1024`).
3. **Click Scan** — The backend starts scanning in a background thread.
4. **Watch Progress** — Live progress bar shows current port and percentage.
5. **View Results** — Table updates in real time showing open/closed ports and service names.
6. **Filter** — Use the All / Open Only / Closed Only buttons to filter results.
7. **Export** — Click **Export Results** to download a `.csv` file.
8. **Stop** — Click **Stop Scan** to cancel at any time.

---

## Example Output

After scanning `127.0.0.1` ports `1–1024`:

| Port | Status | Service |
|------|--------|---------|
| 80   | OPEN   | HTTP    |
| 443  | OPEN   | HTTPS   |
| 5000 | OPEN   | Flask Dev |
| 21   | CLOSED | FTP     |
| 22   | CLOSED | SSH     |

### Exported CSV:
```
Target IP,Port,Status,Service
127.0.0.1,80,OPEN,HTTP
127.0.0.1,443,OPEN,HTTPS
127.0.0.1,5000,OPEN,Flask Dev
127.0.0.1,21,CLOSED,FTP
```

---

## API Endpoints

| Method | Endpoint  | Description |
|--------|-----------|-------------|
| GET    | `/`       | Serve the web UI |
| POST   | `/scan`   | Start a port scan |
| POST   | `/stop`   | Stop the current scan |
| GET    | `/status` | Get scan progress + results |
| GET    | `/export` | Download results as CSV |

### POST /scan — Request body:
```json
{
  "target": "127.0.0.1",
  "start_port": 1,
  "end_port": 1024
}
```

---

## Common Service Mappings

| Port | Service |
|------|---------|
| 21   | FTP |
| 22   | SSH |
| 23   | Telnet |
| 25   | SMTP |
| 53   | DNS |
| 80   | HTTP |
| 110  | POP3 |
| 143  | IMAP |
| 443  | HTTPS |
| 445  | SMB |
| 3306 | MySQL |
| 3389 | RDP |
| 5432 | PostgreSQL |
| 8080 | HTTP Proxy |

---

## How It Works (Technical)

1. The user submits the form — the browser sends a `POST /scan` request to Flask.
2. Flask validates the IP and port range, then starts a **background Python thread**.
3. The thread iterates over each port and attempts a **TCP socket connection** using `socket.connect_ex()`.
4. If the connection succeeds (returns 0), the port is **OPEN**; otherwise it is **CLOSED**.
5. The frontend polls `GET /status` every 600ms to get live updates.
6. When the scan finishes, results are displayed in a table and can be exported as CSV.

---

## Safety Note

This tool is intended **only for educational purposes** on:
- Your own computer (e.g., `127.0.0.1`)
- Machines on your own home/lab network
- Systems where you have **explicit written permission** to test

**Do not scan public servers, corporate networks, or any system you do not own.**  
Unauthorized port scanning may violate computer crime laws in your country.

---

## Dependencies

```
flask>=3.0.0
```

All other modules (`socket`, `threading`, `csv`, `ipaddress`, `io`) are part of the Python standard library — no additional installs needed.

---

*Built for educational purposes — CSE Network Security Assignment.*
