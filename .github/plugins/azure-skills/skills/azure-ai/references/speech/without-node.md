# Analysis without Node.js

The bundled analyzer needs Node.js 22 or later. When it is missing, say so
plainly. Do not install Node.js unasked and do not paste the raw log into chat.
Offer one of:

1. Install Node.js 22+ themselves (Windows: `winget install --id OpenJS.NodeJS.LTS -e`;
   macOS: `brew install node`), then run the analyzer from
   [diagnostics](diagnostics.md).
2. Extract only identifiers locally with the commands below.
3. Use the app-level events in [collection](collection.md) (SessionId, ResultId,
   result reason, cancellation details) instead of the native log.

## Local extraction

Replace `<log>` with the local file. The patterns print only IDs, a numeric
reason and an HTTP status, never log text, and match only the native text format
described in [source boundaries](source-contract.md). `grep` needs a UTF-8 file;
`Select-String` also reads UTF-16 with a byte-order mark.

```bash
grep -oE 'SessionId: [0-9a-fA-F-]{32,36}' "<log>" | sort -u
grep -oE 'resultId=[0-9a-fA-F-]{32,36} reason=[0-9]+' "<log>"
grep -oE 'upgrade response with status code [0-9]{3}' "<log>"
```

```powershell
Select-String -Path "<log>" -Pattern 'SessionId: [0-9a-fA-F-]{32,36}' | ForEach-Object { $_.Matches.Value } | Sort-Object -Unique
Select-String -Path "<log>" -Pattern 'resultId=[0-9a-fA-F-]{32,36} reason=[0-9]+' | ForEach-Object { $_.Matches.Value }
Select-String -Path "<log>" -Pattern 'upgrade response with status code [0-9]{3}' | ForEach-Object { $_.Matches.Value }
```

## Limits

This is not equivalent to the analyzer: no version or source-compatibility
check, coverage, properties, request contexts or typed observations. The first
pattern can also match an ID set on a connection. Matches are unattributed
claims from the log: adjacency never proves which session owns a result, and no
match means not found, not healthy. Apply [interpretation](interpretation.md)
for `reason` numbers, and add SDK version and UTC time to any support handoff.
