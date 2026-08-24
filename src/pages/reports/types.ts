export type ReportColumn = {
  key: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'datetime' | 'boolean' | 'enum';
  sortable: boolean;
  aggregatable: boolean;
  operators: string[];
  options: string[] | null;
};

export type ReportDataset = {
  key: string;
  label: string;
  category: string;
  description: string;
  permissions: string[];
  columns: ReportColumn[];
  default_columns: string[];
  default_sort: { field: string; dir: 'asc' | 'desc' }[];
};

export type ReportFilter = {
  field: string;
  op: string;
  value?: unknown;
};

export type ReportAggregation = {
  fn: 'count' | 'sum' | 'avg' | 'min' | 'max';
  field: string;
  as: string;
};

export type ReportSort = {
  field: string;
  dir: 'asc' | 'desc';
};

export type ReportDefinition = {
  dataset: string;
  columns: string[];
  filters: ReportFilter[];
  group_by: string[];
  aggregations: ReportAggregation[];
  sorts: ReportSort[];
};

export type SavedReport = {
  id: number;
  name: string;
  description?: string | null;
  dataset_key: string;
  definition: ReportDefinition;
  visibility: 'private' | 'shared';
  created_by: number | null;
  creator?: { id: number; name: string; email: string } | null;
  created_at?: string;
  updated_at?: string;
};

export type ReportRunResult = {
  dataset: string;
  columns: { key: string; label: string }[];
  rows: Record<string, string>[];
  meta: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
    from: number | null;
    to: number | null;
  };
  filter_summary: string[];
};

export function emptyDefinition(dataset: ReportDataset): ReportDefinition {
  return {
    dataset: dataset.key,
    columns: [...dataset.default_columns],
    filters: [],
    group_by: [],
    aggregations: [],
    sorts: dataset.default_sort.map((sort) => ({ field: sort.field, dir: sort.dir })),
  };
}

export function operatorLabel(op: string) {
  return ({
    eq: 'equals',
    neq: 'does not equal',
    contains: 'contains',
    in: 'is one of',
    gt: 'greater than',
    gte: 'at least',
    lt: 'less than',
    lte: 'at most',
    between: 'between',
    is_null: 'is empty',
    is_not_null: 'is not empty',
  } as Record<string, string>)[op] || op;
}
