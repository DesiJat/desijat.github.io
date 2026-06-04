const DEFAULT_LIMIT = 10;

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


    if (columns.length) {
      const finalColumns = [
        ...new Set([
          ...columns,
          "createdAt",
          "updatedAt"
        ])
      ];
      // sheet.appendRow(["id", ...columns]);
      sheet.appendRow(["id", ...finalColumns]);
    }


  }

  return sheet;
}

function getHeaders(sheet) {
  return sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
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
