import json
from copy import deepcopy
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from unittest import TestCase, main

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
RADAR = json.loads((ROOT / "test/fixtures/radar.json").read_text(encoding="utf-8"))
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

    def load(self, radar=RADAR):
        self.page.route("**/data/radar.json*", lambda route: route.fulfill(json=radar))
        self.page.goto(f"http://127.0.0.1:{self.server.server_port}/")
        expect(self.page.locator("#totalBlips")).to_have_text(str(len(radar["blips"])), timeout=2500)

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

    def test_local_meta_api_override_is_used_before_the_default_port(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8").replace(
            'name="radar-api-base" content=""',
            'name="radar-api-base" content="http://localhost:9876"',
        )
        root_url = f"http://127.0.0.1:{self.server.server_port}/"
        calls = []
        self.page.route(root_url, lambda route: route.fulfill(body=html, content_type="text/html"))

        def handle_api(route):
            calls.append(route.request.url)
            route.fulfill(status=200, json={"ok": True})

        self.page.route("http://localhost:9876/**", handle_api)
        self.load()
        self.login_admin()
        self.assertTrue(calls)
        self.assertTrue(all(url.startswith("http://localhost:9876/") for url in calls))

    def test_admin_login_draft_conflict_and_publish_flow(self):
        self.mock_admin_auth()
        save_calls = []
        remote = deepcopy(RADAR)
        remote["revision"] = UUID
        remote["blips"][0]["name"] = "Coding Agents remoto"

        def handle_save(route):
            body = route.request.post_data_json
            save_calls.append(body)
            if len(save_calls) == 1:
                route.fulfill(
                    status=409,
                    json={
                        "ok": False,
                        "error": "revision_conflict",
                        "currentRevision": UUID,
                        "currentRadar": remote,
                    },
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
        expect(self.page.locator("#totalBlips")).to_have_text(str(len(RADAR["blips"]) + 1))
        expect(self.page.locator("#draftIndicator")).to_be_visible()

        self.page.locator("#saveVersionButton").click()
        self.page.locator("#changeNoteInput").fill("Nova versão de teste")
        self.page.locator("#saveConfirmButton").click()

        expect(self.page.locator("#saveConflictBox")).to_be_visible()
        expect(self.page.locator("#totalBlips")).to_have_text(str(len(RADAR["blips"]) + 1))
        with self.page.expect_download() as draft_dl:
            self.page.locator("#downloadDraftButton").click()
        draft_json = json.loads(Path(draft_dl.value.path()).read_text(encoding="utf-8"))
        self.assertEqual(len(draft_json["blips"]), len(RADAR["blips"]) + 1)

        self.page.locator("#reloadCanonicalButton").click()
        expect(self.page.locator("#saveDialog")).to_be_hidden()
        expect(self.page.locator("#matrixBody tr").filter(has_text="ES-01")).to_contain_text(
            "Coding Agents remoto"
        )
        self.page.locator("#addBlipButton").click()
        self.page.locator("#saveVersionButton").click()
        self.page.locator("#changeNoteInput").fill("Nova versão após conflito")
        self.page.locator("#saveConfirmButton").click()
        expect(self.page.locator("#saveSuccessBox")).to_be_visible()
        expect(self.page.locator("#saveSuccessMessage")).to_contain_text("abcdef1")
        expect(self.page.locator("#saveSuccessMessage")).to_contain_text("GitHub Pages")
        expect(self.page.locator("#draftIndicator")).to_be_hidden()
        self.assertEqual(save_calls[1]["baseRevision"], UUID)

    def test_expired_session_hides_and_restores_draft_and_rejects_malformed_source_url(self):
        self.mock_admin_auth()
        self.page.route(
            "**/api/v1/radar",
            lambda route: route.fulfill(status=401, json={"ok": False, "error": "unauthorized"}),
        )
        self.load()
        self.login_admin()

        self.page.locator("#addBlipButton").click()
        expect(self.page.locator("#totalBlips")).to_have_text(str(len(RADAR["blips"]) + 1))
        self.page.locator("#saveVersionButton").click()
        self.page.locator("#changeNoteInput").fill("Teste de sessão expirada")
        self.page.locator("#saveConfirmButton").click()

        expect(self.page.locator("#adminModeButton span")).to_have_text("Modo administrador")
        expect(self.page.locator("#totalBlips")).to_have_text(str(len(RADAR["blips"])))
        expect(self.page.locator("#draftIndicator")).to_be_hidden()

        self.page.locator("#saveCloseButton").click()
        self.login_admin()
        expect(self.page.locator("#totalBlips")).to_have_text(str(len(RADAR["blips"]) + 1))
        expect(self.page.locator("#draftIndicator")).to_be_visible()

        source_count = self.page.locator("#sourceGrid .source-detail").count()
        self.page.evaluate(
            """() => {
                const answers = ["Fonte inválida", "https://[bad"];
                window.prompt = () => answers.shift();
            }"""
        )
        self.page.locator("#addSourceButton").click()
        self.assertEqual(self.page.locator("#sourceGrid .source-detail").count(), source_count)

    def test_cancelled_login_cannot_activate_admin_after_late_success(self):
        self.mock_admin_auth()
        self.page.add_init_script(
            """(() => {
                const originalFetch = window.fetch.bind(window);
                let release;
                const gate = new Promise((resolve) => { release = resolve; });
                window.__releaseVerify = release;
                window.fetch = async (input, init = {}) => {
                    if (String(input).includes('/api/v1/admin/verify')) await gate;
                    return originalFetch(input, init);
                };
            })()"""
        )
        self.load()
        self.page.locator("#adminModeButton").click()
        self.page.locator("#adminTokenInput").fill(ADMIN_TOKEN)
        self.page.locator("#adminSubmitButton").click()
        expect(self.page.locator("#adminSubmitButton")).to_be_disabled()
        self.page.evaluate(
            """() => {
                const dialog = document.querySelector('#adminDialog');
                if (dialog.open) dialog.close();
                else dialog.dispatchEvent(new Event('close'));
            }"""
        )
        expect(self.page.locator("#adminDialog")).to_be_hidden()
        self.page.evaluate("window.__releaseVerify()")
        self.page.wait_for_timeout(100)
        expect(self.page.locator("#addBlipButton")).to_be_hidden()

    def test_save_dialog_cannot_close_or_submit_twice_while_publish_is_pending(self):
        self.mock_admin_auth()
        calls = {"save": 0}

        def handle_save(route):
            calls["save"] += 1
            body = route.request.post_data_json
            updated = deepcopy(RADAR)
            updated["revision"] = UUID
            updated["blips"] = body["radar"]["blips"]
            updated["sources"] = body["radar"]["sources"]
            route.fulfill(status=200, json={"ok": True, "radar": updated, "commit": {"sha": "abc"}})

        self.page.route("**/api/v1/radar", handle_save)
        self.page.add_init_script(
            """(() => {
                const originalFetch = window.fetch.bind(window);
                let release;
                const gate = new Promise((resolve) => { release = resolve; });
                window.__releaseSave = release;
                window.fetch = async (input, init = {}) => {
                    if (String(input).includes('/api/v1/radar') && init.method === 'PUT') await gate;
                    return originalFetch(input, init);
                };
            })()"""
        )
        self.load()
        self.login_admin()
        self.page.locator("#addBlipButton").click()
        self.page.locator("#saveVersionButton").click()
        self.page.locator("#changeNoteInput").fill("Publicação única")
        self.page.locator("#saveConfirmButton").click()
        expect(self.page.locator("#saveCloseButton")).to_be_disabled()
        self.page.keyboard.press("Escape")
        expect(self.page.locator("#saveDialog")).to_be_visible()
        expect(self.page.locator("#saveConfirmButton")).to_be_disabled()
        self.page.evaluate("window.__releaseSave()")
        expect(self.page.locator("#saveSuccessBox")).to_be_visible()
        self.assertEqual(calls["save"], 1)

    def test_stalled_publish_releases_the_dialog_and_preserves_the_draft(self):
        self.mock_admin_auth()
        self.page.add_init_script(
            """(() => {
                globalThis.RADAR_SAVE_TIMEOUT_MS = 30;
                const originalFetch = window.fetch.bind(window);
                window.fetch = (input, init = {}) => {
                    if (String(input).includes('/api/v1/radar') && init.method === 'PUT') {
                        return new Promise(() => {});
                    }
                    return originalFetch(input, init);
                };
            })()"""
        )
        self.load()
        self.login_admin()
        self.page.locator("#addBlipButton").click()
        self.page.locator("#saveVersionButton").click()
        self.page.locator("#changeNoteInput").fill("Publicação com resposta travada")
        self.page.locator("#saveConfirmButton").click()

        expect(self.page.locator("#saveDialogStatus")).to_contain_text("confirmar", timeout=3000)
        expect(self.page.locator("#saveCloseButton")).to_be_enabled()
        expect(self.page.locator("#saveConfirmButton")).to_be_enabled()
        expect(self.page.locator("#totalBlips")).to_have_text(str(len(RADAR["blips"]) + 1))
        expect(self.page.locator("#draftIndicator")).to_be_visible()

    def test_unauthorized_publish_suspends_the_draft_without_waiting_for_the_body(self):
        self.mock_admin_auth()
        self.page.add_init_script(
            """(() => {
                globalThis.RADAR_SAVE_TIMEOUT_MS = 5000;
                const originalFetch = window.fetch.bind(window);
                window.fetch = (input, init = {}) => {
                    if (String(input).includes('/api/v1/radar') && init.method === 'PUT') {
                        const body = new ReadableStream({
                            start(controller) {
                                controller.enqueue(new TextEncoder().encode('{"ok":false'));
                            }
                        });
                        return Promise.resolve(new Response(body, {
                            status: 401,
                            headers: { 'Content-Type': 'application/json' },
                        }));
                    }
                    return originalFetch(input, init);
                };
            })()"""
        )
        self.load()
        self.login_admin()
        self.page.locator("#addBlipButton").click()
        self.page.locator("#saveVersionButton").click()
        self.page.locator("#changeNoteInput").fill("Sessão expirada com corpo travado")
        self.page.locator("#saveConfirmButton").click()

        expect(self.page.locator("#adminModeButton span")).to_have_text(
            "Modo administrador", timeout=1000
        )
        expect(self.page.locator("#totalBlips")).to_have_text(str(len(RADAR["blips"])))
        self.page.locator("#saveCloseButton").click()
        self.login_admin()
        expect(self.page.locator("#totalBlips")).to_have_text(str(len(RADAR["blips"]) + 1))

    def test_successful_publish_preserves_proposals_applied_after_submission(self):
        self.mock_admin_auth()
        proposed = {key: value for key, value in RADAR["blips"][0].items() if key != "id"}
        proposal_payload = {"proposals": [{
            "action": "add",
            "targetId": None,
            "reason": "Importação concluída durante o PUT",
            "confidence": 0.8,
            "evidence": [{"page": 1, "note": "Evidência"}],
            "blip": {**proposed, "name": "Importada durante publicação"},
        }]}
        self.page.add_init_script(
            """(() => {
                const originalText = File.prototype.text;
                const originalFetch = window.fetch.bind(window);
                let releaseImport;
                let releaseSave;
                const importGate = new Promise((resolve) => { releaseImport = resolve; });
                const saveGate = new Promise((resolve) => { releaseSave = resolve; });
                window.__releaseImport = releaseImport;
                window.__releaseSaveAfterImport = releaseSave;
                File.prototype.text = async function() {
                    if (this.name === 'delayed-proposals.json') await importGate;
                    return originalText.call(this);
                };
                window.fetch = async (input, init = {}) => {
                    if (String(input).includes('/api/v1/radar') && init.method === 'PUT') await saveGate;
                    return originalFetch(input, init);
                };
            })()"""
        )

        def handle_save(route):
            body = route.request.post_data_json
            updated = deepcopy(RADAR)
            updated["revision"] = UUID
            updated["changeNote"] = body["changeNote"]
            updated["blips"] = body["radar"]["blips"]
            updated["sources"] = body["radar"]["sources"]
            route.fulfill(status=200, json={"ok": True, "radar": updated, "commit": {"sha": "late123"}})

        self.page.route("**/api/v1/radar", handle_save)
        self.load()
        self.login_admin()
        self.page.locator("#proposalFileInput").set_input_files({
            "name": "delayed-proposals.json",
            "mimeType": "application/json",
            "buffer": json.dumps(proposal_payload).encode("utf-8"),
        })
        self.page.locator("#addBlipButton").click()
        self.page.locator("#saveVersionButton").click()
        self.page.locator("#changeNoteInput").fill("Publicação com importação concorrente")
        self.page.locator("#saveConfirmButton").click()

        self.page.evaluate("window.__releaseImport()")
        expect(self.page.locator("#reviewDialog")).to_be_visible()
        self.page.locator('#reviewList input[type="checkbox"]').check()
        self.page.locator("#applyProposalsButton").click()
        expect(self.page.locator("#totalBlips")).to_have_text(str(len(RADAR["blips"]) + 2))

        self.page.evaluate("window.__releaseSaveAfterImport()")
        expect(self.page.locator("#saveSuccessBox")).to_be_visible()
        expect(self.page.locator("#saveSuccessMessage")).to_contain_text("continuam no rascunho")
        expect(self.page.locator("#matrixBody")).to_contain_text("Importada durante publicação")
        expect(self.page.locator("#draftIndicator")).to_be_visible()

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
            {
                "action": "update",
                "targetId": first["id"],
                "reason": "Evidência malformada",
                "confidence": 0.5,
                "evidence": [None],
                "blip": {**proposed, "name": "Inválida"},
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
        self.assertEqual(checkboxes.count(), 3)
        self.assertFalse(checkboxes.nth(0).is_checked())
        self.assertFalse(checkboxes.nth(1).is_checked())
        self.assertTrue(checkboxes.nth(2).is_disabled())
        expect(self.page.locator("#applyProposalsButton")).to_be_disabled()

        checkboxes.nth(0).check()
        self.page.locator("#applyProposalsButton").click()
        expect(self.page.locator("#reviewDialog")).to_be_hidden()
        expect(self.page.locator("#totalBlips")).to_have_text(str(len(RADAR["blips"])))
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
        expect(self.page.locator("#totalBlips")).to_have_text(str(len(RADAR["blips"])))

    def test_manual_ids_discard_draft_and_mobile_keyboard(self):
        self.mock_admin_auth()
        radar = deepcopy(RADAR)
        radar["blips"][0]["id"] = UUID
        self.load(radar)
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
        expect(self.page.locator("#totalBlips")).to_have_text(str(len(radar["blips"])))
        expect(self.page.locator("#draftIndicator")).to_be_hidden()

        self.page.set_viewport_size({"width": 390, "height": 844})
        blip_button = self.page.locator("#radarSvg g.blip").nth(1)
        blip_button.focus()
        self.page.keyboard.press("Enter")
        expect(self.page.locator("#selectedBlipLabel")).to_contain_text("ES-02")


if __name__ == "__main__":
    main(verbosity=2)
