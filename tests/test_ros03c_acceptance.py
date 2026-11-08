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
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="ros03c-static-fixture-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        shutil.copytree(ROOT / "tests/sql", self.root / "tests/sql")
        shutil.copytree(ROOT / "supabase/migrations", self.root / "supabase/migrations")
        self.manifest = json.loads((self.root / inventory.MANIFEST).read_text())

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

    def test_known_26_27_28_29_stage_definitions(self):
        for stage, tail in [(26, "20261106160000"), (27, "20261108120000"), (28, "20261108160000"), (29, "20261108180000")]:
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
        self.assertIn("NOT_EXECUTED", output.getvalue())
        self.assertIn("GAP historical-data-replay: BLOCKED", output.getvalue())

    def test_default_cli_json_stays_static_and_uses_final_stage(self):
        with redirect_stdout(io.StringIO()) as output:
            self.assertEqual(inventory.main(["--json"]), 0)
        report = json.loads(output.getvalue())
        self.assertEqual(report["stage"], 29)
        self.assertEqual(report["mode"], "static-only")
        self.assertEqual(report["database_acceptance"], "NOT_EXECUTED")

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


if __name__ == "__main__":
    unittest.main()
