@echo off
echo [1/3] Updating Playlist from C3Box...
python update_playlist.py
echo.
echo [2/3] Uploading changes to GitHub...
git add playlist.m3u
git commit -m "Auto-updated IPTV tokens"
git push
echo.
echo [3/3] All Done!
pause