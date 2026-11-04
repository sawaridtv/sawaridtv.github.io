// Playlists Configuration
const playlists = [
        { url: 'https://raw.githubusercontent.com/sawaridtv/sawaridtv.github.io/main/SAWARID-SPORTS0.m3u', name: "Live Event", displayName: "Live Event" },
        { url: 'https://raw.githubusercontent.com/sawaridtv/sawaridtv.github.io/main/SAWARID-SPORTS1.m3u', name: "Sports", displayName: "Sports" },
        { url: 'https://raw.githubusercontent.com/sawaridtv/sawaridtv.github.io/main/SAWARID-LIVE_TV1.m3u', name: "ALL Channels", displayName: "Live Channels" },
];

// Direct Ads Configuration
const adsterraLinks = [
  "https://www.google.com/search?q=sawarid&oq=sawarid&gs_lcrp=EgZjaHJvbWUqBggAEEUYOzIGCAAQRRg7MgYIARBFGEEyBggCEEUYPDIGCAMQRRg8MgYIBBBFGEEyBggFEEUYPDIGCAYQRRg9MgYIBxBFGEHSAQg0MjA5ajBqN6gCALACAA&sourceid=chrome&source=chrome.ob&ie=UTF-8",
  "https://www.google.com/search?q=sawarid&oq=sawarid&gs_lcrp=EgZjaHJvbWUqBggAEEUYOzIGCAAQRRg7MgYIARBFGEEyBggCEEUYPDIGCAMQRRg8MgYIBBBFGEEyBggFEEUYPDIGCAYQRRg9MgYIBxBFGEHSAQg0MjA5ajBqN6gCALACAA&sourceid=chrome&source=chrome.ob&ie=UTF-8",
  "https://www.google.com/search?q=sawarid&oq=sawarid&gs_lcrp=EgZjaHJvbWUqBggAEEUYOzIGCAAQRRg7MgYIARBFGEEyBggCEEUYPDIGCAMQRRg8MgYIBBBFGEEyBggFEEUYPDIGCAYQRRg9MgYIBxBFGEHSAQg0MjA5ajBqN6gCALACAA&sourceid=chrome&source=chrome.ob&ie=UTF-8"
];

const AD_TRIGGER_CLICKS = 10; 

// Social Switcher Configuration (Telegram & Facebook)
const socialChannels = [
  {
    name: "Telegram",
    title: "Join Telegram",
    url: "https://t.me/sawaridtv",
    bgClass: "bg-[#0088cc]",
    shadowColor: "rgba(0,136,204,0.5)",
    icon: `<svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.19-.08-.05-.19-.02-.27 0-.12.03-1.99 1.27-5.63 3.72-.53.36-1.01.54-1.44.53-.47-.01-1.38-.27-2.06-.49-.83-.27-1.49-.42-1.43-.88.03-.24.37-.49 1.02-.75 3.98-1.73 6.64-2.87 7.97-3.44 3.8-1.59 4.59-1.87 5.11-1.88.11 0 .37.03.54.17.14.12.18.28.2.45-.02.07-.02.13-.03.25z"/></svg>`
  },
  {
    name: "Facebook",
    title: "Follow Facebook",
    url: "https://facebook.com/sawaridtv",
    bgClass: "bg-[#1877f2]",
    shadowColor: "rgba(24,119,242,0.5)",
    icon: `<svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`
  }
];

const DEFAULT_USER_AGENT = "Mozilla/5.0 (Linux; Android 13; SM-S908B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 ExoPlayer/Media3 SawaridTV/2.0";
