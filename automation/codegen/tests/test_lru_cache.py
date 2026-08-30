import importlib.util
from pathlib import Path


def load():
    p = Path(__file__).parents[3] / "automation/codegen/generated/lru_cache.py"
    s = importlib.util.spec_from_file_location("lru_cache", p)
    m = importlib.util.module_from_spec(s); s.loader.exec_module(m); return m


def test_basic():
    m = load()
    c = m.LRUCache(2)
    c.put(1, 1); c.put(2, 2)
    assert c.get(1) == 1
    c.put(3, 3)
    assert c.get(2) == -1
    assert c.get(3) == 3


def test_eviction_order():
    m = load()
    c = m.LRUCache(2)
    c.put(1, 1); c.put(2, 2)
    c.get(1)
    c.put(3, 3)
    assert c.get(1) == 1
    assert c.get(2) == -1


def test_update_existing():
    m = load()
    c = m.LRUCache(2)
    c.put(1, 1); c.put(1, 10)
    assert c.get(1) == 10


def test_capacity_one():
    m = load()
    c = m.LRUCache(1)
    c.put(1, 1); c.put(2, 2)
    assert c.get(1) == -1
    assert c.get(2) == 2
