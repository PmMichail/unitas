import asyncio
import sys

from services.bank_sync_service import bank_sync_service


async def sync_bank_statements():
    result = await bank_sync_service.sync_all_banks()
    print(result)


def main():
    command = sys.argv[1] if len(sys.argv) > 1 else ""
    if command == "sync_bank_statements":
        asyncio.run(sync_bank_statements())
        return
    print("Available commands: sync_bank_statements")
    sys.exit(1)


if __name__ == "__main__":
    main()
