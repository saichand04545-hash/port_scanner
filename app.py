"""
IP Port Scanner - Flask Backend
================================
A beginner-friendly TCP port scanner backend.
Only scan systems you own or have explicit permission to test.
"""

import socket
import time
import csv
import io
import ipaddress
import threading
from flask import Flask, render_template, request, jsonify, Response

app = Flask(__name__)

# ─────────────────────────────────────────────
#  Common service name mappings (port → service)
# ─────────────────────────────────────────────
SERVICE_MAP = {
    20:   "FTP Data",
    21:   "FTP",
    22:   "SSH",
    23:   "Telnet",
    25:   "SMTP",
    53:   "DNS",
    67:   "DHCP",
    68:   "DHCP",
    69:   "TFTP",
    80:   "HTTP",
    110:  "POP3",
    119:  "NNTP",
    123:  "NTP",
    135:  "RPC",
    139:  "NetBIOS",
    143:  "IMAP",
    161:  "SNMP",
    194:  "IRC",
    389:  "LDAP",
    443:  "HTTPS",
    445:  "SMB",
    465:  "SMTPS",
    514:  "Syslog",
    587:  "SMTP (TLS)",
    631:  "IPP",
    636:  "LDAPS",
    873:  "rsync",
    989:  "FTPS Data",
    990:  "FTPS",
    993:  "IMAPS",
    995:  "POP3S",
    1080: "SOCKS Proxy",
    1194: "OpenVPN",
    1433: "MSSQL",
    1521: "Oracle DB",
    1723: "PPTP",
    2049: "NFS",
    2181: "ZooKeeper",
    2375: "Docker",
    2376: "Docker TLS",
    3000: "Node.js Dev",
    3306: "MySQL",
    3389: "RDP",
    4369: "EPMD",
    5000: "Flask Dev",
    5432: "PostgreSQL",
    5672: "RabbitMQ",
    5900: "VNC",
    6379: "Redis",
    6443: "Kubernetes API",
    7001: "WebLogic",
    8080: "HTTP Proxy",
    8443: "HTTPS Alt",
    8888: "Jupyter",
    9092: "Kafka",
    9200: "Elasticsearch",
    10250: "Kubelet",
    27017: "MongoDB",
}

# Global state for scan progress (simple in-memory, single-user prototype)
scan_state = {
    "running": False,
    "stop_requested": False,
    "current_port": 0,
    "total_ports": 0,
    "results": [],
    "target": "",
    "start_port": 1,
    "end_port": 1024,
    "start_time": 0,
    "end_time": 0,
    "error": None,
}

scan_lock = threading.Lock()


# ─────────────────────────────────────────────
#  Helper: validate IP address
# ─────────────────────────────────────────────
def validate_ip(ip: str) -> bool:
    """Return True if ip is a valid IPv4 or IPv6 address."""
    try:
        ipaddress.ip_address(ip)
        return True
    except ValueError:
        return False


# ─────────────────────────────────────────────
#  Core: scan a single TCP port
# ─────────────────────────────────────────────
def scan_port(ip: str, port: int, timeout: float = 0.5) -> bool:
    """
    Try to open a TCP connection to ip:port.
    Returns True if the port is OPEN, False if CLOSED/filtered.
    """
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(timeout)
            result = sock.connect_ex((ip, port))
            return result == 0          # 0 means connection succeeded -> OPEN
    except (socket.error, OSError):
        return False


# ─────────────────────────────────────────────
#  Background scan thread
# ─────────────────────────────────────────────
def run_scan(target: str, start_port: int, end_port: int):
    """Runs the port scan in a background thread and updates scan_state."""
    with scan_lock:
        scan_state["running"] = True
        scan_state["stop_requested"] = False
        scan_state["results"] = []
        scan_state["target"] = target
        scan_state["start_port"] = start_port
        scan_state["end_port"] = end_port
        scan_state["current_port"] = start_port
        scan_state["total_ports"] = end_port - start_port + 1
        scan_state["start_time"] = time.time()
        scan_state["end_time"] = 0
        scan_state["error"] = None

    results = []
    for port in range(start_port, end_port + 1):
        # Check if stop was requested
        if scan_state["stop_requested"]:
            break

        # Update progress
        scan_state["current_port"] = port

        is_open = scan_port(target, port)
        service = SERVICE_MAP.get(port, "Unknown")

        results.append({
            "port":    port,
            "status":  "OPEN" if is_open else "CLOSED",
            "service": service,
        })

    with scan_lock:
        scan_state["results"] = results
        scan_state["running"] = False
        scan_state["end_time"] = time.time()


# ─────────────────────────────────────────────
#  Routes
# ─────────────────────────────────────────────

@app.route("/")
def index():
    """Serve the main HTML page."""
    return render_template("index.html")


@app.route("/scan", methods=["POST"])
def start_scan():
    """
    POST /scan
    Body JSON: { "target": "127.0.0.1", "start_port": 1, "end_port": 1024 }
    Starts the scan in a background thread.
    """
    data = request.get_json(force=True)

    target     = (data.get("target") or "").strip()
    start_port = data.get("start_port", 1)
    end_port   = data.get("end_port", 1024)

    # Validation
    if not target:
        return jsonify({"error": "Target IP address is required."}), 400

    if not validate_ip(target):
        return jsonify({"error": f"'{target}' is not a valid IP address."}), 400

    try:
        start_port = int(start_port)
        end_port   = int(end_port)
    except (ValueError, TypeError):
        return jsonify({"error": "Port numbers must be integers."}), 400

    if not (1 <= start_port <= 65535):
        return jsonify({"error": "Start port must be between 1 and 65535."}), 400

    if not (1 <= end_port <= 65535):
        return jsonify({"error": "End port must be between 1 and 65535."}), 400

    if start_port > end_port:
        return jsonify({"error": "Start port cannot be greater than end port."}), 400

    if scan_state["running"]:
        return jsonify({"error": "A scan is already running. Stop it first."}), 409

    # Launch background thread
    thread = threading.Thread(
        target=run_scan,
        args=(target, start_port, end_port),
        daemon=True,
    )
    thread.start()

    return jsonify({"message": "Scan started.", "target": target,
                    "start_port": start_port, "end_port": end_port})


@app.route("/stop", methods=["POST"])
def stop_scan():
    """POST /stop - requests the background scan to stop."""
    scan_state["stop_requested"] = True
    return jsonify({"message": "Stop requested."})


@app.route("/status", methods=["GET"])
def scan_status():
    """
    GET /status
    Returns current scan progress and results so far.
    """
    with scan_lock:
        state = dict(scan_state)

    total   = state["total_ports"] or 1
    scanned = state["current_port"] - state["start_port"] + 1
    percent = min(100, int(scanned / total * 100)) if state["running"] else (
        100 if state["end_time"] > 0 else 0
    )

    elapsed = 0
    if state["start_time"]:
        end = state["end_time"] if state["end_time"] else time.time()
        elapsed = round(end - state["start_time"], 2)

    open_ports   = sum(1 for r in state["results"] if r["status"] == "OPEN")
    closed_ports = sum(1 for r in state["results"] if r["status"] == "CLOSED")

    return jsonify({
        "running":        state["running"],
        "stop_requested": state["stop_requested"],
        "target":         state["target"],
        "current_port":   state["current_port"],
        "start_port":     state["start_port"],
        "end_port":       state["end_port"],
        "total_ports":    state["total_ports"],
        "percent":        percent,
        "elapsed":        elapsed,
        "results":        state["results"],
        "open_ports":     open_ports,
        "closed_ports":   closed_ports,
        "error":          state["error"],
    })


@app.route("/export", methods=["GET"])
def export_results():
    """
    GET /export
    Downloads scan results as a CSV file.
    """
    with scan_lock:
        results = list(scan_state["results"])
        target  = scan_state["target"]

    if not results:
        return jsonify({"error": "No results to export. Run a scan first."}), 400

    # Build CSV in memory
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Target IP", "Port", "Status", "Service"])
    for r in results:
        writer.writerow([target, r["port"], r["status"], r["service"]])

    csv_bytes = output.getvalue().encode("utf-8")

    return Response(
        csv_bytes,
        mimetype="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=scan_{target.replace('.', '_')}.csv"
        },
    )


# ─────────────────────────────────────────────
#  Entry point
# ─────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 55)
    print("  IP Port Scanner -- Flask Backend")
    print("  http://127.0.0.1:5000")
    print("  Only scan systems you own or have permission to test.")
    print("=" * 55)
    app.run(debug=True, port=5000)
