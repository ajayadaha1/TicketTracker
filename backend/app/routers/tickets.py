import json
import logging
from collections import defaultdict
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query, Request
from sqlalchemy import select, delete as sa_delete

from ..config import get_settings
from ..database import get_session_factory
from ..models import DropdownOption as DropdownOptionModel
from ..schemas.ticket import (
    AddDropdownOptionRequest,
    BulkLabelCheckResponse,
    BulkUpdateRequest,
    BulkUpdateResponse,
    DropdownConfig,
    DropdownOption,
    DropdownOptionOut,
    LabelCheckResult,
    TicketLabelCheckRequest,
    TicketUpdateResult,
)
from ..services.atlassian_auth import AtlassianAuthService
from ..services.audit import record_action, get_history
from ..services.jira_cloud_service import JiraCloudService

logger = logging.getLogger(__name__)
settings = get_settings()
router = APIRouter()

# Default JSON config files (used to seed the DB on first run)
DATA_DIR = Path(__file__).parent.parent / "data"


def _load_json(filename: str):
    with open(DATA_DIR / filename, "r") as f:
        return json.load(f)


async def seed_dropdown_options():
    """Seed dropdown options from JSON files if the DB table is empty."""
    async with get_session_factory()() as session:
        result = await session.execute(select(DropdownOptionModel.id).limit(1))
        if result.scalar() is not None:
            logger.info("Dropdown options already seeded, skipping")
            return

        logger.info("Seeding dropdown options from JSON files...")
        sort_order = 0

        # Stages
        for opt in _load_json("stages.json"):
            session.add(DropdownOptionModel(
                category="stage", parent_stage="", value=opt["value"], label=opt["label"], sort_order=sort_order,
            ))
            sort_order += 1

        # Flows (dict: stage -> list of options)
        flows = _load_json("flows.json")
        for stage, flow_list in flows.items():
            flow_sort = 0
            for opt in flow_list:
                session.add(DropdownOptionModel(
                    category="flow", parent_stage=stage, value=opt["value"], label=opt["label"], sort_order=flow_sort,
                ))
                flow_sort += 1

        # Results
        sort_order = 0
        for opt in _load_json("results.json"):
            session.add(DropdownOptionModel(
                category="result", parent_stage="", value=opt["value"], label=opt["label"], sort_order=sort_order,
            ))
            sort_order += 1

        await session.commit()
        logger.info("Dropdown options seeded successfully")


async def _get_session(request: Request) -> dict:
    """Extract and validate the session from the Authorization header."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = auth_header.replace("Bearer ", "")
    session = await AtlassianAuthService.get_session(token)
    if not session:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return session


@router.get("/config", response_model=DropdownConfig)
async def get_dropdown_config():
    """Return Stage, Flow, and Results dropdown options from the database."""
    async with get_session_factory()() as session:
        result = await session.execute(
            select(DropdownOptionModel).order_by(DropdownOptionModel.sort_order, DropdownOptionModel.id)
        )
        rows = result.scalars().all()

    stages = []
    flows: dict[str, list[DropdownOption]] = defaultdict(list)
    results = []

    for row in rows:
        opt = DropdownOption(value=row.value, label=row.label)
        if row.category == "stage":
            stages.append(opt)
            # Ensure every stage has a key in flows (even if empty)
            if row.value not in flows:
                flows[row.value] = []
        elif row.category == "flow":
            flows[row.parent_stage].append(opt)
        elif row.category == "result":
            results.append(opt)

    return DropdownConfig(stages=stages, flows=dict(flows), results=results)


# ── Dropdown option management endpoints ────────────────────────────────────────

@router.post("/config/stages", response_model=DropdownOptionOut, status_code=201)
async def add_stage(body: AddDropdownOptionRequest):
    """Add a new stage option."""
    async with get_session_factory()() as session:
        # Check for duplicate
        existing = await session.execute(
            select(DropdownOptionModel).where(
                DropdownOptionModel.category == "stage",
                DropdownOptionModel.value == body.value,
            )
        )
        if existing.scalar():
            raise HTTPException(status_code=409, detail=f"Stage '{body.value}' already exists")

        # Get max sort_order
        max_order = await session.execute(
            select(DropdownOptionModel.sort_order)
            .where(DropdownOptionModel.category == "stage")
            .order_by(DropdownOptionModel.sort_order.desc())
            .limit(1)
        )
        next_order = (max_order.scalar() or 0) + 1

        row = DropdownOptionModel(
            category="stage", parent_stage="", value=body.value, label=body.label, sort_order=next_order,
        )
        session.add(row)
        await session.commit()
        await session.refresh(row)
        return DropdownOptionOut(
            id=row.id, category=row.category, parent_stage=row.parent_stage or "",
            value=row.value, label=row.label, sort_order=row.sort_order,
        )


@router.delete("/config/stages/{value}", status_code=204)
async def remove_stage(value: str):
    """Remove a stage and all its associated flows."""
    async with get_session_factory()() as session:
        existing = await session.execute(
            select(DropdownOptionModel).where(
                DropdownOptionModel.category == "stage",
                DropdownOptionModel.value == value,
            )
        )
        if not existing.scalar():
            raise HTTPException(status_code=404, detail=f"Stage '{value}' not found")

        # Delete the stage
        await session.execute(
            sa_delete(DropdownOptionModel).where(
                DropdownOptionModel.category == "stage",
                DropdownOptionModel.value == value,
            )
        )
        # Delete all flows under this stage
        await session.execute(
            sa_delete(DropdownOptionModel).where(
                DropdownOptionModel.category == "flow",
                DropdownOptionModel.parent_stage == value,
            )
        )
        await session.commit()


@router.post("/config/flows/{stage}", response_model=DropdownOptionOut, status_code=201)
async def add_flow(stage: str, body: AddDropdownOptionRequest):
    """Add a new flow option under a specific stage."""
    async with get_session_factory()() as session:
        # Verify stage exists
        stage_exists = await session.execute(
            select(DropdownOptionModel).where(
                DropdownOptionModel.category == "stage",
                DropdownOptionModel.value == stage,
            )
        )
        if not stage_exists.scalar():
            raise HTTPException(status_code=404, detail=f"Stage '{stage}' not found")

        # Check for duplicate flow under this stage
        existing = await session.execute(
            select(DropdownOptionModel).where(
                DropdownOptionModel.category == "flow",
                DropdownOptionModel.parent_stage == stage,
                DropdownOptionModel.value == body.value,
            )
        )
        if existing.scalar():
            raise HTTPException(status_code=409, detail=f"Flow '{body.value}' already exists under stage '{stage}'")

        max_order = await session.execute(
            select(DropdownOptionModel.sort_order)
            .where(DropdownOptionModel.category == "flow", DropdownOptionModel.parent_stage == stage)
            .order_by(DropdownOptionModel.sort_order.desc())
            .limit(1)
        )
        next_order = (max_order.scalar() or 0) + 1

        row = DropdownOptionModel(
            category="flow", parent_stage=stage, value=body.value, label=body.label, sort_order=next_order,
        )
        session.add(row)
        await session.commit()
        await session.refresh(row)
        return DropdownOptionOut(
            id=row.id, category=row.category, parent_stage=row.parent_stage or "",
            value=row.value, label=row.label, sort_order=row.sort_order,
        )


@router.delete("/config/flows/{stage}/{value}", status_code=204)
async def remove_flow(stage: str, value: str):
    """Remove a flow option from a specific stage."""
    async with get_session_factory()() as session:
        existing = await session.execute(
            select(DropdownOptionModel).where(
                DropdownOptionModel.category == "flow",
                DropdownOptionModel.parent_stage == stage,
                DropdownOptionModel.value == value,
            )
        )
        if not existing.scalar():
            raise HTTPException(status_code=404, detail=f"Flow '{value}' not found under stage '{stage}'")

        await session.execute(
            sa_delete(DropdownOptionModel).where(
                DropdownOptionModel.category == "flow",
                DropdownOptionModel.parent_stage == stage,
                DropdownOptionModel.value == value,
            )
        )
        await session.commit()


@router.post("/config/results", response_model=DropdownOptionOut, status_code=201)
async def add_result(body: AddDropdownOptionRequest):
    """Add a new result option."""
    async with get_session_factory()() as session:
        existing = await session.execute(
            select(DropdownOptionModel).where(
                DropdownOptionModel.category == "result",
                DropdownOptionModel.value == body.value,
            )
        )
        if existing.scalar():
            raise HTTPException(status_code=409, detail=f"Result '{body.value}' already exists")

        max_order = await session.execute(
            select(DropdownOptionModel.sort_order)
            .where(DropdownOptionModel.category == "result")
            .order_by(DropdownOptionModel.sort_order.desc())
            .limit(1)
        )
        next_order = (max_order.scalar() or 0) + 1

        row = DropdownOptionModel(
            category="result", parent_stage="", value=body.value, label=body.label, sort_order=next_order,
        )
        session.add(row)
        await session.commit()
        await session.refresh(row)
        return DropdownOptionOut(
            id=row.id, category=row.category, parent_stage=row.parent_stage or "",
            value=row.value, label=row.label, sort_order=row.sort_order,
        )


@router.delete("/config/results/{value}", status_code=204)
async def remove_result(value: str):
    """Remove a result option."""
    async with get_session_factory()() as session:
        existing = await session.execute(
            select(DropdownOptionModel).where(
                DropdownOptionModel.category == "result",
                DropdownOptionModel.value == value,
            )
        )
        if not existing.scalar():
            raise HTTPException(status_code=404, detail=f"Result '{value}' not found")

        await session.execute(
            sa_delete(DropdownOptionModel).where(
                DropdownOptionModel.category == "result",
                DropdownOptionModel.value == value,
            )
        )
        await session.commit()


@router.get("/{ticket_key}/labels")
async def get_ticket_labels(ticket_key: str, request: Request):
    """Get existing labels for a ticket, highlighting results_ prefixed ones."""
    session = await _get_session(request)
    try:
        all_labels = await JiraCloudService.get_issue_labels(
            session["cloud_id"], session["access_token"], ticket_key
        )
        results_labels = [l for l in all_labels if l.startswith("results_")]
        return {
            "ticket_key": ticket_key,
            "labels": all_labels,
            "results_labels": results_labels,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to get labels for {ticket_key}: {str(e)}")


@router.post("/check-labels", response_model=BulkLabelCheckResponse)
async def check_labels(body: TicketLabelCheckRequest, request: Request):
    """Bulk check which tickets have the exact same label already applied."""
    session = await _get_session(request)
    results = []
    for ticket in body.tickets:
        try:
            new_label = JiraCloudService.build_label(
                ticket.stage, ticket.flow, ticket.result, ticket.failing_cmd or ""
            )
            results_labels = await JiraCloudService.get_results_labels(
                session["cloud_id"], session["access_token"], ticket.ticket_key
            )
            # Only flag conflict when the exact new label already exists
            results.append(LabelCheckResult(
                ticket_key=ticket.ticket_key,
                new_label=new_label,
                existing_results_labels=results_labels,
                has_conflict=new_label in results_labels,
            ))
        except Exception:
            results.append(LabelCheckResult(
                ticket_key=ticket.ticket_key,
                new_label="",
                existing_results_labels=[],
                has_conflict=False,
            ))
    return BulkLabelCheckResponse(results=results)


@router.post("/update", response_model=BulkUpdateResponse)
async def bulk_update_tickets(body: BulkUpdateRequest, request: Request):
    """Bulk update labels and add comments for multiple tickets."""
    session = await _get_session(request)
    cloud_id = session["cloud_id"]
    access_token = session["access_token"]
    user_info = session.get("user_info", {})
    user_name = user_info.get("name", "Unknown")
    user_email = user_info.get("email", "")

    is_bulk = len(body.tickets) > 1

    results = []
    for ticket in body.tickets:
        try:
            # Skip tickets the user chose to skip (exact duplicate label)
            if ticket.label_action == "skip":
                results.append(TicketUpdateResult(
                    ticket_key=ticket.ticket_key,
                    success=True,
                    label_applied=None,
                    comment_added=False,
                ))
                continue

            # Build the new label
            new_label = JiraCloudService.build_label(
                ticket.stage, ticket.flow, ticket.result, ticket.failing_cmd or ""
            )
            logger.info(
                f"[{ticket.ticket_key}] Input: stage={ticket.stage!r}, flow={ticket.flow!r}, "
                f"result={ticket.result!r}, failing_cmd={ticket.failing_cmd!r} => label={new_label!r}"
            )

            # Get current labels
            current_labels = await JiraCloudService.get_issue_labels(
                cloud_id, access_token, ticket.ticket_key
            )
            logger.info(f"[{ticket.ticket_key}] Current labels: {current_labels}")

            # Always ADD new label alongside existing ones (keep old labels)
            updated_labels = list(current_labels)
            if new_label not in updated_labels:
                updated_labels.append(new_label)

            logger.info(f"[{ticket.ticket_key}] Updating labels to: {updated_labels}")

            # Update labels on the issue
            await JiraCloudService.update_issue_labels(
                cloud_id, access_token, ticket.ticket_key, updated_labels
            )

            # Record audit: label update
            details_parts = [f"action={ticket.label_action}"]
            if ticket.failing_cmd:
                details_parts.append(f"failing_cmd={ticket.failing_cmd}")
            if is_bulk:
                details_parts.append("bulk=true")
            await record_action(
                user_name=user_name,
                user_email=user_email,
                ticket_key=ticket.ticket_key,
                action="label_update",
                label=new_label,
                details="; ".join(details_parts),
            )

            # Add comment if provided
            comment_added = False
            if ticket.comment and ticket.comment.strip():
                await JiraCloudService.add_issue_comment(
                    cloud_id, access_token, ticket.ticket_key, ticket.comment
                )
                comment_added = True
                await record_action(
                    user_name=user_name,
                    user_email=user_email,
                    ticket_key=ticket.ticket_key,
                    action="comment_added",
                    comment=ticket.comment,
                )

            results.append(TicketUpdateResult(
                ticket_key=ticket.ticket_key,
                success=True,
                label_applied=new_label,
                comment_added=comment_added,
            ))
        except Exception as e:
            await record_action(
                user_name=user_name,
                user_email=user_email,
                ticket_key=ticket.ticket_key,
                action="update_failed",
                details=str(e),
            )
            results.append(TicketUpdateResult(
                ticket_key=ticket.ticket_key,
                success=False,
                error=str(e),
            ))

    successful = sum(1 for r in results if r.success)
    return BulkUpdateResponse(
        results=results,
        total=len(results),
        successful=successful,
        failed=len(results) - successful,
    )


@router.get("/history")
async def get_audit_history(
    request: Request,
    limit: int = 200,
    offset: int = 0,
    actions: list[str] = Query(default=[]),
):
    """Get audit trail of ticket updates. Optionally filter by action types."""
    await _get_session(request)
    return await get_history(
        limit=limit,
        offset=offset,
        actions=actions if actions else None,
    )
