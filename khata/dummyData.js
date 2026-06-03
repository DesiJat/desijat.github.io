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

  const seedData = {
  "config": [
    {
      "familyName": "Ours Family Finance",
      "currency": "₹",
      "theme": "dark",
      "useSheets": true,
      "sheetsUrl": "https://script.google.com/macros/s/AKfycbzbCP4D7Q5yCVwWKbU-s-bD76egoTXk_93QgQZsuV0TgJ9g8J92nZlYsRhGRlyf5rDqIw/exec",
      "securePin": "RkJCQkJDQg==",
    }
  ],
  "members": [
    {
      "name": "Rajesh Verma",
      "relation": "Father (Head)",
      "phone": "9876501234",
      "photo": "",
      "contribution": 60000,
      "balance": 24500,
    },
    {
      "name": "Sunita Verma",
      "relation": "Mother",
      "phone": "9876505678",
      "photo": "",
      "contribution": 15000,
      "balance": 8200,
    },
    {
      "name": "Amit Verma",
      "relation": "Son",
      "phone": "9876509999",
      "photo": "",
      "contribution": 8000,
      "balance": 1500,
    }
  ],
  "transactions": [
    {
      "date": "2026-06-01",
      "type": "Income",
      "category": "Salary",
      "memberId": 1,
      "externalAccountId": null,
      "amount": 75000,
      "description": "Monthly Corporate Salary Credit",
      "status": "Completed",
      "dueDate": "",
    },
    {
      "date": "2026-06-01",
      "type": "Income",
      "category": "Rent Income",
      "memberId": 2,
      "externalAccountId": null,
      "amount": 18000,
      "description": "Commercial Shop Floor Rent",
      "status": "Completed",
      "dueDate": "",
    },
    {
      "date": "2026-06-02",
      "type": "Expense",
      "category": "Food",
      "memberId": 2,
      "externalAccountId": null,
      "amount": 6200,
      "description": "Weekly organic wholesale groceries purchase",
      "status": "Completed",
      "dueDate": "",
    },
    {
      "date": "2026-06-02",
      "type": "Expense",
      "category": "Electricity",
      "memberId": 1,
      "externalAccountId": null,
      "amount": 4800,
      "description": "DHBVN Power Bill - Main House",
      "status": "Completed",
      "dueDate": "",
    },
    {
      "date": "2026-06-02",
      "type": "Expense",
      "category": "Medical",
      "memberId": 3,
      "externalAccountId": null,
      "amount": 2500,
      "description": "Annual dental checkup and scaling",
      "status": "Completed",
      "dueDate": "",
    }
  ],
  "external_accounts": [
    {
      "name": "Gupta Kirana Store",
      "phone": "9812345678",
      "address": "Gali No 2, Model Town, Hissar",
      "type": "Shop",
      "openingBalance": -3400,
      "currentBalance": -3400,
    },
    {
      "name": "Ramesh Kumar (Contractor)",
      "phone": "9896011223",
      "address": "Sector 14, Hissar",
      "type": "Customer",
      "openingBalance": 15000,
      "currentBalance": 15000,
    }
  ],
  "budgets": [
    {
      "category": "Food",
      "limit": 12000,
    },
    {
      "category": "Education",
      "limit": 20000,
    },
    {
      "category": "Electricity",
      "limit": 8000,
    },
    {
      "category": "Medical",
      "limit": 5000,
    }
  ],
  "loans": [
    {
      "person": "HDFC Home Loan",
      "loanType": "Taken",
      "amount": 2500000,
      "interest": 8.1,
      "emi": 24000,
      "dueDate": "2026-06-05",
      "paidAmount": 48000,
      "notes": "Home construction EMI plan",
      "paymentHistory": [
        { "date": "2026-04-05", "amount": 24000 },
        { "date": "2026-05-05", "amount": 24000 }
      ]
    },
    {
      "person": "Sanjay Sharma (Friend)",
      "loanType": "Given",
      "amount": 50000,
      "interest": 6.0,
      "emi": 5000,
      "dueDate": "2026-06-12",
      "paidAmount": 10000,
      "notes": "Friendly business support loan",
      "paymentHistory": [
        { "date": "2026-05-12", "amount": 10000 }
      ]
    }
  ]
}
;

  const allTable = Object.keys(seedData);

  console.log("========== DYNAAMIC START ==========");
  // create all data
  for (let i = 0; i < allTable.length; i++) {
    const tableName = allTable[i];
    console.log(`Creating ${tableName}...`);

    for (let j = 0; j < seedData[tableName].length; j++) {
      const dataToAdd = seedData[tableName][j];
      // update and calulated interest_total
      // if (tableName === "ExternalLoans") {
      //   const { original_principal = 0, interest_rate_percent = 0, duration_months = 0, interest_basis } = dataToAdd;
      //   const years = interest_basis === "Monthly" ? duration_months : duration_months / 12;
      //   dataToAdd.interest_total = original_principal * (interest_rate_percent / 100) * years;
      //   dataToAdd.tobe_paid = (+original_principal + +dataToAdd.interest_total);
      //   dataToAdd.paid = 0;
      // }

      // if (tableName === "LoanRepayments") {
      //   const { loan_id, amount = 0 } = dataToAdd;
      //   const loanDetails = await db.read("ExternalLoans", {
      //     where: [
      //       { field: "id", operator: "=", value: loan_id }
      //     ]
      //   });
      //   let loanStatus = null;
      //   if (loanDetails.data.length > 0) {
      //     const { tobe_paid, status, paid } = loanDetails.data[0];
      //     dataToAdd['before_paid'] = paid;
      //     dataToAdd['paid'] = (+paid + +amount);

      //     if (status != 'Active' || paid >= tobe_paid) {
      //       console.log('loan already settled');
      //       continue
      //     }
      //     if (dataToAdd['paid'] > tobe_paid) {
      //       const restAmount = tobe_paid - paid;
      //       console.log(`Only amount is rest ${restAmount}`);
      //       continue
      //     }
      //     // console.log(loanDetails.data)
      //     loanStatus = dataToAdd['paid'] >= tobe_paid ? 'Settled' : 'Active'
      //   }
      //   const order = ["date", "loan_id", "user_id", "account_id", "before_paid", "amount", "paid"];

      //   const dataToAddOrder = Object.fromEntries(
      //     order.filter(key => key in dataToAdd).map(key => [key, dataToAdd[key]])
      //   );
      //   await db.create(tableName, dataToAddOrder);

      //   await db.update("ExternalLoans", loan_id, { paid: dataToAdd['paid'], status: loanStatus })
      // }
      
      await db.create(tableName, dataToAdd);
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
