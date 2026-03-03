import httpx


class JiraCloudService:
    """Handles Jira Cloud REST API v3 interactions via api.atlassian.com."""

    @staticmethod
    def _base_url(cloud_id: str) -> str:
        return f"https://api.atlassian.com/ex/jira/{cloud_id}/rest/api/3"

    @staticmethod
    def _headers(access_token: str) -> dict:
        return {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    @staticmethod
    async def get_issue(cloud_id: str, access_token: str, issue_key: str, fields: str = "labels,summary,status") -> dict:
        """Get a Jira issue with specified fields."""
        url = f"{JiraCloudService._base_url(cloud_id)}/issue/{issue_key}"
        params = {"fields": fields}
        async with httpx.AsyncClient() as client:
            response = await client.get(
                url,
                headers=JiraCloudService._headers(access_token),
                params=params,
                timeout=30.0,
            )
            response.raise_for_status()
            return response.json()

    @staticmethod
    async def get_issue_assignee(cloud_id: str, access_token: str, issue_key: str) -> dict | None:
        """Get the current assignee for a Jira issue. Returns dict with displayName/accountId or None."""
        issue = await JiraCloudService.get_issue(
            cloud_id, access_token, issue_key, fields="assignee"
        )
        return issue.get("fields", {}).get("assignee")

    @staticmethod
    async def get_issue_labels(cloud_id: str, access_token: str, issue_key: str) -> list[str]:
        """Get all labels for a Jira issue."""
        issue = await JiraCloudService.get_issue(cloud_id, access_token, issue_key)
        return issue.get("fields", {}).get("labels", [])

    @staticmethod
    async def get_results_labels(cloud_id: str, access_token: str, issue_key: str) -> list[str]:
        """Get only labels starting with 'results_' for a Jira issue."""
        labels = await JiraCloudService.get_issue_labels(cloud_id, access_token, issue_key)
        return [label for label in labels if label.startswith("results_")]

    @staticmethod
    async def update_issue_labels(
        cloud_id: str, access_token: str, issue_key: str, labels: list[str]
    ) -> dict:
        """Replace all labels on a Jira issue."""
        url = f"{JiraCloudService._base_url(cloud_id)}/issue/{issue_key}"
        async with httpx.AsyncClient() as client:
            response = await client.put(
                url,
                headers=JiraCloudService._headers(access_token),
                json={"fields": {"labels": labels}},
                timeout=30.0,
            )
            response.raise_for_status()
            # PUT returns 204 No Content on success
            return {"status": "updated"}

    @staticmethod
    async def add_issue_comment(
        cloud_id: str, access_token: str, issue_key: str, comment_body: str
    ) -> dict:
        """Add a comment to a Jira issue using Atlassian Document Format (ADF)."""
        url = f"{JiraCloudService._base_url(cloud_id)}/issue/{issue_key}/comment"
        # Jira Cloud API v3 requires ADF format for comments
        adf_body = {
            "body": {
                "type": "doc",
                "version": 1,
                "content": [
                    {
                        "type": "paragraph",
                        "content": [
                            {
                                "type": "text",
                                "text": comment_body,
                            }
                        ],
                    }
                ],
            }
        }
        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                headers=JiraCloudService._headers(access_token),
                json=adf_body,
                timeout=30.0,
            )
            response.raise_for_status()
            return response.json()

    @staticmethod
    def build_label(stage: str, flow: str, result: str, failing_cmd: str) -> str:
        """Build the results label string.

        Format: results_<Stage>_<Flow>_<Result>_<failing_cmd>
        If failing_cmd is empty (after stripping underscores), append '_X'.
        Example: results_S1_F2_R3_mycmd or results_S1_F2_R3_X
        """
        # Strip leading/trailing underscores and whitespace
        failing_cmd_clean = failing_cmd.strip().strip("_") if failing_cmd else ""
        label = f"results_{stage}_{flow}_{result}"
        if failing_cmd_clean:
            label += f"_{failing_cmd_clean}"
        else:
            label += "_X"
        return label

    @staticmethod
    async def search_user(cloud_id: str, access_token: str, query: str) -> dict | None:
        """Search for a Jira user by username/email query and return the first match."""
        url = f"{JiraCloudService._base_url(cloud_id)}/user/search"
        async with httpx.AsyncClient() as client:
            response = await client.get(
                url,
                headers=JiraCloudService._headers(access_token),
                params={"query": query, "maxResults": 5},
                timeout=30.0,
            )
            response.raise_for_status()
            users = response.json()
            if users:
                return users[0]
            return None

    @staticmethod
    async def search_users(cloud_id: str, access_token: str, query: str, max_results: int = 10) -> list[dict]:
        """Search for Jira users matching query. Returns all matching users."""
        url = f"{JiraCloudService._base_url(cloud_id)}/user/search"
        async with httpx.AsyncClient() as client:
            response = await client.get(
                url,
                headers=JiraCloudService._headers(access_token),
                params={"query": query, "maxResults": max_results},
                timeout=30.0,
            )
            response.raise_for_status()
            return response.json()

    @staticmethod
    async def assign_issue(
        cloud_id: str, access_token: str, issue_key: str, account_id: str
    ) -> dict:
        """Assign an issue to a user by their accountId."""
        url = f"{JiraCloudService._base_url(cloud_id)}/issue/{issue_key}/assignee"
        async with httpx.AsyncClient() as client:
            response = await client.put(
                url,
                headers=JiraCloudService._headers(access_token),
                json={"accountId": account_id},
                timeout=30.0,
            )
            response.raise_for_status()
            return {"status": "assigned"}

