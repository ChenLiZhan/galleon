import { google } from 'googleapis';
import { config } from './config.js';
import type { Holding } from './types.js';

const HEADERS = ['user', 'stock_code', 'amount', 'avg_price', 'updated_at'];
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
    range: `${SHEET_NAME}!A1:E1`,
  });

  if (!res.data.values || res.data.values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: config.spreadsheetId,
      range: `${SHEET_NAME}!A1:E1`,
      valueInputOption: 'RAW',
      requestBody: { values: [HEADERS] },
    });
  }
}

export async function getHoldings(user: string): Promise<Holding[]> {
  await ensureHeaders();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: config.spreadsheetId,
    range: `${SHEET_NAME}!A:E`,
  });

  const rows = res.data.values;
  if (!rows || rows.length <= 1) return [];

  return rows
    .slice(1)
    .filter((row) => row.length >= 5 && row[0] === user && !isNaN(Number(row[2])))
    .map((row) => ({
      user: row[0],
      stockCode: row[1],
      amount: Number(row[2]),
      avgPrice: Number(row[3]),
      updatedAt: row[4],
    }));
}

async function findRowIndex(user: string, stockCode: string): Promise<number> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: config.spreadsheetId,
    range: `${SHEET_NAME}!A:B`,
  });

  const rows = res.data.values;
  if (!rows || rows.length <= 1) return -1;

  const dataIndex = rows.slice(1).findIndex((row) => row[0] === user && row[1] === stockCode);
  return dataIndex === -1 ? -1 : dataIndex + 1;
}

export async function upsertHolding(holding: Holding): Promise<void> {
  await ensureHeaders();

  const rowIndex = await findRowIndex(holding.user, holding.stockCode);
  const rowData = [
    holding.user,
    holding.stockCode,
    holding.amount,
    holding.avgPrice,
    holding.updatedAt,
  ];

  if (rowIndex === -1) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: config.spreadsheetId,
      range: `${SHEET_NAME}!A:E`,
      valueInputOption: 'RAW',
      requestBody: { values: [rowData] },
    });
  } else {
    const row = rowIndex + 1;
    await sheets.spreadsheets.values.update({
      spreadsheetId: config.spreadsheetId,
      range: `${SHEET_NAME}!A${row}:E${row}`,
      valueInputOption: 'RAW',
      requestBody: { values: [rowData] },
    });
  }
}

export async function deleteHolding(user: string, stockCode: string): Promise<void> {
  const rowIndex = await findRowIndex(user, stockCode);
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
