export type ComparisonMode =
  | "exact"
  | "unordered_array"
  | "unordered_nested_array"
  | "float_tolerance"
  | "custom_checker";

export type ComparisonConfig =
  | { mode: "exact" }
  | { mode: "unordered_array" }
  | { mode: "unordered_nested_array" }
  | { mode: "float_tolerance"; epsilon: number }
  | { mode: "custom_checker"; checkerCode: string };
