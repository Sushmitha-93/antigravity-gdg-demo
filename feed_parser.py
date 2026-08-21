"""
BigQuery Release Notes Feed Parser
Fetches and parses the Atom XML feed from Google Cloud BigQuery docs.
"""

import re
import html
import xml.etree.ElementTree as ET
from typing import List, Dict, Any, Optional
import requests

BIGQUERY_FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
ATOM_NS = "{http://www.w3.org/2005/Atom}"


def clean_html_to_text(html_content: str) -> str:
    """Convert HTML snippet to clean readable plain text."""
    if not html_content:
        return ""
    # Replace block/break tags with newlines/spaces
    text = re.sub(r'</?(?:p|div|h[1-6]|li|br)[^>]*>', '\n', html_content, flags=re.IGNORECASE)
    # Remove remaining HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    # Unescape HTML entities
    text = html.unescape(text)
    # Normalize multiple whitespace/newlines
    lines = [line.strip() for line in text.splitlines()]
    clean_lines = [line for line in lines if line]
    return "\n".join(clean_lines)


def parse_sub_updates(html_content: str) -> List[Dict[str, str]]:
    """
    Parse the HTML content of an entry to extract individual section updates.
    Entries usually have <h3>Category</h3> followed by paragraphs/lists.
    """
    if not html_content:
        return []

    # Regex to split by <h3> tags
    pattern = re.compile(r'<h3>(.*?)</h3>(.*?)(?=(?:<h3>|$))', re.DOTALL | re.IGNORECASE)
    matches = pattern.findall(html_content)

    sub_updates = []
    if matches:
        for idx, (category, body) in enumerate(matches):
            cat_clean = clean_html_to_text(category).strip()
            body_clean = body.strip()
            text_summary = clean_html_to_text(body_clean)
            sub_updates.append({
                "id": f"sub-{idx}",
                "category": cat_clean if cat_clean else "General",
                "content_html": body_clean,
                "summary_text": text_summary
            })
    else:
        # If no <h3> tags found, treat the whole content as a single update
        summary = clean_html_to_text(html_content)
        sub_updates.append({
            "id": "sub-0",
            "category": "Update",
            "content_html": html_content,
            "summary_text": summary
        })

    return sub_updates


def parse_feed_xml(xml_string: str) -> Dict[str, Any]:
    """Parse Atom XML string into structured dictionary."""
    root = ET.fromstring(xml_string)

    feed_title = root.findtext(f"{ATOM_NS}title") or "BigQuery Release Notes"
    feed_updated = root.findtext(f"{ATOM_NS}updated") or ""

    entries_data = []
    for entry in root.findall(f"{ATOM_NS}entry"):
        entry_id = entry.findtext(f"{ATOM_NS}id") or ""
        title = entry.findtext(f"{ATOM_NS}title") or "Release Update"
        updated = entry.findtext(f"{ATOM_NS}updated") or ""

        link_elem = entry.find(f"{ATOM_NS}link")
        link = link_elem.get("href") if link_elem is not None else "https://docs.cloud.google.com/bigquery/docs/release-notes"

        content_elem = entry.find(f"{ATOM_NS}content")
        raw_html = content_elem.text if content_elem is not None and content_elem.text else ""

        sub_updates = parse_sub_updates(raw_html)

        # Collect distinct categories for easy UI filtering
        categories = list(dict.fromkeys(u["category"] for u in sub_updates))

        entries_data.append({
            "id": entry_id,
            "title": title,
            "updated": updated,
            "link": link,
            "raw_html": raw_html,
            "summary_text": clean_html_to_text(raw_html),
            "categories": categories,
            "updates": sub_updates
        })

    return {
        "title": feed_title,
        "updated": feed_updated,
        "total_entries": len(entries_data),
        "entries": entries_data
    }


def fetch_release_notes(feed_url: str = BIGQUERY_FEED_URL, timeout: int = 15) -> Dict[str, Any]:
    """Fetch feed from Google Cloud URL and return parsed data."""
    headers = {
        "User-Agent": "BigQueryReleaseNotesViewer/1.0 (+https://cloud.google.com)"
    }
    response = requests.get(feed_url, headers=headers, timeout=timeout)
    response.raise_for_status()
    return parse_feed_xml(response.text)
