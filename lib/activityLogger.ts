/**
 * Global Activity Logger Helper
 * Automatically logs user interactions to TiDB Cloud activity_logs table
 */

export interface LogPayload {
  user_name?: string;
  user_email?: string;
  action_type: 
    | "PRINT_FAKTUR" 
    | "UNPRINT_FAKTUR" 
    | "CREATE_RETURN" 
    | "UPDATE_RETURN" 
    | "RESOLVE_RETURN" 
    | "DELETE_RETURN" 
    | "UPDATE_CUSTOMER" 
    | "CREATE_CUSTOMER" 
    | "DELETE_CUSTOMER" 
    | "UPDATE_PERMISSIONS" 
    | "LOGIN" 
    | "LOGOUT" 
    | "EXPORT_DATA"
    | "GENERAL";
  module: "FAKTUR" | "SHIPMENT_ERROR" | "CUSTOMERS" | "PRODUCTS" | "AUTH" | "SETTINGS" | "SYSTEM";
  target_id?: string;
  details: string;
  metadata?: Record<string, any>;
}

export async function recordActivityLog(payload: LogPayload): Promise<void> {
  try {
    // If user_name not provided, try to read from localStorage session
    let userName = payload.user_name;
    let userEmail = payload.user_email;

    if (!userName && typeof window !== "undefined") {
      try {
        const stored = sessionStorage.getItem("faktur_tracker_user") || localStorage.getItem("faktur_tracker_user");
        if (stored) {
          const parsed = JSON.parse(stored);
          userName = parsed.name || parsed.username;
          userEmail = parsed.email || "";
        }
      } catch {}
    }

    await fetch("/api/tidb?action=log_activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        user_name: userName || "Admin",
        user_email: userEmail || "",
      }),
    });
  } catch (err) {
    console.warn("Failed to record activity log:", err);
  }
}
