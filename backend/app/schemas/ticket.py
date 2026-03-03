from pydantic import BaseModel
from typing import Optional


class TicketUpdate(BaseModel):
    ticket_key: str
    stage: str
    flow: str
    result: str
    failing_cmd: Optional[str] = ""
    comment: Optional[str] = ""
    label_action: str = "add"  # "add" | "skip"


class BulkUpdateRequest(BaseModel):
    tickets: list[TicketUpdate]


class TicketLabelCheckItem(BaseModel):
    ticket_key: str
    stage: str
    flow: str
    result: str
    failing_cmd: Optional[str] = ""


class TicketLabelCheckRequest(BaseModel):
    tickets: list[TicketLabelCheckItem]


class LabelCheckResult(BaseModel):
    ticket_key: str
    new_label: str
    existing_results_labels: list[str]
    has_conflict: bool  # True only when exact same label already exists


class BulkLabelCheckResponse(BaseModel):
    results: list[LabelCheckResult]


class TicketUpdateResult(BaseModel):
    ticket_key: str
    success: bool
    label_applied: Optional[str] = None
    comment_added: bool = False
    error: Optional[str] = None


class BulkUpdateResponse(BaseModel):
    results: list[TicketUpdateResult]
    total: int
    successful: int
    failed: int


class DropdownOption(BaseModel):
    value: str
    label: str


class DropdownConfig(BaseModel):
    stages: list[DropdownOption]
    flows: dict[str, list[DropdownOption]]
    results: list[DropdownOption]


class AddDropdownOptionRequest(BaseModel):
    value: str
    label: str


class DropdownOptionOut(BaseModel):
    id: int
    category: str
    parent_stage: str
    value: str
    label: str
    sort_order: int
