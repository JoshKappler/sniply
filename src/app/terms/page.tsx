import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-8 border-b border-gray-100 last:border-0">
      <h2 className="font-heading text-xl text-gray-900 mb-4">{title}</h2>
      <div className="space-y-3 text-gray-600 leading-relaxed text-[15px]">{children}</div>
    </div>
  );
}

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />

      {/* Hero */}
      <section className="border-b border-gray-100 py-20 text-center px-6">
        <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[#2E4A8B] mb-5">Legal</p>
        <h1 className="font-heading text-4xl md:text-5xl text-gray-900 mb-4">Terms of Service</h1>
        <p className="text-gray-400 text-sm">Effective January 1, 2025 · Sniply, Inc.</p>
      </section>

      <main className="flex-1 py-12 px-6">
        <div className="max-w-[760px] mx-auto">

          <p className="text-gray-500 leading-relaxed mb-2 text-[15px]">
            Please read these Terms of Service ("Terms") carefully before using the Sniply platform
            operated by Sniply, Inc. ("Sniply," "we," "us," or "our"). By accessing or using our
            website, mobile application, or any related services (collectively, the "Service"), you
            agree to be bound by these Terms.
          </p>

          <Section title="1. Acceptance of Terms">
            <p>
              By creating an account or using the Service in any way, you confirm that you are at
              least 18 years of age (or the age of legal majority in your jurisdiction), that you have
              read and understood these Terms, and that you agree to be bound by them. If you are
              using the Service on behalf of a business, you represent that you have authority to bind
              that business to these Terms.
            </p>
            <p>
              If you do not agree to these Terms, do not access or use the Service.
            </p>
          </Section>

          <Section title="2. Use of Service">
            <p>
              Sniply provides a two-sided marketplace that enables clients ("Customers") to discover,
              book, and review independent barbers and stylists ("Pros"), and enables Pros to manage
              their availability, services, and client relationships.
            </p>
            <p>
              You agree to use the Service only for lawful purposes and in accordance with these
              Terms. You are responsible for all activity that occurs under your account.
            </p>
          </Section>

          <Section title="3. User Accounts">
            <p>
              To access most features of the Service, you must create an account. You agree to
              provide accurate, current, and complete information during registration and to keep your
              account information up to date.
            </p>
            <p>
              You are responsible for safeguarding your account credentials. You agree not to share
              your password or allow others to access your account. You must notify us immediately at{" "}
              <a href="mailto:support@sniply.com" className="text-[#2E4A8B] hover:underline">support@sniply.com</a>{" "}
              if you suspect any unauthorized use of your account.
            </p>
            <p>
              We reserve the right to suspend or terminate accounts that violate these Terms, engage
              in fraudulent activity, or pose a risk to the Sniply community.
            </p>
          </Section>

          <Section title="4. Bookings and Payments">
            <p>
              When a Customer books a service through Sniply, they enter into a direct service
              agreement with the Pro. Sniply is not a party to that agreement and is not responsible
              for the services performed.
            </p>
            <p>
              Service prices are set by each Pro and displayed on their profile. All fees are in U.S.
              dollars. Sniply may collect a platform fee for facilitating transactions. Any applicable
              taxes are the responsibility of the Pro in accordance with applicable law.
            </p>
            <p>
              Payment processing is handled by third-party providers. By making a payment through the
              Service, you agree to the applicable terms of those payment processors.
            </p>
          </Section>

          <Section title="5. Cancellation Policy">
            <p>
              Customers may cancel a booking subject to the cancellation terms set by the individual
              Pro at the time of booking. Some Pros may charge a cancellation fee for last-minute
              cancellations or no-shows.
            </p>
            <p>
              Pros who repeatedly cancel confirmed bookings without reasonable cause may have their
              accounts suspended or removed from the platform. Customers who habitually no-show may
              be subject to restrictions on future bookings.
            </p>
          </Section>

          <Section title="6. Pro Responsibilities">
            <p>
              Pros are independent contractors, not employees of Sniply. By registering as a Pro,
              you represent that you hold all required licenses, permits, and certifications required
              to provide beauty or barbering services in your jurisdiction.
            </p>
            <p>
              Pros agree to honor confirmed bookings, maintain accurate availability, provide services
              as described, and treat all Customers with professionalism and respect. Sniply reserves
              the right to remove Pros who receive sustained negative feedback or violate these Terms.
            </p>
          </Section>

          <Section title="7. Prohibited Conduct">
            <p>You agree not to:</p>
            <ul className="list-disc list-inside space-y-1 ml-1">
              <li>Post false, misleading, or fraudulent reviews or content</li>
              <li>Use the Service to harass, threaten, or discriminate against any user</li>
              <li>Circumvent the Sniply platform to arrange bookings or payments off-platform in order to avoid fees</li>
              <li>Use automated tools, bots, or scrapers to access the Service without permission</li>
              <li>Attempt to reverse-engineer, copy, or exploit any part of the Service</li>
              <li>Use the Service for any illegal purpose or in violation of any applicable law</li>
            </ul>
          </Section>

          <Section title="8. Intellectual Property">
            <p>
              The Sniply name, logo, platform design, and all associated content are the exclusive
              property of Sniply, Inc. and are protected by applicable intellectual property laws.
              Nothing in these Terms grants you a license to use any Sniply trademark, trade name,
              or proprietary content.
            </p>
            <p>
              By submitting content to the Service (such as profile photos, service descriptions, or
              reviews), you grant Sniply a non-exclusive, royalty-free, worldwide license to use,
              display, and distribute that content in connection with operating and promoting the
              Service.
            </p>
          </Section>

          <Section title="9. Disclaimer of Warranties">
            <p>
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTY OF ANY KIND.
              TO THE FULLEST EXTENT PERMITTED BY LAW, SNIPLY DISCLAIMS ALL WARRANTIES, EXPRESS OR
              IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
              AND NON-INFRINGEMENT.
            </p>
            <p>
              Sniply does not warrant that the Service will be uninterrupted, error-free, or free of
              viruses or other harmful components. You use the Service at your own risk.
            </p>
          </Section>

          <Section title="10. Limitation of Liability">
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, SNIPLY, INC. SHALL NOT BE LIABLE
              FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT
              OF OR RELATED TO YOUR USE OF THE SERVICE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH
              DAMAGES. IN NO EVENT SHALL SNIPLY'S TOTAL LIABILITY EXCEED THE GREATER OF $100 OR
              THE AMOUNTS YOU PAID TO SNIPLY IN THE TWELVE MONTHS PRECEDING THE CLAIM.
            </p>
          </Section>

          <Section title="11. Governing Law">
            <p>
              These Terms are governed by the laws of the State of Georgia, without regard to its
              conflict of law provisions. Any disputes arising under these Terms shall be resolved
              exclusively in the state or federal courts located in Fulton County, Georgia, and you
              consent to personal jurisdiction in those courts.
            </p>
          </Section>

          <Section title="12. Changes to Terms">
            <p>
              We may update these Terms from time to time. When we do, we will revise the "Effective"
              date above and, where the changes are material, notify you by email or a prominent
              notice on the Service. Your continued use of the Service after any update constitutes
              acceptance of the revised Terms.
            </p>
          </Section>

          <Section title="13. Contact">
            <p>
              Questions about these Terms? Reach us at:
            </p>
            <address className="not-italic bg-gray-50 rounded-xl p-4 text-sm text-gray-600">
              Sniply, Inc.<br />
              Atlanta, GA<br />
              <a href="mailto:legal@sniply.com" className="text-[#2E4A8B] hover:underline">legal@sniply.com</a>
            </address>
          </Section>

        </div>
      </main>

      <Footer />
    </div>
  );
}
