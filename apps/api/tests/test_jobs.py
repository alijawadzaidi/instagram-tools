"""Durable-jobs tests on an in-memory SQLite DB: enqueue, claim, complete/fail,
the reaper, and the handler registry."""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.db import Base
from app.jobs import queue
from app.jobs.handlers import HandlerResult, coerce, get_handler, job_handler
from app.jobs.reaper import reap_stale


@pytest.fixture()
def db():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()


class TestQueue:
    def test_enqueue_creates_pending_with_params(self, db):
        job = queue.enqueue(db, "transcribe", params={"url": "u"}, user_id="user1")
        assert job.status == "pending"
        assert job.params == {"url": "u"}
        assert job.user_id == "user1"

    def test_claim_one_moves_to_running_oldest_first(self, db):
        a = queue.enqueue(db, "transcribe", params={"n": 1})
        queue.enqueue(db, "transcribe", params={"n": 2})
        claimed = queue.claim_one(db)
        assert claimed.id == a.id
        assert claimed.status == "running"

    def test_claim_one_filters_by_tool(self, db):
        queue.enqueue(db, "transcribe", params={})
        b = queue.enqueue(db, "caption", params={})
        claimed = queue.claim_one(db, tools=["caption"])
        assert claimed.id == b.id

    def test_claim_one_returns_none_when_empty(self, db):
        assert queue.claim_one(db) is None

    def test_complete_records_result_and_cost(self, db):
        job = queue.enqueue(db, "caption", params={})
        outcome = HandlerResult(result={"text": "hi"}, tokens_in=10, tokens_out=20, cost_cents=3)
        queue.complete(db, job, outcome)
        assert job.status == "done"
        assert job.result == {"text": "hi"}
        assert (job.tokens_in, job.tokens_out, job.cost_cents) == (10, 20, 3)

    def test_fail_records_code_and_message(self, db):
        job = queue.enqueue(db, "transcribe", params={})
        queue.fail(db, job, "rate_limited", "slow down")
        assert job.status == "error"
        assert job.error_code == "rate_limited"
        assert job.error == "slow down"


class TestReaper:
    def test_reaps_only_running(self, db):
        running = queue.enqueue(db, "transcribe", params={})
        running.status = "running"
        pending = queue.enqueue(db, "transcribe", params={})
        done = queue.enqueue(db, "transcribe", params={})
        done.status = "done"
        db.commit()

        assert reap_stale(db) == 1
        db.refresh(running)
        db.refresh(pending)
        assert running.status == "error"
        assert running.error_code == "interrupted"
        assert pending.status == "pending"  # queued work is left for a worker


class TestHandlers:
    def test_register_and_get(self):
        @job_handler("test_tool_xyz")
        def _h(params):
            return {"echo": params}

        assert get_handler("test_tool_xyz")({"a": 1}) == {"echo": {"a": 1}}

    def test_unknown_handler_raises(self):
        from app.core.errors import ToolError

        with pytest.raises(ToolError):
            get_handler("no_such_tool_ever")

    def test_coerce_wraps_plain_dict(self):
        out = coerce({"x": 1})
        assert isinstance(out, HandlerResult)
        assert out.result == {"x": 1} and out.cost_cents is None

    def test_coerce_passes_through_handler_result(self):
        hr = HandlerResult(result={}, cost_cents=5)
        assert coerce(hr) is hr


def test_transcribe_handler_is_registered():
    # importing the app registers every tool's handler via auto-discovery
    import app.main  # noqa: F401

    assert get_handler("transcribe") is not None
