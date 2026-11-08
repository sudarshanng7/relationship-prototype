"""Read-only ROS-03C source inventory. No database/execution mode exists.

Exit 0 verifies the reviewed local sources only. Database acceptance always
remains NOT_EXECUTED; required runtime gaps are reported even on static success.
"""
import argparse
import ast
import hashlib
import json
from pathlib import Path
import re
import sys


# Pinned source-derived mapping: changing JSON alone cannot reclassify an old
# negative control or relax a runner's schema stage. Review both files together.
# (filename stem, required stages, classification)
CONTRACTS = {
    "f3-sequential": ("ros03c-finding3-regression.sql", [22], "historical-positive-regression"),
    "f4-sequential": ("ros03c-finding4-regression.sql", [23, 29], "final-stage-compatible"),
    "f4-concurrency": ("ros03c-finding4-concurrency.py", [23, 29], "final-stage-compatible"),
    "f5-sequential": ("ros03c-finding5-regression.sql", [24, 29], "final-stage-compatible"),
    "f5-concurrency": ("ros03c-finding5-concurrency.py", [24, 29], "final-stage-compatible"),
    "f8-policy-sequential": ("ros03c-finding8-regression.sql", [25], "historical-positive-regression"),
    "f8-fence-sequential": ("ros03c-finding8-fence-regression.sql", [26, 29], "final-stage-compatible"),
    "f8-fence-concurrency": ("ros03c-finding8-fence-concurrency.py", [26, 29], "final-stage-compatible"),
    "f9-sequential": ("ros03c-finding9-regression.sql", [27, 29], "final-stage-compatible"),
    "f9-concurrency": ("ros03c-finding9-concurrency.py", [27], "requires-final-stage-adaptation"),
    "f9-predecessor-control": ("ros03c-finding9-concurrency.py", [26], "historical-predecessor-negative-control"),
    "f11-sequential": ("ros03c-finding11-regression.sql", [28, 29], "final-stage-compatible"),
    "f11-concurrency": ("ros03c-finding11-concurrency.py", [28], "requires-final-stage-adaptation"),
    "a01-sequential": ("ros03c-a01-guarded-writes-regression.sql", [29], "final-stage-compatible"),
    "a01-concurrency": ("ros03c-a01-guarded-writes-concurrency.py", [29], "final-stage-compatible"),
    "stage29-sequential": ("ros03c-stage29-regression.sql", [29], "final-stage-compatible"),
    "stage29-f9-concurrency": ("ros03c-stage29-finding9-concurrency.py", [29], "final-stage-compatible"),
    "stage29-f11-concurrency": ("ros03c-stage29-finding11-concurrency.py", [29], "final-stage-compatible"),
}
STAGE_ENDS = {
    22: "20261104100000", 23: "20261104120000", 24: "20261105100000",
    25: "20261106120000", 26: "20261106160000", 27: "20261108120000",
    28: "20261108160000", 29: "20261108180000",
}
FINAL_LAUNCH = ["stage29-sequential", "f4-concurrency", "f5-concurrency",
                "f8-fence-concurrency", "stage29-f9-concurrency",
                "stage29-f11-concurrency", "a01-concurrency"]
SEQUENTIAL_PAYLOADS = ["a01-sequential", "f4-sequential", "f5-sequential",
                       "f8-fence-sequential", "f9-sequential", "f11-sequential"]
REQUIRED_GAPS = {
    "runtime-evidence", "full-catalog-authorization", "historical-data-replay",
    "http-and-live-sessions", "compound-transactions-and-maintenance", "product-policy",
}
MANIFEST = "tests/sql/ros03c-acceptance-manifest.json"
A01_MANIFEST_SHA256 = "f0307c87be337ac61d6c822d90b365c386533e9b4f3c3e119bcce9c0c77d6d36"


class InventoryError(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise InventoryError(message)


def read_local(root, name):
    path = root / name
    require(not Path(name).is_absolute() and ".." not in Path(name).parts,
            "Manifest path must be repository-relative")
    require(path.resolve().is_relative_to(root.resolve()) and not path.is_symlink(),
            "Source must stay inside repository: " + name)
    require(path.is_file(), "Missing source: " + name)
    return path.read_bytes()


def digest(data):
    return hashlib.sha256(data).hexdigest()


def inspect(root, manifest=None, stage=29):
    """Only read/hash/parse files; never import SQL runner modules."""
    root = Path(root)
    require(stage in STAGE_ENDS, "Unknown reviewed stage")
    if manifest is None:
        manifest = json.loads(read_local(root, MANIFEST))
    require(manifest.get("schema_version") == 1, "Unknown manifest schema")
    require(manifest.get("mode") == "static-only", "Execution mode is prohibited")
    require(manifest.get("database_acceptance") == "NOT_EXECUTED", "Source inventory cannot assert a database pass")
    profiles = manifest.get("profiles", {})
    require(set(profiles) == set(CONTRACTS), "Missing or unexpected test profiles")
    for key, (filename, stages, classification) in CONTRACTS.items():
        spec = profiles[key]
        require(spec.get("path") == "tests/sql/" + filename and spec.get("stages") == stages
                and spec.get("classification") == classification, "Incorrect test-stage mapping: " + key)
        require(spec.get("execution") == "NOT_EXECUTED", "Unexecuted test cannot pass: " + key)
        for field in ("purpose", "preconditions", "fixtures_cleanup", "reason", "final_equivalent", "oracle_limits"):
            require(isinstance(spec.get(field), str) and bool(spec[field]), "Missing inventory explanation: " + key + "/" + field)
    require(manifest.get("final_launch_profiles") == FINAL_LAUNCH, "Final run plan mismatch")
    require(manifest.get("sequential_payloads") == SEQUENTIAL_PAYLOADS, "Sequential payload plan mismatch")
    gaps = manifest.get("gaps", {})
    require(set(gaps) == REQUIRED_GAPS, "Final-stage acceptance gaps must be explicit")
    for key, gap in gaps.items():
        require(gap.get("classification") == "missing-validation-coverage"
                and gap.get("status") == "BLOCKED" and bool(gap.get("required_evidence")),
                "Unresolved gap cannot be silently accepted: " + key)

    resources = manifest.get("resources", {})
    actual_resources = {str(p.relative_to(root)) for p in (root / "tests/sql").rglob("*")
                        if p.is_file() and p.suffix in (".sql", ".py", ".json")
                        and str(p.relative_to(root)) != MANIFEST}
    require(set(resources) == actual_resources, "Missing or unexpected SQL test/support files")
    for name, sha256 in resources.items():
        data = read_local(root, name)
        require(digest(data) == sha256, "Modified test/support source: " + name)
        if name.endswith(".py"):
            ast.parse(data, filename=name)  # Parse only, never import/execute.
    require({spec["path"] for spec in profiles.values()} <= set(resources), "Test file absent from source inventory")

    a01_source = read_local(root, "tests/sql/ros03c-a01-guarded-writes-manifest.json")
    require(digest(a01_source) == A01_MANIFEST_SHA256, "Reviewed A01 source contract changed")
    a01 = json.loads(a01_source)
    migrations = manifest.get("migrations", [])
    expected_names = sorted(a01["migration_sha256"])
    entries = list((root / "supabase/migrations").iterdir())
    require(all(p.is_file() and p.suffix == ".sql" for p in entries), "Unexpected migration directory entry")
    actual_names = sorted(p.name for p in entries)
    require(len(migrations) == 29 and [spec["file"] for spec in migrations] == expected_names == actual_names,
            "Missing, additional or reordered migrations")
    require([spec["version"] for spec in migrations] == a01["versions"] and len(set(a01["versions"])) == 29,
            "Exact 29-stage A01 ledger differs")
    for spec in migrations:
        require(spec["file"].startswith(spec["version"] + "_") and spec["sha256"] == a01["migration_sha256"][spec["file"]],
                "Migration manifest differs from A01 contract")
        require(digest(read_local(root, "supabase/migrations/" + spec["file"])) == spec["sha256"],
                "Modified migration: " + spec["file"])
    require(set(manifest.get("stages", {})) == {str(n) for n in STAGE_ENDS}, "Stage inventory mismatch")
    for number, tail in STAGE_ENDS.items():
        spec = manifest["stages"][str(number)]
        require(spec.get("versions") == a01["versions"][:number] and spec["versions"][-1] == tail,
                "Stage versions/order mismatch: " + str(number))

    # Check known, fixed dollar-quoted function bodies against the reviewed A01
    # fingerprints. This is a source check, not a general SQL parser/catalog audit.
    for signature, spec in a01["functions"].items():
        source = read_local(root, "supabase/migrations/" + spec["file"]).decode()
        name = signature.split("(")[0]
        pattern = r"^CREATE(?: OR REPLACE)? FUNCTION\s+" + re.escape(name) + r"\s*\(.*?\bAS\s+(\$\w*\$)(.*?)\1;"
        matches = list(re.finditer(pattern, source, re.M | re.S))
        require(len(matches) == 1 and digest(matches[0].group(2).encode()) == spec["body_hash"],
                "Known function-body fingerprint mismatch: " + signature)

    wrapper = read_local(root, "tests/sql/ros03c-stage29-regression.sql").decode()
    expected_includes = []
    for key in SEQUENTIAL_PAYLOADS:
        expected_includes.extend(["ros03c-stage29-preflight.sql", Path(profiles[key]["path"]).name])
    require(re.findall(r"^\\ir ([^\n]+)$", wrapper, re.M) == expected_includes,
            "Stage-29 sequential payload source differs from plan")
    included = [key for key, spec in profiles.items() if stage in spec["stages"]]
    return {
        "mode": "static-only", "stage": stage, "source_inventory": "VERIFIED",
        "database_acceptance": "NOT_EXECUTED", "release_acceptance": "BLOCKED",
        "migration_versions": manifest["stages"][str(stage)]["versions"],
        "required_tests": [{"id": key, **profiles[key]} for key in included],
        "final_launch_profiles": FINAL_LAUNCH if stage == 29 else [],
        "sequential_payloads": SEQUENTIAL_PAYLOADS if stage == 29 else [],
        "historical_negative_controls": [{"id": "f9-predecessor-control", **profiles["f9-predecessor-control"]}],
        "gaps": gaps,
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--stage", type=int, choices=sorted(STAGE_ENDS), default=29,
                        help="Display this reviewed stage; still static/read-only (default: 29)")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args(argv)
    try:
        report = inspect(Path(__file__).resolve().parents[1], stage=args.stage)
    except (InventoryError, OSError, ValueError, KeyError, TypeError, SyntaxError) as error:
        print("Source inventory REJECTED: " + str(error), file=sys.stderr)
        return 1
    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print(f"Static source inventory VERIFIED. Stage {args.stage}: " + ", ".join(report["migration_versions"]))
        print("Database acceptance NOT_EXECUTED. Release acceptance BLOCKED.")
        for spec in report["required_tests"]:
            print(f"REQUIRED {spec['id']}: {spec['path']} | stages={spec['stages']} | {spec['classification']} | NOT_EXECUTED")
        print("Historical predecessor control: f9-predecessor-control, stage 26 ONLY; never final acceptance.")
        for key, gap in report["gaps"].items():
            print(f"GAP {key}: BLOCKED — {gap['required_evidence']}")
        print("No database, network, runtime or subprocess action was performed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
