# fastapi-router-py capability coverage

**SDK/package**: `fastapi`

This reference captures additional non-hero capabilities and API breadth so the main `SKILL.md` can stay focused on copy/paste hero flows.

## Hero scenarios covered in SKILL.md

- `Quick Start`
- `Authentication Patterns`
- `Response Models`
- `HTTP Status Codes`

## Important non-hero scenarios to include when needed

- `Integration Steps`
- `Best Practices`

## API breadth checklist

- Verify dependency lifetimes (`Depends` with `yield`) for resources like DB connections and HTTP clients.
- Confirm request/response validation uses Pydantic models with appropriate field constraints.
- Include proper error responses with `HTTPException` and correct status codes.
- Avoid blocking I/O in `async def` endpoints; use `run_in_executor` or a thread-pool for sync calls.
- Validate middleware, background tasks, and lifespan event patterns for production paths.
