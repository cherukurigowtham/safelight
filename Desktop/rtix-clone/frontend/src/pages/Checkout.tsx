import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader, ShieldCheck, Check, CreditCard } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import type {
  CheckoutExecutionResponse,
  CheckoutProduct,
  PaymentInitiateResponse,
} from '../types';
import { checkoutService } from '../shared/api/CheckoutService';

type CheckoutStep = 'form' | 'processing' | 'redirecting';

export default function Checkout() {
  const { id } = useParams<{ id: string }>();
  const payuFormRef = useRef<HTMLFormElement>(null);

  const [product, setProduct] = useState<CheckoutProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<CheckoutStep>('form');
  const [checkoutStage, setCheckoutStage] = useState<'IDENTITY' | 'SETTLEMENT'>('IDENTITY');
  const [formError, setFormError] = useState('');
  const [payuData, setPayuData] = useState<PaymentInitiateResponse | null>(null);

  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [shippingPincode, setShippingPincode] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryFee, setDeliveryFee] = useState<number | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

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
    if (!payuData) {
      return;
    }

    const timeout = window.setTimeout(() => {
      payuFormRef.current?.submit();
    }, 100);

    return () => window.clearTimeout(timeout);
  }, [payuData]);

  useEffect(() => {
    if (shippingPincode.length === 6 && id) {
      const fetchEstimate = async () => {
        setEstimating(true);
        const res = await checkoutService.estimateDelivery(id, shippingPincode, buyerPhone || undefined);
        if (res.success && res.data) {
          setDeliveryFee(res.data.delivery_fee);
          setDistanceKm(res.data.distance_km);
        }
        setEstimating(false);
      };
      fetchEstimate();
    } else {
      setDeliveryFee(null);
      setDistanceKm(null);
    }
  }, [shippingPincode, id, buyerPhone]);

  const total = useMemo(() => product?.price_inr || 0, [product]);

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
    setFormError('');
    return true;
  };

  const handleCheckoutExecution = async () => {
    if (!validateStageOne()) {
      setFormError('Please fill in all required details correctly.');
      setCheckoutStage('IDENTITY');
      return;
    }
    
    if (!id || !validateStageTwo()) {
      return;
    }

    if (!agreedToTerms) {
      setFormError('You must agree to the Terms of Service and Privacy Policy.');
      return;
    }

    setStep('processing');
    setFormError('');

    try {
      const orderResponse = await checkoutService.executeCheckout(id, {
        buyer_phone: buyerPhone.trim(),
        buyer_name: buyerName.trim(),
        buyer_email: buyerEmail.trim(),
        shipping_pincode: shippingPincode.trim(),
        delivery_address: deliveryAddress.trim(),
      });

      if (!orderResponse.success || !orderResponse.data?.transaction_id) {
        throw new Error(orderResponse.error || 'Unable to create order.');
      }

      if (!product) throw new Error("Product details are missing. Please refresh and try again.");
      
      const paymentResponse = await checkoutService.initiatePayment({
        transaction_id: orderResponse.data.transaction_id,
        buyer_name: buyerName.trim(),
        buyer_email: buyerEmail.trim(),
        buyer_phone: buyerPhone.trim(),
      });

      if (!paymentResponse.success || !paymentResponse.data) {
        throw new Error(paymentResponse.error || 'Payment initialization failed.');
      }

      setPayuData(paymentResponse.data);
      setStep('redirecting');
    } catch (error) {
      console.error(error);
      setFormError(error instanceof Error ? error.message : 'Checkout failed.');
      setStep('form');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#000000] text-white flex flex-col items-center justify-center p-6 antialiased font-inter overflow-hidden">
        <div className="abstract-glow w-[600px] h-[600px] bg-[#00E59B]/5 top-[-200px] left-[-200px]"></div>
        <div className="w-full max-w-sm relative">
          <div className="narrative-card border-white/5 animate-pulse">
            <div className="flex items-center justify-center gap-2 mb-10">
              <div className="h-1 w-8 bg-white/10 rounded-full" />
              <div className="h-1 w-4 bg-white/5 rounded-full" />
            </div>
            <div className="flex flex-col items-center mb-10">
              <div className="h-20 w-20 bg-white/5 rounded-2xl mb-6" />
              <div className="h-4 w-32 bg-white/10 rounded-full mb-3" />
              <div className="h-8 w-24 bg-white/10 rounded-full" />
            </div>
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="h-2 w-16 bg-white/5 rounded-full" />
                <div className="h-12 w-full bg-white/5 rounded-xl" />
              </div>
              <div className="h-12 w-full bg-white/10 rounded-full" />
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
            <span className="text-2xl">⚡</span>
        </div>
        <h1 className="text-2xl font-outfit font-light mb-2">Link Not Available</h1>
        <p className="text-[#888] text-sm">This payment link is no longer valid.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#000000] text-white flex flex-col items-center justify-center p-6 antialiased font-inter animate-slow-fade overflow-hidden">
      <div className="abstract-glow w-[600px] h-[600px] bg-[#00E59B]/5 top-[-200px] left-[-200px]"></div>
      
      <div className="w-full max-w-sm relative">
        <div className="flex justify-center mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl">
                <ShieldCheck size={14} className="text-[#00E59B]" />
                <span className="text-[9px] font-bold text-white uppercase tracking-widest">Sovereign Secured</span>
            </div>
        </div>
        <div className="narrative-card border-white/5 shadow-2xl overflow-visible">
          
          <div className="flex items-center justify-center gap-2 mb-10">
            <div className={`h-1 duration-500 rounded-full ${checkoutStage === 'IDENTITY' ? 'w-8 bg-[#00E59B]' : 'w-4 bg-[#222]'}`} />
            <div className={`h-1 duration-500 rounded-full ${checkoutStage === 'SETTLEMENT' ? 'w-8 bg-[#00E59B]' : 'w-4 bg-[#222]'}`} />
          </div>

          <div className="text-center mb-10">
            <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#444] mb-6">Secure Checkout</p>
            <div className="w-20 h-20 mx-auto bg-black border border-white/5 rounded-2xl flex items-center justify-center mb-6 shadow-2xl overflow-hidden group">
                {product.image_data ? (
                <img src={product.image_data} alt={product.product_name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                ) : (
                <span className="text-2xl">📦</span>
                )}
            </div>
            <h1 className="text-xl font-outfit font-medium text-white mb-1">{product.product_name}</h1>
            <p className="text-4xl font-outfit font-light text-[#00E59B]">₹{product.price_inr}</p>
          </div>

          <div className="space-y-6 min-h-[220px]">
            <AnimatePresence mode="wait">
              {checkoutStage === 'IDENTITY' ? (
                  <motion.div 
                    key="identity"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                      <div>
                          <label className="text-[9px] uppercase tracking-widest font-bold text-[#555] mb-2 block">Your Details</label>
                          <input
                              type="text"
                              value={buyerName}
                              onChange={(e) => setBuyerName(e.target.value)}
                              className={`w-full bg-black/40 border ${buyerName && buyerName.trim().length < 2 ? 'border-red-500/50' : 'border-[#222]'} rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-[#00E59B]/30 transition-all font-inter`}
                              placeholder="Full Name"
                          />
                      </div>
                      <div className="grid grid-cols-1 gap-4">
                          <input
                              type="email"
                              value={buyerEmail}
                              onChange={(e) => setBuyerEmail(e.target.value)}
                              className={`w-full bg-black/40 border ${buyerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail.trim()) ? 'border-red-500/50' : 'border-[#222]'} rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-[#00E59B]/30 transition-all font-inter`}
                              placeholder="Email Address"
                          />
                          <div className="relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-[#333]">+91</span>
                              <input
                                  type="tel"
                                  value={buyerPhone}
                                  onChange={(e) => setBuyerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                  className={`w-full bg-black/40 border ${buyerPhone && !/^[6-9]\d{9}$/.test(buyerPhone.trim()) ? 'border-red-500/50' : 'border-[#222]'} rounded-xl pl-12 pr-4 py-3 text-sm text-white outline-none focus:border-[#00E59B]/30 transition-all font-mono`}
                                  placeholder="Phone Number"
                              />
                          </div>
                      </div>
                  </motion.div>
              ) : (
                  <motion.div 
                    key="settlement"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                      <div>
                          <label className="text-[9px] uppercase tracking-widest font-bold text-[#555] mb-2 block">Delivery Address</label>
                          <textarea
                              value={deliveryAddress}
                              onChange={(e) => setDeliveryAddress(e.target.value)}
                              className="w-full bg-black/40 border border-[#222] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-[#00E59B]/30 transition-all resize-none"
                              placeholder="Full delivery address (building, street, area)"
                              rows={3}
                          />
                      </div>
                      <div>
                          <label className="text-[9px] uppercase tracking-widest font-bold text-[#555] mb-2 block">Delivery Pincode</label>
                          <input
                              type="text"
                              value={shippingPincode}
                              onChange={(e) => setShippingPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                              className={`w-full bg-black/40 border ${shippingPincode && !/^\d{6}$/.test(shippingPincode.trim()) ? 'border-red-500/50' : 'border-[#222]'} rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-[#00E59B]/30 transition-all font-mono tracking-[0.2em]`}
                              placeholder="6-Digit Pincode"
                          />
                          <p className="text-[9px] text-[#444] mt-3 uppercase tracking-wider leading-relaxed">We'll use your number for shipping updates and order security.</p>
                      </div>

                      <div className="bg-black/80 rounded-xl p-4 border border-white/5 space-y-3">
                          <div className="flex justify-between items-center text-[10px] uppercase font-bold text-[#444] tracking-widest">
                              <span>Order Value</span>
                              <span className="text-white">₹{total.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center text-[10px] uppercase font-bold text-[#00E59B] tracking-widest">
                              <div className="flex items-center gap-1">
                                <Check size={10} />
                                <span>Platform Fee</span>
                              </div>
                              <span>{product.platform_charge}</span>
                          </div>
                          
                          {estimating ? (
                              <div className="flex justify-center py-2">
                                  <Loader size={12} className="animate-spin text-[#00E59B]" />
                              </div>
                          ) : deliveryFee !== null && (
                              <div className="flex justify-between items-center text-[10px] uppercase font-bold text-[#00E59B] tracking-widest animate-in fade-in slide-in-from-top-1">
                                  <div className="flex flex-col">
                                      <span>Delivery Fee</span>
                                      {distanceKm !== null && <span className="text-[8px] text-[#444] tracking-tight mt-0.5">Estimated Distance: {distanceKm.toFixed(1)} km</span>}
                                  </div>
                                  <span>₹{deliveryFee.toFixed(2)}</span>
                              </div>
                          )}

                          <div className="pt-3 border-t border-white/5 flex justify-between items-center">
                              <span className="text-[10px] uppercase font-bold text-[#888] tracking-widest">Total Payable</span>
                              <p className="text-xl font-outfit text-white">
                                ₹{(total + parseFloat(product.platform_charge.replace(/[^0-9.]/g, '')) + (deliveryFee || 0)).toFixed(2)}
                              </p>
                          </div>
                      </div>

                      <div className="flex items-start gap-3 mt-6">
                          <input
                              type="checkbox"
                              id="terms"
                              checked={agreedToTerms}
                              onChange={(e) => setAgreedToTerms(e.target.checked)}
                              className="mt-1 w-4 h-4 rounded border-[#222] bg-black text-[#00E59B] focus:ring-[#00E59B]/30"
                          />
                          <label htmlFor="terms" className="text-[10px] text-[#888] leading-relaxed">
                              I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-white hover:text-[#00E59B] underline">Terms of Service</a> and <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-white hover:text-[#00E59B] underline">Privacy Policy</a>.
                          </label>
                      </div>
                  </motion.div>
              )}
            </AnimatePresence>
          </div>

          {formError && <p className="text-red-400 text-[10px] mt-4 font-bold uppercase tracking-wide text-center">{formError}</p>}

          <div className="mt-8">
            {checkoutStage === 'IDENTITY' ? (
                <button
                    onClick={() => validateStageOne() && setCheckoutStage('SETTLEMENT')}
                    className="w-full py-4 rounded-full bg-white text-black font-bold text-xs uppercase tracking-[0.2em] hover:bg-[#00E59B] transition-all shadow-xl active:scale-95"
                >
                    Continue to Payment
                </button>
            ) : (
                <button
                    onClick={handleCheckoutExecution}
                    disabled={step !== 'form'}
                    className={`w-full py-4 rounded-full font-bold text-xs uppercase tracking-[0.2em] transition-all shadow-xl active:scale-95 ${
                    step === 'form'
                        ? 'bg-[#00E59B] text-black'
                        : 'bg-[#111] text-[#444] cursor-not-allowed'
                    }`}
                >
                    {step === 'processing'
                    ? 'Wait...'
                    : step === 'redirecting'
                        ? 'Opening Gateway...'
                        : 'Proceed to Payment'}
                </button>
            )}
            
            {checkoutStage === 'SETTLEMENT' && step === 'form' && (
                <button 
                    onClick={() => setCheckoutStage('IDENTITY')}
                    className="w-full mt-4 text-[9px] uppercase font-bold text-[#444] hover:text-[#888] transition-colors tracking-widest"
                >
                    ← Back to Details
                </button>
            )}
          </div>

          <div className="mt-10 pt-6 border-t border-white/5 flex flex-col items-center gap-4">
            <div className="flex justify-center items-center gap-2 text-[8px] text-[#222] uppercase font-bold tracking-[0.2em]">
              <ShieldCheck size={12} className="text-[#00E59B] opacity-50" /> Secure Payment Active
            </div>
            <div className="flex gap-4 opacity-10 grayscale hover:grayscale-0 hover:opacity-30 transition-all duration-500">
                <CreditCard size={18} />
                <div className="text-[10px] font-bold tracking-tighter">UPI</div>
                <div className="text-[10px] font-bold tracking-tighter">VISA</div>
                <div className="text-[10px] font-bold tracking-tighter">MC</div>
                <div className="text-[10px] font-bold tracking-tighter">RUPAY</div>
            </div>
          </div>

          {payuData && (
            <form ref={payuFormRef} method="POST" action={payuData.payu_url} style={{ display: 'none' }}>
              <input type="hidden" name="key" value={payuData.key} />
              <input type="hidden" name="txnid" value={payuData.txnid} />
              <input type="hidden" name="amount" value={payuData.amount} />
              <input type="hidden" name="productinfo" value={payuData.productinfo} />
              <input type="hidden" name="firstname" value={payuData.firstname} />
              <input type="hidden" name="email" value={payuData.email} />
              <input type="hidden" name="phone" value={payuData.phone} />
              <input type="hidden" name="surl" value={payuData.surl} />
              <input type="hidden" name="furl" value={payuData.furl} />
              <input type="hidden" name="hash" value={payuData.hash} />
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
