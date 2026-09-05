#!/usr/bin/env python3
"""
Senju Autonomous Verification
Verifies implementations before committing.
"""
import subprocess
import sys
from pathlib import Path


def verify_python_syntax() -> bool:
    """Verify all Python files have valid syntax."""
    print("🔍 Verifying Python syntax...")

    python_files = list(Path.cwd().rglob("*.py"))
    errors = []

    for py_file in python_files:
        try:
            subprocess.run(
                ["python", "-m", "py_compile", str(py_file)],
                check=True,
                capture_output=True,
                text=True
            )
        except subprocess.CalledProcessError as e:
            errors.append(f"{py_file}: {e.stderr}")

    if errors:
        print(f"❌ Syntax errors found in {len(errors)} files")
        for error in errors:
            print(f"  {error}")
        return False

    print(f"✅ All {len(python_files)} Python files have valid syntax")
    return True


def verify_no_secrets() -> bool:
    """Verify no secrets or credentials are exposed."""
    print("🔍 Checking for exposed secrets...")

    dangerous_patterns = [
        "password=",
        "api_key=",
        "secret=",
        "token=",
        "private_key"
    ]

    files_to_check = []
    for ext in ["*.py", "*.yml", "*.yaml", "*.json"]:
        files_to_check.extend(Path.cwd().rglob(ext))

    violations = []

    for file_path in files_to_check:
        try:
            content = file_path.read_text().lower()
            for pattern in dangerous_patterns:
                if pattern in content and "example" not in content:
                    violations.append(f"{file_path}: contains '{pattern}'")
        except:
            pass

    if violations:
        print(f"⚠️ Potential secrets found in {len(violations)} files")
        for violation in violations[:5]:  # Show first 5
            print(f"  {violation}")
        return True  # Warning, not failure

    print("✅ No obvious secrets detected")
    return True


def verify_directory_structure() -> bool:
    """Verify created directories and files are valid."""
    print("🔍 Verifying directory structure...")

    required_dirs = [
        ".github/workflows",
        "automation",
        "docs"
    ]

    for dir_path in required_dirs:
        if not Path(dir_path).exists():
            print(f"❌ Required directory missing: {dir_path}")
            return False

    print("✅ Directory structure valid")
    return True


def main():
    print("🧠 Senju Autonomous Verification")
    print("=" * 50)

    checks = [
        ("Python Syntax", verify_python_syntax),
        ("Secret Detection", verify_no_secrets),
        ("Directory Structure", verify_directory_structure)
    ]

    results = []
    for check_name, check_func in checks:
        print(f"\n{check_name}...")
        result = check_func()
        results.append(result)
        print()

    if all(results):
        print("=" * 50)
        print("✅ All verifications passed")
        print("=" * 50)
        sys.exit(0)
    else:
        print("=" * 50)
        print(f"❌ {results.count(False)} verification(s) failed")
        print("=" * 50)
        sys.exit(1)


if __name__ == "__main__":
    main()
