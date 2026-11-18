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
ADMIN_TOKEN = "a" * 32


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

    def mock_admin_auth(self, health_failures=0):
        attempts = {"health": 0}

        def handle_health(route):
            attempts["health"] += 1
            if attempts["health"] <= health_failures:
                route.fulfill(status=503, json={"ok": False})
                return
            route.fulfill(status=200, json={"ok": True})

        def handle_verify(route):
            auth = route.request.headers.get("authorization", "")
            if auth == f"Bearer {ADMIN_TOKEN}":
                route.fulfill(status=200, json={"ok": True})
            else:
                route.fulfill(status=401, json={"ok": False, "error": "unauthorized"})

        self.page.route("**/healthz", handle_health)
        self.page.route("**/api/v1/admin/verify", handle_verify)
        return attempts

    def login_admin(self, token=ADMIN_TOKEN):
        self.page.locator("#adminModeButton").click()
        expect(self.page.locator("#adminDialog")).to_be_visible()
        self.page.locator("#adminTokenInput").fill(token)
        self.page.locator("#adminSubmitButton").click()
        expect(self.page.locator("#adminDialog")).to_be_hidden(timeout=5000)
        expect(self.page.locator("#addBlipButton")).to_be_visible()

    def test_visitor_is_read_only_and_can_download_offline_html(self):
        api_calls = []
        self.page.route("**/api/**", lambda route: (api_calls.append(route.request.url), route.abort()))
        self.load()

        for selector in (
            "#addBlipButton",
            "#saveVersionButton",
            "#analyzePdfButton",
            "#importProposalsButton",
            "#resetDataButton",
            "#deleteBlipButton",
            "#addSourceButton",
            "#blipForm",
        ):
            expect(self.page.locator(selector)).to_be_hidden()

        expect(self.page.locator("#historyLink")).to_have_attribute(
            "href",
            "https://github.com/JoaopauloRM700/technology-radar/commits/main/data/radar.json",
        )
        self.page.locator('.nav-button[data-view="export"]').click()
        expect(self.page.locator("#saveHtmlButton")).to_be_visible()
        self.assertEqual(self.page.locator("#downloadHtmlButton").count(), 0)

        with self.page.expect_download() as download_info:
            self.page.locator("#saveHtmlButton").click()
        html_path = download_info.value.path()
        html = Path(html_path).read_text(encoding="utf-8")
        self.assertIn("<!doctype html>", html)
        self.assertIn("Matriz Radar + TRM", html)
        self.assertNotIn("<script", html)
        self.assertEqual(api_calls, [])

    def test_admin_login_draft_conflict_and_publish_flow(self):
        self.mock_admin_auth()
        save_calls = []

        def handle_save(route):
            body = route.request.post_data_json
            save_calls.append(body)
            if len(save_calls) == 1:
                route.fulfill(
                    status=409,
                    json={"ok": False, "error": "revision_conflict", "currentRevision": UUID},
                )
            else:
                updated = deepcopy(RADAR)
                updated["revision"] = UUID
                updated["changeNote"] = body["changeNote"]
                updated["blips"] = body["radar"]["blips"]
                updated["sources"] = body["radar"]["sources"]
                route.fulfill(
                    status=200,
                    json={
                        "ok": True,
                        "radar": updated,
                        "commit": {
                            "sha": "abcdef1234567890",
                            "url": "https://github.com/JoaopauloRM700/technology-radar/commit/abcdef1234567890",
                        },
                    },
                )

        self.page.route("**/api/v1/radar", handle_save)
        self.load()
        self.login_admin()

        storage_len = self.page.evaluate("() => localStorage.length + sessionStorage.length")
        self.assertEqual(storage_len, 0)

        self.page.locator("#addBlipButton").click()
        expect(self.page.locator("#totalBlips")).to_have_text("26")
        expect(self.page.locator("#draftIndicator")).to_be_visible()

        self.page.locator("#saveVersionButton").click()
        self.page.locator("#changeNoteInput").fill("Nova versão de teste")
        self.page.locator("#saveConfirmButton").click()

        expect(self.page.locator("#saveConflictBox")).to_be_visible()
        expect(self.page.locator("#totalBlips")).to_have_text("26")
        with self.page.expect_download() as draft_dl:
            self.page.locator("#downloadDraftButton").click()
        draft_json = json.loads(Path(draft_dl.value.path()).read_text(encoding="utf-8"))
        self.assertEqual(len(draft_json["blips"]), 26)

        self.page.locator("#saveConfirmButton").click()
        expect(self.page.locator("#saveSuccessBox")).to_be_visible()
        expect(self.page.locator("#saveSuccessMessage")).to_contain_text("abcdef1")
        expect(self.page.locator("#saveSuccessMessage")).to_contain_text("GitHub Pages")
        expect(self.page.locator("#draftIndicator")).to_be_hidden()

    def test_pdf_analysis_review_unchecked_selective_apply_and_restart_retry(self):
        self.mock_admin_auth()
        first = RADAR["blips"][0]
        proposed = {key: value for key, value in first.items() if key != "id"}
        proposals = [
            {
                "action": "update",
                "targetId": first["id"],
                "reason": "Evidência na página 2",
                "confidence": 0.9,
                "evidence": [{"page": 2, "note": "Adoção crescente"}],
                "blip": {**proposed, "name": "Coding Agents revisado"},
            },
            {
                "action": "add",
                "targetId": None,
                "reason": "Nova prática citada",
                "confidence": 0.75,
                "evidence": [{"page": 4, "note": "Relatório anual"}],
                "blip": {**proposed, "name": "Não Selecionada"},
            },
        ]
        poll_count = {"n": 0}
        upload_count = {"n": 0}

        def handle_upload(route):
            upload_count["n"] += 1
            self.assertEqual(route.request.headers.get("content-type"), "application/pdf")
            route.fulfill(
                status=202,
                json={
                    "ok": True,
                    "job": {
                        "id": f"job-{upload_count['n']}",
                        "status": "queued",
                        "createdAt": "2026-11-18T12:00:00.000Z",
                        "updatedAt": "2026-11-18T12:00:00.000Z",
                        "progress": {"stage": "queued", "processedPages": 0, "totalPages": 0},
                    },
                },
            )

        def handle_poll(route):
            if route.request.url.endswith("/job-1"):
                poll_count["n"] += 1
                route.fulfill(
                    status=200,
                    json={
                        "ok": True,
                        "job": {
                            "id": "job-1",
                            "status": "succeeded",
                            "progress": {"stage": "succeeded", "processedPages": 4, "totalPages": 4},
                            "result": {"proposals": proposals, "totalPages": 4, "ocrPages": 1},
                        },
                    },
                )
            else:
                route.fulfill(status=404, json={"ok": False, "error": "not_found"})

        self.page.route("**/api/v1/analysis-jobs", handle_upload)
        self.page.route("**/api/v1/analysis-jobs/*", handle_poll)
        self.load()
        self.login_admin()

        self.page.locator("#analyzePdfButton").click()
        expect(self.page.locator("#pdfDialog")).to_be_visible()
        self.page.locator("#pdfFileInput").set_input_files({
            "name": "relatório público.pdf",
            "mimeType": "application/pdf",
            "buffer": b"%PDF-1.7\npublic report",
        })
        self.page.locator("#publicPdfCheckbox").check()
        self.page.locator("#pdfStartButton").click()

        expect(self.page.locator("#reviewDialog")).to_be_visible(timeout=5000)
        checkboxes = self.page.locator('#reviewList input[type="checkbox"]')
        self.assertEqual(checkboxes.count(), 2)
        self.assertFalse(checkboxes.nth(0).is_checked())
        self.assertFalse(checkboxes.nth(1).is_checked())
        expect(self.page.locator("#applyProposalsButton")).to_be_disabled()

        checkboxes.nth(0).check()
        self.page.locator("#applyProposalsButton").click()
        expect(self.page.locator("#reviewDialog")).to_be_hidden()
        expect(self.page.locator("#totalBlips")).to_have_text("25")
        expect(self.page.locator("#matrixBody tr").filter(has_text="ES-01")).to_contain_text(
            "Coding Agents revisado"
        )
        expect(self.page.locator("#draftIndicator")).to_be_visible()

        # Second PDF job simulates Render restart (404 on poll): radar stays intact
        self.page.locator("#analyzePdfButton").click()
        self.page.locator("#pdfFileInput").set_input_files({
            "name": "publico2.pdf",
            "mimeType": "application/pdf",
            "buffer": b"%PDF-1.7\nsecond",
        })
        self.page.locator("#publicPdfCheckbox").check()
        self.page.locator("#pdfStartButton").click()
        expect(self.page.locator("#pdfDialogStatus")).to_contain_text("reinício", timeout=5000)
        self.page.locator("#pdfCancelButton").click()
        expect(self.page.locator("#totalBlips")).to_have_text("25")

    def test_manual_ids_discard_draft_and_mobile_keyboard(self):
        self.mock_admin_auth()
        radar = deepcopy(RADAR)
        radar["blips"][0]["id"] = UUID
        self.page.route("**/data/radar.json*", lambda route: route.fulfill(json=radar))
        self.load()
        self.login_admin()

        self.page.locator("#addBlipButton").click()
        self.page.locator("#addBlipButton").click()
        ids = self.page.locator("#matrixBody strong").all_text_contents()
        self.assertIn("ES-26", ids)
        self.assertIn("ES-27", ids)
        self.assertEqual(len(ids), len(set(ids)))

        label = self.page.locator("#radarSvg").get_by_role(
            "button", name=f"{UUID} Coding Agents", exact=True
        ).locator("text")
        self.assertRegex(label.text_content(), r"^#?[1-9][0-9]*$")

        self.page.locator("#resetDataButton").click()
        expect(self.page.locator("#totalBlips")).to_have_text("25")
        expect(self.page.locator("#draftIndicator")).to_be_hidden()

        self.page.set_viewport_size({"width": 390, "height": 844})
        blip_button = self.page.locator("#radarSvg g.blip").nth(1)
        blip_button.focus()
        self.page.keyboard.press("Enter")
        expect(self.page.locator("#selectedBlipLabel")).to_contain_text("ES-02")


if __name__ == "__main__":
    main(verbosity=2)
