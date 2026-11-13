use log::info;
use rusqlite::params;
use serde::Deserialize;
use tauri::State;
use crate::db::DbState;
use crate::services::bank_inventory::{compute_bank_inventory_summary, BankInventorySummary};

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct CreateAccountPayload {
    pub bank_name: String,
    pub account_number: Option<String>,
    pub currency: Option<String>,
    pub initial_balance: Option<f64>,
    pub color: Option<String>,
    pub binance_pay_email: Option<String>,
    pub binance_pay_id: Option<String>,
    pub is_binance_pay: Option<bool>,
    pub is_default: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct UpdateAccountPayload {
    pub name: String,
    pub account_alias: Option<String>,
    pub fiat_currency: Option<String>,
    pub binance_pay_id: Option<String>,
    pub pay_method_identifier: Option<String>,
    pub match_keywords: Option<String>,
    pub is_default: Option<bool>,
    pub is_active: Option<bool>,
    pub apply_buy_fee: Option<bool>,
    pub pago_movil_fee_pct: Option<f64>,
    pub transfer_fee_pct: Option<f64>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct ReconcileAccountPayload {
    pub account_id: i64,
    pub mode: String, // "CUADRE_CONSOLIDADO" | "MOVIMIENTO_MANUAL" | etc.
    pub amount: f64,
    pub note: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AssignOrderPayload {
    pub order_id: i64,
    pub bank_account_id: Option<i64>,
}

#[tauri::command]
pub fn get_bank_inventory(state: State<'_, DbState>) -> Result<BankInventorySummary, String> {
    info!("[Banks] Consultando inventario bancario...");
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let summary = compute_bank_inventory_summary(&conn).map_err(|e| e.to_string())?;
    info!("[Banks] Inventario calculado: {} cuentas, balance consolidado: {:.2} Bs", summary.accounts.len(), summary.consolidated.total_calculated_balance_bs);
    Ok(summary)
}

#[tauri::command]
pub fn create_bank_account(
    payload: CreateAccountPayload,
    state: State<'_, DbState>,
) -> Result<BankInventorySummary, String> {
    info!("[Banks] Creando nueva cuenta bancaria: {}", payload.bank_name);
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let initial_balance = payload.initial_balance.unwrap_or(0.0);
    let currency = payload.currency.unwrap_or_else(|| "VES".to_string());
    let is_default = if payload.is_default.unwrap_or(false) { 1 } else { 0 };

    if is_default == 1 {
        let _ = conn.execute("UPDATE bank_accounts SET is_default = 0", []);
    }

    conn.execute(
        "INSERT INTO bank_accounts (
            name, binance_pay_id, fiat_currency, anchor_balance,
            anchor_date_label, is_default, is_active
         )
         VALUES (?1, ?2, ?3, ?4, 'Saldo Inicial Manual', ?5, 1)",
        params![
            payload.bank_name,
            payload.binance_pay_id.unwrap_or_default(),
            currency,
            initial_balance,
            is_default
        ],
    )
    .map_err(|e| e.to_string())?;

    compute_bank_inventory_summary(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_bank_account(
    account_id: i64,
    payload: UpdateAccountPayload,
    state: State<'_, DbState>,
) -> Result<BankInventorySummary, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    if payload.is_default.unwrap_or(false) {
        let _ = conn.execute("UPDATE bank_accounts SET is_default = 0 WHERE id != ?1", [account_id]);
    }

    conn.execute(
        "UPDATE bank_accounts SET
            name = ?1,
            account_alias = ?2,
            fiat_currency = ?3,
            binance_pay_id = ?4,
            pay_method_identifier = ?5,
            match_keywords = ?6,
            is_default = ?7,
            is_active = ?8,
            apply_buy_fee = ?9,
            pago_movil_fee_pct = ?10,
            transfer_fee_pct = ?11,
            updated_at = CURRENT_TIMESTAMP
         WHERE id = ?12",
        params![
            payload.name,
            payload.account_alias.unwrap_or_default(),
            payload.fiat_currency.unwrap_or_else(|| "VES".to_string()),
            payload.binance_pay_id.unwrap_or_default(),
            payload.pay_method_identifier.unwrap_or_default(),
            payload.match_keywords.unwrap_or_default(),
            if payload.is_default.unwrap_or(false) { 1 } else { 0 },
            if payload.is_active.unwrap_or(true) { 1 } else { 0 },
            if payload.apply_buy_fee.unwrap_or(true) { 1 } else { 0 },
            payload.pago_movil_fee_pct.unwrap_or(0.3),
            payload.transfer_fee_pct.unwrap_or(0.0),
            account_id
        ],
    )
    .map_err(|e| e.to_string())?;

    compute_bank_inventory_summary(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_bank_account(
    account_id: i64,
    state: State<'_, DbState>,
) -> Result<BankInventorySummary, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    // Soft delete: desactivar cuenta preservando integridad contable
    conn.execute("UPDATE bank_accounts SET is_active = 0, is_default = 0 WHERE id = ?1", [account_id])
        .map_err(|e| e.to_string())?;

    // Si no queda ninguna cuenta principal activa, promover la primera
    let default_count: i64 = conn.query_row(
        "SELECT count(*) FROM bank_accounts WHERE is_active = 1 AND is_default = 1",
        [],
        |r| r.get(0)
    ).unwrap_or(0);

    if default_count == 0 {
        let _ = conn.execute(
            "UPDATE bank_accounts SET is_default = 1 WHERE id = (SELECT id FROM bank_accounts WHERE is_active = 1 LIMIT 1)",
            []
        );
    }

    compute_bank_inventory_summary(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn reconcile_bank_account(
    payload: ReconcileAccountPayload,
    state: State<'_, DbState>,
) -> Result<BankInventorySummary, String> {
    info!("[Banks] Conciliando cuenta #{} (modo: {}, monto: {})", payload.account_id, payload.mode, payload.amount);
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;

    if payload.mode == "CUADRE_CONSOLIDADO" {
        // Fijar nuevo saldo ancla y corte de tiempo
        conn.execute(
            "UPDATE bank_accounts SET
                anchor_balance = ?1,
                anchor_timestamp = ?2,
                manual_delta_bs = 0.0,
                anchor_date_label = 'Cuadre Manual',
                updated_at = CURRENT_TIMESTAMP
             WHERE id = ?3",
            params![payload.amount, now_ms, payload.account_id],
        )
        .map_err(|e| e.to_string())?;
    } else if payload.mode == "MOVIMIENTO_MANUAL" {
        conn.execute(
            "UPDATE bank_accounts SET
                manual_delta_bs = manual_delta_bs + ?1,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = ?2",
            params![payload.amount, payload.account_id],
        )
        .map_err(|e| e.to_string())?;
    }

    compute_bank_inventory_summary(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn assign_order_to_bank(
    payload: AssignOrderPayload,
    state: State<'_, DbState>,
) -> Result<BankInventorySummary, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE binance_orders SET bank_account_id = ?1 WHERE id = ?2",
        params![payload.bank_account_id, payload.order_id],
    )
    .map_err(|e| e.to_string())?;

    compute_bank_inventory_summary(&conn).map_err(|e| e.to_string())
}
