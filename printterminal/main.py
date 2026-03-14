import os
import sys
import time
import subprocess
import requests
from dotenv import load_dotenv

load_dotenv()

API_BASE_URL = os.getenv("API_BASE_URL", "").rstrip("/")
STATION_SLUG = os.getenv("STATION_SLUG")
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "10"))
PRINTER_NAME = os.getenv("PRINTER_NAME", "")
PRINT_TO_PDF = os.getenv("PRINT_TO_PDF", "false").lower() == "true"

if not API_BASE_URL or not STATION_SLUG:
    print("Error: Missing API_BASE_URL or STATION_SLUG in .env")
    sys.exit(1)

def log(msg):
    # Simple logging helper
    t = time.strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{t}] {msg}")

def get_pending_jobs():
    try:
        res = requests.get(f"{API_BASE_URL}/api/operator/print-jobs", params={"stationSlug": STATION_SLUG})
        res.raise_for_status()
        data = res.json()
        return [job for job in data.get("jobs", []) if job.get("status") == "pending"]
    except Exception as e:
        log(f"Error fetching jobs: {e}")
        return []

def update_job_status(job_id, status):
    try:
        res = requests.patch(
            f"{API_BASE_URL}/api/operator/print-jobs/{job_id}/status",
            json={"status": status}
        )
        res.raise_for_status()
        return True
    except Exception as e:
        log(f"Error updating job {job_id} to status {status}: {e}")
        return False

def download_file(job_id):
    try:
        # We need a local path to save the PDF
        file_path = f"files/tmp_job_{job_id}.pdf"
        file_url = f"{API_BASE_URL}/api/operator/print-jobs/{job_id}/file"

        # Stream the file securely
        with requests.get(file_url, stream=True) as r:
            r.raise_for_status()
            with open(file_path, 'wb') as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
        print(file_path)
        return file_path
    except Exception as e:
        log(f"Error downloading file for job {job_id}: {e}")
        return None

def print_file(file_path):
    if PRINT_TO_PDF:
        try:
            output_dir = "printed_pdfs"
            os.makedirs(output_dir, exist_ok=True)
            output_path = os.path.join(output_dir, os.path.basename(file_path).replace("tmp_", "printed_"))

            # Since we will clean up the original file, copy it to the output directory
            import shutil
            shutil.copy2(file_path, output_path)
            log(f"[MOCK PRINT] Saved pdf to {output_path}")
            return True
        except Exception as e:
            log(f"Error saving to PDF folder: {e}")
            return False

    # Supports macOS / Linux using `lp`
    # On Windows, using Foxit, SumatraPDF or standard `print` is required.
    # We will try to execute the command generically here.
    try:
        if sys.platform == "win32":
            # Very basic native print attempt for Windows via shell
            # Wait for PDF completion using default handler can be flaky,
            # consider using SumatraPDF CLI for robust windows printing.
            log("Windows platform detected. Attempting to print via ShellExecute.")
            os.startfile(file_path, "print")
            # os.startfile doesn't block, so we sleep a bit to let spooling start
            time.sleep(5)
            return True
        else:
            # macOS and Linux
            cmd = ["lp"]
            if PRINTER_NAME:
                cmd.extend(["-d", PRINTER_NAME])
            cmd.append(file_path)

            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode == 0:
                log(f"Print command successful: {result.stdout.strip()}")
                return True
            else:
                log(f"Print command failed: {result.stderr.strip()}")
                return False

    except Exception as e:
        log(f"Exception during OS print call: {e}")
        return False

def cleanup_file(file_path):
    if file_path and os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception as e:
            log(f"Warning: Could not remove temporary file {file_path}: {e}")

def process_job(job):
    job_id = job.get("id")
    job_code = job.get("jobCode")
    log(f"Processing job {job_code} ({job_id})")

    # 1. Mark as processing
    if not update_job_status(job_id, "processing"):
        return

    # 2. Download File
    file_path = download_file(job_id)
    if not file_path:
        update_job_status(job_id, "failed")
        return

    # 3. Print
    success = print_file(file_path)

    # 4. Cleanup temp file
    cleanup_file(file_path)

    # 5. Update final status
    if success:
        log(f"Job {job_code} printed successfully.")
        update_job_status(job_id, "printed")
    else:
        log(f"Job {job_code} failed to print.")
        update_job_status(job_id, "failed")

def main():
    log(f"Starting terminal service for station: {STATION_SLUG}")
    log(f"API Base: {API_BASE_URL}")
    log(f"Poll Interval: {POLL_INTERVAL} seconds")
    if PRINT_TO_PDF:
        log("Mode: MOCK PRINT (saving to printed_pdfs/ directory)")

    while True:
        try:
            jobs = get_pending_jobs()
            for job in jobs:
                process_job(job)
        except Exception as e:
            log(f"Unexpected error in main loop: {e}")

        time.sleep(POLL_INTERVAL)

if __name__ == "__main__":
    main()
