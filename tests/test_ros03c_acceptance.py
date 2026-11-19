"""Offline source-only tests. Never import/execute a SQL or concurrency runner."""
import ast
from contextlib import redirect_stderr, redirect_stdout
import copy
import importlib.util
import io
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("ros03c_static_inventory", ROOT / "scripts/ros03c_acceptance.py")
inventory = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(inventory)


class AcceptanceInventoryTests(unittest.TestCase):
    SOURCE_COUNT = 29

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="ros03c-static-fixture-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        shutil.copytree(ROOT / "tests/sql", self.root / "tests/sql")
        self.manifest = json.loads((self.root / inventory.MANIFEST).read_text())
        # Historical fixtures select the exact reviewed list; real-repository CLI
        # checks below still inspect every migration and reject unexpected files.
        migrations = self.root / "supabase/migrations"
        migrations.mkdir(parents=True)
        for spec in self.manifest["migrations"]:
            shutil.copyfile(ROOT / "supabase/migrations" / spec["file"], migrations / spec["file"])
        if self.SOURCE_COUNT == 30:
            shutil.copyfile(ROOT / "supabase/migrations" / inventory.MIGRATION30, migrations / inventory.MIGRATION30)
            path = self.root / inventory.SOURCE30_MANIFEST
            path.parent.mkdir(parents=True)
            shutil.copyfile(ROOT / inventory.SOURCE30_MANIFEST, path)

    def reject(self, manifest=None):
        with self.assertRaises(inventory.InventoryError):
            inventory.inspect(self.root, manifest if manifest is not None else self.manifest)

    def test_current_29_migrations_exact_order_and_final_plan(self):
        report = inventory.inspect(self.root)
        self.assertEqual(len(report["migration_versions"]), 29)
        self.assertEqual(report["migration_versions"][-1], "20261108180000")
        self.assertEqual(report["migration_versions"], sorted(set(report["migration_versions"])))
        self.assertEqual(report["final_launch_profiles"], inventory.FINAL_LAUNCH)
        self.assertEqual(report["sequential_payloads"], inventory.SEQUENTIAL_PAYLOADS)
        self.assertEqual(report["source_migration_count"], self.SOURCE_COUNT)
        self.assertEqual(len(report["source_migration_versions"]), self.SOURCE_COUNT)
        self.assertEqual(report["planned_database_stage"], 29)
        self.assertEqual(report["database_deployment"], "NOT_VERIFIED")

    def test_known_26_27_28_29_stage_definitions(self):
        for stage, tail in inventory.STAGE_ENDS.items():
            with self.subTest(stage=stage):
                report = inventory.inspect(self.root, stage=stage)
                self.assertEqual(len(report["migration_versions"]), stage)
                self.assertEqual(report["migration_versions"][-1], tail)
                for spec in report["required_tests"]:
                    self.assertIn(stage, spec["stages"])
                    self.assertEqual(spec["execution"], "NOT_EXECUTED")

    def test_missing_migration(self):
        (self.root / "supabase/migrations" / self.manifest["migrations"][0]["file"]).unlink()
        self.reject()

    def test_modified_migration(self):
        path = self.root / "supabase/migrations" / self.manifest["migrations"][0]["file"]
        path.write_bytes(path.read_bytes() + b"\n-- mutation\n")
        self.reject()

    def test_unexpected_migration(self):
        (self.root / "supabase/migrations/20990101000000_unreviewed.sql").write_text("SELECT 1;\n")
        self.reject()

    def test_unexpected_nested_migration(self):
        path = self.root / "supabase/migrations/unreviewed"
        path.mkdir()
        (path / "migration.sql").write_text("SELECT 1;\n")
        self.reject()

    def test_reordered_manifest_migrations(self):
        self.manifest["migrations"][0:2] = reversed(self.manifest["migrations"][0:2])
        self.reject()

    def test_modified_expected_migration_hash(self):
        self.manifest["migrations"][0]["sha256"] = "0" * 64
        self.reject()

    def test_stage_prefix_order_mismatch(self):
        self.manifest["stages"]["29"]["versions"].reverse()
        self.reject()

    def test_missing_sql_payload(self):
        (self.root / "tests/sql/ros03c-finding9-regression.sql").unlink()
        self.reject()

    def test_modified_sql_payload(self):
        (self.root / "tests/sql/ros03c-finding9-regression.sql").write_text("-- no assertions\n")
        self.reject()

    def test_missing_concurrency_runner(self):
        (self.root / "tests/sql/ros03c-stage29-finding9-concurrency.py").unlink()
        self.reject()

    def test_extra_sql_test(self):
        (self.root / "tests/sql/unreviewed.sql").write_text("SELECT 1;\n")
        self.reject()

    def test_incorrect_test_stage_mapping(self):
        self.manifest["profiles"]["f9-concurrency"]["stages"] = [29]
        self.reject()

    def test_missing_profile(self):
        del self.manifest["profiles"]["f5-concurrency"]
        self.reject()

    def test_negative_control_cannot_be_reclassified_as_final_positive(self):
        spec = self.manifest["profiles"]["f9-predecessor-control"]
        spec.update(stages=[29], classification="final-stage-compatible")
        self.reject()

    def test_historical_negative_control_is_excluded_from_final_requirements(self):
        report = inventory.inspect(self.root)
        self.assertNotIn("f9-predecessor-control", [spec["id"] for spec in report["required_tests"]])
        self.assertEqual(report["historical_negative_controls"][0]["stages"], [26])
        self.assertNotIn("f11-concurrency", report["final_launch_profiles"])
        self.assertIn("stage29-f11-concurrency", report["final_launch_profiles"])

    def test_missing_gap_rejected(self):
        del self.manifest["gaps"]["historical-data-replay"]
        self.reject()

    def test_gap_cannot_be_silently_marked_passed(self):
        self.manifest["gaps"]["runtime-evidence"]["status"] = "PASSED"
        self.reject()

    def test_unexecuted_test_cannot_pass(self):
        self.manifest["profiles"]["a01-sequential"]["execution"] = "PASSED"
        self.reject()

    def test_source_manifest_cannot_assert_database_pass(self):
        self.manifest["database_acceptance"] = "PASSED"
        self.reject()

    def test_execution_mode_is_rejected(self):
        self.manifest["mode"] = "execute"
        self.reject()

    def test_missing_acceptance_plan_entry_is_rejected(self):
        self.manifest["final_launch_profiles"].remove("stage29-f9-concurrency")
        self.reject()

    def test_a01_source_contract_cannot_be_rewritten_even_with_updated_resource_hash(self):
        path = self.root / "tests/sql/ros03c-a01-guarded-writes-manifest.json"
        data = json.loads(path.read_text()); data["versions"].pop()
        path.write_text(json.dumps(data))
        self.manifest["resources"][str(path.relative_to(self.root))] = inventory.digest(path.read_bytes())
        self.reject()

    def test_no_database_pass_and_all_gaps_reported(self):
        report = inventory.inspect(self.root)
        self.assertEqual(report["database_acceptance"], "NOT_EXECUTED")
        self.assertEqual(report["release_acceptance"], "BLOCKED")
        self.assertEqual(set(report["gaps"]), inventory.REQUIRED_GAPS)
        self.assertTrue(all(spec["execution"] == "NOT_EXECUTED" for spec in report["required_tests"]))

    def test_static_inspection_never_imports_or_executes_runner_source(self):
        # A conspicuous side effect remains inert even if its bytes were reviewed.
        name = "tests/sql/ros03c-finding4-concurrency.py"
        path = self.root / name
        path.write_text(path.read_text() + '\nraise RuntimeError("RUNNER EXECUTED")\n')
        self.manifest["resources"][name] = inventory.digest(path.read_bytes())
        report = inventory.inspect(self.root, self.manifest)
        self.assertEqual(report["database_acceptance"], "NOT_EXECUTED")
        self.assertNotIn("ros03c_stage29_contract", sys.modules)

    def test_default_main_is_read_only_and_has_no_network_or_subprocess_actions(self):
        forbidden = AssertionError("Forbidden runtime/network/write action")
        import socket
        import subprocess
        import urllib.request
        with patch.object(socket, "socket", side_effect=forbidden), \
             patch.object(socket, "create_connection", side_effect=forbidden), \
             patch.object(subprocess, "run", side_effect=forbidden), \
             patch.object(subprocess, "Popen", side_effect=forbidden), \
             patch.object(urllib.request, "urlopen", side_effect=forbidden), \
             patch.object(Path, "write_bytes", side_effect=forbidden), \
             patch.object(Path, "write_text", side_effect=forbidden), \
             patch.object(Path, "mkdir", side_effect=forbidden), \
             redirect_stdout(io.StringIO()) as output:
            self.assertEqual(inventory.main([]), 0)
            self.assertEqual(inventory.inspect(self.root)["source_migration_count"], self.SOURCE_COUNT)
        self.assertIn("Static source verification does not prove database deployment.", output.getvalue())
        self.assertIn("NOT_EXECUTED", output.getvalue())
        self.assertIn("GAP historical-data-replay: BLOCKED", output.getvalue())

    def test_default_cli_json_stays_static_and_uses_final_stage(self):
        with redirect_stdout(io.StringIO()) as output:
            self.assertEqual(inventory.main(["--json"]), 0)
        report = json.loads(output.getvalue())
        self.assertEqual(report["stage"], 29)
        self.assertEqual(report["mode"], "static-only")
        self.assertEqual(report["database_acceptance"], "NOT_EXECUTED")
        self.assertEqual(report["source_migration_count"], 30)
        self.assertEqual(report["source_migration_versions"][-1], "20261116190000")
        self.assertEqual(report["planned_database_stage"], 29)
        self.assertEqual(report["database_deployment"], "NOT_VERIFIED")

    def test_cli_accepts_no_execution_or_database_target_option(self):
        for args in (["--execute"], ["--database", "original"], ["--stage", "30"]):
            with self.subTest(args=args), redirect_stderr(io.StringIO()):
                with self.assertRaises(SystemExit) as raised:
                    inventory.main(args)
                self.assertEqual(raised.exception.code, 2)

    def test_entrypoint_imports_only_expected_standard_library(self):
        source = (ROOT / "scripts/ros03c_acceptance.py").read_text()
        tree = ast.parse(source)
        modules = {node.names[0].name if isinstance(node, ast.Import) else node.module
                   for node in ast.walk(tree) if isinstance(node, (ast.Import, ast.ImportFrom))}
        self.assertLessEqual(modules, {"argparse", "ast", "hashlib", "json", "pathlib", "re", "sys"})
        self.assertFalse(any(isinstance(node, ast.Call) and isinstance(node.func, ast.Name)
                             and node.func.id in {"eval", "exec", "compile", "__import__"} for node in ast.walk(tree)))

    def test_stage29_preflight_preserves_all_a01_metadata_assertions(self):
        original = (ROOT / "tests/sql/ros03c-a01-guarded-writes-regression.sql").read_text()
        expected = original[original.index("\\set ON_ERROR_STOP on"):original.index("\nDO $empty$")]
        expected = expected.replace("a01_candidate_authorized", "stage29_disposable_authorized")
        actual = (ROOT / "tests/sql/ros03c-stage29-preflight.sql").read_text()
        self.assertIn(expected, actual)
        self.assertTrue(actual.rstrip().endswith("ROLLBACK;"))

    def test_stage29_copies_preserve_historical_behavior_bodies(self):
        for finding in (9, 11):
            with self.subTest(finding=finding):
                source = (ROOT / f"tests/sql/ros03c-finding{finding}-concurrency.py").read_text()
                source = source[source.index('"""', 3) + 3:]
                source = source.replace("import argparse\n", "import argparse\nfrom ros03c_stage29_contract import require_stage29\n", 1)
                source = source.replace('    parser.add_argument("--approved-disposable", action="store_true")', '    parser.add_argument("--stage", type=int, choices=[29], required=True)\n    parser.add_argument("--approved-disposable", action="store_true")', 1)
                if finding == 9:
                    start = source.index('    parser.add_argument("--negative-control"')
                    end = source.index("    args = parser.parse_args()", start)
                    source = source[:start] + source[end:]
                start = source.index('    if sql("SELECT count(*) FROM supabase_migrations.schema_migrations ')
                end = source.index("    tables = ", start)
                source = source[:start] + "    require_stage29(sql)\n" + source[end:]
                if finding == 9:
                    start = source.index("        if not args.negative_control:\n")
                    end = source.index("        # Real lock-based discriminator", start)
                    body = source[start:end].splitlines(keepends=True)[1:]
                    source = source[:start] + "".join(line[4:] if line.startswith("    ") else line for line in body) + source[end:]
                    source = source.replace('code = "55P03" if args.negative_control else "P0001"', 'code = "P0001"')
                    source = source.replace('message = "canceling statement due to lock timeout" if args.negative_control else availability(operation)', 'message = availability(operation)')
                    source = source.replace('print("PASS: " + ("negative control observed predecessor lock disclosure" if args.negative_control else "locked inaccessible/missing availability equivalence"))', 'print("PASS: locked inaccessible/missing availability equivalence")')
                actual = (ROOT / f"tests/sql/ros03c-stage29-finding{finding}-concurrency.py").read_text()
                self.assertEqual(source, actual[actual.index('"""', 3) + 3:])


class Stage30AcceptanceInventoryTests(AcceptanceInventoryTests):
    # Re-run every historical security/resource/plan assertion on reviewed source
    # 30 as well. The database stage and all SQL resources remain historical.
    SOURCE_COUNT = 30

    def source_manifest(self):
        path = self.root / inventory.SOURCE30_MANIFEST
        return path, json.loads(path.read_text())

    def test_missing_migration30_cannot_downgrade_inventory(self):
        (self.root / "supabase/migrations" / inventory.MIGRATION30).unlink()
        with self.assertRaisesRegex(inventory.InventoryError, "Missing, additional or reordered migrations"):
            inventory.inspect(self.root)

    def test_missing_stage30_manifest(self):
        (self.root / inventory.SOURCE30_MANIFEST).unlink()
        with self.assertRaisesRegex(inventory.InventoryError, "Missing source"):
            inventory.inspect(self.root)

    def test_modified_migration30(self):
        path = self.root / "supabase/migrations" / inventory.MIGRATION30
        path.write_bytes(path.read_bytes() + b"\n-- mutation\n")
        with self.assertRaisesRegex(inventory.InventoryError, "Modified migration"):
            inventory.inspect(self.root)

    def test_renamed_migration30(self):
        path = self.root / "supabase/migrations" / inventory.MIGRATION30
        path.rename(path.with_name("20261116190000_unreviewed.sql"))
        self.reject()

    def test_migration31_rejected(self):
        (self.root / "supabase/migrations/20261117190000_unreviewed.sql").write_text("SELECT 1;\n")
        self.reject()

    def test_modified_stage30_manifest_metadata(self):
        path, data = self.source_manifest()
        data["scope"] = "unreviewed"
        path.write_text(json.dumps(data))
        with self.assertRaisesRegex(inventory.InventoryError, "Reviewed stage-30 source manifest changed"):
            inventory.inspect(self.root)

    def test_reordered_stage30_manifest(self):
        path, data = self.source_manifest()
        data["migrations"][0:2] = reversed(data["migrations"][0:2])
        path.write_text(json.dumps(data))
        self.reject()

    def test_coordinated_migration30_and_manifest_hash_changes_rejected(self):
        path = self.root / "supabase/migrations" / inventory.MIGRATION30
        path.write_bytes(path.read_bytes() + b"\n-- coordinated mutation\n")
        manifest_path, data = self.source_manifest()
        changed = inventory.digest(path.read_bytes())
        data["migrations"][-1].update(sha256=changed, bytes=path.stat().st_size)
        data["approved_migration30"]["sha256"] = changed
        manifest_path.write_text(json.dumps(data))
        with self.assertRaisesRegex(inventory.InventoryError, "Reviewed stage-30 source manifest changed"):
            inventory.inspect(self.root)

    def test_coordinated_historical_migration_and_manifests_rejected(self):
        name = self.manifest["migrations"][0]["file"]
        path = self.root / "supabase/migrations" / name
        path.write_bytes(path.read_bytes() + b"\n-- coordinated predecessor mutation\n")
        changed = inventory.digest(path.read_bytes())
        self.manifest["migrations"][0]["sha256"] = changed
        (self.root / inventory.MANIFEST).write_text(json.dumps(self.manifest))
        manifest_path, data = self.source_manifest()
        data["migrations"][0].update(sha256=changed, bytes=path.stat().st_size)
        data["predecessor_manifest_sha256"][inventory.MANIFEST] = inventory.digest(
            (self.root / inventory.MANIFEST).read_bytes())
        manifest_path.write_text(json.dumps(data))
        self.reject()

    def test_new_source_anchor_cannot_rewrite_historical_prefix(self):
        path, data = self.source_manifest()
        data["migrations"][0]["sha256"] = "0" * 64
        path.write_text(json.dumps(data))
        with patch.object(inventory, "SOURCE30_MANIFEST_SHA256", inventory.digest(path.read_bytes())):
            with self.assertRaisesRegex(inventory.InventoryError, "prefix differs from trusted historical inventory"):
                inventory.inspect(self.root)

    def test_new_source_anchor_cannot_reorder_migrations(self):
        path, data = self.source_manifest()
        data["migrations"][-1]["order"] = 29
        path.write_text(json.dumps(data))
        with patch.object(inventory, "SOURCE30_MANIFEST_SHA256", inventory.digest(path.read_bytes())):
            with self.assertRaisesRegex(inventory.InventoryError, "filenames, versions or order differ"):
                inventory.inspect(self.root)

    def test_new_source_anchor_cannot_change_migration_version(self):
        path, data = self.source_manifest()
        data["migrations"][-1]["version"] = "20261117190000"
        path.write_text(json.dumps(data))
        with patch.object(inventory, "SOURCE30_MANIFEST_SHA256", inventory.digest(path.read_bytes())):
            with self.assertRaisesRegex(inventory.InventoryError, "filenames, versions or order differ"):
                inventory.inspect(self.root)

    def test_symlinked_migration30_rejected(self):
        path = self.root / "supabase/migrations" / inventory.MIGRATION30
        target = self.root / "migration30-copy.sql"
        path.rename(target)
        path.symlink_to(target)
        with self.assertRaisesRegex(inventory.InventoryError, "Source must stay inside repository"):
            inventory.inspect(self.root)

    def test_symlinked_source_manifest_rejected(self):
        path = self.root / inventory.SOURCE30_MANIFEST
        target = self.root / "source30-copy.json"
        path.rename(target)
        path.symlink_to(target)
        with self.assertRaisesRegex(inventory.InventoryError, "Source must stay inside repository"):
            inventory.inspect(self.root)

    def test_source30_does_not_enable_database_stage30(self):
        with self.assertRaisesRegex(inventory.InventoryError, "Unknown reviewed stage"):
            inventory.inspect(self.root, stage=30)

    def test_source30_preserves_every_historical_stage_plan(self):
        historical = inventory.inspect(self.root)
        (self.root / "supabase/migrations" / inventory.MIGRATION30).unlink()
        (self.root / inventory.SOURCE30_MANIFEST).unlink()
        for stage in inventory.STAGE_ENDS:
            with self.subTest(stage=stage):
                old = inventory.inspect(self.root, stage=stage)
                self.assertEqual(old["source_migration_count"], 29)
                # Source metadata alone may differ; every database-stage field
                # is compared against the same reviewed source-30 plan.
                current = inventory.inspect(ROOT, stage=stage)
                for key in old.keys() - {"source_migration_count", "source_migration_versions"}:
                    self.assertEqual(old[key], current[key])
        self.assertEqual(historical["source_migration_count"], 30)


if __name__ == "__main__":
    unittest.main()
