import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader, ShieldCheck, CreditCard, MapPin, Truck, Wallet } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { API_BASE, api, getCsrfToken } from '../shared/lib/api';

import IdentityForm from '../features/checkout/components/IdentityForm';
import OrderSummary from '../features/checkout/components/OrderSummary';
import PaymentStep from '../features/checkout/components/PaymentStep';

import type {
  CheckoutProduct,
  PaymentInitiateResponse,
} from '../types';
import { checkoutService } from '../shared/api/CheckoutService';
import { appUrl } from '../shared/lib/runtime';
import { primeCsrfToken } from '../shared/lib/api';
import { BrandLogo } from '../shared/ui/BrandLogo';

type CheckoutStep = 'form' | 'processing' | 'secure_payment' | 'redirecting';
type PaymentOption = 'PREPAID' | 'COD';

const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    const existing = document.getElementById('razorpay-sdk');
    if (existing) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.id = 'razorpay-sdk';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export default function Checkout() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const estimateRequestId = useRef(0);

  const [product, setProduct] = useState<CheckoutProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<CheckoutStep>('form');
  const [checkoutStage, setCheckoutStage] = useState<'ADDRESS' | 'BILL' | 'PAYMENT'>('BILL');
  const [formError, setFormError] = useState('');

  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [shippingPincode, setShippingPincode] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryFee, setDeliveryFee] = useState<number | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [paymentData, setPaymentData] = useState<PaymentInitiateResponse | null>(null);
  const [splitStep, setSplitStep] = useState<1 | 2>(2);
  const [utr, setUtr] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [paymentOption, setPaymentOption] = useState<PaymentOption>('PREPAID');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [gpsLat, setGpsLat] = useState<number | null>(null);
  const [gpsLng, setGpsLng] = useState<number | null>(null);

  useEffect(() => {
    primeCsrfToken();
  }, []);

  // Customer Token Protection & Profile Hydration
  useEffect(() => {
    const customerToken = localStorage.getItem('customer_token');
    if (!customerToken) {
      return;
    }

    let mounted = true;
    const fetchProfile = async () => {
      try {
        const res = await api<{ name?: string; email?: string; phone?: string }>('/v1/customer/profile', {
          headers: {
            Authorization: `Bearer ${customerToken}`,
          },
        });
        if (mounted && res.success && res.data) {
          setBuyerName(res.data.name || 'Customer');
          setBuyerEmail(res.data.email || 'customer@rtix.secure');
          setBuyerPhone(res.data.phone || '');
        }
      } catch (err) {
        console.error('Failed to fetch customer profile:', err);
      }
    };

    fetchProfile();
    return () => {
      mounted = false;
    };
  }, [navigate, id]);

  useEffect(() => {
    let mounted = true;

    const loadProduct = async () => {
      if (!id) {
        setLoading(false);
        return;
      }

      const response = await checkoutService.getProduct(id); 
      if (mounted && response.success && response.data) {
        setProduct(response.data);
      }

      if (mounted) {
        setLoading(false);
      }
    };

    loadProduct();
    return () => {
      mounted = false;
    };
  }, [id]);
  useEffect(() => {
    if (shippingPincode.length === 6 && id) {
      const requestId = estimateRequestId.current + 1;
      estimateRequestId.current = requestId;

      const timeoutId = window.setTimeout(async () => {
        setEstimating(true);
        const res = await checkoutService.estimateDelivery(id, shippingPincode, buyerPhone || undefined);
        if (estimateRequestId.current !== requestId) {
          return;
        }

        if (res.success && res.data) {
          setDeliveryFee(res.data.delivery_fee);
          setDistanceKm(res.data.distance_km);
        } else {
          setDeliveryFee(null);
          setDistanceKm(null);
        }
        setEstimating(false);
      }, 100);

      return () => window.clearTimeout(timeoutId);
    } else {
      estimateRequestId.current += 1;
      setDeliveryFee(null);
      setDistanceKm(null);
      setEstimating(false);
    }
  }, [shippingPincode, id, buyerPhone]);

  const discountAmount = appliedCoupon?.discount || 0;
  const total = useMemo(() => (product?.price_inr || 0) - discountAmount, [product, discountAmount]);

  const handleValidateCoupon = async () => {
    if (!couponCode.trim() || !product) return;
    setValidatingCoupon(true);
    setFormError('');
    const res = await checkoutService.validateCoupon({
      merchant_id: product.merchant_id,
      code: couponCode.trim().toUpperCase(),
      amount: product.price_inr,
    });
    if (res.success && res.data?.valid) {
      setAppliedCoupon({ code: couponCode.trim().toUpperCase(), discount: res.data.discount_amount });
      setFormError('');
    } else {
      setAppliedCoupon(null);
      setFormError(res.data?.message || 'Invalid coupon code');
    }
    setValidatingCoupon(false);
  };

  const validateStageOne = (): boolean => {
    if (buyerName.trim().length < 2) {
      setFormError('Please enter your full name.');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail.trim())) {
      setFormError('Please enter a valid email address.');
      return false;
    }
    if (!/^[6-9]\d{9}$/.test(buyerPhone.trim())) {
      setFormError('Please enter a valid 10-digit Indian phone number.');
      return false;
    }
    setFormError('');
    return true;
  };

  const validateStageTwo = (): boolean => {
    if (!/^\d{6}$/.test(shippingPincode.trim())) {
      setFormError('Please enter a valid 6-digit pincode.');
      return false;
    }
    if (deliveryAddress.trim().length < 10) {
      setFormError('Please enter a complete delivery address (min 10 characters).');
      return false;
    }
    setFormError('');
    return true;
  };
  const detectLocation = () => {
    if (!navigator.geolocation) {
      setFormError('Geolocation is not supported by your browser.');
      return;
    }

    setEstimating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setGpsLat(latitude);
        setGpsLng(longitude);
        const coordsText = `[GPS: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}]`;

        setDeliveryAddress((prev) => 
          prev ? `${prev}\n${coordsText}` : coordsText
        );
        setFormError('');
        setEstimating(false);

        void (async () => {
          try {
            const controller = new AbortController();
            const timeoutId = window.setTimeout(() => controller.abort(), 2000);
            const response = await fetch(
              `${API_BASE}/v1/checkout/geocode?lat=${latitude}&lng=${longitude}`,
              { signal: controller.signal },
            );
            window.clearTimeout(timeoutId);
            if (!response.ok) return;
            const data = await response.json() as { address?: { postcode?: string }, display_name?: string };
            if (data.address && data.address.postcode) {
              setShippingPincode(data.address.postcode.replace(/\s/g, '').slice(0, 6));
            }
            if (data.display_name) {
              setDeliveryAddress(data.display_name);
            }
          } catch (e) {
            console.warn('Reverse geocoding failed quickly, still using detected coordinates.');
          }
        })();
      },
      (error) => {
        setFormError('Could not detect location. Please enter manually.');
        setEstimating(false);
      },
      { enableHighAccuracy: false, timeout: 3000, maximumAge: 60000 }
    );
  };
  // ── Phase 2: open Razorpay for the product amount (Prepaid flow) ──
  const openPhase2Razorpay = async (txnid: string, pData: PaymentInitiateResponse) => {
    setFormError('');
    try {
      const phase2Res = await checkoutService.initiateProductPayment(txnid);
      if (!phase2Res.success || !phase2Res.data) {
        throw new Error(phase2Res.error || 'Could not create product payment order.');
      }
      const p2 = phase2Res.data;

      const options = {
        key: p2.razorpay_key_id,
        amount: p2.amount_paise,
        currency: 'INR',
        name: pData.name,
        description: `Product payment for order ${txnid}`,
        order_id: p2.razorpay_order_id,
        prefill: {
          name: pData.prefill_name,
          email: pData.prefill_email,
          contact: pData.prefill_contact,
        },
        theme: { color: '#00E59B' },
        handler: async (response: any) => {
          setStep('processing');
          try {
            const verifyRes = await checkoutService.verifyRazorpay({
              txnid,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
            });
            if (verifyRes.success) {
              navigate(`/success?id=${txnid}&status=paid`);
            } else {
              setFormError(verifyRes.error || 'Product payment verification failed.');
              setStep('form');
              setCheckoutStage('ADDRESS');
            }
          } catch {
            setFormError('Network error verifying product payment.');
            setStep('form');
            setCheckoutStage('ADDRESS');
          }
        },
        modal: {
          ondismiss: () => {
            // User closed Phase 2 – order exists with platform fee paid
            // For COD they can pay later via TrackOrder
            navigate(`/track/${txnid}`);
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to initiate product payment.');
      setStep('form');
      setCheckoutStage('ADDRESS');
    }
  };

  const handleCheckoutExecution = async () => {
    if (!validateStageOne()) {
      setFormError('Please fill in all required details correctly.');
      setCheckoutStage('ADDRESS');
      return;
    }
    
    if (!id || !validateStageTwo()) {
      setCheckoutStage('ADDRESS');
      return;
    }

    if (!agreedToTerms) {
      setFormError('You must agree to the Terms of Service and Privacy Policy.');
      return;
    }

    setStep('processing');
    setFormError('');

    try {
      const deviceFingerprint = [
        navigator.userAgent,
        navigator.language,
        screen.width + 'x' + screen.height,
        new Date().getTimezoneOffset(),
      ].join('|');

      const paymentResponse = await checkoutService.executeCheckoutAndPay(id, {
        buyer_phone: buyerPhone.trim(),
        buyer_name: buyerName.trim(),
        buyer_email: buyerEmail.trim(),
        shipping_pincode: shippingPincode.trim(),
        delivery_address: deliveryAddress.trim(),
        coupon_code: appliedCoupon?.code,
        lat: gpsLat,
        lng: gpsLng,
        device_fingerprint: deviceFingerprint,
        payment_option: paymentOption,
      });

      if (!paymentResponse.success || !paymentResponse.data) {
        throw new Error(paymentResponse.error || 'Checkout and payment initialization failed.');
      }

      const pData = paymentResponse.data;
      setPaymentData(pData);

      if (paymentOption === 'COD') {
        navigate(`/success?id=${pData.txnid}&status=cod_confirmed`);
        return;
      }

      // ── Single Prepaid Razorpay Payment ──
      if (pData.razorpay_order_id && pData.razorpay_key_id) {
        const loaded = await loadRazorpayScript();
        if (!loaded) throw new Error('Failed to load Razorpay payment SDK.');

        const rzpOptions = {
          key: pData.razorpay_key_id,
          amount: pData.amount_paise,
          currency: 'INR',
          name: product?.product_name || '',
          description: `Payment for ${product?.product_name || ''}`,
          order_id: pData.razorpay_order_id,
          prefill: {
            name: pData.prefill_name,
            email: pData.prefill_email,
            contact: pData.prefill_contact,
          },
          theme: { color: '#00E59B' },
          handler: async (response: any) => {
            setStep('processing');
            try {
              const csrfToken = await getCsrfToken();
              const verifyRes = await fetch(`${API_BASE}/v1/payment/verify_razorpay`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-csrf-token': csrfToken || '',
                },
                body: JSON.stringify({
                  txnid: pData.txnid,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_signature: response.razorpay_signature,
                }),
              });
              const verifyData = await verifyRes.json();

              if (!verifyRes.ok || !verifyData.success) {
                setFormError(verifyData.error || 'Payment verification failed.');
                setStep('form');
                setCheckoutStage('ADDRESS');
                return;
              }

              navigate(`/success?id=${pData.txnid}&status=paid`);
            } catch {
              setFormError('Network error during payment verification.');
              setStep('form');
              setCheckoutStage('ADDRESS');
            }
          },
          modal: {
            ondismiss: () => {
              setFormError('Payment cancelled. Please try again.');
              setStep('form');
            },
          },
        };

        const rzp = new (window as any).Razorpay(rzpOptions);
        rzp.open();
      } else {
        // Fallback UPI / no Razorpay configured
        setStep('secure_payment');
        setCheckoutStage('PAYMENT');
      }
    } catch (error) {
      console.error(error);
      setFormError(error instanceof Error ? error.message : 'Checkout failed.');
      setStep('form');
    }
  };

  const handleTrustConfirm = async () => {
    if (!utr || utr.trim().length < 12) {
      setFormError('Please enter a valid 12-digit UPI UTR number.');
      return;
    }
    setVerifying(true);
    setFormError('');

    try {
      const res = await checkoutService.verifyMerchantPayment(paymentData?.txnid || '', utr.trim());
      if (res.success) {
        navigate(`/success?id=${paymentData?.txnid}&status=paid`);
      } else {
        setFormError(res.error || 'Could not confirm payment. Please try again.');
      }
    } catch (err) {
      setFormError('Network error. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#000000] text-white flex flex-col items-center justify-center p-6 antialiased font-inter overflow-hidden">
        <div className="abstract-glow w-[600px] h-[600px] bg-[#00E59B]/5 top-[-200px] left-[-200px]"></div>
        <div className="w-full max-w-sm relative">
          <div className="bg-white/[0.02] border border-white/5 rounded-[40px] p-8 animate-pulse">
            <div className="flex items-center justify-center gap-2 mb-10">
              <div className="h-1 w-8 bg-white/10 rounded-full" />
              <div className="h-1 w-4 bg-white/5 rounded-full" />
            </div>
            <div className="flex flex-col items-center mb-10">
              <div className="h-20 w-20 bg-white/5 rounded-2xl mb-6" />
              <div className="h-4 w-32 bg-white/10 rounded-full mb-3" />
              <div className="h-8 w-24 bg-white/10 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center text-white p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-6">
            <span className="text-2xl" aria-hidden="true">⚡</span>
        </div>
        <h1 className="text-2xl font-outfit font-light mb-2">Link Not Available</h1>
        <p className="text-zinc-400 text-sm">This payment link is no longer valid.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#000000] text-white flex flex-col items-center justify-center p-4 md:p-12 antialiased font-inter animate-slow-fade overflow-hidden relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,#00E59B22_0%,transparent_50%)]" />
        <svg className="absolute w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <pattern id="grid-checkout" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 10" fill="none" stroke="white" strokeWidth="0.05" />
            </pattern>
          </defs>
          <rect width="100" height="100" fill="url(#grid-checkout)" />
        </svg>
      </div>
      
      <div className="w-full max-w-sm relative z-10">
        <div className="flex flex-col items-center justify-center mb-6 md:mb-8 gap-3">
          <BrandLogo size="md" className="!h-12 !w-12 !rounded-2xl shadow-[0_0_30px_rgba(0,229,155,0.15)]" />
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full backdrop-blur-xl">
              <ShieldCheck size={12} className="text-[#00E59B]" aria-hidden="true" />
              <span className="text-[8px] font-bold text-white uppercase tracking-[0.2em]">Secure Secured Terminal</span>
          </div>
        </div>

        <div className="bg-white/[0.02] border border-white/5 rounded-3xl md:rounded-[48px] p-5 md:p-10 shadow-2xl backdrop-blur-3xl overflow-hidden relative group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#00E59B]/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          
          <div className="flex items-center justify-center gap-2 mb-8 md:mb-12">
            <div className={`h-1 duration-700 rounded-full ${checkoutStage === 'ADDRESS' ? 'w-12 bg-[#00E59B]' : 'w-4 bg-white/5'}`} />
            <div className={`h-1 duration-700 rounded-full ${checkoutStage === 'BILL' ? 'w-12 bg-[#00E59B]' : 'w-4 bg-white/5'}`} />
            <div className={`h-1 duration-700 rounded-full ${checkoutStage === 'PAYMENT' ? 'w-12 bg-[#00E59B]' : 'w-4 bg-white/5'}`} />
          </div>

          <div className="text-center mb-8 md:mb-12">
            <div className="w-20 h-20 md:w-24 md:h-24 mx-auto bg-black border border-white/10 rounded-2xl md:rounded-3xl flex items-center justify-center mb-4 md:mb-8 shadow-2xl overflow-hidden relative group/image">
                <div className="absolute inset-0 bg-[#00E59B]/5 opacity-0 group-hover/image:opacity-100 transition-opacity" />
                {product.image_data ? (
                <img src={product.image_data} alt={product.product_name} className="w-full h-full object-cover scale-110 group-hover/image:scale-125 transition-transform duration-1000" />
                ) : (
                <span className="text-3xl">📦</span>
                )}
            </div>
            <h1 className="text-xl md:text-2xl font-outfit font-light text-white mb-2 tracking-tight">{product.product_name}</h1>
            <p className="text-3xl md:text-4xl font-outfit font-light text-[#00E59B] tracking-tighter">₹{product.price_inr.toLocaleString()}</p>
          </div>

          <div className="space-y-6 min-h-[220px]">
            <AnimatePresence mode="wait">
              {checkoutStage === 'BILL' && step === 'form' ? (
                  <motion.div
                    key="bill"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <div>
                      <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 mb-2 block">{t('checkout.full_name')}</label>
                      <input
                        type="text"
                        value={buyerName}
                        onChange={(e) => setBuyerName(e.target.value)}
                        className="w-full rounded-2xl border border-white/5 bg-[#0B0B0D]/60 px-4 py-3.5 text-sm text-white outline-none focus:border-[#00E59B] focus:ring-2 focus:ring-[#00E59B]/40 transition-all font-light focus-visible:ring-2 focus-visible:ring-[#00E59B]"
                        placeholder={t('checkout.full_name')}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 mb-2 block">{t('checkout.email_address')}</label>
                      <input
                        type="email"
                        value={buyerEmail}
                        onChange={(e) => setBuyerEmail(e.target.value)}
                        className="w-full rounded-2xl border border-white/5 bg-[#0B0B0D]/60 px-4 py-3.5 text-sm text-white outline-none focus:border-[#00E59B] focus:ring-2 focus:ring-[#00E59B]/40 transition-all font-light focus-visible:ring-2 focus-visible:ring-[#00E59B]"
                        placeholder={t('checkout.email_address')}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 mb-2 block">{t('checkout.phone_number')}</label>
                      <input
                        type="tel"
                        value={buyerPhone}
                        onChange={(e) => setBuyerPhone(e.target.value)}
                        className="w-full rounded-2xl border border-white/5 bg-[#0B0B0D]/60 px-4 py-3.5 text-sm text-white outline-none focus:border-[#00E59B] focus:ring-2 focus:ring-[#00E59B]/40 transition-all font-light focus-visible:ring-2 focus-visible:ring-[#00E59B]"
                        placeholder={t('checkout.phone_number')}
                      />
                    </div>
                  </motion.div>
              ) : checkoutStage === 'ADDRESS' && step === 'form' ? (
                  <motion.div
                    key="address"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <div>
                      <div className="flex justify-between items-end mb-2">
                        <label className="text-[9px] uppercase tracking-widest font-bold text-zinc-400 block">{t('checkout.delivery_pincode')}</label>
                        <button
                          type="button"
                          onClick={detectLocation}
                          className="flex items-center gap-1.5 text-[8px] uppercase font-bold text-[#00E59B] hover:text-white transition-all group/gps focus-visible:ring-2 focus-visible:ring-[#00E59B] focus:outline-none rounded px-1.5 py-0.5"
                        >
                          <div className={`w-1.5 h-1.5 rounded-full ${estimating ? 'bg-[#00E59B] animate-ping' : deliveryAddress.includes('[GPS:') ? 'bg-[#00E59B]' : 'bg-[#00E59B]/20'}`} />
                          <MapPin size={10} className="group-hover/gps:scale-110 transition-transform" aria-hidden="true" />
                          {estimating ? t('checkout.detecting') : deliveryAddress.includes('[GPS:') ? t('checkout.gps_secured') : t('checkout.use_my_gps')}
                        </button>
                      </div>
                      <input
                        type="text"
                        value={shippingPincode}
                        onChange={(e) => setShippingPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className={`w-full rounded-2xl border ${shippingPincode && !/^\d{6}$/.test(shippingPincode.trim()) ? 'border-red-500/50' : gpsLat ? 'border-[#00E59B]/40' : 'border-white/5'} bg-[#0B0B0D]/60 px-4 py-3.5 text-sm text-white outline-none focus:border-[#00E59B] focus:ring-2 focus:ring-[#00E59B]/40 transition-all font-mono tracking-[0.2em] font-light`}
                        placeholder={t('checkout.pincode_placeholder')}
                      />
                      {gpsLat && gpsLng && (
                        <div className="mt-2 flex items-center gap-2 px-3 py-1.5 bg-[#00E59B]/5 border border-[#00E59B]/20 rounded-lg">
                           <div className="w-1.5 h-1.5 rounded-full bg-[#00E59B] animate-pulse" />
                           <span className="text-[8px] font-bold text-[#00E59B] uppercase tracking-widest">
                             GPS Locked · {gpsLat.toFixed(4)}°N, {gpsLng.toFixed(4)}°E
                           </span>
                        </div>
                      )}
                      <p className="text-[9px] text-zinc-400 mt-3 uppercase tracking-wider leading-relaxed">We'll use your details for shipping updates and order security.</p>
                    </div>

                    <div>
                      <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 mb-2 block">{t('checkout.delivery_address')}</label>
                      <textarea
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        className={`w-full rounded-2xl border ${deliveryAddress && deliveryAddress.trim().length < 10 ? 'border-red-500/50' : 'border-white/5'} bg-[#0B0B0D]/60 px-4 py-3.5 text-sm text-white outline-none focus:border-[#00E59B] focus:ring-2 focus:ring-[#00E59B]/40 transition-all font-light resize-none h-24`}
                        placeholder={t('checkout.address_placeholder')}
                      />
                    </div>

                    <OrderSummary
                      estimating={estimating}
                      total={total}
                      product={product}
                      deliveryFee={deliveryFee}
                      distanceKm={distanceKm}
                      couponCode={couponCode}
                      setCouponCode={setCouponCode}
                      handleValidateCoupon={handleValidateCoupon}
                      validatingCoupon={validatingCoupon}
                      appliedCoupon={appliedCoupon}
                    />

                    {/* Payment Method Selection */}
                    <div className="mt-6 space-y-3">
                      <p className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Payment Method</p>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setPaymentOption('PREPAID')}
                          className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all duration-300 focus-visible:ring-2 focus-visible:ring-[#00E59B] focus:outline-none ${
                            paymentOption === 'PREPAID'
                              ? 'border-[#00E59B] bg-[#00E59B]/10 text-[#00E59B]'
                              : 'border-white/5 bg-[#0B0B0D]/60 text-zinc-400 hover:border-white/20'
                          }`}
                        >
                          <Wallet size={18} aria-hidden="true" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Pay Now</span>
                          <span className="text-[8px] text-current opacity-60">Online payment</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentOption('COD')}
                          className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all duration-300 focus-visible:ring-2 focus-visible:ring-[#00E59B] focus:outline-none ${
                            paymentOption === 'COD'
                              ? 'border-[#00E59B] bg-[#00E59B]/10 text-[#00E59B]'
                              : 'border-white/5 bg-[#0B0B0D]/60 text-zinc-400 hover:border-white/20'
                          }`}
                        >
                          <Truck size={18} aria-hidden="true" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Pay on Delivery</span>
                          <span className="text-[8px] text-current opacity-60">Cash / UPI on arrival</span>
                        </button>
                      </div>
                      {paymentOption === 'COD' && (
                        <div className="flex items-start gap-2 px-3 py-2 bg-[#00E59B]/10 border border-[#00E59B]/20 rounded-xl">
                          <span className="text-[#00E59B] text-[9px] leading-relaxed">
                            ✓ Pay the full product amount on delivery. Funds are secured upon arrival.
                          </span>
                        </div>
                      )}
                      {paymentOption === 'PREPAID' && (
                        <div className="flex items-start gap-2 px-3 py-2 bg-[#00E59B]/10 border border-[#00E59B]/20 rounded-xl">
                          <span className="text-[#00E59B] text-[9px] leading-relaxed">
                            ✓ Pay the product amount now. Funds are held securely until delivery.
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-start gap-3 mt-6">
                      <input
                        type="checkbox"
                        id="terms"
                        checked={agreedToTerms}
                        onChange={(e) => setAgreedToTerms(e.target.checked)}
                        className="mt-1 w-4 h-4 rounded border-[#222] bg-black text-[#00E59B] focus:ring-[#00E59B] focus:ring-offset-black"
                      />
                      <label htmlFor="terms" className="text-[10px] text-zinc-400 leading-relaxed">
                        {t('checkout.terms_agree')}{' '}
                        <a href={appUrl('/terms')} target="_blank" rel="noopener noreferrer" className="text-white hover:text-[#00E59B] underline focus-visible:ring-2 focus-visible:ring-[#00E59B] focus:outline-none rounded px-1">
                          {t('checkout.terms_of_service')}
                        </a>{' '}
                        {t('checkout.and')}{' '}
                        <a href={appUrl('/privacy')} target="_blank" rel="noopener noreferrer" className="text-white hover:text-[#00E59B] underline focus-visible:ring-2 focus-visible:ring-[#00E59B] focus:outline-none rounded px-1">
                          {t('checkout.privacy_policy')}
                        </a>.
                      </label>
                    </div>
                  </motion.div>
              ) : (checkoutStage === 'PAYMENT' || step === 'secure_payment') && (
                  <PaymentStep 
                    splitStep={splitStep} paymentData={paymentData}
                    utr={utr} setUtr={setUtr}
                  />
              )}
            </AnimatePresence>
          </div>

          {formError && <p className="text-red-400 text-[10px] mt-4 font-bold uppercase tracking-wide text-center">{formError}</p>}

          <div className="mt-8">
            {checkoutStage === 'BILL' && step === 'form' ? (
                <button
                    onClick={() => validateStageOne() && setCheckoutStage('ADDRESS')}
                    className="w-full py-4 rounded-full bg-white text-black font-bold text-xs uppercase tracking-[0.2em] hover:bg-[#00E59B] transition-all shadow-xl active:scale-95 focus-visible:ring-2 focus-visible:ring-[#00E59B] focus-visible:ring-offset-2 focus-visible:ring-offset-black focus:outline-none"
                >
                    {t('checkout.continue_to_payment')}
                </button>
            ) : checkoutStage === 'ADDRESS' && (step === 'form' || step === 'processing' || step === 'redirecting') ? (
                <button
                    onClick={handleCheckoutExecution}
                    disabled={step !== 'form'}
                    className={`w-full py-4 rounded-full font-bold text-xs uppercase tracking-[0.2em] transition-all shadow-xl active:scale-95 focus-visible:ring-2 focus-visible:ring-[#00E59B] focus-visible:ring-offset-2 focus-visible:ring-offset-black focus:outline-none ${
                    step === 'form'
                        ? 'bg-[#00E59B] text-black'
                        : 'bg-[#111] text-zinc-600 cursor-not-allowed'
                    }`}
                >
                    {step === 'processing'
                    ? '⏳ Processing…'
                    : paymentOption === 'COD'
                        ? '🚚 Confirm Order'
                        : '💳 Pay Now'}
                </button>
            ) : step === 'secure_payment' || checkoutStage === 'PAYMENT' ? (
                <div className="space-y-4">
                    {/* Primary: open UPI app */}
                    <button
                        onClick={() => {
                          const upiUri = splitStep === 1 ? paymentData?.platform_upi_uri || '' : paymentData?.merchant_upi_uri || '';
                          if (upiUri) window.location.href = upiUri;
                        }}
                        className="w-full py-4 rounded-full bg-white text-black font-bold text-xs uppercase tracking-[0.2em] hover:bg-[#00E59B] transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-[#00E59B] focus-visible:ring-offset-2 focus-visible:ring-offset-black focus:outline-none"
                    >
                        {splitStep === 1 ? '📱 Pay ₹2 via UPI App' : '📱 Pay via UPI App'}
                    </button>
                    {/* Confirm: single trust button, no UTR needed */}
                    <button
                        onClick={handleTrustConfirm}
                        disabled={verifying}
                        className={`w-full py-4 rounded-full font-bold text-xs uppercase tracking-[0.2em] transition-all shadow-xl active:scale-95 focus-visible:ring-2 focus-visible:ring-[#00E59B] focus-visible:ring-offset-2 focus-visible:ring-offset-black focus:outline-none ${
                          verifying
                            ? 'bg-[#111] text-zinc-600 cursor-not-allowed'
                            : 'bg-[#00E59B] text-black hover:bg-white'
                        }`}
                    >
                        {verifying ? 'Confirming...' : '✓ I\'ve Paid — Confirm Order'}
                    </button>
                </div>
            ) : null}
            
            {checkoutStage === 'ADDRESS' && (step === 'form' || step === 'processing' || step === 'redirecting') && (
                <button 
                    onClick={() => setCheckoutStage('BILL')}
                    className="w-full mt-4 text-[9px] uppercase font-bold text-zinc-400 hover:text-white transition-colors tracking-widest focus-visible:ring-2 focus-visible:ring-[#00E59B] focus:outline-none rounded py-1"
                >
                    ← {t('checkout.back_to_details')}
                </button>
            )}
 
            {(step === 'secure_payment' || checkoutStage === 'PAYMENT') && (
                <button 
                    onClick={() => {
                        setStep('form');
                        setCheckoutStage('ADDRESS');
                    }}
                    className="w-full mt-4 text-[9px] uppercase font-bold text-zinc-400 hover:text-white transition-colors tracking-widest focus-visible:ring-2 focus-visible:ring-[#00E59B] focus:outline-none rounded py-1"
                >
                    ← {t('checkout.cancel_back')}
                </button>
            )}
          </div>

          <div className="mt-6 md:mt-10 pt-4 md:pt-6 border-t border-white/5 flex flex-col items-center gap-3 md:gap-4">
                  <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold mb-2 md:mb-4 flex items-center gap-2">
                    <ShieldCheck size={12} className="text-[#00E59B]" aria-hidden="true" /> 
                    Payment Details
                  </p>
                  <div className="space-y-3 w-full">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-400">Product Price</span>
                      <span className="text-white font-mono">₹{product?.price_inr.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-400">Service Fee</span>
                      <span className="text-white font-mono">{product?.platform_charge || "₹0.00"}</span>
                    </div>
                    <div className="pt-3 border-t border-white/5 flex justify-between items-center">
                      <span className="text-white font-bold uppercase tracking-widest text-[10px]">Total Amount</span>
                      <span className="text-[#00E59B] font-mono font-bold text-lg">₹{( (product?.price_inr || 0) + (parseFloat(product?.platform_charge?.replace(/[^0-9.]/g, '') || "0")) ).toFixed(2)}</span>
                    </div>
                  </div>
            <div className="flex justify-center items-center gap-2 text-[8px] text-zinc-600 uppercase font-bold tracking-[0.2em]">
              <ShieldCheck size={12} className="text-[#00E59B] opacity-50" aria-hidden="true" /> Secured by Razorpay
            </div>
            <div className="flex gap-4 opacity-30 items-center justify-center">
                <CreditCard size={18} className="text-[#00E59B]" aria-hidden="true" />
                <div className="text-[9px] font-bold tracking-[0.3em] uppercase text-zinc-400">Cards • UPI • Netbanking • Wallets • EMI</div>
            </div>
          </div>
        </div>
        <div className="mt-6 md:mt-12 w-full flex flex-wrap justify-center gap-x-6 gap-y-2 opacity-30 hover:opacity-100 transition-opacity">
          <a href={appUrl('/about')} target="_blank" className="text-[9px] font-bold uppercase tracking-widest text-white hover:text-[#00E59B] transition-colors focus-visible:ring-2 focus-visible:ring-[#00E59B] focus:outline-none rounded px-1">About Us</a>
          <a href={appUrl('/privacy')} target="_blank" className="text-[9px] font-bold uppercase tracking-widest text-white hover:text-[#00E59B] transition-colors focus-visible:ring-2 focus-visible:ring-[#00E59B] focus:outline-none rounded px-1">Privacy Policy</a>
          <a href={appUrl('/shipping')} target="_blank" className="text-[9px] font-bold uppercase tracking-widest text-white hover:text-[#00E59B] transition-colors focus-visible:ring-2 focus-visible:ring-[#00E59B] focus:outline-none rounded px-1">Shipping</a>
          <a href={appUrl('/refund')} target="_blank" className="text-[9px] font-bold uppercase tracking-widest text-white hover:text-[#00E59B] transition-colors focus-visible:ring-2 focus-visible:ring-[#00E59B] focus:outline-none rounded px-1">Refunds</a>
          <a href={appUrl('/terms')} target="_blank" className="text-[9px] font-bold uppercase tracking-widest text-white hover:text-[#00E59B] transition-colors focus-visible:ring-2 focus-visible:ring-[#00E59B] focus:outline-none rounded px-1">Terms</a>
        </div>

        <div className="mt-12 flex flex-col items-center gap-4">
            <div className="flex gap-2">
                <button 
                  onClick={() => i18n.changeLanguage('en')}
                  className={clsx("text-[9px] font-bold px-3 py-1.5 rounded-lg border transition-all active:scale-95 focus-visible:ring-2 focus-visible:ring-[#00E59B] focus:outline-none", i18n.language === 'en' ? "bg-[#00E59B] text-black border-[#00E59B]" : "bg-white/5 text-zinc-400 border-white/10")}
                >
                  ENGLISH
                </button>
                <button 
                  onClick={() => i18n.changeLanguage('hi')}
                  className={clsx("text-[9px] font-bold px-3 py-1.5 rounded-lg border transition-all active:scale-95 focus-visible:ring-2 focus-visible:ring-[#00E59B] focus:outline-none", i18n.language === 'hi' ? "bg-[#00E59B] text-black border-[#00E59B]" : "bg-white/5 text-zinc-400 border-white/10")}
                >
                  हिन्दी
                </button>
            </div>
        </div>
      </div>
    </div>
  );
}
