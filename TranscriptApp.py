from flask import Flask, request, jsonify
from flask_cors import CORS
from transformers import pipeline
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.decomposition import TruncatedSVD
from nltk.tokenize import sent_tokenize
from langdetect import detect
from youtube_captions import get_transcript
import re
import nltk

# Download required NLTK data
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt')

application = Flask(__name__)
CORS(application)  # Enable CORS for Chrome extension

# Use a good model (you can change to bart-large-cnn if needed)
try:
    summarizer = pipeline(
        'summarization',
        model='sshleifer/distilbart-cnn-12-6',
        revision='a4f8f3e'
    )
    # Get the tokenizer to count tokens accurately
    tokenizer = summarizer.tokenizer
except Exception as e:
    print(f"Error loading summarizer: {e}")
    summarizer = None
    tokenizer = None

# Basic keyword list for kid-safe filtering
KID_SAFE_KEYWORDS = [
    'violence', 'kill', 'death', 'murder', 'suicide', 'drugs', 'alcohol',
    'abuse', 'sex', 'porn', 'blood', 'weapon', 'gun', 'knife', 'explosion',
    'terrorist', 'racist', 'nsfw', 'explicit', 'mature', 'adult', 'inappropriate'
]

cache = {}

@application.route('/transcript', methods=['GET'])
def transcript_api():
    """Get transcript for a YouTube video"""
    try:
        url = request.args.get('url', '')
        
        print(f"Getting transcript for URL: {url}")
        
        video_id = extract_video_id(url)
        if not video_id:
            return jsonify({"error": "Invalid YouTube URL"}), 400

        print(f"Extracting transcript for video ID: {video_id}")
        transcript = get_transcript(video_id)
        
        if not transcript:
            return jsonify({
                "error": "Transcript unavailable or empty.",
                "transcript": None
            }), 404

        cleaned_transcript = clean_transcript(transcript)
        
        return jsonify({
            "transcript": cleaned_transcript,
            "video_id": video_id
        })

    except Exception as e:
        print(f"Error in transcript_api: {str(e)}")
        return jsonify({
            "error": f"Server error: {str(e)}",
            "transcript": None
        }), 500

@application.route('/summary', methods=['GET'])
def summary_api():
    try:
        url = request.args.get('url', '')
        max_length = int(request.args.get('max_length', 150))
        
        print(f"Processing URL: {url}")
        
        video_id = extract_video_id(url)
        if not video_id:
            return jsonify({"error": "Invalid YouTube URL", "status": "blocked"}), 400

        cache_key = f"{video_id}_{max_length}"
        if cache_key in cache:
            return cache[cache_key]

        print(f"Getting transcript for video ID: {video_id}")
        transcript = get_transcript(video_id)
        
        if not transcript:
            return jsonify({
                "error": "Transcript unavailable or empty.",
                "summary": "No captions available for this video.",
                "status": "blocked"
            }), 404

        cleaned_transcript = clean_transcript(transcript)
        print(f"Cleaned transcript length: {len(cleaned_transcript.split())} words")
        
        if len(cleaned_transcript.split()) < 30:
            return jsonify({
                "error": "Transcript too short to summarize.",
                "summary": "Video transcript is too short to analyze.",
                "status": "blocked"
            }), 400

        # Check if content is kid-safe
        if not is_kid_safe(cleaned_transcript):
            return jsonify({
                "summary": "This content contains inappropriate material and is not suitable for children.",
                "status": "blocked"
            })

        # Generate summary with proper token handling
        if tokenizer:
            token_count = len(tokenizer.encode(cleaned_transcript))
            print(f"Token count: {token_count}")
            
            if token_count > 900:  # Leave buffer for model processing
                summary = smart_chunked_summarization(cleaned_transcript, max_length)
            else:
                summary = abstractive_summarization(cleaned_transcript, max_length)
        else:
            # Fallback if no tokenizer available
            if len(cleaned_transcript.split()) > 800:
                summary = smart_chunked_summarization(cleaned_transcript, max_length)
            else:
                summary = extractive_summarization(cleaned_transcript)

        response_data = {
            "summary": summary.strip() if summary else "Unable to generate summary.",
            "status": "allowed"
        }
        
        cache[cache_key] = response_data
        return jsonify(response_data)

    except Exception as e:
        print(f"Error in summary_api: {str(e)}")
        return jsonify({
            "error": f"Server error: {str(e)}",
            "summary": "An error occurred while processing the video.",
            "status": "blocked"
        }), 500

def extract_video_id(url: str):
    """Extract video ID from YouTube URL"""
    if not url:
        return None
    
    patterns = [
        r'(?:v=|\/)([0-9A-Za-z_-]{11})',
        r'youtu\.be\/([0-9A-Za-z_-]{11})',
        r'embed\/([0-9A-Za-z_-]{11})'
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    
    return None

def clean_transcript(text: str) -> str:
    """Clean transcript text"""
    if not text:
        return ""
    
    # Remove timestamp markers and other artifacts
    text = re.sub(r"\[.*?\]", "", text)
    text = re.sub(r"\(.*?\)", "", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()

def smart_chunked_summarization(transcript: str, max_length: int) -> str:
    """Handle long transcripts by chunking intelligently"""
    if not summarizer or not tokenizer:
        return extractive_summarization(transcript)
    
    # Create chunks that respect token limits
    chunks = create_token_aware_chunks(transcript, max_tokens=800)  # Safe limit
    summary_parts = []
    
    for i, chunk in enumerate(chunks):
        try:
            print(f"Processing chunk {i+1}/{len(chunks)}")
            
            # Verify chunk size
            chunk_tokens = len(tokenizer.encode(chunk))
            if chunk_tokens > 900:
                print(f"Chunk still too long ({chunk_tokens} tokens), using extractive")
                summary_parts.append(extractive_summarization(chunk))
                continue
            
            # Calculate appropriate max_length for this chunk
            chunk_max_length = min(max_length // len(chunks), chunk_tokens // 3)
            chunk_max_length = max(30, chunk_max_length)  # Minimum length
            
            result = summarizer(
                chunk, 
                max_length=chunk_max_length,
                min_length=min(20, chunk_max_length // 2),
                do_sample=False
            )
            summary_parts.append(result[0]['summary_text'])
            
        except Exception as e:
            print(f"Error summarizing chunk {i+1}: {e}")
            # Fallback to extractive for this chunk
            summary_parts.append(extractive_summarization(chunk))
    
    # Combine summaries and potentially summarize again if too long
    combined_summary = " ".join(summary_parts)
    
    # If combined summary is still very long, summarize it once more
    if tokenizer and len(tokenizer.encode(combined_summary)) > 400:
        try:
            final_result = summarizer(
                combined_summary,
                max_length=max_length,
                min_length=min(30, max_length // 2),
                do_sample=False
            )
            return final_result[0]['summary_text']
        except:
            return combined_summary[:1000] + "..." if len(combined_summary) > 1000 else combined_summary
    
    return combined_summary

def create_token_aware_chunks(text: str, max_tokens: int = 800):
    """Create chunks that respect token limits"""
    if not tokenizer:
        # Fallback to word-based chunking
        return chunk_sentences(text, max_tokens)
    
    try:
        sentences = sent_tokenize(text)
    except:
        sentences = text.split('. ')
        sentences = [s + '.' for s in sentences if s.strip()]
    
    chunks = []
    current_chunk = []
    current_tokens = 0
    
    for sentence in sentences:
        sentence_tokens = len(tokenizer.encode(sentence))
        
        # If adding this sentence would exceed limit, save current chunk
        if current_tokens + sentence_tokens > max_tokens and current_chunk:
            chunks.append(" ".join(current_chunk))
            current_chunk = []
            current_tokens = 0
        
        # If single sentence is too long, split it further
        if sentence_tokens > max_tokens:
            # Split long sentence into smaller parts
            words = sentence.split()
            temp_chunk = []
            temp_tokens = 0
            
            for word in words:
                word_tokens = len(tokenizer.encode(word))
                if temp_tokens + word_tokens > max_tokens and temp_chunk:
                    chunks.append(" ".join(temp_chunk))
                    temp_chunk = []
                    temp_tokens = 0
                temp_chunk.append(word)
                temp_tokens += word_tokens
            
            if temp_chunk:
                chunks.append(" ".join(temp_chunk))
        else:
            current_chunk.append(sentence)
            current_tokens += sentence_tokens
    
    # Add remaining chunk
    if current_chunk:
        chunks.append(" ".join(current_chunk))
    
    return [chunk for chunk in chunks if chunk.strip()]

def chunk_sentences(text: str, max_tokens: int = 500):
    """Split text into chunks for processing (fallback method)"""
    try:
        sentences = sent_tokenize(text)
    except:
        # Fallback if NLTK tokenizer fails
        sentences = text.split('. ')
    
    chunks, current_chunk, token_count = [], [], 0
    
    for sentence in sentences:
        words = sentence.split()
        if token_count + len(words) > max_tokens and current_chunk:
            chunks.append(" ".join(current_chunk))
            current_chunk, token_count = [], 0
        current_chunk.append(sentence)
        token_count += len(words)
    
    if current_chunk:
        chunks.append(" ".join(current_chunk))
    
    return chunks

def abstractive_summarization(transcript: str, max_length: int) -> str:
    """Generate abstractive summary using transformer model"""
    if not summarizer:
        return extractive_summarization(transcript)
    
    try:
        # For shorter texts that fit in context window
        result = summarizer(
            transcript, 
            max_length=max_length,
            min_length=min(30, max_length // 2),
            do_sample=False
        )
        return result[0]['summary_text']
    except Exception as e:
        print(f"Error in abstractive summarization: {e}")
        return extractive_summarization(transcript)

def extractive_summarization(transcript: str) -> str:
    """Generate extractive summary using TF-IDF and SVD"""
    try:
        sentences = sent_tokenize(transcript)
    except:
        sentences = transcript.split('. ')
    
    if len(sentences) <= 1:
        return transcript[:500] + "..." if len(transcript) > 500 else transcript
    
    try:
        vectorizer = CountVectorizer(stop_words='english', max_features=1000)
        X = vectorizer.fit_transform(sentences)

        svd = TruncatedSVD(n_components=1, random_state=42)
        svd.fit(X)
        components = svd.transform(X).flatten()

        ranked_sentences = sorted(
            ((score, idx) for idx, score in enumerate(components)), 
            reverse=True
        )
        
        num_sentences = max(1, min(5, int(0.3 * len(sentences))))
        selected_indices = sorted(idx for _, idx in ranked_sentences[:num_sentences])

        return " ".join(sentences[idx] for idx in selected_indices)
    
    except Exception as e:
        print(f"Error in extractive summarization: {e}")
        # Fallback: return first few sentences
        return " ".join(sentences[:3])

def is_kid_safe(text: str) -> bool:
    """Check if content is appropriate for children"""
    if not text:
        return True
    
    text_lower = text.lower()
    
    # Check for explicit keywords
    for keyword in KID_SAFE_KEYWORDS:
        if keyword in text_lower:
            print(f"Found inappropriate keyword: {keyword}")
            return False
    
    return True

@application.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "summarizer_loaded": summarizer is not None})

if __name__ == '__main__':
    print("Starting YouTube Guardian Flask server...")
    print(f"Summarizer loaded: {summarizer is not None}")
    application.run(debug=True, host='127.0.0.1', port=5000)