"""In-order text alignment used by the verifiers.
missing_in_order(src_words, got_words) -> list of source fragments that could not be matched in order.
Words are aligned first (fast); each gap between aligned words is then aligned character by character, with an exact
longest-common-subsequence when the gap is small and difflib otherwise. Extra text in the output (editorial additions such
as link numbers and page references) is allowed anywhere. A character is reported missing only if no in-order match
exists for it within its gap, so the result can over-report, never under-report."""
import difflib

def _lcs_missing(a, b):
    n, m = len(a), len(b)
    prev = [0] * (m + 1); rows = [prev]
    for i in range(1, n + 1):
        cur = [0] * (m + 1); ai = a[i - 1]
        for j in range(1, m + 1):
            cur[j] = prev[j - 1] + 1 if ai == b[j - 1] else (prev[j] if prev[j] >= cur[j - 1] else cur[j - 1])
        rows.append(cur); prev = cur
    # walk back: characters of a that are not part of the LCS
    i, j, keep = n, m, [False] * n
    while i > 0 and j > 0:
        if a[i - 1] == b[j - 1] and rows[i][j] == rows[i - 1][j - 1] + 1: keep[i - 1] = True; i -= 1; j -= 1
        elif rows[i - 1][j] >= rows[i][j - 1]: i -= 1
        else: j -= 1
    out, cur = [], ''
    for ch, k in zip(a, keep):
        if k:
            if cur: out.append(cur); cur = ''
        else: cur += ch
    if cur: out.append(cur)
    return out

def _gap_missing(a, b):
    if not b: return [a] if a else []
    if len(a) * len(b) <= 1_500_000: return _lcs_missing(a, b)
    out, pos = [], 0
    for m in difflib.SequenceMatcher(None, a, b, autojunk=False).get_matching_blocks():
        if m.a > pos: out.append(a[pos:m.a])
        pos = m.a + m.size
    return out

def missing_in_order(src, got, anchor=3):
    """Only runs of at least `anchor` matched words are trusted as anchors; shorter word matches (a lone "import"
    matched to the wrong "import") are re-decided by the character alignment of the surrounding gap."""
    sm = difflib.SequenceMatcher(None, src, got, autojunk=False)
    blocks = [b for b in sm.get_matching_blocks() if b.size >= anchor or b.size == 0]
    missing, ai, bj = [], 0, 0
    for blk in blocks:
        if blk.a > ai: missing += _gap_missing(''.join(src[ai:blk.a]), ''.join(got[bj:blk.b]))
        ai = blk.a + blk.size; bj = blk.b + blk.size
    return [m for m in missing if m]
