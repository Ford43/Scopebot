"""Parse document codes with ASCII boundaries, including next to Thai text."""
import re


# Unicode word boundaries treat Thai letters as part of an ASCII code. Explicit
# boundaries still reject partial codes such as INV-015 inside INV-0150/-A/_x.
_IDENTIFIER = re.compile(r"(?<![A-Za-z0-9_-])[A-Za-z]{2,}(?:-[A-Za-z0-9]+)+(?![A-Za-z0-9_-])")


def extract_identifiers(text: str) -> list[str]:
    """Return unique, case-normalized identifiers in their original order."""
    return list(dict.fromkeys(match.group(0).upper() for match in _IDENTIFIER.finditer(text or "")))
