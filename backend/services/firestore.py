import os
import copy
import logging
import threading
from datetime import datetime

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# In-memory Firestore shim for local development
# ---------------------------------------------------------------------------

class _InMemoryDocSnapshot:
    def __init__(self, data, exists=True):
        self._data = data
        self.exists = exists

    def to_dict(self):
        return copy.deepcopy(self._data) if self._data else None


class _InMemoryDocRef:
    def __init__(self, store: dict, path: str):
        self._store = store
        self._path = path

    def set(self, data):
        self._store[self._path] = copy.deepcopy(data)

    def update(self, data):
        if self._path in self._store:
            self._store[self._path].update(copy.deepcopy(data))
        else:
            self._store[self._path] = copy.deepcopy(data)

    def get(self):
        data = self._store.get(self._path)
        return _InMemoryDocSnapshot(data, exists=data is not None)

    def delete(self):
        self._store.pop(self._path, None)

    def collection(self, name):
        return _InMemoryCollectionRef(self._store, f"{self._path}/{name}")


class _InMemoryCollectionRef:
    def __init__(self, store: dict, prefix: str):
        self._store = store
        self._prefix = prefix

    def document(self, doc_id):
        return _InMemoryDocRef(self._store, f"{self._prefix}/{doc_id}")

    def order_by(self, field):
        self._order_field = field
        return self

    def stream(self):
        results = []
        search = self._prefix + "/"
        for key, val in list(self._store.items()):
            # Match direct children only (no deeper nesting)
            if key.startswith(search) and "/" not in key[len(search):]:
                results.append(_InMemoryDocSnapshot(val))
        field = getattr(self, "_order_field", None)
        if field:
            results.sort(
                key=lambda s: s.to_dict().get(field, datetime.min)
                if isinstance(s.to_dict().get(field), datetime)
                else str(s.to_dict().get(field, ""))
            )
        return results


class _InMemoryDB:
    """Drop-in replacement for firestore.Client for local dev."""

    def __init__(self):
        self._store: dict = {}
        logger.info("Using IN-MEMORY store (Firestore unavailable)")

    def collection(self, name):
        return _InMemoryCollectionRef(self._store, name)


# ---------------------------------------------------------------------------
# Real Firestore client
# ---------------------------------------------------------------------------

_db_client = None
_db_lock = threading.Lock()


def _get_client():
    global _db_client
    if _db_client is not None:
        return _db_client
    with _db_lock:
        if _db_client is not None:  # double-checked locking
            return _db_client
        try:
            from google.cloud import firestore
            client = firestore.Client(
                project=os.getenv("GOOGLE_CLOUD_PROJECT"),
                database=os.getenv("FIRESTORE_DATABASE", "(default)"),
            )
            # Smoke-test the connection
            client.collection("_ping").document("_ping").get()
            logger.info("Connected to Cloud Firestore")
            _db_client = client
        except Exception as e:
            logger.warning("Firestore unavailable (%s), falling back to in-memory store", e)
            _db_client = _InMemoryDB()
    return _db_client


class _LazyDB:
    """Proxy so Firestore client is only created after .env is loaded."""
    def __getattr__(self, name):
        return getattr(_get_client(), name)


db = _LazyDB()
