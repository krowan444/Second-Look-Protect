import { Shield, CheckCircle, Search, Lock, AlertTriangle, Phone, Star, ArrowRight, Menu } from 'lucide-react';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-[#D4AF37] selection:text-[#0B1E36]">
      {/* Header */}
      <header className="bg-[#0B1E36] text-white py-4 px-6 md:px-12 flex justify-between items-center sticky top-0 z-50 shadow-md">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-[#D4AF37]" />
          <span className="text-xl md:text-2xl font-semibold tracking-tight">Second Look Protect</span>
        </div>
        <nav className="hidden md:flex gap-8 text-base font-medium text-slate-200 items-center">
          <a href="#how-it-works" className="hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-[#D4AF37] rounded px-2 py-1">How It Works</a>
          <a href="#pricing" className="hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-[#D4AF37] rounded px-2 py-1">Subscriptions</a>
          <a href="#testimonials" className="hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-[#D4AF37] rounded px-2 py-1">Reviews</a>
          <button className="bg-[#D4AF37] text-[#0B1E36] px-6 py-2.5 rounded-full font-bold hover:bg-yellow-400 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#0B1E36]">
            Check Now
          </button>
        </nav>
        <button className="md:hidden text-white p-2">
          <Menu className="w-6 h-6" />
        </button>
      </header>

      {/* Hero Section */}
      <section className="relative bg-[#0B1E36] text-white overflow-hidden">
        {/* Gorgeous Hero Image Background */}
        <div className="absolute inset-0 z-0">
          <picture>
            <source media="(min-width: 768px)" srcSet="https://picsum.photos/seed/guardian/1920/1080?blur=1" />
            <img 
              src="https://picsum.photos/seed/guardian/800/1000?blur=1" 
              alt="An older person looking at a tablet with a reassuring hand on their shoulder" 
              className="w-full h-full object-cover opacity-40 mix-blend-overlay"
              referrerPolicy="no-referrer"
            />
          </picture>
          {/* Gradient overlay to ensure text readability */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#0B1E36] via-[#0B1E36]/90 to-transparent"></div>
        </div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 py-20 md:py-32 lg:py-40 flex flex-col md:flex-row items-center gap-12">
          <div className="md:w-2/3 space-y-8">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full text-sm font-semibold text-[#D4AF37] border border-white/20 shadow-sm">
              <Lock className="w-4 h-4" />
              <span>Your Premium Digital Guardian</span>
            </div>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-tight tracking-tight">
              Before You Click.<br/>
              <span className="text-slate-300">Before You Pay.</span><br/>
              <span className="text-[#D4AF37]">Get a Second Look.</span>
            </h1>
            <p className="text-lg md:text-2xl text-slate-200 max-w-2xl leading-relaxed font-light">
              Scams are getting smarter, but you don't have to face them alone. We provide immediate, expert verification of suspicious emails, texts, and websites so you can browse with complete peace of mind.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 pt-6">
              <button className="bg-[#D4AF37] text-[#0B1E36] px-8 py-4 rounded-full font-bold text-lg hover:bg-yellow-400 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 flex items-center justify-center gap-2 focus:outline-none focus:ring-4 focus:ring-[#D4AF37]/50">
                <Search className="w-6 h-6" />
                Check a Link Now
              </button>
              <button className="bg-white/10 backdrop-blur-sm text-white border border-white/30 px-8 py-4 rounded-full font-semibold text-lg hover:bg-white/20 transition-all flex items-center justify-center gap-2 focus:outline-none focus:ring-4 focus:ring-white/30">
                <Phone className="w-5 h-5" />
                Speak to an Expert
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-6 pt-8 text-sm md:text-base text-slate-300 font-medium">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-[#D4AF37]" />
                <span>24/7 Support</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-[#D4AF37]" />
                <span>UK Based Experts</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-[#D4AF37]" />
                <span>Fully Confidential</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The Problem Section */}
      <section className="py-20 md:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="text-center max-w-3xl mx-auto mb-16 md:mb-24">
            <h2 className="text-3xl md:text-5xl font-bold text-[#0B1E36] mb-6 tracking-tight">The internet shouldn't feel like a minefield.</h2>
            <p className="text-lg md:text-xl text-slate-600 leading-relaxed">
              Every day, millions of convincing fake messages, websites, and calls target innocent people. They look like your bank, your delivery service, or even your family. One wrong click can cost you everything.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-slate-50 p-8 md:p-10 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-6">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold text-[#0B1E36] mb-4">Sophisticated Scams</h3>
              <p className="text-slate-600 text-lg leading-relaxed">Modern scams are nearly indistinguishable from real communications. They use your name, real logos, and urgent language to force quick decisions.</p>
            </div>
            <div className="bg-slate-50 p-8 md:p-10 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-14 h-14 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center mb-6">
                <Lock className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold text-[#0B1E36] mb-4">Financial Devastation</h3>
              <p className="text-slate-600 text-lg leading-relaxed">Once money is sent to a scammer, it is often impossible to recover. The financial and emotional toll can be life-altering.</p>
            </div>
            <div className="bg-[#0B1E36] p-8 md:p-10 rounded-3xl border border-[#0B1E36] shadow-lg text-white transform md:-translate-y-4">
              <div className="w-14 h-14 bg-[#D4AF37]/20 text-[#D4AF37] rounded-2xl flex items-center justify-center mb-6">
                <Shield className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">The Solution</h3>
              <p className="text-slate-300 text-lg leading-relaxed">Pause. Don't click. Don't pay. Send it to us instead. Our experts will analyze the request and give you a definitive "Safe" or "Scam" verdict.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 md:py-28 bg-slate-100 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="text-center mb-16 md:mb-24">
            <h2 className="text-3xl md:text-5xl font-bold text-[#0B1E36] mb-6 tracking-tight">How Second Look Protect Works</h2>
            <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto">Three simple steps to complete peace of mind.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-12 relative max-w-5xl mx-auto">
            {/* Connecting line for desktop */}
            <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-1 bg-slate-300 z-0 rounded-full"></div>
            
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="w-24 h-24 bg-white rounded-full border-4 border-slate-200 text-[#0B1E36] flex items-center justify-center text-3xl font-bold mb-8 shadow-sm">
                1
              </div>
              <h3 className="text-2xl font-bold text-[#0B1E36] mb-4">Receive & Pause</h3>
              <p className="text-slate-600 text-lg">You get a suspicious email, text, or payment request. Instead of acting on it, you pause.</p>
            </div>
            
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="w-24 h-24 bg-white rounded-full border-4 border-slate-200 text-[#0B1E36] flex items-center justify-center text-3xl font-bold mb-8 shadow-sm">
                2
              </div>
              <h3 className="text-2xl font-bold text-[#0B1E36] mb-4">Send for a Second Look</h3>
              <p className="text-slate-600 text-lg">Forward the message, screenshot, or link to our secure portal or dedicated WhatsApp number.</p>
            </div>
            
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="w-24 h-24 bg-[#D4AF37] rounded-full border-4 border-[#D4AF37] text-[#0B1E36] flex items-center justify-center text-3xl font-bold mb-8 shadow-lg">
                3
              </div>
              <h3 className="text-2xl font-bold text-[#0B1E36] mb-4">Get the Verdict</h3>
              <p className="text-slate-600 text-lg">Within minutes, our experts analyze the threat and tell you exactly what to do next. Safe or Scam.</p>
            </div>
          </div>
          
          <div className="mt-20 text-center">
            <button className="bg-[#0B1E36] text-white px-10 py-5 rounded-full font-bold text-xl hover:bg-slate-800 transition-colors shadow-xl hover:shadow-2xl inline-flex items-center gap-3 focus:outline-none focus:ring-4 focus:ring-[#0B1E36]/50">
              Try It Now <ArrowRight className="w-6 h-6" />
            </button>
          </div>
        </div>
      </section>

      {/* Subscriptions */}
      <section id="pricing" className="py-20 md:py-28 bg-[#0B1E36] text-white">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="text-center mb-16 md:mb-24">
            <h2 className="text-3xl md:text-5xl font-bold mb-6 tracking-tight">Choose Your Level of Protection</h2>
            <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto">Flexible plans designed to keep you and your loved ones safe.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Basic Plan */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-8 md:p-10 flex flex-col">
              <h3 className="text-2xl font-bold mb-2">Essential</h3>
              <p className="text-slate-400 mb-8 text-lg">Perfect for occasional checks.</p>
              <div className="mb-10">
                <span className="text-5xl font-bold">£9.99</span>
                <span className="text-slate-400 text-lg">/month</span>
              </div>
              <ul className="space-y-5 mb-10 flex-1">
                <li className="flex items-start gap-4">
                  <CheckCircle className="w-6 h-6 text-[#D4AF37] shrink-0" />
                  <span className="text-slate-200 text-lg">Up to 10 checks per month</span>
                </li>
                <li className="flex items-start gap-4">
                  <CheckCircle className="w-6 h-6 text-[#D4AF37] shrink-0" />
                  <span className="text-slate-200 text-lg">Email & SMS verification</span>
                </li>
                <li className="flex items-start gap-4">
                  <CheckCircle className="w-6 h-6 text-[#D4AF37] shrink-0" />
                  <span className="text-slate-200 text-lg">Response within 2 hours</span>
                </li>
              </ul>
              <button className="w-full py-4 rounded-full border-2 border-white/20 font-bold text-lg hover:bg-white/10 transition-colors focus:outline-none focus:ring-4 focus:ring-white/20">
                Select Essential
              </button>
            </div>

            {/* Premium Plan */}
            <div className="bg-white rounded-3xl p-8 md:p-10 flex flex-col transform md:-translate-y-6 shadow-2xl relative border-4 border-[#D4AF37]">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#D4AF37] text-[#0B1E36] px-6 py-2 rounded-full text-sm font-bold tracking-widest uppercase shadow-md">
                Most Popular
              </div>
              <h3 className="text-2xl font-bold text-[#0B1E36] mb-2 mt-2">Guardian</h3>
              <p className="text-slate-500 mb-8 text-lg">Comprehensive daily protection.</p>
              <div className="mb-10 text-[#0B1E36]">
                <span className="text-5xl font-bold">£19.99</span>
                <span className="text-slate-500 text-lg">/month</span>
              </div>
              <ul className="space-y-5 mb-10 flex-1">
                <li className="flex items-start gap-4">
                  <CheckCircle className="w-6 h-6 text-[#D4AF37] shrink-0" />
                  <span className="text-slate-700 font-medium text-lg">Unlimited checks</span>
                </li>
                <li className="flex items-start gap-4">
                  <CheckCircle className="w-6 h-6 text-[#D4AF37] shrink-0" />
                  <span className="text-slate-700 font-medium text-lg">Priority response (under 15 mins)</span>
                </li>
                <li className="flex items-start gap-4">
                  <CheckCircle className="w-6 h-6 text-[#D4AF37] shrink-0" />
                  <span className="text-slate-700 font-medium text-lg">Website & Payment verification</span>
                </li>
                <li className="flex items-start gap-4">
                  <CheckCircle className="w-6 h-6 text-[#D4AF37] shrink-0" />
                  <span className="text-slate-700 font-medium text-lg">Direct WhatsApp access</span>
                </li>
              </ul>
              <button className="w-full py-4 rounded-full bg-[#0B1E36] text-white font-bold text-lg hover:bg-slate-800 transition-colors shadow-xl focus:outline-none focus:ring-4 focus:ring-[#0B1E36]/50">
                Select Guardian
              </button>
            </div>

            {/* Family Plan */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-8 md:p-10 flex flex-col">
              <h3 className="text-2xl font-bold mb-2">Family Shield</h3>
              <p className="text-slate-400 mb-8 text-lg">Protect up to 4 family members.</p>
              <div className="mb-10">
                <span className="text-5xl font-bold">£29.99</span>
                <span className="text-slate-400 text-lg">/month</span>
              </div>
              <ul className="space-y-5 mb-10 flex-1">
                <li className="flex items-start gap-4">
                  <CheckCircle className="w-6 h-6 text-[#D4AF37] shrink-0" />
                  <span className="text-slate-200 text-lg">Everything in Guardian</span>
                </li>
                <li className="flex items-start gap-4">
                  <CheckCircle className="w-6 h-6 text-[#D4AF37] shrink-0" />
                  <span className="text-slate-200 text-lg">4 independent accounts</span>
                </li>
                <li className="flex items-start gap-4">
                  <CheckCircle className="w-6 h-6 text-[#D4AF37] shrink-0" />
                  <span className="text-slate-200 text-lg">Family alert dashboard</span>
                </li>
              </ul>
              <button className="w-full py-4 rounded-full border-2 border-white/20 font-bold text-lg hover:bg-white/10 transition-colors focus:outline-none focus:ring-4 focus:ring-white/20">
                Select Family Shield
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-20 md:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="text-center mb-16 md:mb-24">
            <h2 className="text-3xl md:text-5xl font-bold text-[#0B1E36] mb-6 tracking-tight">Trusted by Thousands</h2>
            <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto">Real stories from people we've protected.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-slate-50 p-8 md:p-10 rounded-3xl border border-slate-100 shadow-sm">
              <div className="flex gap-1 text-[#D4AF37] mb-6">
                <Star className="w-6 h-6 fill-current" />
                <Star className="w-6 h-6 fill-current" />
                <Star className="w-6 h-6 fill-current" />
                <Star className="w-6 h-6 fill-current" />
                <Star className="w-6 h-6 fill-current" />
              </div>
              <p className="text-slate-700 mb-8 text-lg italic leading-relaxed">"I received a text from what looked exactly like my bank asking me to authorize a payment. I sent a screenshot to Second Look Protect, and within 3 minutes they confirmed it was a scam. They saved me £2,000."</p>
              <div className="font-bold text-[#0B1E36] text-lg">- Margaret T., London</div>
            </div>
            <div className="bg-slate-50 p-8 md:p-10 rounded-3xl border border-slate-100 shadow-sm">
              <div className="flex gap-1 text-[#D4AF37] mb-6">
                <Star className="w-6 h-6 fill-current" />
                <Star className="w-6 h-6 fill-current" />
                <Star className="w-6 h-6 fill-current" />
                <Star className="w-6 h-6 fill-current" />
                <Star className="w-6 h-6 fill-current" />
              </div>
              <p className="text-slate-700 mb-8 text-lg italic leading-relaxed">"I bought the Family Shield for my elderly parents. It gives me such peace of mind knowing they have experts to check things with before they click any links in emails. It's worth every penny."</p>
              <div className="font-bold text-[#0B1E36] text-lg">- David S., Manchester</div>
            </div>
            <div className="bg-slate-50 p-8 md:p-10 rounded-3xl border border-slate-100 shadow-sm">
              <div className="flex gap-1 text-[#D4AF37] mb-6">
                <Star className="w-6 h-6 fill-current" />
                <Star className="w-6 h-6 fill-current" />
                <Star className="w-6 h-6 fill-current" />
                <Star className="w-6 h-6 fill-current" />
                <Star className="w-6 h-6 fill-current" />
              </div>
              <p className="text-slate-700 mb-8 text-lg italic leading-relaxed">"The service is incredibly fast and easy to use. I just forward suspicious emails to them, and they reply almost instantly. It's like having a cybersecurity expert in your pocket."</p>
              <div className="font-bold text-[#0B1E36] text-lg">- Helen R., Bristol</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 md:py-32 bg-[#D4AF37] text-[#0B1E36]">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl md:text-6xl font-bold mb-8 tracking-tight">Don't wait until it's too late.</h2>
          <p className="text-xl md:text-2xl mb-12 font-medium opacity-90">Get your digital guardian today and browse with confidence.</p>
          <button className="bg-[#0B1E36] text-white px-12 py-6 rounded-full font-bold text-xl md:text-2xl hover:bg-slate-800 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-[#0B1E36]/50">
            Start Your Protection Now
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#05101E] text-slate-400 py-16 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 md:px-12 grid md:grid-cols-4 gap-12">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-3 mb-6">
              <Shield className="w-8 h-8 text-[#D4AF37]" />
              <span className="text-2xl font-bold text-white tracking-tight">Second Look Protect</span>
            </div>
            <p className="max-w-sm text-lg leading-relaxed">
              Your premium digital guardian. We provide expert verification of suspicious communications to protect you from fraud.
            </p>
          </div>
          <div>
            <h4 className="text-white font-bold text-lg mb-6">Quick Links</h4>
            <ul className="space-y-4">
              <li><a href="#how-it-works" className="hover:text-white transition-colors text-lg">How It Works</a></li>
              <li><a href="#pricing" className="hover:text-white transition-colors text-lg">Subscriptions</a></li>
              <li><a href="#" className="hover:text-white transition-colors text-lg">About Us</a></li>
              <li><a href="#" className="hover:text-white transition-colors text-lg">Contact</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold text-lg mb-6">Legal</h4>
            <ul className="space-y-4">
              <li><a href="#" className="hover:text-white transition-colors text-lg">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-white transition-colors text-lg">Terms of Service</a></li>
              <li><a href="#" className="hover:text-white transition-colors text-lg">Cookie Policy</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 md:px-12 mt-16 pt-8 border-t border-white/10 text-base text-center md:text-left flex flex-col md:flex-row justify-between items-center gap-4">
          <p>&copy; {new Date().getFullYear()} Second Look Protect Ltd. All rights reserved.</p>
          <div className="flex gap-6">
             <a href="#" className="hover:text-white transition-colors">Twitter</a>
             <a href="#" className="hover:text-white transition-colors">LinkedIn</a>
             <a href="#" className="hover:text-white transition-colors">Facebook</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
