#!/bin/bash

# ==============================================================================
# Google Sheets DB API Test Shell Script
# Use this script to test the Google Apps Script backend database actions.
# Endpoint URL: https://script.google.com/macros/s/AKfycbzbCP4D7Q5yCVwWKbU-s-bD76egoTXk_93QgQZsuV0TgJ9g8J92nZlYsRhGRlyf5rDqIw/exec
# ==============================================================================

API_URL="https://script.google.com/macros/s/AKfycbzbCP4D7Q5yCVwWKbU-s-bD76egoTXk_93QgQZsuV0TgJ9g8J92nZlYsRhGRlyf5rDqIw/exec"

echo "--------------------------------------------------"
echo "Starting Family Khata SheetsDB API Tests..."
echo "--------------------------------------------------"

# 1. CREATE RECORD (action: "create")
# Dynamically creates the sheet if it doesn't exist, sets columns, and inserts a row.
echo -e "\n1. Testing CREATE member record..."
curl -L -X POST "$API_URL" \
  -H "Content-Type: text/plain" \
  -d '{
    "action": "create",
    "sheet": "members",
    "columns": ["name", "relation", "phone", "contribution", "balance"],
    "data": {
      "name": "Alex Sharma",
      "relation": "Son",
      "phone": "9999888877",
      "contribution": 5000,
      "balance": 2500
    }
  }'
echo -e "\n"

# 2. READ RECORDS (action: "read")
# Fetches list of items from a sheet with limit, filters, or sorting.
echo "2. Testing READ members list..."
curl -L -X POST "$API_URL" \
  -H "Content-Type: text/plain" \
  -d '{
    "action": "read",
    "sheet": "members",
    "limit": 10
  }'
echo -e "\n"

# 3. UPDATE RECORD (action: "update")
# Modifies an existing row based on its 'id' column value.
# Note: Replace id "1" with a valid ID returned by the Create operation.
echo "3. Testing UPDATE member record (ID 1)..."
curl -L -X POST "$API_URL" \
  -H "Content-Type: text/plain" \
  -d '{
    "action": "update",
    "sheet": "members",
    "id": 1,
    "data": {
      "phone": "9999000011",
      "balance": 3000
    }
  }'
echo -e "\n"

# 4. BULK UPDATE (action: "bulkUpdate")
# Performs updates on multiple rows in a single API call.
echo "4. Testing BULK UPDATE members..."
curl -L -X POST "$API_URL" \
  -H "Content-Type: text/plain" \
  -d '{
    "action": "bulkUpdate",
    "sheet": "members",
    "records": [
      { "id": 1, "data": { "contribution": 6000 } }
    ]
  }'
echo -e "\n"

# 5. DELETE RECORD (action: "delete")
# Removes a row from a sheet based on its 'id'.
# Note: Uncomment to run delete tests on ID 1.
# echo "5. Testing DELETE member record (ID 1)..."
# curl -L -X POST "$API_URL" \
#   -H "Content-Type: text/plain" \
#   -d '{
#     "action": "delete",
#     "sheet": "members",
#     "id": 1
#   }'
# echo -e "\n"

echo "--------------------------------------------------"
echo "API testing script finished."
echo "--------------------------------------------------"
