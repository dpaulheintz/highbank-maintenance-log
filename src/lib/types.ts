export type Category =
  | "Equipment"
  | "Plumbing"
  | "HVAC"
  | "Electrical"
  | "Structural"
  | "Cleaning"
  | "Pest"
  | "Other";

export type Priority = "Low" | "Medium" | "High" | "Emergency";

export type Status = "Open" | "In Progress" | "Awaiting Parts" | "Complete";

export type VendorCategory =
  | "Plumbing"
  | "HVAC"
  | "Facility Solutions & Equipment"
  | "Internet / Cable"
  | "Waste and Refuse"
  | "General Repair";

export interface Location {
  id: string;
  name: string;
}

export interface Vendor {
  id: string;
  name: string;
  contact: string | null;
  category: VendorCategory | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
}

export interface Employee {
  id: string;
  name: string;
  location: string | null;
  email: string | null;
  cell: string | null;
  role: string | null;
  created_at: string;
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
  owner_id: string | null;
  vendor_id: string | null;
  due_date: string | null;
  report_date: string | null;
  estimated_repair_date: string | null;
  manager_ids: string[];
  photo_urls: string[];
  reported_by: string | null;
  created_at: string;
  completed_at: string | null;
  archived: boolean;
  completion_date: string | null;
  vendor_name_custom: string | null;
}

export interface IssueWithRelations extends Issue {
  vendors: Vendor | null;
  employees: Employee | null;
}

export type ToastStatus = "Pending" | "Approved" | "Rejected";

export type ToastChangeType =
  | "Price Change"
  | "Item Name Change"
  | "Item Description Change"
  | "86 an Item"
  | "Add New Item"
  | "Modifier Change"
  | "Void/Comp Reason"
  | "Discount/Promo"
  | "Hours Change"
  | "Other";

export interface ToastRequest {
  id: string;
  submitter_name: string;
  submitter_email: string;
  location: string;
  change_type: ToastChangeType;
  menu_item_name: string | null;
  current_value: string | null;
  requested_change: string;
  notes_for_charles: string | null;
  photo_urls: string[];
  status: ToastStatus;
  rejection_reason: string | null;
  created_at: string;
  completed_at: string | null;
  archived: boolean;
}

export interface Comment {
  id: string;
  issue_id: string;
  author: string;
  body: string;
  is_update: boolean;
  created_at: string;
}
