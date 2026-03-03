import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const values = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      </svg>
    ),
    title: "Quality",
    body: "Every pro on Sniply is reviewed by real clients. We surface talent based on merit — skill, reliability, and the kind of attention to detail that turns a haircut into a ritual.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    title: "Community",
    body: "Sniply was built with barbershop culture at heart. We're not just a booking tool — we're a platform where independent stylists can build their brand and a loyal clientele.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
    title: "Trust",
    body: "Transparent pricing, verified reviews, and clear cancellation policies mean no surprises — for clients or pros. When everyone plays fair, everyone wins.",
  },
];

const steps = [
  { num: "01", heading: "Browse & discover", body: "Search by location, specialty, or style. Filter by price, availability, and rating to find the right match." },
  { num: "02", heading: "Book instantly", body: "Choose a time that works for you. No phone tag, no waiting on a reply. Confirmed in seconds." },
  { num: "03", heading: "Show up & enjoy", body: "Walk in knowing exactly what to expect. After your visit, leave a review and help the community grow." },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />

      {/* Hero */}
      <section className="border-b border-gray-100 py-20 text-center px-6">
        <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[#2E4A8B] mb-5">About Sniply</p>
        <h1 className="font-heading text-4xl md:text-5xl text-gray-900 leading-tight max-w-2xl mx-auto mb-6">
          The modern way to book a great cut
        </h1>
        <p className="text-gray-500 text-lg max-w-xl mx-auto leading-relaxed">
          Sniply connects people who care about their hair with the barbers and stylists who take pride in their craft.
        </p>
      </section>

      <main className="flex-1">

        {/* Our story */}
        <section className="py-16 px-6">
          <div className="max-w-[760px] mx-auto">
            <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[#2E4A8B] mb-4">Our story</p>
            <div className="w-8 h-[2px] bg-[#2E4A8B] mb-6" />
            <h2 className="font-heading text-2xl md:text-3xl text-gray-900 mb-6">
              Founded in 2024 to close the gap between great talent and the people looking for it
            </h2>
            <div className="space-y-4 text-gray-600 leading-relaxed">
              <p>
                For decades, finding a good barber meant word-of-mouth and hoping your guy was still at the same shop. Meanwhile, skilled stylists had no easy way to build a following, manage their schedule, or communicate their work to new clients.
              </p>
              <p>
                Sniply was built to change that. We created a platform where discovering, booking, and reviewing barbers and stylists is as seamless as ordering dinner — and where talented pros can run their business without the overhead of a salon or the chaos of a DM inbox.
              </p>
              <p>
                We're headquartered in Atlanta, GA and serve a growing network of clients and independent professionals across the country.
              </p>
            </div>
          </div>
        </section>

        {/* Photo grid */}
        <div className="max-w-[760px] mx-auto px-6 pb-16">
          <div className="grid grid-cols-3 gap-3 rounded-xl overflow-hidden">
            <div className="col-span-2 rounded-xl overflow-hidden aspect-video">
              <img
                src="https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&h=500&fit=crop"
                alt="Barber at work"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex flex-col gap-3">
              <div className="rounded-xl overflow-hidden flex-1">
                <img
                  src="https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=400&h=240&fit=crop"
                  alt="Barbershop interior"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="rounded-xl overflow-hidden flex-1">
                <img
                  src="https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400&h=240&fit=crop"
                  alt="Haircut in progress"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="max-w-[760px] mx-auto px-6">
          <div className="border-t border-gray-100" />
        </div>

        {/* How it works */}
        <section className="py-16 px-6">
          <div className="max-w-[760px] mx-auto">
            <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[#2E4A8B] mb-4">How it works</p>
            <div className="w-8 h-[2px] bg-[#2E4A8B] mb-8" />
            <div className="space-y-8">
              {steps.map((step) => (
                <div key={step.num} className="flex gap-6">
                  <div className="shrink-0 w-10 h-10 rounded-xl bg-[#2E4A8B]/6 flex items-center justify-center">
                    <span className="text-[11px] font-bold text-[#2E4A8B] tracking-wider">{step.num}</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">{step.heading}</h3>
                    <p className="text-gray-500 leading-relaxed">{step.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Divider */}
        <div className="max-w-[760px] mx-auto px-6">
          <div className="border-t border-gray-100" />
        </div>

        {/* Values */}
        <section className="py-16 px-6">
          <div className="max-w-[760px] mx-auto">
            <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[#2E4A8B] mb-4">Our values</p>
            <div className="w-8 h-[2px] bg-[#2E4A8B] mb-8" />
            <div className="space-y-8">
              {values.map((v) => (
                <div key={v.title} className="flex gap-6">
                  <div className="shrink-0 w-10 h-10 rounded-xl bg-[#2E4A8B]/6 flex items-center justify-center text-[#2E4A8B]">
                    {v.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">{v.title}</h3>
                    <p className="text-gray-500 leading-relaxed">{v.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 px-6 bg-[#2E4A8B]/4">
          <div className="max-w-[760px] mx-auto text-center">
            <h2 className="font-heading text-2xl text-gray-900 mb-3">Ready to find your pro?</h2>
            <p className="text-gray-500 mb-8">Browse hundreds of barbers and stylists near you.</p>
            <a
              href="/browse"
              className="inline-block bg-[#2E4A8B] text-white text-sm font-semibold px-7 py-3 rounded-xl hover:bg-[#243d75] transition-colors"
            >
              Browse Barbers
            </a>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
