const DEFAULT_LIMIT = 10;
const JWT_SECRET = "your-very-secure-family-khata-secret-key-2026";

function verifyJwt(token) {
  // Developer/test bypass support
  if (token === JWT_SECRET) {
    return { sub: "test-bypass", test: true };
  }
  
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const header = parts[0];
  const payload = parts[1];
  const signature = parts[2];

  // Validate HMAC-SHA256 signature
  const rawSignature = Utilities.computeHmacSha256Signature(header + "." + payload, JWT_SECRET);
  const expectedSignature = Utilities.base64EncodeWebSafe(rawSignature).replace(/=+$/, "");

  if (signature !== expectedSignature) {
    return null;
  }

  // Base64 WebSafe Decode
  const decodedPayloadStr = Utilities.newBlob(Utilities.base64DecodeWebSafe(payload)).getDataAsString();
  const payloadObj = JSON.parse(decodedPayloadStr);

  // Check expiration
  if (payloadObj.exp && payloadObj.exp < Date.now() / 1000) {
    return null;
  }

  return payloadObj;
}

function nowIST() {
  return new Date()
    .toLocaleString(
      "en-IN",
      { timeZone: "Asia/Kolkata", hour12: true }
    );
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || "{}");

    // Enforce JWT validation
    const tokenPayload = verifyJwt(body.token);
    if (!tokenPayload) {
      return json({
        success: false,
        error: "UNAUTHORIZED: Invalid or missing token"
      });
    }

    switch (body.action) {
      case "create":
        return json(createRecord(body));

      case "read":
        return json(readRecords(body));

      case "update":
        return json(updateRecord(body));

      case "bulkUpdate":
        return json(bulkUpdate(body));

      case "delete":
        return json(deleteRecord(body));

      default:
        return json({
          success: false,
          error: "INVALID_ACTION"
        });
    }


  } catch (err) {
    return json({
      success: false,
      error: err.message
    });
  }
}

function json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet(name, columns = []) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }

  // If the sheet exists but has no rows (e.g. newly created by a query with empty columns),
  // initialize headers if columns are provided.
  if (sheet.getLastRow() < 1 && columns.length) {
    const finalColumns = [
      ...new Set([
        ...columns,
        "createdAt",
        "updatedAt"
      ])
    ];
    sheet.appendRow(["id", ...finalColumns]);
  }

  return sheet;
}

function getHeaders(sheet) {
  const lastCol = sheet.getLastColumn();
  if (lastCol < 1) {
    return [];
  }
  return sheet
    .getRange(1, 1, 1, lastCol)
    .getValues()[0];
}

function sheetToObjects(sheetName) {

  const sheet = getSheet(sheetName);

  if (sheet.getLastRow() < 1) {
    return [];
  }

  const headers = getHeaders(sheet);

  return sheet
    .getDataRange()
    .getValues()
    .slice(1)
    .map(row => {


      const obj = {};

      headers.forEach((h, i) => {
        obj[h] = row[i];
      });

      return obj;
    });


}

function nextId(sheet) {

  const rows = sheet.getLastRow();

  if (rows <= 1) return 1;

  const ids = sheet
    .getRange(2, 1, rows - 1, 1)
    .getValues()
    .flat()
    .map(Number)
    .filter(Boolean);

  return ids.length
    ? Math.max(...ids) + 1
    : 1;
}

function createRecord(body) {
  // Validate uniqueness for member credentials on the server side
  if (body.sheet === "members" && body.data) {
    const list = sheetToObjects("members");
    const newPhone = String(body.data.phone || "").trim();
    const newEmail = String(body.data.email || "").trim().toLowerCase();

    if (newPhone) {
      const phoneExists = list.some(function(m) {
        return String(m.phone || "").trim() === newPhone;
      });
      if (phoneExists) {
        return { success: false, error: "Phone number already exists!" };
      }
    }

    if (newEmail) {
      const emailExists = list.some(function(m) {
        return String(m.email || "").trim().toLowerCase() === newEmail;
      });
      if (emailExists) {
        return { success: false, error: "Email address already exists!" };
      }
    }
  }

  const now = nowIST();

  body.data.createdAt = now;
  body.data.updatedAt = now;

  const cols =
    body.columns ||
    Object.keys(body.data || {});

  const sheet =
    getSheet(body.sheet, cols);

  const headers =
    getHeaders(sheet);

  const id =
    nextId(sheet);

  const row =
    headers.map(h =>
      h === "id"
        ? id
        : body.data?.[h] ?? ""
    );

  sheet.appendRow(row);

  return {
    success: true,
    id
  };
}

function applyWhere(data, where = []) {

  if (!where.length) return data;

  return data.filter(row =>
    where.every(rule => {


      const value =
        row[rule.field];

      switch (rule.operator) {

        case "=":
          return value == rule.value;

        case "!=":
          return value != rule.value;

        case ">":
          return Number(value) > Number(rule.value);

        case "<":
          return Number(value) < Number(rule.value);

        case ">=":
          return Number(value) >= Number(rule.value);

        case "<=":
          return Number(value) <= Number(rule.value);

        case "contains":
          return String(value)
            .toLowerCase()
            .includes(
              String(rule.value)
                .toLowerCase()
            );

        default:
          return true;
      }
    })


  );
}

function applySort(data, field, direction = "asc") {

  if (!field) return data;

  return data.sort((a, b) => {


    if (a[field] < b[field]) {
      return direction === "desc" ? 1 : -1;
    }

    if (a[field] > b[field]) {
      return direction === "desc" ? -1 : 1;
    }

    return 0;


  });
}

function applySelect(data, fields) {

  if (!fields || !fields.length) {
    return data;
  }

  return data.map(row => {


    const obj = {};

    fields.forEach(field => {
      obj[field] = row[field];
    });

    return obj;


  });
}

function applyJoins(data, joins = []) {

  joins.forEach(join => {


    let foreignData =
      sheetToObjects(join.sheet);

    if (join.join) {
      foreignData =
        applyJoins(
          foreignData,
          join.join
        );
    }

    if (join.type === "many") {

      data.forEach(row => {

        row[join.as] =
          foreignData.filter(
            x =>
              String(
                x[join.foreignKey]
              ) ===
              String(
                row[join.localKey]
              )
          );
      });

    } else {

      const map = {};

      foreignData.forEach(item => {
        map[
          item[join.foreignKey]
        ] = item;
      });

      data.forEach(row => {

        row[join.as] =
          map[
          row[join.localKey]
          ] || null;
      });
    }


  });

  return data;
}

function aggregate(data, config) {

  const values =
    data.map(
      x => Number(
        x[config.field]
      )
    );

  switch (config.type) {


    case "count":
      return {
        count: data.length
      };

    case "sum":
      return {
        sum:
          values.reduce(
            (a, b) => a + b,
            0
          )
      };

    case "avg":
      return {
        avg:
          values.length
            ? values.reduce(
              (a, b) => a + b,
              0
            ) / values.length
            : 0
      };

    case "min":
      return {
        min: Math.min(...values)
      };

    case "max":
      return {
        max: Math.max(...values)
      };


  }

  return {};
}

function readRecords(body) {

  let data =
    sheetToObjects(
      body.sheet
    );

  data =
    applyJoins(
      data,
      body.join || []
    );

  data =
    applyWhere(
      data,
      body.where || []
    );

  if (body.search) {


    const search =
      body.search.toLowerCase();

    data =
      data.filter(row =>
        JSON.stringify(row)
          .toLowerCase()
          .includes(search)
      );


  }

  data =
    applySort(
      data,
      body.orderBy,
      body.direction
    );

  if (body.aggregate) {


    return {
      success: true,
      result:
        aggregate(
          data,
          body.aggregate
        )
    };


  }

  data =
    applySelect(
      data,
      body.select
    );

  const page =
    Number(body.page || 1);

  const limit =
    Number(
      body.limit ||
      DEFAULT_LIMIT
    );

  const total =
    data.length;

  return {
    success: true,
    page,
    limit,
    total,
    totalPages:
      Math.ceil(total / limit),
    data:
      data.slice(
        (page - 1) * limit,
        page * limit
      )
  };
}

function updateRecord(body) {
  // Validate uniqueness for member credentials on the server side for update
  if (body.sheet === "members" && body.data) {
    const list = sheetToObjects("members");
    const newPhone = String(body.data.phone || "").trim();
    const newEmail = String(body.data.email || "").trim().toLowerCase();

    if (newPhone) {
      const phoneExists = list.some(function(m) {
        return String(m.id) !== String(body.id) && String(m.phone || "").trim() === newPhone;
      });
      if (phoneExists) {
        return { success: false, error: "Phone number already exists!" };
      }
    }

    if (newEmail) {
      const emailExists = list.some(function(m) {
        return String(m.id) !== String(body.id) && String(m.email || "").trim().toLowerCase() === newEmail;
      });
      if (emailExists) {
        return { success: false, error: "Email address already exists!" };
      }
    }
  }

  const sheet =
    getSheet(body.sheet);

  const headers =
    getHeaders(sheet);

  const rows =
    sheet.getDataRange()
      .getValues();

  for (let i = 1; i < rows.length; i++) {


    if (
      String(rows[i][0]) ===
      String(body.id)
    ) {
      body.data.updatedAt = nowIST();
      headers.forEach((h, c) => {

        if (
          h !== "id" &&
          body.data &&
          Object.prototype.hasOwnProperty.call(
            body.data,
            h
          )
        ) {

          rows[i][c] =
            body.data[h];
        }
      });

      sheet
        .getRange(
          1,
          1,
          rows.length,
          rows[0].length
        )
        .setValues(rows);

      return {
        success: true
      };
    }


  }

  return {
    success: false,
    error: "NOT_FOUND"
  };
}

function bulkUpdate(body) {
  body.records.forEach(r => {
    updateRecord({
      sheet: body.sheet,
      id: r.id,
      data: r.data
    });
  });

  return {
    success: true
  };
}

function deleteRecord(body) {

  const sheet =
    getSheet(body.sheet);

  const rows =
    sheet.getDataRange()
      .getValues();

  for (let i = 1; i < rows.length; i++) {


    if (
      String(rows[i][0]) ===
      String(body.id)
    ) {

      sheet.deleteRow(i + 1);

      return {
        success: true
      };
    }


  }

  return {
    success: false
  };
}
