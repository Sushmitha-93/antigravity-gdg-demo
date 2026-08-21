"""
Automated unit tests for BigQuery Release Notes Web App
"""

import unittest
from feed_parser import parse_feed_xml, clean_html_to_text, parse_sub_updates
from app import app

SAMPLE_ATOM_XML = """<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>tag:google.com,2016:bigquery-release-notes</id>
  <title>BigQuery - Release notes</title>
  <link rel="self" href="https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"/>
  <updated>2026-08-20T00:00:00-07:00</updated>
  <entry>
    <title>August 20, 2026</title>
    <id>tag:google.com,2016:bigquery-release-notes#August_20_2026</id>
    <updated>2026-08-20T00:00:00-07:00</updated>
    <link rel="alternate" href="https://docs.cloud.google.com/bigquery/docs/release-notes#August_20_2026"/>
    <content type="html"><![CDATA[<h3>Deprecated</h3>
<p>Starting April 26, 2027, core graph processing will be restricted.</p>
<h3>Feature</h3>
<p>The <a href="https://example.com">MCP tool</a> allows AI agents to execute advanced commands.</p>
]]></content>
  </entry>
  <entry>
    <title>August 18, 2026</title>
    <id>tag:google.com,2016:bigquery-release-notes#August_18_2026</id>
    <updated>2026-08-18T00:00:00-07:00</updated>
    <link rel="alternate" href="https://docs.cloud.google.com/bigquery/docs/release-notes#August_18_2026"/>
    <content type="html"><![CDATA[<h3>Feature</h3>
<p>The default limit increased from 10 to 100.</p>
]]></content>
  </entry>
</feed>
"""


class TestFeedParser(unittest.TestCase):

    def test_clean_html_to_text(self):
        html_input = "<p>Hello <strong>World</strong>! <a href='https://google.com'>Link</a></p>"
        result = clean_html_to_text(html_input)
        self.assertEqual(result, "Hello World! Link")

    def test_parse_sub_updates(self):
        html_input = "<h3>Feature</h3><p>Added new query optimizer.</p><h3>Deprecated</h3><p>Legacy SQL v1.</p>"
        updates = parse_sub_updates(html_input)
        self.assertEqual(len(updates), 2)
        self.assertEqual(updates[0]["category"], "Feature")
        self.assertIn("Added new query optimizer.", updates[0]["summary_text"])
        self.assertEqual(updates[1]["category"], "Deprecated")
        self.assertIn("Legacy SQL v1.", updates[1]["summary_text"])

    def test_parse_feed_xml(self):
        parsed = parse_feed_xml(SAMPLE_ATOM_XML)
        self.assertEqual(parsed["title"], "BigQuery - Release notes")
        self.assertEqual(parsed["total_entries"], 2)
        
        first_entry = parsed["entries"][0]
        self.assertEqual(first_entry["title"], "August 20, 2026")
        self.assertEqual(first_entry["link"], "https://docs.cloud.google.com/bigquery/docs/release-notes#August_20_2026")
        self.assertEqual(len(first_entry["updates"]), 2)
        self.assertIn("Deprecated", first_entry["categories"])
        self.assertIn("Feature", first_entry["categories"])


class TestFlaskEndpoints(unittest.TestCase):

    def setUp(self):
        self.client = app.test_client()

    def test_health_check(self):
        res = self.client.get("/health")
        self.assertEqual(res.status_code, 200)
        json_data = res.get_json()
        self.assertEqual(json_data["status"], "ok")

    def test_index_page(self):
        res = self.client.get("/")
        self.assertEqual(res.status_code, 200)
        self.assertIn(b"BigQuery Release Notes", res.data)
        self.assertIn(b"refresh-btn", res.data)
        self.assertIn(b"tweet-modal", res.data)

    def test_api_feed_endpoint(self):
        res = self.client.get("/api/feed")
        self.assertEqual(res.status_code, 200)
        json_data = res.get_json()
        self.assertIn(json_data["status"], ["success", "warning"])
        self.assertIn("feed", json_data)
        self.assertIn("entries", json_data["feed"])
        self.assertGreater(len(json_data["feed"]["entries"]), 0)


if __name__ == "__main__":
    unittest.main()
