Made with Faiz Khan

---

# **YouTube Guardian**

A local, privacy-preserving YouTube content-filtering system that uses a **Flask backend** and a **Chrome extension** to analyze YouTube video transcripts, summarize content, detect inappropriate topics, and automatically **block playback** if unsafe content is found.

---

## 🚀 **Overview**

YouTube Guardian helps parents, educators, and productivity-focused users block unwanted YouTube content using local AI processing.
When you open a YouTube video, the Chrome extension sends the video URL to the Flask server. The server downloads the transcript, summarizes it, analyzes it for sensitive keywords, and returns one of two decisions:

✅ **Video Approved** – playback allowed
❌ **Video Blocked** – unsafe content detected; video is replaced with a warning screen

All analysis is done **locally**, and no transcript data leaves your machine.

---

## 🧩 **Features**

* ✔️ Local Flask server (no external APIs required)
* ✔️ Chrome extension UI for checking videos
* ✔️ Transcript extraction from any YouTube video with subtitles
* ✔️ Smart summarization using chunking
* ✔️ Sensitive keyword detection with similarity scoring
* ✔️ Hard block screen overlay on YouTube if unsafe
* ✔️ Live logs of transcript processing and model output
* ✔️ Toggle between local-model mode and proxy mode
* ✔️ Adjustable max token length for summarization

---

## 📷 **Screenshots**

### ⚠️ Block Screen

Shows when unsafe content is detected.
*(see repo /screenshots/block.png)*

### ✔️ Approved Screen

Displays a safe summary.
*(see repo /screenshots/approved.png)*

### 🖥️ Flask Server Logs

Real-time transcript loading, chunk processing, keyword scoring.
*(see repo /screenshots/server_logs.png)*

---

## 🏗️ **System Architecture**

```
Chrome Extension  →  Flask Server  →  Transcript Fetcher  
                                        ↓
                              Summarizer / LLAMA / Local Model  
                                        ↓
                             Sensitive Keyword Classifier  
                                        ↓
                           Safe or Unsafe Decision Returned  
                                        ↓
                           Chrome Extension Blocks or Allows Video
```

---

## 📦 **Installation**

### **1. Clone the repository**

```bash
git clone https://github.com/yourusername/youtube-guardian.git
cd youtube-guardian
```

---

## 🐍 **2. Install backend dependencies**

Ensure Python 3.10+ is installed.

```bash
pip install -r requirements.txt
```

---

## ▶️ **3. Start the Flask Server**

```bash
python TranscriptApp.py
```

You should see something like:

```
Starting YouTube Guardian Flask server...
Summarizer loaded: True
Running on http://127.0.0.1:5000
Debugger is active!
```

---

## 🌐 **4. Install the Chrome Extension**

1. Open Chrome
2. Go to: `chrome://extensions/`
3. Enable **Developer Mode**
4. Click **Load Unpacked**
5. Select the `extension/` folder from the repo
6. Extension should now appear in your toolbar

---

## 🧪 **Usage**

1. Open any YouTube video
2. The extension pops open automatically or manually
3. Click **Check Video**
4. Extension calls Flask:

```
GET /summary?url=<youtube-url>
```

5. Flask:

   * fetches transcript
   * cleans text
   * chunks summary
   * checks for unsafe topics
   * returns decision
6. If unsafe → YouTube page is replaced with the **YouTube Guardian Block Screen**

---

## ⚙️ **Configuration**

Inside the extension UI:

### **🔘 AI Mode**

* **Local Model** (default)
* Toggle off to use a remote inference proxy (e.g., LM Studio)

### **📏 Max Length**

Adjust summarization token limit for longer videos.

---

## 🛠️ **Project Structure**

```
youtube-guardian/
│
├── TranscriptApp.py        # Flask server
├── models/                 # Local AI summarizer + keyword model
├── extension/              # Chrome extension source
│   ├── background.js
│   ├── content.js
│   ├── popup.html
│   ├── popup.js
│   └── styles.css
│
├── scripts/                # Transcript fetch + cleanup
├── screenshots/            # Images for README
└── README.md
```

---

## 🧠 **How It Works (Detailed)**

### **1. Transcript Extraction**

Uses the YouTube transcript API.
If unavailable, video cannot be analyzed.

### **2. Text Cleaning**

Removes:

* timestamps
* repeated segments
* filler text
* emojis

### **3. Chunked Summarization**

Long transcripts are split into chunks:

```
chunk 1 → summarize  
chunk 2 → summarize  
...
final summary → merge
```

### **4. Safety Classification**

Each summary is compared to a list of unsafe categories.

Example categories:

* sexual content
* violence
* hate speech
* self-harm
* drugs
* profanity

If similarity score > your threshold → block video.

---

## 🧪 **API Endpoints**

### **GET /summary?url=<youtube_url>**

Returns JSON:

```json
{
  "video_id": "BPANoLv53xE",
  "decision": "approved",
  "summary": "This video discusses..."
}
```

### **GET /transcript?url=<youtube_url>**

Returns raw transcript.

---

## 🐞 Debugging

If Flask reloads repeatedly with:

```
huggingface/tokenizers: The current process just got forked...
```

Add:

```bash
export TOKENIZERS_PARALLELISM=false
```

---

## 📄 **License**

MIT License.

---

## 🤝 **Contributing**

PRs welcome.
Open issues for bugs, improvements, or feature requests.




