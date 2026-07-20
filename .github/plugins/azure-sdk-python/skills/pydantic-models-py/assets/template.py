"""
{{ResourceName}} Models

Pydantic models for {{resource_name}} resource following the multi-model pattern.
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


# ============================================================================
# Base Model
# ============================================================================


class {{ResourceName}}Base(BaseModel):
    """
    Base model with common fields.

    Used as the foundation for Create, Update, and Response models.
    """

    name: str = Field(
        ...,
        min_length=1,
        max_length=200,
        description="Display name for the {{resource_name}}",
    )
    description: Optional[str] = Field(
        None,
        max_length=2000,
        description="Optional description",
    )
    # Add additional common fields here

    class Config:
        populate_by_name = True  # Allows both snake_case and camelCase


# ============================================================================
# Create Model
# ============================================================================


class {{ResourceName}}Create({{ResourceName}}Base):
    """
    Request model for creating a new {{resource_name}}.

    Includes all required fields for creation.
    """

    # Add required creation-only fields
    workspace_id: str = Field(
        ...,
        alias="workspaceId",
        description="ID of the parent workspace",
    )


# ============================================================================
# Update Model
# ============================================================================


class {{ResourceName}}Update(BaseModel):
    """
    Request model for partial updates.

    All fields are optional - only provided fields will be updated.
    """

    name: Optional[str] = Field(
        None,
        min_length=1,
        max_length=200,
    )
    description: Optional[str] = Field(
        None,
        max_length=2000,
    )
    # Add additional updatable fields here

    class Config:
        populate_by_name = True


# ============================================================================
# Response Model
# ============================================================================


class {{ResourceName}}({{ResourceName}}Base):
    """
    Response model with all fields.

    Returned from API endpoints.
    """

    id: str = Field(..., description="Unique identifier")
    slug: str = Field(..., description="URL-friendly identifier")
    workspace_id: str = Field(..., alias="workspaceId")
    author_id: str = Field(..., alias="authorId")
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: Optional[datetime] = Field(None, alias="updatedAt")

    class Config:
        from_attributes = True  # Enable ORM mode for SQLAlchemy/etc
        populate_by_name = True


# ============================================================================
# Database Model
# ============================================================================


class {{ResourceName}}InDB({{ResourceName}}):
    """
    Database document model.

    Includes doc_type for Cosmos DB partitioning and queries.
    """

    doc_type: str = "{{resource_name}}"
