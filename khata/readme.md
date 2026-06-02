# khata manager


If you want a prompt for an AI to generate a **complete family financial khata management system** using **only HTML, CSS, and JavaScript (no backend, no frameworks)**, here's a detailed prompt you can use:

---

### Prompt

Create a professional Family Financial Khata Management Web Application using only HTML, CSS, and Vanilla JavaScript.

Requirements:

Build a single-page responsive web application that manages personal and family finances, including both Internal Family Accounts and External Accounts.

Technology Constraints:

* Use only HTML5, CSS3, and Vanilla JavaScript.
* No backend.
* No frameworks (React, Vue, Angular, Bootstrap, etc.).
* Use LocalStorage for data persistence.
* Everything must work offline.

Core Features:

1. Dashboard

* Total Family Balance
* Monthly Income
* Monthly Expenses
* Savings
* Outstanding Loans
* Family Member Summary Cards
* Recent Transactions

2. Family Member Management

* Add/Edit/Delete Family Members
* Member Profile:

  * Name
  * Relation
  * Contact
  * Photo
  * Monthly Contribution
  * Current Balance
* Individual Ledger for each member

3. Internal Family Khata

* Money given to family members
* Money received from family members
* Track:

  * Date
  * Member Name
  * Amount
  * Purpose
  * Status
* Running balance calculation
* Search and filter records

4. External Khata Management

* Borrowed Money
* Lent Money
* Vendors
* Shops
* Friends
* Relatives
* Customers

Fields:

* Name
* Contact Number
* Address
* Type
* Opening Balance
* Current Balance

Transaction Tracking:

* Credit
* Debit
* Due Date
* Notes
* Payment History

5. Income Management

* Salary
* Business Income
* Rent Income
* Other Income

Features:

* Add income
* Edit income
* Delete income
* Monthly reports

6. Expense Management
   Categories:

* Food
* Education
* Electricity
* Water
* Internet
* Medical
* Transportation
* Entertainment
* Other

Features:

* Add/Edit/Delete Expense
* Category filtering
* Monthly summary

7. Loan Management

* Loans Given
* Loans Taken

Track:

* Principal Amount
* Interest
* EMI
* Remaining Balance
* Due Dates
* Payment History

8. Family Budget Planner

* Monthly Budget
* Category Budget Limits
* Budget Utilization %
* Alerts when spending exceeds budget

9. Reports & Analytics
   Generate:

* Monthly Report
* Yearly Report
* Family Member Report
* Income vs Expense Report
* Loan Report

Charts:

* Pie Chart
* Bar Chart
* Line Chart

Use pure JavaScript Canvas API only.

10. Search & Filter System
    Global Search:

* Member
* Transaction
* Loan
* Income
* Expense

Advanced Filters:

* Date Range
* Category
* Member
* Status

11. Export Features
    Export:

* PDF-like printable report using browser print
* CSV
* JSON Backup

Import:

* JSON Restore

12. Security

* Local PIN Lock
* Session Timeout
* Data Encryption before storing in LocalStorage
* PIN Change Option

13. Notifications

* Upcoming Due Payments
* Loan Due Alerts
* Budget Exceeded Alerts

14. Settings

* Family Name
* Currency Selection
* Theme Selection
* Dark Mode
* Light Mode

15. UI/UX Requirements

* Modern professional financial dashboard
* Mobile-first responsive design
* Sidebar navigation
* Cards and widgets
* Glassmorphism effects
* Smooth animations
* Professional color palette
* Data tables
* Modal forms
* Toast notifications

16. Architecture Requirements
    Create clean modular code structure:

index.html
style.css
app.js

JavaScript Modules:

* storage manager
* member manager
* transaction manager
* budget manager
* loan manager
* report manager
* export/import manager
* authentication manager

17. Data Structure

Family Members:

```javascript
{
  id,
  name,
  relation,
  phone,
  contribution,
  balance
}
```

Transactions:

```javascript
{
  id,
  date,
  type,
  category,
  memberId,
  amount,
  description,
  status
}
```

Loans:

```javascript
{
  id,
  person,
  loanType,
  amount,
  interest,
  emi,
  dueDate,
  paidAmount
}
```

18. Deliverables
    Generate complete production-ready code with:

* Fully working HTML
* Professional CSS
* Complete JavaScript functionality
* Sample demo data
* LocalStorage persistence
* Responsive layout
* Comments explaining major sections

The final output should be a fully functional offline Family Financial Khata Management System that can run by simply opening index.html in a browser without any server.

---

This prompt is detailed enough to get an AI coding assistant to generate a near-complete family accounting/khata application.

# for referance files
client2App.js
server2App.gs