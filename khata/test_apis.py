import json
import requests
from typing import Dict, List, Any

# ==========================================
# CONFIG
# ==========================================

API_URL = "https://script.google.com/macros/s/AKfycbyIesDi6qGtfrrVYMEnjLwX1HaOuwHzS5SXutH_5HNyFjikcclvuc1hIfmjWPEDiRYZ/exec"
TOKEN = "your-very-secure-family-khata-secret-key-2026"

HEADERS = {
    "Content-Type": "text/plain"
}


# ==========================================
# API CLIENT
# ==========================================

class FamilyKhataAPI:

    def __init__(self, api_url: str, token: str):
        self.api_url = api_url
        self.token = token

    def request(self, payload: Dict[str, Any]):
        payload["token"] = self.token

        response = requests.post(
            self.api_url,
            headers=HEADERS,
            data=json.dumps(payload)
        )

        print(
            f"[{payload.get('action').upper()}] "
            f"{payload.get('sheet')} -> "
            f"{response.status_code}"
        )

        try:
            return response.json()
        except Exception:
            return response.text

    def create(self, sheet: str, data: Dict[str, Any]):
        return self.request({
            "action": "create",
            "sheet": sheet,
            "columns": list(data.keys()),
            "data": data
        })

    def read(self, sheet: str, limit: int = 10):
        return self.request({
            "action": "read",
            "sheet": sheet,
            "limit": limit
        })


# ==========================================
# SEED DATA
# ==========================================

SEED_DATA = {

    "members": [
        {
            "name": "Rajesh Verma",
            "relation": "Father (Admin)",
            "phone": "9876501234",
            "email": "rajesh@verma.com",
            "password": "Pass@123",
            "parent_id": 0,
            "familyId": 1,
            "photo": "",
            "contribution": 15000,
            "balance": 12000
        },
        {
            "name": "Sunita Verma",
            "relation": "Mother",
            "phone": "9876505678",
            "email": "sunita@verma.com",
            "password": "Pass@123",
            "parent_id": 1,
            "familyId": 1,
            "photo": "",
            "contribution": 5000,
            "balance": 4500
        },
        {
            "name": "Amit Verma",
            "relation": "Son",
            "phone": "9876509999",
            "email": "amit@verma.com",
            "password": "Pass@123",
            "parent_id": 1,
            "familyId": 1,
            "photo": "",
            "contribution": 0,
            "balance": 1500
        }
    ],

    "config": [
        {
            "familyName": "Verma Family Finance",
            "currency": "₹",
            "theme": "light",
            "useSheets": True,
            "sheetsUrl": API_URL,
            "securePin": "1234"
        }
    ],

    "external_accounts": [
        {
            "name": "Main Wallet Cash",
            "phone": "",
            "address": "Home Safe",
            "type": "Cash",
            "openingBalance": 5000,
            "currentBalance": 5000,
            "familyId": 1
        },
        {
            "name": "SBI Bank Savings",
            "phone": "012345678",
            "address": "Main Branch",
            "type": "Bank",
            "openingBalance": 25000,
            "currentBalance": 25000,
            "familyId": 1
        }
    ],

    "budgets": [
        {
            "category": "Groceries",
            "limit": 8000,
            "familyId": 1
        },
        {
            "category": "Entertainment",
            "limit": 3000,
            "familyId": 1
        }
    ],

    "transactions": [
        {
            "date": "2026-06-01",
            "type": "Income",
            "category": "Salary",
            "memberId": 1,
            "externalAccountId": 2,
            "amount": 50000,
            "description": "Corporate salary payout",
            "status": "Completed",
            "dueDate": "",
            "familyId": 1
        },
        {
            "date": "2026-06-02",
            "type": "Expense",
            "category": "Groceries",
            "memberId": 2,
            "externalAccountId": 1,
            "amount": 2450,
            "description": "Weekly kitchen restocking",
            "status": "Completed",
            "dueDate": "",
            "familyId": 1
        }
    ],

    "loans": [
        {
            "person": "Sharma Finance Corp",
            "loanType": "Taken",
            "amount": 10000,
            "interest": 12,
            "emi": 1000,
            "dueDate": "2026-06-15",
            "paidAmount": 2000,
            "notes": "Home improvement loan",

            # stringify nested data
            "paymentHistory": json.dumps([
                {
                    "date": "2026-06-03",
                    "amount": 2000,
                    "memberId": 1
                }
            ]),

            "memberId": 1,
            "familyId": 1
        }
    ]
}


# ==========================================
# SEED FUNCTION
# ==========================================

def seed_database(api: FamilyKhataAPI):

    print("\n===================================")
    print("STARTING DATABASE SEED")
    print("===================================\n")

    for sheet_name, records in SEED_DATA.items():

        print(f"\nSeeding: {sheet_name}")

        for record in records:
            result = api.create(sheet_name, record)

            print(
                json.dumps(
                    result,
                    indent=2,
                    ensure_ascii=False
                )
            )


# ==========================================
# VERIFY FUNCTION
# ==========================================

def verify(api: FamilyKhataAPI):

    print("\n===================================")
    print("VERIFYING DATA")
    print("===================================\n")

    for sheet in SEED_DATA.keys():

        print(f"\nReading {sheet}")

        result = api.read(sheet, 5)

        print(
            json.dumps(
                result,
                indent=2,
                ensure_ascii=False
            )
        )


# ==========================================
# MAIN
# ==========================================

if __name__ == "__main__":

    api = FamilyKhataAPI(
        API_URL,
        TOKEN
    )

    seed_database(api)

    verify(api)

    print("\nDONE")
