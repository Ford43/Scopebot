"""Bootstrap native dependencies before importing the Windows API stack.

In the Windows/Python 3.14 environment, importing Arrow for the first time
after the API stack loads reproducibly causes a native access violation.
Loading it before FastAPI/routes avoids that DLL initialization failure.
Arrow remains optional; platforms without this failure keep normal imports.
"""
import sys
from importlib import import_module
from importlib.util import find_spec


def prepare_native_runtime():
    if sys.platform == "win32" and find_spec("pyarrow") is not None:
        import_module("pyarrow")
