# Speech audio and batch checks without Node.js

Use when Node.js 22+ is unavailable and the user declines installing it. These
commands print only labels and header numbers, never audio, transcripts, paths
or SAS URLs. The PowerShell lines work in Windows PowerShell 5.1 and PowerShell 7,
including ConstrainedLanguage mode.

## Checks

1. **Size, container and WAV header** (replace `<local-audio>`):

   ```bash
   f="<local-audio>"; if [ ! -r "$f" ]; then echo read_error; else wc -c < "$f"; sig=$(od -An -tx1 -N12 "$f" | tr -d ' \n'); case "$sig" in 52494646????????57415645*) echo wav; od -An -tu2 -j20 -N4 "$f"; od -An -tu4 -j24 -N4 "$f"; od -An -tu2 -j34 -N2 "$f"; od -An -tx1 -j36 -N4 "$f"; od -An -tu4 -j40 -N4 "$f";; 494433*|ff[ef]*) echo mp3;; 664c6143*) echo flac;; 4f676753*) echo ogg;; 1a45dfa3*) echo webm;; ????????66747970*) echo mp4;; *) echo unknown;; esac; fi
   ```

   ```powershell
   $p = "<local-audio>"; if (-not (Test-Path -LiteralPath $p -PathType Leaf)) { 'read_error' } else { (Get-Item -LiteralPath $p).Length; $b = @(if ($PSVersionTable.PSVersion.Major -ge 6) { Get-Content -LiteralPath $p -AsByteStream -TotalCount 44 } else { Get-Content -LiteralPath $p -Encoding Byte -TotalCount 44 }); $h = ($b | Select-Object -First 12 | ForEach-Object { '{0:X2}' -f $_ }) -join ''; switch -Regex ($h) { '^52494646.{8}57415645' { 'wav'; "formatTag=$($b[20] + 256*$b[21]) channels=$($b[22] + 256*$b[23]) sampleRate=$($b[24] + 256*$b[25] + 65536*$b[26] + 16777216*$b[27]) bits=$($b[34] + 256*$b[35]) dataAt36=$($b[36] -eq 100 -and $b[37] -eq 97 -and $b[38] -eq 116 -and $b[39] -eq 97) chunkAt36Bytes=$($b[40] + 256*$b[41] + 65536*$b[42] + 16777216*$b[43])"; break } '^(494433|FF[EF])' { 'mp3'; break } '^664C6143' { 'flac'; break } '^4F676753' { 'ogg'; break } '^1A45DFA3' { 'webm'; break } '^.{8}66747970' { 'mp4'; break } default { 'unknown' } } }
   ```

   - bash prints, after `wav`: format tag and channels, sample rate, bits,
     the 4 bytes at offset 36 (`64 61 74 61` = `data`) and that chunk's size.
   - Format tag `1` = PCM, `3` = IEEE float, `6` = A-law, `7` = mu-law,
     `65534` = extensible (sub-format unknown here). A non-`wav` label on a
     `.wav` file means the extension does not match the content.
   - If offset 36 is not `data` (`dataAt36=False`, often a `LIST` chunk), the data
     size and duration are `unknown`. Otherwise duration ≈ chunk bytes ÷
     (sample rate × channels × bits ÷ 8).

2. **Limits**: compare size with `< 500 MB` (Fast Transcription) or `<= 1 GB`
   (Batch Transcription); compare duration with `< 5 hours` (Fast).

3. **Batch failures**: List Files has no per-file status. Read only the counts
   from the downloaded `TranscriptionReport` file:

   ```bash
   grep -o -E '"(successful|failed)TranscriptionsCount"[[:space:]]*:[[:space:]]*[0-9]+' "<report.json>" || echo read_error_or_not_a_report
   ```

   ```powershell
   $p = "<report.json>"; if (-not (Test-Path -LiteralPath $p -PathType Leaf)) { 'read_error_or_not_a_report' } else { $m = @(Select-String -LiteralPath $p -Pattern '"(successful|failed)TranscriptionsCount"\s*:\s*\d+' -AllMatches | ForEach-Object { $_.Matches } | ForEach-Object { $_.Value }); if ($m.Count -gt 0) { $m } else { 'read_error_or_not_a_report' } }
   ```

Leading silence, non-`data` chunk layouts and compressed-audio duration are
`unknown` without the Node inspector.
