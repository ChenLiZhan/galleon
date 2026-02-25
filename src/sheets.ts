import { google } from 'googleapis';
import { config } from './config.js';
import type { Holding } from './types.js';

const HEADERS = ['user', 'stock_code', 'amount', 'avg_price', 'market', 'updated_at', 'group_id'];
const SHEET_NAME = 'Holdings';

const auth = new google.auth.JWT({
  email: config.googleServiceAccountEmail,
  key: config.googlePrivateKey,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

async function ensureHeaders(): Promise<void> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: config.spreadsheetId,
    range: `${SHEET_NAME}!A1:G1`,
  });

  if (!res.data.values || res.data.values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: config.spreadsheetId,
      range: `${SHEET_NAME}!A1:G1`,
      valueInputOption: 'RAW',
      requestBody: { values: [HEADERS] },
    });
  }
}

export async function getHoldings(user: string, groupId: string): Promise<Holding[]> {
  await ensureHeaders();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: config.spreadsheetId,
    range: `${SHEET_NAME}!A:G`,
  });

  const rows = res.data.values;
  if (!rows || rows.length <= 1) return [];

  return rows
    .slice(1)
    .filter(
      (row) =>
        row.length >= 7 &&
        row[0].toLowerCase() === user.toLowerCase() &&
        row[6] === groupId &&
        !isNaN(Number(row[2])),
    )
    .map((row) => ({
      groupId: row[6],
      user: row[0],
      stockCode: row[1],
      amount: Number(row[2]),
      avgPrice: Number(row[3]),
      market: row[4] as Holding['market'],
      updatedAt: row[5],
    }));
}

async function findRowIndex(user: string, stockCode: string, groupId: string): Promise<number> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: config.spreadsheetId,
    range: `${SHEET_NAME}!A:G`,
  });

  const rows = res.data.values;
  if (!rows || rows.length <= 1) return -1;

  const dataIndex = rows
    .slice(1)
    .findIndex(
      (row) =>
        row.length >= 7 &&
        row[0].toLowerCase() === user.toLowerCase() &&
        row[1] === stockCode &&
        row[6] === groupId,
    );
  return dataIndex === -1 ? -1 : dataIndex + 1;
}

export async function upsertHolding(holding: Holding): Promise<void> {
  await ensureHeaders();

  const rowIndex = await findRowIndex(holding.user, holding.stockCode, holding.groupId);
  const rowData = [
    holding.user,
    holding.stockCode,
    holding.amount,
    holding.avgPrice,
    holding.market,
    holding.updatedAt,
    holding.groupId,
  ];

  if (rowIndex === -1) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: config.spreadsheetId,
      range: `${SHEET_NAME}!A:G`,
      valueInputOption: 'RAW',
      requestBody: { values: [rowData] },
    });
  } else {
    const row = rowIndex + 1;
    await sheets.spreadsheets.values.update({
      spreadsheetId: config.spreadsheetId,
      range: `${SHEET_NAME}!A${row}:G${row}`,
      valueInputOption: 'RAW',
      requestBody: { values: [rowData] },
    });
  }
}

export async function deleteHolding(
  user: string,
  stockCode: string,
  groupId: string,
): Promise<void> {
  const rowIndex = await findRowIndex(user, stockCode, groupId);
  if (rowIndex === -1) return;

  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: config.spreadsheetId,
  });

  const sheet = spreadsheet.data.sheets?.find((s) => s.properties?.title === SHEET_NAME);
  if (sheet?.properties?.sheetId == null) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: config.spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: sheet.properties.sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex,
              endIndex: rowIndex + 1,
            },
          },
        },
      ],
    },
  });
}
