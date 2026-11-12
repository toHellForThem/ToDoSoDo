"""Тесты экспортированного контракта."""

from scripts.export_contract import (
    CONTRACTS_DIR,
    build_contracts,
    serialize_contract,
)


def test_contract_files_are_up_to_date():
    for name, content in build_contracts().items():
        path = CONTRACTS_DIR / name

        assert path.exists(), f"Нет файла контракта: {name}"
        assert path.read_text(encoding="utf-8") == serialize_contract(content), (
            f"Контракт устарел: {name}. Запустите "
            "python scripts/export_contract.py"
        )
