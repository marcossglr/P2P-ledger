use rusqlite::Connection;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BankAccountSummary {
    pub id: i64,
    pub name: String,
    pub binance_pay_id: String,
    pub pay_method_identifier: String,
    pub account_alias: String,
    pub fiat_currency: String,
    pub match_keywords: String,
    pub is_default: bool,
    pub is_active: bool,
    pub apply_buy_fee: bool,
    pub pago_movil_fee_pct: f64,
    pub transfer_fee_pct: f64,
    pub anchor_balance: f64,
    pub anchor_timestamp: i64,
    pub anchor_date_label: String,
    pub manual_delta_bs: f64,
    pub calculated_balance: f64,
    pub inflow_sell_bs: f64,
    pub outflow_buy_bs: f64,
    pub outflow_buy_fees_bs: f64,
    pub net_orders_flow_bs: f64,
    pub total_historical_orders: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BankInventorySummary {
    pub accounts: Vec<BankAccountSummary>,
    pub consolidated: ConsolidatedStats,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConsolidatedStats {
    pub total_calculated_balance_bs: f64,
    pub total_anchor_balance_bs: f64,
    pub total_inflow_sell_bs: f64,
    pub total_outflow_buy_bs: f64,
    pub total_outflow_fees_bs: f64,
    pub total_manual_delta_bs: f64,
    pub active_accounts_count: usize,
}

pub fn compute_bank_inventory_summary(conn: &Connection) -> Result<BankInventorySummary, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, binance_pay_id, pay_method_identifier, name, fiat_currency, is_active,
                account_alias, match_keywords, is_default, apply_buy_fee, pago_movil_fee_pct,
                transfer_fee_pct, anchor_balance, anchor_timestamp, anchor_date_label,
                manual_delta_bs
         FROM bank_accounts
         WHERE is_active = 1
         ORDER BY is_default DESC, id ASC"
    )?;

    let account_rows = stmt.query_map([], |row| {
        Ok(BankAccountSummary {
            id: row.get(0)?,
            binance_pay_id: row.get(1)?,
            pay_method_identifier: row.get(2)?,
            name: row.get(3)?,
            fiat_currency: row.get(4)?,
            is_active: row.get::<_, i64>(5)? != 0,
            account_alias: row.get(6)?,
            match_keywords: row.get(7)?,
            is_default: row.get::<_, i64>(8)? != 0,
            apply_buy_fee: row.get::<_, i64>(9)? != 0,
            pago_movil_fee_pct: row.get(10)?,
            transfer_fee_pct: row.get(11)?,
            anchor_balance: row.get(12)?,
            anchor_timestamp: row.get(13)?,
            anchor_date_label: row.get(14)?,
            manual_delta_bs: row.get(15)?,
            calculated_balance: row.get(12)?, // Base
            inflow_sell_bs: 0.0,
            outflow_buy_bs: 0.0,
            outflow_buy_fees_bs: 0.0,
            net_orders_flow_bs: 0.0,
            total_historical_orders: 0,
        })
    })?;

    let mut accounts = Vec::new();
    for acc in account_rows {
        accounts.push(acc?);
    }

    let mut total_calculated_balance_bs = 0.0;
    let mut total_anchor_balance_bs = 0.0;
    let mut total_inflow_sell_bs = 0.0;
    let mut total_outflow_buy_bs = 0.0;
    let mut total_outflow_fees_bs = 0.0;
    let mut total_manual_delta_bs = 0.0;

    for acc in &mut accounts {
        // Consultar movimientos posteriores al anchor_timestamp para esta cuenta
        let mut order_stmt = conn.prepare(
            "SELECT order_type, fiat_amount, payment_channel
             FROM binance_orders
             WHERE bank_account_id = ?1
               AND create_timestamp > ?2
               AND order_status = 'COMPLETED'"
        )?;

        let orders = order_stmt.query_map([acc.id, acc.anchor_timestamp], |row| {
            let order_type: String = row.get(0)?;
            let fiat_amount: f64 = row.get(1)?;
            let payment_channel: Option<String> = row.get(2)?;
            Ok((order_type, fiat_amount, payment_channel))
        })?;

        let mut inflow = 0.0;
        let mut outflow = 0.0;
        let mut fees = 0.0;

        for o in orders {
            let (order_type, fiat_amount, payment_channel) = o?;
            if order_type == "VENTA" {
                inflow += fiat_amount;
            } else if order_type == "COMPRA" {
                outflow += fiat_amount;
                if acc.apply_buy_fee {
                    let channel = payment_channel.unwrap_or_else(|| "TRANSFERENCIA".to_string());
                    if channel == "PAGO_MOVIL" || channel == "TRANSFERENCIA_INTERBANCARIA" {
                        let calc_fee = (fiat_amount * (acc.pago_movil_fee_pct / 100.0)).round();
                        fees += calc_fee.max(14.0); // 14 VES piso mínimo SUDEBAN
                    }
                }
            }
        }

        let net_flow = inflow - outflow - fees;
        let calculated = acc.anchor_balance + net_flow + acc.manual_delta_bs;

        acc.inflow_sell_bs = (inflow * 100.0).round() / 100.0;
        acc.outflow_buy_bs = (outflow * 100.0).round() / 100.0;
        acc.outflow_buy_fees_bs = (fees * 100.0).round() / 100.0;
        acc.net_orders_flow_bs = (net_flow * 100.0).round() / 100.0;
        acc.calculated_balance = (calculated * 100.0).round() / 100.0;

        // Conteo histórico total de órdenes
        let total_orders: i64 = conn.query_row(
            "SELECT count(*) FROM binance_orders WHERE bank_account_id = ?1",
            [acc.id],
            |r| r.get(0),
        ).unwrap_or(0);
        acc.total_historical_orders = total_orders;

        total_calculated_balance_bs += acc.calculated_balance;
        total_anchor_balance_bs += acc.anchor_balance;
        total_inflow_sell_bs += acc.inflow_sell_bs;
        total_outflow_buy_bs += acc.outflow_buy_bs;
        total_outflow_fees_bs += acc.outflow_buy_fees_bs;
        total_manual_delta_bs += acc.manual_delta_bs;
    }

    Ok(BankInventorySummary {
        consolidated: ConsolidatedStats {
            total_calculated_balance_bs: (total_calculated_balance_bs * 100.0).round() / 100.0,
            total_anchor_balance_bs: (total_anchor_balance_bs * 100.0).round() / 100.0,
            total_inflow_sell_bs: (total_inflow_sell_bs * 100.0).round() / 100.0,
            total_outflow_buy_bs: (total_outflow_buy_bs * 100.0).round() / 100.0,
            total_outflow_fees_bs: (total_outflow_fees_bs * 100.0).round() / 100.0,
            total_manual_delta_bs: (total_manual_delta_bs * 100.0).round() / 100.0,
            active_accounts_count: accounts.len(),
        },
        accounts,
    })
}
