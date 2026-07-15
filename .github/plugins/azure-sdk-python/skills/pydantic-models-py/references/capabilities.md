# pydantic-models-py capability coverage

**SDK/package**: `pydantic`

This reference captures additional non-hero capabilities and API breadth so the main `SKILL.md` can stay focused on copy/paste hero flows.

## Hero scenarios covered in SKILL.md

- `Quick Start`
- `Multi-Model Pattern`
- `camelCase Aliases`
- `Optional Update Fields`

## Important non-hero scenarios to include when needed

- `Database Document`
- `Integration Steps`

## API breadth checklist

- Verify field validators (`@field_validator`) and model validators (`@model_validator`) cover all required constraints.
- Confirm serialization behavior: use `model_dump(mode="json")` for JSON-safe output and `model_dump(exclude_unset=True)` for partial updates.
- Include schema generation examples (`model_json_schema()`) when the model drives API contracts or documentation.
- Prefer `model_validate` over direct construction to ensure validators and coercion run.
- Validate migration paths from Pydantic v1 (`@validator`, `orm_mode`) to v2 (`@field_validator`, `model_config`) for any code that may need to upgrade.
