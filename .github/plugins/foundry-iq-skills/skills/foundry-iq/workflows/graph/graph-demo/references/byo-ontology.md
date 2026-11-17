# My ontology

Use when the intake names a `.jsonld` file, at the start or in the middle of a demo ("use my own ontology"). Switching path mid-demo keeps everything already built; only the remaining cards change ([cards by path](story.md#cards-by-path)).

## Check it

1. `ontology-consume check` must pass on the file. If it fails, show the problems in plain words and re-ask intake item 5.
2. Summarize it in plain words: its classes, its relationships and what each connects. Mention anything the graph build can't use, such as a relationship without a domain or range, or a remote import.

Story beat: "You brought your own vocabulary. I've checked it and here's what it says. Next we'll test it on a few documents."

## Topic Graph still runs

Topics run on every path, so the sequence and the Sitemap stay the same. On this path no ontology is generated, so there is no ontology spend card.

## Trial

On by default: an attached ontology can't be removed, and a different one needs a new build. Run it on N documents (intake item 7). Show classes and relationships with hits and those with none. If it's a no-go, the user can fix the file and check it again, or switch to the standard ontology or a generated one.

## Attach

Attach the same file that passed the check and the trial; if the file changed, check and trial it again.
