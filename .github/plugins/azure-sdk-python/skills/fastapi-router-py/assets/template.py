"""
ResourceName Router

Handles CRUD operations for resource_name resources.

Template placeholders to replace:
- ResourceName (PascalCase)
- resource_name (snake_case)
- resource_plural (plural snake_case)
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.auth.jwt import get_current_user, get_current_user_required
from app.models.user import User
from app.models.resource_name import (
    ResourceName,
    ResourceNameCreate,
    ResourceNameUpdate,
)
from app.services.resource_name_service import ResourceNameService

router = APIRouter(prefix="/api", tags=["resource_plural"])


# ============================================================================
# Dependencies
# ============================================================================


def get_service() -> ResourceNameService:
    """Dependency to get service instance."""
    return ResourceNameService()


# ============================================================================
# Endpoints
# ============================================================================


@router.get("/resource_plural", response_model=list[ResourceName])
async def list_resource_plural(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: Optional[User] = Depends(get_current_user),
    service: ResourceNameService = Depends(get_service),
) -> list[ResourceName]:
    """
    List all resource_plural.

    - **limit**: Maximum number of items to return (1-100)
    - **offset**: Number of items to skip
    """
    return await service.list_resource_plural(limit=limit, offset=offset)


@router.get("/resource_plural/{resource_name_id}", response_model=ResourceName)
async def get_resource_name(
    resource_name_id: str,
    current_user: Optional[User] = Depends(get_current_user),
    service: ResourceNameService = Depends(get_service),
) -> ResourceName:
    """
    Get a specific resource_name by ID.

    Raises 404 if not found.
    """
    result = await service.get_resource_name_by_id(resource_name_id)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ResourceName not found",
        )
    return result


@router.post(
    "/resource_plural",
    response_model=ResourceName,
    status_code=status.HTTP_201_CREATED,
)
async def create_resource_name(
    data: ResourceNameCreate,
    current_user: User = Depends(get_current_user_required),
    service: ResourceNameService = Depends(get_service),
) -> ResourceName:
    """
    Create a new resource_name.

    Requires authentication.
    """
    return await service.create_resource_name(data, current_user.id)


@router.patch("/resource_plural/{resource_name_id}", response_model=ResourceName)
async def update_resource_name(
    resource_name_id: str,
    data: ResourceNameUpdate,
    current_user: User = Depends(get_current_user_required),
    service: ResourceNameService = Depends(get_service),
) -> ResourceName:
    """
    Update an existing resource_name.

    Requires authentication and ownership.
    """
    # Verify ownership
    existing = await service.get_resource_name_by_id(resource_name_id)
    if existing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ResourceName not found",
        )

    # Optional: Check ownership
    # if existing.author_id != current_user.id:
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="Not authorized to update this resource_name",
    #     )

    return await service.update_resource_name(resource_name_id, data)


@router.delete(
    "/resource_plural/{resource_name_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_resource_name(
    resource_name_id: str,
    current_user: User = Depends(get_current_user_required),
    service: ResourceNameService = Depends(get_service),
) -> None:
    """
    Delete a resource_name.

    Requires authentication and ownership.
    """
    existing = await service.get_resource_name_by_id(resource_name_id)
    if existing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ResourceName not found",
        )

    await service.delete_resource_name(resource_name_id)
