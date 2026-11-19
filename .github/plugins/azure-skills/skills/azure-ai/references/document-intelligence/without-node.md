# Document Intelligence preflight without Node.js

Use when Node.js 22+ is unavailable and the user declines installing it. These
commands print only labels and sizes, never document text, OCR output, field
values, paths or SAS tokens. The PowerShell lines work in Windows PowerShell 5.1
and PowerShell 7, including ConstrainedLanguage mode.

## Checks

1. **Size and detected format** (compare size with `F0` 4 MB / `S0` 500 MB and
   the label with the file extension):

   ```bash
   f="<local-doc>"; if [ ! -f "$f" ] || [ ! -r "$f" ] || ! size=$(wc -c < "$f" 2>/dev/null) || ! sig=$(od -An -tx1 -N8 "$f" 2>/dev/null | tr -d ' \n'); then echo read_error; else echo "$size"; case "$sig" in 255044462d*) echo pdf;; 89504e47*) echo png;; ffd8ff*) echo jpeg;; 49492a00*|4d4d002a*) echo tiff;; 424d*) echo bmp;; 504b0304*) echo zip_ooxml;; d0cf11e0a1b11ae1) echo ole2;; 3c*|efbbbf3c*) echo html_or_xml;; *) echo unknown;; esac; fi
   ```

   ```powershell
   $p = "<local-doc>"; try { if (-not (Test-Path -LiteralPath $p -PathType Leaf -ErrorAction Stop)) { 'read_error' } else { $len = (Get-Item -LiteralPath $p -ErrorAction Stop).Length; $b = @(if ($PSVersionTable.PSVersion.Major -ge 6) { Get-Content -LiteralPath $p -AsByteStream -TotalCount 8 -ErrorAction Stop } else { Get-Content -LiteralPath $p -Encoding Byte -TotalCount 8 -ErrorAction Stop }); $h = ($b | ForEach-Object { '{0:X2}' -f $_ }) -join ''; $len; switch -Regex ($h) { '^255044462D' { 'pdf'; break } '^89504E47' { 'png'; break } '^FFD8FF' { 'jpeg'; break } '^(49492A00|4D4D002A)' { 'tiff'; break } '^424D' { 'bmp'; break } '^504B0304' { 'zip_ooxml'; break } '^D0CF11E0A1B11AE1' { 'ole2'; break } '^(3C|EFBBBF3C)' { 'html_or_xml'; break } default { 'unknown' } } } } catch { 'read_error' }
   ```

   - `html_or_xml` on a `.pdf` or image is usually an error or sign-in page saved
     with the wrong extension.
   - `ole2` is a legacy `.doc`/`.xls`/`.ppt` file or an encrypted Office file;
     the v4 input tables list DOCX, XLSX and PPTX.
   - `zip_ooxml` only says the file is a ZIP package.

2. **PDF encryption marker**:

   ```bash
   f="<local-pdf>"; if [ ! -f "$f" ] || [ ! -r "$f" ]; then echo read_error; else grep -a -q -E '/Encrypt([^A-Za-z]|$)' "$f" 2>/dev/null; case $? in 0) echo encrypt_marker_present;; 1) echo no_encrypt_marker_found;; *) echo read_error;; esac; fi
   ```

   ```powershell
   $p = "<local-pdf>"; try { if (-not (Test-Path -LiteralPath $p -PathType Leaf -ErrorAction Stop)) { 'read_error' } elseif (Select-String -LiteralPath $p -Pattern '/Encrypt(?![A-Za-z])' -Quiet -ErrorAction Stop) { 'encrypt_marker_present' } else { 'no_encrypt_marker_found' } } catch { 'read_error' }
   ```

   A marker means a password lock or permission restrictions; only password
   locks are documented as needing removal.

3. **Not checkable here**: report image dimensions, page counts and label-file
   consistency as `unknown`; never print label values.

## Training-set label coverage

For a local copy of a custom extraction training folder. Prints the number of
label files and, per field name, how many documents contain that label entry;
never values, text or file names. Both commands count empty `value` arrays as
label entries; use the bundled auditor when available to separate labeled
values from empty-value-only labels.

```bash
d="<local-training-folder>"; echo "label_files=$(find "$d" -name '*.labels.json' | wc -l)"; find "$d" -name '*.labels.json' -exec sh -c 'grep -o "\"label\" *: *\"[^\"/]*" "$1" | sed "s/.*\"//" | sort -u' _ {} \; | sort | uniq -c
```

```powershell
$d = "<local-training-folder>"; $files = @(Get-ChildItem -LiteralPath $d -Recurse -Filter '*.labels.json'); "label_files=$($files.Count)"; $files | ForEach-Object { try { (Get-Content -LiteralPath $_.FullName -Raw | ConvertFrom-Json).labels | ForEach-Object { ($_.label -split '/')[0] } | Sort-Object -Unique } catch { 'unreadable_label_file' } } | Group-Object | Sort-Object Name | Select-Object Count, Name
```

Compare each count with `label_files`: a field labeled in only some documents
needs a check that the value is really absent in the others. OCR layout API
versions (all should match the build API version):

```bash
find "<local-training-folder>" -name '*.ocr.json' -exec sh -c 'grep -o -m1 "\"apiVersion\" *: *\"[^\"]*\"" "$1" | head -n1 | sed "s/.*: *//"' _ {} \; | sort | uniq -c
```

```powershell
Get-ChildItem -LiteralPath "<local-training-folder>" -Recurse -Filter '*.ocr.json' | ForEach-Object { $m = Select-String -LiteralPath $_.FullName -Pattern '"apiVersion"\s*:\s*"([^"]+)"' -List; if ($m) { $m.Matches[0].Groups[1].Value } else { 'not_found' } } | Group-Object | Select-Object Count, Name
```
