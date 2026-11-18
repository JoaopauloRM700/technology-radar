import json
from copy import deepcopy
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from unittest import TestCase, main

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
RADAR = json.loads((ROOT / "data/radar.json").read_text(encoding="utf-8"))
UUID = "12345678-abcd-4abc-8123-123456789abc"


class StaticHandler(SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass


class FrontendTests(TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(
            ("127.0.0.1", 0), partial(StaticHandler, directory=str(ROOT))
        )
        Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.addClassCleanup(cls.server.server_close)
        cls.addClassCleanup(cls.server.shutdown)
        cls.playwright = sync_playwright().start()
        cls.addClassCleanup(cls.playwright.stop)
        cls.browser = cls.playwright.chromium.launch(channel="msedge", headless=True)
        cls.addClassCleanup(cls.browser.close)

    def setUp(self):
        self.page = self.browser.new_page()
        self.page.on("dialog", lambda dialog: dialog.accept())
        self.addCleanup(self.page.close)

    def load(self):
        self.page.goto(f"http://127.0.0.1:{self.server.server_port}/")
        expect(self.page.locator("#totalBlips")).to_have_text("25", timeout=2500)

    def apply(self, entrypoint, proposals):
        if entrypoint == "import":
            self.page.locator("#proposalFileInput").set_input_files({
                "name": "propostas.json",
                "mimeType": "application/json",
                "buffer": json.dumps({"proposals": proposals}).encode(),
            })
        else:
            self.page.route("**/api/pdf-proposals", lambda route: route.fulfill(
                json={"ok": True, "proposals": proposals}
            ))
            self.page.locator("#pdfFileInput").set_input_files({
                "name": "radar.pdf",
                "mimeType": "application/pdf",
                "buffer": b"%PDF-1.7",
            })
            expect(self.page.locator("#analyzePdfButton")).to_be_enabled(timeout=2500)

    def test_legacy_batch_with_missing_target_is_atomic(self):
        legacy = json.loads((ROOT / "data/radar-update-proposals.example.json").read_text(encoding="utf-8"))
        update, added = legacy["proposals"]
        for entrypoint in ("import", "PDF"):
            with self.subTest(entrypoint=entrypoint):
                self.load()
                self.apply(entrypoint, [added, {**update, "id": "ES-999"}])
                expect(self.page.locator("#toast.show")).to_be_visible(timeout=2500)
                self.assertEqual(self.page.locator("#totalBlips").inner_text(), "25")
                self.assertEqual(self.page.locator("#matrixBody").get_by_text(added["blip"]["name"]).count(), 0)
                self.apply("import", [added, update])
                expect(self.page.locator("#totalBlips")).to_have_text("26", timeout=2500)
                expect(self.page.locator("#matrixBody tr").filter(has_text="ES-16")).to_contain_text("Trial")

    def test_new_format_is_applied(self):
        first = RADAR["blips"][0]
        proposed = {key: value for key, value in first.items() if key != "id"}
        update = {
            "action": "update", "targetId": first["id"], "reason": "Novos dados",
            "confidence": 0.9, "evidence": [{"page": 2, "note": "Resultado"}],
            "blip": {**proposed, "name": "Coding Agents revisado"},
        }
        for entrypoint in ("import", "PDF"):
            with self.subTest(entrypoint=entrypoint):
                self.load()
                self.apply(entrypoint, [update])
                expect(self.page.locator("#matrixBody tr").filter(has_text="ES-01")).to_contain_text(
                    "Coding Agents revisado", timeout=2500
                )

    def test_batch_limit_is_enforced(self):
        added = {"action": "add", "blip": {"name": "Inclusão em excesso"}}
        self.load()
        self.apply("import", [added] * 6)
        expect(self.page.locator("#toast.show")).to_be_visible(timeout=2500)
        self.assertEqual(self.page.locator("#totalBlips").inner_text(), "25")
        expect(self.page.locator("#toast")).to_contain_text("Não foi possível importar")

    def test_manual_ids_and_labels_with_uuid_blip(self):
        radar = deepcopy(RADAR)
        radar["blips"][0]["id"] = UUID
        self.page.route("**/data/radar.json", lambda route: route.fulfill(json=radar))
        self.load()
        self.page.locator("#addBlipButton").click()
        self.page.locator("#addBlipButton").click()
        ids = self.page.locator("#matrixBody strong").all_text_contents()
        with self.subTest("unique manual IDs"):
            self.assertIn("ES-26", ids)
            self.assertIn("ES-27", ids)
            self.assertEqual(len(ids), len(set(ids)))
        with self.subTest("numeric SVG label"):
            label = self.page.locator("#radarSvg").get_by_role("button", name=f"{UUID} Coding Agents", exact=True).locator("text")
            self.assertRegex(label.text_content(), r"^#?[1-9][0-9]*$")


if __name__ == "__main__":
    main(verbosity=2)
