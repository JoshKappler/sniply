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

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />

      {/* Hero */}
      <section className="border-b border-gray-100 py-20 text-center px-6">
        <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[var(--color-primary)] mb-5">Legal</p>
        <h1 className="font-heading text-4xl md:text-5xl text-gray-900 mb-4">Privacy Policy</h1>
        <p className="text-gray-400 text-sm">Effective January 1, 2025 · Sniply, Inc.</p>
      </section>

      <main className="flex-1 py-12 px-6">
        <div className="max-w-[760px] mx-auto">

          <p className="text-gray-500 leading-relaxed mb-2 text-[15px]">
            Your privacy matters to us. This Privacy Policy explains how Sniply, Inc. ("Sniply," "we,"
            "us," or "our") collects, uses, shares, and protects information when you use our website,
            mobile application, and related services (the "Service"). By using the Service, you agree
            to the practices described in this policy.
          </p>

          <Section title="1. Information We Collect">
            <p><strong className="font-semibold text-gray-800">Account Information.</strong> When you register, we collect your name, email address, username, password (stored in hashed form), role (Customer or Pro), and any profile information you provide, such as a profile photo, bio, location, and service details.</p>
            <p><strong className="font-semibold text-gray-800">Booking & Transaction Data.</strong> We collect records of bookings you make or receive, services rendered, pricing, and review content you submit.</p>
            <p><strong className="font-semibold text-gray-800">Usage Data.</strong> We automatically collect information about how you interact with the Service, including pages visited, features used, search queries, timestamps, and referring URLs.</p>
            <p><strong className="font-semibold text-gray-800">Device & Technical Data.</strong> We collect device type, operating system, browser type, IP address, and other technical identifiers when you access the Service.</p>
            <p><strong className="font-semibold text-gray-800">Communications.</strong> If you contact us for support or communicate with other users through the Service, we may retain those communications.</p>
          </Section>

          <Section title="2. How We Use Your Information">
            <p>We use the information we collect to:</p>
            <ul className="list-disc list-inside space-y-1 ml-1">
              <li>Provide, operate, and improve the Service</li>
              <li>Facilitate bookings between Customers and Pros</li>
              <li>Process payments and send booking confirmations</li>
              <li>Personalize your experience and surface relevant Pros</li>
              <li>Send transactional emails and important Service updates</li>
              <li>Respond to support requests and resolve disputes</li>
              <li>Detect and prevent fraud, abuse, and security incidents</li>
              <li>Comply with our legal obligations</li>
            </ul>
            <p>
              We do not sell your personal information to third parties, and we do not use your
              information to serve third-party advertising.
            </p>
          </Section>

          <Section title="3. Information Sharing">
            <p>We may share your information in the following circumstances:</p>
            <p><strong className="font-semibold text-gray-800">Between Users.</strong> When a Customer books a Pro, we share the relevant booking details (name, contact info, service requested) with that Pro, and vice versa. Pro profile information is publicly visible on the platform.</p>
            <p><strong className="font-semibold text-gray-800">Service Providers.</strong> We work with trusted third-party vendors who help us operate the Service — including payment processors, cloud hosting providers, email delivery services, and analytics platforms. These vendors are contractually bound to protect your information and may only use it to provide services to us.</p>
            <p><strong className="font-semibold text-gray-800">Legal Requirements.</strong> We may disclose your information if required by law, regulation, legal process, or governmental request, or if we believe disclosure is necessary to protect the rights, property, or safety of Sniply, our users, or others.</p>
            <p><strong className="font-semibold text-gray-800">Business Transfers.</strong> If Sniply is involved in a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction. We will notify you before your information becomes subject to a different privacy policy.</p>
            <p><strong className="font-semibold text-gray-800">With Your Consent.</strong> We may share your information for other purposes with your explicit consent.</p>
          </Section>

          <Section title="4. Cookies and Tracking">
            <p>
              We use cookies and similar tracking technologies to keep you logged in, remember your
              preferences, and understand how the Service is used. Essential cookies are required for
              the Service to function; others are used for analytics and performance measurement.
            </p>
            <p>
              Most browsers allow you to control or block cookies through their settings. Note that
              disabling certain cookies may affect your ability to use some features of the Service.
            </p>
          </Section>

          <Section title="5. Data Retention">
            <p>
              We retain your personal information for as long as your account is active or as needed
              to provide the Service. If you delete your account, we will delete or anonymize your
              personal information within 30 days, except where we are required to retain it by law
              (for example, transaction records for tax purposes) or to resolve outstanding disputes.
            </p>
          </Section>

          <Section title="6. Your Rights and Choices">
            <p>Depending on your location, you may have the right to:</p>
            <ul className="list-disc list-inside space-y-1 ml-1">
              <li>Access a copy of the personal information we hold about you</li>
              <li>Correct inaccurate or incomplete information</li>
              <li>Request deletion of your account and associated data</li>
              <li>Object to or restrict certain processing of your data</li>
              <li>Data portability — receive your data in a structured, machine-readable format</li>
            </ul>
            <p>
              To exercise these rights, contact us at{" "}
              <a href="mailto:privacy@sniply.com" className="text-[var(--color-primary)] hover:underline">privacy@sniply.com</a>.
              We will respond to all requests within 30 days.
            </p>
          </Section>

          <Section title="7. Security">
            <p>
              We implement industry-standard technical and organizational safeguards to protect your
              information against unauthorized access, loss, or disclosure. These include encrypted
              data transmission (TLS), hashed credential storage, and access controls that limit
              who within Sniply can access personal data.
            </p>
            <p>
              No system is perfectly secure. If you believe your account has been compromised, please
              contact us immediately at{" "}
              <a href="mailto:support@sniply.com" className="text-[var(--color-primary)] hover:underline">support@sniply.com</a>.
            </p>
          </Section>

          <Section title="8. Children's Privacy">
            <p>
              The Service is not directed to individuals under the age of 18. We do not knowingly
              collect personal information from children. If we learn that we have inadvertently
              collected such information, we will delete it promptly. If you believe a child has
              provided us with personal information, please contact us at{" "}
              <a href="mailto:privacy@sniply.com" className="text-[var(--color-primary)] hover:underline">privacy@sniply.com</a>.
            </p>
          </Section>

          <Section title="9. Changes to This Policy">
            <p>
              We may update this Privacy Policy periodically. When we make material changes, we will
              revise the "Effective" date above and notify you by email or a notice on the Service.
              We encourage you to review this policy whenever you use the Service to stay informed
              about how we protect your information.
            </p>
          </Section>

          <Section title="10. Contact Us">
            <p>
              If you have questions, concerns, or requests related to this Privacy Policy, please
              reach out:
            </p>
            <address className="not-italic bg-gray-50 rounded-xl p-4 text-sm text-gray-600">
              Sniply, Inc. — Privacy Team<br />
              Atlanta, GA<br />
              <a href="mailto:privacy@sniply.com" className="text-[var(--color-primary)] hover:underline">privacy@sniply.com</a>
            </address>
          </Section>

        </div>
      </main>

      <Footer />
    </div>
  );
}
