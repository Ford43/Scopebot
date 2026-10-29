"""Initialize native Arrow before API dependencies on Windows."""
import ast
from pathlib import Path
import unittest
from unittest.mock import patch

class NativeRuntimeTests(unittest.TestCase):
    def test_windows_initializes_installed_arrow(self):
        from api.native_runtime import prepare_native_runtime
        with patch("api.native_runtime.sys.platform", "win32"), patch("api.native_runtime.find_spec", return_value=object()), patch("api.native_runtime.import_module") as load:
            prepare_native_runtime()
        load.assert_called_once_with("pyarrow")

    def test_other_platforms_do_not_need_workaround(self):
        from api.native_runtime import prepare_native_runtime
        with patch("api.native_runtime.sys.platform", "linux"), patch("api.native_runtime.import_module") as load:
            prepare_native_runtime()
        load.assert_not_called()

    def test_absent_optional_arrow_is_not_required(self):
        from api.native_runtime import prepare_native_runtime
        with patch("api.native_runtime.sys.platform", "win32"), patch("api.native_runtime.find_spec", return_value=None), patch("api.native_runtime.import_module") as load:
            prepare_native_runtime()
        load.assert_not_called()

    def test_bootstrap_runs_before_api_imports(self):
        tree=ast.parse((Path(__file__).resolve().parents[1]/"api/main.py").read_text(encoding="utf-8"))
        bootstrap=next((i for i,n in enumerate(tree.body) if isinstance(n,ast.Expr) and isinstance(n.value,ast.Call) and isinstance(n.value.func,ast.Name) and n.value.func.id=="prepare_native_runtime"),None)
        imports=next(i for i,n in enumerate(tree.body) if isinstance(n,ast.ImportFrom) and n.module=="fastapi")
        self.assertIsNotNone(bootstrap)
        self.assertLess(bootstrap,imports)
