import os
from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request
from google import genai

try:
    from elevenlabs.client import ElevenLabs
except ImportError:
    ElevenLabs = None

# Load environment variables from .env
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")

# Initialize the Gemini client using the google-genai SDK
gemini_client = genai.Client(api_key=GEMINI_API_KEY)

# Initialize the ElevenLabs client
elevenlabs_client = (
    ElevenLabs(api_key=ELEVENLABS_API_KEY) if ElevenLabs and ELEVENLABS_API_KEY else None
)

app = Flask(__name__)


@app.route("/", methods=["GET"])
def index():
    """Render the root application interface."""
    return render_template("index.html")


@app.route("/api/start", methods=["POST"])
def start_session():
    """Accept a JSON payload with the user's name and return a career-focused greeting from Gemini."""
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()

    if not name:
        return jsonify({"error": "Please provide your name to continue."}), 400

    prompt = (
        f"You are an executive career advisor. Write a short, warm, polished, and welcoming "
        f"career-focused greeting (2 to 3 sentences maximum) for a professional named {name}. "
        f"Keep the tone mature, articulate, and encouraging, avoiding clichés or overly casual slang."
    )

    last_error = None
    for model_name in ("gemini-3.8-flash", "gemini-flash-latest"):
        try:
            interaction = gemini_client.interactions.create(
                model=model_name,
                input=prompt,
            )
            greeting = (
                getattr(interaction, "output_text", None)
                or interaction.outputs[-1].text
            )
            if greeting:
                return jsonify({"name": name, "greeting": greeting.strip()})
        except Exception as exc:
            last_error = exc

        try:
            response = gemini_client.models.generate_content(
                model=model_name,
                contents=prompt,
            )
            if response and response.text:
                return jsonify({"name": name, "greeting": response.text.strip()})
        except Exception as exc:
            last_error = exc

    return jsonify({
        "error": "Unable to generate greeting at this time.",
        "details": str(last_error) if last_error else "Unknown error",
    }), 500


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5001))
    print(f"Starting Executive Career Advisory server at http://127.0.0.1:{port}")
    app.run(host="127.0.0.1", port=port, debug=True)
