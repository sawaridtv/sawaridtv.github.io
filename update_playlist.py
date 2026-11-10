import re
import sys
import time
from playwright.sync_api import sync_playwright

# আপনার রিপোজিটরিতে থাকা প্লেলিস্ট ফাইলের নাম
PLAYLIST_FILE = "playlist.m3u"

def get_current_token():
    captured_url = None

    print("[1] Opening browser to capture dynamic streaming token...")
    with sync_playwright() as p:
        # ব্যাকগ্রাউন্ডে হেডলেস ব্রাউজার চালু করা
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # নেটওয়ার্ক রিকোয়েস্ট মনিটর করা
        def handle_request(request):
            nonlocal captured_url
            # m3u8 স্ট্রিম রিকোয়েস্ট খুঁজে বের করা
            if "_sf-node-media" in request.url and "index.m3u8" in request.url:
                captured_url = request.url
                print(f" -> Found stream request: {captured_url}")

        page.on("request", handle_request)

        try:
            # যেকোনো একটি চ্যানেলের পেজে যাওয়া (যেমন T Sports)
            page.goto("https://c3box.tv/web-player/watch/sf-1-t-sports-l-sports-1", timeout=30000)
            # প্লেয়ার থেকে m3u8 রিকোয়েস্ট পাঠাতে ৫-৭ সেকেন্ড অপেক্ষা
            page.wait_for_timeout(7000)
        except Exception as e:
            print(f"Warning/Error loading page: {e}")
        finally:
            browser.close()

    if not captured_url:
        print("Error: Could not capture any stream URL!")
        sys.exit(1)

    # URL থেকে '_sf-node-media/TOKEN/DEV_ID/' অংশটি এক্সট্রাক্ট করা
    match = re.search(r'(_sf-node-media/[^/]+/[^/]+/)', captured_url)
    if not match:
        print("Error: Pattern did not match in the captured URL!")
        sys.exit(1)

    return match.group(1)

def update_m3u(new_prefix):
    print(f"[2] Updating {PLAYLIST_FILE} with new prefix: {new_prefix}")
    try:
        with open(PLAYLIST_FILE, "r", encoding="utf-8") as f:
            content = f.read()

        # পুরোনো '_sf-node-media/.../.../' অংশ নতুনটি দিয়ে রিপ্লেস করা
        updated_content = re.sub(r'_sf-node-media/[^/]+/[^/]+/', new_prefix, content)

        with open(PLAYLIST_FILE, "w", encoding="utf-8") as f:
            f.write(updated_content)

        print("[3] Playlist successfully updated!")
    except Exception as e:
        print(f"File update error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    prefix = get_current_token()
    update_m3u(prefix)
