export const DATA_TABLE_NAMES = ["users", "positions", "api_tokens", "sessions"] as const;

export type DataTableName = (typeof DATA_TABLE_NAMES)[number];

type ColumnDef = {
  name: string;
  display?: "raw" | "presence" | "mask" | "truncate";
};

type TableDef = {
  name: DataTableName;
  label: string;
  description: string;
  columns: ColumnDef[];
  orderBy: string;
  filterableByUser: boolean;
};

export const DATA_TABLES: Record<DataTableName, TableDef> = {
  users: {
    name: "users",
    label: "users",
    description: "Web / API 共通ユーザー",
    columns: [
      { name: "id" },
      { name: "name" },
      { name: "email" },
      { name: "password_hash", display: "presence" },
      { name: "created_at" },
      { name: "updated_at" },
    ],
    orderBy: "id ASC",
    filterableByUser: false,
  },
  positions: {
    name: "positions",
    label: "positions",
    description: "位置情報",
    columns: [
      { name: "id" },
      { name: "user_id" },
      { name: "latitude" },
      { name: "longitude" },
      { name: "accuracy" },
      { name: "recorded_at" },
      { name: "created_at" },
      { name: "updated_at" },
    ],
    orderBy: "id DESC",
    filterableByUser: true,
  },
  api_tokens: {
    name: "api_tokens",
    label: "api_tokens",
    description: "端末向け API トークン",
    columns: [
      { name: "id" },
      { name: "user_id" },
      { name: "name" },
      { name: "token_hash", display: "mask" },
      { name: "created_at" },
      { name: "last_used_at" },
    ],
    orderBy: "id DESC",
    filterableByUser: true,
  },
  sessions: {
    name: "sessions",
    label: "sessions",
    description: "Web セッション",
    columns: [
      { name: "id", display: "truncate" },
      { name: "user_id" },
      { name: "expires_at" },
      { name: "created_at" },
    ],
    orderBy: "created_at DESC",
    filterableByUser: true,
  },
};

export const DEFAULT_TABLE: DataTableName = "positions";
export const TABLE_PAGE_SIZE = 50;

export type TableSummary = {
  name: DataTableName;
  label: string;
  description: string;
  count: number;
};

export type TableBrowseResult = {
  table: DataTableName;
  label: string;
  description: string;
  columns: string[];
  rows: Record<string, string>[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  userId: number | null;
  filterableByUser: boolean;
};

export function isDataTableName(value: string | undefined): value is DataTableName {
  return DATA_TABLE_NAMES.includes(value as DataTableName);
}

export function formatCellValue(
  value: unknown,
  display: ColumnDef["display"] = "raw",
): string {
  if (value == null || value === "") {
    if (display === "presence") {
      return "未設定";
    }
    return "";
  }

  const text = String(value);

  switch (display) {
    case "presence":
      return "設定済み";
    case "mask":
      return "••••••••";
    case "truncate":
      return text.length > 12 ? `${text.slice(0, 8)}…` : text;
    default:
      return text;
  }
}

export async function listTableSummaries(db: D1Database): Promise<TableSummary[]> {
  const summaries: TableSummary[] = [];

  for (const name of DATA_TABLE_NAMES) {
    const def = DATA_TABLES[name];
    const row = await db.prepare(`SELECT COUNT(*) AS count FROM ${name}`).first<{ count: number }>();
    summaries.push({
      name,
      label: def.label,
      description: def.description,
      count: Number(row?.count ?? 0),
    });
  }

  return summaries;
}

export async function browseTable(
  db: D1Database,
  table: DataTableName,
  options?: { page?: number; userId?: number | null; perPage?: number },
): Promise<TableBrowseResult> {
  const def = DATA_TABLES[table];
  const perPage = options?.perPage ?? TABLE_PAGE_SIZE;
  const page = Math.max(1, options?.page ?? 1);
  const userId = def.filterableByUser && options?.userId != null ? options.userId : null;

  const columnSql = def.columns.map((col) => col.name).join(", ");
  const whereSql = userId != null ? " WHERE user_id = ?" : "";
  const bindings = userId != null ? [userId] : [];

  const countRow = await db
    .prepare(`SELECT COUNT(*) AS count FROM ${table}${whereSql}`)
    .bind(...bindings)
    .first<{ count: number }>();
  const total = Number(countRow?.count ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * perPage;

  const result = await db
    .prepare(
      `SELECT ${columnSql} FROM ${table}${whereSql} ORDER BY ${def.orderBy} LIMIT ? OFFSET ?`,
    )
    .bind(...bindings, perPage, offset)
    .all<Record<string, unknown>>();

  const rows = (result.results ?? []).map((row) => {
    const displayed: Record<string, string> = {};
    for (const col of def.columns) {
      displayed[col.name] = formatCellValue(row[col.name], col.display);
    }
    return displayed;
  });

  return {
    table,
    label: def.label,
    description: def.description,
    columns: def.columns.map((col) => col.name),
    rows,
    total,
    page: safePage,
    perPage,
    totalPages,
    userId,
    filterableByUser: def.filterableByUser,
  };
}
