from flask import Flask, request, jsonify
# from youtube_transcript_api import YouTubeTranscriptApi
# from youtube_transcript_api._errors import (
#     TranscriptsDisabled,
#     NoTranscriptFound,
#     VideoUnavailable,
# )
from transformers import pipeline
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.decomposition import TruncatedSVD
from nltk.tokenize import sent_tokenize
from langdetect import detect
from youtube_captions import get_transcript

application = Flask(__name__)
summarizer = pipeline('summarization')

cache = {}

@application.route('/summary', methods=['GET'])
def summary_api():
    """
    Summarizes the transcript of a YouTube video URL (query param `url`) with optional `max_length`.
    Uses extractive summarization if transcript > 3000 words, else abstractive summarization.
    """
    url = request.args.get('url', '')
    max_length = int(request.args.get('max_length', 150))
    
    video_id = extract_video_id(url)
    if not video_id:
        return jsonify({"error": "Invalid YouTube URL"}), 400

    cache_key = f"{video_id}_{max_length}"
    if cache_key in cache: 
        return cache[cache_key]

    transcript = get_transcript(video_id) 
    
    # try:
    #     transcript = get_transcript(video_id)
    # except (TranscriptsDisabled, NoTranscriptFound):
    #     return jsonify({"error": "No subtitles available for this video"}), 404
    # except VideoUnavailable:
    #     return jsonify({"error": "Video is unavailable"}), 404
    # except Exception as e:
    #     return jsonify({"error": f"Failed to fetch transcript: {str(e)}"}), 500

    # if not is_transcript_english(transcript):
    #     return jsonify({"error": "Transcript language is not English"}), 400

    if len(transcript.split()) > 3000:
        summary = extractive_summarization(transcript)
    else:
        summary = abstractive_summarization(transcript, max_length)

    cache[cache_key] = jsonify({"summary": summary.strip()}), 200
    return cache[cache_key]

def extract_video_id(url: str) -> str | None:
    """Extract YouTube video ID from the URL."""
    import re
    match = re.search(r"(?:v=|\/)([0-9A-Za-z_-]{11})", url)
    return match.group(1) if match else None


# def get_transcript(video_id: str) -> str:
#     """Fetch and concatenate YouTube transcript text."""
#     transcript_list = YouTubeTranscriptApi.get_transcript(video_id)
#     return " ".join([entry['text'] for entry in transcript_list])


def abstractive_summarization(transcript: str, max_length: int) -> str:
    """Summarize using Hugging Face transformers with chunking."""
    chunk_size = 1000
    summary_parts = []
    for i in range(0, len(transcript), chunk_size):
        chunk = transcript[i:i + chunk_size]
        summarized = summarizer(chunk, max_length=max_length, min_length=40, do_sample=False)
        summary_parts.append(summarized[0]['summary_text'])
    return " ".join(summary_parts)


def extractive_summarization(transcript: str) -> str:
    """Extractive summarization using LSA on sentences."""
    sentences = sent_tokenize(transcript)
    if len(sentences) == 0:
        return ""

    vectorizer = CountVectorizer(stop_words='english')
    X = vectorizer.fit_transform(sentences)

    svd = TruncatedSVD(n_components=1, random_state=42)
    svd.fit(X)
    components = svd.transform(X).flatten()

    ranked_sentences = sorted(((score, idx) for idx, score in enumerate(components)), reverse=True)
    num_sentences = max(1, int(0.2 * len(sentences)))  # 20% of sentences
    selected_indices = sorted(idx for _, idx in ranked_sentences[:num_sentences])

    return " ".join(sentences[idx] for idx in selected_indices)


if __name__ == '__main__':
    application.run(debug=True)
