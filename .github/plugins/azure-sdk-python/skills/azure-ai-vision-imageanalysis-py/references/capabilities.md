# azure-ai-vision-imageanalysis-py capability coverage

**SDK/package**: `azure-ai-vision-imageanalysis`

This index maps hero scenarios in `SKILL.md` and links non-hero scenarios documented in dedicated reference files.

## Hero scenarios covered in SKILL.md

- `Analyze Image from URL`
- `Analyze Image from File`
- `Image Caption`
- `Dense Captions (Multiple Regions)`

## Non-hero scenarios

- `Tags`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#tags`](non-hero-scenarios.md#tags)
- `Object Detection`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#object-detection`](non-hero-scenarios.md#object-detection)
- `OCR (Text Extraction)`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#ocr-text-extraction`](non-hero-scenarios.md#ocr-text-extraction)
- `People Detection`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#people-detection`](non-hero-scenarios.md#people-detection)
- `Smart Cropping`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#smart-cropping`](non-hero-scenarios.md#smart-cropping)
- `Async Client`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#async-client`](non-hero-scenarios.md#async-client)
- `Visual Features`: | Feature | Description |  
  See: [`non-hero-scenarios.md#visual-features`](non-hero-scenarios.md#visual-features)
- `Error Handling`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#error-handling`](non-hero-scenarios.md#error-handling)
- `Image Requirements`: - Formats: JPEG, PNG, GIF, BMP, WEBP, ICO, TIFF, MPO  
  See: [`non-hero-scenarios.md#image-requirements`](non-hero-scenarios.md#image-requirements)

## Related deep-dive references

- [`non-hero-scenarios.md`](non-hero-scenarios.md): Dedicated non-hero examples and implementation notes.

## API breadth checklist

- Verify client/auth mode for the environment before coding.
- Confirm operation-group/method names against current Microsoft Learn API reference.
- For Python SDKs with both sync and async clients, document both forms without a blanket preference.
- Include cleanup/delete paths for created resources in examples.
- Prefer idempotent create/update operations where available.
- Validate paging/LRO/error-handling patterns for production paths.
