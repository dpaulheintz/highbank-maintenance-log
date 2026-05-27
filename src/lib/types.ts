export type Category =
  | "Equipment"
  | "Plumbing"
  | "HVAC"
  | "Electrical"
  | "Structural"
  | "Cleaning"
  | "Pest";

export type Priority = "Low" | "Medium" | "High" | "Emergency";

export type Status = "Open" | "In Progress" | "Awaiting Parts" | "Complete";

export interface Location {
  id: string;
  name: string;
}

export interface Vendor {
  id: string;
  name: string;
}

export interface Issue {
  id: string;
  title: string;
  description: string | null;
  location_id: string;
  category: Category;
  priority: Priority;
  status: Status;
  owner: string | null;
  vendor_id: string | null;
  due_date: string | null;
  reported_by: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface IssueWithVendor extends Issue {
  vendors: Vendor | null;
}

export interface Comment {
  id: string;
  issue_id: string;
  author: string;
  body: string;
  created_at: string;
}
