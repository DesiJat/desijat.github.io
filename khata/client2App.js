/**********************************************************

* CONFIG
  **********************************************************/
// https://docs.google.com/spreadsheets/d/1AaLaziFauR72kus_MlQv5afEkC5SIAH6Tbm4f3GqY7Q/edit?gid=0#gid=0
const WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbzbCP4D7Q5yCVwWKbU-s-bD76egoTXk_93QgQZsuV0TgJ9g8J92nZlYsRhGRlyf5rDqIw/exec";

/**********************************************************

* DATABASE CLIENT
  **********************************************************/

class SheetsDB {

  constructor(url) {
    this.url = url;
  }

  async request(payload) {


    const response =
      await fetch(this.url, {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json"
        },
        body:
          JSON.stringify(payload)
      });

    const result =
      await response.json();

    console.log(
      "API:",
      payload.action,
      result
    );

    return result;


  }

  async create(sheet, data) {


    return this.request({
      action: "create",
      sheet,
      data
    });


  }

  async read(
    sheet,
    options = {}
  ) {


    return this.request({
      action: "read",
      sheet,
      ...options
    });


  }

  async update(
    sheet,
    id,
    data
  ) {


    return this.request({
      action: "update",
      sheet,
      id,
      data
    });


  }

  async delete(
    sheet,
    id
  ) {


    return this.request({
      action: "delete",
      sheet,
      id
    });


  }

  async findById(
    sheet,
    id
  ) {


    return this.read(
      sheet,
      {
        where: [
          {
            field: "id",
            operator: "=",
            value: id
          }
        ],
        limit: 1
      }
    );


  }

  async sum(
    sheet,
    field
  ) {


    return this.read(
      sheet,
      {
        aggregate: {
          type: "sum",
          field
        }
      }
    );


  }

  async avg(
    sheet,
    field
  ) {


    return this.read(
      sheet,
      {
        aggregate: {
          type: "avg",
          field
        }
      }
    );


  }

  async count(
    sheet
  ) {


    return this.read(
      sheet,
      {
        aggregate: {
          type: "count"
        }
      }
    );


  }
}

/**********************************************************

* MAIN TEST
  **********************************************************/

async function runDemo() {

  const db = new SheetsDB(WEB_APP_URL);

  console.clear();

  console.log("========== START ==========");

  const seedData1 = {
    Roles: [
      { name: "Admin" },
      { name: "Family Member" }
    ],
    Users: [
      { name: "user1", email: "user1@test.com", mobile: "0123456789", password: "Pass@123", role_id: 1 },
      { name: "user2", email: "user2@test.com", mobile: "1234567890", password: "Pass@123", role_id: 2 }
    ],
    InternalTransactions: [
      { type: "Given", party_id: 1, party_name: "party 1", principal_amount: "10000", interest_rate: "12", interest_type: "Yearly", status: "Active", user_id: 1 },
      { type: "Taken", party_id: 2, party_name: "Bank Loan", principal_amount: "10000", interest_rate: "8", interest_type: "Monthly", status: "Completed", user_id: 2 },
      { type: "Received", party_id: 3, party_name: "party 1", principal_amount: "10000", interest_rate: "8", interest_type: "Monthly", status: "Completed", user_id: 2 }
    ],
    Party: [
      { name: "Bank", mobile: "123232322", address: "SHGB Ladwa" },
      { name: "AB", mobile: "123232322", address: "Ladwa" },
      { name: "CD", mobile: "123232322", address: "Hisar" },
    ],
    Transactions: [
      { type: "Given", party_id: 1, party_name: "party 1", principal_amount: "10000", interest_rate: "12", interest_type: "Yearly", status: "Active", user_id: 1 },
      { type: "Taken", party_id: 2, party_name: "Bank Loan", principal_amount: "10000", interest_rate: "8", interest_type: "Monthly", status: "Completed", user_id: 2 },
      { type: "Received", party_id: 3, party_name: "party 1", principal_amount: "10000", interest_rate: "8", interest_type: "Monthly", status: "Completed", user_id: 2 }
    ]
    /*
    Categories: [
      { name: "Electronics" },
      { name: "Accessories" }
    ],
    Products: [
      { name: "Laptop", category_id: 1, price: 1000 },
      { name: "Mouse", category_id: 2, price: 50 }
    ],
    Orders: [
      { user_id: 1, total: 1100, status: "paid" },
      { user_id: 2, total: 50, status: "pending" }
    ],
    OrderItems: [
      { order_id: 1, product_id: 1, qty: 1, price: 1000 },
      { order_id: 2, product_id: 2, qty: 2, price: 50 }
    ]
    */
  }

  const seedData = {
    Users: [
      { name: "Dad (Admin)", email: "dad@family.com", mobile: "9876543210", password: "Pass@123", parent_id: 0 },
      { name: "Mom", email: "mom@family.com", mobile: "8765432109", password: "Pass@123", parent_id: 1 },
      { name: "Alex", email: "alex@family.com", mobile: "7654321098", password: "Pass@123", parent_id: 1 }
    ],
    Accounts: [
      { name: "Joint Bank Checking" },
      { name: "Family Credit Card" },
      { name: "Dad Wallet/account" },
      { name: "Mom Wallet/account" },
      { name: "Alex Wallet/account" },
    ],
    Categories: [
      { name: "Salary", nature: "Inflow" },
      { name: "Groceries", nature: "Outflow" },
      { name: "Education", nature: "Outflow" },
      { name: "Business Loan", nature: "Debt Ledger" },
      { name: "Car Finance", nature: "Debt Ledger" }
    ],
    // 1. Core Internal Transactions (Everyday Expenses, Deposits, Cash Withdrawals)
    InternalTransactions: [
      {
        date: "2026-06-01",
        user_id: 1, // Dad
        type: "Deposit", // Deposit / Withdraw / Expense
        category_id: 1, // Salary
        amount: 5000.00,
        account_id: 1, // Joint Bank
        notes: "Monthly corporate salary credit"
      },
      {
        date: "2026-06-01",
        user_id: 2, // Mom
        type: "Expense",
        category_id: 2, // Groceries
        amount: 120.00,
        account_id: 3, // Credit Card
        notes: "Weekly supermarket run"
      },
      {
        date: "2026-06-02",
        user_id: 1, // Dad
        type: "Withdraw",
        category_id: 2, // ATM cash out
        amount: 200.00,
        account_id: 1, // From Joint Bank to Cash Wallet
        notes: "ATM cash withdrawal for pocket money"
      }
    ],
    // 2. External Loan Transactions (Money Given or Taken with third parties)
    ExternalLoans: [
      {
        date: "2026-01-02",
        user_id: 1, // Dad
        type: "Taken (External)", // Given (External) / Taken (External)
        party_name: "Local Bank Corp",
        category_id: 5, // Car Finance
        original_principal: 10000.00,
        interest_rate_percent: 2.0,
        interest_basis: "Monthly", // Monthly / Yearly
        duration_months: 12,
        status: "Active" // Active / Settled
      },
      {
        date: "2026-06-03",
        user_id: 2, // Mom
        type: "Given (External)",
        party_name: "Neighbor John",
        category_id: 4, // Business Loan
        original_principal: 2000.00,
        interest_rate_percent: 5.0,
        interest_basis: "Yearly",
        duration_months: 18,
        status: "Active"
      }
    ],
    // 3. Repayments Ledger (Tracks partial entries linked directly to External Loans)
    LoanRepayments: [
      {
        date: "2026-03-02",
        loan_id: "2", // Links directly to your $10,000 loan example
        user_id: 1, // Dad paid
        amount: 1000, // to paid amount 2000.00
        account_id: 1, // Paid via Joint Bank
        notes: "First partial loan repayment revert"
      }
    ]
  };

  const allTable = Object.keys(seedData);

  console.log("========== DYNAAMIC START ==========");
  // create all data
  for (let i = 0; i < allTable.length; i++) {
    const tableName = allTable[i];
    console.log(`Creating ${tableName}...`);

    for (let j = 0; j < seedData[tableName].length; j++) {
      const dataToAdd = seedData[tableName][j];
      // update and calulated interest_total
      if (tableName === "ExternalLoans") {
        const { original_principal = 0, interest_rate_percent = 0, duration_months = 0, interest_basis } = dataToAdd;
        const years = interest_basis === "Monthly" ? duration_months : duration_months / 12;
        dataToAdd.interest_total = original_principal * (interest_rate_percent / 100) * years;
        dataToAdd.tobe_paid = (+original_principal + +dataToAdd.interest_total);
        dataToAdd.paid = 0;
      }

      if (tableName === "LoanRepayments") {
        const { loan_id, amount = 0 } = dataToAdd;
        const loanDetails = await db.read("ExternalLoans", {
          where: [
            { field: "id", operator: "=", value: loan_id }
          ]
        });
        let loanStatus = null;
        if (loanDetails.data.length > 0) {
          const { tobe_paid, status, paid } = loanDetails.data[0];
          dataToAdd['before_paid'] = paid;
          dataToAdd['paid'] = (+paid + +amount);

          if (status != 'Active' || paid >= tobe_paid) {
            console.log('loan already settled');
            continue
          }
          if (dataToAdd['paid'] > tobe_paid) {
            const restAmount = tobe_paid - paid;
            console.log(`Only amount is rest ${restAmount}`);
            continue
          }
          // console.log(loanDetails.data)
          loanStatus = dataToAdd['paid'] >= tobe_paid ? 'Settled' : 'Active'
        }
        const order = ["date", "loan_id", "user_id", "account_id", "before_paid", "amount", "paid"];

        const dataToAddOrder = Object.fromEntries(
          order.filter(key => key in dataToAdd).map(key => [key, dataToAdd[key]])
        );
        await db.create(tableName, dataToAddOrder);

        await db.update("ExternalLoans", loan_id, { paid: dataToAdd['paid'], status: loanStatus })
      }
      // await db.create(tableName, dataToAdd);
    }

  }
  console.log(allTable)
  return false

  // get all data
  for (let i = 0; i < allTable.length; i++) {
    const tableName = allTable[i];
    console.log(`GET All ${tableName.toUpperCase()}...`);
    const result = await db.read(tableName);
    console.table(result.data);
  }

  console.log("========== DYNAAMIC END ==========");

  return false;

  const loginUser = await db.read(
    "Users",
    {
      where: [
        { field: "email", operator: "=", value: "user1@test.com" },
        { field: "password", operator: "=", value: "Pass@123" }
      ],
      join: [
        { sheet: "Roles", localKey: "role_id", foreignKey: "id", as: "role" }
      ],
      // search:"Hisar",
      // orderBy:"name",
      // direction:"desc"
    }
  );
  console.log(JSON.stringify(loginUser.data));
  // update data
  // const updateData = await db.update("Users", 1, { name: "user1Name" })
  // console.log(updateData)

  return false
  /************************************************
  
  * FIND USER
    ************************************************/

  console.log(
    "USER #1"
  );

  const user =
    await db.findById(
      "Users",
      1
    );

  console.log(
    user
  );

  /************************************************
  
  * FILTER
    ************************************************/

  console.log(
    "PAID ORDERS"
  );

  const paid =
    await db.read(
      "Orders",
      {
        where: [
          {
            field:
              "status",


            operator:
              "=",

            value:
              "paid"
          }
        ]
      }
    );


  console.table(
    paid.data
  );

  /************************************************
  
  * SORT
    ************************************************/

  console.log(
    "SORT BY TOTAL DESC"
  );

  const sorted =
    await db.read(
      "Orders",
      {
        orderBy:
          "total",


        direction:
          "desc"
      }
    );


  console.table(
    sorted.data
  );

  /************************************************
  
  * JOIN
    ************************************************/

  console.log(
    "ORDERS + USER"
  );

  const join =
    await db.read(
      "Orders",
      {
        join: [
          {
            sheet:
              "Users",


            localKey:
              "user_id",

            foreignKey:
              "id",

            as:
              "user"
          }
        ]
      }
    );


  // console.log(join.data);
  console.log(JSON.stringify(join.data));

  /************************************************
  
  * ONE TO MANY
    ************************************************/

  console.log(
    "ORDERS + ITEMS"
  );

  const items =
    await db.read(
      "Orders",
      {
        join: [
          {
            sheet:
              "OrderItems",


            localKey:
              "id",

            foreignKey:
              "order_id",

            type:
              "many",

            as:
              "items"
          }
        ]
      }
    );


  // console.log(
  //   items.data
  // );
  console.log(JSON.stringify(items.data));

  /************************************************
  
  * AGGREGATE
    ************************************************/

  console.log(
    "TOTAL SALES"
  );

  const total =
    await db.sum(
      "Orders",
      "total"
    );

  console.log(
    total
  );

  console.log(
    "AVG SALES"
  );

  const avg =
    await db.avg(
      "Orders",
      "total"
    );

  console.log(
    avg
  );

  console.log(
    "COUNT ORDERS"
  );

  const count = await db.count("Orders");

  console.log(count);

  /************************************************
  
  * PAGINATION
    ************************************************/

  console.log("PAGE 1");

  const page = await db.read(
    "Orders",
    {
      page: 1,
      limit: 1
    }
  );

  console.log(page);

  console.log("========== DONE ==========");
}

/**********************************************************

* RUN EVERYTHING
  **********************************************************/

runDemo()
  .then(() => {
    console.log("All tests completed.");
  })
  .catch(error => {
    console.error("Test Failed:", error);
  });
