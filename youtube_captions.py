import yt_dlp
import requests

def get_transcript(video_id: str, lang: str = 'en') -> str | None:
    """
    Download transcript (captions) for a YouTube video using yt-dlp.

    Args:
        video_id (str): YouTube video ID
        lang (str): language code for captions (default 'en')

    Returns:
        str or None: transcript text if available, else None
    """
    url = f"https://www.youtube.com/watch?v={video_id}"

    ydl_opts = {
        'skip_download': True,
        'writesubtitles': True,
        'writeautomaticsub': True,
        'subtitleslangs': [lang],
        'subtitlesformat': 'ttml',  # or 'vtt' or 'srt' depending on what you want
        'quiet': True,
        'no_warnings': True,
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)

        # Check if subtitles exist
        subtitles = info.get('subtitles', {})
        automatic_captions = info.get('automatic_captions', {})

        # Prefer manual subtitles if exist, else automatic
        caption_data = subtitles.get(lang) or automatic_captions.get(lang)
        if not caption_data:
            print(f"No {lang} captions available.")
            return None

        # URL of subtitle file
        subtitle_url = caption_data[0]['url']

        # Download subtitle content
        r = requests.get(subtitle_url)
        if r.status_code == 200:
            data=r.json()
            text_parts = []
            for event in data.get("events", []):
                for seg in event.get("segs", []):
                    text = seg.get("utf8", "").replace("\n", " ").strip()
                    if text:
                        text_parts.append(text)
            return " ".join(text_parts)
        else:
            print(f"Failed to download captions. HTTP {r.status_code}")
