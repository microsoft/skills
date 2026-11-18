# Document Translation checks without Node.js

Use when Node.js 22+ is unavailable and the user declines installing it. These
commands print only labels, sizes and row numbers, never document text, glossary
terms, paths or SAS tokens. The PowerShell lines work in Windows PowerShell 5.1
and PowerShell 7, including ConstrainedLanguage mode.

## Checks

1. **Sizes and counts**: per-file size (`<= 40 MB` async, `<= 10 MB` sync), file
   count (`<= 1,000` async, `1` sync), batch total (`<= 250 MB` async) and glossary
   size (`<= 10 MB` async, `<= 1 MB` sync). Compare extensions with the format
   lists in the [preflight page](document-translation-preflight.md).

2. **Signature and BOM** (label only; the first bytes of a glossary are its
   first term):

   ```bash
   f="<file-or-glossary>"; if [ ! -f "$f" ] || [ ! -r "$f" ] || ! sig=$(od -An -tx1 -N8 "$f" 2>/dev/null | tr -d ' \n'); then echo read_error; else case "$sig" in efbbbf*) echo utf8_bom;; fffe*|feff*) echo utf16_bom;; d0cf11e0a1b11ae1) echo ole2;; 25504446*) echo pdf;; 504b0304*) echo zip;; *) echo other;; esac; fi
   ```

   ```powershell
   $p = "<file-or-glossary>"; try { if (-not (Test-Path -LiteralPath $p -PathType Leaf -ErrorAction Stop)) { 'read_error' } else { $b = @(if ($PSVersionTable.PSVersion.Major -ge 6) { Get-Content -LiteralPath $p -AsByteStream -TotalCount 8 -ErrorAction Stop } else { Get-Content -LiteralPath $p -Encoding Byte -TotalCount 8 -ErrorAction Stop }); $h = ($b | ForEach-Object { '{0:X2}' -f $_ }) -join ''; switch -Regex ($h) { '^EFBBBF' { 'utf8_bom'; break } '^(FFFE|FEFF)' { 'utf16_bom'; break } '^D0CF11E0A1B11AE1' { 'ole2'; break } '^25504446' { 'pdf'; break } '^504B0304' { 'zip'; break } default { 'other' } } } } catch { 'read_error' }
   ```

   - `ole2` on `.docx`/`.xlsx`/`.pptx`: an encrypted Office file or a renamed
     legacy `.doc`/`.xls`/`.ppt`. Secured (password-encrypted or
     copy-restricted) documents can't be translated.
   - `pdf`: check the encryption marker:

   ```bash
   f="<file.pdf>"; if [ ! -f "$f" ] || [ ! -r "$f" ]; then echo read_error; else grep -a -q -E '/Encrypt([^A-Za-z]|$)' "$f" 2>/dev/null; case $? in 0) echo encrypted;; 1) echo no_encrypt_marker;; *) echo read_error;; esac; fi
   ```

   ```powershell
   $p = "<file.pdf>"; try { if (-not (Test-Path -LiteralPath $p -PathType Leaf -ErrorAction Stop)) { 'read_error' } elseif (Select-String -LiteralPath $p -Pattern '/Encrypt(?![A-Za-z])' -Quiet -ErrorAction Stop) { 'encrypted' } else { 'no_encrypt_marker' } } catch { 'read_error' }
   ```

3. **TSV glossary columns** (row numbers only; blank lines are skipped):

   ```bash
   f="<glossary.tsv>"; if [ ! -f "$f" ] || [ ! -r "$f" ]; then echo read_error; else out=$(awk -F '\t' '{ sub(/\r$/, "") } NF == 0 { next } NF != 2 || $1 == "" || $2 == "" { print "bad_row:" NR }' "$f" 2>/dev/null) || { echo read_error; out=""; }; [ -n "$out" ] && printf '%s\n' "$out" | head -n 20; fi
   ```

   ```powershell
   $p = "<glossary.tsv>"; try { if (-not (Test-Path -LiteralPath $p -PathType Leaf -ErrorAction Stop)) { 'read_error' } else { $i = 0; Get-Content -LiteralPath $p -Encoding UTF8 -ErrorAction Stop | ForEach-Object { $i++; if ($_ -ne '') { $c = $_ -split "`t"; if ($c.Count -ne 2 -or [string]::IsNullOrWhiteSpace($c[0]) -or [string]::IsNullOrWhiteSpace($c[1])) { "bad_row:$i" } } } | Select-Object -First 20 } } catch { 'read_error' }
   ```

CSV quoting and UTF-8 validity are `unknown` without the Node validator.
