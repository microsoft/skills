"""{{ResourceName}} models following the multi-model pattern."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class {{ResourceName}}Base(BaseModel):
    """Common fields shared by all {{resource_name}} models."""

    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)


class {{ResourceName}}Create({{ResourceName}}Base):
    """Request body for creating a {{resource_name}}."""

    workspace_id: str = Field(..., alias="workspaceId")


class {{ResourceName}}Update(BaseModel):
    """Request body for partial updates (all fields optional)."""

    model_config = ConfigDict(populate_by_name=True)

    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)


class {{ResourceName}}({{ResourceName}}Base):
    """API response with all {{resource_name}} fields."""

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    id: str
    workspace_id: str = Field(..., alias="workspaceId")
    author_id: str = Field(..., alias="authorId")
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: Optional[datetime] = Field(None, alias="updatedAt")


class {{ResourceName}}InDB({{ResourceName}}):
    """Database document with doc_type for Cosmos DB queries."""

    doc_type: str = "{{resource_name}}"
