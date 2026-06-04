#!/bin/bash

# ==============================================================================
# Google Sheets DB API Test & Seeding Script
# Endpoint URL: https://script.google.com/macros/s/AKfycbzbCP4D7Q5yCVwWKbU-s-bD76egoTXk_93QgQZsuV0TgJ9g8J92nZlYsRhGRlyf5rDqIw/exec
# ==============================================================================

API_URL="https://script.google.com/macros/s/AKfycbzbCP4D7Q5yCVwWKbU-s-bD76egoTXk_93QgQZsuV0TgJ9g8J92nZlYsRhGRlyf5rDqIw/exec"
TOKEN="your-very-secure-family-khata-secret-key-2026"

echo "--------------------------------------------------"
echo "Starting Verma Family SaaS Demo Seeding & API test..."
echo "--------------------------------------------------"

# 1. SEED MEMBERS
echo -e "\n1. Seeding Members (Rajesh, Sunita, Amit)..."
curl -L -X POST "$API_URL" \
  -H "Content-Type: text/plain" \
  -d "{
    \"token\": \"$TOKEN\",
    \"action\": \"create\",
    \"sheet\": \"members\",
    \"columns\": [\"name\", \"relation\", \"phone\", \"email\", \"password\", \"parent_id\", \"familyId\", \"photo\", \"contribution\", \"balance\"],
    \"data\": {
      \"name\": \"Rajesh Verma\",
      \"relation\": \"Father (Admin)\",
      \"phone\": \"9876501234\",
      \"email\": \"rajesh@verma.com\",
      \"password\": \"Pass@123\",
      \"parent_id\": 0,
      \"familyId\": 1,
      \"photo\": \"\",
      \"contribution\": 15000,
      \"balance\": 12000
    }
  }"
echo -e "\n"

curl -L -X POST "$API_URL" \
  -H "Content-Type: text/plain" \
  -d "{
    \"token\": \"$TOKEN\",
    \"action\": \"create\",
    \"sheet\": \"members\",
    \"columns\": [\"name\", \"relation\", \"phone\", \"email\", \"password\", \"parent_id\", \"familyId\", \"photo\", \"contribution\", \"balance\"],
    \"data\": {
      \"name\": \"Sunita Verma\",
      \"relation\": \"Mother\",
      \"phone\": \"9876505678\",
      \"email\": \"sunita@verma.com\",
      \"password\": \"Pass@123\",
      \"parent_id\": 1,
      \"familyId\": 1,
      \"photo\": \"\",
      \"contribution\": 5000,
      \"balance\": 4500
    }
  }"
echo -e "\n"

curl -L -X POST "$API_URL" \
  -H "Content-Type: text/plain" \
  -d "{
    \"token\": \"$TOKEN\",
    \"action\": \"create\",
    \"sheet\": \"members\",
    \"columns\": [\"name\", \"relation\", \"phone\", \"email\", \"password\", \"parent_id\", \"familyId\", \"photo\", \"contribution\", \"balance\"],
    \"data\": {
      \"name\": \"Amit Verma\",
      \"relation\": \"Son\",
      \"phone\": \"9876509999\",
      \"email\": \"amit@verma.com\",
      \"password\": \"Pass@123\",
      \"parent_id\": 1,
      \"familyId\": 1,
      \"photo\": \"\",
      \"contribution\": 0,
      \"balance\": 1500
    }
  }"
echo -e "\n"


# 2. SEED CONFIG
echo "2. Seeding Workspace Config..."
curl -L -X POST "$API_URL" \
  -H "Content-Type: text/plain" \
  -d "{
    \"token\": \"$TOKEN\",
    \"action\": \"create\",
    \"sheet\": \"config\",
    \"columns\": [\"familyName\", \"currency\", \"theme\", \"useSheets\", \"sheetsUrl\", \"securePin\"],
    \"data\": {
      \"familyName\": \"Verma Family Finance\",
      \"currency\": \"₹\",
      \"theme\": \"light\",
      \"useSheets\": \"true\",
      \"sheetsUrl\": \"$API_URL\",
      \"securePin\": \"1234\"
    }
  }"
echo -e "\n"


# 3. SEED EXTERNAL ACCOUNTS
echo "3. Seeding Cash & Bank Accounts..."
curl -L -X POST "$API_URL" \
  -H "Content-Type: text/plain" \
  -d "{
    \"token\": \"$TOKEN\",
    \"action\": \"create\",
    \"sheet\": \"external_accounts\",
    \"columns\": [\"name\", \"phone\", \"address\", \"type\", \"openingBalance\", \"currentBalance\", \"familyId\"],
    \"data\": {
      \"name\": \"Main Wallet Cash\",
      \"phone\": \"\",
      \"address\": \"Home Safe\",
      \"type\": \"Cash\",
      \"openingBalance\": 5000,
      \"currentBalance\": 5000,
      \"familyId\": 1
    }
  }"
echo -e "\n"

curl -L -X POST "$API_URL" \
  -H "Content-Type: text/plain" \
  -d "{
    \"token\": \"$TOKEN\",
    \"action\": \"create\",
    \"sheet\": \"external_accounts\",
    \"columns\": [\"name\", \"phone\", \"address\", \"type\", \"openingBalance\", \"currentBalance\", \"familyId\"],
    \"data\": {
      \"name\": \"SBI Bank Savings\",
      \"phone\": \"012345678\",
      \"address\": \"Main Branch\",
      \"type\": \"Bank\",
      \"openingBalance\": 25000,
      \"currentBalance\": 25000,
      \"familyId\": 1
    }
  }"
echo -e "\n"


# 4. SEED BUDGETS
echo "4. Seeding Budgets..."
curl -L -X POST "$API_URL" \
  -H "Content-Type: text/plain" \
  -d "{
    \"token\": \"$TOKEN\",
    \"action\": \"create\",
    \"sheet\": \"budgets\",
    \"columns\": [\"category\", \"limit\", \"familyId\"],
    \"data\": {
      \"category\": \"Groceries\",
      \"limit\": 8000,
      \"familyId\": 1
    }
  }"
echo -e "\n"

curl -L -X POST "$API_URL" \
  -H "Content-Type: text/plain" \
  -d "{
    \"token\": \"$TOKEN\",
    \"action\": \"create\",
    \"sheet\": \"budgets\",
    \"columns\": [\"category\", \"limit\", \"familyId\"],
    \"data\": {
      \"category\": \"Entertainment\",
      \"limit\": 3000,
      \"familyId\": 1
    }
  }"
echo -e "\n"


# 5. SEED TRANSACTIONS
echo "5. Seeding Ledger Transactions..."
curl -L -X POST "$API_URL" \
  -H "Content-Type: text/plain" \
  -d "{
    \"token\": \"$TOKEN\",
    \"action\": \"create\",
    \"sheet\": \"transactions\",
    \"columns\": [\"date\", \"type\", \"category\", \"memberId\", \"externalAccountId\", \"amount\", \"description\", \"status\", \"dueDate\", \"familyId\"],
    \"data\": {
      \"date\": \"2026-06-01\",
      \"type\": \"Income\",
      \"category\": \"Salary\",
      \"memberId\": 1,
      \"externalAccountId\": 2,
      \"amount\": 50000,
      \"description\": \"Corporate salary payout\",
      \"status\": \"Completed\",
      \"dueDate\": \"\",
      \"familyId\": 1
    }
  }"
echo -e "\n"

curl -L -X POST "$API_URL" \
  -H "Content-Type: text/plain" \
  -d "{
    \"token\": \"$TOKEN\",
    \"action\": \"create\",
    \"sheet\": \"transactions\",
    \"columns\": [\"date\", \"type\", \"category\", \"memberId\", \"externalAccountId\", \"amount\", \"description\", \"status\", \"dueDate\", \"familyId\"],
    \"data\": {
      \"date\": \"2026-06-02\",
      \"type\": \"Expense\",
      \"category\": \"Groceries\",
      \"memberId\": 2,
      \"externalAccountId\": 1,
      \"amount\": 2450,
      \"description\": \"Weekly kitchen restocking\",
      \"status\": \"Completed\",
      \"dueDate\": \"\",
      \"familyId\": 1
    }
  }"
echo -e "\n"


# 6. SEED LOANS
echo "6. Seeding Loans Ledger..."
curl -L -X POST "$API_URL" \
  -H "Content-Type: text/plain" \
  -d "{
    \"token\": \"$TOKEN\",
    \"action\": \"create\",
    \"sheet\": \"loans\",
    \"columns\": [\"person\", \"loanType\", \"amount\", \"interest\", \"emi\", \"dueDate\", \"paidAmount\", \"notes\", \"paymentHistory\", \"memberId\", \"familyId\"],
    \"data\": {
      \"person\": \"Sharma Finance Corp\",
      \"loanType\": \"Taken\",
      \"amount\": 10000,
      \"interest\": 12,
      \"emi\": 1000,
      \"dueDate\": \"2026-06-15\",
      \"paidAmount\": 2000,
      \"notes\": \"Home improvement loan\",
      \"paymentHistory\": \"[{\\\"date\\\":\\\"2026-06-03\\\",\\\"amount\\\":2000,\\\"memberId\\\":1}]\",
      \"memberId\": 1,
      \"familyId\": 1
    }
  }"
echo -e "\n"


# 7. READ ALL SEEDED DATA FOR VERIFICATION
echo "7. Verification: Reading active members list..."
curl -L -X POST "$API_URL" \
  -H "Content-Type: text/plain" \
  -d "{
    \"token\": \"$TOKEN\",
    \"action\": \"read\",
    \"sheet\": \"members\",
    \"limit\": 10
  }"
echo -e "\n"

echo "--------------------------------------------------"
echo "Seeding completed successfully."
echo "--------------------------------------------------"
