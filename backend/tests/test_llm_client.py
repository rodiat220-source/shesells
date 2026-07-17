import unittest
from unittest.mock import AsyncMock, MagicMock, patch

import app.core.llm_client as llm_client


class LlmClientTest(unittest.IsolatedAsyncioTestCase):
    """验证 LLM 调用会记录 Langfuse generation。"""

    @patch("app.core.llm_client.httpx.AsyncClient")
    @patch("app.core.llm_client.propagate_attributes")
    async def test_call_llm_records_generation(
        self,
        propagate_attributes: MagicMock,
        async_client_factory: MagicMock,
    ) -> None:
        response = MagicMock()
        response.json.return_value = {
            "choices": [{"message": {"content": "{\"reply\": \"OK\"}"}}],
            "usage": {"prompt_tokens": 12, "completion_tokens": 8},
        }
        client = MagicMock()
        client.__aenter__ = AsyncMock(return_value=client)
        client.__aexit__ = AsyncMock(return_value=None)
        client.post = AsyncMock(return_value=response)
        async_client_factory.return_value = client

        generation = MagicMock()
        observation = MagicMock()
        observation.__enter__.return_value = generation
        observation.__exit__.return_value = False
        attributes = MagicMock()
        langfuse = MagicMock()
        langfuse.start_as_current_observation.return_value = observation
        propagate_attributes.return_value = attributes

        with patch.object(llm_client, "langfuse_client", langfuse):
            result = await llm_client.call_llm(
                "返回 JSON",
                session_id="session-1",
                observation_name="customer-simulator",
            )

        self.assertEqual(result, '{"reply": "OK"}')
        propagate_attributes.assert_called_once_with(
            session_id="session-1",
            trace_name="customer-simulator",
        )
        langfuse.start_as_current_observation.assert_called_once()
        generation.update.assert_called_once_with(
            output='{"reply": "OK"}',
            metadata={"attempt": 1},
            usage_details={"input": 12, "output": 8},
        )


if __name__ == "__main__":
    unittest.main()
