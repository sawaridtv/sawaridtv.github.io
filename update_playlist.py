import re
import sys
import time
from playwright.sync_api import sync_playwright

PLAYLIST_FILE = "playlist.m3u"

def get_current_token():
    captured_url = None

    print("[1] Opening browser to capture streaming token...")
    with sync_playwright() as p:
        # ব্যাকগ্রাউন্ডে ব্রাউজার রান হবে
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            ignore_https_errors=True
        )
        page = context.new_page()

        def handle_request(request):
            nonlocal captured_url
            if "_sf-node-media" in request.url and "index.m3u8" in request.url:
                captured_url = request.url
                print(f" -> Found stream URL: {captured_url}")

        page.on("request", handle_request)

        try:
            # T sports চ্যানেলের ওয়াচ পেজে যাওয়া
            page.goto("https://c3box.tv/web-player/watch/sf-1-t-sports-l-sports-1", timeout=35000, wait_until="domcontentloaded")
            # প্লেয়ার থেকে m3u8 লিংক লোড হতে ৮ সেকেন্ড অপেক্ষা করা
            page.wait_for_timeout(8000)
        except Exception as e:
            print(f"Page loading info: {e}")
        finally:
            browser.close()

    if not captured_url:
        print("Error: Could not capture any m3u8 link. Check if C3Box is accessible from this PC.")
        sys.exit(1)

    # URL থেকে '_sf-node-media/TOKEN/DEV_ID/' অংশটি আলাদা করা
    match = re.search(r'(_sf-node-media/[^/]+/[^/]+/)', captured_url)
    if not match:
        print("Error: Pattern did not match in the captured URL!")
        sys.exit(1)

    return match.group(1)

def update_m3u(new_prefix):
    print(f"[2] Updating {PLAYLIST_FILE} with: {new_prefix}")
    try:
        with open(PLAYLIST_FILE, "r", encoding="utf-8") as f:
            content = f.read()

        # পুরোনো টোকেন অংশ নতুন অংশ দিয়ে রিপ্লেস করা
        updated_content = re.sub(r'_sf-node-media/[^/]+/[^/]+/', new_prefix, content)

        with open(PLAYLIST_FILE, "w", encoding="utf-8") as f:
            f.write(updated_content)

        print("[3] playlist.m3u successfully updated!")
    except Exception as e:
        print(f"File error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    prefix = get_current_token()
    update_m3u(prefix)
