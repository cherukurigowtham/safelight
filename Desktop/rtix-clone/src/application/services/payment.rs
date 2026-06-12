use crate::domain::error::AppResult;
use async_trait::async_trait;
use std::sync::Arc;

#[derive(serde::Serialize, serde::Deserialize, Debug)]
pub struct PaymentResult {
    pub success: bool,
    pub transaction_id: String,
    pub amount: f64,
    pub gateway_id: Option<String>,
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

        let platform_fee =
            crate::application::services::pricing::PricingEngine::calculate_platform_fee(
                order.price_inr,
                merchant.trust_score,
            );

        let merchant_amount =
            order.price_inr + order.delivery_fee + order.cgst + order.sgst + order.igst;

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

        // Platform UPI Deep Link (₹2)
        let platform_upi_uri = format!(
            "upi://pay?pa={}&pn={}&am={:.2}&tr={}_fee&cu=INR",
            platform_vpa,
            urlencoding::encode(&platform_name),
            platform_fee,
            transaction_id
        );

        // Merchant UPI Deep Link (Payment Simulator / Direct Cost)
        let merchant_upi_uri = format!(
            "upi://pay?pa={}&pn={}&am={:.2}&tr={}_cost&cu=INR",
            merchant_vpa,
            urlencoding::encode(&merchant.brand_name),
            merchant_amount,
            transaction_id
        );

        // Platform Razorpay keys are only used for merchant billing / subscriptions, not customer product checkouts.
        // Customer product checkouts always use direct peer-to-peer UPI VPA routing.
        let razorpay_order_id = None;
        let razorpay_key_id = None;
        let amount_paise = None;

        Ok(
            crate::interfaces::http::routes::payment::PaymentInitiateResponse {
                status: "UPI_SECURE_PAYMENT_READY".to_string(),
                txnid: transaction_id.to_string(),
                name: merchant.brand_name,
                description: format!("Secure Order {}", transaction_id),
                prefill_name: buyer_name.to_string(),
                prefill_email: buyer_email.to_string(),
                prefill_contact: buyer_phone.to_string(),
                platform_upi_uri,
                merchant_upi_uri,
                platform_amount: "0.00".to_string(),
                merchant_amount: merchant_amount.to_string(),
                platform_vpa,
                merchant_vpa,
                razorpay_order_id,
                razorpay_key_id,
                amount_paise,
            },
        )
    }

    async fn verify_utr(&self, transaction_id: &str, utr: &str) -> AppResult<PaymentResult> {
        tracing::info!(
            "Verifying Platform Fee UTR {} for transaction {}",
            utr,
            transaction_id
        );

        let pool = self.order_repo.find_pool();
        let mut tx = pool.begin().await.map_err(crate::domain::error::AppError::Database)?;

        // 1. Acquire write lock (FOR UPDATE) inside transaction
        let order = sqlx::query_as::<_, crate::domain::models::OrderRecord>(
            "SELECT transaction_id, merchant_id, link_id, buyer_phone, buyer_phone_hash, buyer_name, buyer_email, shipping_pincode, delivery_address, price_inr, status, vpa, outbound_weight, return_weight, proof_data, proof_received_at, settled_at, paid_at, shipped_at, delivered_at, shipping_method, estimated_delivery_at, payu_id, is_payment, platform_fee_paid, platform_fee, delivery_fee, distance_km, risk_score, risk_flags, cgst, sgst, igst, utr_number, platform_fee_utr, delivery_gps_lat, delivery_gps_lng, is_geofence_verified, pincode_volatility_at_checkout, discount_amount, coupon_code, checkout_gps_lat, checkout_gps_lng, device_fingerprint, created_at FROM orders WHERE transaction_id = $1 FOR UPDATE"
        )
        .bind(transaction_id)
        .fetch_optional(&mut *tx)
        .await?;

        let order = match order {
            Some(o) => {
                let mut o_mut = o;
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

        // Idempotency: If platform fee already verified, return success
        if order.platform_fee_paid {
            tx.commit().await.map_err(crate::domain::error::AppError::Database)?;
            return Ok(PaymentResult {
                success: true,
                transaction_id: transaction_id.to_string(),
                amount: order.platform_fee,
                gateway_id: order.platform_fee_utr.clone().map(|u| format!("SOVEREIGN_PLATFORM:{}", u)),
            });
        }

        // Validate UTR format
        let utr_trimmed = utr.trim();
        if utr_trimmed.len() < 12
            || utr_trimmed.len() > 22
            || !utr_trimmed.chars().all(|c| c.is_ascii_digit())
        {
            tx.rollback().await.map_err(crate::domain::error::AppError::Database)?;
            return Err(crate::domain::error::AppError::BadRequest(
                "Invalid UTR number. Must be 12–22 digits only.".to_string(),
            ));
        }

        // 2. Double-Spend & UTR Replay Protection
        let duplicate_utr = sqlx::query(
            "SELECT transaction_id FROM orders WHERE (utr_number = $1 OR platform_fee_utr = $1) AND transaction_id != $2"
        )
        .bind(utr_trimmed)
        .bind(transaction_id)
        .fetch_optional(&mut *tx)
        .await?;

        if let Some(row) = duplicate_utr {
            use sqlx::Row;
            let existing_txn = row.get::<String, _>("transaction_id");
            crate::domain::audit::log_risk_event(
                &mut tx,
                Some(transaction_id),
                &order.merchant_id,
                "UTR_REPLAY_ATTACK",
                "CRITICAL",
                Some(&format!(
                    "Replay Attack: UPI UTR {} was already spent on transaction {}. Denied double-fulfillment.",
                    utr_trimmed, existing_txn
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
                "Double spend / UTR reuse detected".to_string(),
            ));
        }

        // Save platform fee UTR and mark platform fee as paid (do not change status yet)
        sqlx::query("UPDATE orders SET platform_fee_utr = $1, platform_fee_paid = TRUE WHERE transaction_id = $2")
            .bind(utr_trimmed)
            .bind(transaction_id)
            .execute(&mut *tx)
            .await?;

        tx.commit().await.map_err(crate::domain::error::AppError::Database)?;

        Ok(PaymentResult {
            success: true,
            transaction_id: transaction_id.to_string(),
            amount: order.platform_fee,
            gateway_id: Some(format!("SOVEREIGN_PLATFORM:{}", utr_trimmed)),
        })
    }

    async fn verify_merchant_utr(&self, transaction_id: &str, utr: &str) -> AppResult<PaymentResult> {
        tracing::info!(
            "Verifying Merchant Payment UTR {} for transaction {}",
            utr,
            transaction_id
        );

        let pool = self.order_repo.find_pool();
        let mut tx = pool.begin().await.map_err(crate::domain::error::AppError::Database)?;

        // 1. Acquire write lock (FOR UPDATE) inside transaction
        let order = sqlx::query_as::<_, crate::domain::models::OrderRecord>(
            "SELECT transaction_id, merchant_id, link_id, buyer_phone, buyer_phone_hash, buyer_name, buyer_email, shipping_pincode, delivery_address, price_inr, status, vpa, outbound_weight, return_weight, proof_data, proof_received_at, settled_at, paid_at, shipped_at, delivered_at, shipping_method, estimated_delivery_at, payu_id, is_payment, platform_fee_paid, platform_fee, delivery_fee, distance_km, risk_score, risk_flags, cgst, sgst, igst, utr_number, platform_fee_utr, delivery_gps_lat, delivery_gps_lng, is_geofence_verified, pincode_volatility_at_checkout, discount_amount, coupon_code, checkout_gps_lat, checkout_gps_lng, device_fingerprint, created_at FROM orders WHERE transaction_id = $1 FOR UPDATE"
        )
        .bind(transaction_id)
        .fetch_optional(&mut *tx)
        .await?;

        let order = match order {
            Some(o) => {
                let mut o_mut = o;
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

        // Idempotency Check: If already fully paid, return existing success result
        if order.status != crate::domain::constants::ORDER_STATUS_PENDING_PAYMENT {
            tx.commit().await.map_err(crate::domain::error::AppError::Database)?;
            return Ok(PaymentResult {
                success: true,
                transaction_id: transaction_id.to_string(),
                amount: order.price_inr,
                gateway_id: order.utr_number.clone().map(|u| format!("SOVEREIGN:{}", u)),
            });
        }

        // Safety Guard: Platform fee is postpaid by merchant, buyer does not pay it during checkout

        // Validate UTR format
        let utr_trimmed = utr.trim();
        if utr_trimmed.len() < 12
            || utr_trimmed.len() > 22
            || !utr_trimmed.chars().all(|c| c.is_ascii_digit())
        {
            tx.rollback().await.map_err(crate::domain::error::AppError::Database)?;
            return Err(crate::domain::error::AppError::BadRequest(
                "Invalid UTR number. Must be 12–22 digits only.".to_string(),
            ));
        }

        // 2. Double-Spend & UTR Replay Protection: Ensure UTR has not been spent anywhere
        let duplicate_utr = sqlx::query(
            "SELECT transaction_id FROM orders WHERE (utr_number = $1 OR platform_fee_utr = $1) AND transaction_id != $2"
        )
        .bind(utr_trimmed)
        .bind(transaction_id)
        .fetch_optional(&mut *tx)
        .await?;

        if let Some(row) = duplicate_utr {
            use sqlx::Row;
            let existing_txn = row.get::<String, _>("transaction_id");
            crate::domain::audit::log_risk_event(
                &mut tx,
                Some(transaction_id),
                &order.merchant_id,
                "UTR_REPLAY_ATTACK",
                "CRITICAL",
                Some(&format!(
                    "Replay Attack: UPI UTR {} was already spent on transaction {}. Denied double-fulfillment.",
                    utr_trimmed, existing_txn
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
                "Double spend / UTR reuse detected".to_string(),
            ));
        }

        // 3. Institutional Safeguard: Autonomous Risk Hold
        let status_override = if order.risk_score > 75.0 {
            tracing::warn!("AUTONOMOUS_HOLD: Transaction {} flagged with high risk score ({:.1}). Safeguarding liquidity.", transaction_id, order.risk_score);

            // Broadcast a high-priority risk alert
            let _ = self.tx.send(crate::interfaces::http::api::RealtimeEvent::RiskAlert {
                transaction_id: transaction_id.to_string(),
                merchant_id: order.merchant_id.clone(),
                risk_score: order.risk_score,
                message: format!("AUTONOMOUS_HOLD: Payment verified but liquidity held for forensic review (Score: {:.1})", order.risk_score),
            });

            Some(crate::domain::constants::ORDER_STATUS_DISPUTED_HELD)
        } else {
            None
        };

        let final_status =
            status_override.unwrap_or(crate::domain::constants::ORDER_STATUS_PAID_PENDING_DELIVERY);

        // 4. Strict State Machine Validation
        OrderStatusMachine::validate_transition(&order.status, final_status)?;

        // Execute updates atomically inside the locked transaction 'tx'
        sqlx::query("UPDATE orders SET utr_number = $1, status = $2, is_payment = TRUE, paid_at = CURRENT_TIMESTAMP WHERE transaction_id = $3")
            .bind(utr_trimmed)
            .bind(final_status)
            .bind(transaction_id)
            .execute(&mut *tx)
            .await?;

        if status_override.is_none() {
            let _ = write_mock_confirmation_email(pool, &order).await;
        }

        tx.commit().await.map_err(crate::domain::error::AppError::Database)?;

        // Notify that payment is authorized and order status has updated
        let _ = self.tx.send(
            crate::interfaces::http::api::RealtimeEvent::OrderStatusChanged {
                transaction_id: transaction_id.to_string(),
                merchant_id: order.merchant_id,
                new_status: final_status.to_string(),
            },
        );

        Ok(PaymentResult {
            success: true,
            transaction_id: transaction_id.to_string(),
            amount: order.price_inr,
            gateway_id: Some(format!("SOVEREIGN:{}", utr_trimmed)),
        })
    }
}

pub async fn write_mock_confirmation_email(
    pool: &crate::infrastructure::db::DbPool,
    order: &crate::domain::models::OrderRecord,
) -> AppResult<()> {
    // 1. Fetch merchant details for brand name
    let merchant =
        crate::domain::models::merchant::Merchant::find_by_id(pool, &order.merchant_id).await?;
    let brand_name = merchant
        .map(|m| m.brand_name)
        .unwrap_or_else(|| "Rtix Partner Shop".to_string());

    // 2. Fetch product details
    let product =
        crate::domain::models::product::ProductLink::find_by_id(pool, &order.link_id).await?;
    let product_name = product
        .map(|p| p.product_name)
        .unwrap_or_else(|| "Order Item".to_string());

    // 3. Calculate breakdown
    let total_paid =
        order.price_inr + order.delivery_fee + order.platform_fee - order.discount_amount;

    let frontend_url = std::env::var("FRONTEND_URL").unwrap_or_else(|_| "http://localhost:5173".to_string());

    let email_body = format!(
        r#"From: support@rtix.secure
To: {}
Subject: Order Confirmed! - Transaction #{}

=======================================================
               rtix Secure Order Confirmation
=======================================================

Hello {},

Your payment has been successfully verified, and your order has been confirmed!

-------------------------------------------------------
Order Details:
-------------------------------------------------------
Order ID:        {}
Merchant Brand:  {}
Product:         {}
Product Price:   ₹{:.2}
Platform Fee:    ₹{:.2}
Delivery Fee:    ₹{:.2}
Discount:        -₹{:.2}
-------------------------------------------------------
Total Paid:      ₹{:.2} (INR)
Status:          PAID & PENDING SHIPPING

-------------------------------------------------------
Track Your Order:
-------------------------------------------------------
You can track your order status and view the delivery progress at any time:
{}/track/{}

-------------------------------------------------------
Shipping Address:
-------------------------------------------------------
Address:         {}
pincode:         {}

-------------------------------------------------------
What's Next?
-------------------------------------------------------
The merchant ({}) will now prepare your order for shipping. 
Once shipped, you can track your order status and view the estimated delivery date in your customer dashboard!

Thank you for shopping securely with rtix.
=======================================================
"#,
        order.buyer_email,
        order.transaction_id,
        order.buyer_name,
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
        order
            .delivery_address
            .as_deref()
            .unwrap_or("[No Address Provided]"),
        order.shipping_pincode.as_deref().unwrap_or("[No Pincode]"),
        brand_name
    );

    // Use configurable spool directory (never hardcode dev machine paths)
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
        tracing::info!(
            "Mock email confirmation written successfully to {:?}",
            file_path
        );
    }

    // Send real email via NotificationService
    let notifier = crate::application::services::payout::NotificationService::new(pool.clone());
    let _ = notifier
        .send_legacy(
            &order.buyer_email,
            Some(&order.merchant_id),
            crate::application::services::payout::NotificationEvent::OrderPlaced {
                merchant_name: &brand_name,
                buyer_name: &order.buyer_name,
                transaction_id: &order.transaction_id,
                amount_inr: total_paid,
            },
        )
        .await;

    Ok(())
}

// ========================================================
// ADVANCED OOPS CONCEPTS: STRATEGY & FACTORY STATE CONTROL
// ========================================================

pub struct OrderStatusMachine;

impl OrderStatusMachine {
    pub fn can_transition(current: &str, target: &str) -> bool {
        use crate::domain::constants::*;
        match (current, target) {
            (ORDER_STATUS_PENDING_PAYMENT, ORDER_STATUS_PAID_PENDING_DELIVERY) => true,
            (ORDER_STATUS_PENDING_PAYMENT, ORDER_STATUS_PAYMENT_FAILED) => true,
            (ORDER_STATUS_PENDING_PAYMENT, ORDER_STATUS_DISPUTED_HELD) => true,
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
                "Illegal State Transition: Cannot move order from '{}' to '{}'. Protocol restricted.",
                current, target
            )))
        }
    }
}

#[async_trait]
pub trait PaymentVerificationStrategy: Send + Sync {
    async fn verify(
        &self,
        order: &crate::domain::models::OrderRecord,
        param: &str,
        order_repo: &Arc<dyn crate::infrastructure::repositories::OrderRepository>,
    ) -> AppResult<PaymentResult>;
}

pub struct UtrVerificationStrategy;

#[async_trait]
impl PaymentVerificationStrategy for UtrVerificationStrategy {
    async fn verify(
        &self,
        order: &crate::domain::models::OrderRecord,
        utr: &str,
        order_repo: &Arc<dyn crate::infrastructure::repositories::OrderRepository>,
    ) -> AppResult<PaymentResult> {
        // UTR (Unique Transaction Reference) must be 12-22 digits
        let utr_trimmed = utr.trim();
        if utr_trimmed.len() < 12
            || utr_trimmed.len() > 22
            || !utr_trimmed.chars().all(|c| c.is_ascii_digit())
        {
            return Err(crate::domain::error::AppError::BadRequest(
                "Invalid UTR number. Must be 12–22 digits only.".to_string(),
            ));
        }

        order_repo.update_utr(&order.transaction_id, utr).await?;

        Ok(PaymentResult {
            success: true,
            transaction_id: order.transaction_id.clone(),
            amount: order.price_inr,
            gateway_id: Some(format!("SOVEREIGN:{}", utr)),
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
