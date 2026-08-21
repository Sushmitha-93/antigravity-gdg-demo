"""
Flask Application for BigQuery Release Notes Viewer
"""

import time
import logging
from flask import Flask, render_template, jsonify, request
from feed_parser import fetch_release_notes

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Simple in-memory cache to avoid redundant external network requests
CACHE = {
    "data": None,
    "last_fetched": 0,
    "ttl_seconds": 300  # 5 minutes TTL
}


def get_cached_or_fresh_feed(force_refresh: bool = False):
    now = time.time()
    if not force_refresh and CACHE["data"] is not None and (now - CACHE["last_fetched"]) < CACHE["ttl_seconds"]:
        logger.info("Serving BigQuery release notes from in-memory cache.")
        return CACHE["data"], True

    logger.info("Fetching fresh BigQuery release notes from upstream Atom XML feed...")
    fresh_data = fetch_release_notes()
    CACHE["data"] = fresh_data
    CACHE["last_fetched"] = now
    return fresh_data, False


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/feed")
def api_feed():
    force_refresh = request.args.get("refresh", "").lower() in ["1", "true", "yes"]
    try:
        data, is_cached = get_cached_or_fresh_feed(force_refresh=force_refresh)
        return jsonify({
            "status": "success",
            "cached": is_cached,
            "fetched_at": CACHE["last_fetched"],
            "feed": data
        })
    except Exception as e:
        logger.error(f"Error fetching release notes: {e}", exc_info=True)
        # If cache exists on error, fallback to cache
        if CACHE["data"] is not None:
            return jsonify({
                "status": "warning",
                "message": f"Failed to refresh live feed ({str(e)}). Displaying cached data.",
                "cached": True,
                "fetched_at": CACHE["last_fetched"],
                "feed": CACHE["data"]
            }), 200

        return jsonify({
            "status": "error",
            "message": f"Unable to retrieve BigQuery release notes: {str(e)}"
        }), 502


@app.route("/health")
def health():
    return jsonify({"status": "ok", "app": "BigQuery Release Notes Viewer"})


if __name__ == "__main__":
    logger.info("Starting BigQuery Release Notes Web App on http://127.0.0.1:5000")
    app.run(host="127.0.0.1", port=5000, debug=True)
