export interface BranchInfo {
  branch_route: string;
  branch: string;
  branch_name: string;
}

export interface OperationInfo {
  operation_code: string;
  operation: string;
}

export interface MainOrderRow {
  id: string | number;
  number: string | number;

  asset_code: string | null;
  asset_plate: string | null;

  asset_family_name: string | null;
  asset_family: string | null;

  branch_route: string;
  branch: string | null;
  branch_name: string | null;

  operation_code: string | null;
  operation: string | null;

  group_branch: string | null;

  service_code: string | null;

  status_description: string | null;
  status: string | number | null;

  INICIOPARADA: string | null;
  PREVTERMINO: string | null;

  resp_register_name: string | null;
}

export interface AssetFamilySummary {
  family: string | null;
  family_name: string | null;
  total_plates: number;
}
