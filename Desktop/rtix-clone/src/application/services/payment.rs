#![allow(dead_code)]

use crate::domain::error::AppResult;
use async_trait::async_trait;
use std::sync::Arc;

// ========================================================
// TrustNet Protocol — AI-Underwritten UPI Commerce
// ========================================================

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct PaymentResult {
    pub success: bool,
    pub transaction_id: String,
    pub amount: f64,
    pub gateway_id: Option<String>,
    pub escrow_held_until: Option<String>,
    pub settlement_tier: SettlementTier,
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, PartialEq)]
pub enum SettlementTier {
    Instant,
    Fast,
    Standard,
    Held,
    ManualReview,
}

impl SettlementTier {
    pub fn escrow_hours(&self) -> i64 {
        match self {
            SettlementTier::Instant => 0,
            SettlementTier::Fast => 2,
            SettlementTier::Standard => 24,
            SettlementTier::Held => 168,
            SettlementTier::ManualReview => 720,
        }
    }

    pub fn from_trust_score(score: f64) -> Self {
        match score {
            s if s >= 90.0 => SettlementTier::Instant,
            s if s >= 70.0 => SettlementTier::Fast,
            s if s >= 45.0 => SettlementTier::Standard,
            s if s >= 20.0 => SettlementTier::Held,
            _ => SettlementTier::ManualReview,
        }
    }

    pub fn platform_fee_multiplier(&self) -> f64 {
        match self {
            SettlementTier::Instant => 0.5,
            SettlementTier::Fast => 0.75,
            SettlementTier::Standard => 1.0,
            SettlementTier::Held => 1.5,
            SettlementTier::ManualReview => 2.0,
        }
    }
}

#[async_trait]
pub trait PaymentService: Send + Sync {
    async fn initiate_payment(
        &self,
        transaction_id: &str,
        buyer_name: &str,
        buyer_email: &str,
        buyer_phone: &str,
    ) -> AppResult<crate::interfaces::http::routes::payment::PaymentInitiateResponse>;
    async fn verify_utr(&self, transaction_id: &str, utr: &str) -> AppResult<PaymentResult>;
    async fn verify_merchant_utr(&self, transaction_id: &str, utr: &str) -> AppResult<PaymentResult>;
    async fn release_escrow(&self, transaction_id: &str, proof_token: &str) -> AppResult<PaymentResult>;
}

pub struct RtixPaymentService {
    order_repo: Arc<dyn crate::infrastructure::repositories::OrderRepository>,
    merchant_repo: Arc<dyn crate::infrastructure::repositories::MerchantRepository>,
    tx: tokio::sync::broadcast::Sender<crate::interfaces::http::api::RealtimeEvent>,
}

impl RtixPaymentService {
    pub fn new(
        order_repo: Arc<dyn crate::infrastructure::repositories::OrderRepository>,
        merchant_repo: Arc<dyn crate::infrastructure::repositories::MerchantRepository>,
        tx: tokio::sync::broadcast::Sender<crate::interfaces::http::api::RealtimeEvent>,
    ) -> Self {
        Self {
            order_repo,
            merchant_repo,
            tx,
        }
    }

    async fn resolve_settlement_tier(
        &self,
        merchant_id: &str,
    ) -> AppResult<SettlementTier> {
        let merchant = self
            .merchant_repo
            .find_by_id(merchant_id)
            .await?
            .ok_or_else(|| crate::domain::error::AppError::NotFound("Merchant not found".into()))?;

        Ok(SettlementTier::from_trust_score(merchant.trust_score))
    }
}

#[async_trait]
impl PaymentService for RtixPaymentService {
    async fn initiate_payment(
        &self,
        transaction_id: &str,
        buyer_name: &str,
        buyer_email: &str,
        buyer_phone: &str,
    ) -> AppResult<crate::interfaces::http::routes::payment::PaymentInitiateResponse> {
        let order = self.order_repo.find_by_id(transaction_id).await?;
        let order = order
            .ok_or_else(|| crate::domain::error::AppError::NotFound("Order not found".into()))?;

        let merchant = self
            .merchant_repo
            .find_by_id(&order.merchant_id)
            .await?
            .ok_or_else(|| crate::domain::error::AppError::NotFound("Merchant not found".into()))?;

        let settlement_tier = SettlementTier::from_trust_score(merchant.trust_score);
        let fee_multiplier = settlement_tier.platform_fee_multiplier();

        let platform_fee =
            crate::application::services::pricing::PricingEngine::calculate_platform_fee(
                order.price_inr,
                merchant.trust_score,
            ) * fee_multiplier;

        let base_merchant_amount =
            order.price_inr + order.delivery_fee + order.cgst + order.sgst + order.igst;

        let merchant_amount = if fee_multiplier < 1.0 {
            base_merchant_amount - (platform_fee * (1.0 - fee_multiplier) * 0.5)
        } else {
            base_merchant_amount
        };

        let platform_vpa = std::env::var("RTIX_UPI_ID").unwrap_or_else(|_| "rtix@upi".to_string());
        let merchant_vpa = merchant
            .upi_id
            .as_ref()
            .filter(|vpa| !vpa.trim().is_empty())
            .ok_or_else(|| crate::domain::error::AppError::BadRequest(
                "Merchant has not configured their UPI ID for payments. Please contact the merchant.".to_string()
            ))?
            .to_string();
        let platform_name =
            std::env::var("RTIX_MERCHANT_NAME").unwrap_or_else(|_| "rtix".to_string());

        let platform_upi_uri = format!(
            "upi://pay?pa={}&pn={}&am={:.2}&tr={}_fee&cu=INR",
            platform_vpa,
            urlencoding::encode(&platform_name),
            platform_fee,
            transaction_id
        );

        let merchant_upi_uri = format!(
            "upi://pay?pa={}&pn={}&am={:.2}&tr={}_cost&cu=INR",
            merchant_vpa,
            urlencoding::encode(&merchant.brand_name),
            merchant_amount,
            transaction_id
        );

        let razorpay_order_id = None;
        let razorpay_key_id = None;
        let amount_paise = None;

        let tier_name = format!("{:?}", settlement_tier);

        Ok(
            crate::interfaces::http::routes::payment::PaymentInitiateResponse {
                status: "UPI_SECURE_PAYMENT_READY".to_string(),
                txnid: transaction_id.to_string(),
                name: merchant.brand_name,
                description: format!("TrustNet Secure Order {}", transaction_id),
                prefill_name: buyer_name.to_string(),
                prefill_email: buyer_email.to_string(),
                prefill_contact: buyer_phone.to_string(),
                platform_upi_uri,
                merchant_upi_uri,
                platform_amount: format!("{:.2}", platform_fee),
                merchant_amount: merchant_amount.to_string(),
                platform_vpa,
                merchant_vpa,
                razorpay_order_id,
                razorpay_key_id,
                amount_paise,
                merchant_tier: Some(tier_name),
                trust_score: Some(merchant.trust_score),
            },
        )
    }

    async fn verify_utr(&self, transaction_id: &str, utr: &str) -> AppResult<PaymentResult> {
        tracing::info!(
            "TrustNet: Verifying Platform Fee UTR {} for transaction {}",
            utr,
            transaction_id
        );

        let pool = self.order_repo.find_pool();
        let mut tx = pool.begin().await.map_err(crate::domain::error::AppError::Database)?;

        let order = sqlx::query_as::<_, crate::domain::models::order::OrderRecord>(
            "SELECT transaction_id, merchant_id, link_id, buyer_phone, buyer_phone_hash, buyer_name, buyer_email, shipping_pincode, delivery_address, price_inr, status, vpa, outbound_weight, return_weight, proof_data, proof_received_at, settled_at, paid_at, shipped_at, delivered_at, shipping_method, estimated_delivery_at, payu_id, is_payment, platform_fee_paid, platform_fee, delivery_fee, distance_km, risk_score, risk_flags, cgst, sgst, igst, utr_number, platform_fee_utr, delivery_gps_lat, delivery_gps_lng, is_geofence_verified, pincode_volatility_at_checkout, discount_amount, coupon_code, checkout_gps_lat, checkout_gps_lng, device_fingerprint, created_at FROM orders WHERE transaction_id = $1 FOR UPDATE"
        )
        .bind(transaction_id)
        .fetch_optional(&mut *tx)
        .await?;

        let order = match order {
            Some(o) => {
                let mut o_mut: crate::domain::models::order::OrderRecord = o;
                o_mut.decrypt_pii();
                if o_mut.vpa.as_deref() == Some("") {
                    o_mut.vpa = None;
                }
                o_mut
            }
            None => {
                tx.rollback().await.map_err(crate::domain::error::AppError::Database)?;
                return Err(crate::domain::error::AppError::NotFound("Order not found".into()));
            }
        };

        if order.platform_fee_paid {
            tx.commit().await.map_err(crate::domain::error::AppError::Database)?;
            return Ok(PaymentResult {
                success: true,
                transaction_id: transaction_id.to_string(),
                amount: order.platform_fee,
                gateway_id: order.platform_fee_utr.clone().map(|u| format!("TRUSTNET_PLATFORM:{}", u)),
                escrow_held_until: None,
                settlement_tier: SettlementTier::Instant,
            });
        }

        let strategy = PaymentStrategyFactory::get_strategy("UTR");
        strategy.validate(utr)?;

        let duplicate_utr = sqlx::query(
            "SELECT transaction_id FROM orders WHERE (utr_number = $1 OR platform_fee_utr = $1) AND transaction_id != $2"
        )
        .bind(utr.trim())
        .bind(transaction_id)
        .fetch_optional(&mut *tx)
        .await?;

        if let Some(row) = duplicate_utr {
            use sqlx::Row;
            let existing_txn = row.get::<String, _>("transaction_id");
            let _ = crate::domain::audit::log_risk_event(
                &mut tx,
                Some(transaction_id),
                &order.merchant_id,
                "UTR_REPLAY_ATTACK",
                "CRITICAL",
                Some(&format!(
                    "TrustNet: UPI UTR {} was already spent on transaction {}. Denied double-fulfillment.",
                    utr.trim(), existing_txn
                )),
                None,
                None,
                order.device_fingerprint.as_deref(),
                Some(&self.tx),
            )
            .await;

            sqlx::query("UPDATE orders SET status = $1 WHERE transaction_id = $2")
                .bind(crate::domain::constants::ORDER_STATUS_PAYMENT_FAILED)
                .bind(transaction_id)
                .execute(&mut *tx)
                .await?;

            tx.commit().await.map_err(crate::domain::error::AppError::Database)?;
            return Err(crate::domain::error::AppError::Forbidden(
                "TrustNet: Double spend / UTR reuse detected".to_string(),
            ));
        }

        sqlx::query("UPDATE orders SET platform_fee_utr = $1, platform_fee_paid = TRUE WHERE transaction_id = $2")
            .bind(utr.trim())
            .bind(transaction_id)
            .execute(&mut *tx)
            .await?;

        tx.commit().await.map_err(crate::domain::error::AppError::Database)?;

        Ok(PaymentResult {
            success: true,
            transaction_id: transaction_id.to_string(),
            amount: order.platform_fee,
            gateway_id: Some(format!("TRUSTNET_PLATFORM:{}", utr.trim())),
            escrow_held_until: None,
            settlement_tier: SettlementTier::Instant,
        })
    }

    async fn verify_merchant_utr(&self, transaction_id: &str, utr: &str) -> AppResult<PaymentResult> {
        tracing::info!(
            "TrustNet: Verifying Merchant Payment UTR {} for transaction {}",
            utr,
            transaction_id
        );

        let pool = self.order_repo.find_pool();
        let mut tx = pool.begin().await.map_err(crate::domain::error::AppError::Database)?;

        let order = sqlx::query_as::<_, crate::domain::models::order::OrderRecord>(
            "SELECT transaction_id, merchant_id, link_id, buyer_phone, buyer_phone_hash, buyer_name, buyer_email, shipping_pincode, delivery_address, price_inr, status, vpa, outbound_weight, return_weight, proof_data, proof_received_at, settled_at, paid_at, shipped_at, delivered_at, shipping_method, estimated_delivery_at, payu_id, is_payment, platform_fee_paid, platform_fee, delivery_fee, distance_km, risk_score, risk_flags, cgst, sgst, igst, utr_number, platform_fee_utr, delivery_gps_lat, delivery_gps_lng, is_geofence_verified, pincode_volatility_at_checkout, discount_amount, coupon_code, checkout_gps_lat, checkout_gps_lng, device_fingerprint, created_at FROM orders WHERE transaction_id = $1 FOR UPDATE"
        )
        .bind(transaction_id)
        .fetch_optional(&mut *tx)
        .await?;

        let order = match order {
            Some(o) => {
                let mut o_mut: crate::domain::models::order::OrderRecord = o;
                o_mut.decrypt_pii();
                if o_mut.vpa.as_deref() == Some("") {
                    o_mut.vpa = None;
                }
                o_mut
            }
            None => {
                tx.rollback().await.map_err(crate::domain::error::AppError::Database)?;
                return Err(crate::domain::error::AppError::NotFound("Order not found".into()));
            }
        };

        if order.status != crate::domain::constants::ORDER_STATUS_PENDING_PAYMENT {
            tx.commit().await.map_err(crate::domain::error::AppError::Database)?;
            return Ok(PaymentResult {
                success: true,
                transaction_id: transaction_id.to_string(),
                amount: order.price_inr,
                gateway_id: order.utr_number.clone().map(|u| format!("TRUSTNET:{}", u)),
                escrow_held_until: None,
                settlement_tier: SettlementTier::Instant,
            });
        }

        let settlement_tier = self.resolve_settlement_tier(&order.merchant_id).await?;
        let escrow_hours = settlement_tier.escrow_hours();
        let escrow_until = if escrow_hours > 0 {
            use chrono::Utc;
            Some(Utc::now() + chrono::Duration::hours(escrow_hours))
        } else {
            None
        };

        let strategy = PaymentStrategyFactory::get_strategy("UTR");
        strategy.validate(utr)?;

        let duplicate_utr = sqlx::query(
            "SELECT transaction_id FROM orders WHERE (utr_number = $1 OR platform_fee_utr = $1) AND transaction_id != $2"
        )
        .bind(utr.trim())
        .bind(transaction_id)
        .fetch_optional(&mut *tx)
        .await?;

        if let Some(row) = duplicate_utr {
            use sqlx::Row;
            let existing_txn = row.get::<String, _>("transaction_id");
            let _ = crate::domain::audit::log_risk_event(
                &mut tx,
                Some(transaction_id),
                &order.merchant_id,
                "UTR_REPLAY_ATTACK",
                "CRITICAL",
                Some(&format!(
                    "TrustNet Replay Attack: UPI UTR {} already spent on transaction {}.",
                    utr.trim(), existing_txn
                )),
                None,
                None,
                order.device_fingerprint.as_deref(),
                Some(&self.tx),
            )
            .await;

            sqlx::query("UPDATE orders SET status = $1 WHERE transaction_id = $2")
                .bind(crate::domain::constants::ORDER_STATUS_PAYMENT_FAILED)
                .bind(transaction_id)
                .execute(&mut *tx)
                .await?;

            tx.commit().await.map_err(crate::domain::error::AppError::Database)?;
            return Err(crate::domain::error::AppError::Forbidden(
                "TrustNet: Double spend / UTR reuse detected".to_string(),
            ));
        }

        let status_override = if order.risk_score > 75.0 {
            tracing::warn!("TRUSTNET_HOLD: TX {} high risk ({:.1}). Escrow locked.", transaction_id, order.risk_score);
            let _ = self.tx.send(crate::interfaces::http::api::RealtimeEvent::RiskAlert {
                transaction_id: transaction_id.to_string(),
                merchant_id: order.merchant_id.clone(),
                risk_score: order.risk_score,
                message: format!("TRUSTNET_HOLD: Escrow locked for review (Score: {:.1})", order.risk_score),
            });
            Some(crate::domain::constants::ORDER_STATUS_DISPUTED_HELD)
        } else if settlement_tier == SettlementTier::Instant {
            None
        } else {
            Some(crate::domain::constants::ORDER_STATUS_PAID_ESCROW_HELD)
        };

        let final_status =
            status_override.unwrap_or(crate::domain::constants::ORDER_STATUS_PAID_PENDING_DELIVERY);

        OrderStatusMachine::validate_transition(&order.status, final_status)?;

        sqlx::query("UPDATE orders SET utr_number = $1, status = $2, is_payment = TRUE, paid_at = CURRENT_TIMESTAMP WHERE transaction_id = $3")
            .bind(utr.trim())
            .bind(final_status)
            .bind(transaction_id)
            .execute(&mut *tx)
            .await?;

        if status_override.is_none() && settlement_tier == SettlementTier::Instant {
            let _ = write_mock_confirmation_email(&pool, &order).await;
        }

        tx.commit().await.map_err(crate::domain::error::AppError::Database)?;

        let _ = self.tx.send(
            crate::interfaces::http::api::RealtimeEvent::OrderStatusChanged {
                transaction_id: transaction_id.to_string(),
                merchant_id: order.merchant_id,
                new_status: final_status.to_string(),
            },
        );

        let escrow_str = escrow_until.map(|dt| dt.to_rfc3339());

        Ok(PaymentResult {
            success: true,
            transaction_id: transaction_id.to_string(),
            amount: order.price_inr,
            gateway_id: Some(format!("TRUSTNET:{}", utr.trim())),
            escrow_held_until: escrow_str,
            settlement_tier,
        })
    }

    async fn release_escrow(&self, transaction_id: &str, _proof_token: &str) -> AppResult<PaymentResult> {
        tracing::info!("TrustNet: Releasing escrow for transaction {}", transaction_id);

        let pool = self.order_repo.find_pool();
        let mut tx = pool.begin().await.map_err(crate::domain::error::AppError::Database)?;

        let order = sqlx::query_as::<_, crate::domain::models::order::OrderRecord>(
            "SELECT transaction_id, merchant_id, status, price_inr, utr_number FROM orders WHERE transaction_id = $1 FOR UPDATE"
        )
        .bind(transaction_id)
        .fetch_optional(&mut *tx)
        .await?;

        let order = match order {
            Some(o) => o,
            None => {
                tx.rollback().await.map_err(crate::domain::error::AppError::Database)?;
                return Err(crate::domain::error::AppError::NotFound("Order not found".into()));
            }
        };

        if order.status != crate::domain::constants::ORDER_STATUS_PAID_ESCROW_HELD {
            tx.rollback().await.map_err(crate::domain::error::AppError::Database)?;
            return Err(crate::domain::error::AppError::BadRequest(
                "Escrow cannot be released: order not in escrow held state".to_string(),
            ));
        }

        OrderStatusMachine::validate_transition(
            &order.status,
            crate::domain::constants::ORDER_STATUS_SETTLED,
        )?;

        sqlx::query("UPDATE orders SET status = $1, settled_at = CURRENT_TIMESTAMP WHERE transaction_id = $2")
            .bind(crate::domain::constants::ORDER_STATUS_SETTLED)
            .bind(transaction_id)
            .execute(&mut *tx)
            .await?;

        tx.commit().await.map_err(crate::domain::error::AppError::Database)?;

        let _ = self.tx.send(
            crate::interfaces::http::api::RealtimeEvent::OrderStatusChanged {
                transaction_id: transaction_id.to_string(),
                merchant_id: order.merchant_id,
                new_status: crate::domain::constants::ORDER_STATUS_SETTLED.to_string(),
            },
        );

        Ok(PaymentResult {
            success: true,
            transaction_id: transaction_id.to_string(),
            amount: order.price_inr,
            gateway_id: order.utr_number.map(|u| format!("TRUSTNET_ESCROW:{}", u)),
            escrow_held_until: None,
            settlement_tier: SettlementTier::Instant,
        })
    }
}

pub async fn write_mock_confirmation_email(
    pool: &crate::infrastructure::db::DbPool,
    order: &crate::domain::models::order::OrderRecord,
) -> AppResult<()> {
    let merchant =
        crate::domain::models::merchant::Merchant::find_by_id(pool, &order.merchant_id).await?;
    let brand_name = merchant
        .map(|m| m.brand_name)
        .unwrap_or_else(|| "Rtix Partner Shop".to_string());

    let product =
        crate::domain::models::product::ProductLink::find_by_id(pool, &order.link_id).await?;
    let product_name = product
        .map(|p| p.product_name)
        .unwrap_or_else(|| "Order Item".to_string());

    let total_paid =
        order.price_inr + order.delivery_fee + order.platform_fee - order.discount_amount;

    let frontend_url = std::env::var("FRONTEND_URL").unwrap_or_else(|_| "http://localhost:5173".to_string());

    let email_body = format!(
        r#"From: support@rtix.secure
To: {}
Subject: Order Confirmed via TrustNet! - Transaction #{}

TrustNet Secure Order Confirmation
AI-Underwritten by rtix

Hello {},

Your payment has been verified through TrustNet protocol, and your order confirmed!

Order:        {}
Merchant:     {}
Product:      {}
Price:        ₹{:.2}
Fee:          ₹{:.2}
Delivery:     ₹{:.2}
Discount:     -₹{:.2}
Total:        ₹{:.2}
Status:       PAID
Escrow:       ACTIVE — Funds held until delivery confirmed

Track: {}/track/{}

Thank you for shopping with TrustNet by rtix.
"#,
        order.buyer_email.as_deref().unwrap_or(""),
        order.transaction_id,
        order.buyer_name.as_deref().unwrap_or("Customer"),
        order.transaction_id,
        brand_name,
        product_name,
        order.price_inr,
        order.platform_fee,
        order.delivery_fee,
        order.discount_amount,
        total_paid,
        frontend_url,
        order.transaction_id,
    );

    let spool_dir = std::env::var("EMAIL_SPOOL_DIR").unwrap_or_else(|_| {
        std::env::temp_dir()
            .join("rtix_emails")
            .to_string_lossy()
            .to_string()
    });
    let path = std::path::Path::new(&spool_dir);
    if let Err(e) = std::fs::create_dir_all(path) {
        tracing::error!("Failed to create emails directory: {:?}", e);
    }
    let file_path = path.join(format!("{}.txt", order.transaction_id));
    if let Err(e) = std::fs::write(&file_path, email_body) {
        tracing::error!("Failed to write email file: {:?}", e);
    } else {
        tracing::info!("TrustNet: Mock email written to {:?}", file_path);
    }

    let notifier = crate::application::services::payout::NotificationService::new(pool.clone());
    let _ = notifier
        .send_legacy(
            &order.buyer_email,
            Some(&order.merchant_id),
            crate::application::services::payout::NotificationEvent::OrderPlaced {
                merchant_name: brand_name.clone(),
                buyer_name: order.buyer_name.clone(),
                transaction_id: order.transaction_id.clone(),
                amount_inr: total_paid,
            },
        )
        .await;

    Ok(())
}

pub struct OrderStatusMachine;

impl OrderStatusMachine {
    pub fn can_transition(current: &str, target: &str) -> bool {
        use crate::domain::constants::*;
        match (current, target) {
            (ORDER_STATUS_PENDING_PAYMENT, ORDER_STATUS_PAID_PENDING_DELIVERY) => true,
            (ORDER_STATUS_PENDING_PAYMENT, ORDER_STATUS_PAID_ESCROW_HELD) => true,
            (ORDER_STATUS_PENDING_PAYMENT, ORDER_STATUS_PAYMENT_FAILED) => true,
            (ORDER_STATUS_PENDING_PAYMENT, ORDER_STATUS_DISPUTED_HELD) => true,
            (ORDER_STATUS_PAID_ESCROW_HELD, ORDER_STATUS_DELIVERED_PENDING_APPROVAL) => true,
            (ORDER_STATUS_PAID_ESCROW_HELD, ORDER_STATUS_SETTLED) => true,
            (ORDER_STATUS_PAID_PENDING_DELIVERY, ORDER_STATUS_DELIVERED_PENDING_APPROVAL) => true,
            (ORDER_STATUS_DELIVERED_PENDING_APPROVAL, ORDER_STATUS_SETTLED) => true,
            (ORDER_STATUS_DISPUTED_HELD, ORDER_STATUS_SETTLED) => true,
            (a, b) if a == b => true,
            _ => false,
        }
    }

    pub fn validate_transition(current: &str, target: &str) -> AppResult<()> {
        if Self::can_transition(current, target) {
            Ok(())
        } else {
            Err(crate::domain::error::AppError::BadRequest(format!(
                "TrustNet: Illegal State Transition: Cannot move order from '{}' to '{}'.",
                current, target
            )))
        }
    }
}

#[async_trait]
pub trait PaymentVerificationStrategy: Send + Sync {
    fn validate(&self, param: &str) -> AppResult<()>;
    async fn verify(
        &self,
        order: &crate::domain::models::order::OrderRecord,
        param: &str,
        order_repo: &Arc<dyn crate::infrastructure::repositories::OrderRepository>,
    ) -> AppResult<PaymentResult>;
}

pub struct UtrVerificationStrategy;

impl UtrVerificationStrategy {
    fn validate_utr(&self, utr: &str) -> AppResult<()> {
        let utr_trimmed = utr.trim();
        if utr_trimmed.len() < 12 || utr_trimmed.len() > 22 || !utr_trimmed.chars().all(|c| c.is_ascii_digit()) {
            return Err(crate::domain::error::AppError::BadRequest(
                "TrustNet: Invalid UTR. Must be 12-22 digits.".to_string(),
            ));
        }
        Ok(())
    }
}

#[async_trait]
impl PaymentVerificationStrategy for UtrVerificationStrategy {
    fn validate(&self, param: &str) -> AppResult<()> {
        self.validate_utr(param)
    }

    async fn verify(
        &self,
        order: &crate::domain::models::order::OrderRecord,
        utr: &str,
        order_repo: &Arc<dyn crate::infrastructure::repositories::OrderRepository>,
    ) -> AppResult<PaymentResult> {
        self.validate_utr(utr)?;
        order_repo.update_utr(&order.transaction_id, utr).await?;
        Ok(PaymentResult {
            success: true,
            transaction_id: order.transaction_id.clone(),
            amount: order.price_inr,
            gateway_id: Some(format!("TRUSTNET:{}", utr)),
            escrow_held_until: None,
            settlement_tier: SettlementTier::Standard,
        })
    }
}

pub struct PaymentStrategyFactory;

impl PaymentStrategyFactory {
    pub fn get_strategy(method: &str) -> Box<dyn PaymentVerificationStrategy> {
        match method {
            "UTR" => Box::new(UtrVerificationStrategy),
            _ => Box::new(UtrVerificationStrategy),
        }
    }
}
